import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/colors';
import { apiCall } from '../utils/api';

function QRCorners({ size = 220 }: { size?: number }) {
  const cs = 28, sw = 3, c = '#FFF';
  return (
    <View style={{ width: size, height: size, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      {[
        { top: 0, left: 0 }, { top: 0, right: 0 },
        { bottom: 0, left: 0 }, { bottom: 0, right: 0 },
      ].map((pos, i) => (
        <View key={i} style={{ position: 'absolute', ...pos, width: cs, height: cs }}>
          <View style={{
            position: 'absolute',
            ...(pos.hasOwnProperty('top') ? { top: 0 } : { bottom: 0 }),
            ...(pos.hasOwnProperty('left') ? { left: 0 } : { right: 0 }),
            width: sw, height: cs, backgroundColor: c, borderRadius: 2,
          }} />
          <View style={{
            position: 'absolute',
            ...(pos.hasOwnProperty('top') ? { top: 0 } : { bottom: 0 }),
            ...(pos.hasOwnProperty('left') ? { left: 0 } : { right: 0 }),
            width: cs, height: sw, backgroundColor: c, borderRadius: 2,
          }} />
        </View>
      ))}
    </View>
  );
}

export default function QRScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  // 네이티브 환경에서는 진입 시 카메라 권한을 바로 요청
  useEffect(() => {
    if (Platform.OS !== 'web' && !permission?.granted) {
      requestPermission();
    }
  }, []);

  // QR에서 읽은 킥보드 정보로 라즈베리파이 연결 확인 (GET /status)
  const connectKickboard = async (kickboardId: string, raspiIp: string) => {
    setScanning(true);
    setError('');
    try {
      await AsyncStorage.setItem('kickboard_id', kickboardId);
      await AsyncStorage.setItem('raspi_ip', raspiIp);
      const res = await apiCall('GET', '/status');
      if (res?.status !== 'success') throw new Error('연결 실패');
      router.push('/selfie');
    } catch (e) {
      setScanned(false);
      setScanning(false);
      setError('스쿠터 연결에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 실기기 — expo-camera가 QR을 인식하면 자동 호출
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || scanning) return;
    setScanned(true);
    try {
      const parsed = JSON.parse(data);
      if (!parsed.kickboard_id || !parsed.raspi_ip) throw new Error('형식 오류');
      connectKickboard(parsed.kickboard_id, parsed.raspi_ip);
    } catch {
      setScanned(false);
      setError('인식할 수 없는 QR코드입니다.');
    }
  };

  // 웹 / 카메라 권한 미허용 환경 — mock QR 데이터로 동일 흐름 진행
  const handleMockScan = () => {
    if (scanned || scanning) return;
    setScanned(true);
    connectKickboard('KB-001', '192.168.0.25');
  };

  // 취소 — 스캔 중이면 상태 초기화, 아니면 뒤로가기
  const handleCancel = () => {
    if (scanning) {
      setScanning(false);
      setScanned(false);
    } else {
      router.back();
    }
  };

  const showCamera = Platform.OS !== 'web' && permission?.granted;
  const showMockBtn = (Platform.OS === 'web' || !permission?.granted) && !scanning;

  return (
    <View style={s.container}>
      {/* 다크 TopBar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>QR 스캔</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* 카메라 + 스캔 영역 */}
      <View style={s.cameraArea}>
        {/* 실제 카메라 — 네이티브 + 권한 허용 시에만 렌더 */}
        {showCamera && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          />
        )}
        <View style={s.overlay} />
        <View style={s.scanArea}>
          <View style={{ position: 'relative', width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
            <QRCorners size={220} />
            {scanning
              ? <ActivityIndicator size="large" color="#FFF" style={{ position: 'absolute' }} />
              : <Text style={s.qrIcon}>⬛</Text>
            }
            <View style={s.scanLine} />
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={s.scanTitle}>
              {scanning ? '스쿠터에 연결 중...' : '스쿠터 QR코드를 스캔하세요'}
            </Text>
            <Text style={s.scanSub}>
              {scanning
                ? '잠시만 기다려주세요'
                : Platform.OS !== 'web' && !permission?.granted
                ? '카메라 권한이 필요합니다'
                : '카메라가 자동으로 인식합니다'}
            </Text>
            {!!error && <Text style={s.errorText}>{error}</Text>}
          </View>
        </View>
      </View>

      {/* 하단 */}
      <View style={s.bottom}>
        {/* 취소 버튼 — 항상 router.back() 또는 스캔 중단 */}
        <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
          <Text style={s.cancelBtnText}>
            {scanning ? '스캔 중단' : '취소'}
          </Text>
        </TouchableOpacity>

        {/* 권한 허용 버튼 — 네이티브에서 권한이 없을 때만 */}
        {Platform.OS !== 'web' && !permission?.granted && !scanning && (
          <TouchableOpacity style={s.mockBtn} onPress={requestPermission}>
            <Text style={s.mockBtnText}>카메라 권한 허용</Text>
          </TouchableOpacity>
        )}

        {/* mock 스캔 버튼 — 웹이거나 권한 미허용일 때 대체 경로 */}
        {showMockBtn && (
          <TouchableOpacity style={s.mockBtn} onPress={handleMockScan}>
            <Text style={s.mockBtnText}>📷  QR 스캔 (mock)</Text>
          </TouchableOpacity>
        )}

        <Text style={s.manualLink}>
          QR이 안 되나요?{' '}
          <Text style={{ textDecorationLine: 'underline' }}>코드 직접 입력</Text>
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    height: 52, paddingHorizontal: 16, gap: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 22, color: '#FFF', lineHeight: 28 },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#FFF', textAlign: 'center' },

  cameraArea: { flex: 1, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanArea: { zIndex: 1, alignItems: 'center', gap: 20 },
  qrIcon: { position: 'absolute', fontSize: 56, opacity: 0.2 },
  scanLine: {
    position: 'absolute', top: '50%', left: 0, right: 0,
    height: 2, backgroundColor: 'rgba(255,220,0,0.8)',
  },
  scanTitle: { fontSize: 16, color: '#FFF', fontWeight: '600' },
  scanSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  errorText: { fontSize: 12, color: '#FF6B6B', marginTop: 4 },

  bottom: { padding: 24, paddingBottom: 32, backgroundColor: '#111', gap: 10 },

  // 취소 버튼 — 테두리 스타일, 항상 활성
  cancelBtn: {
    height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  // mock 스캔 버튼 — 채워진 스타일
  mockBtn: {
    height: 48, borderRadius: 12,
    backgroundColor: T.text,
    alignItems: 'center', justifyContent: 'center',
  },
  mockBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  manualLink: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)' },
});
