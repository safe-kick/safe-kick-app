import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Alert } from 'react-native';
import { router } from 'expo-router';
import { T } from '../constants/colors';
import { WFCard, WFBadge } from '../components/ui';
import { mockStreamNormal, mockStreamWarningTwoPerson } from '../mock/data';

function SensorRow({ name, status, value }: { name: string; status: string; value?: string }) {
  return (
    <View style={sr.row}>
      <WFBadge label={status === 'ok' ? '정상' : status === 'warn' ? '경고' : '연결됨'} status={status} />
      <Text style={sr.name}>{name}</Text>
      {value && <Text style={sr.value}>{value}</Text>}
    </View>
  );
}
const sr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: T.border, gap: 10,
  },
  name: { flex: 1, fontSize: 13, color: T.text },
  value: { fontSize: 12, color: T.textSub },
});

const WARNING_MSG: Record<string, string> = {
  two_person: '이중 탑승 감지됨',
  drunk: '음주 상태 감지됨',
  face_fail: '운전자 확인 실패',
};

export default function MonitoringScreen() {
  const [elapsed, setElapsed] = useState(0);
  const [warningReason, setWarningReason] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const triggerWarning = (reason: string) => {
    setWarningReason(reason);
    setShowModal(true);
  };

  const isWarning = !!warningReason;

  const handleReturn = () => {
    Alert.alert('라이딩 종료', '반납하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '반납', style: 'destructive', onPress: () => router.replace('/return-complete') },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bgAlt }}>
      {/* 상단 헤더 */}
      <View style={[s.header, isWarning && { backgroundColor: '#FFF8E1' }]}>
        <View>
          <Text style={s.headerLabel}>스쿠터 ID</Text>
          <Text style={s.headerId}>KICK-A23F</Text>
        </View>
        <WFBadge label={isWarning ? '경고 발생' : '주행 중'} status={isWarning ? 'warn' : 'ok'} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.headerLabel}>라이딩 시간</Text>
          <Text style={s.timer}>{fmt(elapsed)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* 실시간 데이터 */}
        <WFCard>
          <Text style={s.cardMeta}>실시간 데이터</Text>
          <View style={s.statRow}>
            <View style={s.stat}>
              <Text style={s.statVal}>{fmt(elapsed)}</Text>
              <Text style={s.statLabel}>운행 시간</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.stat}>
              <Text style={s.statVal}>{isWarning ? '1' : '0'}</Text>
              <Text style={s.statLabel}>경고 발생 횟수</Text>
            </View>
          </View>
        </WFCard>

        {/* 미구현 */}
        <WFCard style={{ backgroundColor: T.bgAlt }}>
          <Text style={s.cardMeta}>추후 구현 예정</Text>
          <View style={s.statRow}>
            {['현재 속도', '이동 거리', '배터리'].map(l => (
              <View key={l} style={s.stat}>
                <Text style={[s.statVal, { color: T.textMuted }]}>-</Text>
                <Text style={s.statLabel}>{l}</Text>
                <Text style={s.unimpl}>미구현</Text>
              </View>
            ))}
          </View>
        </WFCard>

        {/* 센서 상태 */}
        <WFCard>
          <Text style={[s.cardMeta, { marginBottom: 4 }]}>센서 상태</Text>
          <SensorRow name="가스 센서 (알코올)" status="ok" value="0.02 ppm" />
          <SensorRow name="탑승 인원 감지" status={isWarning ? 'warn' : 'ok'} value={isWarning ? '2명 감지' : '1명'} />
          <SensorRow name="GPS 위치" status="ok" value="신호 양호" />
          <SensorRow name="STM32 컨트롤러" status="info" value="연결됨" />
          <View style={[sr.row, { borderBottomWidth: 0 }]}>
            <WFBadge label="연결됨" status="info" />
            <Text style={[sr.name]}>Raspberry Pi</Text>
            <Text style={sr.value}>192.168.4.1</Text>
          </View>
        </WFCard>

        {/* 지도 자리 */}
        <View style={s.mapBox}>
          <Text style={s.mapLabel}>📍 반납 위치 지도</Text>
          <Text style={s.unimpl}>미구현</Text>
        </View>

        {/* mock 경고 테스트 */}
        <TouchableOpacity style={s.testBtn} onPress={() => triggerWarning('two_person')}>
          <Text style={s.testBtnText}>⚠ 경고 테스트 (mock)</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 반납 버튼 */}
      <View style={s.returnWrap}>
        <TouchableOpacity style={s.returnBtn} onPress={handleReturn}>
          <Text style={s.returnBtnText}>라이딩 종료 (반납)</Text>
        </TouchableOpacity>
      </View>

      {/* 경고 바텀시트 */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <View style={s.sheetIconBox}>
                <Text style={{ fontSize: 20 }}>⚠</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitle}>{WARNING_MSG[warningReason ?? 'two_person']}</Text>
                <Text style={s.sheetSub}>2인 이상 탑승이 감지되었습니다</Text>
              </View>
              <WFBadge label="심각도: 높음" status="warn" />
            </View>
            <View style={s.sheetGuide}>
              <Text style={s.sheetGuideText}>• 즉시 안전한 곳에 정차하세요</Text>
              <Text style={s.sheetGuideText}>• 1인만 탑승 후 계속할 수 있습니다</Text>
            </View>
            <View style={s.sheetBtns}>
              <TouchableOpacity style={[s.sheetBtn, s.sheetBtnDanger]} onPress={() => { setShowModal(false); router.replace('/return-complete'); }}>
                <Text style={s.sheetBtnDangerText}>반납</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.sheetBtn, s.sheetBtnPrimary]} onPress={() => setShowModal(false)}>
                <Text style={s.sheetBtnPrimaryText}>확인했습니다</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 56, backgroundColor: T.bg,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  headerLabel: { fontSize: 12, color: T.textMuted },
  headerId: { fontSize: 16, fontWeight: '700', color: T.text },
  timer: { fontSize: 22, fontWeight: '700', color: T.text },
  content: { padding: 16, gap: 14, paddingBottom: 100 },
  cardMeta: { fontSize: 10, fontWeight: '700', color: T.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  statVal: { fontSize: 22, fontWeight: '700', color: T.text },
  statLabel: { fontSize: 11, color: T.textMuted },
  statDivider: { width: 1, backgroundColor: T.border },
  unimpl: {
    fontSize: 9, color: T.textMuted, backgroundColor: T.fill,
    borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1,
    marginTop: 2,
  },
  mapBox: {
    height: 100, backgroundColor: T.fill, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  mapLabel: { fontSize: 11, color: T.textMuted },
  testBtn: {
    height: 44, backgroundColor: T.warnBg, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  testBtnText: { fontSize: 13, fontWeight: '600', color: T.warn },
  returnWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 32, backgroundColor: T.bg,
    borderTopWidth: 1, borderTopColor: T.border,
  },
  returnBtn: {
    height: 48, backgroundColor: T.err, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  returnBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  // 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.bg, borderRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    padding: 12, paddingHorizontal: 20, paddingBottom: 20, gap: 12,
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: T.fillMed, borderRadius: 2, alignSelf: 'center' },
  sheetHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  sheetIconBox: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: T.warnBg,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: T.text },
  sheetSub: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  sheetGuide: { backgroundColor: T.warnBg, borderRadius: 10, padding: 10, gap: 3 },
  sheetGuideText: { fontSize: 12, color: T.warn },
  sheetBtns: { flexDirection: 'row', gap: 10 },
  sheetBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetBtnDanger: { backgroundColor: T.err },
  sheetBtnPrimary: { backgroundColor: T.text },
  sheetBtnDangerText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  sheetBtnPrimaryText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
