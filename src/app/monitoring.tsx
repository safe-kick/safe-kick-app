import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Platform,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View,
} from 'react-native';
import { WFBadge } from '../components/ui';
import { T } from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventSource from 'react-native-sse';
import { apiCall, raspiApiCall } from '../utils/api';
import { RASPI_API_BASE, RASPI_IP } from '../constants/api';

// ─── 타입 ────────────────────────────────────────────────
type Phase = 'normal' | 'remeasure' | 'slowdown' | 'stopped';
type WarningReason = 'two_person';

interface SensorRow {
  label: string;
  status: 'ok' | 'warn' | 'info';
  value: string;
}

// ─── 상수 ────────────────────────────────────────────────
const LOCK_COUNTDOWN_SEC = 5;
const MAX_SPEED = 20;
const LIMITED_SPEED = 5;
const SSE_RECONNECT_MS = 2_000;

// 경고 사유별 타이틀
const WARNING_TITLES: Record<WarningReason, string> = {
  two_person: '이중 탑승 감지됨',
};

// 경고 사유 + 단계에 따른 서브 텍스트
function getWarningSub(reason: WarningReason, phase: Phase) {
  if (phase === 'stopped') {
    return '완전 정지됨 — 1인 탑승 후 재시작하세요';
  }
  if (reason === 'two_person' && phase === 'slowdown') {
    return '5초 동안 지속되면 잠금 처리됩니다';
  }
  return '단독 탑승 확인 시 자동 해제';
}

// ─── 단계 인디케이터 ──────────────────────────────────────
const STEPS = ['이상 감지', '감속 중', '잠금 대기', '잠금'];

function StepIndicator({ phase }: { phase: Phase }) {
  const activeIdx = { normal: -1, remeasure: 1, slowdown: 2, stopped: 3 }[phase];
  const isDanger = phase === 'slowdown' || phase === 'stopped';
  const isStopped = phase === 'stopped';

  const accentColor = isDanger ? T.err : T.warn;
  const accentBg = isDanger ? T.errBg : T.warnBg;

  // 깜빡임 애니메이션 (재측정 중, 감속 중 active dot용)
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase === 'remeasure' || phase === 'slowdown') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(blink, { toValue: 0.2, duration: 500, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      blink.setValue(1);
    }
  }, [phase]);

  return (
    <View style={si.wrap}>
      {STEPS.map((label, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;

        const dotBg = (done || active) ? accentBg : T.fill;
        const dotColor = (done || active) ? accentColor : T.fillMed;

        // 라인: active dot 앞까지 채움, stopped면 전부 채움
        const lineFilled = isStopped ? true : i <= activeIdx;
        const lineColor = lineFilled ? accentColor : T.border;

        const itemStyle = i === 0
          ? { flexDirection: 'row' as const, alignItems: 'center' as const }
          : si.item;

        // active dot — 재측정/감속 중이면 깜빡이는 동그라미
        const DotContent = () => {
          if (done || (active && isStopped)) {
            // done이거나 정지 active → 체크
            return <Text style={[si.check, { color: accentColor }]}>✓</Text>;
          }
          if (active && (phase === 'remeasure' || phase === 'slowdown')) {
            // 재측정/감속 active → 깜빡이는 동그라미
            return (
              <Animated.View style={[si.inner, { backgroundColor: dotColor, opacity: blink }]} />
            );
          }
          // pending → 회색 동그라미
          return <View style={[si.inner, { backgroundColor: dotColor }]} />;
        };

        return (
          <View key={label} style={itemStyle}>
            {/* 앞 연결선 */}
            {i > 0 && (
              <View style={[si.line, { backgroundColor: lineColor }]} />
            )}
            <View style={si.dotWrap}>
              <View style={[si.dot, { backgroundColor: dotBg }]}>
                <DotContent />
              </View>
              <Text style={[
                si.label,
                (done || active) && { color: accentColor },
                active && { fontWeight: '600' },
                !done && !active && { color: T.textMuted },
              ]}>
                {label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: T.bg, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  item: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: 2, marginBottom: 14 },
  dotWrap: { alignItems: 'center', gap: 4 },
  dot: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  inner: { width: 8, height: 8, borderRadius: 4 },
  check: { fontSize: 12, fontWeight: '700' },
  label: { fontSize: 9, color: T.textMuted, textAlign: 'center', width: 44 },
});

// ─── 경고 배너 ────────────────────────────────────────────
function WarningBanner({ phase, reason, countdown, cdProgress }: {
  phase: Phase; reason: WarningReason; countdown: number; cdProgress: Animated.Value;
}) {
  const isDanger = phase === 'slowdown' || phase === 'stopped';
  const bg = isDanger ? T.errBg : T.warnBg;
  const borderColor = isDanger ? 'rgba(198,40,40,0.2)' : 'rgba(230,81,0,0.2)';
  const textColor = isDanger ? T.err : T.warn;

  return (
    <View style={[wb.wrap, { backgroundColor: bg, borderBottomColor: borderColor }]}>
      <View style={wb.row}>
        <View style={[wb.iconBox, { backgroundColor: isDanger ? 'rgba(198,40,40,0.12)' : 'rgba(230,81,0,0.12)' }]}>
          <Text style={{ fontSize: 16 }}>
            ⚠
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[wb.title, { color: textColor }]}>{WARNING_TITLES[reason]}</Text>
          <Text style={[wb.sub, { color: textColor }]}>
            {getWarningSub(reason, phase)}
          </Text>
        </View>
        {/* 카운트다운 */}
        {phase === 'remeasure' || phase === 'slowdown' ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={[wb.bigNum, { color: textColor }]}>{countdown}</Text>
            <Text style={[wb.bigSub, { color: textColor }]}>sec</Text>
          </View>
        ) : phase === 'stopped' ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[wb.bigNum, { color: textColor, fontSize: 18 }]}>0 <Text style={{ fontSize: 10 }}>km/h</Text></Text>
            <Text style={[wb.bigSub, { color: textColor }]}>제한속도</Text>
          </View>
        ) : null}
      </View>

      {/* 프로그레스 바 */}
      {(phase === 'remeasure' || phase === 'slowdown') && (
        <View style={wb.barBg}>
          <Animated.View style={[
            wb.barFill,
            { backgroundColor: textColor },
            {
              width: cdProgress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]} />
        </View>
      )}
    </View>
  );
}

const wb = StyleSheet.create({
  wrap: { borderBottomWidth: 1, padding: 12, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  iconBox: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 11, opacity: 0.8, marginTop: 2 },
  bigNum: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bigSub: { fontSize: 10, opacity: 0.75 },
  barBg: { height: 4, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 2 },
  barFill: { height: 4, borderRadius: 2 },
});

// ─── 감속 패널 ────────────────────────────────────────────
function SlowdownPanel({ phase, speed, countdown }: {
  phase: Phase; speed: number; countdown: number;
}) {
  const pct = Math.round(speed / MAX_SPEED * 100);
  const stopped = phase === 'stopped';
  return (
    <View style={sp.wrap}>
      <View style={sp.row}>
        <View style={{ flex: 1 }}>
          <Text style={sp.label}>
            {stopped ? '🔒  잠금 처리 완료' : '📉  20 km/h → 5 km/h 감속 중'}
          </Text>
          <Text style={sp.subLabel}>
            {stopped ? '킥보드가 0 km/h로 감속되어 잠겼습니다.' : `${countdown}초 동안 지속되면 잠금 처리됩니다.`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={sp.speed}>{speed} <Text style={{ fontSize: 12 }}>km/h</Text></Text>
          <Text style={sp.speedLabel}>제한속도</Text>
        </View>
      </View>
      <View style={sp.barBg}>
        <View style={[sp.barFill, { width: `${pct}%` as `${number}%` }]} />
      </View>
    </View>
  );
}

const sp = StyleSheet.create({
  wrap: {
    backgroundColor: T.errBg, borderBottomWidth: 1,
    borderBottomColor: 'rgba(198,40,40,0.2)',
    padding: 12, paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 12, color: T.err },
  subLabel: { fontSize: 10, color: T.err, opacity: 0.75, marginTop: 3 },
  speed: { fontSize: 20, fontWeight: '700', color: T.err, fontVariant: ['tabular-nums'] },
  speedLabel: { fontSize: 10, color: T.err, opacity: 0.75 },
  barBg: { height: 6, backgroundColor: 'rgba(198,40,40,0.15)', borderRadius: 3 },
  barFill: { height: 6, backgroundColor: T.err, borderRadius: 3 },
});

// ─── 메인 화면 ────────────────────────────────────────────
export default function MonitoringScreen() {
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>('normal');
  const [countdown, setCountdown] = useState(LOCK_COUNTDOWN_SEC);
  const [speed, setSpeed] = useState(MAX_SPEED);
  const cdProgress = useRef(new Animated.Value(1)).current;
  const [kickboardId, setKickboardId] = useState('');
  const [stm32Connected, setStm32Connected] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [warningReason, setWarningReason] = useState<WarningReason | null>(null);
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState('');
  const phaseRef = useRef<Phase>('normal');
  const warningActiveRef = useRef(false);


  // QR 스캔 시 저장해둔 실제 킥보드 ID 로드
  useEffect(() => {
    AsyncStorage.getItem('kickboard_id').then(id => {
      if (id) setKickboardId(id);
    });
  }, []);

  // ─── SSE 이벤트 수신 ─────────────────────────────────────
  useEffect(() => {
    let disposed = false;
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (disposed) return;

      eventSource = new EventSource(`${RASPI_API_BASE}/session/stream`);

      eventSource.addEventListener('message', (event) => {
        if (!event.data) return;

        try {
          const data = JSON.parse(event.data);
          const nextWarning: WarningReason | null = data.warning_reason === 'two_person' ? 'two_person' : null;
          const locked = data.is_locked === true || data.safety_state === 'locked';

          setStm32Connected(data.stm32_connected === true);
          setWarningReason(nextWarning);

          if (nextWarning) {
            if (!warningActiveRef.current) {
              warningActiveRef.current = true;
              setWarningCount(prev => prev + 1);
            }

            const lockDisplayed = locked || phaseRef.current === 'stopped';
            setPhase(lockDisplayed ? 'stopped' : 'slowdown');
            setSpeed(lockDisplayed ? 0 : LIMITED_SPEED);
          } else if (warningActiveRef.current) {
            warningActiveRef.current = false;
            if (phaseRef.current === 'remeasure' || phaseRef.current === 'slowdown') {
              setSpeed(MAX_SPEED);
              setPhase('normal');
            }
          }
        } catch (error) {
          console.error('[MONITORING][SENSOR_DATA_INVALID] 센서 데이터를 처리하지 못했습니다.', {
            detail: error instanceof Error ? error.message : String(error),
            rawData: event.data,
          });
        }
      });

      eventSource.addEventListener('error', () => {
        if (disposed) return;
        console.error('[MONITORING][SSE_CONNECTION_FAILED] 센서 스트림 연결이 끊어졌습니다. 재연결합니다.');
        eventSource?.close();
        eventSource = null;
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, SSE_RECONNECT_MS);
        }
      });
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, []);

  // phaseRef 업데이트
  useEffect(() => {
      phaseRef.current = phase;
    }, [phase]);

  // 라이딩 타이머
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // 추가 탑승 경고가 유지되는 동안 잠금까지 5초 카운트다운
  useEffect(() => {
    if (phase !== 'slowdown') return;
    setCountdown(LOCK_COUNTDOWN_SEC);
    setSpeed(LIMITED_SPEED);

    // 프로그레스 바 애니메이션
    cdProgress.setValue(1);
    Animated.timing(cdProgress, {
      toValue: 0,
      duration: LOCK_COUNTDOWN_SEC * 1000,
      useNativeDriver: false,
    }).start();

    let cd = LOCK_COUNTDOWN_SEC;
    const t = setInterval(() => {
      cd--;
      setCountdown(cd);
      if (cd <= 0) {
        clearInterval(t);
        if (warningActiveRef.current) {
          setSpeed(0);
          setPhase('stopped');
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const doReturn = async () => {
    if (returning) return;
    setReturning(true);
    setReturnError('');
    try {
      const sessionId = await AsyncStorage.getItem('session_id');
      const rideId = await AsyncStorage.getItem('ride_id');
      if (!rideId) throw new Error('종료할 운행 ID가 없습니다.');

      let sessionSummary: any = null;
      let raspiEndError: unknown = null;
      let nodeEndError: unknown = null;

      if (sessionId) {
        try {
          const summaryRes = await raspiApiCall(
            'GET',
            `/session/summary?session_id=${encodeURIComponent(sessionId)}`,
          );
          sessionSummary = summaryRes?.data ?? null;
        } catch (e) {
          console.log('[RETURN] session/summary 조회 실패:', e);
        }
      }

      try {
        const endRes = await raspiApiCall('POST', '/session/end');
        const alreadyEnded = endRes?.status === 'error' && /활성화된 세션이 없습니다/.test(endRes?.message ?? '');
        if (endRes?.status !== 'success' && !alreadyEnded) {
          throw new Error(endRes?.message || 'Raspberry Pi 세션을 종료하지 못했습니다.');
        }
        sessionSummary = endRes?.data ?? sessionSummary;
      } catch (error) {
        raspiEndError = error;
        console.error('[RETURN][RASPI_END_FAILED]', error);
      }

      if (sessionSummary) {
        sessionSummary = {
          ...sessionSummary,
          duration_sec: sessionSummary.duration_sec ?? elapsed,
        };
        await AsyncStorage.setItem('session_summary', JSON.stringify(sessionSummary));
      }

      const finalWarningCount = typeof sessionSummary?.warning_count === 'number'
        ? sessionSummary.warning_count
        : warningCount;

      try {
        await apiCall('PATCH', `/rides/${rideId}/end`, {
          ended_at: new Date().toISOString(),
          warning_count: finalWarningCount,
        });
      } catch (error) {
        nodeEndError = error;
        console.error('[RETURN][NODE_END_FAILED]', error);
      }

      if (raspiEndError || nodeEndError) {
        const failedTargets = [raspiEndError ? 'Raspberry Pi 잠금/세션 종료' : '', nodeEndError ? 'Node 운행 종료' : '']
          .filter(Boolean)
          .join(', ');
        throw new Error(`${failedTargets} 처리에 실패했습니다. 네트워크를 확인한 뒤 다시 반납해주세요.`);
      }

      if (sessionId) await AsyncStorage.setItem('last_session_id', sessionId);
      router.replace('/return-complete');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[RETURN][FAILED]', e);
      setReturnError(message);
      if (Platform.OS !== 'web') Alert.alert('반납 실패', message);
    } finally {
      setReturning(false);
    }
  };

  const handleReturn = () => {
    // 웹에서는 Alert이 동작 안 해서 window.confirm 사용
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('라이딩을 종료하고 반납하시겠습니까?');
      if (confirmed) doReturn();
    } else {
      Alert.alert('라이딩 종료', '반납하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        { text: '반납', style: 'destructive', onPress: doReturn },
      ]);
    }
  };

  // 상태 뱃지
  const badgeLabel = {
    normal: '주행 중',
    remeasure: '재측정 중',
    slowdown: '감속 중',
    stopped: '정지',
  }[phase];

  const badgeStatus = {
    normal: 'ok',
    remeasure: 'warn',
    slowdown: 'err',
    stopped: 'err',
  }[phase];

  // 센서 상태
  const sensors: SensorRow[] = [
    {
      label: '음주 측정',
      status: 'ok',
      value: '운행 전 점검 완료',
    },
    {
      label: '헬멧 착용',
      status: 'ok',
      value: '운행 전 점검 완료',
    },
    {
      label: '탑승 인원 감지',
      status: warningReason === 'two_person' ? 'warn' : 'ok',
      value: warningReason === 'two_person' ? '2명 감지' : '1명',
    },
    {
      label: 'STM32 컨트롤러',
      status: stm32Connected ? 'info' : 'warn',
      value: stm32Connected ? '연결됨' : '연결 확인 중',
    },
    {
      label: 'Raspberry Pi',
      status: 'info',
      value: RASPI_IP || '연결됨',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bgAlt }}>

      {/* ── 헤더 ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerLabel}>스쿠터 ID</Text>
          <Text style={s.headerId}>{kickboardId || '-'}</Text>
        </View>
        <WFBadge label={badgeLabel} status={badgeStatus as any} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.headerLabel}>라이딩 시간</Text>
          <Text style={s.timer}>{fmt(elapsed)}</Text>
        </View>
      </View>

      {/* ── 경고 배너 (경고 상태일 때만) ── */}
      {phase !== 'normal' && warningReason && (
        <WarningBanner phase={phase} reason={warningReason} countdown={countdown} cdProgress={cdProgress} />
      )}

      {/* ── 단계 인디케이터 (경고 상태일 때만) ── */}
      {phase !== 'normal' && (
        <StepIndicator phase={phase} />
      )}

      {/* ── 감속 패널 (감속/정지 상태일 때만) ── */}
      {(phase === 'slowdown' || phase === 'stopped') && (
        <SlowdownPanel phase={phase} speed={speed} countdown={countdown} />
      )}

      <ScrollView contentContainerStyle={s.content}>

        {/* 실시간 데이터 */}
        <View style={s.card}>
          <Text style={s.cardMeta}>실시간 데이터</Text>
          <View style={s.statRow}>
            <View style={s.stat}>
              <Text style={s.statVal}>{fmt(elapsed)}</Text>
              <Text style={s.statLabel}>운행 시간</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={[s.statVal, phase !== 'normal' && { color: T.warn }]}>
                {warningCount}
              </Text>
              <Text style={s.statLabel}>경고 발생 횟수</Text>
            </View>
          </View>
        </View>

        {/* 추가 구현 예정 */}
        <View style={[s.card, { backgroundColor: T.bgAlt }]}>
          <Text style={s.cardMeta}>추후 구현 예정</Text>
          <View style={s.statRow}>
            <View style={s.stat}>
              <Text style={[s.statVal, phase !== 'normal' && { color: T.err }]}>
                {phase === 'normal' ? MAX_SPEED : speed}
                <Text style={s.statUnit}> km/h</Text>
              </Text>
              <Text style={s.statLabel}>제한속도</Text>
            </View>
            {['이동 거리', '배터리'].map(l => (
              <View key={l} style={s.stat}>
                <Text style={[s.statVal, { color: T.textMuted }]}>-</Text>
                <Text style={s.statLabel}>{l}</Text>
                <View style={s.unimplBadge}>
                  <Text style={s.unimplText}>미구현</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 센서 상태 */}
        <View style={s.card}>
          <Text style={s.cardMeta}>센서 상태</Text>
          {sensors.map((row, i) => (
            <View key={row.label} style={[
              s.sensorRow,
              i === sensors.length - 1 && { borderBottomWidth: 0 },
            ]}>
              <WFBadge
                label={row.status === 'ok' ? '정상' : row.status === 'warn' ? '경고' : '연결됨'}
                status={row.status}
              />
              <Text style={s.sensorLabel}>{row.label}</Text>
              <Text style={[
                s.sensorVal,
                row.status === 'warn' && { color: T.warn },
              ]}>{row.value}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ── 반납 버튼 ── */}
      <View style={s.returnWrap}>
        {returnError ? <Text style={s.returnError}>{returnError}</Text> : null}
        <TouchableOpacity style={[s.returnBtn, returning && { opacity: 0.5 }]} onPress={handleReturn} disabled={returning}>
          <Text style={s.returnBtnText}>{returning ? '반납 처리 중...' : '라이딩 종료 (반납)'}</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 56,
    backgroundColor: T.bg, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  headerLabel: { fontSize: 11, color: T.textMuted },
  headerId: { fontSize: 16, fontWeight: '700', color: T.text },
  timer: { fontSize: 22, fontWeight: '700', color: T.text, fontVariant: ['tabular-nums'] },

  content: { padding: 16, gap: 12 },

  card: {
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    borderRadius: 16, padding: 14,
  },
  cardMeta: {
    fontSize: 10, fontWeight: '700', color: T.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 6, gap: 4 },
  statVal: { fontSize: 24, fontWeight: '700', color: T.text, fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 10, fontWeight: '500' },
  statLabel: { fontSize: 11, color: T.textMuted },
  statDivider: { width: 1, backgroundColor: T.border },
  unimplBadge: {
    backgroundColor: T.fill, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2, marginTop: 2,
  },
  unimplText: { fontSize: 9, color: T.textMuted },

  sensorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  sensorLabel: { flex: 1, fontSize: 13, color: T.text },
  sensorVal: { fontSize: 12, color: T.textSub },

  returnWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 32,
    backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border,
  },
  returnError: { color: T.err, fontSize: 11, lineHeight: 16, marginBottom: 8, textAlign: 'center' },
  returnBtn: {
    height: 48, backgroundColor: T.err,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  returnBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
