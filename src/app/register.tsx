import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/colors';
import { TopBar } from '../components/ui';
import { apiCall } from '../utils/api';

function ProgressDots({ total = 3, active = 0 }: { total?: number; active?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[{ flex: 1, height: 4, borderRadius: 2 },
          { backgroundColor: i <= active ? T.text : T.fillMed }]} />
      ))}
    </View>
  );
}

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNext = async () => {
    if (!name || !email || !password || !passwordConfirm) { setError('모든 항목을 입력하세요.'); return; }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true); setError('');
    try {
      // POST /auth/register
      const res = await apiCall('POST', '/auth/register', { name, email, phone, password });
      await AsyncStorage.setItem('token', res.data.token);
      router.push('/license-capture');
    } catch (e: any) {
      setError(e.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <TopBar title="회원가입" back onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <ProgressDots total={3} active={0} />
          <Text style={s.stepTitle}>기본 정보 입력</Text>

          {[
            { label: '이름', val: name, set: setName, placeholder: '실명 입력' },
            { label: '이메일', val: email, set: setEmail, placeholder: '이메일 주소', type: 'email-address' as const },
            { label: '전화번호', val: phone, set: setPhone, placeholder: '010-0000-0000', type: 'phone-pad' as const },
            { label: '비밀번호', val: password, set: setPassword, placeholder: '8자 이상', secure: true },
            { label: '비밀번호 확인', val: passwordConfirm, set: setPasswordConfirm, placeholder: '비밀번호 재입력', secure: true },
          ].map(f => (
            <View key={f.label} style={s.fieldWrap}>
              <Text style={s.label}>{f.label}</Text>
              <TextInput
                style={s.input} placeholder={f.placeholder} placeholderTextColor={T.textMuted}
                value={f.val} onChangeText={f.set}
                keyboardType={f.type || 'default'} secureTextEntry={f.secure}
                autoCapitalize="none"
              />
            </View>
          ))}

          <TouchableOpacity style={s.agreeRow} onPress={() => setAgreed(!agreed)}>
            <View style={[s.checkbox, agreed && s.checkboxActive]}>
              {agreed && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={s.agreeText}>이용약관 및 개인정보처리방침에 동의합니다</Text>
          </TouchableOpacity>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleNext} disabled={loading}>
            <Text style={s.btnText}>{loading ? '처리 중...' : '다음 단계  →'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  stepTitle: { fontSize: 17, fontWeight: '600', color: T.text },
  fieldWrap: { gap: 5 },
  label: { fontSize: 12, fontWeight: '600', color: T.textSub, letterSpacing: 0.3 },
  input: {
    height: 48, paddingHorizontal: 14, borderWidth: 1.5, borderColor: T.border,
    borderRadius: 10, fontSize: 14, color: T.text, backgroundColor: T.bg,
  },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.fill, alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: T.text, borderColor: T.text },
  checkmark: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  agreeText: { flex: 1, fontSize: 13, color: T.textSub, lineHeight: 20 },
  errorText: { fontSize: 12, color: T.err },
  btn: { height: 48, backgroundColor: T.text, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
