// components/FallbackSplash.tsx
// 對應 app.json 的 expo-splash-screen 設定（splash-icon.png、light #ffffff / dark #000000、
// imageWidth 200、resizeMode contain）。app/_layout.tsx 在字型/登入狀態還沒準備好時，
// 用這個畫面取代 `return null`：原生 Splash 的關閉時機不完全受 hideAsync() 精準控制
// （尤其 Android 12+ 系統 Splash、或從背景恢復的情況），中間若真的空一拍，
// 畫面看起來也跟原生 Splash 一樣、不會露出真正的空白。
//
// 開發模式下用 require() 引入的本機圖片是透過 Metro bundler 用 HTTP 即時抓取（不是內嵌在
// App 裡），第一次顯示時會有抓圖 + 解碼的延遲，導致這裡的圖示「慢半拍才冒出來」；用
// expo-asset 在 module 層級提前 downloadAsync() 預先快取，避免這段延遲。正式 build 因為
// 圖片已內嵌在安裝檔裡不會有這個問題，但先預載也無妨。
import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { useThemeColors } from '../hooks/useThemeColors';

const splashIconModule = require('../assets/images/splash-icon.png');
Asset.fromModule(splashIconModule).downloadAsync();

export default function FallbackSplash() {
  const colors = useThemeColors();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <Image
        source={splashIconModule}
        style={{ width: 200, height: 200 }}
        contentFit="contain"
      />
    </View>
  );
}
