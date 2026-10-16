// components/WelcomeScreen.tsx
// 開場歡迎畫面（見 plan.md）：接在 Splash 之後、進首頁或登入頁之前，每次重新開啟 App 都會顯示
// 一次（不論登入與否），按下「開始使用」才繼續往下走。跟 FallbackSplash.tsx 同樣定位——
// 純 React 元件、不是 Expo Router 路由，by design 不記錄「看過了」的狀態（不用 SecureStore），
// 單純靠 app/_layout.tsx 裡的 useState 預設值在每次 App 重啟時自然重置。
//
// 跟原生 Splash 的差異：這裡 JS 已經在跑，文字/按鈕都是即時渲染、走 useThemeColors()，
// 不是烘焙進圖片裡的靜態文字；商品圖是去背透明圖（welcome-product.png），由這個元件自己排版。
//
// 動畫全部用 Reanimated（純 JS 端設定，不需重新 eas build）：標題/標語/商品圖依序淡入上滑、
// 商品圖持續輕微上下漂浮、下方小提示輪播。進場動畫控制在 1 秒內，「開始使用」按鈕一開始就能按，
// 不等動畫跑完。系統開啟「減少動態效果」時，進場動畫由 Reanimated 自動略過、漂浮動畫也不啟動。
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Text from './Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';

const welcomeProductImage = require('../assets/images/welcome-product.png');

// 輪播小提示，內容都對應 App 內既有功能
const TIPS = [
  '消費 NT$100 就送 1 點紅利，1 點折抵 NT$1',
  '新會員註冊即送 $100 歡迎禮券',
  '在餐廳掃桌上的 QR Code 就能直接點餐',
  '到店出示會員條碼，結帳更快速',
];
const TIP_INTERVAL_MS = 2800;
const FLOAT_DISTANCE = 8;

export default function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();

  // 商品圖上下漂浮：0 → -FLOAT_DISTANCE 來回，等進場動畫結束後才開始
  const floatY = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    floatY.value = withRepeat(
      withTiming(-FLOAT_DISTANCE, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduceMotion, floatY]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value }] }));

  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), TIP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(500)}>
          <Text style={styles.title}>寶雅電子商城</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(500)}>
          <Text style={styles.tagline}>發現好物，從這裡開始</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.productWrap}>
          <Animated.View style={floatStyle}>
            <Image source={welcomeProductImage} style={styles.productImage} resizeMode="contain" />
          </Animated.View>
        </Animated.View>
      </View>

      <View style={styles.tipBubble}>
        {/* key 換掉就會觸發舊提示 FadeOut、新提示 FadeIn；tipSlot 絕對定位讓新舊兩則交疊、不會撐高版面 */}
        <Animated.View key={tipIndex} entering={FadeIn.duration(400)} exiting={FadeOut.duration(250)} style={styles.tipSlot}>
          <Text style={styles.tipText} numberOfLines={1}>💡 {TIPS[tipIndex]}</Text>
        </Animated.View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={onContinue}
      >
        <Text style={styles.buttonText}>開始使用</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt, padding: 24, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: colors.tint, textAlign: 'center' },
  tagline: { fontSize: 16, color: colors.textMuted, marginTop: 10, textAlign: 'center' },
  productWrap: { width: '85%', marginTop: 48 },
  productImage: { width: '100%', height: 240 },
  tipBubble: {
    backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    marginBottom: 16, height: 42, overflow: 'hidden',
  },
  tipSlot: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 16, justifyContent: 'center' },
  tipText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  button: {
    backgroundColor: colors.tint, paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: colors.onTint, fontSize: 16, fontWeight: '700' },
});
