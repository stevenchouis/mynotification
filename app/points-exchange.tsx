// app/points-exchange.tsx
// 點數兌換優惠券（見 plan-points-exchange.md）。從 app/points.tsx 的餘額卡片進來，
// 掛在 app/_layout.tsx 的 userToken 分支（比照 points）。
// 兌換目錄、每月上限都以後端 GET /loyalty/exchange-options 為準，前端只做「點數不足／已達上限」的
// 即時判斷擋一次，實際能不能換仍以 POST /loyalty/exchange 的回應為準。兌換後不能退回點數。
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Text from '../components/Text';
import { ThemeColors } from '../constants/Colors';
import { POINTS_TO_CURRENCY_RATE } from '../constants/loyalty';
import { useThemeColors } from '../hooks/useThemeColors';
import {
  EXCHANGE_OPTIONS_QUERY_KEY, exchangePoints, fetchExchangeOptions, fetchLoyaltyBalance,
} from '../services/loyalty';
import { ExchangeOption } from '../types/loyalty';

export default function PointsExchangeScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  // 送出中的品項 id；有值時所有兌換按鈕都停用，避免連點換到兩張
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const { data: balance } = useQuery({ queryKey: ['loyalty-balance'], queryFn: fetchLoyaltyBalance });
  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: EXCHANGE_OPTIONS_QUERY_KEY,
    queryFn: fetchExchangeOptions,
  });

  const remaining = data ? Math.max(data.monthly_limit - data.used_this_month, 0) : 0;

  const refreshAll = () => {
    // 'loyalty-balance' 開頭的 key 會連帶刷新會員等級（見 services/loyalty.ts）
    queryClient.invalidateQueries({ queryKey: ['loyalty-balance'] });
    queryClient.invalidateQueries({ queryKey: ['loyalty-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['myCoupons'] });
    queryClient.invalidateQueries({ queryKey: EXCHANGE_OPTIONS_QUERY_KEY });
  };

  const doExchange = async (option: ExchangeOption) => {
    setSubmittingId(option.id);
    try {
      const { coupon } = await exchangePoints(option.id);
      refreshAll();
      Alert.alert('兌換成功', `已獲得「${coupon.title}」，${option.valid_days} 天內有效。`, [
        { text: '繼續兌換', style: 'cancel' },
        { text: '查看優惠券', onPress: () => router.push(`/coupon/${coupon.id}`) },
      ]);
    } catch (error: any) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      // 先判斷帶 error_code 的物件（比照 cart.tsx 的錯誤分流），再落到 status code
      if (detail && typeof detail === 'object' && detail.error_code === 'insufficient_points') {
        Alert.alert('點數不足', detail.message || '點數餘額不足，無法兌換這張優惠券');
      } else if (detail && typeof detail === 'object' && detail.error_code === 'exchange_limit_reached') {
        Alert.alert('已達本月上限', detail.message || '本月兌換次數已用完，下個月再來吧');
      } else if (status === 404) {
        Alert.alert('品項已下架', '這個兌換品項已不提供，請重新整理後再試');
      } else {
        Alert.alert('兌換失敗', '目前無法兌換，請檢查網路後稍後再試');
      }
      // 不管哪種錯誤都重新抓一次，讓畫面上的點數與剩餘次數跟後端一致
      refreshAll();
    } finally {
      setSubmittingId(null);
    }
  };

  const confirmExchange = (option: ExchangeOption) => {
    Alert.alert(
      '確認兌換',
      `使用 ${option.points_cost} 點兌換「${option.title}」？\n兌換後點數無法退回，優惠券 ${option.valid_days} 天內有效。`,
      [
        { text: '取消', style: 'cancel' },
        { text: '兌換', onPress: () => doExchange(option) },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['loyalty-balance'] });
          }}
          tintColor={colors.tint}
        />
      }
    >
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>目前點數</Text>
          <Text style={styles.summaryValue}>{balance ?? 0}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          {/* 顯示「已兌換／上限」而不是「剩餘／上限」：使用者 2026-11-08 實測時把「可兌換 2／3」
              誤讀成已換 2 張，「已兌換 1／3」比較不會誤會 */}
          <Text style={styles.summaryLabel}>本月已兌換</Text>
          <Text style={styles.summaryValue}>
            {data ? `${Math.min(data.used_this_month, data.monthly_limit)}／${data.monthly_limit}` : '—'}
          </Text>
          {data && (
            <Text style={styles.summaryHint}>{remaining > 0 ? `還可以換 ${remaining} 張` : '本月已換完'}</Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.tint} style={{ marginTop: 32 }} />
      ) : isError || !data ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.border} />
          <Text style={styles.emptyText}>無法載入兌換品項，請下拉重新整理</Text>
        </View>
      ) : data.options.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="ticket-outline" size={40} color={colors.border} />
          <Text style={styles.emptyText}>目前沒有可兌換的優惠券</Text>
        </View>
      ) : (
        data.options.map((option) => {
          const notEnough = (balance ?? 0) < option.points_cost;
          const limitReached = remaining <= 0;
          const disabled = notEnough || limitReached || submittingId !== null;
          // 跟結帳直接折抵（1 點 = NT$1）比，換券多賺多少，讓使用者看得出划算
          const saved = option.discount_amount - option.points_cost * POINTS_TO_CURRENCY_RATE;
          return (
            <View key={option.id} style={styles.optionCard}>
              <View style={styles.optionAmountBox}>
                <Text style={styles.optionAmount}>${option.discount_amount}</Text>
                <Text style={styles.optionAmountLabel}>折價券</Text>
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionCost}>{option.points_cost} 點</Text>
                {saved > 0 && (
                  <Text style={styles.optionSaved}>比直接折抵多省 ${saved}</Text>
                )}
                <Text style={styles.optionValid}>兌換後 {option.valid_days} 天內有效</Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.exchangeButton,
                  disabled && styles.exchangeButtonDisabled,
                  pressed && !disabled && { opacity: 0.7 },
                ]}
                disabled={disabled}
                onPress={() => confirmExchange(option)}
              >
                {submittingId === option.id ? (
                  <ActivityIndicator size="small" color={colors.onTint} />
                ) : (
                  <Text style={[styles.exchangeButtonText, disabled && styles.exchangeButtonTextDisabled]}>
                    {limitReached ? '已達上限' : notEnough ? '點數不足' : '兌換'}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })
      )}

      <View style={styles.noteBox}>
        <Text style={styles.noteTitle}>兌換說明</Text>
        <Text style={styles.noteText}>・兌換後點數無法退回，優惠券過期未使用即失效</Text>
        {data && <Text style={styles.noteText}>・每人每月最多兌換 {data.monthly_limit} 張（各品項合計）</Text>}
        <Text style={styles.noteText}>・優惠券可用於網購、堂食與門市結帳，不限門市</Text>
        <Text style={styles.noteText}>・扣點時會先使用最早到期的點數</Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },

  summaryCard: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16,
    paddingVertical: 18, marginBottom: 16,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 26, fontWeight: '900', color: colors.text, marginTop: 4 },
  summaryHint: { fontSize: 11, color: colors.textSubtle, marginTop: 2 },

  optionCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 14, padding: 14, marginBottom: 12,
  },
  optionAmountBox: {
    width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  optionAmount: { fontSize: 20, fontWeight: '900', color: colors.tint },
  optionAmountLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  optionCost: { fontSize: 14, fontWeight: '700', color: colors.tint, marginTop: 4 },
  optionSaved: { fontSize: 12, color: colors.success, marginTop: 2 },
  optionValid: { fontSize: 11, color: colors.textSubtle, marginTop: 2 },

  exchangeButton: {
    minWidth: 76, alignItems: 'center', backgroundColor: colors.tint,
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginLeft: 8,
  },
  exchangeButtonDisabled: { backgroundColor: colors.surfaceAlt },
  exchangeButtonText: { fontSize: 14, fontWeight: '600', color: colors.onTint },
  exchangeButtonTextDisabled: { color: colors.textSubtle },

  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },

  noteBox: { marginTop: 8, padding: 14, borderRadius: 12, backgroundColor: colors.surface },
  noteTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  noteText: { fontSize: 12, color: colors.textMuted, lineHeight: 20 },
});
