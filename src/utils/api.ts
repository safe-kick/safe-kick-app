import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants/api';

// ─── Mock 데이터 매핑 ────────────────────────────────────
// 서버 연결 실패 시 아래 mock 데이터로 자동 대체됩니다
const MOCK_MAP: Record<string, Record<string, any>> = {
  'POST /auth/login': {
    status: 'success',
    data: {
      token: 'mock.jwt.token',
      user: { id: 1, name: '최세은', email: 'user@example.com' },
    },
  },
  'POST /auth/register': {
    status: 'success',
    data: { user_id: 1, token: 'mock.jwt.token' },
    message: '회원가입이 완료되었습니다.',
  },
  'POST /auth/face-verify': {
    status: 'success',
    data: { match: true, confidence: 0.92, face_vector: [0.123, -0.456, 0.789] },
  },
  'GET /users/me': {
    status: 'success',
    data: {
      id: 1, name: '최세은', email: 'user@example.com',
      license: { license_no: '12-34-567890-01', expires_at: '2030-12-31' },
      created_at: '2026-06-24T09:00:00',
    },
  },
  'GET /rides': {
    status: 'success',
    data: [
      { ride_id: 12, kickboard_id: 'KB-001', started_at: '2026-06-24T09:00:00', ended_at: '2026-06-24T09:30:00', warning_count: 1 },
      { ride_id: 11, kickboard_id: 'KB-003', started_at: '2026-06-22T18:10:00', ended_at: '2026-06-22T18:35:00', warning_count: 0 },
      { ride_id: 10, kickboard_id: 'KB-001', started_at: '2026-06-20T14:00:00', ended_at: '2026-06-20T14:22:00', warning_count: 0 },
    ],
  },
  'GET /rides/recent': {
    status: 'success',
    data: [
      { ride_id: 12, kickboard_id: 'KB-001', started_at: '2026-06-24T09:00:00', ended_at: '2026-06-24T09:30:00', warning_count: 1 },
      { ride_id: 11, kickboard_id: 'KB-003', started_at: '2026-06-22T18:10:00', ended_at: '2026-06-22T18:35:00', warning_count: 0 },
    ],
  },
  'GET /status': {
    status: 'success',
    data: { kickboard_id: 'KB-001', is_locked: true, session_active: false },
  },
  'POST /session/start': {
    status: 'success',
    data: { session_id: 5, message: '모니터링을 시작합니다.' },
  },
  'POST /session/end': {
    status: 'success',
    data: { session_id: 5, started_at: '2026-06-24T09:00:00', ended_at: '2026-06-24T09:30:00', warning_count: 0 },
  },
  'GET /session/summary': {
    status: 'success',
    data: {
      session_id: 5, kickboard_id: 'KB-001',
      started_at: '2026-06-24T09:00:00', ended_at: '2026-06-24T09:30:00',
      duration_sec: 1800, warning_count: 1, warning_reasons: ['two_person'],
    },
  },
};

// ─── 서버 연결 상태 캐시 ─────────────────────────────────
// 매 요청마다 health check 하지 않고, 한 번 확인 후 캐싱
let _serverAvailable: boolean | null = null;
let _lastCheck = 0;
const CHECK_INTERVAL = 10_000; // 10초마다 재확인

async function isServerAvailable(): Promise<boolean> {
  const now = Date.now();
  // 캐시가 유효하면 바로 반환
  if (_serverAvailable !== null && now - _lastCheck < CHECK_INTERVAL) {
    return _serverAvailable;
  }
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000), // 3초 안에 응답 없으면 실패
    });
    _serverAvailable = res.ok;
  } catch {
    _serverAvailable = false;
  }
  _lastCheck = now;
  return _serverAvailable;
};

// ─── 메인 API 호출 함수 ──────────────────────────────────
export async function apiCall<T = any>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: object,
): Promise<T> {
  const key = `${method} ${path}`;
  const serverUp = await isServerAvailable();

  // 서버 꺼져있으면 바로 mock 반환
  if (!serverUp) {
    console.log(`[API] 서버 오프라인 → mock 사용: ${key}`);
    const mock = MOCK_MAP[key];
    if (mock) return mock as T;
    throw new Error(`mock 데이터 없음: ${key}`);
  }

  // 서버 켜져있으면 실제 호출
  try {
    const token = await AsyncStorage.getItem('token').catch(() => null);
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(8000), // 8초 타임아웃
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    console.log(`[API] 서버 응답: ${key}`);
    return res.json();

  } catch (e) {
    // 서버 호출 중 에러 → mock으로 fallback
    console.log(`[API] 서버 오류 → mock fallback: ${key}`, e);
    _serverAvailable = false; // 캐시 무효화
    const mock = MOCK_MAP[key];
    if (mock) return mock as T;
    throw e;
  }
}
