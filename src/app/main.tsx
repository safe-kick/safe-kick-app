import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/colors';
import { WFCard, WFBadge } from '../components/ui';
import { apiCall } from '../utils/api';

function fmt(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
function dur(start: string, end: string) {
  return `${Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)}분`;
}

const GAP = 10;
const QUICK_ITEMS = [
  { icon: '📷', label: 'QR 스캔',   route: '/qr-scan' },
  { icon: '📋', label: '이용 내역',  route: '/mypage' },
  { icon: '🛡',  label: '안전 정보', route: null },
  { icon: '👤', label: '내 정보',   route: '/mypage' },
] as const;

export default function MainScreen() {
  const [userName, setUserName] = useState('');
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => {
      if (raw) setUserName(JSON.parse(raw).name);
    });
    loadRides();
  }, []);

  const loadRides = async () => {
    try {
      // GET /rides/recent
      const res = await apiCall('GET', '/rides/recent');
      setRides(res.data);
    } catch {
      setRides([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bgAlt }}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.avatar} />
          <View>
            <Text style={s.greeting}>안녕하세요</Text>
            <Text style={s.userName}>{userName} 님</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/mypage')}>
          <Text style={s.bell}>🔔</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* CTA */}
        <TouchableOpacity style={s.ctaCard} onPress={() => router.push('/qr-scan')} activeOpacity={0.85}>
          <View style={s.ctaTop}>
            <View>
              <Text style={s.ctaStateLabel}>현재 상태</Text>
              <Text style={s.ctaState}>대기 중</Text>
            </View>
            <View style={s.ctaPill}><Text style={s.ctaPillText}>라이딩 없음</Text></View>
          </View>
          <Text style={s.ctaSub}>스쿠터 QR을 스캔하여 라이딩을 시작하세요</Text>
          <View style={s.ctaBtn}><Text style={s.ctaBtnText}>📷  QR 스캔으로 시작</Text></View>
        </TouchableOpacity>

        {/* 빠른 메뉴 */}
        <View>
          <Text style={s.sectionLabel}>빠른 메뉴</Text>
          <View style={s.quickGrid}>
            {QUICK_ITEMS.map(({ icon, label, route }) => (
              <TouchableOpacity key={label} style={s.quickBtn}
                onPress={() => route && router.push(route as any)} activeOpacity={0.7}>
                <WFCard style={s.quickCard}>
                  <Text style={s.quickIcon}>{icon}</Text>
                  <Text style={s.quickLabel}>{label}</Text>
                </WFCard>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 최근 이용 내역 */}
        <View>
          <Text style={s.sectionLabel}>최근 이용 내역</Text>
          {loading ? (
            <WFCard><ActivityIndicator color={T.text} /></WFCard>
          ) : rides.length === 0 ? (
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
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: T.bg, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: T.fill },
  greeting: { fontSize: 13, color: T.textMuted },
  userName: { fontSize: 16, fontWeight: '700', color: T.text },
  bell: { fontSize: 22 },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  ctaCard: { backgroundColor: T.text, borderRadius: 20, padding: 20, gap: 12 },
  ctaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ctaStateLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  ctaState: { fontSize: 18, fontWeight: '700', color: '#FFF', marginTop: 2 },
  ctaPill: { paddingHorizontal: 10, paddingVertical: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  ctaPillText: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  ctaSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20 },
  ctaBtn: { height: 44, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ctaBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: T.textSub, letterSpacing: 0.3, marginBottom: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -(GAP / 2) },
  quickBtn: { flexBasis: '50%', paddingHorizontal: GAP / 2, paddingBottom: GAP },
  quickCard: { width: '100%', alignItems: 'center', gap: 8, padding: 16 },
  quickIcon: { fontSize: 24 },
  quickLabel: { fontSize: 13, color: T.text, textAlign: 'center' },
  rideCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, marginBottom: 8 },
  rideId: { fontSize: 13, fontWeight: '600', color: T.text },
  rideDate: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  emptyText: { fontSize: 13, color: T.textMuted, textAlign: 'center', padding: 16 },
});
