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
          <Stack screenOptions={{ headerShown: false }}>
            {/* Magic Link 的 deep link 落地畫面，不論登入狀態都要能被導航到 */}
            <Stack.Screen name="magic-login" />
            {/* 如果已經有 Token，把 (drawer) 放在最上面，App 啟動會直接進入主頁面（Drawer 裡包著原本的 (tabs)） */}
            {userToken ? (
              <>
                <Stack.Screen name="(drawer)" />
                {/* 優惠券詳情頁：從 (tabs)/coupons.tsx 點擊項目導航進來 */}
                <Stack.Screen
                  name="coupon/[id]"
                  options={{
                    headerShown: true,
                    title: '寶雅電子商城',
                    headerTitleAlign: 'center',
                    headerBackTitle: '返回'
                  }}
                />
              </>
            ) : (
              <>
                <Stack.Screen name="index" />
                <Stack.Screen
                  name="register"
                  options={{
                    headerShown: true,
                    title: '寶雅電子商城',
                    headerTitleAlign: 'center',
                    headerLeft: () => null,
                    headerBackTitle: '返回'
                  }}
                />
              </>
            )}
          </Stack>
          <Toast />
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}