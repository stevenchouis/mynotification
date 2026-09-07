// app/points.tsx
// 紅利點數畫面：餘額 + 收支明細，比照 app/coupon/[id].tsx 掛在 app/_layout.tsx 的
// userToken 分支下（Stack.Screen，非 Tab）。4 種交易類型（earn/redeem/expire/reverse）
// 的圖示/顏色/文案設計見 plan-loyalty-points.md 的 Scope 章節。
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import Text from '../components/Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { fetchLoyaltyBalance, fetchLoyaltyTransactions } from '../services/loyalty';
import { LoyaltyTransaction, LoyaltyTransactionType } from '../types/loyalty';

const TX_DISPLAY: Record<
  LoyaltyTransactionType,
  { icon: keyof typeof Ionicons.glyphMap; sign: '+' | '-'; colorKey: keyof ThemeColors; defaultReason: string }
> = {
  earn: { icon: 'add-circle-outline', sign: '+', colorKey: 'success', defaultReason: '消費回饋' },
  redeem: { icon: 'remove-circle-outline', sign: '-', colorKey: 'tint', defaultReason: '訂單折抵' },
  expire: { icon: 'time-outline', sign: '-', colorKey: 'textSubtle', defaultReason: '點數已過期' },
  reverse: { icon: 'arrow-undo-outline', sign: '+', colorKey: 'accent', defaultReason: '訂單取消退還' },
};

function TransactionRow({ tx, colors, styles }: { tx: LoyaltyTransaction; colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  const display = TX_DISPLAY[tx.type];
  const color = colors[display.colorKey] as string;
  const reason = tx.type === 'expire' ? display.defaultReason : tx.reason || display.defaultReason;

  return (
    <View style={styles.row}>
      <Ionicons name={display.icon} size={26} color={color} style={styles.rowIcon} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowReason}>{reason}</Text>
        <Text style={styles.rowDate}>{new Date(tx.created_at).toLocaleString('zh-TW')}</Text>
      </View>
      <Text style={[styles.rowAmount, { color }]}>
        {display.sign}{tx.amount} 點
      </Text>
    </View>
  );
}

export default function PointsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: balance, isLoading: isBalanceLoading } = useQuery({
    queryKey: ['loyalty-balance'],
    queryFn: fetchLoyaltyBalance,
  });

  const { data: transactions, isLoading: isTxLoading } = useQuery({
    queryKey: ['loyalty-transactions'],
    queryFn: fetchLoyaltyTransactions,
  });

  return (
    <View style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>目前餘額</Text>
        {isBalanceLoading ? (
          <ActivityIndicator color={colors.tint} style={{ marginTop: 8 }} />
        ) : (
          <Text style={styles.balanceValue}>{balance ?? 0} 點</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>收支明細</Text>

      {isTxLoading ? (
        <ActivityIndicator size="large" color={colors.tint} style={{ marginTop: 24 }} />
      ) : (
        <FlatList<LoyaltyTransaction>
          data={transactions ?? []}
          keyExtractor={(tx) => String(tx.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <TransactionRow tx={item} colors={colors} styles={styles} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="star-outline" size={40} color={colors.border} />
              <Text style={styles.emptyText}>目前還沒有任何點數紀錄</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  balanceCard: {
    backgroundColor: colors.surface, margin: 16, borderRadius: 16,
    padding: 24, alignItems: 'center',
  },
  balanceLabel: { fontSize: 14, color: colors.textMuted },
  balanceValue: { fontSize: 36, fontWeight: '900', color: colors.text, marginTop: 8 },

  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginHorizontal: 16, marginBottom: 4 },

  listContent: { padding: 16, paddingTop: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  rowIcon: { marginRight: 12 },
  rowInfo: { flex: 1 },
  rowReason: { fontSize: 14, color: colors.text, fontWeight: '500' },
  rowDate: { fontSize: 11, color: colors.textSubtle, marginTop: 4 },
  rowAmount: { fontSize: 15, fontWeight: '700' },

  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },
});
