// components/AnimatedQuickIcon.tsx
// 首頁功能 Grid 的動畫圖示：沿用 Ionicons，用 Reanimated 每隔 CYCLE_MS 播一次短動畫
// （不常駐晃動，避免讓人分心）。純 JS，不需要重新 eas build。
// 系統開啟「減少動態效果」時不播放，圖示維持靜止。
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import Animated, {
  cancelAnimation, Easing, Extrapolation, interpolate, useAnimatedStyle, useReducedMotion,
  useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';

export type QuickIconAnimation = 'shake' | 'twinkle' | 'heartbeat';

// 每一輪的總長度（動畫本身 + 靜止等待）
const CYCLE_MS = 4000;

// 各動畫實際在動的時間
const PLAY_MS: Record<QuickIconAnimation, number> = {
  shake: 800,
  twinkle: 900,
  heartbeat: 900,
};

interface Props {
  name: keyof typeof Ionicons.glyphMap;
  size: number;
  color: string;
  animation: QuickIconAnimation;
  // false 時停止並回到靜止狀態（例如通知中心沒有未讀時）
  active?: boolean;
  // 第一次播放前的延遲，讓多個圖示錯開，不會同時動
  delayMs?: number;
}

export default function AnimatedQuickIcon({ name, size, color, animation, active = true, delayMs = 0 }: Props) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (!active || reduceMotion) return;

    const playMs = PLAY_MS[animation];
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: playMs, easing: Easing.linear }),
          withTiming(0, { duration: 0 }),
          // 靜止等到這一輪結束
          withDelay(CYCLE_MS - playMs, withTiming(0, { duration: 0 })),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(progress);
  }, [active, reduceMotion, animation, delayMs, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    switch (animation) {
      case 'shake': {
        // 鈴鐺以上緣為軸左右搖，幅度逐漸變小
        const deg = interpolate(p, [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1], [0, 18, -16, 12, -8, 4, 0], Extrapolation.CLAMP);
        return { transform: [{ rotate: `${deg}deg` }] };
      }
      case 'twinkle': {
        // 放大閃一下並轉 144°（星星五等分對稱，轉完看起來回到原位）
        const scale = interpolate(p, [0, 0.3, 0.6, 1], [1, 1.3, 0.95, 1], Extrapolation.CLAMP);
        const deg = interpolate(p, [0, 1], [0, 144], Extrapolation.CLAMP);
        return { transform: [{ scale }, { rotate: `${deg}deg` }] };
      }
      case 'heartbeat': {
        // 心跳：撲通、撲通兩下
        const scale = interpolate(p, [0, 0.15, 0.3, 0.45, 0.6, 1], [1, 1.25, 1, 1.18, 1, 1], Extrapolation.CLAMP);
        return { transform: [{ scale }] };
      }
    }
  });

  return (
    <Animated.View style={[animation === 'shake' && { transformOrigin: 'top' }, animatedStyle]}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}
