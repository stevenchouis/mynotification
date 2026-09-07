// app/cart.tsx
// 購物車頁：調整數量／移除品項，送出訂單（POST /api/v1/orders）。這裡顯示的小計只是
// 「加入購物車當下的價格快照 × 數量」，僅供參考，實際金額以後端回應為準（見 plan.md 的 Constraints）。
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Text from '../components/Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { createOrder } from '../services/shop';
import { CartItem, useCartStore } from '../store/useCartStore';

export default function CartScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const estimatedTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const onCheckout = async () => {
    if (items.length === 0) {
      Alert.alert('提示', '購物車是空的，先去商店逛逛吧');
      return;
    }
    setIsSubmitting(true);
    try {
      const order = await createOrder(items.map((item) => ({ product_id: item.productId, quantity: item.quantity })));
      clear();
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      Alert.alert(
        '訂單已送出',
        `訂單狀態：處理中（尚未完成付款）\n訂單編號：${order.merchant_trade_no}`,
        [{ text: 'OK', onPress: () => router.replace('/coupons') }]
      );
    } catch (error: any) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      if (status === 409) {
        Alert.alert('庫存不足', detail || '部分商品庫存不足，請調整購物車後再試');
      } else if (status === 422) {
        Alert.alert('資料格式錯誤', detail || '購物車內容有誤，請重新確認');
      } else {
        Alert.alert('錯誤', detail || '送出訂單失敗，請稍後再試');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={48} color={colors.border} />
        <Text style={styles.emptyText}>購物車是空的</Text>
        <Pressable style={styles.shopLink} onPress={() => router.replace('/shop')}>
          <Text style={styles.shopLinkText}>去商店逛逛</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList<CartItem>
        data={items}
        keyExtractor={(item) => String(item.productId)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <Image source={{ uri: item.thumbnail }} style={styles.itemThumb} contentFit="cover" />
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.itemPrice}>${item.price}</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => updateQuantity(item.productId, item.quantity - 1)}
                >
                  <Ionicons name="remove" size={16} color={colors.text} />
                </Pressable>
                <Text style={styles.stepperValue}>{item.quantity}</Text>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => updateQuantity(item.productId, item.quantity + 1)}
                >
                  <Ionicons name="add" size={16} color={colors.text} />
                </Pressable>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeItem(item.productId)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textSubtle} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      {/* Android edge-to-edge 下內容會畫到系統導覽列（手勢列或三按鈕列）後面，「送出訂單」
          按鈕若貼著螢幕最下緣會被蓋住、容易誤觸；除了 insets.bottom 本身，再加一段固定緩衝
          （32）確保視覺上跟系統列有明顯間距，不會看起來還是貼在一起 */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>預估小計</Text>
          <Text style={styles.totalValue}>${estimatedTotal.toFixed(2)}</Text>
        </View>
        <Text style={styles.totalHint}>僅供參考，實際金額以送出結果為準</Text>
        <Pressable
          style={[styles.checkoutButton, isSubmitting && { opacity: 0.6 }]}
          onPress={onCheckout}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.onTint} />
          ) : (
            <Text style={styles.checkoutButtonText}>送出訂單</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16 },
  itemCard: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12,
    padding: 12, marginBottom: 12,
  },
  itemThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 14, color: colors.text, fontWeight: '500' },
  itemPrice: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  stepperButton: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  stepperValue: { fontSize: 14, fontWeight: '600', color: colors.text, minWidth: 18, textAlign: 'center' },
  removeButton: { marginLeft: 'auto' },

  footer: {
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background,
    padding: 16, paddingBottom: 24,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontSize: 14, color: colors.textMuted },
  totalValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  totalHint: { fontSize: 11, color: colors.textSubtle, marginTop: 2, marginBottom: 14 },
  checkoutButton: {
    backgroundColor: colors.tint, paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  checkoutButtonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },

  emptyContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, color: colors.textMuted, marginTop: 12, fontWeight: '600' },
  shopLink: { marginTop: 16 },
  shopLinkText: { color: colors.tint, fontSize: 14, fontWeight: '500' },
});
