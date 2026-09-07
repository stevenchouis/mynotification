// app/dine-in/menu.tsx
// 堂食點餐流程第二步：菜單 Grid + 分類標籤，資料源是 GET /api/v1/menu-items（獨立於商店
// 的 194 筆商品，見 plan-dine-in-order.md）。這裡刻意不用 FlashList（跟 shop.tsx 不同）：
// 菜單筆數是有限的手動維護資料，不像商店 194 筆商品需要虛擬清單處理效能，改用一般
// ScrollView + flexWrap 排版——實測 FlashList v2 在筆數很少時會有 grid 版面計算異常
// （分類列下方出現一大塊空白、卡片被推到畫面下方）的問題，簡單資料量下直接避開比較省事。
// 卡片寬度刻意用百分比（'48%' + justifyContent: 'space-between'），不用 Dimensions 算出
// 精確像素寬度——實測用 JS 算好的固定像素寬度去對兩張卡片加間距，只要有捨入誤差，兩張
// 卡片的總寬度就會比容器實際寬度多出一點點，逼 Yoga 排版引擎把第二張卡片擠到下一列，
// 變成非預期的單欄排版；百分比寬度完全交給 Yoga 自己算，不會有這種誤差問題。
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import type { ImageStyle, StyleProp, ViewStyle } from 'react-native';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { fetchMenu } from '../../services/dineIn';
import { useDineInOrderStore } from '../../store/useDineInOrderStore';

const ALL_CATEGORY = '__all__';

// 部分菜單品項可能還沒設定 image_url（或圖片載入失敗），這種情況顯示一個圖示佔位框，
// 不要讓卡片上半部整塊留白看起來像沒做完
function MenuItemImage({ uri, style }: { uri: string; style: StyleProp<ImageStyle> }) {
  const colors = useThemeColors();
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={[style as StyleProp<ViewStyle>, { backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="restaurant-outline" size={28} color={colors.textSubtle} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      onError={() => setFailed(true)}
    />
  );
}

export default function DineInMenuScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const tableNumber = useDineInOrderStore((state) => state.tableNumber);
  const items = useDineInOrderStore((state) => state.items);
  const addItem = useDineInOrderStore((state) => state.addItem);
  const updateQuantity = useDineInOrderStore((state) => state.updateQuantity);
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);

  const { data: menuItems = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['menu-items'],
    queryFn: fetchMenu,
  });

  const availableItems = useMemo(() => menuItems.filter((item) => item.is_available), [menuItems]);

  const categories = useMemo(
    () => Array.from(new Set(availableItems.map((item) => item.category))).sort(),
    [availableItems]
  );

  const filteredItems = useMemo(
    () => availableItems.filter(
      (item) => selectedCategory === ALL_CATEGORY || item.category === selectedCategory
    ),
    [availableItems, selectedCategory]
  );

  const quantityOf = (menuItemId: number) =>
    items.find((item) => item.menuItemId === menuItemId)?.quantity ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.tableLabel}>桌號 {tableNumber}</Text>
        <Pressable style={styles.cartButton} onPress={() => router.push('/dine-in/cart')}>
          <Ionicons name="receipt-outline" size={22} color={colors.text} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 48) + 32 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* 分類標籤改成主 ScrollView 內部的第一個子元素（比照 shop.tsx 把分類標籤放進
            FlashList 的 ListHeaderComponent、跟主要內容同屬一個可捲動區域的做法），
            不再是跟主要內容並排的獨立 ScrollView 手足元素——實測兩個垂直排列的 ScrollView
            手足（一個水平、一個垂直）在 Android 上會讓垂直那個的內容位置計算異常，
            分類列下方出現一大塊空白、內容被推到畫面下方 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          <Pressable style={styles.categoryTab} onPress={() => setSelectedCategory(ALL_CATEGORY)}>
            <Text style={[styles.categoryText, selectedCategory === ALL_CATEGORY && styles.categoryTextActive]}>
              全部
            </Text>
          </Pressable>
          {categories.map((category) => (
            <Pressable key={category} style={styles.categoryTab} onPress={() => setSelectedCategory(category)}>
              <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>
                {category}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : isError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>菜單載入失敗，請下拉重新整理</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>此分類目前沒有品項</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredItems.map((item) => {
              const quantity = quantityOf(item.id);
              return (
                <View key={item.id} style={styles.card}>
                  <MenuItemImage uri={item.image_url} style={styles.cardImage} />
                  <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.cardPrice}>${item.price}</Text>
                  {quantity === 0 ? (
                    <Pressable style={styles.addButton} onPress={() => addItem(item, 1)}>
                      <Text style={styles.addButtonText}>加入</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.stepperRow}>
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() => updateQuantity(item.id, quantity - 1)}
                      >
                        <Ionicons name="remove" size={16} color={colors.text} />
                      </Pressable>
                      <Text style={styles.stepperValue}>{quantity}</Text>
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() => updateQuantity(item.id, quantity + 1)}
                      >
                        <Ionicons name="add" size={16} color={colors.text} />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16,
  },
  tableLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  cartButton: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  cartBadgeText: { fontSize: 10, color: colors.white, fontWeight: '700' },

  categoryScroll: { marginTop: 14, marginBottom: 4, paddingHorizontal: 16 },
  categoryTab: { marginRight: 20, paddingBottom: 8 },
  categoryText: { fontSize: 14, color: colors.textSubtle },
  categoryTextActive: { color: colors.text, fontWeight: '600' },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', marginBottom: 16 },
  cardImage: { width: '100%', aspectRatio: 1, borderRadius: 10, marginBottom: 8, backgroundColor: colors.surface },
  cardName: { fontSize: 13, color: colors.text, fontWeight: '500', lineHeight: 18 },
  cardPrice: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 8, fontWeight: '600' },

  addButton: {
    backgroundColor: colors.tint, borderRadius: 8, paddingVertical: 8, alignItems: 'center',
  },
  addButtonText: { color: colors.onTint, fontSize: 13, fontWeight: '600' },

  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  stepperButton: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  stepperValue: { fontSize: 14, fontWeight: '600', color: colors.text, minWidth: 18, textAlign: 'center' },

  emptyState: { paddingTop: 24, alignItems: 'center' },
  emptyStateText: { fontSize: 13, color: colors.textSubtle },
});
