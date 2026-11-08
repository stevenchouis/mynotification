// components/CheckInCard.tsx
// 每日簽到卡片（見 plan-daily-check-in.md），首頁 HomeHeader 與 app/points.tsx 共用。
// 7 個圓點表示這一輪的進度（第 7 天加碼），按「簽到」呼叫 POST /check-in。
// 狀態讀不到（例如後端還沒部署、網路錯誤）時整張卡片不顯示，不在首頁留一塊錯誤訊息。
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Toast from 'react-native-toast-message';

import Text from './Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { CHECK_IN_STATUS_QUERY_KEY, checkIn, fetchCheckInStatus } from '../services/checkIn';

export default function CheckInCard({ style }: { style?: ViewStyle }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: status, refetch } = useQuery({
    queryKey: CHECK_IN_STATUS_QUERY_KEY,
    queryFn: fetchCheckInStatus,
  });

  // 畫面重新取得焦點就重抓：使用者可能跨過午夜才切回來，「今天已簽到」要能變回可簽到
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (!status) return null;

  const rewards = status.rewards.length > 0 ? status.rewards : [status.today_reward];
  const cycleLength = rewards.length;
  // 已完成的天數：今天已簽 → 含今天；還沒簽 → 只到昨天
  const doneDays = status.checked_in_today ? status.cycle_day : status.cycle_day - 1;

  const handleCheckIn = async () => {
    if (isSubmitting || status.checked_in_today) return;
    setIsSubmitting(true);
    try {
      const result = await checkIn();
      const isBonus = result.points_awarded > (rewards[0] ?? 1);
      Toast.show({
        type: 'success',
        text1: `簽到成功 +${result.points_awarded} 點`,
        text2: isBonus ? `連續 ${cycleLength} 天加碼！` : `已連續簽到 ${result.streak} 天`,
      });
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      // 另一台裝置先簽過：不當成錯誤，重抓狀態讓卡片變成「今天已簽到」即可
      if (!(detail && typeof detail === 'object' && detail.error_code === 'already_checked_in')) {
        Toast.show({ type: 'error', text1: '簽到失敗', text2: '請檢查網路後再試一次' });
      }
    } finally {
      setIsSubmitting(false);
      queryClient.invalidateQueries({ queryKey: CHECK_IN_STATUS_QUERY_KEY });
      // 'loyalty-balance' 開頭的 key 會連帶刷新會員等級卡片（見 services/loyalty.ts）
      queryClient.invalidateQueries({ queryKey: ['loyalty-balance'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-transactions'] });
    }
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>每日簽到</Text>
          <Text style={styles.subtitle}>
            {status.streak > 0 ? `已連續簽到 ${status.streak} 天` : `連續 ${cycleLength} 天有加碼`}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            status.checked_in_today && styles.buttonDone,
            pressed && !status.checked_in_today && { opacity: 0.7 },
          ]}
          disabled={status.checked_in_today || isSubmitting}
          onPress={handleCheckIn}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.onTint} />
          ) : status.checked_in_today ? (
            <View style={styles.buttonContent}>
              <Ionicons name="checkmark" size={14} color={colors.textSubtle} />
              <Text style={styles.buttonTextDone}>今天已簽到</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>簽到 +{status.today_reward} 點</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.daysRow}>
        {rewards.map((points, index) => {
          const day = index + 1;
          const done = day <= doneDays;
          const isToday = day === status.cycle_day;
          const isBonus = points > (rewards[0] ?? 1);
          return (
            <View key={day} style={styles.dayItem}>
              <View
                style={[
                  styles.dayCircle,
                  isBonus && styles.dayCircleBonus,
                  done && styles.dayCircleDone,
                  isToday && !done && styles.dayCircleToday,
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={16} color={colors.onTint} />
                ) : (
                  <Text style={[styles.dayPoints, isBonus && styles.dayPointsBonus]}>+{points}</Text>
                )}
              </View>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {isToday ? '今天' : `第${day}天`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  button: {
    minWidth: 96, alignItems: 'center', backgroundColor: colors.tint,
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8,
  },
  buttonDone: { backgroundColor: colors.surfaceAlt },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  buttonText: { fontSize: 13, fontWeight: '600', color: colors.onTint },
  buttonTextDone: { fontSize: 13, fontWeight: '500', color: colors.textSubtle },

  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  dayItem: { alignItems: 'center', flex: 1 },
  dayCircle: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: 'transparent',
  },
  dayCircleBonus: { backgroundColor: colors.warningSurface },
  dayCircleDone: { backgroundColor: colors.tint },
  dayCircleToday: { borderColor: colors.tint },
  dayPoints: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  dayPointsBonus: { color: colors.warning, fontWeight: '700' },
  dayLabel: { fontSize: 10, color: colors.textSubtle, marginTop: 4 },
  dayLabelToday: { color: colors.tint, fontWeight: '600' },
});
