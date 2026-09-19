// app/friends/scan.tsx
// 掃描對方的好友 QR Code 並送出好友邀請（見 plan-friends.md）。
// expo-camera 是原生模組，Expo Go 無法測試，必須用 EAS Development Build。
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { api } from '../../services/api';
import { sendFriendRequest } from '../../services/friends';
import { parseFriendQrValue } from '../../types/friends';

export default function FriendScanScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();

  const { data: me } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => (await api.get('/api/v1/users/me')).data,
  });

  // onBarcodeScanned 在同一個 QR 還在畫面內時會連續觸發，用 ref 鎖住直到使用者關掉提示，
  // 避免同一個碼重複送出請求
  const isHandlingRef = useRef(false);

  const showResult = (title: string, message: string, onDismiss?: () => void) => {
    Alert.alert(title, message, [
      {
        text: '確定',
        onPress: () => {
          isHandlingRef.current = false;
          onDismiss?.();
        },
      },
    ], {
      cancelable: false,
    });
  };

  const handleScanned = async ({ data }: { data: string }) => {
    if (isHandlingRef.current) return;
    isHandlingRef.current = true;

    const targetUserId = parseFriendQrValue(data);
    if (targetUserId === null) {
      showResult('無法辨識', '這不是好友 QR Code，請掃描對方「好友 QR Code」畫面');
      return;
    }
    // 自己的 QR Code 不送出請求（後端也會擋，這裡先擋掉省一次來回）
    if (me?.id === targetUserId) {
      showResult('不能加自己好友', '這是您自己的 QR Code');
      return;
    }

    try {
      await sendFriendRequest(targetUserId);
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      showResult('已送出邀請', '對方確認後就會成為好友', () => router.back());
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      // 已是好友是物件型 detail（帶 error_code），其餘錯誤沿用純文字 detail 或通用訊息
      const message =
        detail?.error_code === 'already_friends'
          ? '你們已經是好友了'
          : (typeof detail === 'string' ? detail : detail?.message) || '送出好友邀請失敗，請稍後再試';
      showResult('無法送出邀請', message);
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>需要相機權限</Text>
        <Text style={styles.subtitle}>掃描好友 QR Code 需要使用相機</Text>
        {permission.canAskAgain ? (
          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>允許使用相機</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.subtitle}>相機權限已被拒絕，請到系統設定中開啟</Text>
            <Pressable style={styles.button} onPress={() => Linking.openSettings()}>
              <Text style={styles.buttonText}>開啟設定</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScanned}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.hint}>將對方的好友 QR Code 對準框內</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textSubtle, marginTop: 6, marginBottom: 24, textAlign: 'center' },
  button: {
    backgroundColor: colors.tint, paddingVertical: 14, paddingHorizontal: 36,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },
  // 相機預覽疊在畫面上，取景框與提示文字固定白色，不隨主題變化
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  frame: { width: 240, height: 240, borderRadius: 16, borderWidth: 3, borderColor: '#fff' },
  hint: {
    marginTop: 20, color: '#fff', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, overflow: 'hidden',
  },
});
