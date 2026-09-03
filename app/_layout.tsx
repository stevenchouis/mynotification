import {
  NotoSansTC_400Regular,
  NotoSansTC_500Medium,
  NotoSansTC_600SemiBold,
  NotoSansTC_700Bold,
  NotoSansTC_900Black,
  useFonts,
} from '@expo-google-fonts/noto-sans-tc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
// 1. 匯入你的 AuthStore
import { useAuthStore } from '../store/useAuthStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

export default function RootLayout() {
  const router = useRouter();

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
      if (data.screen === "NotificationInbox") {
        router.push('/inbox');
      }
    });

    return () => subscription.remove();
  }, [router]);

  // 5. 如果還在從本地儲存讀取 Token 中，或字型還沒載入完成，先回傳空畫面避免畫面閃爍
  if (isLoading || !fontsLoaded) {
    return null;
  }

  // 在 _layout.tsx 的回傳部分可以這樣優化
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {/* 全域套用深色狀態列圖示：App 版面是白底/淺色的 MUJI 風格，Android edge-to-edge 下
              若不明確指定，系統狀態列圖示可能選到淺色而疊在白底上變成看不見（時間、電量、訊號等消失） */}
          <StatusBar style="dark" />
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
          <Toast />
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}