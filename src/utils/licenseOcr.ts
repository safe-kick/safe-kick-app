// 면허증 OCR 텍스트 파싱 유틸
// 온디바이스 OCR(ML Kit) 인식 결과 원문에서 면허증 필드를 정규식으로 추출합니다.
// 정확도가 100%는 아니므로, 화면에서는 항상 값을 수정 가능한 입력창으로 보여줘야 합니다.

export type ParsedLicense = {
  name: string;
  birth: string;
  licenseNo: string;
  licenseType: string;
  issuedAt: string;
  expiresAt: string;
};

const LICENSE_NO_RE = /\d{2}\s?-\s?\d{2}\s?-\s?\d{6}\s?-\s?\d{2}/;
const DATE_RE = /\d{4}[.\-]\s?\d{1,2}[.\-]\s?\d{1,2}/g;
const TYPE_RE = /[12]\s?종\s?(보통|대형|소형|특수)/;
// 주민등록번호 형식(6자리-7자리)에서 앞 6자리만 추출 — 면허번호(2-2-6-2)의 6자리 구간과 혼동되지 않도록
// 뒷자리 7자리 전체를 매칭 대상에 넣어 패턴을 좁힘 (실제 저장/전송은 앞 6자리만 사용)
const RESIDENT_NO_RE = /\d{6}\s?-\s?\d{7}/;

function normalizeDate(raw: string): string {
  return raw.replace(/\s/g, '').replace(/-/g, '.');
}

/**
 * OCR 원문 텍스트에서 면허증 필드를 최대한 추출합니다.
 * 매칭 실패 시 해당 필드는 빈 문자열로 반환되며, 화면단에서 사용자가 직접 입력/수정해야 합니다.
 */
export function parseLicenseText(rawText: string): ParsedLicense {
  const text = rawText || '';

  // 면허번호 (예: 12-34-567890-01)
  const licenseNoMatch = text.match(LICENSE_NO_RE);
  const licenseNo = licenseNoMatch ? licenseNoMatch[0].replace(/\s/g, '') : '';

  // 면허종별 (예: 2종보통)
  const typeMatch = text.match(TYPE_RE);
  const licenseType = typeMatch ? typeMatch[0].replace(/\s/g, '') : '';

  // 날짜들 (발급일/만료일 후보) — 가장 이른 날짜=발급일, 가장 늦은 날짜=만료일로 추정
  const dateMatches = Array.from(
    new Set((text.match(DATE_RE) || []).map(normalizeDate))
  );
  let issuedAt = '';
  let expiresAt = '';
  if (dateMatches.length > 0) {
    const sorted = [...dateMatches].sort();
    issuedAt = sorted[0];
    expiresAt = sorted[sorted.length - 1];
  }

  // 이름: 한글 2~4자로만 이루어진 줄 중 첫 번째 후보
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const nameCandidate = lines.find((l) => /^[가-힣]{2,4}$/.test(l));
  const name = nameCandidate || '';

  // 생년월일: 주민등록번호(6자리-7자리) 형식에서 앞 6자리만 추출
  // 면허번호(2-2-6-2)의 가운데 6자리 구간과 혼동되지 않도록 뒷자리 7자리까지 함께 매칭
  const residentMatch = text.match(RESIDENT_NO_RE);
  const birth = residentMatch
    ? residentMatch[0].replace(/\s/g, '').split('-')[0]
    : '';

  return { name, birth, licenseNo, licenseType, issuedAt, expiresAt };
}

/** license_expires_at 필드용 — YYYY.MM.DD → YYYY-MM-DD */
export function toIsoDate(dotDate: string): string {
  if (!dotDate) return '';
  const parts = dotDate.split('.').filter(Boolean);
  if (parts.length !== 3) return '';
  const [y, m, d] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
