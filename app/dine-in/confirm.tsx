// app/dine-in/confirm.tsx
// 堂食點餐流程最後一步：送出成功結果畫面。文案刻意誠實標示「等待店家確認」，不誤導成
// 已完成備餐。後端有回取餐號碼時（2026-11-07 取餐叫號，見 plan-dine-in-pickup-call.md）
// 大字顯示號碼，並提示「餐點完成時會推播通知」；沒有號碼時（舊後端）維持原本的版面。
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatPickupNumber } from '../../types/dineIn';

export default function DineInConfirmScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { orderId, tableNumber, pickupNumber } = useLocalSearchParams<{
    orderId: string; tableNumber: string; pickupNumber?: string;
  }>();
  const hasPickupNumber = !!pickupNumber && !Number.isNaN(Number(pickupNumber));

  return (
    <View style={styles.container}>
      <Ionicons name="checkmark-circle" size={72} color={colors.success} />
      <Text style={styles.title}>點餐已送出</Text>
      <Text style={styles.subtitle}>
        {hasPickupNumber ? '餐點完成時會推播通知您，請留意手機' : '等待店家確認，請留意店員出餐'}
      </Text>

      {hasPickupNumber && (
        <View style={styles.pickupBox}>
          <Text style={styles.pickupLabel}>取餐號碼</Text>
          <Text style={styles.pickupNumber}>{formatPickupNumber(Number(pickupNumber))}</Text>
        </View>
      )}

      <View style={styles.infoBox}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>桌號</Text>
          <Text style={styles.infoValue}>{tableNumber}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>訂單編號</Text>
          <Text style={styles.infoValue}>{orderId}</Text>
        </View>
      </View>

      <Pressable style={styles.button} onPress={() => router.replace('/shop')}>
        <Text style={styles.buttonText}>回商店</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 16 },
  subtitle: { fontSize: 13, color: colors.textSubtle, marginTop: 6, marginBottom: 24, textAlign: 'center' },
  pickupBox: {
    width: '100%', backgroundColor: colors.highlight, borderRadius: 12, paddingVertical: 20,
    alignItems: 'center', marginBottom: 16,
  },
  pickupLabel: { fontSize: 14, color: colors.textMuted },
  pickupNumber: { fontSize: 56, lineHeight: 68, fontWeight: '900', color: colors.text, letterSpacing: 4 },
  infoBox: {
    width: '100%', backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 32,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 14, color: colors.textMuted },
  infoValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  button: {
    backgroundColor: colors.tint, paddingVertical: 16, paddingHorizontal: 40,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 200,
  },
  buttonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },
});
