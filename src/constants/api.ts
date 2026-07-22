// 서버 주소는 .env 파일에서 관리합니다.
// 처음 세팅 시: cp .env.example .env  후 실제 값으로 수정하세요.
// .env는 .gitignore에 등록되어 있어 각자 로컬 환경에 맞게 다르게 설정 가능합니다.
//
// 웹 브라우저 테스트 → localhost 그대로 둬도 됩니다.
// 실제 폰(Android/iPhone) 테스트 → PC/라즈베리파이의 실제 IP로 .env에서 변경하세요.
//   PowerShell에서 확인: ipconfig (또는 Tailscale IP)
//   예) EXPO_PUBLIC_API_BASE=http://100.73.241.116:3000

// Node.js 앱 서버 (포트 꼭 필요 — 80번 nginx는 현재 미사용, 3000 직결)
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

// 라즈베리파이 (얼굴 인증, 세션/잠금 제어)
export const RASPI_IP = process.env.EXPO_PUBLIC_RASPI_IP;
export const RASPI_API_BASE = process.env.EXPO_PUBLIC_RASPI_API_BASE;

// 개발 모드 여부 — true면 서버 연결 실패 시 mock으로 자동 대체, false면 mock 완전 비활성화
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";
