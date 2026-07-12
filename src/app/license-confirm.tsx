import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
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

export default function LicenseConfirmScreen() {
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(true);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const { name, email, password } = useLocalSearchParams<{
    name: string;
    email: string;
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

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const licenseImage =
        (await AsyncStorage.getItem("license_image_base64")) ||
        "mock_license_image";

      // 1. 계정 생성 (Node 앱서버) — name/email/password + 면허 텍스트 정보
      const registerRes = await apiCall("POST", "/auth/register", {
        name,
        email,
        password,
        license_no: fields.licenseNo || "미인식",
        license_expires_at: toIsoDate(fields.expiresAt) || "2030-01-01",
        license_image: licenseImage,
      });

      if (registerRes?.data?.token) {
        await AsyncStorage.setItem("token", registerRes.data.token);
      }

      // 2. 발급된 user_id로 라즈베리파이에 얼굴(면허증 사진) 등록
      const userId = registerRes?.data?.user_id;
      if (userId) {
        try {
          await raspiApiCall("POST", "/face/register", {
            user_id: userId,
            image: licenseImage,
          });
        } catch (faceError) {
          // 계정 생성은 성공했으니 얼굴 등록 실패해도 회원가입 자체는 진행
          // (추후 마이페이지 등에서 재등록 유도 필요)
          console.log("얼굴 등록 실패:", faceError);
        }
      }

      // 더 이상 필요 없는 임시 저장값 정리
      await AsyncStorage.removeItem("license_image_base64");
      await AsyncStorage.removeItem("license_ocr_raw");

      router.replace("/login");
    } catch (e) {
      console.log(e);
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
