// app/(drawer)/(tabs)/favorites.tsx
// 我的收藏：只存在裝置本機（見 store/useFavoritesStore.ts），收藏的是首頁展示用的
// DummyJSON 商品 id，換裝置/重裝 App 會消失，跟自家後端無關。
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import Text from '../../../components/Text';
import { ThemeColors } from '../../../constants/Colors';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { fetchProductById } from '../../../services/products';
import { useFavoritesStore } from '../../../store/useFavoritesStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const CONTENT_WIDTH = SCREEN_WIDTH - 32;
const CARD_WIDTH = (CONTENT_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

export default function FavoritesScreen() {
  const favoriteIds = useFavoritesStore((state) => state.favoriteIds);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const results = useQueries({
    queries: favoriteIds.map((id) => ({
      queryKey: ['product', id],
      queryFn: () => fetchProductById(id),
    })),
  });
  const products = results.map((r) => r.data).filter((p): p is NonNullable<typeof p> => !!p);

  if (favoriteIds.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="heart-outline" size={48} color={colors.border} />
        <Text style={styles.emptyText}>還沒有收藏的商品</Text>
        <Text style={styles.emptySubtext}>到首頁點商品卡片右上角的愛心加入收藏</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {products.map((product, index) => {
          const isLastInRow = (index + 1) % GRID_COLUMNS === 0;
          return (
            <View key={product.id} style={[styles.card, { marginRight: isLastInRow ? 0 : GRID_GAP }]}>
              <View>
                <Image source={{ uri: product.thumbnail }} style={styles.thumb} contentFit="cover" />
                <Pressable
                  style={styles.favoriteButton}
                  onPress={() => toggleFavorite(product.id)}
                  hitSlop={8}
                >
                  <Ionicons name="heart" size={16} color={colors.danger} />
                </Pressable>
              </View>
              <Text style={styles.title} numberOfLines={2}>{product.title}</Text>
              <Text style={styles.price}>${product.price}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { width: CARD_WIDTH, marginBottom: GRID_GAP + 6 },
  thumb: { width: CARD_WIDTH, height: CARD_WIDTH, borderRadius: 10, backgroundColor: colors.surface, marginBottom: 8 },
  favoriteButton: {
    position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center'
  },
  title: { fontSize: 13, color: colors.text, fontWeight: '500', lineHeight: 18 },
  price: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  emptyContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, color: colors.textMuted, marginTop: 12, fontWeight: '600' },
  emptySubtext: { fontSize: 12, color: colors.textSubtle, marginTop: 6, textAlign: 'center' },
});
