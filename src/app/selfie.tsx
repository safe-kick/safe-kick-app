import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { USE_MOCK } from "../constants/api";
import { raspiApiCall } from "../utils/api";

// About every 7 camera frames at 30 fps.
const VERIFY_INTERVAL_MS = 233;
type VerificationState = boolean | null;
type BaselineState = "ready" | "measuring" | "failed";

interface LiveVerifyResponse {
  status: string;
  data: {
    verified: boolean;
    face_verified: boolean;
    face_score?: number;
    helmet_verified: boolean;
    helmet_score?: number;
  };
}

const statusLabel = (type: "face" | "helmet", value: VerificationState) => {
  if (value === null) return "검사 중...";
  if (type === "face") return value ? "얼굴 인증 성공" : "얼굴 인증 실패";
  return value ? "헬멧 착용 확인" : "헬멧 착용 확인 불가";
};

const statusColor = (value: VerificationState) => {
  if (value === null) return "rgba(255,255,255,0.8)";
  return value ? "#4ADE80" : "#FF5B5B";
};

const isConnectionError = (error: unknown) => {
  if (error instanceof TypeError) return true;
  if (!(error instanceof Error)) return false;
  return (
    error.name === "TimeoutError" ||
    /network request failed|fetch failed|failed to connect|timed?\s*out/i.test(error.message)
  );
};

export default function SelfieScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const [faceVerified, setFaceVerified] = useState<VerificationState>(null);
  const [helmetVerified, setHelmetVerified] = useState<VerificationState>(null);
  const [faceScore, setFaceScore] = useState<number>();
  const [helmetScore, setHelmetScore] = useState<number>();
  const [baselineStatus, setBaselineStatus] = useState<BaselineState>("measuring");
  const [message, setMessage] = useState("카메라를 준비하고 있습니다.");
  const cameraRef = useRef<CameraView>(null);
  const mountedRef = useRef(true);
  const processingRef = useRef(false);
  const completedRef = useRef(false);
  const userIdRef = useRef<number | undefined>(undefined);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      completedRef.current = true;
      requestControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" && permission && !permission.granted) requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    let cancelled = false;
    const prepareSession = async () => {
      try {
        const [userJson, kickboardId] = await Promise.all([
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("kickboard_id"),
        ]);
        const user = userJson ? JSON.parse(userJson) : null;
        if (!user?.id) throw new Error("로그인 정보를 확인할 수 없습니다.");
        if (!kickboardId) {
          Alert.alert("킥보드 정보 없음", "QR 코드를 먼저 스캔해주세요.", [
            { text: "확인", onPress: () => router.replace("/qr-scan") },
          ]);
          return;
        }

        let sessionId = await AsyncStorage.getItem("session_id");
        if (!sessionId) {
          const res = await raspiApiCall("POST", "/session/start", {
            user_id: user.id,
            kickboard_id: kickboardId,
          });
          if (!res?.data?.session_id) throw new Error("안전 점검 세션을 생성하지 못했습니다.");
          sessionId = String(res.data.session_id);
          await AsyncStorage.setItem("session_id", sessionId);
        }

        if (!cancelled && mountedRef.current) {
          userIdRef.current = Number(user.id);
          setSessionReady(true);
          setMessage("얼굴을 정면으로 보고 헬멧을 착용해주세요.");
          setBaselineStatus("measuring");
          void raspiApiCall("POST", "/session/mq3-baseline", {
            user_id: Number(user.id),
          }).then(response => {
            if (!mountedRef.current) return;
            setBaselineStatus(
              response?.data?.baseline_status === "ready" ? "ready" : "measuring",
            );
          }).catch(error => {
            console.log("[BASELINE] 기준값 측정 시작 실패:", error);
            if (mountedRef.current) setBaselineStatus("failed");
          });
        }
      } catch (error) {
        console.log("[LIVE VERIFY] 세션 준비 실패:", error);
        if (!cancelled && mountedRef.current) setMessage("세션 연결에 실패했습니다. 다시 진입해주세요.");
      }
    };
    void prepareSession();
    return () => { cancelled = true; };
  }, []);

  const verifyCurrentFrame = useCallback(async () => {
    if (processingRef.current || completedRef.current || !mountedRef.current || !sessionReady || !userIdRef.current) return;

    const canUseCamera = Platform.OS !== "web" && permission?.granted && cameraReady && cameraRef.current;
    const canUseMock = Platform.OS === "web" && USE_MOCK;
    if (!canUseCamera && !canUseMock) return;

    processingRef.current = true;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      const photo = canUseCamera
        ? await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.35, exif: false, shutterSound: false })
        : undefined;
      const base64 = photo?.base64 ?? (canUseMock ? "mock_base64_image" : undefined);
      if (!base64) throw new Error("카메라 이미지를 가져오지 못했습니다.");
      if (!mountedRef.current || completedRef.current) return;

      const response = await raspiApiCall<LiveVerifyResponse>(
        "POST",
        "/face/live-verify",
        { user_id: userIdRef.current, image: base64 },
        controller.signal,
      );
      if (!mountedRef.current || completedRef.current) return;
      const data = response?.data;
      if (!data) throw new Error("인증 응답 형식이 올바르지 않습니다.");

      setFaceVerified(data.face_verified === true);
      setHelmetVerified(data.helmet_verified === true);
      setFaceScore(data.face_score);
      setHelmetScore(data.helmet_score);
      setMessage("");
      const passed = data.verified === true && data.face_verified === true && data.helmet_verified === true;

      if (passed) {
        completedRef.current = true;
        await AsyncStorage.multiSet([
          ["face_verified", "true"], ["helmet_verified", "true"],
          ["face_score", String(data.face_score ?? "")], ["helmet_score", String(data.helmet_score ?? "")],
        ]);
        if (mountedRef.current) {
          setMessage("얼굴과 헬멧 인증이 완료되었습니다.");
          setSuccess(true);
          router.replace("/safety-check");
        }
      }
    } catch (error) {
      if (!controller.signal.aborted && mountedRef.current && !completedRef.current) {
        console.log("[LIVE VERIFY] 자동 인증 실패:", error);
        setMessage(
          isConnectionError(error)
            ? "인증 서버 연결이 불안정합니다. 자동으로 다시 시도합니다."
            : "인증 처리 중 오류가 발생했습니다. 자동으로 다시 시도합니다.",
        );
      }
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      processingRef.current = false;
    }
  }, [cameraReady, permission?.granted, sessionReady]);

  useEffect(() => {
    if (!sessionReady || success) return;
    const timer = setInterval(() => { void verifyCurrentFrame(); }, VERIFY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [sessionReady, success, verifyCurrentFrame]);

  const showCamera = Platform.OS !== "web" && permission?.granted;
  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}><Text style={s.backIcon}>‹</Text></TouchableOpacity>
        <Text style={s.topTitle}>본인 인증</Text><View style={{ width: 36 }} />
      </View>
      <View style={s.cameraArea}>
        {showCamera && <CameraView
          ref={cameraRef} active={!success} animateShutter={false} facing="front"
          onCameraReady={() => setCameraReady(true)}
          onMountError={({ message: errorMessage }) => {
            setCameraReady(false);
            setMessage(`카메라를 시작하지 못했습니다: ${errorMessage}`);
          }}
          style={StyleSheet.absoluteFill}
        />}
        <View style={s.faceOval}>{!showCamera && <Text style={s.faceIcon}>👤</Text>}<View style={s.greenScan} /></View>
        <View style={s.statusPanel}>
          <View style={s.statusRow}><Text style={s.statusTitle}>얼굴 인증</Text><Text style={[s.statusValue, { color: statusColor(faceVerified) }]}>{statusLabel("face", faceVerified)}</Text></View>
          {faceScore !== undefined && <Text style={s.score}>score {faceScore.toFixed(3)}</Text>}
          <View style={s.statusRow}><Text style={s.statusTitle}>헬멧 착용</Text><Text style={[s.statusValue, { color: statusColor(helmetVerified) }]}>{statusLabel("helmet", helmetVerified)}</Text></View>
          {helmetScore !== undefined && <Text style={s.score}>score {helmetScore.toFixed(3)}</Text>}
          <View style={s.statusRow}><Text style={s.statusTitle}>센서 기준값</Text><Text style={[s.statusValue, { color: baselineStatus === "failed" ? "#FF5B5B" : baselineStatus === "ready" ? "#4ADE80" : "rgba(255,255,255,0.8)" }]}>{baselineStatus === "ready" ? "측정 완료" : baselineStatus === "failed" ? "측정 실패" : "측정 중..."}</Text></View>
        </View>
        <Text style={s.faceSub} accessibilityLiveRegion="polite">{message}</Text>
      </View>
      <View style={s.bottom}>
        <View style={s.privacyBox}><Text style={s.privacyText}>🔒 촬영 이미지는 실시간 인증에만 사용되며 앱에 저장되지 않습니다.</Text></View>
        {Platform.OS !== "web" && !permission?.granted && <TouchableOpacity style={s.permissionBtn} onPress={requestPermission}><Text style={s.permissionBtnText}>카메라 권한 허용</Text></TouchableOpacity>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0D0D0D" },
  topBar: { flexDirection: "row", alignItems: "center", height: 52, paddingHorizontal: 16, gap: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 22, color: "#FFF", lineHeight: 28 },
  topTitle: { flex: 1, fontSize: 16, fontWeight: "600", color: "#FFF", textAlign: "center" },
  cameraArea: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 24 },
  faceOval: { width: 200, height: 260, borderRadius: 100, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  faceIcon: { fontSize: 80, opacity: 0.18 },
  greenScan: { position: "absolute", left: 0, right: 0, top: "45%", height: 2, backgroundColor: "rgba(0,220,100,0.8)" },
  statusPanel: { width: "100%", maxWidth: 320, padding: 14, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.62)", gap: 5 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusTitle: { color: "#FFF", fontSize: 14, fontWeight: "600" }, statusValue: { color: "#FFF", fontSize: 13 },
  score: { color: "rgba(255,255,255,0.45)", fontSize: 10, textAlign: "right", marginBottom: 3 },
  faceSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", textAlign: "center", minHeight: 20 },
  bottom: { backgroundColor: "#111", padding: 24, paddingBottom: 20, gap: 14, alignItems: "center" },
  privacyBox: { width: "100%", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 12 },
  privacyText: { fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 18 },
  permissionBtn: { paddingHorizontal: 18, height: 42, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", alignItems: "center", justifyContent: "center" },
  permissionBtnText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
});
