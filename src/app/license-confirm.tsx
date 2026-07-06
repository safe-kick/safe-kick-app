import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { T } from '../constants/colors';
import { TopBar, WFCard, WFBadge } from '../components/ui';

const OCR_RESULT = [
  { k: '이름', v: '홍길동' },
  { k: '생년월일', v: '1990.01.01' },
  { k: '면허번호', v: '12-34-567890-01' },
  { k: '면허종별', v: '2종 보통' },
  { k: '발급일', v: '2020.03.15' },
  { k: '만료일', v: '2030.01.01' },
];

export default function LicenseConfirmScreen() {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    router.replace('/main');
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <TopBar title="면허증 정보 확인" back onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.content}>
        {/* 이미지 미리보기 */}
        <View style={s.imgBox}>
          <Text style={s.imgLabel}>면허증 이미지 미리보기</Text>
        </View>

        {/* OCR 결과 */}
        <WFCard>
          <Text style={s.cardLabel}>OCR 인식 결과</Text>
          {OCR_RESULT.map(({ k, v }, i) => (
            <View key={k} style={[s.row, i === OCR_RESULT.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={s.rowKey}>{k}</Text>
              <Text style={s.rowVal}>{v}</Text>
            </View>
          ))}
        </WFCard>

        {/* 경고 안내 */}
        <View style={s.warnBox}>
          <Text style={s.warnIcon}>ℹ</Text>
          <Text style={s.warnText}>
            정보가 정확한지 확인하세요. 잘못된 정보는 인증 실패로 이어질 수 있습니다.
          </Text>
        </View>

        {/* 버튼 */}
        <View style={s.btnRow}>
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => router.back()}>
            <Text style={s.btnGhostText}>다시 찍기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.btnPrimary, { flex: 2 }, loading && s.btnDisabled]}
            onPress={handleConfirm} disabled={loading}
          >
            <Text style={s.btnPrimaryText}>{loading ? '저장 중...' : '정보 확인 완료'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  imgBox: {
    height: 150, backgroundColor: T.fill, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  imgLabel: { fontSize: 10, color: T.textMuted },
  cardLabel: { fontSize: 13, fontWeight: '600', color: T.textSub, marginBottom: 12, letterSpacing: 0.3 },
  row: {
    flexDirection: 'row', paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  rowKey: { width: 76, fontSize: 12, color: T.textMuted },
  rowVal: { fontSize: 13, color: T.text, fontWeight: '500', flex: 1 },
  warnBox: {
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: T.warnBg, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(230,81,0,0.2)',
  },
  warnIcon: { fontSize: 14, color: T.warn },
  warnText: { flex: 1, fontSize: 12, color: T.warn, lineHeight: 18 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: T.text },
  btnGhost: { borderWidth: 1.5, borderColor: T.border },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  btnGhostText: { color: T.text, fontSize: 14, fontWeight: '600' },
});
