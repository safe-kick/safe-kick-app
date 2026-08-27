# 📱 safe-kick-app

Safe Kick - AI 기반 전동 킥보드 안전 인증 앱 (React Native / Expo)

> **ESW 캡스톤 프로젝트** — 음주 감지, 헬멧 미착용 감지, 2인 탑승 감지, 얼굴 인증을 통해 안전한 킥보드 운행을 지원합니다.

---

## 📱 주요 기능

- 회원가입 / 로그인 / 면허증 등록
- **면허증 온디바이스 OCR 인식** (ML Kit, 촬영 후 자동 필드 추출 + 수동 수정 가능)
- **면허증 얼굴 검출 선행 확인** (`/face/detect`) — 얼굴이 검출되지 않으면 계정 자체를 생성하지 않음
- QR 스캔으로 킥보드 연결 (`safekickapp://ride?v=1&kickboard_id=...` 딥링크 형식)
- 셀피 촬영을 통한 본인 확인 (얼굴 인증, 라즈베리파이 연동)
- 안전 점검 (헬멧 착용, 음주 측정, 탑승 인원 감지)
- 라이딩 중 실시간 모니터링 및 경고 (SSE) — 이중 탑승/헬멧 미착용/음주/얼굴 인식 실패 4종 대응
- 반납 및 실제 운행 요약 조회

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
│   │   ├── license-confirm.tsx  # 면허증/OCR 확인 → 얼굴검출 → 계정생성 → 얼굴등록 → 자동로그인
│   │   ├── main.tsx          # 메인 홈
│   │   ├── qr-scan.tsx       # QR 스캔 (킥보드 딥링크 파싱)
│   │   ├── selfie.tsx        # 셀피 / 본인 확인 (얼굴 인증)
│   │   ├── safety-check.tsx  # 안전 점검 + 라이딩 시작
│   │   ├── monitoring.tsx    # 라이딩 모니터링 (SSE)
│   │   ├── return-complete.tsx # 반납 완료
│   │   └── mypage.tsx        # 마이페이지
│   ├── components/
│   │   └── ui.tsx            # 공통 UI 컴포넌트
│   ├── constants/
│   │   ├── colors.ts         # 컬러 토큰
│   │   └── api.ts            # 서버 URL 설정 (.env 값을 읽어옴, 커밋 가능)
│   ├── utils/
│   │   ├── api.ts            # API 호출 유틸 (apiCall: 앱서버+mock 자동전환, raspiApiCall: 라즈베리파이 직접호출)
│   │   └── licenseOcr.ts     # OCR 인식 결과 텍스트 파싱 유틸
│   └── mock/
│       ├── auth.ts           # 인증 mock 데이터
│       └── data.ts           # 기타 mock 데이터
├── assets/
├── .env                       # 각자 로컬 설정 (git에 안 올라감, 아래 참고)
├── .env.example                # .env 템플릿 (git에 커밋됨)
├── Dockerfile
├── docker-compose.yml
├── app.json
├── package.json
└── README.md
```

---

## 🔑 환경변수(.env) 설정 — 최초 1회 필수

서버 주소는 코드에 직접 안 적고 `.env` 파일로 관리합니다. 팀원마다 네트워크 환경(IP)이 다르기 때문이에요.

```bash
cp .env.example .env
```

`.env` 파일을 열어서 본인 환경에 맞게 값을 채우세요:

```env
EXPO_PUBLIC_API_BASE=http://<PC의 IP>:3000
EXPO_PUBLIC_RASPI_IP=<라즈베리파이 IP>
EXPO_PUBLIC_RASPI_API_BASE=http://<라즈베리파이 IP>:8000
EXPO_PUBLIC_USE_MOCK=true
```

| 변수                                                  | 설명                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE`                                | 앱 서버(Node.js) 주소. **포트(`:3000`) 꼭 포함** — 80번(nginx)은 현재 미사용                         |
| `EXPO_PUBLIC_RASPI_IP` / `EXPO_PUBLIC_RASPI_API_BASE` | 라즈베리파이 주소                                                                                    |
| `EXPO_PUBLIC_USE_MOCK`                                | `true`: 서버 연결 실패 시 mock 자동 대체(개발용) / `false`: mock 완전 비활성화(데모·실연동 테스트용) |

> `.env`는 `.gitignore`에 등록되어 있어 git에 안 올라갑니다. `constants/api.ts`는 이 값을 읽기만 하는 코드라 안전하게 커밋 가능해요.

**⚠️ `.env` 수정 후에는 Metro를 완전히 껐다 다시 켜야 반영돼요** (환경변수는 Metro 시작 시점에 한 번만 읽어요, 코드처럼 Fast Refresh 안 됨).

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

### 5단계 — 레포 클론 + `.env` 설정

```bash
git clone https://github.com/safe-kick/safe-kick-app.git
cd safe-kick-app
cp .env.example .env
# .env 파일 열어서 본인 IP로 수정 (위 "환경변수 설정" 섹션 참고)
```

---

### 6단계 — Docker 컨테이너 실행

> **컨테이너는 켜지기만 하고, Metro 서버는 수동으로 실행합니다.**
> (컨테이너 CMD가 자동으로 expo를 실행하면, 종료/재시작 시 컨테이너 자체가 함께 죽는 문제가 있어 분리했습니다.)

```bash
# 이미지 빌드 (최초 1회, 또는 package.json/Dockerfile 변경 시. 3~5분 소요)
docker-compose build

# 컨테이너 백그라운드 실행
docker-compose up -d
```

### package.json 또는 app.json이 변경된 경우

새로운 Expo 패키지나 Config Plugin(예: expo-build-properties)이 추가되었다면
한 번 아래 명령을 실행하여 의존성을 설치하세요.

```bash
docker-compose exec metro npm install
```

만약 아래와 같은 오류가 발생한다면

```
PluginError: Failed to resolve plugin for module "expo-build-properties"
```

다음 명령으로 해결할 수 있습니다.

```bash
docker-compose exec metro npx expo install expo-build-properties
```

Metro 서버 실행 (매번 개발 시작할 때):

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
cp .env.example .env
npm install
npx expo start --dev-client
```

브라우저에서 `w` 키를 누르면 웹으로 바로 확인할 수 있어요 (카메라/OCR 기능 제외).

---

## 🌐 서버 연결

`EXPO_PUBLIC_USE_MOCK=true`면 서버 없이도 **mock 데이터로 자동 동작**해요.
서버를 켜면 자동으로 실제 서버 데이터를 사용해요.

앱은 두 개의 서로 다른 백엔드와 통신합니다:

| 함수             | 대상 서버                                | 용도                                                                                                            |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `apiCall()`      | `safe-kick-server` (Node.js 앱서버)      | 회원가입/로그인/운행기록 등, `USE_MOCK=true`일 때만 mock 자동 폴백 지원 (단, 회원가입/로그인은 mock 사용 안 함) |
| `raspiApiCall()` | `safe-kick-raspi` (라즈베리파이 FastAPI) | 얼굴 검출/등록/인증(`/face/detect`, `/face/register`, `/face/verify`), 세션/잠금 제어 — mock 폴백 없음          |

### 앱 서버 실행 방법

```bash
git clone https://github.com/safe-kick/safe-kick-server.git
cd safe-kick-server
cp .env.example .env
docker-compose up --build -d
```

서버가 정상 실행되면 브라우저에서 확인:

```
http://localhost:3000/health
```

> nginx(80번 포트)는 현재 프론트에서 사용하지 않고 있어요 — 서버 주소엔 **`:3000`을 꼭 포함**하세요.

### 라즈베리파이 서버 실행 방법 (Docker 아님, Python 직접 실행)

`safe-kick-raspi`는 Docker화되어 있지 않고, Python 가상환경으로 직접 실행해요. 하드웨어(STM32) 없이도 mock으로 잘 돌아가요.

```powershell
cd safe-kick-raspi
python -m venv venv

# PowerShell 스크립트 실행이 막혀있다면 먼저 (이 창에서만 임시 허용):
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- `USE_UART_MOCK` 환경변수가 기본 `true`라 STM32 없이도 실행 가능
- `/face/detect`, `/face/register`, `/face/verify`, `/session/*`는 InsightFace 기반 실제 로직이라 하드웨어 무관하게 동작
- 실행 후 `http://localhost:8000/docs`에서 Swagger UI로 API 직접 테스트 가능

---

## 🔄 회원가입 흐름 (얼굴 검출 선행 확인)

```
면허증 촬영
  ↓
POST /face/detect (라파, user_id 불필요, 저장 안 함 — 검출만)
  ├─ 얼굴 미검출 → 계정 생성 자체를 하지 않음 → 재촬영 화면으로
  └─ 검출 성공
      ↓
      POST /auth/register (Node, 계정 생성 → user_id 발급)
      ↓
      POST /face/register (라파, user_id로 얼굴 임베딩 저장)
      ├─ 실패 → user_id 보관해두고 재촬영 유도 (재시도 시 계정 재생성 안 함)
      └─ 성공 → POST /auth/login (자동 로그인) → 메인 화면
```

## 🔄 대여 흐름 (QR → 얼굴인증 → 안전점검 → 라이딩 → 반납)

```
main.tsx → qr-scan.tsx
  QR 형식: safekickapp://ride?v=1&kickboard_id=KB-XXXXXXXX
  → kickboard_id를 AsyncStorage에 저장 (이 시점엔 /rides/start 호출 안 함)
  → GET /status (라파 연결 확인) 통과 시 다음 화면
  ↓
selfie.tsx
  → POST /session/start (라파, user_id+kickboard_id) → session_id 저장
  → POST /face/live-verify (라파 실제 얼굴·헬멧 인증, Node mock 폴백 없음)
  → 얼굴·헬멧 인증 성공 시 안전 점검 화면으로 자동 이동
  ↓
safety-check.tsx
  → 음주 측정 안내 모달에서 시작 버튼을 누르면 POST /session/alcohol-check 호출
  → SSE(/session/stream)로 safety_state와 실제 STM32 센서 결과 수신
  → checking_alcohol 동안 음주 측정 결과 대기
  → 통과 시 탑승 안내를 표시하고 POST /session/weight-check를 한 번 호출
  → checking_rider → unlocking → monitoring 순서로 탑승 인원 및 잠금 해제 확인
  → monitoring + is_locked=false일 때만 안전점검 통과
  → 2초 카운트다운 후 POST /rides/start (Node) → ride_id 저장 → 모니터링 화면 자동 이동
  ↓
monitoring.tsx
  → SSE(/session/stream)로 실시간 얼굴점수/무게/가스/잠금상태 수신
  → 경고 사유 4종 대응: two_person / helmet_fail / drunk / face_fail
  → 반납 시: GET /session/summary → POST /session/end → PATCH /rides/:rideId/end
  ↓
return-complete.tsx
  → AsyncStorage의 session_summary(실제 데이터)로 요약 표시
  → 데이터 없으면 mock 표시 + 화면에 "예시 데이터" 경고
```

### AsyncStorage 키 정리

| 키                                        | 저장 시점            | 정리 시점                       |
| ----------------------------------------- | -------------------- | ------------------------------- |
| `token`, `user`                           | 로그인/회원가입 성공 | 로그아웃                        |
| `license_image_base64`, `license_ocr_raw` | 면허증 촬영 직후     | 회원가입 완료 후                |
| `pending_face_user_id`                    | 얼굴 등록 실패 시    | 얼굴 등록+로그인 성공 후        |
| `kickboard_id`                            | QR 스캔 성공 시      | 반납 완료 후                    |
| `face_vector`                             | 얼굴 인증 성공 시    | 반납 완료 후                    |
| `session_id`, `ride_id`                   | 라이딩 시작 성공 시  | 반납 완료 후                    |
| `session_summary`, `last_session_id`      | 반납 시              | 반납 완료 화면에서 읽은 후 정리 |

---

## 🧾 QR 코드 만들기 (테스트용)

**형식:** `safekickapp://ride?v=1&kickboard_id=KB-XXXXXXXX` (`KB-` + 대문자/숫자 8자리)

⚠️ **일부 QR 생성기(예: ME-QR 무료 플랜)는 "다이나믹 QR"이라, 원문 대신 자체 리다이렉트 링크(`https://...`)를 인코딩합니다.** 이러면 앱이 `safekickapp:` 프로토콜을 못 찾아 `Safe Kick 전용 QR 코드가 아닙니다` 에러가 나요.

**원문 그대로 인코딩되는 도구를 쓰세요:**

- goqr.me, qrcode-monkey.com 등 "Text/URL, Static" 타입
- 예: `https://api.qrserver.com/v1/create-qr-code/?data=safekickapp://ride?v=1&kickboard_id=KB-7F3A9C2D&size=300x300`

**만든 후 확인:** 폰 기본 카메라로 스캔했을 때 인식 결과가 `safekickapp://...` 그대로 뜨는지 확인하세요 (링크로 뜨면 다시 만들어야 함).

화면(모니터/슬랙 등)에 띄운 QR을 다시 촬영하는 방식은 모아레·반사光 때문에 인식률이 낮아요. 가능하면 QR을 폰에 저장하거나 인쇄해서 스캔하세요.

---

## 🔐 네트워크 연결이 안 될 때 (트러블슈팅)

폰에서 서버/라파에 연결이 안 되면 아래 순서로 확인하세요.

### 1. `localhost`를 쓰고 있지 않은지 확인

`localhost`는 항상 **요청을 보내는 기기 자신**을 가리켜요. 폰에서 PC 서버에 접속하려면 반드시 **PC의 실제 IP**를 써야 해요 (`.env`의 `EXPO_PUBLIC_API_BASE` 등).

```powershell
ipconfig    # Wi-Fi 어댑터의 IPv4 주소 확인
```

### 2. Windows 방화벽에서 포트 열기

기본적으로 Windows 방화벽이 외부 기기(폰)의 접속을 막아요. **관리자 권한 PowerShell**에서:

```powershell
New-NetFirewallRule -DisplayName "SafeKick-3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any
New-NetFirewallRule -DisplayName "SafeKick-8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -Profile Any
```

`-Profile Any`를 꼭 붙이세요 — 안 붙이면 지금 와이파이가 Public/Private 중 어느 프로필이냐에 따라 규칙이 안 먹힐 수 있어요.

### 3. AP 격리(Client Isolation) — 학교/기숙사 와이파이인 경우

일부 공용 와이파이는 보안 목적으로 **같은 네트워크에 붙은 기기끼리 서로 통신을 차단**해요. 방화벽을 다 열어도 안 되면 이게 원인일 가능성이 높고, 개인이 공유기 설정을 바꿀 수 없는 경우가 많아요.

**우회 방법 — Tailscale 사용:**

1. PC와 폰 모두에 [Tailscale](https://tailscale.com) 설치 및 같은 계정으로 로그인
2. 각 기기에 할당된 Tailscale IP(`100.x.x.x` 형태) 확인
3. `.env`의 IP를 **PC의 Tailscale IP**로 변경

## 🗄️ DB 직접 접속하기 (safe-kick-server)

```powershell
docker exec -it safe-kick-db psql -U user -d cutdb
```

```sql
\dt                      -- 테이블 목록
SELECT * FROM users;
SELECT * FROM licenses;
\d users                 -- 테이블 구조 확인
\q                       -- 나가기
```

GUI 툴(DBeaver, TablePlus, pgAdmin)로 접속 시:

| 필드     | 값          |
| -------- | ----------- |
| Host     | `localhost` |
| Port     | `5433`      |
| Database | `cutdb`     |
| Username | `user`      |
| Password | `1234`      |

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

카메라 권한 + 평문 HTTP 통신이 빌드에 포함되려면 `app.json`의 `plugins`에 아래 항목이 있어야 해요.

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
  ],
  [
    "expo-build-properties",
    {
      "android": { "usesCleartextTraffic": true }
    }
  ]
]
```

- `expo-build-properties`의 `usesCleartextTraffic: true`는 **꼭 필요**해요 — Android는 기본적으로 `http://`(비암호화) 요청을 차단하는데, 우리 서버들은 전부 사설 IP에 `http://`로 붙기 때문이에요. 이거 없으면 실기기에서 API 호출이 조용히 실패할 수 있어요.
- `@react-native-ml-kit/text-recognition`은 별도 config plugin 없이 autolinking으로 처리되지만, **네이티브 코드가 포함된 패키지라 반드시 EAS 재빌드가 필요**해요.

---

### Step 2 — EAS 빌드

> **Android Studio 불필요** — `eas build`는 Expo 클라우드 서버에서 빌드됩니다.
> `eas-cli`, `@expo/ngrok`은 Dockerfile에 이미 설치되어 있어서 컨테이너 안에서 바로 쓸 수 있어요.

이 프로젝트는 **`umjoo-cut` Organization 소유**로 되어 있어요 (`app.json`의 `owner`). 팀원이 처음 빌드하려면 `umjoo-cut` 관리자에게 [expo.dev](https://expo.dev) Members 초대를 요청하고, 본인 Expo 계정으로 로그인하세요.

```bash
# 컨테이너가 떠 있는 상태에서
docker-compose exec -it metro eas login       # 최초 1회, 본인 Expo 계정 로그인
docker-compose exec -it metro eas project:info  # umjoo-cut/safe-kick-app으로 뜨는지 확인

# Android APK 빌드 (5~20분 소요, 클라우드에서 진행)
docker-compose exec -it metro eas build --profile development --platform android
```

> **⚠️ 빌드 완료 후 "Install and run on an emulator?" 질문이 뜨면 반드시 `N`을 선택하세요.**
> `Y`를 선택하면 Android Studio가 없어서 `adb executable doesn't seem to work` 에러가 납니다.
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

| 변경 내용                                                                             | 재빌드 필요?                                 |
| ------------------------------------------------------------------------------------- | -------------------------------------------- |
| 화면(.tsx) 코드/스타일 수정                                                           | ❌ Metro가 떠 있으면 즉시 반영               |
| `.env` 값 변경                                                                        | ⚠️ 재빌드는 불필요하나 **Metro 재시작 필수** |
| 순수 JS 라이브러리 추가                                                               | ❌ 대부분 불필요                             |
| `app.json`의 `plugins` 추가/수정                                                      | ✅ 필요                                      |
| 네이티브 모듈이 포함된 패키지 신규 설치 (예: `@react-native-ml-kit/text-recognition`) | ✅ 필요                                      |

---

## 🔄 mock vs 서버 자동 전환

`src/utils/api.ts`가 처리해요. `.env`의 `EXPO_PUBLIC_USE_MOCK`으로 동작 방식이 갈려요.

- **`USE_MOCK=true` (개발 모드):** 서버 연결 실패 시 mock 데이터로 자동 대체. 단, 회원가입(`/auth/register`)과 로그인(`/auth/login`)은 **절대 mock으로 대체되지 않음** — 실제 서버 응답이 없으면 그대로 에러 처리
- **`USE_MOCK=false` (데모/실연동 모드):** mock 완전 비활성화, 모든 API가 실서버 응답만 사용

**`raspiApiCall()`(라즈베리파이)은 `USE_MOCK` 설정과 무관하게 항상 mock 폴백이 없어요** — 라파가 꺼져있으면 얼굴 검출/등록/인증은 그냥 실패합니다.

```
apiCall() 호출 (USE_MOCK=true인 경우)
  → /health 체크 (3초 타임아웃)
      ├── 서버 응답 있음 → 실제 서버 API 호출
      │     └── 호출 중 에러 → mock 자동 fallback (회원가입/로그인 제외)
      └── 서버 응답 없음 → mock 데이터 사용 (회원가입/로그인 제외)
```

콘솔에서 현재 모드 확인 가능:

```
[API] 서버 오프라인 → mock 사용: POST /auth/login
[API] 서버 응답: GET /rides/recent
```

---

## 🧪 테스트 계정 (mock 모드)

`USE_MOCK=true`이고 서버가 꺼져있을 때 아무 이메일/비밀번호나 입력해도 로그인돼요 (단, 회원가입/로그인 자체는 mock 대상에서 제외되어 있으니 실제로는 서버가 필요합니다 — 그 외 화면의 mock 데이터 확인용).

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

**데모/배포 전에는 반드시 `false`로 되돌려야 합니다.** `true`인 채로 배포하면 앱을 켤 때마다 로그인이 풀려버려요.

---

## 👥 팀 구성

| 이름           | 역할                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| 최세은 (SEIN)  | 앱 프론트엔드 (React Native)                                            |
| 정재영         | 앱 백엔드 서버 (Node.js + PostgreSQL) + 라즈베리파이 얼굴인증/세션 서버 |
| 박종빈         | 하드웨어 / 펌웨어 (Raspberry Pi + STM32)                                |
| 정재영, 최세은 | AI 인증 시스템 (YOLO + InsightFace)                                     |

---

## 🔗 관련 레포

| 레포                                                              | 설명                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| [safe-kick-app](https://github.com/safe-kick/safe-kick-app)       | 앱 프론트엔드 (현재)                                         |
| [safe-kick-server](https://github.com/safe-kick/safe-kick-server) | 앱 백엔드 서버 (Node.js, 회원/운행기록)                      |
| [safe-kick-raspi](https://github.com/safe-kick/safe-kick-raspi)   | 라즈베리파이 AI 서버 (얼굴검출/인증, 세션/잠금제어, FastAPI) |
| [safe-kick-stm32](https://github.com/safe-kick/safe-kick-stm32)   | STM32 펌웨어                                                 |
