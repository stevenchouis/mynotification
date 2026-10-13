// components/WelcomeScreen.tsx
// 開場歡迎畫面（見 plan.md）：接在 Splash 之後、進首頁或登入頁之前，每次重新開啟 App 都會顯示
// 一次（不論登入與否），按下「開始使用」才繼續往下走。跟 FallbackSplash.tsx 同樣定位——
// 純 React 元件、不是 Expo Router 路由，by design 不記錄「看過了」的狀態（不用 SecureStore），
// 單純靠 app/_layout.tsx 裡的 useState 預設值在每次 App 重啟時自然重置。
//
// 跟原生 Splash 的差異：這裡 JS 已經在跑，文字/按鈕都是即時渲染、走 useThemeColors()，
// 不是烘焙進圖片裡的靜態文字；商品圖是去背透明圖（welcome-product.png），由這個元件自己排版。
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Text from './Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';

const welcomeProductImage = require('../assets/images/welcome-product.png');

export default function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>寶雅電子商城</Text>
        <Text style={styles.tagline}>發現好物，從這裡開始</Text>
        <Image source={welcomeProductImage} style={styles.productImage} resizeMode="contain" />
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
  productImage: { width: '85%', height: 240, marginTop: 48 },
  button: {
    backgroundColor: colors.tint, paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: colors.onTint, fontSize: 16, fontWeight: '700' },
});
