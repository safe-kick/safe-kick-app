// ─── return-complete.tsx ───────────────────────────────
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { T } from '../constants/colors';
import { TopBar, WFCard } from '../components/ui';
import { mockSessionSummary } from '../mock/data';

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}분 ${s}초`;
}

export default function ReturnCompleteScreen() {
  const d = mockSessionSummary.data;
  const rows = [
    { k: '스쿠터 ID', v: d.kickboard_id, disabled: false },
    { k: '이용 시간', v: fmt(d.duration_sec), disabled: false },
    { k: '이동 거리', v: '-', disabled: true },
    { k: '반납 위치', v: '강남역 1번 출구', disabled: false },
    { k: '이용 요금', v: '-', disabled: true },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <TopBar title="반납 완료" />
      <ScrollView contentContainerStyle={s.content}>
        {/* 완료 아이콘 */}
        <View style={s.topSection}>
          <View style={s.circle}>
            <Text style={{ fontSize: 40 }}>✅</Text>
          </View>
          <Text style={s.title}>반납 완료</Text>
          <Text style={s.sub}>안전하게 이용해 주셔서 감사합니다</Text>
        </View>

        {/* 이용 요약 */}
        <WFCard>
          <Text style={s.cardTitle}>이용 요약</Text>
          {rows.map(({ k, v, disabled }) => (
            <View key={k} style={s.row}>
              <Text style={s.rowKey}>{k}</Text>
              <Text style={[s.rowVal, disabled && s.rowValDisabled]}>{v}</Text>
              {disabled && <Text style={s.unimpl}>미구현</Text>}
            </View>
          ))}
        </WFCard>

        {/* 지도 */}
        <View style={s.mapBox}>
          <Text style={s.mapLabel}>📍 반납 위치 지도</Text>
          <Text style={s.unimpl}>미구현</Text>
        </View>

        {/* 안내 */}
        <View style={s.okBox}>
          <Text style={s.okText}>📍  지정 반납 구역에 정상 반납되었습니다</Text>
        </View>

        <View style={s.btnGroup}>
          <TouchableOpacity style={s.ghostBtn}>
            <Text style={s.ghostBtnText}>영수증 보기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/main')}>
            <Text style={s.primaryBtnText}>🏠  홈으로</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  topSection: { alignItems: 'center', gap: 10, paddingBottom: 8 },
  circle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: T.okBg, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: T.text },
  sub: { fontSize: 13, color: T.textMuted, textAlign: 'center' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: T.textSub, letterSpacing: 0.3, marginBottom: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  rowKey: { flex: 1, fontSize: 13, color: T.textMuted },
  rowVal: { fontSize: 13, color: T.text, fontWeight: '500' },
  rowValDisabled: { color: T.textMuted, fontWeight: '400' },
  unimpl: {
    marginLeft: 6, fontSize: 9, color: T.textMuted,
    backgroundColor: T.fill, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1,
  },
  mapBox: {
    height: 90, backgroundColor: T.fill, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  mapLabel: { fontSize: 11, color: T.textMuted },
  okBox: { backgroundColor: T.okBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(46,125,50,0.2)' },
  okText: { fontSize: 12, color: T.ok, lineHeight: 18 },
  btnGroup: { gap: 10 },
  ghostBtn: {
    height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  ghostBtnText: { color: T.text, fontSize: 14, fontWeight: '600' },
  primaryBtn: {
    height: 48, backgroundColor: T.text, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
