// app/referral.tsx
// 推薦好友（見 plan-referral.md）。從 settings.tsx「帳號管理」進來，掛在 app/_layout.tsx 的 userToken 分支。
// 上半部：我的推薦碼＋分享、推薦成果；下半部：還能補填時（註冊 7 天內、沒消費過、還沒被推薦過）
// 顯示「輸入推薦碼」，給 Google／LINE／Magic Link 自動建立、沒經過註冊表單的帳號用。
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView,
  Share, StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Text from '../components/Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { REFERRAL_ME_QUERY_KEY, applyReferralCode, fetchReferralMe } from '../services/referrals';
import { REFERRAL_CODE_PATTERN, REFERRAL_ERROR_MESSAGE, normalizeReferralCode } from '../types/referral';

// 分享的是後端的 https 中繼網頁，不是 mynotification:// deep link：LINE 等聊天 App 只會把 http(s)
// 變成可點的連結（使用者 2026-11-08 實測 LINE 點不開）。中繼網頁再自動跳 mynotification://register?ref=，
// 比照 Magic Link 的 /login/magic-link/redirect。deep link 只在未登入時有效（register 在未登入分支）。
// 文字裡一定要寫出推薦碼：還沒裝 App 的人只能手動輸入
const API_URL = process.env.EXPO_PUBLIC_API_URL;
const buildShareMessage = (code: string) =>
  `我在用寶雅電子商城 App，註冊時輸入我的推薦碼 ${code}，就能多拿一張 $50 優惠券！\n` +
  `${API_URL}/api/v1/referrals/landing?code=${encodeURIComponent(code)}`;

export default function ReferralScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [codeInput, setCodeInput] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  // 已登入時點朋友的推薦連結，app/+native-intent.tsx 會導到 /referral?code=XXXXXX
  const { code: linkCode } = useLocalSearchParams<{ code?: string }>();

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: REFERRAL_ME_QUERY_KEY,
    queryFn: fetchReferralMe,
  });

  // 還能補填、而且不是自己的碼，才幫忙帶入輸入框（送出仍由使用者自己按）
  useEffect(() => {
    if (!data?.can_apply_code || typeof linkCode !== 'string') return;
    const normalized = normalizeReferralCode(linkCode).slice(0, 6);
    if (normalized && normalized !== data.code) setCodeInput((current) => current || normalized);
  }, [data?.can_apply_code, data?.code, linkCode]);

  const normalizedInput = normalizeReferralCode(codeInput);
  const canSubmit = REFERRAL_CODE_PATTERN.test(normalizedInput) && !isApplying;

  const handleShare = async () => {
    if (!data) return;
    try {
      await Share.share({ message: buildShareMessage(data.code) });
    } catch {
      // 使用者關掉分享選單不算錯誤
    }
  };

  const handleApply = async () => {
    if (!canSubmit) return;
    setIsApplying(true);
    try {
      const result = await applyReferralCode(normalizedInput);
      setCodeInput('');
      queryClient.invalidateQueries({ queryKey: REFERRAL_ME_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['myCoupons'] });
      Alert.alert(
        '推薦碼已套用',
        `你是由「${result.referred_by.display_name}」推薦的，已獲得「${result.coupon.title}」。`,
        [
          { text: '好', style: 'cancel' },
          { text: '查看優惠券', onPress: () => router.push(`/coupon/${result.coupon.id}`) },
        ],
      );
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const code = detail && typeof detail === 'object' ? detail.error_code : undefined;
      Alert.alert('無法套用', (code && REFERRAL_ERROR_MESSAGE[code]) || '目前無法套用推薦碼，請稍後再試');
      // 已填過／過期：重抓狀態，讓輸入區塊消失
      if (code === 'already_referred' || code === 'apply_window_closed') {
        queryClient.invalidateQueries({ queryKey: REFERRAL_ME_QUERY_KEY });
      }
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.border} />
        <Text style={styles.mutedText}>無法載入推薦資訊</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>重新整理</Text>
        </Pressable>
      </View>
    );
  }

  const limitReached = data.rewarded_this_year >= data.yearly_limit;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.tint} />}
      >
        {/* 我的推薦碼 */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>我的推薦碼</Text>
          {/* selectable：沒有裝剪貼簿套件，長按可以選取複製 */}
          <Text style={styles.codeValue} selectable>{data.code}</Text>
          <Text style={styles.codeHint}>朋友註冊時輸入這組推薦碼，雙方都有優惠券</Text>
          <Pressable
            style={({ pressed }) => [styles.shareButton, pressed && { opacity: 0.7 }]}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={18} color={colors.onTint} />
            <Text style={styles.shareButtonText}>分享給朋友</Text>
          </Pressable>
        </View>

        {/* 推薦成果 */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{data.successful_count}</Text>
            <Text style={styles.statLabel}>成功推薦</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{data.pending_count}</Text>
            <Text style={styles.statLabel}>等待首購</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{`${data.rewarded_this_year}／${data.yearly_limit}`}</Text>
            <Text style={styles.statLabel}>今年已領獎勵</Text>
          </View>
        </View>
        {limitReached && (
          <Text style={styles.limitText}>今年的推薦獎勵已領滿，仍可繼續推薦，朋友照樣拿得到優惠券</Text>
        )}

        {/* 被誰推薦／補填推薦碼 */}
        {data.referred_by ? (
          <View style={styles.sectionCard}>
            <Ionicons name="people-outline" size={18} color={colors.textMuted} />
            <Text style={styles.referredByText}>你是由「{data.referred_by.display_name}」推薦的</Text>
          </View>
        ) : data.can_apply_code ? (
          <View style={styles.applyCard}>
            <Text style={styles.applyTitle}>有朋友的推薦碼嗎？</Text>
            <Text style={styles.applyHint}>
              填入後馬上拿到一張優惠券
              {data.apply_deadline ? `（${new Date(data.apply_deadline).toLocaleDateString('zh-TW')} 前可填）` : ''}
            </Text>
            <View style={styles.applyRow}>
              <TextInput
                style={styles.input}
                value={codeInput}
                onChangeText={(text) => setCodeInput(normalizeReferralCode(text))}
                placeholder="輸入 6 碼推薦碼"
                placeholderTextColor={colors.textSubtle}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
              />
              <Pressable
                style={[styles.applyButton, !canSubmit && styles.applyButtonDisabled]}
                disabled={!canSubmit}
                onPress={handleApply}
              >
                {isApplying ? (
                  <ActivityIndicator size="small" color={colors.onTint} />
                ) : (
                  <Text style={[styles.applyButtonText, !canSubmit && styles.applyButtonTextDisabled]}>送出</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>推薦規則</Text>
          <Text style={styles.noteText}>・朋友註冊時填你的推薦碼，馬上拿到 $50 優惠券</Text>
          <Text style={styles.noteText}>・朋友完成第一筆消費（網購付款、堂食完成或門市結帳）後，你拿到 $100 優惠券</Text>
          <Text style={styles.noteText}>・每年最多領 {data.yearly_limit} 次推薦獎勵</Text>
          <Text style={styles.noteText}>・用 Google、LINE 或 Email 連結登入的新帳號，註冊 7 天內、尚未消費前可以在這裡補填推薦碼</Text>
          <Text style={styles.noteText}>・優惠券 30 天內有效</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  mutedText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.tint },
  retryText: { fontSize: 14, fontWeight: '600', color: colors.onTint },

  codeCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, alignItems: 'center' },
  codeLabel: { fontSize: 13, color: colors.textMuted },
  codeValue: { fontSize: 34, fontWeight: '900', color: colors.text, letterSpacing: 6, marginTop: 6 },
  codeHint: { fontSize: 12, color: colors.textSubtle, marginTop: 6, textAlign: 'center' },
  shareButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.tint,
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, marginTop: 16,
  },
  shareButtonText: { fontSize: 15, fontWeight: '600', color: colors.onTint },

  statsCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 16, marginTop: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  limitText: { fontSize: 12, color: colors.warning, marginTop: 8, textAlign: 'center' },

  sectionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface,
    borderRadius: 12, padding: 14, marginTop: 12,
  },
  referredByText: { fontSize: 14, color: colors.text, flex: 1 },

  applyCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginTop: 12 },
  applyTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  applyHint: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  applyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  input: {
    flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingHorizontal: 12, fontSize: 16, color: colors.text, letterSpacing: 3,
  },
  applyButton: {
    height: 44, minWidth: 72, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, backgroundColor: colors.tint, paddingHorizontal: 14,
  },
  applyButtonDisabled: { backgroundColor: colors.surfaceAlt },
  applyButtonText: { fontSize: 15, fontWeight: '600', color: colors.onTint },
  applyButtonTextDisabled: { color: colors.textSubtle },

  noteBox: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: colors.surface },
  noteTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  noteText: { fontSize: 12, color: colors.textMuted, lineHeight: 20 },
});
