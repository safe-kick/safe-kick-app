import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EventSource from 'react-native-sse';
import { TopBar, WFBadge, WFCard } from '../components/ui';
import { RASPI_API_BASE } from '../constants/api';
import { T } from '../constants/colors';
import { apiCall, raspiApiCall } from '../utils/api';

type CheckStatus = 'done' | 'checking' | 'ok' | 'fail';
type ModalStage = 'alcoholGuide' | 'alcoholMeasuring' | 'alcoholSuccess' | 'alcoholFail' | 'riderGuide' | 'riderMeasuring' | 'riderFail' | null;

interface CheckItem {
  id: 'face' | 'helmet' | 'alcohol' | 'rider' | 'lock';
  label: string;
  status: CheckStatus;
  value?: string;
}

interface SafetySensorData {
  gas?: number;
  weight?: number;
  is_drunk?: boolean;
  is_two_person?: boolean;
  is_locked?: boolean;
  warning_reason?: string | null;
  safety_state?: 'starting' | 'locked' | 'checking_alcohol' | 'waiting_rider' | 'checking_rider' | 'unlocking' | 'monitoring' | 'warning' | 'fault';
  stm32_connected?: boolean;
}

const INITIAL_CHECKS: CheckItem[] = [
  { id: 'face', label: '얼굴 인증', status: 'done', value: '완료' },
  { id: 'helmet', label: '헬멧 착용', status: 'done', value: '착용' },
  { id: 'alcohol', label: '음주 측정 (가스 센서)', status: 'checking' },
  { id: 'rider', label: '탑승 인원 감지', status: 'checking' },
  { id: 'lock', label: '잠금 상태', status: 'checking', value: '잠김' },
];

const errorDetail = (error: unknown) => error instanceof Error ? error.message : String(error);

function CheckRow({ label, status, value }: CheckItem) {
  const complete = status === 'done' || status === 'ok';
  const failed = status === 'fail';
  const badgeLabel = status === 'done' ? '완료' : status === 'ok' ? '정상' : failed ? '실패' : '대기';
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkIcon, complete && styles.checkIconOk, failed && styles.checkIconFail]}>
        <Text style={[styles.checkMark, failed && { color: T.err }]}>{failed ? '!' : complete ? '✓' : '·'}</Text>
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
      {value ? <Text style={styles.checkValue}>{value}</Text> : null}
      <WFBadge label={badgeLabel} status={complete ? 'ok' : failed ? 'err' : 'connecting'} />
    </View>
  );
}

function Dots({ active, color = T.info }: { active: number; color?: string }) {
  return <View style={styles.dots}>{[0, 1, 2].map(index => <View key={index} style={[styles.dot, index === active && { backgroundColor: color }]} />)}</View>;
}

function Progress({ value }: { value: number }) {
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(8, Math.min(100, value))}%` }]} /></View>;
}

export default function SafetyCheckScreen() {
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS);
  const [modalStage, setModalStage] = useState<ModalStage>('alcoholGuide');
  const [sensor, setSensor] = useState<SafetySensorData>({});
  const [kickboardId, setKickboardId] = useState('KICK-A23F');
  const [userId, setUserId] = useState<number | null>(null);
  const [startingCommand, setStartingCommand] = useState(false);
  const [fatalError, setFatalError] = useState('');
  const [allPassed, setAllPassed] = useState(false);
  const [countdown, setCountdown] = useState(2);
  const eventSourceRef = useRef<EventSource | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const riderCheckStartedRef = useRef(false);
  const alcoholSuccessHandledRef = useRef(false);
  const rideStartingRef = useRef(false);

  const updateCheck = useCallback((id: CheckItem['id'], patch: Partial<CheckItem>) => {
    setChecks(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const startAlcoholCheck = useCallback(async () => {
    if (!userId || startingCommand) return;
    setStartingCommand(true);
    setFatalError('');
    setModalStage('alcoholMeasuring');
    updateCheck('alcohol', { status: 'checking', value: '측정 중' });
    try {
      const response = await raspiApiCall('POST', '/session/alcohol-check', { user_id: userId });
      if (!response?.data?.accepted) throw new Error(response?.message || '음주 측정을 시작하지 못했습니다.');
    } catch (error) {
      setFatalError(errorDetail(error));
      setModalStage('alcoholGuide');
    } finally {
      setStartingCommand(false);
    }
  }, [startingCommand, updateCheck, userId]);

  const startWeightCheck = useCallback(async () => {
    if (!userId || riderCheckStartedRef.current) return;
    riderCheckStartedRef.current = true;
    setModalStage('riderMeasuring');
    updateCheck('rider', { status: 'checking', value: '감지 중' });
    try {
      const response = await raspiApiCall('POST', '/session/weight-check', { user_id: userId });
      if (!response?.data?.accepted) throw new Error(response?.message || '탑승 인원 감지를 시작하지 못했습니다.');
    } catch (error) {
      riderCheckStartedRef.current = false;
      setFatalError(errorDetail(error));
      setModalStage('riderGuide');
    }
  }, [updateCheck, userId]);

  useEffect(() => {
    if (modalStage !== 'riderGuide' || !userId) return;
    transitionTimerRef.current = setTimeout(() => void startWeightCheck(), 1400);
    return () => { if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current); };
  }, [modalStage, startWeightCheck, userId]);

  useEffect(() => {
    let disposed = false;
    const prepare = async () => {
      try {
        const [sessionId, userJson, face, helmet, storedKickboardId] = await Promise.all([
          AsyncStorage.getItem('session_id'), AsyncStorage.getItem('user'), AsyncStorage.getItem('face_verified'),
          AsyncStorage.getItem('helmet_verified'), AsyncStorage.getItem('kickboard_id'),
        ]);
        const user = userJson ? JSON.parse(userJson) : null;
        if (!sessionId || !user?.id || face !== 'true' || helmet !== 'true') throw new Error('얼굴·헬멧 인증 또는 안전 점검 세션 정보가 없습니다.');
        if (disposed) return;
        setUserId(Number(user.id));
        if (storedKickboardId) setKickboardId(storedKickboardId);

        const eventSource = new EventSource(`${RASPI_API_BASE}/session/stream`);
        eventSourceRef.current = eventSource;
        eventSource.addEventListener('message', event => {
          if (disposed || !event.data) return;
          try {
            const data: SafetySensorData = JSON.parse(event.data);
            setSensor(data);
            if (data.stm32_connected === false || data.safety_state === 'fault') {
              setFatalError('안전 장치 연결을 확인해주세요.');
              return;
            }
            const alcoholFailed = data.is_drunk === true || data.warning_reason === 'drunk';
            const initialOverweight = data.safety_state === 'checking_rider' && (data.weight ?? 0) >= 110;
            const riderFailed = data.is_two_person === true || data.warning_reason === 'two_person' || initialOverweight;

            if (alcoholFailed) {
              updateCheck('alcohol', { status: 'fail', value: `${data.gas ?? 0} ppm` });
              setModalStage('alcoholFail');
              alcoholSuccessHandledRef.current = false;
              return;
            }
            if (data.safety_state === 'checking_alcohol') {
              setModalStage('alcoholMeasuring');
              updateCheck('alcohol', { status: 'checking', value: data.gas === undefined ? '측정 중' : `${data.gas} ppm` });
              return;
            }
            if (data.safety_state === 'waiting_rider' && !alcoholSuccessHandledRef.current) {
              alcoholSuccessHandledRef.current = true;
              updateCheck('alcohol', { status: 'ok', value: `${data.gas ?? 0} ppm` });
              setModalStage('alcoholSuccess');
              transitionTimerRef.current = setTimeout(() => setModalStage('riderGuide'), 1500);
              return;
            }
            if (riderFailed) {
              updateCheck('rider', { status: 'fail', value: `${data.weight ?? 0} kg` });
              setModalStage('riderFail');
              return;
            }
            if (data.safety_state === 'checking_rider' || data.safety_state === 'unlocking') {
              updateCheck('rider', { status: 'checking', value: data.weight === undefined ? '감지 중' : `${data.weight} kg` });
              updateCheck('lock', { status: 'checking', value: data.safety_state === 'unlocking' ? '해제 중' : '잠김' });
              setModalStage('riderMeasuring');
              return;
            }
            if (data.safety_state === 'monitoring' && data.is_locked === false) {
              updateCheck('rider', { status: 'ok', value: '1명' });
              updateCheck('lock', { status: 'ok', value: '해제 완료' });
              setModalStage(null);
              setAllPassed(true);
            }
          } catch (error) {
            setFatalError(`센서 데이터 처리 실패: ${errorDetail(error)}`);
          }
        });
        eventSource.addEventListener('error', () => { if (!disposed) setFatalError('Raspberry Pi 센서 연결이 끊어졌습니다.'); });
      } catch (error) {
        if (!disposed) setFatalError(errorDetail(error));
      }
    };
    void prepare();
    return () => {
      disposed = true;
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [updateCheck]);

  const startRide = useCallback(async () => {
    if (rideStartingRef.current) return;
    rideStartingRef.current = true;
    try {
      const [storedKickboardId, sessionId] = await Promise.all([AsyncStorage.getItem('kickboard_id'), AsyncStorage.getItem('session_id')]);
      if (!storedKickboardId || !sessionId) throw new Error('킥보드 또는 안전 점검 세션 정보가 없습니다.');
      const response = await apiCall('POST', '/rides/start', { kickboard_id: storedKickboardId, started_at: new Date().toISOString() });
      const rideId = response?.data?.ride_id;
      if (!rideId) throw new Error('운행 시작 응답에 운행 ID가 없습니다.');
      await AsyncStorage.setItem('ride_id', String(rideId));
      router.replace('/monitoring');
    } catch (error) {
      rideStartingRef.current = false;
      setFatalError(errorDetail(error));
      setAllPassed(false);
    }
  }, []);

  useEffect(() => {
    if (!allPassed) return;
    setCountdown(2);
    const timer = setInterval(() => setCountdown(value => {
      if (value <= 1) { clearInterval(timer); void startRide(); return 0; }
      return value - 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [allPassed, startRide]);

  const retryAlcohol = () => { alcoholSuccessHandledRef.current = false; setFatalError(''); void startAlcoholCheck(); };
  const retryRider = () => {
    setFatalError('');
    updateCheck('rider', { status: 'checking', value: sensor.weight === undefined ? '감지 중' : `${sensor.weight} kg` });
    setModalStage('riderMeasuring');
  };
  const gasProgress = sensor.gas === undefined ? 12 : Math.min(92, 20 + Math.abs(sensor.gas) % 72);
  const riderProgress = sensor.weight === undefined ? 10 : Math.min(92, 22 + sensor.weight);

  return (
    <View style={styles.screen}>
      <TopBar title="안전 점검" back onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.scooterRow}>
          <Text style={styles.scooterIcon}>🛴</Text>
          <View style={{ flex: 1 }}><Text style={styles.scooterLabel}>연결된 스쿠터</Text><Text style={styles.scooterId}>{kickboardId}</Text></View>
          <WFBadge label="연결됨" status="info" />
        </View>
        <WFCard style={styles.checkCard}>{checks.map(item => <CheckRow key={item.id} {...item} />)}</WFCard>
        {fatalError ? <View style={styles.errorBanner}><Text style={styles.errorText}>⚠ {fatalError}</Text></View> : null}
        {allPassed ? <><View style={styles.passBanner}><Text style={styles.passText}>✓  모든 안전 점검을 통과했습니다</Text></View><View style={styles.readyBox}><Text style={styles.readyTitle}>운행 준비 완료</Text><Text style={styles.readySub}>모든 안전 점검을 통과했습니다</Text><Text style={styles.autoStart}>{countdown}초 후 라이딩이 자동으로 시작됩니다.</Text><Text style={styles.countdown}>{countdown}</Text></View></> : null}
      </ScrollView>

      {modalStage ? <View style={styles.overlay}><View style={styles.modal}>
        {modalStage === 'alcoholGuide' ? <><ModalTitle icon="🌬️" title="음주 측정 안내" tone="blue" /><View style={styles.sensorDiagram}><Text style={styles.diagramLabel}>센서</Text><View style={styles.diagramRow}><View style={styles.handle} /><Text style={styles.sensorCircle}>●</Text><View style={styles.handle} /></View><Text style={styles.diagramCaption}>핸들 중앙 = 음주 측정 센서</Text></View><Text style={styles.bodyText}>킥보드 손잡이 가운데에 있는 <Text style={styles.blueStrong}>음주 측정 센서</Text>에 숨을 불어주세요.</Text><Text style={styles.mutedText}>측정 준비가 완료되면 아래 시작 버튼을 눌러주세요.</Text>{fatalError ? <Text style={styles.inlineError}>{fatalError}</Text> : null}<View style={styles.buttonRow}><ModalButton label="취소" onPress={() => router.replace('/main')} secondary /><ModalButton label={startingCommand ? '시작 중...' : '음주 측정 시작'} onPress={() => void startAlcoholCheck()} disabled={startingCommand || !userId} /></View></> : null}
        {modalStage === 'alcoholMeasuring' ? <><ModalTitle icon="🔄" title="음주 측정 중" tone="blue" /><Text style={styles.bodyText}>센서를 향해 일정하게 숨을 불어주세요.</Text><View style={styles.measureRow}><Text style={styles.mutedText}>측정 중...</Text><Text style={styles.measureValue}>{sensor.gas ?? '—'} ppm</Text></View><Progress value={gasProgress} /><Dots active={0} /></> : null}
        {modalStage === 'alcoholSuccess' ? <><ModalTitle icon="✅" title="음주 측정 완료" tone="green" /><View style={styles.successBox}><Text style={styles.successTitle}>음주 측정을 통과했습니다.</Text><Text style={styles.successSub}>측정값: {sensor.gas ?? 0} ppm</Text></View><Text style={[styles.mutedText, { textAlign: 'center' }]}>탑승 인원 감지로 이동 중...</Text><Dots active={0} color={T.ok} /></> : null}
        {modalStage === 'alcoholFail' ? <><ModalTitle icon="⚠️" title="음주 감지됨" tone="red" /><View style={styles.failBox}><Text style={styles.failTitle}>음주가 감지되어 운행이 제한됩니다.</Text><Text style={styles.failSub}>측정값: {sensor.gas ?? 0} ppm (기준치 초과)</Text></View><Text style={styles.mutedText}>음주 상태에서는 킥보드를 이용할 수 없습니다. 안전을 위해 탑승을 삼가주세요.</Text><View style={styles.buttonRow}><ModalButton label="취소" onPress={() => router.replace('/main')} secondary /><ModalButton label="다시 측정" onPress={retryAlcohol} /></View></> : null}
        {modalStage === 'riderGuide' ? <><ModalTitle icon="🛴" title="탑승 인원 감지 안내" tone="blue" /><View style={styles.riderDiagram}><Text style={styles.riderPerson}>◯</Text><View style={styles.riderBody} /><View style={styles.board} /><View style={styles.wheels}><Text>●</Text><Text>●</Text></View><Text style={styles.diagramCaption}>1인만 탑승하세요</Text></View><Text style={styles.bodyText}>킥보드에 혼자 올라가 주세요. 탑승 인원은 자동으로 감지됩니다.</Text><View style={styles.warningBox}><Text style={styles.warningText}>⚠ 라이딩 중 추가 탑승자가 감지되면 안전을 위해 킥보드가 감속 후 정지됩니다.</Text></View><Text style={[styles.mutedText, { textAlign: 'center' }]}>자동 감지 시작 중...</Text></> : null}
        {modalStage === 'riderMeasuring' ? <><ModalTitle icon="⚖️" title="탑승 인원 확인 중" tone="blue" /><Text style={styles.bodyText}>측정이 끝날 때까지 킥보드 위에서 움직이지 말아주세요.</Text><View style={styles.weightBox}><Text style={styles.weightLabel}>⚖️  자동 감지 중...</Text><Text style={styles.weightValue}>{sensor.weight ?? '—'} kg</Text></View><Progress value={riderProgress} /></> : null}
        {modalStage === 'riderFail' ? <><ModalTitle icon="⚠️" title="추가 탑승자 감지됨" tone="red" /><View style={styles.failBox}><Text style={styles.failTitle}>2인 이상 탑승이 감지되었습니다.</Text><Text style={styles.failSub}>감지 중량: {sensor.weight ?? 0} kg</Text></View><Text style={styles.mutedText}>혼자만 탑승 후 다시 시도해 주세요.</Text><View style={styles.buttonRow}><ModalButton label="취소" onPress={() => router.replace('/main')} secondary /><ModalButton label="다시 감지" onPress={retryRider} /></View></> : null}
      </View></View> : null}
    </View>
  );
}

function ModalTitle({ icon, title, tone }: { icon: string; title: string; tone: 'blue' | 'green' | 'red' }) {
  const backgroundColor = tone === 'green' ? T.okBg : tone === 'red' ? T.errBg : T.infoBg;
  return <View style={styles.modalTitleRow}><View style={[styles.modalIcon, { backgroundColor }]}><Text style={styles.modalIconText}>{icon}</Text></View><Text style={styles.modalTitle}>{title}</Text></View>;
}

function ModalButton({ label, onPress, secondary, disabled }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.modalButton, secondary && styles.modalButtonSecondary, disabled && { opacity: 0.45 }]}><Text style={[styles.modalButtonText, secondary && { color: T.text }]}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  scooterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 13, borderWidth: 1, borderColor: T.border, backgroundColor: T.bgAlt },
  scooterIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: T.fill, textAlign: 'center', textAlignVertical: 'center', paddingTop: 9 },
  scooterLabel: { fontSize: 12, color: T.textMuted },
  scooterId: { fontSize: 15, color: T.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  checkCard: { paddingHorizontal: 16, paddingVertical: 2 },
  checkRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  checkIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: T.fill, alignItems: 'center', justifyContent: 'center' },
  checkIconOk: { backgroundColor: T.okBg }, checkIconFail: { backgroundColor: T.errBg },
  checkMark: { color: T.ok, fontSize: 18, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 14, color: T.text },
  checkValue: { fontSize: 12, color: T.textSub, fontVariant: ['tabular-nums'] },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  modal: { width: '100%', maxWidth: 390, borderRadius: 20, backgroundColor: T.bg, padding: 20, gap: 16 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, modalIconText: { fontSize: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: T.text },
  bodyText: { fontSize: 14, lineHeight: 22, color: T.text }, mutedText: { fontSize: 12, lineHeight: 19, color: T.textMuted },
  blueStrong: { color: T.info, fontWeight: '700' },
  sensorDiagram: { alignItems: 'center', gap: 7, paddingVertical: 2 }, diagramLabel: { color: T.info, fontSize: 10 },
  diagramRow: { flexDirection: 'row', alignItems: 'center' }, handle: { width: 30, height: 16, backgroundColor: T.fillMed, borderRadius: 2 },
  sensorCircle: { width: 22, height: 22, marginHorizontal: 23, borderRadius: 11, borderWidth: 3, borderColor: T.info, color: T.info, textAlign: 'center', lineHeight: 16 },
  diagramCaption: { color: T.info, fontSize: 10, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: 9, marginTop: 2 },
  modalButton: { flex: 1, height: 44, borderRadius: 11, backgroundColor: T.text, alignItems: 'center', justifyContent: 'center' },
  modalButtonSecondary: { backgroundColor: T.bg, borderWidth: 1, borderColor: T.border }, modalButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  measureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, measureValue: { fontSize: 12, color: T.info, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: T.fill, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 3, backgroundColor: T.info },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.fillMed },
  successBox: { padding: 13, borderRadius: 10, backgroundColor: T.okBg, borderWidth: 1, borderColor: '#B7DDBA' }, successTitle: { fontSize: 13, color: T.ok, fontWeight: '800' }, successSub: { marginTop: 4, fontSize: 11, color: '#4D9A55' },
  failBox: { padding: 13, borderRadius: 10, backgroundColor: T.errBg, borderWidth: 1, borderColor: '#FFB8BE' }, failTitle: { fontSize: 13, color: '#E72B38', fontWeight: '800' }, failSub: { marginTop: 4, fontSize: 11, color: '#E45A65' },
  inlineError: { fontSize: 11, color: T.err },
  riderDiagram: { height: 120, alignItems: 'center', justifyContent: 'center' }, riderPerson: { fontSize: 30, color: T.fillMed, lineHeight: 31 }, riderBody: { width: 7, height: 28, backgroundColor: T.fillMed }, board: { width: 66, height: 7, borderRadius: 2, backgroundColor: T.fillMed }, wheels: { width: 78, flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  warningBox: { padding: 12, borderRadius: 9, backgroundColor: T.warnBg, borderWidth: 1, borderColor: '#FFD09E' }, warningText: { color: T.warn, fontSize: 11, lineHeight: 17 },
  weightBox: { padding: 14, borderRadius: 10, backgroundColor: T.infoBg }, weightLabel: { fontSize: 11, color: T.info }, weightValue: { marginTop: 4, fontSize: 22, color: T.info, fontWeight: '700', fontVariant: ['tabular-nums'] },
  errorBanner: { padding: 12, borderRadius: 10, backgroundColor: T.errBg, borderWidth: 1, borderColor: '#FFB8BE' }, errorText: { color: T.err, fontSize: 12 },
  passBanner: { padding: 14, borderRadius: 11, backgroundColor: T.okBg, borderWidth: 1, borderColor: '#B7DDBA' }, passText: { color: T.ok, fontSize: 13, fontWeight: '700' },
  readyBox: { alignItems: 'center', paddingTop: 12, gap: 8 }, readyTitle: { fontSize: 18, color: T.text, fontWeight: '800' }, readySub: { fontSize: 13, color: T.textMuted }, autoStart: { fontSize: 12, color: T.info, marginTop: 4 }, countdown: { fontSize: 56, color: T.text, fontWeight: '800', lineHeight: 64 },
});
