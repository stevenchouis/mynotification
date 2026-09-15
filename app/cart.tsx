// app/cart.tsx
// 購物車頁：調整數量／移除品項，送出訂單（POST /api/v1/orders）。這裡顯示的小計只是
// 「加入購物車當下的價格快照 × 數量」，僅供參考，實際金額以後端回應為準（見 plan.md 的 Constraints）。
// 優惠券折抵（2026-09-15，見 plan-coupon-checkout-discount.md）：先套用券折扣（clamp 不小於 0）
// → 點數折抵上限改抓「券後金額」的 50%（不是原始小計），兩者可疊加使用。
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Text from '../components/Text';
import { ThemeColors } from '../constants/Colors';
import { MAX_REDEEM_RATIO, POINTS_TO_CURRENCY_RATE } from '../constants/loyalty';
import { useThemeColors } from '../hooks/useThemeColors';
import { fetchMyCoupons } from '../services/coupons';
import { fetchLoyaltyBalance } from '../services/loyalty';
import { createOrder } from '../services/shop';
import { CartItem, useCartStore } from '../store/useCartStore';
import { Coupon } from '../types';
import { getCouponStatus } from '../utils/coupon';

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
  const [pointsInput, setPointsInput] = useState('');
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const [isCouponPickerOpen, setIsCouponPickerOpen] = useState(false);

  const estimatedTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const { data: pointsBalance } = useQuery({
    queryKey: ['loyalty-balance'],
    queryFn: fetchLoyaltyBalance,
  });

  // 沿用「我的」分頁「優惠券」區段同一個 ['myCoupons'] query key，TanStack Query 自動去重複快取
  const { data: coupons } = useQuery<Coupon[]>({
    queryKey: ['myCoupons'],
    queryFn: fetchMyCoupons,
  });
  const usableCoupons = useMemo(
    () => (coupons ?? []).filter((c) => getCouponStatus(c) === 'active'),
    [coupons]
  );
  const selectedCoupon = usableCoupons.find((c) => c.id === selectedCouponId) ?? null;

  // 折抵順序：先套用券折扣（clamp 不小於 0）→ 點數折抵上限改抓「券後金額」的 50%
  const couponDiscount = selectedCoupon ? Math.min(selectedCoupon.discount_amount, estimatedTotal) : 0;
  const afterCouponTotal = Math.max(0, estimatedTotal - couponDiscount);

  // 前端即時試算的折抵上限：不能超過餘額，也不能超過「券後金額」50%（無條件捨去）；
  // 實際折抵金額仍以後端回應為準，這裡只是送出前先擋一次，避免使用者填了才被 422/409 打回
  const maxRedeemablePoints = Math.max(
    0,
    Math.min(pointsBalance ?? 0, Math.floor((afterCouponTotal * MAX_REDEEM_RATIO) / POINTS_TO_CURRENCY_RATE))
  );
  const pointsToUse = Math.min(Number(pointsInput) || 0, maxRedeemablePoints);
  const discountedTotal = Math.max(0, afterCouponTotal - pointsToUse * POINTS_TO_CURRENCY_RATE);

  const onCheckout = async () => {
    if (items.length === 0) {
      Alert.alert('提示', '購物車是空的，先去商店逛逛吧');
      return;
    }
    const requestedPoints = Number(pointsInput) || 0;
    if (requestedPoints > maxRedeemablePoints) {
      Alert.alert('點數超過上限', `最多可折抵 ${maxRedeemablePoints} 點（受餘額與可折抵金額 50% 上限限制）`);
      return;
    }
    setIsSubmitting(true);
    try {
      const order = await createOrder(
        items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
        pointsToUse > 0 ? pointsToUse : undefined,
        selectedCoupon ? selectedCoupon.id : undefined
      );
      clear();
      setPointsInput('');
      setSelectedCouponId(null);
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['myCoupons'] });
      // 訂單建立成功（status=pending）後直接進 ECPay 結帳頁，付款完成/取消都會回到訂單詳情頁
      router.replace(`/checkout/${order.id}`);
    } catch (error: any) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.error_code === 'insufficient_points') {
        Alert.alert('點數不足', detail.message || '點數餘額不足，請調整折抵點數');
      } else if (detail && typeof detail === 'object' && detail.error_code === 'points_cap_exceeded') {
        Alert.alert('超過折抵上限', detail.message || '折抵點數超過可折抵金額 50% 上限');
      } else if (detail && typeof detail === 'object' && detail.error_code === 'coupon_already_used') {
        Alert.alert('優惠券已使用', detail.message || '這張優惠券已經被使用過了');
        queryClient.invalidateQueries({ queryKey: ['myCoupons'] });
        setSelectedCouponId(null);
      } else if (detail && typeof detail === 'object' && detail.error_code === 'coupon_expired') {
        Alert.alert('優惠券已過期', detail.message || '這張優惠券已經過期了');
        queryClient.invalidateQueries({ queryKey: ['myCoupons'] });
        setSelectedCouponId(null);
      } else if (status === 404 && typeof detail === 'string' && detail.includes('優惠券')) {
        Alert.alert('優惠券錯誤', detail);
        queryClient.invalidateQueries({ queryKey: ['myCoupons'] });
        setSelectedCouponId(null);
      } else if (status === 409) {
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
        {usableCoupons.length > 0 && (
          <View style={styles.couponRow}>
            {selectedCoupon ? (
              <>
                <View style={styles.couponSelectedInfo}>
                  <Text style={styles.couponSelectedTitle} numberOfLines={1}>
                    已選：{selectedCoupon.title}（折 ${couponDiscount}）
                  </Text>
                </View>
                <Pressable style={styles.couponChangeButton} onPress={() => setIsCouponPickerOpen(true)}>
                  <Text style={styles.couponChangeButtonText}>更換</Text>
                </Pressable>
                <Pressable style={styles.couponClearButton} onPress={() => setSelectedCouponId(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.couponPickButton} onPress={() => setIsCouponPickerOpen(true)}>
                <Ionicons name="pricetag-outline" size={16} color={colors.tint} />
                <Text style={styles.couponPickButtonText}>使用優惠券折抵（{usableCoupons.length} 張可用）</Text>
              </Pressable>
            )}
          </View>
        )}
        {maxRedeemablePoints > 0 && (
          <View style={styles.pointsRow}>
            <Text style={styles.pointsLabel}>
              目前點數 {pointsBalance ?? 0} 點｜使用點數折抵（本筆可用 {maxRedeemablePoints} 點）
            </Text>
            <View style={styles.pointsInputRow}>
              <TextInput
                style={styles.pointsInput}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textSubtle}
                value={pointsInput}
                onChangeText={setPointsInput}
              />
              <Pressable style={styles.useAllButton} onPress={() => setPointsInput(String(maxRedeemablePoints))}>
                <Text style={styles.useAllButtonText}>全部使用</Text>
              </Pressable>
            </View>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{(couponDiscount > 0 || pointsToUse > 0) ? '折抵後金額' : '預估小計'}</Text>
          <Text style={styles.totalValue}>${discountedTotal.toFixed(2)}</Text>
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

      <Modal
        visible={isCouponPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCouponPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsCouponPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>選擇優惠券</Text>
            <FlatList<Coupon>
              data={usableCoupons}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalCouponRow}
                  onPress={() => {
                    setSelectedCouponId(item.id);
                    setIsCouponPickerOpen(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalCouponTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.modalCouponExpiry}>
                      效期至 {new Date(item.expired_at).toLocaleDateString('zh-TW')}
                    </Text>
                  </View>
                  <Text style={styles.modalCouponDiscount}>${item.discount_amount}</Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.modalCloseButton} onPress={() => setIsCouponPickerOpen(false)}>
              <Text style={styles.modalCloseButtonText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  couponRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  couponPickButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.tint,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, alignSelf: 'flex-start',
  },
  couponPickButtonText: { color: colors.tint, fontSize: 13, fontWeight: '600' },
  couponSelectedInfo: { flex: 1 },
  couponSelectedTitle: { fontSize: 13, color: colors.text, fontWeight: '600' },
  couponChangeButton: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
  },
  couponChangeButtonText: { fontSize: 12, color: colors.textMuted },
  couponClearButton: { padding: 2 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, maxHeight: '70%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  modalCouponRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalCouponTitle: { fontSize: 14, color: colors.text, fontWeight: '500' },
  modalCouponExpiry: { fontSize: 11, color: colors.textSubtle, marginTop: 2 },
  modalCouponDiscount: { fontSize: 15, color: colors.tint, fontWeight: '700' },
  modalCloseButton: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  modalCloseButtonText: { fontSize: 14, color: colors.textMuted },

  pointsRow: { marginBottom: 12 },
  pointsLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  pointsInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointsInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.text,
    backgroundColor: colors.surface,
  },
  useAllButton: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: colors.tint,
  },
  useAllButtonText: { color: colors.tint, fontSize: 13, fontWeight: '600' },
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
