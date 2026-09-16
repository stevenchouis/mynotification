// app/points.tsx
// 紅利點數畫面：餘額 + 收支明細，比照 app/coupon/[id].tsx 掛在 app/_layout.tsx 的
// userToken 分支下（Stack.Screen，非 Tab）。5 種交易類型
// （earn/redeem/expire/reverse_earn/reverse_redeem）的圖示/顏色/文案設計見
// plan-loyalty-points.md 的 Scope 章節；reverse_earn/reverse_redeem 是跟 back-end
// 確認後拆出來的（2026-09-09），每個 type 固定方向，不用額外判斷。
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import Text from '../components/Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { fetchLoyaltyBalance, fetchLoyaltyTransactions } from '../services/loyalty';
import { fetchMyDineInOrders, fetchRestaurants } from '../services/dineIn';
import { fetchMyOrders } from '../services/shop';
import { fetchMyStoreCheckouts } from '../services/storeCheckouts';
import { DineInOrder, Restaurant } from '../types/dineIn';
import { LoyaltyTransaction, LoyaltyTransactionType } from '../types/loyalty';
import { Order } from '../types/shop';
import { StoreCheckout } from '../types/storeCheckout';

const TX_DISPLAY: Record<
  LoyaltyTransactionType,
  { icon: keyof typeof Ionicons.glyphMap; sign: '+' | '-'; colorKey: keyof ThemeColors; defaultReason: string }
> = {
  earn: { icon: 'add-circle-outline', sign: '+', colorKey: 'success', defaultReason: '消費回饋' },
  redeem: { icon: 'remove-circle-outline', sign: '-', colorKey: 'tint', defaultReason: '訂單折抵' },
  expire: { icon: 'time-outline', sign: '-', colorKey: 'textSubtle', defaultReason: '點數已過期' },
  reverse_earn: { icon: 'close-circle-outline', sign: '-', colorKey: 'textSubtle', defaultReason: '訂單取消收回點數' },
  reverse_redeem: { icon: 'arrow-undo-outline', sign: '+', colorKey: 'accent', defaultReason: '訂單取消退還折抵' },
};

function TransactionRow({
  tx, orderAmount, restaurantName, colors, styles,
}: {
  tx: LoyaltyTransaction; orderAmount: number | null; restaurantName: string | null;
  colors: ThemeColors; styles: ReturnType<typeof createStyles>;
}) {
  const display = TX_DISPLAY[tx.type];
  const color = colors[display.colorKey] as string;
  const reason = tx.type === 'expire' ? display.defaultReason : tx.reason || display.defaultReason;

  return (
    <View style={styles.row}>
      <Ionicons name={display.icon} size={26} color={color} style={styles.rowIcon} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowReason}>{reason}</Text>
        {orderAmount !== null && (
          <Text style={styles.rowOrderAmount}>消費金額：${orderAmount}</Text>
        )}
        {restaurantName && (
          <Text style={styles.rowRestaurant}>門市：{restaurantName}</Text>
        )}
        <Text style={styles.rowDate}>{new Date(tx.created_at).toLocaleString('zh-TW')}</Text>
      </View>
      <Text style={[styles.rowAmount, { color }]}>
        {display.sign}{tx.amount} 點
      </Text>
    </View>
  );
}

export default function PointsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const queryClient = useQueryClient();

  const { data: balance, isLoading: isBalanceLoading } = useQuery({
    queryKey: ['loyalty-balance'],
    queryFn: fetchLoyaltyBalance,
  });

  const { data: transactions, isLoading: isTxLoading, isRefetching, refetch } = useQuery({
    queryKey: ['loyalty-transactions'],
    queryFn: fetchLoyaltyTransactions,
  });

  // 交易明細本身沒有帶消費金額欄位，只有 related_order_id／related_dine_in_order_id，
  // 要顯示「消費金額」得回頭查對應的訂單——沿用 ['my-orders']／['my-dine-in-orders']
  // 這兩個既有 query key（跟 order/[id].tsx、dine-in/order/[id].tsx 共用快取，不會重複打 API）
  const { data: orders } = useQuery<Order[]>({ queryKey: ['my-orders'], queryFn: fetchMyOrders });
  const { data: dineInOrders } = useQuery<DineInOrder[]>({ queryKey: ['my-dine-in-orders'], queryFn: fetchMyDineInOrders });
  // 門市收銀交易（見 plan-member-code-checkout.md），跟上面兩個 queryKey 同樣手法回頭查金額
  const { data: storeCheckouts } = useQuery<StoreCheckout[]>({ queryKey: ['store-checkouts'], queryFn: fetchMyStoreCheckouts });

  // restaurant_id 是純記錄用途（多門市統一錢包，見 CLAUDE.md），只用來顯示這筆交易發生在哪間門市，
  // 不影響餘額/折抵邏輯；沿用 ['restaurants']（跟 dine-in/restaurant.tsx 共用快取）查門市名稱
  const { data: restaurants } = useQuery<Restaurant[]>({ queryKey: ['restaurants'], queryFn: fetchRestaurants });

  const orderAmountByTx = useCallback((tx: LoyaltyTransaction): number | null => {
    if (tx.related_order_id != null) {
      return orders?.find((o) => o.id === tx.related_order_id)?.total_amount ?? null;
    }
    if (tx.related_dine_in_order_id != null) {
      return dineInOrders?.find((o) => o.id === tx.related_dine_in_order_id)?.total_amount ?? null;
    }
    if (tx.related_store_checkout_id != null) {
      return storeCheckouts?.find((c) => c.id === tx.related_store_checkout_id)?.total_amount ?? null;
    }
    return null;
  }, [orders, dineInOrders, storeCheckouts]);

  const restaurantNameByTx = useCallback((tx: LoyaltyTransaction): string | null => {
    if (tx.restaurant_id == null) return null;
    return restaurants?.find((r) => r.id === tx.restaurant_id)?.name ?? null;
  }, [restaurants]);

  // 點數餘額的變動來源（堂食訂單在 Staff App 被標記完成、網購訂單付款）都發生在
  // mynotification 以外的地方，沒有任何管道能主動通知這個畫面「該刷新了」，
  // 所以改成每次畫面重新取得焦點（從別的畫面切回來）就強制重新抓一次，不能只靠
  // 全域 staleTime 被動等過期
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-balance'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-dine-in-orders'] });
    }, [queryClient])
  );

  return (
    <View style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>目前餘額</Text>
        {isBalanceLoading ? (
          <ActivityIndicator color={colors.tint} style={{ marginTop: 8 }} />
        ) : (
          <Text style={styles.balanceValue}>{balance ?? 0} 點</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>收支明細</Text>

      {isTxLoading ? (
        <ActivityIndicator size="large" color={colors.tint} style={{ marginTop: 24 }} />
      ) : (
        <FlatList<LoyaltyTransaction>
          data={transactions ?? []}
          keyExtractor={(tx) => String(tx.id)}
          contentContainerStyle={styles.listContent}
          refreshing={isRefetching}
          onRefresh={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['loyalty-balance'] });
          }}
          renderItem={({ item }) => (
            <TransactionRow
              tx={item}
              orderAmount={orderAmountByTx(item)}
              restaurantName={restaurantNameByTx(item)}
              colors={colors}
              styles={styles}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="star-outline" size={40} color={colors.border} />
              <Text style={styles.emptyText}>目前還沒有任何點數紀錄</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  balanceCard: {
    backgroundColor: colors.surface, margin: 16, borderRadius: 16,
    padding: 24, alignItems: 'center',
  },
  balanceLabel: { fontSize: 14, color: colors.textMuted },
  balanceValue: { fontSize: 36, fontWeight: '900', color: colors.text, marginTop: 8 },

  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginHorizontal: 16, marginBottom: 4 },

  listContent: { padding: 16, paddingTop: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  rowIcon: { marginRight: 12 },
  rowInfo: { flex: 1 },
  rowReason: { fontSize: 14, color: colors.text, fontWeight: '500' },
  rowOrderAmount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowRestaurant: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowDate: { fontSize: 11, color: colors.textSubtle, marginTop: 4 },
  rowAmount: { fontSize: 15, fontWeight: '700' },

  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },
});
