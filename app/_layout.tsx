import {
  NotoSansTC_400Regular,
  NotoSansTC_500Medium,
  NotoSansTC_600SemiBold,
  NotoSansTC_700Bold,
  NotoSansTC_900Black,
  useFonts,
} from '@expo-google-fonts/noto-sans-tc';
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
  Theme as NavTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// 1. 匯入你的 AuthStore
import { useAuthStore } from '../store/useAuthStore';
import AppToast from '../components/AppToast';
import FallbackSplash from '../components/FallbackSplash';
import { Colors } from '../constants/Colors';
import { useResolvedScheme } from '../hooks/useThemeColors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

// React Navigation 的 Theme 物件，控制 Stack/Drawer/Tabs 原生 header、卡片背景這些「導覽層級」
// 的顏色（畫面內容本身的顏色由各畫面自己透過 useThemeColors() 取用 constants/Colors.ts）。
// 用我們的 MUJI 色票蓋掉 React Navigation 預設的藍白配色。
const lightNavTheme: NavTheme = {
  ...NavDefaultTheme,
  colors: {
    ...NavDefaultTheme.colors,
    primary: Colors.light.tint,
    background: Colors.light.background,
    card: Colors.light.background,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.danger,
  },
};
const darkNavTheme: NavTheme = {
  ...NavDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    primary: Colors.dark.tint,
    background: Colors.dark.background,
    card: Colors.dark.background,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.danger,
  },
};

// 原生 Splash 維持顯示，直到字型與登入狀態都準備好才手動關閉，避免字型/Token 還沒載完時
// 先閃過一片空白（return null）畫面。必須在 module 層級呼叫，元件外只需執行一次。
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const scheme = useResolvedScheme();

  // 全域繁中字型（Noto Sans TC），載入完成前先不渲染畫面，避免先閃過系統預設字型
  const [fontsLoaded] = useFonts({
    NotoSansTC_400Regular,
    NotoSansTC_500Medium,
    NotoSansTC_600SemiBold,
    NotoSansTC_700Bold,
    NotoSansTC_900Black,
  });

  // 2. 從 Store 取得 loadToken 函式與載入狀態
  const loadToken = useAuthStore((state) => state.loadToken);
  const isLoading = useAuthStore((state) => state.isLoading);
  const userToken = useAuthStore((state) => state.userToken);

  // 3. 處理自動登入邏輯
  useEffect(() => {
    loadToken(); // App 一啟動就執行讀取本地 Token 的動作
  }, [loadToken]);

  // 4. 處理通知監聽
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data.screen === "ProductDetail" && data.product_id) {
        router.push(`/shop/${data.product_id}`);
      } else if (data.screen === "NotificationInbox") {
        router.push('/inbox');
      }
    });

    return () => subscription.remove();
  }, [router]);

  const isReady = fontsLoaded && !isLoading;

  // 5. 字型與 Token 都準備好才關閉原生 Splash，畫面切換時已經是完整內容，不會露出空白
  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  // 6. 還沒準備好時渲染跟原生 Splash 外觀一致的畫面（而不是 return null），避免原生 Splash
  // 關閉時機（尤其 Android 12+ 系統 Splash、或從背景恢復）跟這裡的 isReady 沒對齊時，
  // 中間露出一段真正的空白畫面
  if (!isReady) {
    return <FallbackSplash />;
  }

  // 在 _layout.tsx 的回傳部分可以這樣優化
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={scheme === 'dark' ? darkNavTheme : lightNavTheme}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {/* 狀態列圖示顏色跟著系統深色/淺色模式切換：淺色底用深色圖示、深色底用淺色圖示，
              確保 Android edge-to-edge 下時間/電量/訊號等系統圖示不會跟背景同色而看不見 */}
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {/* 注意：Stack 的每個直接子元素都必須是 Stack.Screen 本身，不能用 <>...</> Fragment
              把好幾個 Stack.Screen 包起來再塞進三元運算式——Expo Router 檢查子元素時不會穿透 Fragment，
              整包會被判定為「不是 Screen」而整個忽略（畫面仍會因為檔案式路由自動可達，但這裡設定的
              headerShown/title/headerBackTitle 等 options 完全不會生效）。原本用
              `condition && <Stack.Screen ... />` 在 condition 為 false 時子元素會是布林值 false，
              一樣會被判定為「不是 Screen」而在 console 狂噴 "Layout children must be of type
              Screen" 警告（雖然畫面沒問題，但每次重新 render 都會再印一次）。改用 Expo Router 官方
              提供的 `<Stack.Protected guard={...}>` 包一整組畫面，才是正確、不會噴警告的寫法。 */}
          <Stack screenOptions={{ headerShown: false }}>
            {/* Magic Link 的 deep link 落地畫面，不論登入狀態都要能被導航到 */}
            <Stack.Screen name="magic-login" />
            <Stack.Protected guard={!!userToken}>
              {/* 已登入：把 (drawer) 放在最上面，App 啟動會直接進入主頁面（Drawer 裡包著原本的 (tabs)） */}
              <Stack.Screen name="(drawer)" />
              {/* 優惠券詳情頁：從 (tabs)/coupons.tsx 點擊項目導航進來 */}
              <Stack.Screen
                name="coupon/[id]"
                options={{
                  headerShown: true,
                  title: '優惠券詳情',
                  headerTitleAlign: 'center',
                  headerBackTitle: '返回'
                }}
              />
              {/* 紅利點數畫面：從 settings.tsx 的「帳號管理」入口或首頁功能 Grid 導航進來 */}
              <Stack.Screen
                name="points"
                options={{
                  headerShown: true,
                  title: '紅利點數',
                  headerTitleAlign: 'center',
                  headerBackTitle: '返回'
                }}
              />
              {/* 商品搜尋頁：從首頁搜尋列導航進來 */}
              <Stack.Screen
                name="search"
                options={{
                  headerShown: true,
                  title: '搜尋商品',
                  headerTitleAlign: 'center',
                  headerBackTitle: '返回'
                }}
              />
              {/* 商店商品詳情頁：從 (tabs)/shop.tsx 點擊商品卡片導航進來 */}
              <Stack.Screen
                name="shop/[id]"
                options={{
                  headerShown: true,
                  title: '商品詳情',
                  headerTitleAlign: 'center',
                  headerBackTitle: '返回'
                }}
              />
              {/* 購物車頁：從 (tabs)/shop.tsx 的購物車按鈕導航進來 */}
              <Stack.Screen
                name="cart"
                options={{
                  headerShown: true,
                  title: '購物車',
                  headerTitleAlign: 'center',
                  headerBackTitle: '返回'
                }}
              />
              {/* 訂單詳情頁：從 (tabs)/coupons.tsx 的「我的訂單」區段點擊項目導航進來 */}
              <Stack.Screen
                name="order/[id]"
                options={{
                  headerShown: true,
                  title: '訂單詳情',
                  headerTitleAlign: 'center',
                  headerBackTitle: '返回'
                }}
              />
              {/* 堂食點餐流程：從 (tabs)/shop.tsx 的「到店點餐」入口導航進來，
                  桌號 → 菜單 → 清單 → 送出結果 共 4 個畫面 */}
              <Stack.Screen
                name="dine-in/table"
                options={{
                  headerShown: true,
                  title: '選擇桌號',
                  headerTitleAlign: 'center',
                  headerBackTitle: '返回'
                }}
              />
              <Stack.Screen
                name="dine-in/menu"
                options={{
                  headerShown: true,
                  title: '點餐菜單',
                  headerTitleAlign: 'center',
                  headerBackTitle: '返回'
                }}
              />
              <Stack.Screen
                name="dine-in/cart"
                options={{
                  headerShown: true,
                  title: '點餐清單',
                  headerTitleAlign: 'center',
                  headerBackTitle: '返回'
                }}
              />
              <Stack.Screen
                name="dine-in/confirm"
                options={{
                  headerShown: true,
                  title: '訂單確認',
                  headerTitleAlign: 'center',
                  headerLeft: () => null,
                }}
              />
              {/* 堂食點餐歷史記錄詳情頁：從 (tabs)/coupons.tsx 的「我的點餐」區段點擊項目導航進來 */}
              <Stack.Screen
                name="dine-in/order/[id]"
                options={{
                  headerShown: true,
                  title: '點餐詳情',
                  headerTitleAlign: 'center',
                  headerBackTitle: '返回'
                }}
              />
            </Stack.Protected>
            <Stack.Protected guard={!userToken}>
              <Stack.Screen name="index" />
              <Stack.Screen
                name="register"
                options={{
                  headerShown: true,
                  title: '註冊帳號',
                  headerTitleAlign: 'center',
                  headerLeft: () => null,
                  headerBackTitle: '返回'
                }}
              />
            </Stack.Protected>
          </Stack>
          {/* 全站 Toast 統一顯示在下方（套件內建的 bottom 置中橫幅），不用每個 Toast.show() 呼叫
              自己指定 position，這裡設一次全域生效；細節見 components/AppToast.tsx */}
          <AppToast />
        </GestureHandlerRootView>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
