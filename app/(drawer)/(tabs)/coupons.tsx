import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Text from '../../../components/Text';
import { ThemeColors } from '../../../constants/Colors';
import { useShopFavorites } from '../../../hooks/useShopFavorites';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { fetchMyCoupons } from '../../../services/coupons';
import { fetchMyDineInOrders, fetchRestaurants } from '../../../services/dineIn';
import { fetchMyOrders } from '../../../services/shop';
import { Coupon } from '../../../types';
import { DINE_IN_ORDER_STATUS_LABEL, DineInOrder, DineInOrderStatus, Restaurant } from '../../../types/dineIn';
import { Order, ORDER_STATUS_LABEL, OrderStatus, ShopProduct } from '../../../types/shop';
import { CouponStatus, getCouponStatus, isStale } from '../../../utils/coupon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FAV_GRID_COLUMNS = 3;
const FAV_GRID_GAP = 10;
const FAV_CONTENT_WIDTH = SCREEN_WIDTH - 30;
const FAV_CARD_WIDTH = (FAV_CONTENT_WIDTH - FAV_GRID_GAP * (FAV_GRID_COLUMNS - 1)) / FAV_GRID_COLUMNS;

type FilterKey = CouponStatus | 'all';
type Section = 'coupons' | 'orders' | 'dineInOrders' | 'favorites';

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'active', label: '待使用' },
  { key: 'used', label: '已使用' },
  { key: 'expired', label: '已過期' },
  { key: 'all', label: '全部' },
];

const EMPTY_MESSAGE: Record<FilterKey, string> = {
  active: '目前沒有待使用的優惠券',
  used: '目前沒有已使用的優惠券',
  expired: '目前沒有已過期的優惠券',
  all: '目前沒有任何優惠券',
};

// 排序優先順序：待使用 > 已使用 > 已過期
const STATUS_PRIORITY: Record<CouponStatus, number> = { active: 0, used: 1, expired: 2 };

// 2026-09-15：「我的訂單」「我的點餐」新增依狀態篩選，跟上面優惠券的篩選標籤操作方式一致
type OrderFilterKey = OrderStatus | 'all';
const ORDER_FILTER_TABS: { key: OrderFilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '處理中' },
  { key: 'paid', label: '已付款' },
  { key: 'shipped', label: '已出貨' },
  { key: 'failed', label: '付款失敗' },
  { key: 'cancelled', label: '已取消' },
];

type DineInFilterKey = DineInOrderStatus | 'all';
const DINE_IN_FILTER_TABS: { key: DineInFilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '處理中' },
  { key: 'served', label: '待收款' },
  { key: 'completed', label: '已完成' },
];

// 手勢左右切換這幾組「子分類」篩選標籤（2026-09-15，使用者指定放在這一層，不是最上層
// 優惠券／我的訂單／我的點餐／我的收藏 那個分頁切換——那層仍維持點選）
const FILTER_KEYS = FILTER_TABS.map((t) => t.key);
const ORDER_FILTER_KEYS = ORDER_FILTER_TABS.map((t) => t.key);
const DINE_IN_FILTER_KEYS = DINE_IN_FILTER_TABS.map((t) => t.key);

// activeOffsetX/failOffsetY 讓這個手勢只在「明顯偏水平」的滑動才啟動，垂直滑動（捲動
// FlatList）會讓這個手勢直接 fail、把觸控權交還給列表本身的捲動，兩者不衝突
function createFilterSwipeGesture<K extends string>(
  keys: K[],
  setKey: (updater: (current: K) => K) => void
) {
  return Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .runOnJS(true)
    .onEnd((event) => {
      setKey((current) => {
        const idx = keys.indexOf(current);
        if (event.translationX < -50 && idx < keys.length - 1) return keys[idx + 1];
        if (event.translationX > 50 && idx > 0) return keys[idx - 1];
        return current;
      });
    });
}

export default function MyScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [section, setSection] = useState<Section>('coupons');
  const [filter, setFilter] = useState<FilterKey>('active');
  const [orderFilter, setOrderFilter] = useState<OrderFilterKey>('all');
  const [dineInFilter, setDineInFilter] = useState<DineInFilterKey>('all');
  const { favorites, isLoading: isFavoritesLoading, toggleFavorite } = useShopFavorites();

  // restaurant_id 是純記錄用途（多門市統一錢包，見 CLAUDE.md），有值代表這張券是特定門市發的，
  // 用來在卡片顯示「限定門市」——沿用 ['restaurants']（跟 dine-in/restaurant.tsx 共用快取）查門市名稱
  const { data: restaurants } = useQuery<Restaurant[]>({ queryKey: ['restaurants'], queryFn: fetchRestaurants });

  const { data: coupons, isLoading, isRefetching, refetch } = useQuery<Coupon[]>({
    queryKey: ['myCoupons'],
    queryFn: fetchMyCoupons,
  });

  // 訂單資料量小、切到「我的訂單」才需要，用 enabled 避免使用者只看優惠券時也白打一次 API
  const {
    data: orders,
    isLoading: isOrdersLoading,
    isRefetching: isOrdersRefetching,
    refetch: refetchOrders,
  } = useQuery<Order[]>({
    queryKey: ['my-orders'],
    queryFn: fetchMyOrders,
    enabled: section === 'orders',
  });

  // 堂食點餐紀錄，跟上面的網購訂單是完全獨立的後端資源（見 plan-dine-in-order.md），
  // 同樣只在切到這個區段才打 API
  const {
    data: dineInOrders,
    isLoading: isDineInOrdersLoading,
    isRefetching: isDineInOrdersRefetching,
    refetch: refetchDineInOrders,
  } = useQuery<DineInOrder[]>({
    queryKey: ['my-dine-in-orders'],
    queryFn: fetchMyDineInOrders,
    enabled: section === 'dineInOrders',
  });

  const withStatus = useMemo(() => {
    return (coupons ?? [])
      .map((coupon) => ({ ...coupon, status: getCouponStatus(coupon) }))
      .filter((coupon) => !isStale(coupon, coupon.status));
  }, [coupons]);

  const counts = useMemo(() => {
    const result: Record<FilterKey, number> = { active: 0, used: 0, expired: 0, all: withStatus.length };
    withStatus.forEach((coupon) => { result[coupon.status]++; });
    return result;
  }, [withStatus]);

  const displayedCoupons = useMemo(() => {
    const filtered = filter === 'all' ? withStatus : withStatus.filter((c) => c.status === filter);
    return [...filtered].sort((a, b) => {
      if (a.status !== b.status) return STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      const aTime = new Date(a.expired_at).getTime();
      const bTime = new Date(b.expired_at).getTime();
      // 待使用：越快過期排越前面；已使用/已過期：越晚的（比較新的紀錄）排越前面
      return a.status === 'active' ? aTime - bTime : bTime - aTime;
    });
  }, [withStatus, filter]);

  const orderCounts = useMemo(() => {
    const result: Record<OrderFilterKey, number> = {
      all: (orders ?? []).length, pending: 0, paid: 0, shipped: 0, failed: 0, cancelled: 0,
    };
    (orders ?? []).forEach((o) => { result[o.status]++; });
    return result;
  }, [orders]);

  const displayedOrders = useMemo(() => {
    const list = orders ?? [];
    return orderFilter === 'all' ? list : list.filter((o) => o.status === orderFilter);
  }, [orders, orderFilter]);

  const dineInCounts = useMemo(() => {
    const result: Record<DineInFilterKey, number> = {
      all: (dineInOrders ?? []).length, pending: 0, served: 0, completed: 0,
    };
    (dineInOrders ?? []).forEach((o) => { result[o.status]++; });
    return result;
  }, [dineInOrders]);

  const displayedDineInOrders = useMemo(() => {
    const list = dineInOrders ?? [];
    return dineInFilter === 'all' ? list : list.filter((o) => o.status === dineInFilter);
  }, [dineInOrders, dineInFilter]);

  // 往左滑換到下一個篩選標籤、往右滑換到上一個，超出頭尾邊界時不動作——放在「優惠券／我的
  // 訂單／我的點餐」各自的子分類篩選這一層，不是最上層 sectionSwitchRow 的分頁切換
  const couponSwipeGesture = useMemo(() => createFilterSwipeGesture(FILTER_KEYS, setFilter), []);
  const orderSwipeGesture = useMemo(() => createFilterSwipeGesture(ORDER_FILTER_KEYS, setOrderFilter), []);
  const dineInSwipeGesture = useMemo(() => createFilterSwipeGesture(DINE_IN_FILTER_KEYS, setDineInFilter), []);

  return (
    <View style={styles.container}>
      <View style={styles.sectionSwitchRow}>
        <Pressable
          style={[styles.sectionTab, section === 'coupons' && styles.sectionTabActive]}
          onPress={() => setSection('coupons')}
        >
          <Text style={[styles.sectionTabText, section === 'coupons' && styles.sectionTabTextActive]}>
            優惠券
          </Text>
        </Pressable>
        <Pressable
          style={[styles.sectionTab, section === 'orders' && styles.sectionTabActive]}
          onPress={() => setSection('orders')}
        >
          <Text style={[styles.sectionTabText, section === 'orders' && styles.sectionTabTextActive]}>
            我的訂單
          </Text>
        </Pressable>
        <Pressable
          style={[styles.sectionTab, section === 'dineInOrders' && styles.sectionTabActive]}
          onPress={() => setSection('dineInOrders')}
        >
          <Text style={[styles.sectionTabText, section === 'dineInOrders' && styles.sectionTabTextActive]}>
            我的點餐
          </Text>
        </Pressable>
        <Pressable
          style={[styles.sectionTab, section === 'favorites' && styles.sectionTabActive]}
          onPress={() => setSection('favorites')}
        >
          <Text style={[styles.sectionTabText, section === 'favorites' && styles.sectionTabTextActive]}>
            我的收藏
          </Text>
        </Pressable>
      </View>

      {section === 'coupons' ? (
        isLoading ? (
          <ActivityIndicator style={{ flex: 1 }} color={colors.tint} />
        ) : (
          <GestureDetector gesture={couponSwipeGesture}>
          <View style={{ flex: 1 }}>
            <View style={styles.filterRow}>
              {FILTER_TABS.map((tab) => (
                <Pressable key={tab.key} style={styles.filterTab} onPress={() => setFilter(tab.key)}>
                  <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
                    {tab.label}（{counts[tab.key]}）
                  </Text>
                  {filter === tab.key && <View style={styles.filterTabUnderline} />}
                </Pressable>
              ))}
            </View>

            <FlatList
              data={displayedCoupons}
              keyExtractor={(item) => item.id.toString()}
              refreshing={isRefetching}
              onRefresh={refetch}
              ListEmptyComponent={<Text style={styles.empty}>{EMPTY_MESSAGE[filter]}</Text>}
              renderItem={({ item }) => {
                const isDisabled = item.status !== 'active';
                const statusText = item.status === 'used' ? '已使用' : item.status === 'expired' ? '已過期' : '待使用';
                const restaurantName = item.restaurant_id != null
                  ? restaurants?.find((r) => r.id === item.restaurant_id)?.name
                  : null;
                return (
                  <Pressable
                    style={({ pressed }) => [styles.card, isDisabled && styles.usedCard, pressed && !isDisabled && { opacity: 0.85 }]}
                    onPress={() => !isDisabled && router.push(`/coupon/${item.id}`)}
                    disabled={isDisabled}
                  >
                    <View style={styles.cardMain}>
                      <Text style={styles.title}>{item.title}</Text>
                      <Text style={styles.amount}>${item.discount_amount}</Text>
                    </View>
                    {restaurantName && (
                      <Text style={styles.restaurantBadge}>限定門市：{restaurantName}</Text>
                    )}
                    <View style={styles.cardFooter}>
                      <Text style={styles.expiry}>
                        有效期至：{new Date(item.expired_at).toLocaleDateString('zh-TW')}
                      </Text>
                      <Text style={styles.status}>{statusText}</Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>
          </GestureDetector>
        )
      ) : section === 'orders' ? (
        <GestureDetector gesture={orderSwipeGesture}>
        <View style={{ flex: 1 }}>
        <FlatList
          data={displayedOrders}
          keyExtractor={(item) => item.id.toString()}
          refreshing={isOrdersRefetching}
          onRefresh={refetchOrders}
          ListHeaderComponent={
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScrollRow}
              contentContainerStyle={styles.filterScrollContent}
            >
              {ORDER_FILTER_TABS.map((tab) => (
                <Pressable key={tab.key} style={styles.filterTabScroll} onPress={() => setOrderFilter(tab.key)}>
                  <Text style={[styles.filterTabText, orderFilter === tab.key && styles.filterTabTextActive]}>
                    {tab.label}（{orderCounts[tab.key]}）
                  </Text>
                  {orderFilter === tab.key && <View style={styles.filterTabUnderline} />}
                </Pressable>
              ))}
            </ScrollView>
          }
          ListEmptyComponent={
            isOrdersLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.tint} />
            ) : (
              <Text style={styles.empty}>目前沒有符合條件的訂單</Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: '/order/[id]', params: { id: String(item.id) } })}
            >
              <View style={styles.cardMain}>
                {/* 主顯示 Order.id，跟下面堂食訂單卡片、staff-scanner 內部查找一致；
                    金流交易序號（merchant_trade_no）保留在訂單詳情頁顯示，這裡列表不重複塞 */}
                <Text style={styles.title}>訂單 #{item.id}</Text>
                <Text style={styles.amount}>${item.total_amount}</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.expiry}>
                  {new Date(item.created_at).toLocaleDateString('zh-TW')}
                </Text>
                <Text style={styles.status}>{ORDER_STATUS_LABEL[item.status]}</Text>
              </View>
            </Pressable>
          )}
        />
        </View>
        </GestureDetector>
      ) : section === 'dineInOrders' ? (
        <GestureDetector gesture={dineInSwipeGesture}>
        <View style={{ flex: 1 }}>
        <FlatList
          data={displayedDineInOrders}
          keyExtractor={(item) => item.id.toString()}
          refreshing={isDineInOrdersRefetching}
          onRefresh={refetchDineInOrders}
          ListHeaderComponent={
            <View style={styles.filterRow}>
              {DINE_IN_FILTER_TABS.map((tab) => (
                <Pressable key={tab.key} style={styles.filterTab} onPress={() => setDineInFilter(tab.key)}>
                  <Text style={[styles.filterTabText, dineInFilter === tab.key && styles.filterTabTextActive]}>
                    {tab.label}（{dineInCounts[tab.key]}）
                  </Text>
                  {dineInFilter === tab.key && <View style={styles.filterTabUnderline} />}
                </Pressable>
              ))}
            </View>
          }
          ListEmptyComponent={
            isDineInOrdersLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.tint} />
            ) : (
              <Text style={styles.empty}>目前沒有符合條件的點餐記錄</Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: '/dine-in/order/[id]', params: { id: String(item.id) } })}
            >
              <View style={styles.cardMain}>
                <Text style={styles.title}>桌號 {item.table_number}（訂單 #{item.id}）</Text>
                <Text style={styles.amount}>${item.total_amount}</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.expiry}>
                  {new Date(item.created_at).toLocaleString('zh-TW')}
                </Text>
                <Text style={styles.status}>{DINE_IN_ORDER_STATUS_LABEL[item.status]}</Text>
              </View>
            </Pressable>
          )}
        />
        </View>
        </GestureDetector>
      ) : (
        <FlashList<ShopProduct>
          data={favorites}
          keyExtractor={(item) => String(item.id)}
          numColumns={FAV_GRID_COLUMNS}
          ListEmptyComponent={
            isFavoritesLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.tint} />
            ) : (
              <Text style={styles.empty}>目前沒有收藏的商品</Text>
            )
          }
          renderItem={({ item, index }) => {
            const isLastInRow = (index + 1) % FAV_GRID_COLUMNS === 0;
            const isOutOfStock = item.stock <= 0;
            return (
              <Pressable
                style={[styles.favCard, { marginRight: isLastInRow ? 0 : FAV_GRID_GAP }]}
                onPress={() => router.push({ pathname: '/shop/[id]', params: { id: String(item.id) } })}
              >
                <View>
                  <Image
                    source={{ uri: item.thumbnail }}
                    style={[styles.favThumb, isOutOfStock && styles.favThumbOutOfStock]}
                    contentFit="cover"
                  />
                  {isOutOfStock && (
                    <View style={styles.favOutOfStockBadge}>
                      <Text style={styles.favOutOfStockBadgeText}>缺貨</Text>
                    </View>
                  )}
                  <Pressable
                    style={styles.favFavoriteButton}
                    onPress={() => toggleFavorite(item)}
                    hitSlop={8}
                  >
                    <Ionicons name="heart" size={16} color={colors.danger} />
                  </Pressable>
                </View>
                <Text style={styles.favTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.favPrice}>${item.price}</Text>
                <Text style={isOutOfStock ? styles.favStockTextOutOfStock : styles.favStockText}>
                  {isOutOfStock ? '缺貨中' : `庫存：${item.stock}`}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 15 },
  sectionSwitchRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  sectionTab: {
    flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center',
    backgroundColor: colors.surface,
  },
  sectionTabActive: { backgroundColor: colors.tint },
  sectionTabText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  sectionTabTextActive: { color: colors.onTint },

  filterRow: { flexDirection: 'row', marginBottom: 12, gap: 16 },
  // 「我的訂單」狀態篩選標籤比 coupons 的 4 個多（6 個），改用可橫向捲動避免小螢幕擠壓變形；
  // ScrollView 裡的子元素不能沿用 filterTab 的 flex:1（沒有邊界寬度可分配），改成內容自適應寬度
  filterScrollRow: { marginBottom: 12 },
  filterScrollContent: { flexDirection: 'row', gap: 16 },
  // 2026-09-15：選中標籤的指示方式從實心底色改成下底線（比照 shop.tsx 商品分類標籤的做法），
  // 三處篩選（優惠券／我的訂單／我的點餐）統一套用
  filterTabScroll: { alignItems: 'center', paddingBottom: 4 },
  filterTab: { flex: 1, alignItems: 'center', paddingBottom: 4 },
  filterTabText: { fontSize: 12, color: colors.textSubtle, fontWeight: '600' },
  filterTabTextActive: { color: colors.text },
  filterTabUnderline: { marginTop: 6, height: 2, width: '100%', backgroundColor: colors.accent, borderRadius: 1 },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12,
    borderLeftWidth: 5, borderLeftColor: colors.warning, // 橘色代表優惠券感
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4
  },
  usedCard: { opacity: 0.6, borderLeftColor: colors.textSubtle },
  cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  amount: { fontSize: 24, fontWeight: '900', color: colors.danger },
  restaurantBadge: { fontSize: 12, color: colors.tint, marginTop: 4 },
  cardFooter: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  expiry: { fontSize: 12, color: colors.textMuted },
  status: { fontSize: 12, fontWeight: '600', color: colors.warning },
  empty: { textAlign: 'center', marginTop: 50, color: colors.textSubtle },

  favCard: { width: FAV_CARD_WIDTH, marginBottom: FAV_GRID_GAP + 6 },
  favThumb: { width: FAV_CARD_WIDTH, height: FAV_CARD_WIDTH, borderRadius: 10, marginBottom: 8, backgroundColor: colors.surface },
  favThumbOutOfStock: { opacity: 0.4 },
  favOutOfStockBadge: {
    position: 'absolute', left: 0, right: 0, top: '50%', marginTop: -12,
    alignItems: 'center', justifyContent: 'center',
  },
  favOutOfStockBadgeText: {
    color: colors.white, backgroundColor: 'rgba(0,0,0,0.6)', fontSize: 12, fontWeight: '700',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, overflow: 'hidden',
  },
  favFavoriteButton: {
    position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center'
  },
  favTitle: { fontSize: 13, color: colors.text, fontWeight: '500', lineHeight: 18 },
  favPrice: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  favStockText: { fontSize: 11, color: colors.textSubtle, marginTop: 2 },
  favStockTextOutOfStock: { fontSize: 11, color: colors.danger, marginTop: 2, fontWeight: '600' },
});
