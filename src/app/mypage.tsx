import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WFBadge, WFCard } from '../components/ui';
import { T } from '../constants/colors';
import { apiCall } from '../utils/api';

function ListItem({ icon, label, sub, danger, right = true }: {
  icon: string; label: string; sub?: string; danger?: boolean; right?: boolean;
}) {
  return (
    <View style={li.row}>
      <View style={[li.iconBox, danger && { backgroundColor: T.errBg }]}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[li.label, danger && { color: T.err }]}>{label}</Text>
        {sub && <Text style={li.sub}>{sub}</Text>}
      </View>
      {right && <Text style={li.chevron}>›</Text>}
    </View>
  );
}
const li = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  iconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: T.fill, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '500', color: T.text },
  sub: { fontSize: 12, color: T.textMuted, marginTop: 1 },
  chevron: { fontSize: 18, color: T.textMuted },
});

function fmt(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
function dur(a: string, b: string) {
  return `${Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)}분`;
}

const doLogout = async () => {
  await AsyncStorage.clear();
  router.replace('/login');
};

export default function MyPageScreen() {
  const [user, setUser] = useState<any>(null);
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      // GET /users/me + GET /rides — 서버 없으면 mock 자동 사용
      const [userRes, ridesRes] = await Promise.all([
        apiCall('GET', '/users/me'),
        apiCall('GET', '/rides'),
      ]);
      setUser(userRes.data);
      setRides(ridesRes.data);
    } catch {
      // 완전 실패 시 AsyncStorage fallback
      const raw = await AsyncStorage.getItem('user').catch(() => null);
      if (raw) setUser(JSON.parse(raw));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // 웹(브라우저)과 네이티브(폰) 각각 다른 확인 방식 사용
    if (Platform.OS === 'web') {
      // 웹 — window.confirm 사용 (Alert이 웹에서 동작 안 하는 경우 대비)
      const confirmed = window.confirm('로그아웃 하시겠습니까?');
      if (confirmed) doLogout();
    } else {
      // 네이티브 — Alert 사용
      Alert.alert('로그아웃', '계정에서 로그아웃하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={T.text} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bgAlt }}>
      {/* TopBar — 뒤로가기 포함 */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>내 정보</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView>
        {/* 프로필 */}
        <View style={s.profileSection}>
          <View style={s.profileRow}>
            <View style={s.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{user?.name ?? '최세은'}</Text>
              <Text style={s.email}>{user?.email ?? 'user@example.com'}</Text>
            </View>
            <WFBadge label="인증 완료" status="ok" />
          </View>
        </View>

        <View style={s.body}>
          {/* 면허증 */}
          {user?.license && (
            <>
              <Text style={s.sectionLabel}>등록된 면허증</Text>
              <WFCard style={{ marginBottom: 16 }}>
                <View style={s.licenseRow}>
                  <View style={s.licenseImg}>
                    <Text style={{ fontSize: 10, color: T.textMuted }}>면허증</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.licenseType}>2종 보통</Text>
                    <Text style={s.licenseNo}>{user.license.license_no}</Text>
                    <Text style={s.licenseExp}>만료: {user.license.expires_at}</Text>
                  </View>
                  <WFBadge label="유효" status="ok" />
                </View>
                <View style={s.privacyBox}>
                  <Text style={s.privacyText}>
                    🔒  얼굴 벡터 데이터는 세션 종료 시 자동 삭제됩니다. 서버에 저장되지 않습니다.
                  </Text>
                </View>
              </WFCard>
            </>
          )}

          {/* 이용 내역 */}
          <Text style={s.sectionLabel}>최근 이용 내역</Text>
          {rides.length === 0 ? (
            <WFCard><Text style={s.emptyText}>이용 기록이 없습니다</Text></WFCard>
          ) : rides.map(r => (
            <WFCard key={r.ride_id} style={s.rideCard}>
              <View>
                <Text style={s.rideId}>{r.kickboard_id}</Text>
                <Text style={s.rideDate}>{fmt(r.started_at)} · {dur(r.started_at, r.ended_at)}</Text>
              </View>
              {r.warning_count > 0
                ? <WFBadge label={`경고 ${r.warning_count}회`} status="warn" />
                : <WFBadge label="정상" status="ok" />}
            </WFCard>
          ))}

          {/* 설정 */}
          <Text style={[s.sectionLabel, { marginTop: 8 }]}>설정</Text>
          <WFCard style={{ padding: 0, paddingHorizontal: 16, marginBottom: 12 }}>
            <ListItem icon="🔔" label="알림 설정" sub="푸시 알림 관리" />
            <ListItem icon="📋" label="이용 내역" sub="전체 라이딩 기록" />
            <ListItem icon="🛡" label="개인정보 처리방침" />
            <ListItem icon="ℹ" label="고객센터" />
            <ListItem icon="📱" label="앱 버전" sub="v1.0.0" right={false} />
          </WFCard>
          <WFCard style={{ padding: 0, paddingHorizontal: 16, marginBottom: 16 }}>
            <TouchableOpacity onPress={handleLogout}>
              <ListItem icon="🚪" label="로그아웃" sub="계정에서 로그아웃" danger right={false} />
            </TouchableOpacity>
          </WFCard>

          <Text style={s.footer}>Safe Kick · 전동 킥보드 안전 인증 서비스 © 2026</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: T.border, backgroundColor: T.bg },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: T.fill, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: T.text, lineHeight: 28 },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: T.text, textAlign: 'center' },
  profileSection: { padding: 20, paddingBottom: 16, backgroundColor: T.bg, borderBottomWidth: 1, borderBottomColor: T.border },
  profileRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: T.fill },
  name: { fontSize: 18, fontWeight: '700', color: T.text },
  email: { fontSize: 13, color: T.textMuted },
  body: { padding: 16, paddingBottom: 40, gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: T.textSub, letterSpacing: 0.3, marginBottom: 8 },
  licenseRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
  licenseImg: { width: 56, height: 36, backgroundColor: T.fill, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  licenseType: { fontSize: 14, fontWeight: '600', color: T.text },
  licenseNo: { fontSize: 11, color: T.textMuted, marginTop: 2 },
  licenseExp: { fontSize: 11, color: T.textMuted },
  privacyBox: { backgroundColor: T.bgAlt, borderRadius: 8, padding: 8 },
  privacyText: { fontSize: 11, color: T.textMuted, lineHeight: 16 },
  rideCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, marginBottom: 8 },
  rideId: { fontSize: 13, fontWeight: '600', color: T.text },
  rideDate: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  emptyText: { fontSize: 13, color: T.textMuted, textAlign: 'center', padding: 16 },
  footer: { textAlign: 'center', fontSize: 11, color: T.textMuted, paddingBottom: 8 },
});
