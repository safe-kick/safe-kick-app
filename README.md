# 📱 safe-kick-app
Safe Kick - React Native 모바일 앱

## 📁 폴더 구조

```
safe-kick-app/
│
├── app/                        # Expo Router 기반 화면
│   ├── (auth)/                 # 인증 관련 화면
│   │   ├── login.tsx           # 로그인
│   │   ├── register.tsx        # 회원가입
│   │   └── license.tsx         # 면허증 촬영 및 확인
│   ├── (main)/                 # 메인 화면
│   │   ├── index.tsx           # 메인 홈
│   │   ├── qr-scan.tsx         # QR 스캔
│   │   ├── selfie.tsx          # 셀피 촬영
│   │   ├── safety-check.tsx    # 안전 점검
│   │   ├── monitoring.tsx      # 라이딩 중 모니터링
│   │   ├── return.tsx          # 반납 완료
│   │   └── mypage.tsx          # 마이페이지
│   └── _layout.tsx
│
├── components/                 # 공통 컴포넌트
├── hooks/                      # 커스텀 훅
├── constants/                  # 색상, 설정값 등
├── assets/                     # 이미지, 폰트
│
├── app.json
├── package.json
└── README.md
```
