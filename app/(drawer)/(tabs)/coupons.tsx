import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, View } from 'react-native';
import Text from '../../../components/Text';
import { ThemeColors } from '../../../constants/Colors';
import { useShopFavorites } from '../../../hooks/useShopFavorites';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { api } from '../../../services/api'; //
import { fetchMyDineInOrders } from '../../../services/dineIn';
import { fetchMyOrders } from '../../../services/shop';
import { Coupon } from '../../../types';
import { DINE_IN_ORDER_STATUS_LABEL, DineInOrder } from '../../../types/dineIn';
import { Order, ORDER_STATUS_LABEL, ShopProduct } from '../../../types/shop';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FAV_GRID_COLUMNS = 3;
const FAV_GRID_GAP = 10;
const FAV_CONTENT_WIDTH = SCREEN_WIDTH - 30;
const FAV_CARD_WIDTH = (FAV_CONTENT_WIDTH - FAV_GRID_GAP * (FAV_GRID_COLUMNS - 1)) / FAV_GRID_COLUMNS;

type CouponStatus = 'active' | 'used' | 'expired';
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

// 已使用/已過期的優惠券，超過這段時間就不再顯示，避免列表一直堆積舊紀錄
const HIDE_AFTER_DAYS = 30;
const HIDE_AFTER_MS = HIDE_AFTER_DAYS * 24 * 60 * 60 * 1000;

function getCouponStatus(coupon: Coupon): CouponStatus {
  if (coupon.is_used) return 'used';
  if (new Date(coupon.expired_at).getTime() < Date.now()) return 'expired';
  return 'active';
}

// 已使用：以 used_at 為基準；已過期未使用：以 expired_at 為基準
function isStale(coupon: Coupon, status: CouponStatus): boolean {
  if (status === 'active') return false;
  const referenceDate = status === 'used' ? coupon.used_at : coupon.expired_at;
  if (!referenceDate) return false;
  return Date.now() - new Date(referenceDate).getTime() > HIDE_AFTER_MS;
}

export default function MyScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [section, setSection] = useState<Section>('coupons');
  const [filter, setFilter] = useState<FilterKey>('active');
  const { favorites, isLoading: isFavoritesLoading, toggleFavorite } = useShopFavorites();

  const { data: coupons, isLoading, isRefetching, refetch } = useQuery<Coupon[]>({
    queryKey: ['myCoupons'],
    queryFn: async () => {
      const res = await api.get('/api/v1/coupons/me');
      return res.data;
    },
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
          <>
            <View style={styles.filterRow}>
              {FILTER_TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
                  onPress={() => setFilter(tab.key)}
                >
                  <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
                    {tab.label}（{counts[tab.key]}）
                  </Text>
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
          </>
        )
      ) : section === 'orders' ? (
        <FlatList
          data={orders ?? []}
          keyExtractor={(item) => item.id.toString()}
          refreshing={isOrdersRefetching}
          onRefresh={refetchOrders}
          ListEmptyComponent={
            isOrdersLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.tint} />
            ) : (
              <Text style={styles.empty}>目前沒有訂單記錄</Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: '/order/[id]', params: { id: String(item.id) } })}
            >
              <View style={styles.cardMain}>
                <Text style={styles.title}>訂單 #{item.merchant_trade_no}</Text>
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
      ) : section === 'dineInOrders' ? (
        <FlatList
          data={dineInOrders ?? []}
          keyExtractor={(item) => item.id.toString()}
          refreshing={isDineInOrdersRefetching}
          onRefresh={refetchDineInOrders}
          ListEmptyComponent={
            isDineInOrdersLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.tint} />
            ) : (
              <Text style={styles.empty}>目前沒有點餐記錄</Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: '/dine-in/order/[id]', params: { id: String(item.id) } })}
            >
              <View style={styles.cardMain}>
                <Text style={styles.title}>桌號 {item.table_number}</Text>
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
            return (
              <Pressable
                style={[styles.favCard, { marginRight: isLastInRow ? 0 : FAV_GRID_GAP }]}
                onPress={() => router.push({ pathname: '/shop/[id]', params: { id: String(item.id) } })}
              >
                <View>
                  <Image source={{ uri: item.thumbnail }} style={styles.favThumb} contentFit="cover" />
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

  filterRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  filterTab: {
    flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center',
    backgroundColor: colors.surfaceAlt
  },
  filterTabActive: { backgroundColor: colors.warning },
  filterTabText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  filterTabTextActive: { color: colors.white },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12,
    borderLeftWidth: 5, borderLeftColor: colors.warning, // 橘色代表優惠券感
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4
  },
  usedCard: { opacity: 0.6, borderLeftColor: colors.textSubtle },
  cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  amount: { fontSize: 24, fontWeight: '900', color: colors.danger },
  cardFooter: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  expiry: { fontSize: 12, color: colors.textMuted },
  status: { fontSize: 12, fontWeight: '600', color: colors.warning },
  empty: { textAlign: 'center', marginTop: 50, color: colors.textSubtle },

  favCard: { width: FAV_CARD_WIDTH, marginBottom: FAV_GRID_GAP + 6 },
  favThumb: { width: FAV_CARD_WIDTH, height: FAV_CARD_WIDTH, borderRadius: 10, marginBottom: 8, backgroundColor: colors.surface },
  favFavoriteButton: {
    position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center'
  },
  favTitle: { fontSize: 13, color: colors.text, fontWeight: '500', lineHeight: 18 },
  favPrice: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
});
