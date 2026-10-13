// components/FallbackSplash.tsx
// 對應 app.json 的 expo-splash-screen 設定（splash-icon.png／splash-icon-dark.png，淺色米白／
// 深色炭褐底，各自烘焙好品牌名稱＋標語文字，見 plan.md 的開場畫面改版）。app/_layout.tsx 在
// 字型/登入狀態還沒準備好時，用這個畫面取代 `return null`：原生 Splash 的關閉時機不完全受
// hideAsync() 精準控制（尤其 Android 12+ 系統 Splash、或從背景恢復的情況），中間若真的空一拍，
// 畫面看起來也跟原生 Splash 一樣、不會露出真正的空白。
//
// 開發模式下用 require() 引入的本機圖片是透過 Metro bundler 用 HTTP 即時抓取（不是內嵌在
// App 裡），第一次顯示時會有抓圖 + 解碼的延遲，導致這裡的圖示「慢半拍才冒出來」；用
// expo-asset 在 module 層級提前 downloadAsync() 預先快取，避免這段延遲。正式 build 因為
// 圖片已內嵌在安裝檔裡不會有這個問題，但先預載也無妨。
import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import { ActivityIndicator, Text, View } from 'react-native';

import { useResolvedScheme, useThemeColors } from '../hooks/useThemeColors';

const splashIconLight = require('../assets/images/splash-icon.png');
const splashIconDark = require('../assets/images/splash-icon-dark.png');
Asset.fromModule(splashIconLight).downloadAsync();
Asset.fromModule(splashIconDark).downloadAsync();

export default function FallbackSplash() {
  const colors = useThemeColors();
  const scheme = useResolvedScheme();

  return (
    // 底色用 colors.surfaceAlt（= app.json 的 backgroundColor/dark.backgroundColor，
    // #EFE9DF／#332C25）而不是 colors.background：contain 模式下圖片四周可能留白邊，
    // 底色要跟圖片本身烘焙進去的背景色完全一致才會無縫，不會看到色塊接縫
    <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' }}>
      <Image
        source={scheme === 'dark' ? splashIconDark : splashIconLight}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
      />
      {/* 這張圖跟接下來的 WelcomeScreen 視覺上刻意延續（同樣的標題/商品照風格），
          使用者分不出「這是還在載入的 Splash」還是「已經是可以互動的 Welcome 畫面」，
          字型/登入狀態檢查這段時間完全沒有按鈕也沒有任何提示，會誤以為按鈕卡住很久才跑出來
          （見 plan.md 的改善項目）。疊一個轉圈在大概是 Welcome 按鈕會出現的位置，讓使用者
          知道還在準備中；換成 Welcome 畫面時轉圈會被真正的按鈕取代，體感上是連續的 */}
      <View style={{ position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' }}>
        <ActivityIndicator color={colors.tint} />
        {/* 用原生 RN Text（不是 components/Text.tsx）：這個畫面可能在自訂字型還沒載入完成時
            就顯示，直接用包裝元件會吃到還沒註冊好的 fontFamily；原生 Text 沒有這個綁定，
            頂多暫時用系統預設字型顯示，不影響可讀性 */}
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 10 }}>載入中…</Text>
      </View>
    </View>
  );
}
