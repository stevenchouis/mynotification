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
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
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

  // 3b. Android 通知頻道設定——沒有明確設定過的話，expo-notifications 第一次收到通知時
  // 會自動建立一個 importance 較低（DEFAULT）的預設頻道，效果是「有聲音、但沒有橫幅彈出，
  // 只有下拉通知中心才看得到」。要讓通知跳出橫幅（heads-up），channel importance 要設成 MAX/HIGH，
  // 這件事只需要在 App 啟動時做一次即可（iOS 沒有 Notification Channel 概念，這段設定對它無效但也無害）
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  }, []);

  const isReady = fontsLoaded && !isLoading;

  // App 完全關閉時被推播點擊冷啟動，JS bundle 載入完成的當下 isReady 通常還是 false
  // （字型/Token 都還沒準備好，下面的 `if (!isReady)` 分支會 return <FallbackSplash />、
  // Stack 導覽容器根本還沒掛載），這時候呼叫 router.push 會因為沒有掛載中的導覽容器而被無聲吞掉。
  // 用 ref 記錄當下 isReady，讓 4. 的監聽器可以判斷「現在能不能直接導頁」而不是讀到 render 當下的舊值。
  const isReadyRef = useRef(isReady);
  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  const pendingNotificationDataRef = useRef<Record<string, any> | null>(null);
  // getLastNotificationResponseAsync() 補查冷啟動情境時，可能跟 4. 的 listener 重複拿到同一則
  // response（各平台行為不完全一致），用通知本身的 identifier 去重，避免同一則推播導頁/invalidate 兩次
  const handledNotificationIdsRef = useRef<Set<string>>(new Set());

  const navigateFromNotificationData = useCallback((data: Record<string, any>) => {
    if (data.screen === "ProductDetail" && data.product_id) {
      // 這則推播本來就是在通知「這個商品的資料變了」（到貨/降價），但商品詳情頁／商店列表／
      // 我的收藏列表的 useQuery 都有全域 5 分鐘 staleTime，如果使用者剛好在那之內看過這個商品
      // （例如剛收藏時），導頁進去可能還是吃到舊快取、看起來像沒更新——這裡明確 invalidate 一次
      queryClient.invalidateQueries({ queryKey: ['shop-product', String(data.product_id)] });
      queryClient.invalidateQueries({ queryKey: ['shop-products'] });
      queryClient.invalidateQueries({ queryKey: ['shop-favorites'] });
      // 推播點擊是直接 push 一個新畫面到導覽堆疊最上面，底下墊的是 App 預設畫面（首頁），
      // 不是「商店」分頁——使用者點返回鍵時體感會很奇怪（不是從哪裡來就回哪裡去）。
      // 先補 push 一次商店分頁再疊上詳情頁，讓返回鍵能自然回到清單，而不是回首頁
      router.push('/shop');
      router.push(`/shop/${data.product_id}`);
    } else if (data.screen === "Coupons" && data.coupon_id) {
      // 新會員歡迎禮券／生日禮券／管理者手動發券共用這個格式（見 CLAUDE.md）。
      // 優惠券列表有 30 天內用過/過期即隱藏的邏輯，也有全域 staleTime，剛發的新券
      // 可能還沒被抓進快取，直接導頁進去前先 invalidate 一次確保是最新資料
      queryClient.invalidateQueries({ queryKey: ['myCoupons'] });
      // 同樣先補 push 一次「我的」分頁（預設就是優惠券區塊），返回鍵才會回到清單而不是回首頁
      router.push('/coupons');
      router.push(`/coupon/${data.coupon_id}`);
    } else if (data.screen === "OrderDetail" && data.order_id) {
      // 出貨推播（見 CLAUDE.md 網購出貨章節），data 還帶一個 type: "order_shipped"，
      // 目前只有這一種來源會用到 OrderDetail，先不用另外判斷 type
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      // 同樣先補 push 一次「我的」分頁（訂單清單所在位置）再疊上詳情頁，返回鍵才會回到清單
      router.push('/coupons');
      router.push(`/order/${data.order_id}`);
    } else if (data.screen === "NotificationInbox") {
      router.push('/inbox');
    } else if (data.screen === "Points" && data.store_checkout_id) {
      // 門市收銀完成推播（type: "store_checkout_completed"，見 plan-member-code-checkout.md），
      // 點數餘額/明細剛入帳，導去前先 invalidate 一次確保不是舊快取
      queryClient.invalidateQueries({ queryKey: ['loyalty-balance'] });
      queryClient.invalidateQueries({ queryKey: ['loyalty-transactions'] });
      router.push('/points');
    }
  }, [router]);

  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    const id = response.notification.request.identifier;
    if (handledNotificationIdsRef.current.has(id)) return;
    handledNotificationIdsRef.current.add(id);

    const data = response.notification.request.content.data;
    console.log("點擊推播，收到的 data：", JSON.stringify(data));
    // 點擊推播時 App 可能剛從背景/關閉狀態恢復，通知列表的快取可能已經過期
    // （前景收到推播時是靠 (tabs)/_layout.tsx 的監聽器 invalidate，這裡是另一條路徑，要各自處理）
    queryClient.invalidateQueries({ queryKey: ['notifications'] });

    if (isReadyRef.current) {
      navigateFromNotificationData(data);
    } else {
      // Stack 還沒掛載，先記住導頁目標，等下面「isReady 轉 true」的 effect 補做
      pendingNotificationDataRef.current = data;
    }
  }, [navigateFromNotificationData]);

  // 4. 處理通知監聽：App 已在前景/背景執行時點擊推播
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => subscription.remove();
  }, [handleNotificationResponse]);

  // 4b. 處理 App 完全關閉、被推播點擊冷啟動的情況——這種情況下啟動當下那次點擊不保證會被
  // 上面的 listener 補到（listener 掛上的時間點可能晚於系統送出 response 事件），
  // 官方文件建議額外用 getLastNotificationResponseAsync() 補查一次
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        handleNotificationResponse(response);
      }
    });
  }, [handleNotificationResponse]);

  // 4c. isReady 從 false 轉 true（字型/Token 都準備好、Stack 剛掛載完成）時，
  // 補做冷啟動期間被暫存下來、當時無法導頁的那次點擊
  useEffect(() => {
    if (isReady && pendingNotificationDataRef.current) {
      const data = pendingNotificationDataRef.current;
      pendingNotificationDataRef.current = null;
      navigateFromNotificationData(data);
    }
  }, [isReady, navigateFromNotificationData]);

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
              {/* 會員條碼畫面：從首頁功能 Grid 或 settings.tsx 的「帳號管理」入口導航進來，
                  出示給店員用 staff-scanner 掃描辨識身份、於門市收銀結帳（見 plan-member-code-checkout.md） */}
              <Stack.Screen
                name="member-code"
                options={{
                  headerShown: true,
                  title: '會員條碼',
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
              {/* ECPay 結帳頁：從 cart.tsx 送出訂單成功後導航進來，WebView 顯示綠界收銀台，
                  攔截付款完成後的 deep link 導回訂單詳情頁（見 CLAUDE.md ECPay 章節） */}
              <Stack.Screen
                name="checkout/[orderId]"
                options={{
                  headerShown: true,
                  title: '付款',
                  headerTitleAlign: 'center',
                  headerLeft: () => null,
                }}
              />
              {/* 堂食點餐流程：從 (tabs)/shop.tsx 的「到店點餐」入口導航進來，
                  選餐廳 → 選桌號 → 菜單 → 清單 → 送出結果 共 5 個畫面（2026-09-10 多門市改版，
                  新增「選餐廳」這一步，見 CLAUDE.md） */}
              <Stack.Screen
                name="dine-in/restaurant"
                options={{
                  headerShown: true,
                  title: '選擇門市',
                  headerTitleAlign: 'center',
                  headerBackTitle: '返回'
                }}
              />
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
