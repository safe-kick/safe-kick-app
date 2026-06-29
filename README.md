# 📱 safe-kick-app
Safe Kick - AI 기반 전동 킥보드 안전 인증 앱 (React Native / Expo)

> **ESW 캡스톤 프로젝트** — 음주 감지, 2인 탑승 감지, 본인 인증을 통해 안전한 킥보드 운행을 지원합니다.

---

## 📱 주요 기능

- 회원가입 / 로그인 / 면허증 등록
- QR 스캔으로 킥보드 연결
- 셀피 촬영을 통한 본인 확인 (얼굴 인증)
- 안전 점검 (음주 측정, 탑승 인원 감지)
- 라이딩 중 실시간 모니터링 및 경고
- 반납 및 이용 내역 조회

---

## 📁 폴더 구조

```
safe-kick-app/
├── src/
│   ├── app/                  # 화면 (expo-router)
│   │   ├── index.tsx         # 스플래시
│   │   ├── login.tsx         # 로그인
│   │   ├── register.tsx      # 회원가입
│   │   ├── license-capture.tsx  # 면허증 촬영
│   │   ├── license-confirm.tsx  # 면허증 확인
│   │   ├── main.tsx          # 메인 홈
│   │   ├── qr-scan.tsx       # QR 스캔
│   │   ├── selfie.tsx        # 셀피 / 본인 확인
│   │   ├── safety-check.tsx  # 안전 점검
│   │   ├── monitoring.tsx    # 라이딩 모니터링
│   │   ├── return-complete.tsx # 반납 완료
│   │   └── mypage.tsx        # 마이페이지
│   ├── components/
│   │   └── ui.tsx            # 공통 UI 컴포넌트
│   ├── constants/
│   │   ├── colors.ts         # 컬러 토큰
│   │   └── api.ts            # 서버 URL 설정
│   ├── utils/
│   │   └── api.ts            # API 호출 유틸 (서버/mock 자동 전환)
│   └── mock/
│       ├── auth.ts           # 인증 mock 데이터
│       └── data.ts           # 기타 mock 데이터
├── assets/
├── Dockerfile
├── docker-compose.yml
├── app.json
├── package.json
└── README.md
```

---

## ⚙️ 개발 환경 세팅

### 사전 준비

- Docker & Docker Compose
- Git

> Node.js는 Docker 컨테이너 안에서 v20.20.2로 고정 실행되므로 로컬 설치 불필요합니다.

---

### 🐳 Docker로 실행 (권장)

#### 1. 레포 클론

```bash
git clone https://github.com/safe-kick/safe-kick-app.git
cd safe-kick-app
```

#### 2. 이미지 빌드 (최초 1회, 3~5분 소요)

```bash
docker compose build
```

#### 3. 실행

```bash
docker compose up -d
```

#### 4. 정상 동작 확인

```bash
# Node 버전 확인
docker exec app_metro node -v
# → v20.20.2

# 로그 확인
docker logs -f app_metro
# → Metro waiting on exp://... 나오면 성공
```

#### 5. 종료

```bash
docker compose down
```

---

### 💻 로컬에서 직접 실행 (Docker 없이)

#### 사전 준비

- Node.js v20.20.2
- Git
- WSL2 (Windows) 또는 macOS 터미널

```bash
git clone https://github.com/safe-kick/safe-kick-app.git
cd safe-kick-app
npm install
npx expo start
```

브라우저에서 `w` 키를 누르면 웹으로 바로 확인할 수 있어요.

---

## 🌐 서버 연결 (선택)

서버가 없어도 **mock 데이터로 자동 동작**해요.  
서버를 켜면 자동으로 실제 서버 데이터를 사용해요.

### 서버 실행 방법

[safe-kick-server](https://github.com/safe-kick/safe-kick-server) 레포를 클론하고 아래 명령어를 실행하세요.

```bash
git clone https://github.com/safe-kick/safe-kick-server.git
cd safe-kick-server
cp .env.example .env
docker compose up --build -d
```

서버가 정상 실행되면 브라우저에서 확인:

```
http://localhost/health
```

### 서버 URL 변경 (실제 폰으로 테스트할 때)

`src/constants/api.ts` 파일에서 PC의 실제 IP로 변경하세요.

```ts
// 웹 브라우저 테스트
export const API_BASE = 'http://localhost';

// 실제 폰(Android) 테스트 — PC IP로 변경
// WSL에서 확인: ip addr | grep eth0
export const API_BASE = 'http://192.168.x.x';
```

---

## 📲 실제 폰 테스트 (EAS Dev Build)

```bash
# EAS CLI 설치
npm install -g eas-cli

# 로그인
eas login

# 초기화 (최초 1회)
eas init

# Android APK 빌드
eas build --profile development --platform android
```

빌드 완료 후 APK를 폰에 설치하면 실제 카메라, QR 스캔이 동작해요.

---

## 🔄 mock vs 서버 자동 전환

`src/utils/api.ts`가 자동으로 처리해요.

```
앱 실행
  → /health 체크 (3초 타임아웃)
      ├── 서버 응답 있음 → 실제 서버 API 호출
      │     └── 호출 중 에러 → mock 자동 fallback
      └── 서버 응답 없음 → mock 데이터 사용
```

콘솔에서 현재 모드 확인 가능:

```
[API] 서버 오프라인 → mock 사용: POST /auth/login
[API] 서버 응답: GET /rides/recent
```

---

## 🧪 테스트 계정 (mock 모드)

서버 없이 mock 모드일 때 아무 이메일/비밀번호나 입력해도 로그인돼요.

| 항목 | 값 |
|------|-----|
| 이름 | 최세은 |
| 이메일 | user@example.com |
| 면허번호 | 12-34-567890-01 |

---

## 🛠 개발 중 유용한 명령어

```bash
# 토큰 초기화 (로그인 화면부터 시작하고 싶을 때)
# src/app/index.tsx 에서 아래 값을 true로 변경 후 앱 재시작
const DEV_CLEAR_TOKEN = true;
# 확인 후 다시 false로 되돌리기

# Zone.Identifier 파일 정리 (Windows에서 작업 후)
find . -name "*.Identifier" -delete

# 캐시 초기화
npx expo start --clear

# Docker 컨테이너 재시작
docker compose restart

# Docker 로그 실시간 확인
docker logs -f app_metro
```

---

## 👥 팀 구성

| 이름 | 역할 |
|------|------|
| 최세은 (SEIN) | 앱 프론트엔드 (React Native) |
| 정재영 | 앱 백엔드 서버 (Node.js + PostgreSQL) |
| 박종빈 | 하드웨어 / 펌웨어 (Raspberry Pi + STM32) |
| 정재영, 최세은 | AI 인증 시스템 (YOLO + InsightFace) |

---

## 🔗 관련 레포

| 레포 | 설명 |
|------|------|
| [safe-kick-app](https://github.com/safe-kick/safe-kick-app) | 앱 프론트엔드 (현재) |
| [safe-kick-server](https://github.com/safe-kick/safe-kick-server) | 앱 백엔드 서버 |
| [safe-kick-raspi](https://github.com/safe-kick/safe-kick-raspi) | 라즈베리파이 AI 서버 |
| [safe-kick-stm32](https://github.com/safe-kick/safe-kick-stm32) | STM32 펌웨어 |
