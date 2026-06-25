import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { T } from '../constants/colors';
import { TopBar, WFCard, WFBadge } from '../components/ui';
import { mockFaceVerifySuccess } from '../mock/auth';

type Step = 'capture' | 'verifying' | 'success' | 'fail';

export default function SelfieScreen() {
  const [step, setStep] = useState<Step>('capture');

  const handleCapture = async () => {
    setStep('verifying');
    await new Promise(r => setTimeout(r, 2000));
    setStep(mockFaceVerifySuccess.data.match ? 'success' : 'fail');
  };

  // ── 촬영 화면 ──
  if (step === 'capture') return (
    <View style={{ flex: 1, backgroundColor: '#0D0D0D' }}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>본인 인증</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={s.cameraArea}>
        {/* 얼굴 타원 */}
        <View style={s.faceOval}>
          <Text style={s.faceIcon}>👤</Text>
          <View style={s.greenScan} />
        </View>
        <Text style={s.faceTitle}>정면을 바라보세요</Text>
        <Text style={s.faceSub}>눈을 깜빡이지 마세요</Text>
      </View>
      <View style={s.bottom}>
        <View style={s.privacyBox}>
          <Text style={s.privacyText}>
            🔒  얼굴 벡터 데이터는 세션 메모리에 임시 저장되며, 라이딩 종료 시 즉시 삭제됩니다. 서버에 저장되지 않습니다.
          </Text>
        </View>
        <TouchableOpacity style={s.shutterOuter} onPress={handleCapture}>
          <View style={s.shutterInner} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── 인증 중 ──
  if (step === 'verifying') return (
    <View style={s.resultContainer}>
      <ActivityIndicator size="large" color={T.text} />
      <Text style={s.resultTitle}>얼굴 인증 중...</Text>
      <Text style={s.resultSub}>면허증 사진과 비교하고 있습니다</Text>
    </View>
  );

  // ── 성공 ──
  if (step === 'success') return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <TopBar title="인증 결과" />
      <View style={s.resultContainer}>
        <View style={[s.resultIcon, { backgroundColor: T.okBg }]}>
          <Text style={{ fontSize: 44 }}>✅</Text>
        </View>
        <Text style={s.resultTitle}>본인 확인 완료</Text>
        <Text style={s.resultSub}>{'얼굴 인증이 완료되었습니다.\n안전 점검을 진행합니다.'}</Text>
        <WFCard style={s.userCard}>
          <View style={s.userCardInner}>
            <View style={s.userAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={s.userName}>홍길동</Text>
              <Text style={s.userNo}>12-34-567890-01</Text>
            </View>
            <WFBadge label="인증됨" status="ok" />
          </View>
        </WFCard>
        <TouchableOpacity style={s.nextBtn} onPress={() => router.push('/safety-check')}>
          <Text style={s.nextBtnText}>안전 점검 진행  →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── 실패 ──
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <TopBar title="인증 결과" />
      <View style={s.resultContainer}>
        <View style={[s.resultIcon, { backgroundColor: T.errBg }]}>
          <Text style={{ fontSize: 44 }}>❌</Text>
        </View>
        <Text style={s.resultTitle}>인증 실패</Text>
        <Text style={s.resultSub}>{'얼굴 인식에 실패했습니다.\n다시 시도하거나 취소하세요.'}</Text>
        <WFCard style={[s.userCard, { backgroundColor: T.errBg, borderColor: 'rgba(198,40,40,0.2)' }]}>
          <Text style={{ fontSize: 13, color: T.err, lineHeight: 20 }}>
            {'• 조명이 충분한 곳에서 다시 시도하세요\n• 카메라를 얼굴에 정확히 맞추세요'}
          </Text>
        </WFCard>
        <TouchableOpacity style={s.nextBtn} onPress={() => setStep('capture')}>
          <Text style={s.nextBtnText}>다시 시도</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ghostBtn} onPress={() => router.replace('/main')}>
          <Text style={s.ghostBtnText}>취소</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 16, gap: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#FFF', lineHeight: 28 },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#FFF', textAlign: 'center' },
  cameraArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  faceOval: {
    width: 200, height: 260, borderRadius: 100,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  faceIcon: { fontSize: 80, opacity: 0.18 },
  greenScan: {
    position: 'absolute', left: 0, right: 0, top: '45%',
    height: 2, backgroundColor: 'rgba(0,220,100,0.8)',
  },
  faceTitle: { fontSize: 16, color: '#FFF', fontWeight: '600' },
  faceSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  bottom: { backgroundColor: '#111', padding: 24, paddingBottom: 20, gap: 18, alignItems: 'center' },
  privacyBox: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 },
  privacyText: { fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
  shutterOuter: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.9)' },
  resultContainer: {
    flex: 1, backgroundColor: T.bg,
    alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18,
  },
  resultIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 22, fontWeight: '700', color: T.text },
  resultSub: { fontSize: 14, color: T.textMuted, textAlign: 'center', lineHeight: 22 },
  userCard: { width: '100%', backgroundColor: T.bgAlt },
  userCardInner: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  userAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.fill },
  userName: { fontSize: 15, fontWeight: '600', color: T.text },
  userNo: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  nextBtn: {
    width: '100%', height: 48, backgroundColor: T.text,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  nextBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  ghostBtn: {
    width: '100%', height: 48, borderRadius: 12, borderWidth: 1.5,
    borderColor: T.border, alignItems: 'center', justifyContent: 'center',
  },
  ghostBtnText: { color: T.text, fontSize: 14, fontWeight: '600' },
});
