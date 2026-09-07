// app/dine-in/order/[id].tsx
// 堂食點餐訂單詳情頁：沿用 (tabs)/coupons.tsx「我的點餐」區段的 ['my-dine-in-orders'] 快取，
// 避免重複打 API（比照 app/order/[id].tsx 沿用 ['my-orders'] 快取的做法）；找不到快取時會自動 refetch。
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import Text from '../../../components/Text';
import { ThemeColors } from '../../../constants/Colors';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { fetchMyDineInOrders } from '../../../services/dineIn';
import { DINE_IN_ORDER_STATUS_LABEL, DineInOrder } from '../../../types/dineIn';

export default function DineInOrderDetailScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: orders, isLoading } = useQuery<DineInOrder[]>({
    queryKey: ['my-dine-in-orders'],
    queryFn: fetchMyDineInOrders,
  });
  const order = orders?.find((o) => o.id === Number(id));

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
        <Text style={styles.errorText}>找不到這筆點餐記錄</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.statusText}>{DINE_IN_ORDER_STATUS_LABEL[order.status]}</Text>
        <Text style={styles.totalAmount}>${order.total_amount}</Text>
        <Text style={styles.metaText}>桌號：{order.table_number}</Text>
        <Text style={styles.metaText}>建立時間：{new Date(order.created_at).toLocaleString('zh-TW')}</Text>
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

      <Text style={styles.sectionTitle}>品項明細</Text>
      {order.items.map((item) => (
        <View key={item.menu_item_id} style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle} numberOfLines={2}>{item.name}</Text>
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
