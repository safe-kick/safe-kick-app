import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/colors';
import { mockLoginSuccess } from '../mock/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('이메일과 비밀번호를 입력하세요.'); return; }
    setLoading(true); setError('');
    await new Promise(r => setTimeout(r, 800));
    const res = mockLoginSuccess;
    await AsyncStorage.setItem('token', res.data.token);
    await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
    setLoading(false);
    router.replace('/main');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* 헤더 */}
        <View style={s.header}>
          <Text style={s.title}>로그인</Text>
          <Text style={s.sub}>계정에 로그인하세요</Text>
        </View>

        {/* 폼 */}
        <View style={s.form}>
          <View style={s.fieldWrap}>
            <Text style={s.label}>이메일</Text>
            <TextInput style={s.input} placeholder="이메일 입력" placeholderTextColor={T.textMuted}
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.label}>비밀번호</Text>
            <TextInput style={s.input} placeholder="비밀번호 입력" placeholderTextColor={T.textMuted}
              value={password} onChangeText={setPassword} secureTextEntry />
          </View>
          <TouchableOpacity style={s.forgotBtn}>
            <Text style={s.forgotText}>비밀번호 찾기</Text>
          </TouchableOpacity>
          {error ? <Text style={s.errorText}>{error}</Text> : null}
        </View>

        {/* 버튼 */}
        <View style={s.btnGroup}>
          <TouchableOpacity style={[s.btn, s.btnPrimary, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={s.btnPrimaryText}>{loading ? '로그인 중...' : '로그인'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => router.push('/register')}>
            <Text style={s.btnGhostText}>회원가입</Text>
          </TouchableOpacity>
        </View>

        {/* 소셜 로그인 */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>소셜 로그인</Text>
          <View style={s.dividerLine} />
        </View>
        <View style={s.socialRow}>
          {['카카오', '네이버', '구글'].map(name => (
            <View key={name} style={s.socialBtn}>
              <Text style={s.socialText}>{name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40, gap: 24 },
  header: { gap: 4 },
  title: { fontSize: 26, fontWeight: '700', color: T.text },
  sub: { fontSize: 14, color: T.textMuted },
  form: { gap: 14 },
  fieldWrap: { gap: 5 },
  label: { fontSize: 12, fontWeight: '600', color: T.textSub, letterSpacing: 0.3 },
  input: {
    height: 48, paddingHorizontal: 14, borderWidth: 1.5, borderColor: T.border,
    borderRadius: 10, fontSize: 14, color: T.text, backgroundColor: T.bg,
  },
  forgotBtn: { alignSelf: 'flex-end' },
  forgotText: { fontSize: 13, color: T.textSub, textDecorationLine: 'underline' },
  errorText: { fontSize: 12, color: T.err },
  btnGroup: { gap: 10 },
  btn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: T.text },
  btnGhost: { borderWidth: 1.5, borderColor: T.border, backgroundColor: 'transparent' },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  btnGhostText: { color: T.text, fontSize: 14, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: T.border },
  dividerText: { fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' } as any,
  socialRow: { flexDirection: 'row', gap: 10 },
  socialBtn: {
    flex: 1, height: 44, backgroundColor: T.fill, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  socialText: { fontSize: 13, color: T.textSub },
});
