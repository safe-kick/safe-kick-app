import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { T } from '../constants/colors';
import { TopBar, WFCard, WFBadge } from '../components/ui';

type S = 'done' | 'checking' | 'ok' | 'fail';
interface CheckItem { label: string; status: S; value?: string }

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
    { label: '음주 측정 (가스 센서)', status: 'checking' },
    { label: '탑승 인원 감지', status: 'checking' },
    { label: '잠금 상태', status: 'checking' },
  ]);
  const [phase, setPhase] = useState<'checking' | 'pass' | 'fail'>('checking');

  useEffect(() => {
    (async () => {
      await new Promise(r => setTimeout(r, 1500));
      setChecks(p => p.map(c => c.label.includes('음주') ? { ...c, status: 'ok', value: '0.02 ppm' } : c));
      await new Promise(r => setTimeout(r, 1000));
      setChecks(p => p.map(c => c.label.includes('탑승') ? { ...c, status: 'ok', value: '1명' } : c));
      await new Promise(r => setTimeout(r, 800));
      setChecks(p => p.map(c => c.label.includes('잠금') ? { ...c, status: 'ok' } : c));
      setPhase('pass');
    })();
  }, []);

  const allPass = phase === 'pass';
  const anyFail = phase === 'fail';

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <TopBar title="안전 점검" back onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.content}>

        {/* 연결된 스쿠터 */}
        <View style={s.scooterRow}>
          <View style={s.scooterIcon} />
          <View style={{ flex: 1 }}>
            <Text style={s.scooterLabel}>연결된 스쿠터</Text>
            <Text style={s.scooterId}>KICK-A23F</Text>
          </View>
          <WFBadge label="연결됨" status="info" />
        </View>

        {/* 체크 리스트 */}
        <WFCard style={{ padding: 0, paddingHorizontal: 16, paddingTop: 4 }}>
          {checks.map((c, i) => <CheckRow key={i} {...c} />)}
        </WFCard>

        {/* 상태 메시지 */}
        {!allPass && !anyFail && (
          <View style={[s.msgBox, { backgroundColor: T.infoBg, borderColor: 'rgba(21,101,192,0.2)' }]}>
            <Text style={[s.msgText, { color: T.info }]}>
              ℹ  센서 데이터를 수신 중입니다. Raspberry Pi와 STM32가 점검 중입니다.
            </Text>
          </View>
        )}
        {anyFail && (
          <View style={[s.msgBox, { backgroundColor: T.errBg, borderColor: 'rgba(198,40,40,0.2)' }]}>
            <Text style={[s.msgText, { color: T.err }]}>
              ⚠  안전 점검에 실패했습니다. 다시 시도하세요.
            </Text>
          </View>
        )}
        {allPass && (
          <View style={[s.msgBox, { backgroundColor: T.okBg, borderColor: 'rgba(46,125,50,0.2)' }]}>
            <Text style={[s.msgText, { color: T.ok }]}>
              ✓  모든 안전 점검을 통과했습니다
            </Text>
          </View>
        )}

        {/* ── CTA 버튼 영역 ── */}
        {allPass ? (
          <View style={s.readyBox}>
            <Text style={s.readyTitle}>운행 준비 완료</Text>
            <Text style={s.readySub}>모든 안전 점검을 통과했습니다</Text>
            {/* 버튼을 TouchableOpacity로 감싸고 width: '100%' 명시 */}
            <TouchableOpacity
              style={s.startBtn}
              onPress={() => router.replace('/monitoring')}
              activeOpacity={0.8}
            >
              <Text style={s.startBtnText}>⚡  라이딩 시작</Text>
            </TouchableOpacity>
          </View>
        ) : anyFail ? (
          <View style={s.btnGroup}>
            <TouchableOpacity style={s.retryBtn}>
              <Text style={s.retryBtnText}>↺  다시 시도</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => router.replace('/main')}>
              <Text style={s.cancelBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* 점검 중 — 비활성 버튼도 동일한 크기 */
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

  // ── 운행 준비 완료 영역 ──
  readyBox: { alignItems: 'center', gap: 8 },
  readyTitle: { fontSize: 18, fontWeight: '700', color: T.text },
  readySub: { fontSize: 13, color: T.textMuted },

  // 라이딩 시작 버튼 — width: '100%' 핵심
  startBtn: {
    width: '100%',          // ← 이게 핵심! 부모 너비 꽉 채움
    height: 52,
    backgroundColor: T.text,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  startBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // 점검 중 비활성
  disabledBtn: {
    width: '100%',
    height: 52,
    backgroundColor: T.fillMed,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtnText: { color: T.textMuted, fontSize: 15, fontWeight: '600' },

  // 실패 버튼들
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
