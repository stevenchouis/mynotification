// app/dine-in/cart.tsx
// 堂食點餐流程第三步：本次點餐清單，調整數量／移除、送出訂單（POST /api/v1/dine-in-orders）。
// 比照 app/cart.tsx（網購商店購物車）的結構，但資料源是 useDineInOrderStore，送出成功後清空。
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { submitDineInOrder } from '../../services/dineIn';
import { DineInCartItem, useDineInOrderStore } from '../../store/useDineInOrderStore';

export default function DineInCartScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const tableNumber = useDineInOrderStore((state) => state.tableNumber);
  const items = useDineInOrderStore((state) => state.items);
  const updateQuantity = useDineInOrderStore((state) => state.updateQuantity);
  const removeItem = useDineInOrderStore((state) => state.removeItem);
  const clear = useDineInOrderStore((state) => state.clear);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const estimatedTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const onSubmit = async () => {
    if (items.length === 0) {
      Alert.alert('提示', '請先加入品項再送出點餐');
      return;
    }
    setIsSubmitting(true);
    try {
      const order = await submitDineInOrder(
        tableNumber,
        items.map((item) => ({ menu_item_id: item.menuItemId, quantity: item.quantity }))
      );
      clear();
      queryClient.invalidateQueries({ queryKey: ['my-dine-in-orders'] });
      router.replace({
        pathname: '/dine-in/confirm',
        params: { orderId: String(order.id), tableNumber: order.table_number },
      });
    } catch (error: any) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      if (status === 422) {
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
        <Text style={styles.tableLabel}>桌號 {tableNumber}</Text>
        <Pressable onPress={() => router.push('/dine-in/table')}>
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
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>預估小計</Text>
          <Text style={styles.totalValue}>${estimatedTotal.toFixed(2)}</Text>
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
