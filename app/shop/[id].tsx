// app/shop/[id].tsx
// 商品詳情頁：選數量、加入購物車。跟 app/coupon/[id].tsx 一樣是掛在根 Stack 底下的詳情頁。
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useShopFavorites } from '../../hooks/useShopFavorites';
import { useThemeColors } from '../../hooks/useThemeColors';
import { fetchShopProductById } from '../../services/shop';
import { useCartStore } from '../../store/useCartStore';

export default function ShopProductDetailScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const addItem = useCartStore((state) => state.addItem);
  const { favoriteIds, toggleFavorite } = useShopFavorites();

  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['shop-product', id],
    queryFn: () => fetchShopProductById(Number(id)),
  });

  const onAddToCart = () => {
    if (!product) return;
    addItem(product, quantity);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>找不到這個商品</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>返回</Text>
        </Pressable>
      </View>
    );
  }

  const isFavorite = favoriteIds.has(product.id);
  const isOutOfStock = product.stock <= 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View>
          <Image source={{ uri: product.thumbnail }} style={styles.image} contentFit="cover" />
          <Pressable
            style={styles.favoriteButton}
            onPress={() => toggleFavorite(product)}
            hitSlop={8}
          >
            <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? colors.danger : colors.textSubtle} />
          </Pressable>
        </View>
        {/* 底部固定列（數量／加入購物車）另外估了高度墊在這裡，避免捲到底時最後一段文字被蓋住 */}
        <View style={[styles.body, { paddingBottom: BOTTOM_BAR_ESTIMATED_HEIGHT + insets.bottom }]}>
          <Text style={styles.category}>{product.category}</Text>
          <Text style={styles.title}>{product.title}</Text>
          <Text style={styles.price}>${product.price}</Text>
          {isOutOfStock ? (
            <Text style={styles.outOfStockText}>缺貨中</Text>
          ) : (
            <Text style={styles.stockText}>庫存：{product.stock}</Text>
          )}
          <Text style={styles.description}>{product.description}</Text>
        </View>
      </ScrollView>

      {/* 數量／加入購物車固定浮動在畫面最下方（不隨內容捲動），永遠貼著安全區上緣，
          不會被 Android edge-to-edge 的系統導覽列（手勢列或三按鈕列）蓋住 */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.stepperRow}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={isOutOfStock}
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.stepperValue}>{quantity}</Text>
          <Pressable
            style={styles.stepperButton}
            onPress={() => setQuantity((q) => Math.min(product.stock, q + 1))}
            disabled={isOutOfStock}
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
        </View>

        <Pressable
          style={[styles.addButton, isOutOfStock && styles.addButtonDisabled]}
          onPress={onAddToCart}
          disabled={isOutOfStock}
        >
          <Text style={styles.addButtonText}>
            {isOutOfStock ? '缺貨中' : justAdded ? '已加入購物車' : '加入購物車'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// 底部固定列的抓高估算值（上下 padding + 控制項高度），用來墊 ScrollView 內容的 paddingBottom，
// 沒有用 onLayout 量實際高度是因為列內元素高度固定、不會動態變化，用估算值就夠準確、也更單純
const BOTTOM_BAR_ESTIMATED_HEIGHT = 100;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { backgroundColor: colors.background, flexGrow: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 },
  image: { width: '100%', aspectRatio: 1, backgroundColor: colors.surface },
  favoriteButton: {
    position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center'
  },
  body: { padding: 20 },
  category: { fontSize: 12, color: colors.textSubtle, textTransform: 'capitalize' },
  title: { fontSize: 20, fontWeight: '600', color: colors.text, marginTop: 6 },
  price: { fontSize: 22, fontWeight: '700', color: colors.tint, marginTop: 8 },
  stockText: { fontSize: 13, color: colors.textSubtle, marginTop: 4 },
  outOfStockText: { fontSize: 13, color: colors.danger, fontWeight: '600', marginTop: 4 },
  description: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: 12 },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border,
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  stepperValue: { fontSize: 16, fontWeight: '600', color: colors.text, minWidth: 24, textAlign: 'center' },
  addButton: {
    flex: 1, backgroundColor: colors.tint, paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  addButtonDisabled: { backgroundColor: colors.textSubtle },
  addButtonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },
  errorText: { fontSize: 15, color: colors.danger, marginBottom: 16, textAlign: 'center' },
  button: {
    backgroundColor: colors.tint, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12,
  },
  buttonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },
});
