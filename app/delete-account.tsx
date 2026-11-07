// app/delete-account.tsx
// 刪除帳號畫面（見 plan-delete-account.md）。Google Play／App Store 規定有註冊功能的 App
// 必須能在 App 內自行刪除帳號。從 settings.tsx 的「帳號管理」最下方進來，掛在 app/_layout.tsx
// 的 userToken 分支（比照 points）。
// 刪除是立即生效、不可逆的，所以先列出會刪掉什麼（含剩餘點數與可用優惠券數量），
// 再要求輸入「刪除帳號」四個字才能按；四種登入方式（帳密/Google/LINE/Magic Link）都適用，不要求密碼。
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import Text from '../components/Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { fetchMyCoupons } from '../services/coupons';
import { fetchLoyaltyBalance } from '../services/loyalty';
import { deleteMyAccount } from '../services/users';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { useFavoritesStore } from '../store/useFavoritesStore';

const CONFIRM_TEXT = '刪除帳號';

const DELETED_ITEMS = [
  '個人資料：Email、暱稱、生日、頭像',
  'Google／LINE 登入綁定',
  '紅利點數與所有可用的優惠券',
  '好友、通知與推播設定',
  '這支手機上的購物車與收藏',
];

export default function DeleteAccountScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const logout = useAuthStore((state) => state.logout);
  const clearCart = useCartStore((state) => state.clear);
  const clearFavorites = useFavoritesStore((state) => state.clear);
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // 沿用既有的 query key，讓使用者在按下去之前清楚知道會損失多少點數/優惠券
  const { data: balance } = useQuery({ queryKey: ['loyalty-balance'], queryFn: fetchLoyaltyBalance });
  const { data: coupons } = useQuery({ queryKey: ['myCoupons'], queryFn: fetchMyCoupons });
  const usableCouponCount = useMemo(() => {
    const now = Date.now();
    return (coupons ?? []).filter((c) => !c.is_used && new Date(c.expired_at).getTime() > now).length;
  }, [coupons]);

  const canDelete = confirmInput.trim() === CONFIRM_TEXT && !isDeleting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      await deleteMyAccount();
      clearCart();
      clearFavorites();
      // logout 會清 token 與 TanStack Query 快取，_layout.tsx 的 Stack.Protected 自動切回登入畫面
      await logout();
      Toast.show({ type: 'success', text1: '帳號已刪除', text2: '感謝您過去的使用' });
    } catch (error: any) {
      setIsDeleting(false);
      const status = error.response?.status;
      if (status === 403) {
        Alert.alert('無法刪除', '店員帳號無法自行刪除，請聯絡管理者處理。');
      } else {
        Alert.alert('刪除失敗', '目前無法刪除帳號，請檢查網路後稍後再試。');
      }
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* edgeToEdgeEnabled：底部多留 Android 導覽列的高度，避免刪除按鈕被蓋住 */}
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 48 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={28} color={colors.danger} />
          <Text style={styles.warningTitle}>刪除後將無法復原</Text>
          <Text style={styles.warningText}>帳號會立即刪除並登出，之後無法再用這個帳號登入。</Text>
        </View>

        <Text style={styles.sectionTitle}>將會刪除</Text>
        {DELETED_ITEMS.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}

        <View style={styles.lossBox}>
          <View style={styles.lossRow}>
            <Text style={styles.lossLabel}>目前紅利點數</Text>
            <Text style={styles.lossValue}>{balance ?? 0} 點</Text>
          </View>
          <View style={styles.lossRow}>
            <Text style={styles.lossLabel}>可用優惠券</Text>
            <Text style={styles.lossValue}>{usableCouponCount} 張</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>會保留</Text>
        <Text style={styles.paragraph}>
          過去的訂單與點餐紀錄會依法保留作為交易憑證，但不會再對應到您的身分。
          之後您仍可以用同一個 Email 重新註冊成新帳號。
        </Text>

        <Text style={styles.sectionTitle}>確認刪除</Text>
        <Text style={styles.paragraph}>請輸入「{CONFIRM_TEXT}」四個字：</Text>
        <TextInput
          style={styles.input}
          value={confirmInput}
          onChangeText={setConfirmInput}
          placeholder={CONFIRM_TEXT}
          placeholderTextColor={colors.textSubtle}
          autoCorrect={false}
          autoCapitalize="none"
          editable={!isDeleting}
        />

        <Pressable
          style={[styles.deleteButton, !canDelete && styles.deleteButtonDisabled]}
          onPress={handleDelete}
          disabled={!canDelete}
        >
          {isDeleting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.deleteButtonText}>永久刪除帳號</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { padding: 20, paddingBottom: 48, backgroundColor: colors.background, flexGrow: 1 },
  warningBox: {
    backgroundColor: colors.dangerSurface, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 24,
  },
  warningTitle: { fontSize: 17, fontWeight: '700', color: colors.danger, marginTop: 6 },
  warningText: { fontSize: 13, color: colors.text, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 8, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', marginBottom: 4 },
  bullet: { fontSize: 14, color: colors.textMuted, width: 16 },
  bulletText: { fontSize: 14, color: colors.text, flex: 1 },
  lossBox: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginTop: 12, marginBottom: 16 },
  lossRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  lossLabel: { fontSize: 14, color: colors.textMuted },
  lossValue: { fontSize: 14, fontWeight: '700', color: colors.danger },
  paragraph: { fontSize: 13, color: colors.textMuted, lineHeight: 20, marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text, marginBottom: 20,
  },
  deleteButton: {
    backgroundColor: colors.danger, borderRadius: 12, paddingVertical: 16, alignItems: 'center',
  },
  deleteButtonDisabled: { opacity: 0.4 },
  deleteButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
