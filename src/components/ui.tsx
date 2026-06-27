import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { T, statusColor, statusBg } from '../constants/colors';

// ─── TopBar ─────────────────────────────────────────────
export function TopBar({
  title, back, onBack, right,
}: {
  title?: string; back?: boolean; onBack?: () => void; right?: ReactNode;
}) {
  return (
    <View style={s.topBar}>
      {back ? (
        <TouchableOpacity onPress={onBack} style={s.topBarBackBtn}>
          <Text style={s.topBarBackIcon}>‹</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.topBarSpacer} />
      )}
      <Text style={s.topBarTitle}>{title}</Text>
      {right ? <View style={s.topBarRight}>{right}</View> : <View style={s.topBarSpacer} />}
    </View>
  );
}

// ─── Badge ──────────────────────────────────────────────
export function WFBadge({
  label, status = 'ok', dot = true,
}: {
  label: string; status?: string; dot?: boolean;
}) {
  const c = statusColor(status);
  const bg = statusBg(status);
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      {dot && <View style={[s.badgeDot, { backgroundColor: c }]} />}
      <Text style={[s.badgeText, { color: c }]}>{label}</Text>
    </View>
  );
}

// ─── Card ────────────────────────────────────────────────
export function WFCard({
  children, style,
}: {
  children: ReactNode; style?: object;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}

// ─── Input ──────────────────────────────────────────────
export function WFInput({
  label, placeholder, value, error, secure,
}: {
  label?: string; placeholder?: string; value?: string;
  error?: string; secure?: boolean;
}) {
  const hasError = !!error;
  return (
    <View style={s.inputWrap}>
      {label && <Text style={s.inputLabel}>{label}</Text>}
      <View style={[s.inputBox, hasError && s.inputBoxError]}>
        <Text style={[s.inputText, !value && s.inputPlaceholder]}>
          {value || placeholder || ''}
        </Text>
        {secure && <Text style={s.inputEye}>👁</Text>}
      </View>
      {error && <Text style={s.inputError}>{error}</Text>}
    </View>
  );
}

// ─── Button ─────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'disabled';
export function WFButton({
  label, variant = 'primary', onPress, size = 'md',
}: {
  label: string; variant?: BtnVariant;
  onPress?: () => void; size?: 'sm' | 'md' | 'lg';
}) {
  const h = { sm: 36, md: 48, lg: 56 }[size];
  const variantStyle = {
    primary: { bg: T.text, text: '#FFF', border: T.text },
    secondary: { bg: T.fill, text: T.text, border: T.border },
    danger: { bg: T.err, text: '#FFF', border: T.err },
    ghost: { bg: 'transparent', text: T.text, border: T.border },
    disabled: { bg: T.fillMed, text: T.textMuted, border: T.fillMed },
  }[variant];

  return (
    <TouchableOpacity
      onPress={variant === 'disabled' ? undefined : onPress}
      activeOpacity={variant === 'disabled' ? 1 : 0.7}
    >
      <View style={[
        s.btn,
        { height: h, backgroundColor: variantStyle.bg, borderColor: variantStyle.border },
        (variant === 'secondary' || variant === 'ghost') && s.btnBorder,
      ]}>
        <Text style={[s.btnText, { color: variantStyle.text },
          size === 'sm' && { fontSize: 13 }, size === 'lg' && { fontSize: 16 },
        ]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Divider ─────────────────────────────────────────────
export function WFDivider() {
  return <View style={s.divider} />;
}

// ─── Row Item ────────────────────────────────────────────
export function WFRow({
  label, value, mono,
}: {
  label: string; value: string; mono?: boolean;
}) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, mono && s.mono]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  // TopBar
  topBar: {
    height: 52, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: T.border,
    backgroundColor: T.bg,
  },
  topBarBackBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: T.fill,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarBackIcon: { fontSize: 22, color: T.text, lineHeight: 28 },
  topBarTitle: {
    flex: 1, fontSize: 16, fontWeight: '600', color: T.text, textAlign: 'center',
  },
  topBarSpacer: { width: 36 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Badge
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  // Card
  card: {
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
    borderRadius: 16, padding: 16,
  },

  // Input
  inputWrap: { gap: 5 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: T.textSub, letterSpacing: 0.3 },
  inputBox: {
    height: 48, paddingHorizontal: 14, backgroundColor: T.bg,
    borderWidth: 1.5, borderColor: T.border, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  inputBoxError: { borderColor: T.err },
  inputText: { flex: 1, fontSize: 14, color: T.text },
  inputPlaceholder: { color: T.textMuted },
  inputEye: { fontSize: 14 },
  inputError: { fontSize: 11, color: T.err },

  // Button
  btn: {
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    width: '100%',
  },
  btnBorder: { borderWidth: 1.5 },
  btnText: { fontSize: 14, fontWeight: '600' },

  // Divider
  divider: { height: 1, backgroundColor: T.border, marginVertical: 2 },

  // Row
  row: {
    flexDirection: 'row', paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  rowLabel: { flex: 1, fontSize: 12, color: T.textMuted },
  rowValue: { fontSize: 13, color: T.text, fontWeight: '500' },
  mono: { fontVariant: ['tabular-nums'] },
});
