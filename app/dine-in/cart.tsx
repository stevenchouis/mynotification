// app/dine-in/cart.tsx
// 堂食點餐流程第三步：本次點餐清單，調整數量／移除、送出訂單（POST /api/v1/dine-in-orders）。
// 比照 app/cart.tsx（網購商店購物車）的結構，但資料源是 useDineInOrderStore，送出成功後清空。
// 優惠券折抵（2026-09-15，見 plan-coupon-checkout-discount.md）：邏輯跟 app/cart.tsx 完全一致，
// 先套用券折扣 → 點數折抵上限改抓「券後金額」的 50%。
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { MAX_REDEEM_RATIO, POINTS_TO_CURRENCY_RATE } from '../../constants/loyalty';
import { useThemeColors } from '../../hooks/useThemeColors';
import { fetchMyCoupons } from '../../services/coupons';
import { fetchLoyaltyBalance } from '../../services/loyalty';
import { submitDineInOrder } from '../../services/dineIn';
import { DineInCartItem, useDineInOrderStore } from '../../store/useDineInOrderStore';
import { Coupon } from '../../types';
import { getCouponStatus } from '../../utils/coupon';

export default function DineInCartScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const restaurantId = useDineInOrderStore((state) => state.restaurantId);
  const restaurantName = useDineInOrderStore((state) => state.restaurantName);
  const tableId = useDineInOrderStore((state) => state.tableId);
  const tableCode = useDineInOrderStore((state) => state.tableCode);
  const items = useDineInOrderStore((state) => state.items);
  const updateQuantity = useDineInOrderStore((state) => state.updateQuantity);
  const removeItem = useDineInOrderStore((state) => state.removeItem);
  const clear = useDineInOrderStore((state) => state.clear);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pointsInput, setPointsInput] = useState('');
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const [isCouponPickerOpen, setIsCouponPickerOpen] = useState(false);

  const estimatedTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const { data: pointsBalance } = useQuery({
    queryKey: ['loyalty-balance'],
    queryFn: fetchLoyaltyBalance,
  });

  // 沿用「我的」分頁「優惠券」區段同一個 ['myCoupons'] query key
  const { data: coupons } = useQuery<Coupon[]>({
    queryKey: ['myCoupons'],
    queryFn: fetchMyCoupons,
  });
  const usableCoupons = useMemo(
    () => (coupons ?? []).filter((c) => getCouponStatus(c) === 'active'),
    [coupons]
  );
  const selectedCoupon = usableCoupons.find((c) => c.id === selectedCouponId) ?? null;

  // 比照 app/cart.tsx：先套用券折扣（clamp 不小於 0）→ 點數折抵上限改抓「券後金額」的 50%
  const couponDiscount = selectedCoupon ? Math.min(selectedCoupon.discount_amount, estimatedTotal) : 0;
  const afterCouponTotal = Math.max(0, estimatedTotal - couponDiscount);

  const maxRedeemablePoints = Math.max(
    0,
    Math.min(pointsBalance ?? 0, Math.floor((afterCouponTotal * MAX_REDEEM_RATIO) / POINTS_TO_CURRENCY_RATE))
  );
  const pointsToUse = Math.min(Number(pointsInput) || 0, maxRedeemablePoints);
  const discountedTotal = Math.max(0, afterCouponTotal - pointsToUse * POINTS_TO_CURRENCY_RATE);

  const onSubmit = async () => {
    if (items.length === 0) {
      Alert.alert('提示', '請先加入品項再送出點餐');
      return;
    }
    if (!tableId) {
      Alert.alert('提示', '找不到桌號資訊，請重新選擇門市與桌號');
      router.replace('/dine-in/restaurant');
      return;
    }
    const requestedPoints = Number(pointsInput) || 0;
    if (requestedPoints > maxRedeemablePoints) {
      Alert.alert('點數超過上限', `最多可折抵 ${maxRedeemablePoints} 點（受餘額與可折抵金額 50% 上限限制）`);
      return;
    }
    setIsSubmitting(true);
    try {
      const order = await submitDineInOrder(
        tableId,
        items.map((item) => ({ menu_item_id: item.menuItemId, quantity: item.quantity })),
        pointsToUse > 0 ? pointsToUse : undefined,
        selectedCoupon ? selectedCoupon.id : undefined
      );
      clear();
      setPointsInput('');
      setSelectedCouponId(null);
      queryClient.invalidateQueries({ queryKey: ['my-dine-in-orders'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-balance'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['myCoupons'] });
      router.replace({
        pathname: '/dine-in/confirm',
        params: { orderId: String(order.id), tableNumber: tableCode },
      });
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
      } else if (status === 422) {
        Alert.alert('資料格式錯誤', detail || '點餐內容有誤，請重新確認');
      } else {
        Alert.alert('錯誤', detail || '送出點餐失敗，請稍後再試');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="restaurant-outline" size={48} color={colors.border} />
        <Text style={styles.emptyText}>點餐清單是空的</Text>
        <Pressable style={styles.menuLink} onPress={() => router.replace('/dine-in/menu')}>
          <Text style={styles.menuLinkText}>回菜單看看</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tableRow}>
        <Text style={styles.tableLabel}>{restaurantName}｜桌號 {tableCode}</Text>
        <Pressable
          onPress={() => router.push({
            pathname: '/dine-in/table',
            params: { restaurant_id: String(restaurantId), restaurant_name: restaurantName },
          })}
        >
          <Text style={styles.changeTableText}>更改桌號</Text>
        </Pressable>
      </View>

      <FlatList<DineInCartItem>
        data={items}
        keyExtractor={(item) => String(item.menuItemId)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.itemPrice}>${item.price}</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                >
                  <Ionicons name="remove" size={16} color={colors.text} />
                </Pressable>
                <Text style={styles.stepperValue}>{item.quantity}</Text>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                >
                  <Ionicons name="add" size={16} color={colors.text} />
                </Pressable>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeItem(item.menuItemId)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textSubtle} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      {/* 比照 app/cart.tsx 的做法，額外加緩衝避免 Android edge-to-edge 系統導覽列蓋住按鈕 */}
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
        <Text style={styles.totalHint}>僅供參考，實際金額以現場結帳為準</Text>
        <Pressable
          style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
          onPress={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.onTint} />
          ) : (
            <Text style={styles.submitButtonText}>送出點餐</Text>
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
  tableRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  tableLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  changeTableText: { fontSize: 13, color: colors.tint, fontWeight: '500' },

  listContent: { padding: 16 },
  itemCard: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12,
    padding: 12, marginBottom: 12,
  },
  itemInfo: { flex: 1 },
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
  submitButton: {
    backgroundColor: colors.tint, paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  submitButtonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },

  emptyContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, color: colors.textMuted, marginTop: 12, fontWeight: '600' },
  menuLink: { marginTop: 16 },
  menuLinkText: { color: colors.tint, fontSize: 14, fontWeight: '500' },
});
