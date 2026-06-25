// GET /users/me
export const mockUserMe = {
  status: "success",
  data: {
    id: 1,
    name: "홍길동",
    email: "user@example.com",
    license: {
      license_no: "12-34-567890-01",
      expires_at: "2030-12-31",
    },
    created_at: "2026-06-24T09:00:00",
  },
};

// GET /rides
export const mockRides = {
  status: "success",
  data: [
    {
      ride_id: 12,
      kickboard_id: "KB-001",
      started_at: "2026-06-24T09:00:00",
      ended_at: "2026-06-24T09:30:00",
      warning_count: 1,
    },
    {
      ride_id: 11,
      kickboard_id: "KB-003",
      started_at: "2026-06-22T18:10:00",
      ended_at: "2026-06-22T18:35:00",
      warning_count: 0,
    },
    {
      ride_id: 10,
      kickboard_id: "KB-001",
      started_at: "2026-06-20T14:00:00",
      ended_at: "2026-06-20T14:22:00",
      warning_count: 0,
    },
  ],
};

// GET /rides/recent
export const mockRidesRecent = {
  status: "success",
  data: [
    {
      ride_id: 12,
      kickboard_id: "KB-001",
      started_at: "2026-06-24T09:00:00",
      ended_at: "2026-06-24T09:30:00",
      warning_count: 1,
    },
    {
      ride_id: 11,
      kickboard_id: "KB-003",
      started_at: "2026-06-22T18:10:00",
      ended_at: "2026-06-22T18:35:00",
      warning_count: 0,
    },
  ],
};

// GET /status (라즈베리파이)
export const mockKickboardStatus = {
  status: "success",
  data: {
    kickboard_id: "KB-001",
    is_locked: true,
    session_active: false,
  },
};

// POST /session/start
export const mockSessionStart = {
  status: "success",
  data: {
    session_id: 5,
    message: "모니터링을 시작합니다.",
  },
};

// GET /session/stream (SSE) — 정상
export const mockStreamNormal = {
  face_score: 0.92,
  weight: 65.3,
  gas: 0.12,
  is_two_person: false,
  is_drunk: false,
  is_locked: false,
  status: "normal",
  warning_reason: null,
};

// GET /session/stream (SSE) — 경고: 2인 탑승
export const mockStreamWarningTwoPerson = {
  face_score: 0.91,
  weight: 130.5,
  gas: 0.10,
  is_two_person: true,
  is_drunk: false,
  is_locked: true,
  status: "warning",
  warning_reason: "two_person",
};

// GET /session/stream (SSE) — 경고: 음주
export const mockStreamWarningDrunk = {
  face_score: 0.90,
  weight: 68.0,
  gas: 0.85,
  is_two_person: false,
  is_drunk: true,
  is_locked: true,
  status: "warning",
  warning_reason: "drunk",
};

// GET /session/stream (SSE) — 안전점검 대기
export const mockStreamWaiting = {
  face_score: 0.0,
  weight: 0.0,
  gas: 0.0,
  is_two_person: false,
  is_drunk: false,
  is_locked: true,
  status: "waiting",
  warning_reason: null,
};

// GET /session/summary
export const mockSessionSummary = {
  status: "success",
  data: {
    session_id: 5,
    kickboard_id: "KB-001",
    started_at: "2026-06-24T09:00:00",
    ended_at: "2026-06-24T09:30:00",
    duration_sec: 1800,
    warning_count: 1,
    warning_reasons: ["two_person"],
  },
};
