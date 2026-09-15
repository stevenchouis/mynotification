// app/(drawer)/(tabs)/shop.tsx
// 商店分頁：打自家後端 GET /api/v1/products（一次抓全部，目前 194 筆，資料量小），
// 分類標籤與搜尋列都是前端本機即時過濾這份已抓到的資料，不會每次切分類/打字都重新打 API。
// 跟首頁的 DummyJSON 展示頁（home.tsx／services/products.ts）刻意分開、不共用程式碼。
// 搜尋列聚焦時顯示的「最近搜尋／熱門搜尋」見 plan-search.md（2026-09-15）。
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, TextInput, View
} from 'react-native';

import Text from '../../../components/Text';
import { ThemeColors } from '../../../constants/Colors';
import { useShopFavorites } from '../../../hooks/useShopFavorites';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { fetchSearchSuggestions } from '../../../services/search';
import { fetchShopProducts } from '../../../services/shop';
import { useCartStore } from '../../../store/useCartStore';
import { useSearchHistoryStore } from '../../../store/useSearchHistoryStore';
import { ShopProduct } from '../../../types/shop';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_WIDTH = SCREEN_WIDTH - 32;
const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const GRID_CARD_WIDTH = (CONTENT_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

const ALL_CATEGORY = '__all__';

interface ShopHeaderProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  query: string;
  onChangeQuery: (query: string) => void;
  onSubmitQuery: (query: string) => void;
  cartCount: number;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  isSearchFocused: boolean;
  onFocusSearch: () => void;
  onBlurSearch: () => void;
  recentKeywords: string[];
  onClearHistory: () => void;
  suggestions: string[];
}

function ShopHeader({
  categories, selectedCategory, onSelectCategory, query, onChangeQuery, onSubmitQuery, cartCount, colors, styles,
  isSearchFocused, onFocusSearch, onBlurSearch, recentKeywords, onClearHistory, suggestions,
}: ShopHeaderProps) {
  const router = useRouter();
  // 聚焦搜尋列、且還沒打字時才顯示「最近搜尋／熱門搜尋」建議面板；開始打字或失焦後自動收起
  const showSuggestionPanel = isSearchFocused && query.trim().length === 0
    && (recentKeywords.length > 0 || suggestions.length > 0);

  return (
    <View>
      <Pressable style={styles.dineInBanner} onPress={() => router.push('/dine-in/restaurant')}>
        <Ionicons name="restaurant" size={20} color={colors.onTint} />
        <Text style={styles.dineInBannerText}>到店點餐</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.onTint} />
      </Pressable>
      <View style={styles.divider} />

      <View style={styles.topRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜尋商店商品"
            placeholderTextColor={colors.textSubtle}
            value={query}
            onChangeText={onChangeQuery}
            onFocus={onFocusSearch}
            onBlur={onBlurSearch}
            onSubmitEditing={() => onSubmitQuery(query)}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => onChangeQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
            </Pressable>
          )}
        </View>
        <Pressable style={styles.cartButton} onPress={() => router.push('/cart')}>
          <Ionicons name="cart-outline" size={22} color={colors.text} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {showSuggestionPanel && (
        <View style={styles.suggestionPanel}>
          {recentKeywords.length > 0 && (
            <View style={styles.suggestionSection}>
              <View style={styles.suggestionSectionHeader}>
                <Text style={styles.suggestionSectionTitle}>最近搜尋</Text>
                <Pressable onPress={onClearHistory} hitSlop={8}>
                  <Text style={styles.suggestionClearText}>清除</Text>
                </Pressable>
              </View>
              <View style={styles.chipRow}>
                {recentKeywords.map((keyword) => (
                  <Pressable
                    key={keyword}
                    style={styles.chip}
                    onPress={() => onSubmitQuery(keyword)}
                  >
                    <Text style={styles.chipText}>{keyword}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {suggestions.length > 0 && (
            <View style={styles.suggestionSection}>
              <Text style={styles.suggestionSectionTitle}>熱門搜尋</Text>
              <View style={styles.chipRow}>
                {suggestions.map((keyword) => (
                  <Pressable
                    key={keyword}
                    style={[styles.chip, styles.chipHot]}
                    onPress={() => onSubmitQuery(keyword)}
                  >
                    <Ionicons name="flame" size={12} color={colors.tint} />
                    <Text style={styles.chipText}>{keyword}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        <Pressable style={styles.categoryTab} onPress={() => onSelectCategory(ALL_CATEGORY)}>
          <Text style={[styles.categoryText, selectedCategory === ALL_CATEGORY && styles.categoryTextActive]}>
            全部
          </Text>
          {selectedCategory === ALL_CATEGORY && <View style={styles.categoryUnderline} />}
        </Pressable>
        {categories.map((category) => (
          <Pressable key={category} style={styles.categoryTab} onPress={() => onSelectCategory(category)}>
            <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>
              {category}
            </Text>
            {selectedCategory === category && <View style={styles.categoryUnderline} />}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function ShopScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const { favoriteIds, toggleFavorite } = useShopFavorites();

  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [query, setQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // 跟 app/search.tsx（首頁展示頁搜尋，2026-09-06 已上線）共用同一個 store／service，
  // 「最近搜尋」記錄不分展示頁/商店頁是同一份清單，熱門標籤也是同一份後端資料
  const recentKeywords = useSearchHistoryStore((state) => state.keywords);
  const addKeyword = useSearchHistoryStore((state) => state.addKeyword);
  const clearHistory = useSearchHistoryStore((state) => state.clearHistory);

  // fetchSearchSuggestions 內建 try/catch + FALLBACK_KEYWORDS，API 失敗或資料表是空的
  // 都會回傳非空陣列，不需要額外處理失敗態
  const { data: suggestions = [] } = useQuery({
    queryKey: ['search-suggestions'],
    queryFn: fetchSearchSuggestions,
  });

  const { data: products = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['shop-products'],
    queryFn: fetchShopProducts,
  });

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = selectedCategory === ALL_CATEGORY || product.category === selectedCategory;
      // 比對範圍涵蓋標題跟描述（2026-09-15 加強，原本只比對標題）
      const matchesQuery = keyword.length === 0
        || product.title.toLowerCase().includes(keyword)
        || product.description.toLowerCase().includes(keyword);
      return matchesCategory && matchesQuery;
    });
  }, [products, selectedCategory, query]);

  // 點擊最近搜尋／熱門標籤，或在搜尋列按下送出：帶入關鍵字、記錄進最近搜尋、收起建議面板
  const handleSubmitQuery = (keyword: string) => {
    setQuery(keyword);
    addKeyword(keyword);
    setIsSearchFocused(false);
  };

  return (
    <FlashList<ShopProduct>
      data={filteredProducts}
      keyExtractor={(item) => String(item.id)}
      numColumns={GRID_COLUMNS}
      ListHeaderComponent={
        <ShopHeader
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          query={query}
          onChangeQuery={setQuery}
          onSubmitQuery={handleSubmitQuery}
          cartCount={cartCount}
          colors={colors}
          styles={styles}
          isSearchFocused={isSearchFocused}
          onFocusSearch={() => setIsSearchFocused(true)}
          onBlurSearch={() => setIsSearchFocused(false)}
          recentKeywords={recentKeywords}
          onClearHistory={clearHistory}
          suggestions={suggestions}
        />
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : isError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>商品載入失敗，請下拉重新整理</Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>找不到符合條件的商品</Text>
          </View>
        )
      }
      // 捲到底的「已經到底了」提示，只有真的有商品可以捲的時候才顯示——
      // 用 filteredProducts 而不是 isLoading/isError 判斷，避免跟 ListEmptyComponent 的訊息同時出現
      ListFooterComponent={
        filteredProducts.length > 0 ? (
          <View style={styles.listFooter}>
            <Ionicons name="checkmark-done-outline" size={18} color={colors.textSubtle} />
            <Text style={styles.listFooterText}>以下沒有其他商品了</Text>
          </View>
        ) : null
      }
      contentContainerStyle={styles.listContent}
      refreshing={isRefetching}
      onRefresh={refetch}
      renderItem={({ item, index }) => {
        const isLastInRow = (index + 1) % GRID_COLUMNS === 0;
        const isFavorite = favoriteIds.has(item.id);
        const isOutOfStock = item.stock <= 0;
        return (
          <Pressable
            style={[styles.productCard, { marginRight: isLastInRow ? 0 : GRID_GAP }]}
            onPress={() => router.push({ pathname: '/shop/[id]', params: { id: String(item.id) } })}
          >
            <View>
              {/* 缺貨時圖片調暗，跟「缺貨」徽章一起提示，不用進商品詳情頁才看得出來 */}
              <Image
                source={{ uri: item.thumbnail }}
                style={[styles.productThumb, isOutOfStock && styles.productThumbOutOfStock]}
                contentFit="cover"
              />
              {isOutOfStock && (
                <View style={styles.outOfStockBadge}>
                  <Text style={styles.outOfStockBadgeText}>缺貨</Text>
                </View>
              )}
              <Pressable
                style={styles.favoriteButton}
                onPress={() => toggleFavorite(item)}
                hitSlop={8}
              >
                <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={16} color={isFavorite ? colors.danger : colors.textSubtle} />
              </Pressable>
            </View>
            <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.productPrice}>${item.price}</Text>
            <Text style={isOutOfStock ? styles.productStockTextOutOfStock : styles.productStockText}>
              {isOutOfStock ? '缺貨中' : `庫存：${item.stock}`}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  listContent: { backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  dineInBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.tint, marginHorizontal: 16, marginTop: 16, paddingVertical: 12,
    borderRadius: 12,
  },
  dineInBannerText: { color: colors.onTint, fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16, marginTop: 16, marginBottom: 4 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 10,
    backgroundColor: colors.surface, paddingHorizontal: 12, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  cartButton: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  cartBadgeText: { fontSize: 10, color: colors.white, fontWeight: '700' },

  suggestionPanel: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 14, gap: 12,
  },
  suggestionSection: { gap: 8 },
  suggestionSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  suggestionSectionTitle: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  suggestionClearText: { fontSize: 12, color: colors.tint },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
  },
  chipHot: { borderWidth: 1, borderColor: colors.tint },
  chipText: { fontSize: 12, color: colors.text },

  categoryScroll: { marginBottom: 16 },
  categoryTab: { alignItems: 'center', marginRight: 20, paddingBottom: 8 },
  categoryText: { fontSize: 14, color: colors.textSubtle },
  categoryTextActive: { color: colors.text, fontWeight: '600' },
  categoryUnderline: { marginTop: 6, height: 2, width: '100%', backgroundColor: colors.accent, borderRadius: 1 },

  productCard: { width: GRID_CARD_WIDTH, marginBottom: GRID_GAP + 6 },
  productThumb: { width: GRID_CARD_WIDTH, height: GRID_CARD_WIDTH, borderRadius: 10, marginBottom: 8, backgroundColor: colors.surface },
  productThumbOutOfStock: { opacity: 0.4 },
  outOfStockBadge: {
    position: 'absolute', left: 0, right: 0, top: '50%', marginTop: -12,
    alignItems: 'center', justifyContent: 'center',
  },
  outOfStockBadgeText: {
    color: colors.white, backgroundColor: 'rgba(0,0,0,0.6)', fontSize: 12, fontWeight: '700',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, overflow: 'hidden',
  },
  favoriteButton: {
    position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center'
  },
  productTitle: { fontSize: 13, color: colors.text, fontWeight: '500', lineHeight: 18 },
  productPrice: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  productStockText: { fontSize: 11, color: colors.textSubtle, marginTop: 2 },
  productStockTextOutOfStock: { fontSize: 11, color: colors.danger, marginTop: 2, fontWeight: '600' },

  emptyState: { paddingTop: 24, alignItems: 'center' },
  emptyStateText: { fontSize: 13, color: colors.textSubtle },

  listFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 20,
  },
  listFooterText: { fontSize: 12, color: colors.textSubtle },
});
