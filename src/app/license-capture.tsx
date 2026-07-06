import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/colors';

export default function LicenseCaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // 네이티브 환경에서는 진입 시 후면 카메라 권한을 바로 요청
  useEffect(() => {
    if (Platform.OS !== 'web' && !permission?.granted) {
      requestPermission();
    }
  }, []);

  const handleCapture = async () => {
    // 웹 또는 카메라 미준비 환경 — 촬영 없이 기존 mock 흐름 유지
    if (Platform.OS === 'web' || !permission?.granted || !cameraRef.current) {
      router.push('/license-confirm');
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
        exif: false,
      });
      if (photo?.base64) {
        // license-confirm에서 OCR 결과와 함께 서버 전송 시 사용
        await AsyncStorage.setItem('license_image_base64', photo.base64);
      }
    } catch (e) {
      // 촬영 실패해도 OCR mock 확인 화면으로는 진행
    }
    router.push('/license-confirm');
  };

  return (
    <View style={s.container}>
      {/* 다크 TopBar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>면허증 촬영</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* 카메라 영역 */}
      <View style={s.cameraArea}>
        {/* 실제 후면 카메라 — 네이티브 + 권한 허용 시에만 렌더, 웹은 기존 다크 배경 유지 */}
        {Platform.OS !== 'web' && permission?.granted && (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        )}
        {/* 가이드 프레임 */}
        <View style={s.frameWrap}>
          <View style={s.frame}>
            {/* 모서리 4개 */}
            {[
              { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
              { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
              { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
              { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
            ].map((pos, i) => (
              <View key={i} style={[s.corner, pos as any]} />
            ))}
            {/* 스캔 라인 */}
            <View style={s.scanLine} />
            <Text style={s.frameLabel}>license_card</Text>
          </View>
        </View>
        <Text style={s.hint}>
          {Platform.OS !== 'web' && !permission?.granted
            ? '카메라 권한이 필요합니다'
            : '면허증을 안내선 안에 맞추세요'}
        </Text>
      </View>

      {/* 촬영 하단 */}
      <View style={s.bottom}>
        <View style={s.controls}>
          <View style={s.controlPlaceholder} />
          {/* 촬영 버튼 — 권한 미허용이면 권한 요청, 허용되면 실제 촬영 */}
          <TouchableOpacity
            onPress={Platform.OS !== 'web' && !permission?.granted ? requestPermission : handleCapture}
            style={s.shutterOuter}
          >
            <View style={s.shutterInner} />
          </TouchableOpacity>
          <View style={s.controlPlaceholder} />
        </View>
        <Text style={s.autoHint}>
          {Platform.OS !== 'web' && !permission?.granted ? '촬영 버튼을 눌러 권한을 허용하세요' : '촬영 버튼을 눌러 면허증을 찍어주세요'}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', height: 52,
    paddingHorizontal: 16, gap: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 22, color: '#FFF', lineHeight: 28 },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#FFF', textAlign: 'center' },
  cameraArea: {
    flex: 1, backgroundColor: '#1C1C1C',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  frameWrap: { position: 'relative' },
  frame: {
    width: 320, height: 198,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
    borderStyle: 'dashed', borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute', width: 22, height: 22,
    borderRadius: 3, borderColor: '#FFF',
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0,
    top: '45%', height: 2,
    backgroundColor: 'rgba(255,220,0,0.8)',
  },
  frameLabel: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  hint: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  bottom: { backgroundColor: '#111', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlPlaceholder: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: '#2A2A2A',
  },
  shutterOuter: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.9)' },
  autoHint: {
    textAlign: 'center', marginTop: 10,
    fontSize: 11, color: 'rgba(255,255,255,0.35)',
  },
});
