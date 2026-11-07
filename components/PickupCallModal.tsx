// components/PickupCallModal.tsx
// 取餐叫號的全螢幕彈窗（見 plan-dine-in-pickup-call.md）：App 在前景時收到 dine_in_order_ready
// 推播，由 (tabs)/_layout.tsx 寫入 usePickupCallStore 後顯示。號碼用超大字級，讓顧客拿著手機
// 走到櫃檯時店員也看得到。App 在背景時收到的推播走系統通知，不會經過這裡。
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Text from './Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { usePickupCallStore } from '../store/usePickupCallStore';
import { formatPickupNumber } from '../types/dineIn';

export default function PickupCallModal() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const call = usePickupCallStore((state) => state.call);
  const dismiss = usePickupCallStore((state) => state.dismiss);

  const viewOrder = () => {
    if (!call) return;
    dismiss();
    // 比照推播點擊導頁：先推「我的」分頁再疊上詳情頁，返回鍵才會回到點餐清單
    router.push('/coupons');
    router.push({ pathname: '/dine-in/order/[id]', params: { id: String(call.orderId) } });
  };

  return (
    <Modal visible={!!call} animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <SafeAreaView style={styles.container}>
        <Ionicons name="restaurant" size={64} color={colors.onTint} />
        <Text style={styles.title}>餐點好了！</Text>
        <Text style={styles.subtitle}>請至櫃檯取餐</Text>

        {call?.pickupNumber != null && (
          <View style={styles.numberBox}>
            <Text style={styles.numberLabel}>取餐號碼</Text>
            <Text style={styles.number} adjustsFontSizeToFit numberOfLines={1}>
              {formatPickupNumber(call.pickupNumber)}
            </Text>
          </View>
        )}

        <Pressable style={styles.primaryButton} onPress={dismiss}>
          <Text style={styles.primaryButtonText}>我知道了</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={viewOrder}>
          <Text style={styles.secondaryButtonText}>查看訂單</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  title: { fontSize: 32, lineHeight: 42, fontWeight: '900', color: colors.onTint, marginTop: 16 },
  subtitle: { fontSize: 16, color: colors.onTint, marginTop: 4, opacity: 0.9 },
  numberBox: {
    width: '100%', backgroundColor: colors.background, borderRadius: 20,
    paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', marginTop: 32,
  },
  numberLabel: { fontSize: 16, color: colors.textMuted },
  number: { fontSize: 120, lineHeight: 140, fontWeight: '900', color: colors.text, letterSpacing: 8 },
  primaryButton: {
    width: '100%', backgroundColor: colors.background, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 40,
  },
  primaryButtonText: { fontSize: 17, fontWeight: '700', color: colors.text },
  secondaryButton: { paddingVertical: 14, marginTop: 8 },
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: colors.onTint, textDecorationLine: 'underline' },
});
