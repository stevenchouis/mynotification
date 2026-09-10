// app/dine-in/restaurant.tsx
// 堂食點餐流程第一步（2026-09-10 多門市功能新增）：選擇要用餐的門市。顧客可能到任何一間
// 門市消費，不像店員帳號固定綁一間門市，所以這一步無法省略（跟 staff-scanner 店員端「不需要
// 選擇器」的簡化不一樣，見跨 session 討論）。選好門市後才進到 app/dine-in/table.tsx 選桌號。
// 每次重新進入這一步都清空 useDineInOrderStore，確保每次進點餐流程都是全新狀態，不會殘留
// 上一次（甚至中途放棄的上一次）的選擇。
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { fetchRestaurants } from '../../services/dineIn';
import { useDineInOrderStore } from '../../store/useDineInOrderStore';
import { Restaurant } from '../../types/dineIn';

export default function DineInRestaurantScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const clear = useDineInOrderStore((state) => state.clear);

  useEffect(() => {
    clear();
  }, [clear]);

  const { data: restaurants, isLoading, isError, refetch } = useQuery<Restaurant[]>({
    queryKey: ['restaurants'],
    queryFn: fetchRestaurants,
  });

  const onSelect = (restaurant: Restaurant) => {
    router.push({
      pathname: '/dine-in/table',
      params: { restaurant_id: String(restaurant.id), restaurant_name: restaurant.name },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>請選擇用餐門市</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.tint} style={styles.loading} />
      ) : (
        <FlatList<Restaurant>
          data={restaurants ?? []}
          keyExtractor={(item) => String(item.id)}
          refreshing={isLoading}
          onRefresh={refetch}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {isError ? '門市清單載入失敗，請下拉重新整理' : '目前沒有可選擇的門市'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => onSelect(item)}>
              <Ionicons name="storefront-outline" size={22} color={colors.tint} />
              <Text style={styles.rowText}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: 20, marginBottom: 4 },
  loading: { marginTop: 40 },
  listContent: { padding: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 10,
  },
  rowPressed: { opacity: 0.85 },
  rowText: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
  emptyState: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textSubtle, textAlign: 'center', paddingHorizontal: 24 },
});
