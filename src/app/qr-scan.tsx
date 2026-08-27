import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { T } from "../constants/colors";
import { apiCall, raspiApiCall } from "../utils/api";

// QR 형식: safekickapp://ride?v=1&kickboard_id=KB-XXXXXXXX

type ParsedKickboardQr = { version: string; kickboardId: string };

function parseKickboardQr(scannedData: string): ParsedKickboardQr {
  let url: URL;
  try {
    url = new URL(scannedData);
  } catch {
    throw new Error("올바른 Safe Kick QR 코드가 아닙니다.");
  }

  if (url.protocol !== "safekickapp:") {
    throw new Error("Safe Kick 전용 QR 코드가 아닙니다.");
  }
  if (url.hostname !== "ride") {
    throw new Error("운행용 QR 코드가 아닙니다.");
  }

  const version = url.searchParams.get("v");
  const kickboardId = url.searchParams.get("kickboard_id");

  if (version !== "1") {
    throw new Error("지원하지 않는 QR 코드 버전입니다.");
  }
  if (!kickboardId) {
    throw new Error("QR 코드에 킥보드 정보가 없습니다.");
  }
  if (!/^KB-[A-Z0-9]{8}$/.test(kickboardId)) {
    throw new Error("킥보드 ID 형식이 올바르지 않습니다.");
  }

  return { version, kickboardId };
}

// 테스트용 mock QR (실제 형식과 동일)
const MOCK_QR_DATA = "safekickapp://ride?v=1&kickboard_id=KB-7F3A9C2D";

function QRCorners({ size = 220 }: { size?: number }) {
  const cs = 28,
    sw = 3,
    c = "#FFF";
  return (
    <View
      style={{
        width: size,
        height: size,
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {[
        { top: 0, left: 0 },
        { top: 0, right: 0 },
        { bottom: 0, left: 0 },
        { bottom: 0, right: 0 },
      ].map((pos, i) => (
        <View
          key={i}
          style={{ position: "absolute", ...pos, width: cs, height: cs }}
        >
          <View
            style={{
              position: "absolute",
              ...(pos.hasOwnProperty("top") ? { top: 0 } : { bottom: 0 }),
              ...(pos.hasOwnProperty("left") ? { left: 0 } : { right: 0 }),
              width: sw,
              height: cs,
              backgroundColor: c,
              borderRadius: 2,
            }}
          />
          <View
            style={{
              position: "absolute",
              ...(pos.hasOwnProperty("top") ? { top: 0 } : { bottom: 0 }),
              ...(pos.hasOwnProperty("left") ? { left: 0 } : { right: 0 }),
              width: cs,
              height: sw,
              backgroundColor: c,
              borderRadius: 2,
            }}
          />
        </View>
      ))}
    </View>
  );
}

export default function QRScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (Platform.OS !== "web" && !permission?.granted) {
      requestPermission();
    }
  }, []);

  // QR에서 읽은 킥보드 ID로 라즈베리파이 연결 확인 (GET /status)
  // QR 스캔 직후에는 /rides/start를 호출하지 않음 — kickboard_id만 저장
  const connectKickboard = async (kickboardId: string) => {
    setScanning(true);
    setError("");
    try {
      const kickboardRes = await apiCall("GET", `/kickboards/${encodeURIComponent(kickboardId)}`);
      if (!kickboardRes?.data?.available) {
        throw new Error("현재 다른 사용자가 이용 중인 스쿠터입니다.");
      }

      let res: any;
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          res = await raspiApiCall("GET", "/status");
          break;
        } catch (requestError) {
          lastError = requestError;
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 700));
        }
      }
      if (!res) throw lastError ?? new Error("Raspberry Pi 응답이 없습니다.");
      if (res.status !== "success") throw new Error(res.message || "스쿠터 연결에 실패했습니다.");
      if (res.data?.session_active) {
        const cleanupRes = await raspiApiCall("POST", "/session/end");
        const cleanupSucceeded = cleanupRes?.status === "success"
          || /활성화된 세션이 없습니다/.test(cleanupRes?.message ?? "");
        if (!cleanupSucceeded) throw new Error(cleanupRes?.message || "이전 세션을 정리하지 못했습니다.");
      }

      await AsyncStorage.setItem("kickboard_id", kickboardId);
      await AsyncStorage.multiRemove([
        "session_id",
        "face_verified",
        "helmet_verified",
        "face_score",
        "helmet_score",
      ]);
      router.push("/selfie");
    } catch (e) {
      console.log("[QR] 연결 실패:", e);
      setScanned(false);
      setScanning(false);
      const detail = e instanceof Error ? e.message : String(e);
      setError(
        /다른 사용자가 이용 중/.test(detail)
          ? detail
          : "Raspberry Pi 연결 응답이 없습니다. 네트워크를 확인하고 다시 시도해주세요.",
      );
    }
  };

  // 실기기 — expo-camera가 QR을 인식하면 자동 호출
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || scanning) return;
    setScanned(true);
    try {
      const { kickboardId } = parseKickboardQr(data);
      connectKickboard(kickboardId);
    } catch (e) {
      setScanned(false);
      setError(e instanceof Error ? e.message : "인식할 수 없는 QR코드입니다.");
    }
  };

  // 웹 / 카메라 권한 미허용 환경 — mock QR 데이터로 동일 흐름 진행
  const handleMockScan = () => {
    if (scanned || scanning) return;
    setScanned(true);
    try {
      const { kickboardId } = parseKickboardQr(MOCK_QR_DATA);
      connectKickboard(kickboardId);
    } catch (e) {
      setScanned(false);
      setError(
        e instanceof Error ? e.message : "QR 코드를 확인하지 못했습니다.",
      );
    }
  };

  const handleCancel = () => {
    if (scanning) {
      setScanning(false);
      setScanned(false);
    } else {
      router.back();
    }
  };

  const showCamera = Platform.OS !== "web" && permission?.granted;
  const showMockBtn =
    (Platform.OS === "web" || !permission?.granted) && !scanning;

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>QR 스캔</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.cameraArea}>
        {showCamera && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          />
        )}
        <View style={s.overlay} />
        <View style={s.scanArea}>
          <View
            style={{
              position: "relative",
              width: 220,
              height: 220,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <QRCorners size={220} />
            {scanning ? (
              <ActivityIndicator
                size="large"
                color="#FFF"
                style={{ position: "absolute" }}
              />
            ) : (
              <Text style={s.qrIcon}>⬛</Text>
            )}
            <View style={s.scanLine} />
          </View>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={s.scanTitle}>
              {scanning ? "스쿠터에 연결 중..." : "스쿠터 QR코드를 스캔하세요"}
            </Text>
            <Text style={s.scanSub}>
              {scanning
                ? "잠시만 기다려주세요"
                : Platform.OS !== "web" && !permission?.granted
                  ? "카메라 권한이 필요합니다"
                  : "카메라가 자동으로 인식합니다"}
            </Text>
            {!!error && <Text style={s.errorText}>{error}</Text>}
          </View>
        </View>
      </View>

      <View style={s.bottom}>
        <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
          <Text style={s.cancelBtnText}>{scanning ? "스캔 중단" : "취소"}</Text>
        </TouchableOpacity>

        {Platform.OS !== "web" && !permission?.granted && !scanning && (
          <TouchableOpacity style={s.mockBtn} onPress={requestPermission}>
            <Text style={s.mockBtnText}>카메라 권한 허용</Text>
          </TouchableOpacity>
        )}

        {showMockBtn && (
          <TouchableOpacity style={s.mockBtn} onPress={handleMockScan}>
            <Text style={s.mockBtnText}>📷 QR 스캔 (mock)</Text>
          </TouchableOpacity>
        )}

        <Text style={s.manualLink}>
          QR이 안 되나요?{" "}
          <Text style={{ textDecorationLine: "underline" }}>
            코드 직접 입력
          </Text>
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 16,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: 22, color: "#FFF", lineHeight: 28 },
  topTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
    textAlign: "center",
  },
  cameraArea: {
    flex: 1,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  scanArea: { zIndex: 1, alignItems: "center", gap: 20 },
  qrIcon: { position: "absolute", fontSize: 56, opacity: 0.2 },
  scanLine: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255,220,0,0.8)",
  },
  scanTitle: { fontSize: 16, color: "#FFF", fontWeight: "600" },
  scanSub: { fontSize: 13, color: "rgba(255,255,255,0.5)" },
  errorText: { fontSize: 12, color: "#FF6B6B", marginTop: 4 },
  bottom: { padding: 24, paddingBottom: 32, backgroundColor: "#111", gap: 10 },
  cancelBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  mockBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: T.text,
    alignItems: "center",
    justifyContent: "center",
  },
  mockBtnText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  manualLink: {
    textAlign: "center",
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
  },
});
