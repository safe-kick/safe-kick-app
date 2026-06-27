// 피그마 App.tsx 디자인 토큰 기반
export const T = {
  bg: '#FFFFFF',
  bgAlt: '#F7F7F7',
  border: '#E2E2E2',
  fill: '#EBEBEB',
  fillMed: '#D4D4D4',
  text: '#1A1A1A',
  textSub: '#6B6B6B',
  textMuted: '#AEAEAE',

  // 상태 색상
  ok: '#2E7D32',
  okBg: '#E8F5E9',
  warn: '#E65100',
  warnBg: '#FFF3E0',
  err: '#C62828',
  errBg: '#FFEBEE',
  info: '#1565C0',
  infoBg: '#E3F2FD',
  locked: '#6A1B9A',
  lockedBg: '#F3E5F5',
};

export function statusColor(s: string): string {
  const map: Record<string, string> = {
    ok: T.ok, warn: T.warn, err: T.err,
    info: T.info, locked: T.locked, connecting: T.info,
  };
  return map[s] ?? T.textMuted;
}

export function statusBg(s: string): string {
  const map: Record<string, string> = {
    ok: T.okBg, warn: T.warnBg, err: T.errBg,
    info: T.infoBg, locked: T.lockedBg, connecting: T.infoBg,
  };
  return map[s] ?? T.fill;
}
