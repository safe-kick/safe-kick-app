// POST /auth/register — 성공
export const mockRegisterSuccess = {
  status: "success",
  data: {
    user_id: 1,
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_token",
  },
};

// POST /auth/register — 이메일 중복
export const mockRegisterDuplicate = {
  status: "error",
  message: "이미 가입된 이메일입니다.",
};

// POST /auth/login — 성공
export const mockLoginSuccess = {
  status: "success",
  data: {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_token",
    user: {
      id: 1,
      name: "홍길동",
      email: "user@example.com",
    },
  },
};

// POST /auth/login — 실패
export const mockLoginFail = {
  status: "error",
  message: "이메일 또는 비밀번호가 올바르지 않습니다.",
};

// POST /auth/face-verify — 성공
export const mockFaceVerifySuccess = {
  status: "success",
  data: {
    match: true,
    confidence: 0.92,
    face_vector: [0.123, -0.456, 0.789, 0.321, -0.654],
  },
};

// POST /auth/face-verify — 실패
export const mockFaceVerifyFail = {
  status: "success",
  data: {
    match: false,
    confidence: 0.42,
    face_vector: null,
  },
};
