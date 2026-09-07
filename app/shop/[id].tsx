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

  return (
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
      {/* Android edge-to-edge 下內容會畫到系統導覽列（手勢列或三按鈕列）後面，「加入購物車」
          按鈕若貼著螢幕最下緣會被蓋住、容易誤觸；除了 insets.bottom 本身，再加一段固定緩衝
          （32）確保視覺上跟系統列有明顯間距，不會看起來還是貼在一起 */}
      <View style={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.category}>{product.category}</Text>
        <Text style={styles.title}>{product.title}</Text>
        <Text style={styles.price}>${product.price}</Text>
        <Text style={styles.description}>{product.description}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>數量</Text>
        <View style={styles.stepperRow}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.stepperValue}>{quantity}</Text>
          <Pressable style={styles.stepperButton} onPress={() => setQuantity((q) => q + 1)}>
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
        </View>

        <Pressable style={styles.addButton} onPress={onAddToCart}>
          <Text style={styles.addButtonText}>{justAdded ? '已加入購物車' : '加入購物車'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
  description: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },
  label: { fontSize: 14, color: colors.textMuted, marginBottom: 10, fontWeight: '600' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  stepperButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  stepperValue: { fontSize: 16, fontWeight: '600', color: colors.text, minWidth: 24, textAlign: 'center' },
  addButton: {
    backgroundColor: colors.tint, paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  addButtonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },
  errorText: { fontSize: 15, color: colors.danger, marginBottom: 16, textAlign: 'center' },
  button: {
    backgroundColor: colors.tint, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12,
  },
  buttonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },
});
