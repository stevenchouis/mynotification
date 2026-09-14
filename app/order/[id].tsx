// app/order/[id].tsx
// 訂單詳情頁：沿用 (tabs)/coupons.tsx「我的訂單」區段的 ['my-orders'] 快取，避免重複打 API
// （比照 app/coupon/[id].tsx 沿用 ['myCoupons'] 快取的做法）；找不到快取時會自動 refetch。
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { fetchMyOrders } from '../../services/shop';
import { Order, OrderStatus } from '../../types/shop';

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '處理中（尚未完成付款）',
  paid: '已付款',
  shipped: '已出貨',
  failed: '付款失敗',
  cancelled: '已取消',
};

export default function OrderDetailScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: orders, isLoading, isRefetching, refetch } = useQuery<Order[]>({
    queryKey: ['my-orders'],
    queryFn: fetchMyOrders,
  });
  const order = orders?.find((o) => o.id === Number(id));

  // 訂單狀態的變動（ECPay 付款完成）來自後端的 Server-to-Server callback，跟使用者的
  // WebView 被導回這個畫面幾乎同時發生、順序不保證——剛導頁進來時後端可能還沒處理完
  // callback，這裡再次刷新才拿得到最新狀態，不能只靠 checkout 畫面導頁前那次 invalidate
  // （比照 app/points.tsx 對同一類「外部狀態變動」問題的做法）
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    }, [queryClient])
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>找不到這筆訂單</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <View style={styles.summaryCard}>
        <Text style={styles.statusText}>{STATUS_LABEL[order.status]}</Text>
        <Text style={styles.totalAmount}>${order.total_amount}</Text>
        <Text style={styles.metaText}>訂單編號：{order.merchant_trade_no}</Text>
        <Text style={styles.metaText}>建立時間：{new Date(order.created_at).toLocaleString('zh-TW')}</Text>
        {order.paid_at && (
          <Text style={styles.metaText}>付款時間：{new Date(order.paid_at).toLocaleString('zh-TW')}</Text>
        )}
      </View>

      {(order.points_earned > 0 || order.points_used > 0) && (
        <View style={styles.pointsCard}>
          {order.points_used > 0 && (
            <Text style={styles.pointsText}>本筆折抵 {order.points_used} 點</Text>
          )}
          {order.points_earned > 0 && (
            <Text style={styles.pointsText}>本筆賺得 {order.points_earned} 點</Text>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>商品明細</Text>
      {order.items.map((item) => (
        <View key={item.product_id} style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.itemMeta}>${item.unit_price} x {item.quantity}</Text>
          </View>
          <Text style={styles.itemSubtotal}>${item.subtotal}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.background, flexGrow: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 },
  errorText: { fontSize: 15, color: colors.danger, textAlign: 'center' },

  summaryCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 20, marginBottom: 24 },
  statusText: { fontSize: 14, color: colors.tint, fontWeight: '600' },
  totalAmount: { fontSize: 28, fontWeight: '900', color: colors.text, marginTop: 6 },
  metaText: { fontSize: 12, color: colors.textSubtle, marginTop: 6 },

  pointsCard: { backgroundColor: colors.highlight, borderRadius: 12, padding: 16, marginBottom: 24 },
  pointsText: { fontSize: 13, color: colors.text, fontWeight: '500' },

  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 12 },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemTitle: { fontSize: 14, color: colors.text },
  itemMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemSubtotal: { fontSize: 14, fontWeight: '600', color: colors.text },
});
