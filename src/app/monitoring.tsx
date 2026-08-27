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
import { RASPI_API_BASE } from '../constants/api';

// ─── 타입 ────────────────────────────────────────────────
type Phase = 'normal' | 'remeasure' | 'slowdown' | 'stopped';
type WarningReason = 'two_person' | 'helmet_fail' | 'drunk' | 'face_fail';

interface SensorRow {
  label: string;
  status: 'ok' | 'warn' | 'info';
  value: string;
}

// ─── 상수 ────────────────────────────────────────────────
const REMEASURE_SEC = 8;
const MAX_SPEED = 20;
const SSE_RECONNECT_MS = 2_000;

// 경고 사유별 타이틀
const WARNING_TITLES: Record<WarningReason, string> = {
  two_person: '이중 탑승 감지됨',
  helmet_fail: '헬멧 미착용 감지됨',
  drunk: '음주 감지됨',
  face_fail: '탑승자 얼굴 인식 실패',
};

// 경고 사유 + 단계에 따른 서브 텍스트
function getWarningSub(reason: WarningReason, phase: Phase) {
  if (phase === 'stopped') {
    switch (reason) {
      case 'helmet_fail':
        return '완전 정지됨 — 헬멧 착용 후 재시작하세요';
      case 'drunk':
        return '완전 정지됨 — 음주 상태에서는 재시작할 수 없습니다';
      case 'face_fail':
        return '완전 정지됨 — 등록된 탑승자 확인 후 재시작하세요';
      default:
        return '완전 정지됨 — 1인 탑승 후 재시작하세요';
    }
  }
  switch (reason) {
    case 'helmet_fail':
      return '헬멧을 착용한 후 계속하세요';
    case 'drunk':
      return '음주 상태가 해제되지 않으면 자동 정지됩니다';
    case 'face_fail':
      return '얼굴이 다시 인식되지 않으면 자동 정지됩니다';
    default:
      return '단독 탑승 확인 시 자동 해제';
  }
}

// ─── 단계 인디케이터 ──────────────────────────────────────
const STEPS = ['이상 감지', '재측정 중', '감속 중', '정지'];

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
            {reason === 'helmet_fail' ? '🪖' : reason === 'drunk' ? '🍺' : reason === 'face_fail' ? '🚫' : '⚠'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[wb.title, { color: textColor }]}>{WARNING_TITLES[reason]}</Text>
          <Text style={[wb.sub, { color: textColor }]}>
            {getWarningSub(reason, phase)}
          </Text>
        </View>
        {/* 카운트다운 or 속도 */}
        {phase === 'remeasure' ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={[wb.bigNum, { color: textColor }]}>{countdown}</Text>
            <Text style={[wb.bigSub, { color: textColor }]}>sec</Text>
          </View>
        ) : phase === 'slowdown' || phase === 'stopped' ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[wb.bigNum, { color: textColor, fontSize: 18 }]} id="speed-text" />
            <Text style={[wb.bigSub, { color: textColor }]}>현재 속도</Text>
          </View>
        ) : null}
      </View>

      {/* 프로그레스 바 */}
      {phase === 'remeasure' && (
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
function SlowdownPanel({ speed }: { speed: number }) {
  const pct = Math.round(speed / MAX_SPEED * 100);
  return (
    <View style={sp.wrap}>
      <View style={sp.row}>
        <Text style={sp.label}>📉  완전 정지까지 감속 중</Text>
        <Text style={sp.speed}>{speed} <Text style={{ fontSize: 12 }}>km/h</Text></Text>
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
  speed: { fontSize: 20, fontWeight: '700', color: T.err, fontVariant: ['tabular-nums'] },
  barBg: { height: 6, backgroundColor: 'rgba(198,40,40,0.15)', borderRadius: 3 },
  barFill: { height: 6, backgroundColor: T.err, borderRadius: 3 },
});

// ─── 메인 화면 ────────────────────────────────────────────
export default function MonitoringScreen() {
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>('normal');
  const [countdown, setCountdown] = useState(REMEASURE_SEC);
  const [speed, setSpeed] = useState(MAX_SPEED);
  const cdProgress = useRef(new Animated.Value(1)).current;
  const [kickboardId, setKickboardId] = useState('');
  const [faceScore, setFaceScore] = useState(0);
  const [weight, setWeight] = useState(0);
  const [gas, setGas] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [warningReason, setWarningReason] = useState<WarningReason | null>(null);
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
          const nextWarning = data.warning_reason as WarningReason | null;

          setFaceScore(data.face_score);
          setWeight(data.weight);
          setGas(data.gas);
          setIsLocked(data.is_locked);
          setWarningReason(nextWarning);

          if (nextWarning) {
            if (!warningActiveRef.current) {
              warningActiveRef.current = true;
              setWarningCount(prev => prev + 1);
            }

            if (phaseRef.current === 'normal') {
              setPhase('remeasure');
            }
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

  // mock 경고 함수
  const triggerMockWarning = async (reason: WarningReason) => {
  try {
    const sessionId = await AsyncStorage.getItem('session_id');

    if (!sessionId) {
      console.log('[MOCK WARNING] session_id 없음');
      return;
    }

    setWarningReason(reason);
    setWarningCount(prev => prev + 1);
    setIsLocked(true);
    setPhase('remeasure');

    await raspiApiCall('POST', '/lock', {
      session_id: Number(sessionId),
      reason,
    });
  } catch (e) {
    console.log('[MOCK WARNING] lock 실패:', e);
  }
};

  // 재측정 카운트다운
  useEffect(() => {
    if (phase !== 'remeasure') return;
    setCountdown(REMEASURE_SEC);

    // 프로그레스 바 애니메이션
    cdProgress.setValue(1);
    Animated.timing(cdProgress, {
      toValue: 0,
      duration: REMEASURE_SEC * 1000,
      useNativeDriver: false,
    }).start();

    let cd = REMEASURE_SEC;
    const t = setInterval(() => {
      cd--;
      setCountdown(cd);
      if (cd <= 0) {
        clearInterval(t);
        setPhase('slowdown');
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // 속도 감속
  useEffect(() => {
    if (phase !== 'slowdown') return;
    setSpeed(MAX_SPEED);
    let spd = MAX_SPEED;
    const t = setInterval(() => {
      spd = Math.max(0, spd - 2);
      setSpeed(spd);
      if (spd <= 0) {
        clearInterval(t);
        setPhase('stopped');
      }
    }, 500);
    return () => clearInterval(t);
  }, [phase]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const doReturn = async () => {
    try {
      const sessionId = await AsyncStorage.getItem('session_id');
      const rideId = await AsyncStorage.getItem('ride_id');

      let sessionSummary: any = null;

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

      const endRes = await raspiApiCall('POST', '/session/end');
      sessionSummary = endRes?.data ?? sessionSummary;

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

      if (rideId) {
        await apiCall('PATCH', `/rides/${rideId}/end`, {
          ended_at: new Date().toISOString(),
          warning_count: finalWarningCount,
        });
      }

      if (sessionId) {
        await AsyncStorage.setItem('last_session_id', sessionId);
      }
    } catch (e) {
      console.log(e);
    }

    router.replace('/return-complete');
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
      label: '가스 센서 (알코올)',
      status: warningReason === 'drunk' ? 'warn' : 'ok',
      value: `${gas} ppm`,
    },
    {
      label: '탑승 인원 감지',
      status: warningReason === 'two_person' ? 'warn' : 'ok',
      value: warningReason === 'two_person' ? '2명 감지' : '1명',
    },
    {
      label: '얼굴 인식',
      status: faceScore < 0.5 ? 'warn' : 'ok',
      value: `${Math.round(faceScore * 100)}%`,
    },
    {
      label: '무게 센서',
      status: weight > 100 ? 'warn' : 'ok',
      value: `${weight} kg`,
    },
    {
      label: '잠금 상태',
      status: isLocked ? 'warn' : 'ok',
      value: isLocked ? '잠금' : '해제',
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
        <SlowdownPanel speed={speed} />
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
            {['현재 속도', '이동 거리', '배터리'].map(l => (
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

        {/* mock 경고 트리거 버튼 — 경고 사유별로 테스트 가능 */}
        {phase === 'normal' && (
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              style={s.testBtn}
              onPress={() => triggerMockWarning('two_person')}
            >
              <Text style={s.testBtnText}>⚠  이중 탑승 경고 테스트 (mock)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.testBtn}
              onPress={() => triggerMockWarning('helmet_fail')}
            >
              <Text style={s.testBtnText}>🪖  헬멧 미착용 경고 테스트 (mock)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.testBtn}
              onPress={() => triggerMockWarning('drunk')}
            >
              <Text style={s.testBtnText}>🍺  음주 감지 경고 테스트 (mock)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.testBtn}
              onPress={() => triggerMockWarning('face_fail')}
            >
              <Text style={s.testBtnText}>🚫  얼굴 인식 실패 경고 테스트 (mock)</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* ── 반납 버튼 ── */}
      <View style={s.returnWrap}>
        <TouchableOpacity style={s.returnBtn} onPress={handleReturn}>
          <Text style={s.returnBtnText}>라이딩 종료 (반납)</Text>
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

  testBtn: {
    height: 44, backgroundColor: T.warnBg,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  testBtnText: { fontSize: 13, fontWeight: '600', color: T.warn },

  returnWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 32,
    backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border,
  },
  returnBtn: {
    height: 48, backgroundColor: T.err,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  returnBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
