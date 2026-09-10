// app/dine-in/table.tsx
// 堂食點餐流程第二步：從選定門市底下的桌位清單選桌號（2026-09-10 改版，見 CLAUDE.md）——
// 不再是自由文字輸入，防呆用，避免手打錯字/打到別間門市的桌號。桌位清單不帶佔用狀態
// （已跟使用者確認：這是既有 QR Code 掃碼流程的防呆備援，不是「找空桌」情境）。
// 兩種進來的方式：
//   1. 從 app/dine-in/restaurant.tsx 選完門市 push 進來，帶 restaurant_id/restaurant_name，
//      顯示桌位清單讓使用者手動選。
//   2. 桌牌 QR Code 掃碼，deep link 直接帶 restaurant_id + table_id 兩者，跳過手動選擇直接
//      進菜單——內容是 mynotification://dine-in/table?restaurant_id=2&table_id=13 這種格式
//      （因為 app.json 的 scheme 是 mynotification，Expo Router 會自動把這個 URL 導到這支
//      畫面，不需要額外的原生設定）。這支畫面在 app/_layout.tsx 裡是 Stack.Protected（需要
//      登入）的畫面，如果顧客掃碼當下還沒登入，會先卡在登入畫面、參數會遺失，需要重新掃碼
//      ——這是跟現有其他需要登入的 deep link（例如優惠券詳情頁）一樣的既有限制。
// 沒有帶 restaurant_id 時（不正常進入方式，理論上不會發生），導回選餐廳畫面重新開始。
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { fetchRestaurantTables } from '../../services/dineIn';
import { useDineInOrderStore } from '../../store/useDineInOrderStore';
import { DineInTable } from '../../types/dineIn';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 32 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

export default function DineInTableScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    restaurant_id: restaurantIdParam,
    restaurant_name: restaurantNameParam,
    table_id: tableIdFromQr,
  } = useLocalSearchParams<{ restaurant_id?: string; restaurant_name?: string; table_id?: string }>();

  const setTable = useDineInOrderStore((state) => state.setTable);
  const restaurantId = Number(restaurantIdParam);
  const hasValidRestaurant = Number.isFinite(restaurantId) && restaurantId > 0;

  const { data: tables, isLoading, isError, refetch } = useQuery<DineInTable[]>({
    queryKey: ['dine-in-tables', restaurantId],
    queryFn: () => fetchRestaurantTables(restaurantId),
    enabled: hasValidRestaurant,
  });

  // QR Code 直接帶了 table_id：從清單找到對應桌位資料後直接帶入、跳過手動選擇畫面
  useEffect(() => {
    if (!tableIdFromQr || !tables) return;
    const table = tables.find((t) => t.id === Number(tableIdFromQr));
    if (table) {
      setTable(restaurantId, restaurantNameParam ?? '', table.id, table.code);
      router.replace('/dine-in/menu');
    }
  }, [tableIdFromQr, tables, restaurantId, restaurantNameParam, setTable, router]);

  const onSelect = (table: DineInTable) => {
    setTable(restaurantId, restaurantNameParam ?? '', table.id, table.code);
    router.push('/dine-in/menu');
  };

  if (!hasValidRestaurant) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>請先選擇門市</Text>
        <Pressable style={styles.button} onPress={() => router.replace('/dine-in/restaurant')}>
          <Text style={styles.buttonText}>回選擇門市</Text>
        </Pressable>
      </View>
    );
  }

  // 有帶 QR Code 桌號參數時，畫面只會短暫顯示這個載入態，上面的 useEffect 會立刻導去菜單，
  // 不要讓使用者看到一閃而過的手動選擇清單
  if (tableIdFromQr) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={styles.subtitle}>掃碼成功，正在為您帶入桌號...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{restaurantNameParam}</Text>
      <Text style={styles.subtitle}>請選擇您的桌號</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.tint} style={styles.loading} />
      ) : (
        <FlatList<DineInTable>
          data={tables ?? []}
          keyExtractor={(item) => String(item.id)}
          numColumns={GRID_COLUMNS}
          refreshing={isLoading}
          onRefresh={refetch}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {isError ? '桌位清單載入失敗，請下拉重新整理' : '這間門市目前沒有可選擇的桌位'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Pressable
              style={({ pressed }) => [
                styles.tableButton,
                { marginRight: (index + 1) % GRID_COLUMNS === 0 ? 0 : GRID_GAP },
                pressed && styles.tableButtonPressed,
              ]}
              onPress={() => onSelect(item)}
            >
              <Text style={styles.tableButtonText}>{item.code}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContainer: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: 20 },
  subtitle: { fontSize: 13, color: colors.textSubtle, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  loading: { marginTop: 24 },
  listContent: { padding: 16 },
  tableButton: {
    width: GRID_CARD_WIDTH, aspectRatio: 1.4, marginBottom: GRID_GAP,
    backgroundColor: colors.surface, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  tableButtonPressed: { opacity: 0.85 },
  tableButtonText: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyState: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.textSubtle, textAlign: 'center', paddingHorizontal: 24 },
  errorText: { fontSize: 15, color: colors.text, marginBottom: 20 },
  button: {
    backgroundColor: colors.tint, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12,
  },
  buttonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },
});
