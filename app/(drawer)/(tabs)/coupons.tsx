import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import Text from '../../../components/Text';
import { api } from '../../../services/api'; //
import { Coupon } from '../../../types';

type CouponStatus = 'active' | 'used' | 'expired';
type FilterKey = CouponStatus | 'all';

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

export default function CouponListScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('active');
  const { data: coupons, isLoading, isRefetching, refetch } = useQuery<Coupon[]>({
    queryKey: ['myCoupons'],
    queryFn: async () => {
      const res = await api.get('/api/v1/coupons/me');
      return res.data;
    },
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

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 15 },
  filterRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  filterTab: {
    flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center',
    backgroundColor: '#EFEFEF'
  },
  filterTabActive: { backgroundColor: '#FF9500' },
  filterTabText: { fontSize: 12, color: '#666', fontWeight: '600' },
  filterTabTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12,
    borderLeftWidth: 5, borderLeftColor: '#FF9500', // 橘色代表優惠券感
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4
  },
  usedCard: { opacity: 0.6, borderLeftColor: '#999' },
  cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  amount: { fontSize: 24, fontWeight: '900', color: '#FF3B30' },
  cardFooter: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  expiry: { fontSize: 12, color: '#666' },
  status: { fontSize: 12, fontWeight: '600', color: '#FF9500' },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' }
});
