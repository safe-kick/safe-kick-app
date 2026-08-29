import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { TopBar, WFCard } from "../components/ui";
import { T } from "../constants/colors";
import { apiCall, raspiApiCall } from "../utils/api";
import { parseLicenseText, toIsoDate } from "../utils/licenseOcr";

// OCR 인식 실패 시(웹/권한 미허용 등) 사용할 기본값 — 수동 입력을 위한 빈 틀
const EMPTY_FIELDS = {
  name: "",
  birth: "",
  licenseNo: "",
  licenseType: "",
  issuedAt: "",
  expiresAt: "",
};

type FaceDetectResponse = {
  status: "success" | "error";
  data: {
    detected: boolean;
    reason: "success" | "face_not_detected" | "invalid_image" | string;
  };
  message: string;
};

type FaceRegisterResponse = {
  status: "success" | "error";
  data: {
    registered: boolean;
    user_id: number;
    reason: "success" | "face_not_detected" | "invalid_image" | string;
  };
  message: string;
};

// Alert.alert()는 웹(react-native-web)에서 UI를 그리지 않아 onPress가 영원히 호출되지 않음
// → 플랫폼별로 분기해서 웹에서는 콘솔 경고 후 즉시 콜백 실행
function crossPlatformAlert(
  title: string,
  message: string,
  buttonText: string,
  onPress: () => void,
) {
  if (Platform.OS === "web") {
    console.warn(`[${title}] ${message}`);
    onPress();
  } else {
    Alert.alert(title, message, [{ text: buttonText, onPress }], {
      cancelable: false,
    });
  }
}

export default function LicenseConfirmScreen() {
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(true);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const { name, email, phone, password } = useLocalSearchParams<{
    name: string;
    email: string;
    phone: string;
    password: string;
  }>();

  // 화면 진입 시 저장된 OCR 원문을 읽어 파싱, 입력창에 채워줌
  useEffect(() => {
    (async () => {
      try {
        const savedImage = await AsyncStorage.getItem("license_image_base64");
        if (savedImage) {
          setImageBase64(savedImage);
        }

        const raw = await AsyncStorage.getItem("license_ocr_raw");
        if (raw) {
          const parsed = parseLicenseText(raw);
          setFields({
            name: parsed.name,
            birth: parsed.birth,
            licenseNo: parsed.licenseNo,
            licenseType: parsed.licenseType,
            issuedAt: parsed.issuedAt,
            expiresAt: parsed.expiresAt,
          });
        }
        // raw가 없으면 (웹/권한없음/OCR실패) EMPTY_FIELDS 유지 → 사용자가 직접 입력
      } catch (e) {
        console.log("OCR 결과 로드 실패:", e);
      } finally {
        setOcrLoading(false);
      }
    })();
  }, []);

  const updateField = (key: keyof typeof fields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  // 재촬영 화면으로 이동 — name/email/password를 반드시 같이 실어 보냄
  // (안 실으면 license-capture → license-confirm으로 다시 왔을 때 값이 사라짐)
  const goRetakePhoto = () => {
    router.replace({
      pathname: "/license-capture",
      params: { name, email, phone, password },
    });
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // AsyncStorage 키는 license-capture.tsx가 저장하는 키와 반드시 일치해야 함
      const licenseImage = await AsyncStorage.getItem("license_image_base64");

      if (!licenseImage) {
        crossPlatformAlert(
          "면허증 사진 없음",
          "면허증 사진을 다시 촬영해주세요.",
          "다시 촬영",
          goRetakePhoto,
        );
        return;
      }

      // 1. 회원가입 전에 면허증 얼굴 검출 (user_id 없이, 저장 없이 검사만)
      let detectRes: FaceDetectResponse;
      try {
        detectRes = await raspiApiCall<FaceDetectResponse>(
          "POST",
          "/face/detect",
          { image: licenseImage },
        );
      } catch (error) {
        console.log("[FACE] 얼굴 검출 API 통신 실패:", error);
        crossPlatformAlert(
          "얼굴 인식 서버 연결 실패",
          "얼굴 인식 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
          "확인",
          () => {},
        );
        return;
      }

      // 2. 얼굴 검출 실패 시 재촬영 (회원가입 자체를 호출하지 않음)
      if (!detectRes.data.detected) {
        const message =
          detectRes.data.reason === "invalid_image"
            ? "촬영한 면허증 이미지를 처리하지 못했습니다. 다시 촬영해주세요."
            : "면허증에서 얼굴을 찾지 못했습니다. 다시 촬영해주세요.";

        crossPlatformAlert(
          "면허증 얼굴 검출 실패",
          message,
          "다시 촬영",
          goRetakePhoto,
        );
        return;
      }

      // 3. 얼굴 검출 성공 후에만 회원가입 (재시도 시 기존 user_id 재사용)
      const pendingUserId = await AsyncStorage.getItem("pending_face_user_id");

      let userId: number;

      if (pendingUserId) {
        userId = Number(pendingUserId);
      } else {
        const registerRes = await apiCall("POST", "/auth/register", {
          name,
          email,
          phone,
          password,
          license_no: fields.licenseNo || "미인식",
          license_expires_at: toIsoDate(fields.expiresAt) || "2030-01-01",
        });

        const newUserId = registerRes?.data?.user_id;
        if (!newUserId) {
          throw new Error("회원가입 응답에 user_id가 없습니다.");
        }
        userId = newUserId;
      }

      // 4. 발급된 user_id로 얼굴 임베딩 저장
      let faceRes: FaceRegisterResponse;
      try {
        faceRes = await raspiApiCall<FaceRegisterResponse>(
          "POST",
          "/face/register",
          { user_id: userId, image: licenseImage },
        );
      } catch (error) {
        console.log("[FACE] 얼굴 등록 API 통신 실패:", error);
        await AsyncStorage.setItem("pending_face_user_id", String(userId));
        crossPlatformAlert(
          "얼굴 정보 저장 실패",
          "회원가입은 완료됐지만 얼굴 정보를 저장하지 못했습니다. 다시 시도해주세요.",
          "확인",
          () => {},
        );
        return;
      }

      // 5. 얼굴 임베딩 저장 결과 확인
      if (!faceRes.data.registered) {
        await AsyncStorage.setItem("pending_face_user_id", String(userId));

        const message =
          faceRes.data.reason === "face_not_detected"
            ? "면허증 얼굴을 다시 처리하지 못했습니다. 면허증을 다시 촬영해주세요."
            : "얼굴 정보 저장에 실패했습니다. 다시 시도해주세요.";

        crossPlatformAlert(
          "얼굴 등록 실패",
          message,
          "다시 촬영",
          goRetakePhoto,
        );
        return;
      }

      // 6. 얼굴 저장 성공 후에만 로그인 (실패 대비, pending_face_user_id는 로그인 성공 후에만 제거)
      const loginRes = await apiCall("POST", "/auth/login", {
        email,
        password,
      });

      const token = loginRes?.data?.token;
      if (!token || token === "mock.jwt.token") {
        throw new Error("실제 로그인 토큰을 받지 못했습니다.");
      }

      await AsyncStorage.setItem("token", token);
      if (loginRes?.data?.user) {
        await AsyncStorage.setItem("user", JSON.stringify(loginRes.data.user));
      }

      // 로그인까지 전부 성공한 뒤에만 재시도용 임시값 정리
      await AsyncStorage.removeItem("pending_face_user_id");
      await AsyncStorage.removeItem("license_image_base64");
      await AsyncStorage.removeItem("license_ocr_raw");

      router.replace("/main");
    } catch (e) {
      console.log("[REGISTER] 회원가입 처리 실패:", e);
      crossPlatformAlert(
        "회원가입 실패",
        e instanceof Error ? e.message : "회원가입 중 오류가 발생했습니다.",
        "확인",
        () => {},
      );
    } finally {
      setLoading(false);
    }
  };

  const FIELD_ROWS: {
    key: keyof typeof fields;
    label: string;
    placeholder: string;
  }[] = [
    { key: "name", label: "이름", placeholder: "직접 입력" },
    { key: "birth", label: "생년월일", placeholder: "YYMMDD" },
    { key: "licenseNo", label: "면허번호", placeholder: "12-34-567890-01" },
    { key: "licenseType", label: "면허종별", placeholder: "예: 2종보통" },
    { key: "issuedAt", label: "발급일", placeholder: "YYYY.MM.DD" },
    { key: "expiresAt", label: "만료일", placeholder: "YYYY.MM.DD" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <TopBar title="면허증 정보 확인" back onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.content}>
        {/* 이미지 미리보기 */}
        {imageBase64 ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${imageBase64}` }}
            style={s.imgBox}
            resizeMode="cover"
          />
        ) : (
          <View style={s.imgBox}>
            <Text style={s.imgLabel}>면허증 이미지 미리보기</Text>
          </View>
        )}

        {/* OCR 결과 (수정 가능) */}
        <WFCard>
          <Text style={s.cardLabel}>
            {ocrLoading
              ? "OCR 인식 결과 불러오는 중..."
              : "OCR 인식 결과 (틀린 부분은 직접 수정하세요)"}
          </Text>
          {FIELD_ROWS.map(({ key, label, placeholder }, i) => (
            <View
              key={key}
              style={[
                s.row,
                i === FIELD_ROWS.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={s.rowKey}>{label}</Text>
              <TextInput
                style={s.rowInput}
                value={fields[key]}
                onChangeText={(v) => updateField(key, v)}
                placeholder={placeholder}
                placeholderTextColor={T.textMuted}
              />
            </View>
          ))}
        </WFCard>

        {/* 경고 안내 */}
        <View style={s.warnBox}>
          <Text style={s.warnIcon}>ℹ</Text>
          <Text style={s.warnText}>
            OCR은 인식 오류가 있을 수 있습니다. 정보가 정확한지 확인하고, 틀린
            부분은 직접 수정하세요. 잘못된 정보는 인증 실패로 이어질 수
            있습니다.
          </Text>
        </View>

        {/* 버튼 */}
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btn, s.btnGhost]}
            onPress={() => router.back()}
          >
            <Text style={s.btnGhostText}>다시 찍기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.btnPrimary, { flex: 2 }, loading && s.btnDisabled]}
            onPress={handleConfirm}
            disabled={loading}
          >
            <Text style={s.btnPrimaryText}>
              {loading ? "저장 중..." : "정보 확인 완료"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  imgBox: {
    height: 150,
    backgroundColor: T.fill,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  imgLabel: { fontSize: 10, color: T.textMuted },
  cardLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: T.textSub,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  rowKey: { width: 76, fontSize: 12, color: T.textMuted },
  rowInput: {
    flex: 1,
    fontSize: 13,
    color: T.text,
    fontWeight: "500",
    paddingVertical: 4,
  },
  warnBox: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: T.warnBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(230,81,0,0.2)",
  },
  warnIcon: { fontSize: 14, color: T.warn },
  warnText: { flex: 1, fontSize: 12, color: T.warn, lineHeight: 18 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: T.text },
  btnGhost: { borderWidth: 1.5, borderColor: T.border },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  btnGhostText: { color: T.text, fontSize: 14, fontWeight: "600" },
});
