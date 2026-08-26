import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { T } from '../constants/colors';
import { TopBar, WFCard, WFBadge } from '../components/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventSource from 'react-native-sse';
import { apiCall, raspiApiCall } from '../utils/api';
import { RASPI_API_BASE } from '../constants/api';

type S = 'done' | 'checking' | 'ok' | 'fail';
interface CheckItem { label: string; status: S; value?: string }

type FailureCode =
  | 'IDENTITY_FAILED'
  | 'SESSION_MISSING'
  | 'CHECK_INITIALIZATION_FAILED'
  | 'SSE_CONNECTION_FAILED'
  | 'SENSOR_DATA_INVALID'
  | 'STM32_DISCONNECTED'
  | 'SAFETY_FAULT'
  | 'ALCOHOL_DETECTED'
  | 'TWO_PERSON_DETECTED'
  | 'WEIGHT_CHECK_START_FAILED'
  | 'RIDE_INFO_MISSING'
  | 'RIDE_START_API_FAILED'
  | 'RIDE_RESPONSE_INVALID';

interface FailureInfo {
  code: FailureCode;
  message: string;
  detail?: string;
}

const errorDetail = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

interface SafetySensorData {
  gas?: number;
  weight?: number;
  is_drunk?: boolean;
  is_two_person?: boolean;
  is_locked?: boolean;
  status?: string;
  warning_reason?: string | null;
  safety_state?: 'starting' | 'locked' | 'checking_alcohol' | 'waiting_rider' | 'checking_rider' | 'unlocking' | 'monitoring' | 'warning' | 'fault';
  stm32_connected?: boolean;
}

function CheckRow({ label, status, value }: CheckItem) {
  const isDone = status === 'done';
  const isOk = status === 'ok' || isDone;
  const isFail = status === 'fail';
  const isChecking = status === 'checking';

  const iconBg = isFail ? T.errBg : isOk ? T.okBg : T.fill;
  const badgeStatus = isDone ? 'ok' : isChecking ? 'connecting' : isOk ? 'ok' : 'err';
  const badgeLabel = isDone ? '완료' : isChecking ? '확인 중' : isOk ? '정상' : '실패';

  return (
    <View style={cr.row}>
      <View style={[cr.iconBox, { backgroundColor: iconBg }]}>
        {isOk
          ? <Text style={[cr.icon, { color: T.ok }]}>✓</Text>
          : isFail
          ? <Text style={[cr.icon, { color: T.err }]}>✕</Text>
          : <View style={cr.spinner} />}
      </View>
      <Text style={cr.label}>{label}</Text>
      {value && <Text style={[cr.value, isFail && { color: T.err }]}>{value}</Text>}
      <WFBadge label={badgeLabel} status={badgeStatus} />
    </View>
  );
}

const cr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 14, fontWeight: '700' },
  spinner: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: T.fillMed, borderTopColor: T.info,
  },
  label: { flex: 1, fontSize: 14, color: T.text },
  value: { fontSize: 12, color: T.textSub },
});

export default function SafetyCheckScreen() {
  const [checks, setChecks] = useState<CheckItem[]>([
    { label: '얼굴 인증', status: 'done' },
    { label: '헬멧 착용', status: 'checking' },
    { label: '음주 측정 (가스 센서)', status: 'checking' },
    { label: '탑승 인원 감지', status: 'checking' },
    { label: '잠금 상태', status: 'checking' },
  ]);
  const [phase, setPhase] = useState<'checking' | 'pass' | 'fail'>('checking');
  const [failure, setFailure] = useState<FailureInfo | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    runChecks();

    return () => {
      runIdRef.current += 1;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  const runChecks = async () => {
    const runId = ++runIdRef.current;
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setPhase('checking');
    setFailure(null);

    const fail = (info: FailureInfo, context?: Record<string, unknown>) => {
      if (runId !== runIdRef.current) return;
      const logContext = {
        ...(info.detail ? { detail: info.detail } : {}),
        ...context,
      };
      if (info.code === 'ALCOHOL_DETECTED' || info.code === 'TWO_PERSON_DETECTED') {
        console.warn(`[SAFETY CHECK][${info.code}] ${info.message}`, logContext);
      } else {
        console.error(`[SAFETY CHECK][${info.code}] ${info.message}`, logContext);
      }
      setFailure(info);
      setPhase('fail');
    };

    try {
      const [sessionId, userJson, faceVerified, helmetVerified] = await Promise.all([
        AsyncStorage.getItem('session_id'),
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('face_verified'),
        AsyncStorage.getItem('helmet_verified'),
      ]);
      const user = userJson ? JSON.parse(userJson) : null;
      if (!sessionId || !user?.id) {
        fail({
          code: 'SESSION_MISSING',
          message: '활성 안전점검 세션 또는 로그인 정보가 없습니다.',
        }, { hasSessionId: Boolean(sessionId), hasUserId: Boolean(user?.id) });
        return;
      }

      const identityPassed = faceVerified === 'true' && helmetVerified === 'true';
      setChecks(p => p.map(c => {
        if (c.label === '얼굴 인증') {
          return { ...c, status: faceVerified === 'true' ? 'done' : 'fail', value: faceVerified === 'true' ? '완료' : '미인증' };
        }
        if (c.label.includes('헬멧')) {
          return { ...c, status: helmetVerified === 'true' ? 'ok' : 'fail', value: helmetVerified === 'true' ? '착용' : '미인증' };
        }
        return { ...c, status: 'checking', value: undefined };
      }));
      if (!identityPassed) {
        fail({
          code: 'IDENTITY_FAILED',
          message: '얼굴 또는 헬멧 인증이 완료되지 않았습니다.',
        }, { faceVerified, helmetVerified });
        return;
      }

      const eventSource = new EventSource(`${RASPI_API_BASE}/session/stream`);
      eventSourceRef.current = eventSource;
      let finished = false;
      let weightCheckRequested = false;
      let lastSafetyState: SafetySensorData['safety_state'];

      console.info('[SAFETY CHECK][SSE_CONNECTED] 센서 스트림 연결을 시작했습니다.', {
        sessionId,
        userId: user.id,
        url: `${RASPI_API_BASE}/session/stream`,
      });

      eventSource.addEventListener('message', (event) => {
        if (runId !== runIdRef.current || !event.data) return;

        try {
          const data: SafetySensorData = JSON.parse(event.data);
          const safetyState = data.safety_state;
          if (safetyState !== lastSafetyState) {
            console.info('[SAFETY CHECK][STATE_CHANGED] 안전 상태가 변경되었습니다.', {
              from: lastSafetyState ?? null,
              to: safetyState ?? null,
              stm32Connected: data.stm32_connected,
            });
            lastSafetyState = safetyState;
          }
          const alcoholFail = data.is_drunk === true || data.warning_reason === 'drunk';
          const passengerFail = data.is_two_person === true || data.warning_reason === 'two_person';
          const hardwareFail = safetyState === 'fault' || data.stm32_connected === false;
          const alcoholPassed = ['waiting_rider', 'checking_rider', 'unlocking', 'monitoring'].includes(safetyState ?? '');
          const passengerPassed = ['unlocking', 'monitoring'].includes(safetyState ?? '');
          const unlocked = safetyState === 'monitoring' && data.is_locked === false;

          if (safetyState === 'waiting_rider' && !weightCheckRequested) {
            weightCheckRequested = true;
            console.info('[SAFETY CHECK][WEIGHT_CHECK_REQUESTED] STM32 무게 측정을 요청합니다.', {
              userId: user.id,
            });
            raspiApiCall('POST', '/session/weight-check', { user_id: user.id })
              .then(res => {
                if (!res?.data?.accepted) {
                  throw new Error(res?.message || '탑승 인원 측정을 시작하지 못했습니다.');
                }
                console.info('[SAFETY CHECK][WEIGHT_CHECK_STARTED] STM32 무게 측정이 시작되었습니다.', {
                  safetyState: res.data.safety_state,
                });
              })
              .catch(e => {
                if (finished || runId !== runIdRef.current) return;
                finished = true;
                eventSource.close();
                eventSourceRef.current = null;
                setChecks(p => p.map(c => c.label.includes('탑승')
                  ? { ...c, status: 'fail', value: '측정 시작 실패' }
                  : c));
                fail({
                  code: 'WEIGHT_CHECK_START_FAILED',
                  message: '무게 측정을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.',
                  detail: errorDetail(e),
                }, { safetyState, userId: user.id });
              });
          }

          setChecks(p => p.map(c => {
            if (c.label.includes('음주')) {
              if (alcoholFail) return { ...c, status: 'fail', value: `${data.gas ?? 0} ppm` };
              if (alcoholPassed) return { ...c, status: 'ok', value: `${data.gas ?? 0} ppm` };
              return { ...c, status: 'checking', value: data.gas !== undefined ? `${data.gas} ppm` : undefined };
            }
            if (c.label.includes('탑승')) {
              if (passengerFail) return { ...c, status: 'fail', value: '2명 이상' };
              if (passengerPassed) return { ...c, status: 'ok', value: '1명' };
              return { ...c, status: 'checking', value: data.weight !== undefined ? `${data.weight} kg` : undefined };
            }
            if (c.label.includes('잠금')) {
              if (hardwareFail) return { ...c, status: 'fail', value: '장치 오류' };
              if (unlocked) return { ...c, status: 'ok', value: '해제' };
              return { ...c, status: 'checking', value: data.is_locked ? '잠김' : '해제 중' };
            }
            return c;
          }));

          if (alcoholFail || passengerFail || hardwareFail) {
            finished = true;
            eventSource.close();
            eventSourceRef.current = null;
            if (data.stm32_connected === false) {
              fail({
                code: 'STM32_DISCONNECTED',
                message: 'STM32 연결이 끊어졌습니다. 장치 연결을 확인해주세요.',
              }, { safetyState });
            } else if (safetyState === 'fault') {
              fail({
                code: 'SAFETY_FAULT',
                message: '안전 장치 오류가 발생했습니다. Raspberry Pi와 STM32를 확인해주세요.',
              }, { safetyState });
            } else if (alcoholFail) {
              fail({
                code: 'ALCOHOL_DETECTED',
                message: '음주가 감지되어 운행이 제한됩니다.',
              }, { gas: data.gas, warningReason: data.warning_reason });
            } else {
              fail({
                code: 'TWO_PERSON_DETECTED',
                message: '2인 이상 탑승이 감지되어 운행이 제한됩니다.',
              }, { weight: data.weight, warningReason: data.warning_reason });
            }
            return;
          }

          if (unlocked && !data.is_drunk && !data.is_two_person) {
            finished = true;
            console.info('[SAFETY CHECK][PASSED] 모든 안전 점검을 통과했습니다.', {
              gas: data.gas,
              weight: data.weight,
              isLocked: data.is_locked,
            });
            setPhase('pass');
            eventSource.close();
            eventSourceRef.current = null;
          }
        } catch (e) {
          if (finished || runId !== runIdRef.current) return;
          finished = true;
          eventSource.close();
          eventSourceRef.current = null;
          fail({
            code: 'SENSOR_DATA_INVALID',
            message: '센서 데이터 형식이 올바르지 않습니다.',
            detail: errorDetail(e),
          }, { rawData: event.data });
        }
      });

      eventSource.addEventListener('error', (event) => {
        if (finished || runId !== runIdRef.current) return;
        finished = true;
        eventSource.close();
        eventSourceRef.current = null;
        fail({
          code: 'SSE_CONNECTION_FAILED',
          message: 'Raspberry Pi 센서 연결이 끊어졌습니다. 서버 상태를 확인해주세요.',
        }, { url: `${RASPI_API_BASE}/session/stream`, eventType: event.type });
      });
    } catch (e) {
      fail({
        code: 'CHECK_INITIALIZATION_FAILED',
        message: '안전 점검 정보를 불러오거나 연결을 초기화하지 못했습니다.',
        detail: errorDetail(e),
      });
    }
  };

  const startRide = async () => {
    try {
      const kickboardId = await AsyncStorage.getItem('kickboard_id');
      const sessionId = await AsyncStorage.getItem('session_id');

      if (!kickboardId || !sessionId) {
        const info: FailureInfo = {
          code: 'RIDE_INFO_MISSING',
          message: '킥보드 또는 안전점검 세션 정보가 없습니다.',
        };
        console.error(`[RIDE START][${info.code}] ${info.message}`, {
          hasKickboardId: Boolean(kickboardId),
          hasSessionId: Boolean(sessionId),
        });
        setFailure(info);
        setPhase('fail');
        return;
      }

      const rideRes = await apiCall('POST', '/rides/start', {
        kickboard_id: kickboardId,
        started_at: new Date().toISOString(),
      });

      const rideId = rideRes?.data?.ride_id;
      if (!rideId) {
        const info: FailureInfo = {
          code: 'RIDE_RESPONSE_INVALID',
          message: '운행 시작 응답에 운행 ID가 없습니다.',
        };
        console.error(`[RIDE START][${info.code}] ${info.message}`, { response: rideRes });
        setFailure(info);
        setPhase('fail');
        return;
      }

      await AsyncStorage.setItem('ride_id', String(rideId));

      console.info('[RIDE START][SUCCESS] 운행이 시작되었습니다.', {
        rideId,
        kickboardId,
        sessionId,
      });

      router.replace('/monitoring');
    } catch (e) {
      const info: FailureInfo = {
        code: 'RIDE_START_API_FAILED',
        message: '앱 서버에서 운행을 시작하지 못했습니다. 서버 연결과 킥보드 상태를 확인해주세요.',
        detail: errorDetail(e),
      };
      console.error(`[RIDE START][${info.code}] ${info.message}`, { detail: info.detail });
      setFailure(info);
      setPhase('fail');
    }
  };

  const allPass = phase === 'pass';
  const anyFail = phase === 'fail';

  const helmetFail = failure?.code === 'IDENTITY_FAILED'
    && checks.find(c => c.label.includes('헬멧'))?.status === 'fail';

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <TopBar title="안전 점검" back onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.content}>

        <View style={s.scooterRow}>
          <View style={s.scooterIcon} />
          <View style={{ flex: 1 }}>
            <Text style={s.scooterLabel}>연결된 스쿠터</Text>
            <Text style={s.scooterId}>KICK-A23F</Text>
          </View>
          <WFBadge label="연결됨" status="info" />
        </View>

        <WFCard style={{ padding: 0, paddingHorizontal: 16, paddingTop: 4 }}>
          {checks.map((c, i) => <CheckRow key={i} {...c} />)}
        </WFCard>

        {!allPass && !anyFail && (
          <View style={[s.msgBox, { backgroundColor: T.infoBg, borderColor: 'rgba(21,101,192,0.2)' }]}>
            <Text style={[s.msgText, { color: T.info }]}>
              ℹ  센서 데이터를 수신 중입니다. Raspberry Pi와 STM32가 점검 중입니다.
            </Text>
          </View>
        )}
        {anyFail && (
          <View style={{ gap: 8 }}>
            <View style={[s.msgBox, { backgroundColor: T.errBg, borderColor: 'rgba(198,40,40,0.2)' }]}>
              <Text style={[s.msgText, { color: T.err }]}>
                ⚠  {failure?.message ?? '알 수 없는 안전 점검 오류가 발생했습니다.'}
              </Text>
              {failure?.detail && <Text style={[s.msgText, { color: T.textSub, marginTop: 6 }]}>상세: {failure.detail}</Text>}
            </View>
            {helmetFail && (
              <View style={[s.msgBox, { backgroundColor: T.warnBg, borderColor: 'rgba(230,81,0,0.25)', flexDirection: 'row', gap: 8 }]}>
                <Text style={{ fontSize: 14 }}>🪖</Text>
                <Text style={[s.msgText, { color: T.warn, flex: 1 }]}>헬멧을 착용하고 카메라 앞에 서주세요.</Text>
              </View>
            )}
          </View>
        )}
        {allPass && (
          <View style={[s.msgBox, { backgroundColor: T.okBg, borderColor: 'rgba(46,125,50,0.2)' }]}>
            <Text style={[s.msgText, { color: T.ok }]}>
              ✓  모든 안전 점검을 통과했습니다
            </Text>
          </View>
        )}

        {allPass ? (
          <View style={s.readyBox}>
            <Text style={s.readyTitle}>운행 준비 완료</Text>
            <Text style={s.readySub}>모든 안전 점검을 통과했습니다</Text>
            <TouchableOpacity style={s.startBtn} onPress={startRide} activeOpacity={0.8}>
              <Text style={s.startBtnText}>⚡  라이딩 시작</Text>
            </TouchableOpacity>
          </View>
        ) : anyFail ? (
          <View style={s.btnGroup}>
            {/* onPress 누락되어 있던 버그 수정 — 다시 점검 실행되도록 */}
            <TouchableOpacity style={s.retryBtn} onPress={runChecks}>
              <Text style={s.retryBtnText}>↺  다시 시도</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => router.replace('/main')}>
              <Text style={s.cancelBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.disabledBtn}>
            <Text style={s.disabledBtnText}>점검 중...</Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  scooterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, backgroundColor: T.bgAlt,
    borderRadius: 12, borderWidth: 1, borderColor: T.border,
  },
  scooterIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: T.fill },
  scooterLabel: { fontSize: 12, color: T.textMuted },
  scooterId: { fontSize: 15, fontWeight: '700', color: T.text },
  msgBox: { padding: 14, borderRadius: 12, borderWidth: 1 },
  msgText: { fontSize: 13, lineHeight: 20 },
  readyBox: { alignItems: 'center', gap: 8 },
  readyTitle: { fontSize: 18, fontWeight: '700', color: T.text },
  readySub: { fontSize: 13, color: T.textMuted },
  startBtn: {
    width: '100%', height: 52, backgroundColor: T.text,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  startBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  disabledBtn: {
    width: '100%', height: 52, backgroundColor: T.fillMed,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  disabledBtnText: { color: T.textMuted, fontSize: 15, fontWeight: '600' },
  btnGroup: { gap: 10 },
  retryBtn: {
    width: '100%', height: 48, backgroundColor: T.fill,
    borderRadius: 12, borderWidth: 1.5, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  retryBtnText: { color: T.text, fontSize: 14, fontWeight: '600' },
  cancelBtn: {
    width: '100%', height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { color: T.text, fontSize: 14, fontWeight: '600' },
});
