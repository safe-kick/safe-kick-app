# 📱 safe-kick-app

Safe Kick - AI 기반 전동 킥보드 안전 인증 앱 (React Native / Expo)

> **ESW 캡스톤 프로젝트** — 음주 감지, 2인 탑승 감지, 본인 인증을 통해 안전한 킥보드 운행을 지원합니다.

---

## 📱 주요 기능

- 회원가입 / 로그인 / 면허증 등록
- **면허증 온디바이스 OCR 인식** (ML Kit, 촬영 후 자동 필드 추출 + 수동 수정 가능)
- QR 스캔으로 킥보드 연결
- 셀피 촬영을 통한 본인 확인 (얼굴 인증, 라즈베리파이 연동)
- 안전 점검 (음주 측정, 탑승 인원 감지)
- 라이딩 중 실시간 모니터링 및 경고 (SSE)
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
│   │   ├── license-capture.tsx  # 면허증 촬영 + 온디바이스 OCR 실행
│   │   ├── license-confirm.tsx  # 면허증/OCR 확인 및 수정, 회원가입+얼굴등록 요청
│   │   ├── main.tsx          # 메인 홈
│   │   ├── qr-scan.tsx       # QR 스캔
│   │   ├── selfie.tsx        # 셀피 / 본인 확인 (얼굴 인증)
│   │   ├── safety-check.tsx  # 안전 점검
│   │   ├── monitoring.tsx    # 라이딩 모니터링
│   │   ├── return-complete.tsx # 반납 완료
│   │   └── mypage.tsx        # 마이페이지
│   ├── components/
│   │   └── ui.tsx            # 공통 UI 컴포넌트
│   ├── constants/
│   │   ├── colors.ts         # 컬러 토큰
│   │   └── api.ts            # 서버 URL 설정 (앱서버 API_BASE / 라즈베리파이 RASPI_API_BASE)
│   ├── utils/
│   │   ├── api.ts            # API 호출 유틸 (apiCall: 앱서버+mock 자동전환, raspiApiCall: 라즈베리파이 직접호출)
│   │   └── licenseOcr.ts     # OCR 인식 결과 텍스트 파싱 유틸
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

## ⚙️ 개발 환경 세팅 (Windows)

> Node.js는 Docker 컨테이너 안에서 v20.20.2로 고정 실행되므로 로컬 설치 불필요합니다.

### 1단계 — WSL2 설치

PowerShell을 **관리자 권한**으로 실행 후 아래 명령어 입력:

```powershell
wsl --install
```

설치 완료 후 **PC 재시작** → Ubuntu 실행 → username / password 설정

---

### 2단계 — Docker Desktop 설치

https://www.docker.com/products/docker-desktop/ 접속 → 다운로드 → 설치

설치 후 **WSL 연동 설정 필수:**

```
1. Docker Desktop 실행
2. 우측 상단 톱니바퀴(⚙️) → Settings
3. Resources → WSL Integration
4. "Enable integration with my default WSL distro" 토글 ON
5. 아래 Ubuntu 이름 옆 토글도 ON
6. Apply & Restart 클릭
```

---

### 3단계 — PowerShell 관리자 권한으로 재시작

```
Windows 시작 → PowerShell 검색 → 우클릭 → 관리자 권한으로 실행
```

WSL로 진입:

```powershell
wsl
```

---

### 4단계 — 프로젝트 폴더로 이동

WSL 터미널에서 /mnt/c/... 경로로 Windows 드라이브 접근:

```bash
# 예시: C:\Users\사용자이름\Desktop\safe-kick\safe-kick-app 인 경우
cd /mnt/c/Users/사용자이름/Desktop/safe-kick/safe-kick-app
```

---

### 5단계 — 레포 클론

```bash
git clone https://github.com/safe-kick/safe-kick-app.git
cd safe-kick-app
```

---

### 6단계 — Docker 컨테이너 실행

> **컨테이너는 켜지기만 하고, Metro 서버는 수동으로 실행합니다.**
> (컨테이너 CMD가 자동으로 expo를 실행하면, 종료/재시작 시 컨테이너 자체가 함께 죽는 문제가 있어 분리했습니다.)

```bash
# 이미지 빌드 (최초 1회, 또는 package.json/Dockerfile 변경 시. 3~5분 소요)
docker-compose build

# 컨테이너 백그라운드 실행 (이 시점엔 Metro가 아직 안 뜬 상태 — 정상입니다)
docker-compose up -d
```

**Metro 서버 실행 (매번 개발 시작할 때 이 명령어로):**

```bash
docker-compose exec -it metro npx expo start --dev-client --tunnel
```

- 이 터미널 창은 계속 켜둔 채로 개발하시면 돼요.
- `Ctrl+C`로 종료해도 컨테이너 자체는 안 죽습니다 (다시 위 명령어로 재실행 가능).
- `--tunnel`은 팀원 PC와 폰이 다른 네트워크에 있어도 연결되게 해주는 옵션이에요. 같은 WiFi에 있다면 `--tunnel` 없이 `--dev-client`만 써도 됩니다 (더 빠름).

브라우저에서 http://localhost:8081 접속하면 앱 확인 가능해요 (웹 모드, 카메라 기능은 제한됨).

---

### 종료

```bash
docker-compose down
```

---

## 💻 로컬에서 직접 실행 (Docker 없이)

Node.js가 이미 설치되어 있다면 Docker 없이 바로 실행할 수 있어요.

### 사전 준비

- Node.js v20.20.2 (https://nodejs.org/en/download)
- Git

### 실행

```bash
git clone https://github.com/safe-kick/safe-kick-app.git
cd safe-kick-app
npm install
npx expo start --dev-client
```

브라우저에서 `w` 키를 누르면 웹으로 바로 확인할 수 있어요 (카메라/OCR 기능 제외).

---

## 🌐 서버 연결 (선택)

서버가 없어도 **mock 데이터로 자동 동작**해요.
서버를 켜면 자동으로 실제 서버 데이터를 사용해요.

앱은 두 개의 서로 다른 백엔드와 통신합니다:

| 함수             | 대상 서버                                | 용도                                                                              |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| `apiCall()`      | `safe-kick-server` (Node.js 앱서버)      | 회원가입/로그인/운행기록 등, mock 자동 폴백 지원                                  |
| `raspiApiCall()` | `safe-kick-raspi` (라즈베리파이 FastAPI) | 얼굴 등록/인증(`/face/register`, `/face/verify`), 세션/잠금 제어 — mock 폴백 없음 |

### 앱 서버 실행 방법

```bash
git clone https://github.com/safe-kick/safe-kick-server.git
cd safe-kick-server
cp .env.example .env
docker-compose up --build -d
```

서버가 정상 실행되면 브라우저에서 확인:

```
http://localhost/health
```

### 서버 URL 변경 (실제 폰으로 테스트할 때)

`src/constants/api.ts` 파일에서 PC/라즈베리파이의 실제 IP로 변경하세요.

```ts
// 앱서버 (Node.js) — 웹 브라우저 테스트
export const API_BASE = "http://localhost";

// 앱서버 — 실제 폰(Android) 테스트 시 PC IP로 변경
// WSL에서 확인: ip addr | grep eth0
export const API_BASE = "http://192.168.x.x";

// 라즈베리파이 (얼굴 인증/세션/잠금 제어)
export const RASPI_IP = "10.10.141.46";
export const RASPI_API_BASE = `http://${RASPI_IP}:8000`;
```

> **주의:** 실제 Android/iPhone에서 `localhost`는 휴대폰 자신을 의미합니다.
> 반드시 PC 또는 라즈베리파이의 실제 IP를 사용하세요.

---

## 📲 실제 폰 테스트 (EAS Dev Build)

### 개념 먼저 — Dev Build와 Metro 서버는 한 세트

EAS Build로 만드는 APK는 카메라 권한, 온디바이스 OCR(ML Kit) 같은 네이티브 모듈만 담긴 **빈 껍데기**예요.
실제 화면(JS/TSX) 코드는 앱 실행 시 PC의 Metro 서버(`npx expo start --dev-client`)에서 실시간으로 받아와요.

```
폰 (Dev Build 앱)  ←── 같은 WiFi 또는 --tunnel ──→  PC (npx expo start --dev-client)
```

따라서 EAS Build는 **네이티브 모듈이 바뀔 때만** (신규 패키지 설치, `app.json` plugins 변경 등) 다시 하면 되고,
그 외 화면/로직 수정은 전부 Metro 재시작 없이 실시간 반영돼요.

> **웹 브라우저(`w` 키)에서는 카메라 권한 팝업이 뜨지 않습니다.**
> 카메라(QR 스캔, 셀피, 면허증 촬영, OCR)는 실제 폰 테스트에서만 동작해요.
> 웹에서는 mock 경로로 자동 폴백됩니다.

---

### Step 1 — app.json 플러그인 확인

카메라 권한이 빌드에 포함되려면 `app.json`의 `plugins`에 아래 항목이 있어야 해요.

```json
"plugins": [
  "expo-router",
  [
    "expo-camera",
    {
      "cameraPermission": "QR 스캔, 본인 인증(셀피), 면허증 촬영을 위해 카메라가 필요합니다.",
      "microphonePermission": false,
      "recordAudioAndroid": false
    }
  ]
]
```

`@react-native-ml-kit/text-recognition`은 별도 config plugin 없이 autolinking으로 처리되지만, **네이티브 코드가 포함된 패키지라 반드시 EAS 재빌드가 필요**해요.

---

### Step 2 — EAS 빌드

> **Android Studio 불필요** — `eas build`는 Expo 클라우드 서버에서 빌드됩니다.
> `eas-cli`, `@expo/ngrok`은 Dockerfile에 이미 설치되어 있어서 컨테이너 안에서 바로 쓸 수 있어요.

```bash
# 컨테이너가 떠 있는 상태에서
docker-compose exec -it metro eas login       # 최초 1회, Expo 계정 로그인
docker-compose exec -it metro eas init        # 최초 1회, 프로젝트 EAS 연결

# Android APK 빌드 (5~20분 소요, 클라우드에서 진행)
docker-compose exec -it metro eas build --profile development --platform android
```

> **⚠️ 빌드 완료 후 "Install and run on an emulator?" 질문이 뜨면 반드시 `N`을 선택하세요.** > `Y`를 선택하면 Android Studio가 없어서 `adb executable doesn't seem to work` 에러가 납니다.
> 이 에러는 무시해도 됩니다 — 빌드(APK 생성) 자체는 이미 완료된 상태예요.

---

### Step 3 — APK 다운로드 및 폰에 설치

빌드 완료 후 터미널에 다운로드 링크/QR코드가 출력돼요.

**설치 방법:**

1. 폰 카메라로 QR 스캔 (또는 브라우저로 링크 접속)
2. APK 다운로드 → 설치 (기존 버전 있으면 **삭제 후 재설치** 권장 — 네이티브 모듈 갱신 문제 방지)
3. 안드로이드가 "출처를 알 수 없는 앱" 경고를 띄우면 **허용** 클릭

---

### Step 4 — Metro 서버 실행 및 폰과 연결

```bash
docker-compose exec -it metro npx expo start --dev-client --tunnel
```

1. 설치한 **Safe Kick Dev Build** 앱 실행
2. 처음 실행하면 빈 화면이 뜨는 게 정상 — Metro 서버에 아직 연결 전
3. 터미널에 뜨는 `exp://...` 주소를 앱의 "Enter URL manually"에 입력 (또는 QR 스캔)

---

### 재빌드가 필요한 경우 vs 필요 없는 경우

| 변경 내용                                                                             | 재빌드 필요?                   |
| ------------------------------------------------------------------------------------- | ------------------------------ |
| 화면(.tsx) 코드/스타일 수정                                                           | ❌ Metro가 떠 있으면 즉시 반영 |
| 순수 JS 라이브러리 추가                                                               | ❌ 대부분 불필요               |
| `app.json`의 `plugins` 추가/수정                                                      | ✅ 필요                        |
| 네이티브 모듈이 포함된 패키지 신규 설치 (예: `@react-native-ml-kit/text-recognition`) | ✅ 필요                        |

---

## 🔄 mock vs 서버 자동 전환

`src/utils/api.ts`가 자동으로 처리해요. **단, 앱서버(`apiCall`)에만 해당되고, 라즈베리파이(`raspiApiCall`)는 mock 폴백이 없어요** — 라파가 꺼져있으면 얼굴 등록/인증은 그냥 실패합니다.

```
apiCall() 호출
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

| 항목     | 값               |
| -------- | ---------------- |
| 이름     | 최세은           |
| 이메일   | user@example.com |
| 면허번호 | 12-34-567890-01  |

---

## 🛠 개발 중 유용한 명령어

```bash
# 캐시 초기화
npx expo start --clear

# Docker 컨테이너 재시작
docker-compose restart

# Docker 컨테이너 안에 접속
docker-compose exec -it metro bash

# Zone.Identifier 파일 정리 (Windows에서 작업 후)
find . -name "*.Identifier" -delete
```

### ⚠️ `DEV_CLEAR_TOKEN` — 배포 전 반드시 확인

`src/app/index.tsx`의 아래 플래그는 **개발 중 로그인 화면부터 다시 테스트하고 싶을 때만** 임시로 `true`로 켜세요.

```ts
const DEV_CLEAR_TOKEN = true; // 앱 실행마다 저장된 토큰을 강제로 지움
```

**데모/배포 전에는 반드시 `false`로 되돌려야 합니다.** `true`인 채로 배포하면 앱을 켤 때마다 로그인이 풀려버려요. (관련 Jira: 배포 전 필수 수정 항목으로 등록됨)

---

## 👥 팀 구성

| 이름           | 역할                                                               |
| -------------- | ------------------------------------------------------------------ |
| 최세은 (SEIN)  | 앱 프론트엔드 (React Native)                                       |
| 정재영         | 앱 백엔드 서버 (Node.js + PostgreSQL) + 라즈베리파이 얼굴인증 서버 |
| 박종빈         | 하드웨어 / 펌웨어 (Raspberry Pi + STM32)                           |
| 정재영, 최세은 | AI 인증 시스템 (YOLO + InsightFace)                                |

---

## 🔗 관련 레포

| 레포                                                              | 설명                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------- |
| [safe-kick-app](https://github.com/safe-kick/safe-kick-app)       | 앱 프론트엔드 (현재)                                    |
| [safe-kick-server](https://github.com/safe-kick/safe-kick-server) | 앱 백엔드 서버 (Node.js, 회원/운행기록)                 |
| [safe-kick-raspi](https://github.com/safe-kick/safe-kick-raspi)   | 라즈베리파이 AI 서버 (얼굴인증, 세션/잠금제어, FastAPI) |
| [safe-kick-stm32](https://github.com/safe-kick/safe-kick-stm32)   | STM32 펌웨어                                            |
