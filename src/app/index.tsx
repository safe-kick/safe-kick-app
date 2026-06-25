import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/colors';

// 개발 중 토큰 강제 초기화 — 배포 전 false로
const DEV_CLEAR_TOKEN = false;

// 닷 하나의 애니메이션 컴포넌트
function PulseDot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 400,
          useNativeDriver: true,
        }),
        // 나머지 두 닷이 돌아오길 기다리는 시간
        Animated.delay(400 * 2 - delay > 0 ? 400 * 2 - delay : 0),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return <Animated.View style={[s.dot, { opacity }]} />;
}

export default function SplashScreen() {
  useEffect(() => {
    (async () => {
      if (DEV_CLEAR_TOKEN) await AsyncStorage.clear();
      await new Promise(r => setTimeout(r, 2000)); // 애니메이션 볼 수 있게 2초
      try {
        const token = await AsyncStorage.getItem('token');
        router.replace(token ? '/main' : '/login');
      } catch {
        router.replace('/login');
      }
    })();
  }, []);

  return (
    <View style={s.container}>
      {/* 로고 */}
      <View style={s.logoBox}>
        <Text style={s.logoIcon}>🛴</Text>
      </View>

      {/* 앱명 */}
      <View style={s.textWrap}>
        <Text style={s.appName}>Safe Kick</Text>
        <Text style={s.appSub}>전동 킥보드 안전 인증 서비스</Text>
      </View>

      {/* 로딩 닷 — 순차 페이드 애니메이션 */}
      <View style={s.dots}>
        <PulseDot delay={0} />
        <PulseDot delay={200} />
        <PulseDot delay={400} />
      </View>

      <Text style={s.version}>v1.0.0</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: 88, height: 88, borderRadius: 22,
    backgroundColor: T.fill,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  logoIcon: { fontSize: 44 },
  textWrap: { alignItems: 'center', marginBottom: 40 },
  appName: { fontSize: 28, fontWeight: '700', color: T.text, letterSpacing: -0.5 },
  appSub: { fontSize: 13, color: T.textMuted, marginTop: 6 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: T.text,
  },
  version: {
    position: 'absolute', bottom: 48,
    fontSize: 11, color: T.textMuted, letterSpacing: 0.5,
  },
});
