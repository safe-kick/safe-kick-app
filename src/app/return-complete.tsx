// ─── return-complete.tsx ───────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/colors';
import { TopBar, WFCard } from '../components/ui';
import { mockSessionSummary } from '../mock/data';

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}분 ${s}초`;
}

export default function ReturnCompleteScreen() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(mockSessionSummary.data);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('session_summary');
        if (raw) {
          setSummary(JSON.parse(raw));
        } else {
          // 실제 요약 데이터가 없으면 mock 유지 — 그 사실을 화면에 알림
          setIsMock(true);
        }
      } catch (e) {
        console.log('[RETURN-COMPLETE] session_summary 로드 실패:', e);
        setIsMock(true);
      } finally {
        setLoading(false);
        // 다음 라이딩을 위해 정리
        await AsyncStorage.multiRemove([
          'session_summary',
          'kickboard_id',
          'session_id',
          'ride_id',
          'face_vector',
        ]);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={T.text} />
      </View>
    );
  }

  const d = summary;
  const rows = [
    { k: '스쿠터 ID', v: d.kickboard_id, disabled: false },
    { k: '이용 시간', v: fmt(d.duration_sec), disabled: false },
    { k: '경고 발생 횟수', v: `${d.warning_count}회`, disabled: false },
    { k: '이동 거리', v: '-', disabled: true },
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

        {isMock && (
          <View style={s.warnBox}>
            <Text style={s.warnText}>
              ⚠  실제 운행 요약 데이터를 불러오지 못해 예시 데이터를 표시하고 있습니다.
            </Text>
          </View>
        )}

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

        {/* 경고 사유 (있는 경우) */}
        {Array.isArray(d.warning_reasons) && d.warning_reasons.length > 0 && (
          <WFCard>
            <Text style={s.cardTitle}>발생한 경고</Text>
            {d.warning_reasons.map((reason: string, i: number) => (
              <Text key={i} style={s.warningItem}>• {reason}</Text>
            ))}
          </WFCard>
        )}

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
  warnBox: {
    backgroundColor: T.warnBg, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(230,81,0,0.2)',
  },
  warnText: { fontSize: 12, color: T.warn, lineHeight: 18 },
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
  warningItem: { fontSize: 13, color: T.text, paddingVertical: 4 },
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
