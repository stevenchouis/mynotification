// components/AppToast.tsx
// 全站 Toast，統一顯示在下方。react-native-toast-message 的 bottomOffset 預設固定 40，
// 完全沒有考慮 Android edge-to-edge 下的系統導覽列（手勢列或三按鈕列）——碰到跟
// app/cart.tsx／app/shop/[id].tsx 按鈕同樣的問題，Toast 會貼著系統列甚至被蓋住。
// 這裡另外拉一個元件用 useSafeAreaInsets() 動態加上 insets.bottom，取代寫死的 40。
// 必須是獨立元件（不能直接寫在 app/_layout.tsx 的 RootLayout 裡）：
// useSafeAreaInsets() 要在 SafeAreaProvider 底下的子元件呼叫才讀得到裝置實際的安全區，
// RootLayout 本身就是渲染 SafeAreaProvider 的那個元件，同一層呼叫拿到的還是預設值。
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

export default function AppToast() {
  const insets = useSafeAreaInsets();
  return <Toast position="bottom" bottomOffset={40 + insets.bottom} />;
}
