// app/(drawer)/(tabs)/home.tsx
// 首頁改版：測試 @shopify/flash-list、react-native-reanimated-carousel（輪播）、
// 手刻 Marquee（跑馬燈）三個 UI 元件，版面配置參考 MUJI 官網（大留白、無襯線字、木質/大地色系、極簡卡片列表）。
// 商品卡片與分類標籤資料來自公開測試 API（DummyJSON），僅供前端展示用；輪播橫幅仍是假資料，
// 之後若要接真實內容（行銷橫幅、真正的商品/優惠），需要後端新增對應的資料模型與 API。
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { DrawerActions } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, View
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Carousel } from 'react-native-reanimated-carousel';
import { Image } from 'expo-image';

import Text from '../../../components/Text';
import { ThemeColors } from '../../../constants/Colors';
import { useThemeColors } from '../../../hooks/useThemeColors';
import {
  ALL_CATEGORY, fetchCategories, fetchProducts, Product, ProductCategory, PRODUCTS_API
} from '../../../services/products';
import { fetchPromoBanners } from '../../../services/promotions';
import { useFavoritesStore } from '../../../store/useFavoritesStore';
import { useNotificationStore } from '../../../store/useNotificationStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_WIDTH = SCREEN_WIDTH - 32;

// 商品 Grid 版面：每列 3 張卡片
const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const GRID_CARD_WIDTH = (CAROUSEL_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

// 商品推薦：水平 ScrollView，卡片寬度約螢幕 62%，讓下一張卡片露出一點，提示可以繼續滑
const RECOMMEND_CARD_WIDTH = SCREEN_WIDTH * 0.62;
const RECOMMEND_GAP = 14;

interface BannerSlide {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  imageUrl?: string;
}

// 輪播文案是假資料，背景圖改抓 DummyJSON 商品的真實照片；color 是圖片載入前/失敗時的底色。
// 這組顏色是輪播「內容」本身的設計配色（跟行銷素材綁在一起），刻意不隨深色模式切換，
// 比照大部分 App 促銷輪播圖維持品牌一致外觀的做法。
const BANNER_COPY: Omit<BannerSlide, 'id' | 'imageUrl'>[] = [
  { title: '春季優惠開跑', subtitle: '即日起至月底，全館 9 折', color: '#EDE7DD' },
  { title: '新品上架', subtitle: '本週精選新品搶先看', color: '#DCE3D5' },
  { title: '會員專屬活動', subtitle: '加入會員享更多回饋', color: '#E3D9CE' },
  { title: '簡約生活提案', subtitle: '為日常增添一些留白', color: '#D9D2C7' },
];

async function fetchBannerImages(): Promise<string[]> {
  const res = await fetch(`${PRODUCTS_API}/products?limit=${BANNER_COPY.length}&select=images`);
  if (!res.ok) throw new Error('無法取得輪播圖片');
  const data: { products: { images: string[] }[] } = await res.json();
  return data.products.map((p) => p.images?.[0]).filter((url): url is string => !!url);
}

const MARQUEE_TEXT = '🌿 新優惠券已上架　｜　會員日活動開跑　｜　感謝您使用 mynotification　｜　';

interface QuickAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: '/coupons' | '/favorites' | '/inbox' | '/settings' | '/faq' | '/about' | '/privacy';
  isDrawerToggle?: boolean;
}

// 4x2 功能捷徑：全部對應 App 內既有畫面，不是假連結
const QUICK_ACTIONS: QuickAction[] = [
  { id: 'coupons', label: '我的', icon: 'pricetag-outline', route: '/coupons' },
  { id: 'favorites', label: '我的收藏', icon: 'heart-outline', route: '/favorites' },
  { id: 'inbox', label: '通知中心', icon: 'notifications-outline', route: '/inbox' },
  { id: 'settings', label: '帳號設定', icon: 'settings-outline', route: '/settings' },
  { id: 'faq', label: '常見問題', icon: 'help-circle-outline', route: '/faq' },
  { id: 'about', label: '關於此App', icon: 'information-circle-outline', route: '/about' },
  { id: 'privacy', label: '隱私權政策', icon: 'shield-checkmark-outline', route: '/privacy' },
  { id: 'more', label: '全部服務', icon: 'grid-outline', isDrawerToggle: true },
];

interface PromoSlide {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  color: string;
  imageUrl?: string;
}

// 小型活動輪播：內容改由後端資料庫提供（services/promotions.ts 的 fetchPromoBanners，
// API 契約已跟 back-end session 確認定案）。以下是改版前的舊寫法，留著對照：
//
// const PROMO_COPY: Omit<PromoSlide, 'id' | 'imageUrl'>[] = [
//   { tag: '限時', title: '9 月會員日', subtitle: '單筆消費滿 $999 折 $100', color: '#F3EDE4' },
//   { tag: '新品', title: '秋冬選物特輯', subtitle: '本季新品，即日起搶先看', color: '#EDE2D3' },
//   { tag: '好禮', title: '集點兌換', subtitle: '消費集點，兌換生活好禮', color: '#E3D9CE' },
// ];
//
// async function fetchPromoImages(): Promise<string[]> {
//   const res = await fetch(
//     `${PRODUCTS_API}/products?limit=${PROMO_COPY.length}&skip=${BANNER_COPY.length}&select=images`
//   );
//   if (!res.ok) throw new Error('無法取得輪播圖片');
//   const data: { products: { images: string[] }[] } = await res.json();
//   return data.products.map((p) => p.images?.[0]).filter((url): url is string => !!url);
// }

// Fisher-Yates 洗牌，回傳新陣列，不修改原本的陣列
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 手刻的跑馬燈：把文字重複兩份接在一起，動畫跑到第一份文字的寬度時無縫接回起點
function Marquee() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (textWidth === 0) return;
    translateX.value = 0;
    translateX.value = withRepeat(
      withTiming(-textWidth, { duration: textWidth * 20, easing: Easing.linear }),
      -1,
      false
    );
  }, [textWidth, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.marqueeContainer}>
      <Animated.View style={[styles.marqueeTrack, animatedStyle]}>
        <Text style={styles.marqueeText} onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}>
          {MARQUEE_TEXT}
        </Text>
        <Text style={styles.marqueeText}>{MARQUEE_TEXT}</Text>
      </Animated.View>
    </View>
  );
}

// 首頁搜尋列：純導航用的假輸入框，點下去 push 進 app/search.tsx 才是真正的輸入框
function HomeSearchBar() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={styles.searchBar} onPress={() => router.push('/search')}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <Text style={styles.searchBarPlaceholder}>搜尋商品</Text>
    </Pressable>
  );
}

// 4x2 功能 Grid：8 個入口對應 App 內既有畫面，通知入口的紅點讀 useNotificationStore 的即時未讀數
function QuickActionsGrid() {
  const router = useRouter();
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  const handlePress = (action: QuickAction) => {
    if (action.isDrawerToggle) {
      navigation.dispatch(DrawerActions.openDrawer());
      return;
    }
    if (action.route) {
      router.push(action.route);
    }
  };

  return (
    <View style={styles.quickGrid}>
      {QUICK_ACTIONS.map((action) => (
        <Pressable key={action.id} style={styles.quickAction} onPress={() => handlePress(action)}>
          <View style={styles.quickIconCircle}>
            <Ionicons name={action.icon} size={22} color={colors.textMuted} />
            {action.id === 'inbox' && unreadCount > 0 && (
              <View style={styles.quickBadge}>
                <Text style={styles.quickBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.quickLabel} numberOfLines={1}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// 小型活動輪播：跟大輪播共用 Carousel 元件，只是高度縮小、左文案右圖片的構圖
function PromoCarousel({ banners }: { banners: PromoSlide[] }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <View style={styles.carouselWrapper}>
      <Carousel
        style={{ width: CAROUSEL_WIDTH, height: 88 }}
        data={banners}
        loop
        autoplay
        autoplayInterval={4000}
        keyExtractor={(item) => item.id}
        onSnapToItem={setActiveIndex}
        renderItem={({ item }) => (
          <View style={[styles.promoSlide, { backgroundColor: item.color }]}>
            <View style={styles.promoTextGroup}>
              <View style={styles.promoTagPill}>
                <Text style={styles.promoTagText}>{item.tag}</Text>
              </View>
              <Text style={styles.promoTitle}>{item.title}</Text>
              <Text style={styles.promoSubtitle} numberOfLines={1}>{item.subtitle}</Text>
            </View>
            {item.imageUrl && (
              <Image source={{ uri: item.imageUrl }} style={styles.promoImage} contentFit="cover" />
            )}
          </View>
        )}
      />
      <View style={styles.dotsRow}>
        {banners.map((banner, index) => (
          <View key={banner.id} style={[styles.dot, index === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

// 收藏愛心按鈕，商品 Grid 卡片與商品推薦卡片共用
function FavoriteButton({ productId, style }: { productId: number; style?: object }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isFavorite = useFavoritesStore((state) => state.favoriteIds.includes(productId));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  return (
    <Pressable
      style={[styles.favoriteButton, style]}
      onPress={() => toggleFavorite(productId)}
      hitSlop={8}
    >
      <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={16} color={isFavorite ? colors.danger : colors.textSubtle} />
    </Pressable>
  );
}

// 水平 ScrollView 測試：商品推薦卡片列，下方用一條依捲動比例伸縮/位移的細長條取代原生捲軸樣式
function ProductRecommendations({ products }: { products: Product[] }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [scrollX, setScrollX] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const maxScroll = Math.max(contentWidth - viewportWidth, 1);
  const thumbWidthRatio = contentWidth > 0 ? Math.min(1, viewportWidth / contentWidth) : 1;
  const thumbLeftRatio = Math.min(1, Math.max(0, scrollX / maxScroll)) * (1 - thumbWidthRatio);

  if (products.length === 0) return null;

  return (
    <View>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionAccentBar} />
        <Text style={styles.sectionTitle}>商品推薦</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={RECOMMEND_CARD_WIDTH + RECOMMEND_GAP}
        onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentWidth(w)}
        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
      >
        {products.map((product, index) => (
          <View
            key={product.id}
            style={[styles.recommendCard, { marginRight: index === products.length - 1 ? 0 : RECOMMEND_GAP }]}
          >
            <View>
              <Image source={{ uri: product.thumbnail }} style={styles.recommendImage} contentFit="cover" />
              <FavoriteButton productId={product.id} style={styles.recommendFavoriteButton} />
            </View>
            <Text style={styles.recommendTitle} numberOfLines={1}>{product.title}</Text>
            <Text style={styles.recommendDescription} numberOfLines={2}>{product.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.scrollTrack}>
        <View style={[styles.scrollThumb, { width: `${thumbWidthRatio * 100}%`, left: `${thumbLeftRatio * 100}%` }]} />
      </View>
    </View>
  );
}

interface HomeHeaderProps {
  banners: BannerSlide[];
  promoBanners: PromoSlide[];
  categories: ProductCategory[];
  isCategoriesLoading: boolean;
  selectedCategory: string;
  onSelectCategory: (slug: string) => void;
}

function HomeHeader({ banners, promoBanners, categories, isCategoriesLoading, selectedCategory, onSelectCategory }: HomeHeaderProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <View>
      <Text style={styles.greeting}>歡迎回來</Text>
      <Text style={styles.greetingSubtitle}>今天也為生活留一點空白</Text>

      <HomeSearchBar />
      <PromoCarousel banners={promoBanners} />
      <QuickActionsGrid />

      <View style={styles.carouselWrapper}>
        <Carousel
          style={{ width: CAROUSEL_WIDTH, height: 160 }}
          data={banners}
          loop
          autoplay
          autoplayInterval={3000}
          keyExtractor={(item) => item.id}
          onSnapToItem={setActiveIndex}
          renderItem={({ item }) => (
            <View style={[styles.bannerSlide, { backgroundColor: item.color }]}>
              {item.imageUrl && (
                <Image source={{ uri: item.imageUrl }} style={styles.bannerImage} contentFit="cover" />
              )}
              <View style={styles.bannerScrim} />
              <Text style={styles.bannerTitle}>{item.title}</Text>
              <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
            </View>
          )}
        />
        <View style={styles.dotsRow}>
          {banners.map((banner, index) => (
            <View key={banner.id} style={[styles.dot, index === activeIndex && styles.dotActive]} />
          ))}
        </View>
      </View>

      <Marquee />

      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionAccentBar} />
        <Text style={styles.sectionTitle}>商品分類</Text>
      </View>

      {isCategoriesLoading ? (
        <ActivityIndicator style={{ marginVertical: 12 }} color={colors.accent} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          <Pressable
            style={styles.categoryTab}
            onPress={() => onSelectCategory(ALL_CATEGORY)}
          >
            <Text style={[styles.categoryText, selectedCategory === ALL_CATEGORY && styles.categoryTextActive]}>
              全部
            </Text>
            {selectedCategory === ALL_CATEGORY && <View style={styles.categoryUnderline} />}
          </Pressable>
          {categories.map((category) => (
            <Pressable
              key={category.slug}
              style={styles.categoryTab}
              onPress={() => onSelectCategory(category.slug)}
            >
              <Text style={[styles.categoryText, selectedCategory === category.slug && styles.categoryTextActive]}>
                {category.name}
              </Text>
              {selectedCategory === category.slug && <View style={styles.categoryUnderline} />}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);

  const { data: bannerImages = [] } = useQuery({
    queryKey: ['banner-images'],
    queryFn: fetchBannerImages,
  });
  const banners: BannerSlide[] = BANNER_COPY.map((copy, index) => ({
    id: String(index + 1),
    ...copy,
    imageUrl: bannerImages[index],
  }));

  const { data: promoBanners = [] } = useQuery({
    queryKey: ['promo-banners'],
    queryFn: fetchPromoBanners,
  });

  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['product-categories'],
    queryFn: fetchCategories,
  });

  // 商品推薦固定抓「全部」分類的前幾筆，不受使用者切換的分類篩選影響
  const { data: recommendedProducts = [] } = useQuery({
    queryKey: ['recommended-products'],
    queryFn: () => fetchProducts(ALL_CATEGORY),
  });

  const {
    data: productsPool = [],
    isLoading: isProductsLoading,
    isRefetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: () => fetchProducts(selectedCategory),
  });

  // 從候選池中隨機洗牌出 12 筆顯示；候選池變動（切分類、下拉重新整理）時重新洗一次
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
  useEffect(() => {
    setDisplayedProducts(shuffle(productsPool).slice(0, 12));
  }, [productsPool]);

  const onRefreshProducts = async () => {
    const result = await refetch();
    setDisplayedProducts(shuffle(result.data ?? productsPool).slice(0, 12));
  };

  return (
    <FlashList<Product>
      data={displayedProducts}
      keyExtractor={(item) => String(item.id)}
      numColumns={GRID_COLUMNS}
      ListHeaderComponent={
        <HomeHeader
          banners={banners}
          promoBanners={promoBanners}
          categories={categories}
          isCategoriesLoading={isCategoriesLoading}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      }
      ListFooterComponent={<ProductRecommendations products={recommendedProducts.slice(0, 6)} />}
      ListEmptyComponent={
        isProductsLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : isError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>商品載入失敗，請下拉重新整理</Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>這個分類目前沒有商品</Text>
          </View>
        )
      }
      contentContainerStyle={styles.listContent}
      refreshing={isRefetching}
      onRefresh={onRefreshProducts}
      renderItem={({ item, index }) => {
        const isLastInRow = (index + 1) % GRID_COLUMNS === 0;
        return (
          <View style={[styles.productCard, { marginRight: isLastInRow ? 0 : GRID_GAP }]}>
            <View>
              <Image source={{ uri: item.thumbnail }} style={styles.productThumb} contentFit="cover" />
              <FavoriteButton productId={item.id} style={styles.productFavoriteButton} />
            </View>
            <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.productPrice}>${item.price}</Text>
          </View>
        );
      }}
    />
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  listContent: { backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40 },
  greeting: { fontSize: 24, fontWeight: '600', color: colors.text },
  greetingSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 20 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 10,
    backgroundColor: colors.surface, paddingHorizontal: 12, gap: 8, marginBottom: 20
  },
  searchBarPlaceholder: { fontSize: 14, color: colors.textSubtle },

  carouselWrapper: { alignItems: 'center' },
  bannerSlide: {
    flex: 1, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    padding: 20, overflow: 'hidden'
  },
  bannerImage: { ...StyleSheet.absoluteFillObject },
  bannerScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },
  bannerTitle: { fontSize: 20, fontWeight: '600', color: colors.white },
  bannerSubtitle: { fontSize: 13, color: colors.white, marginTop: 6 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 16 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20 },
  quickAction: { width: '25%', alignItems: 'center', marginBottom: 16 },
  quickIconCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center'
  },
  quickBadge: {
    position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3
  },
  quickBadgeText: { fontSize: 9, color: colors.white, fontWeight: '700' },
  quickLabel: { fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: 'center' },

  promoSlide: {
    flex: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden'
  },
  promoTextGroup: { flex: 1, paddingLeft: 16, paddingVertical: 12 },
  promoImage: { width: 110, height: '100%', backgroundColor: colors.surface },
  promoTagPill: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4
  },
  promoTagText: { fontSize: 10, color: '#5C4A2E', fontWeight: '600' },
  promoTitle: { fontSize: 15, fontWeight: '600', color: '#3A362E' },
  promoSubtitle: { fontSize: 12, color: '#6B6558', marginTop: 2 },

  marqueeContainer: {
    marginTop: 20, height: 36, borderRadius: 8, backgroundColor: colors.surface,
    justifyContent: 'center', overflow: 'hidden'
  },
  marqueeTrack: { flexDirection: 'row' },
  marqueeText: { fontSize: 13, color: colors.textMuted, paddingHorizontal: 4 },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 28, marginBottom: 12 },
  sectionAccentBar: { width: 4, height: 16, backgroundColor: colors.accent, borderRadius: 2, marginRight: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text },

  categoryScroll: { marginBottom: 16 },
  categoryTab: { alignItems: 'center', marginRight: 20, paddingBottom: 8 },
  categoryText: { fontSize: 14, color: colors.textSubtle },
  categoryTextActive: { color: colors.text, fontWeight: '600' },
  categoryUnderline: { marginTop: 6, height: 2, width: '100%', backgroundColor: colors.accent, borderRadius: 1 },

  favoriteButton: {
    position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center'
  },
  recommendFavoriteButton: { top: 8, right: 8 },
  productFavoriteButton: {},

  recommendCard: { width: RECOMMEND_CARD_WIDTH },
  recommendImage: { width: RECOMMEND_CARD_WIDTH, height: 140, borderRadius: 12, backgroundColor: colors.surface, marginBottom: 10 },
  recommendTitle: { fontSize: 14, color: colors.text, fontWeight: '600' },
  recommendDescription: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  scrollTrack: { height: 3, backgroundColor: colors.border, borderRadius: 2, marginTop: 16, overflow: 'hidden' },
  scrollThumb: { position: 'absolute', height: 3, backgroundColor: colors.accent, borderRadius: 2 },

  productCard: { width: GRID_CARD_WIDTH, marginBottom: GRID_GAP + 6 },
  productThumb: { width: GRID_CARD_WIDTH, height: GRID_CARD_WIDTH, borderRadius: 10, marginBottom: 8, backgroundColor: colors.surface },
  productTitle: { fontSize: 13, color: colors.text, fontWeight: '500', lineHeight: 18 },
  productPrice: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontWeight: '600' },

  emptyState: { paddingTop: 24, alignItems: 'center' },
  emptyStateText: { fontSize: 13, color: colors.textSubtle },
});
