# CLAUDE.md

本檔案提供 Claude Code（claude.ai/code）在此儲存庫中工作時所需的指引。

## 溝通語言與跨 Session 協作

- 與使用者的所有溝通（文字回覆、提問、進度回報）一律使用**繁體中文**，不得使用英文。
- 本專案（mynotification）為**前端**，後端（FastAPI）由另一個獨立的 Claude Code session `back-end` 負責。凡涉及 API 契約、資料庫 schema 的協調，請直接透過跨 session 訊息與 `back-end` session 溝通，不要透過使用者轉達。
- 與 `back-end` session 之間的訊息也一律使用繁體中文。

## 常用指令

```bash
npm start          # 啟動 Expo 開發伺服器
npm run android    # 在 Android 裝置/模擬器上執行
npm run ios        # 在 iOS 模擬器上執行
npm run web        # 在瀏覽器中執行
npm run lint       # 執行 ESLint
```

## 環境變數

在專案根目錄建立 `.env` 檔案，並設定以下必要變數：

```
EXPO_PUBLIC_API_URL=http://<your-local-ip>:8000
EXPO_PUBLIC_SUPABASE_URL=<supabase-project-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
```

後端是 FastAPI 伺服器。在實體裝置上測試時，`EXPO_PUBLIC_API_URL` 必須使用區域網路（LAN）IP，而非 `localhost`，因為裝置與開發機雖然在同一個 Wi-Fi 下，但仍是不同的主機。

### Android 推播（FCM V1）

Android 上要能實際收到 Expo 推播，除了程式碼外還需要完成 Firebase 設定，否則 `Notifications.getExpoPushTokenAsync()` 會直接丟出 `FirebaseApp is not initialized` 錯誤：

1. Firebase Console 建立 Android App（package name 需與 `app.json` 的 `android.package` 一致），下載 `google-services.json` 放在專案根目錄，並在 `app.json` 的 `android.googleServicesFile` 指向它
2. Firebase Console →「專案設定」→「服務帳戶」產生服務帳戶私密金鑰 JSON
3. `eas credentials` → Android → **Google Service Account** → Upload 該金鑰，再進 **Manage...for Push Notifications (FCM V1)** → **Select an existing** 把剛上傳的金鑰指派給推播用途（上傳跟指派用途是分開的兩步）
4. 因為新增了 `google-services.json` 屬於原生設定變更，需要 `eas build --profile development --platform android` 重新建置 Dev Build 才會生效

## 架構

### 全域字型與版面基礎設施

- **字型（`components/Text.tsx`）** — 全域套用 Noto Sans TC（繁中字型）。專案是 **React 19 + RN 0.81**，RN 的 `<Text>` 元件已改為函式元件，而 React 19 移除了函式元件的 `defaultProps` 支援，所以坊間常見的「`Text.defaultProps.style = {...}` 套全域字型」在這個版本**完全失效**（不報錯、也不生效）。因此改用包裝元件取代 `react-native` 原生的 `Text`：全專案的畫面都是 `import Text from '.../components/Text'`，而不是 `import { Text } from 'react-native'`。這個包裝元件會依傳入 `style` 的 `fontWeight`（400/500/600/700/900/bold）自動挑選對應的 Noto Sans TC 字重檔（字型透過 `app/_layout.tsx` 的 `useFonts()` 載入，載入完成前畫面維持空白）。另外，Noto Sans TC 這類中文字型的預設行高（lineHeight）比系統字型高不少，若元件沒手動指定 `lineHeight`，`components/Text.tsx` 會依 `fontSize × 1.3` 換算一個貼近系統字型比例的預設值，避免「只靠 padding 撐高度、沒寫死 height」的按鈕因為換字型而意外變高變胖。

- **SafeArea（`react-native-safe-area-context`）** — `app/_layout.tsx` 最外層包 `SafeAreaProvider`。`app.json` 開了 `android.edgeToEdgeEnabled`，內容預設會畫到系統列（狀態列/導覽列）後面；有 header 的畫面（Drawer、Stack 的 register/coupon 詳情頁）會自動處理好上緣，但**沒有 header 的畫面**（`app/index.tsx` 登入頁、`app/magic-login.tsx`）容易被狀態列蓋住標題、或最下方內容被導覽列擋住，這兩支畫面都用 `SafeAreaView`（來自 `react-native-safe-area-context`，不是 RN 內建那個只在 iOS 好用的版本）包住畫面內容。之後新增沒有 header 的畫面時要記得比照處理。

- **Header title 置中，依畫面顯示對應功能名稱** — 只有首頁維持品牌名稱「寶雅電子商城」（`app/(drawer)/_layout.tsx` 的 `BRAND_TITLE` 常數），其餘頁面的 header title 改顯示各自的功能名稱（我的收藏／通知／設定／我的優惠券／常見問題／關於此 App／隱私權政策／優惠券詳情／註冊帳號），跟 Drawer 選單裡的顯示名稱（`drawerLabel`）意義一致但分開維護，方便使用者從 header 直接看出目前在哪個功能。`(tabs)` 底下 5 個分頁共用同一個 Drawer.Screen（`Tabs` 自己的 `headerShown` 是 `false`，header 統一由 `(drawer)/_layout.tsx` 畫），所以用 `@react-navigation/native` 的 `getFocusedRouteNameFromRoute` 讀出目前是哪個分頁、對照 `TAB_TITLES` 常數動態切換 header title；`TAB_TITLES` 的 key 要跟 `(tabs)/_layout.tsx` 每個 `Tabs.Screen` 的檔名（`name`）一致，之後新增/改名分頁時兩邊都要同步改。置中這件事在兩種 header 實作裡處理方式不同：`(drawer)/_layout.tsx` 用的是 `@react-navigation/drawer`（JS 渲染的 header），`headerTitleAlign: 'center'` 預設是相對於**左右按鈕之間的剩餘空間**計算，左邊有選單按鈕、右邊沒東西時標題會被推向右側，所以額外加了 `headerTitleContainerStyle: { left: 0, right: 0 }` 讓標題容器忽略左右按鈕寬度、撐滿整個 header 才能真正置中；而根目錄 `app/_layout.tsx` 的 `Stack`（`coupon/[id].tsx`、`register.tsx` 用）是 native-stack，委託給原生系統的 header 元件渲染，**不支援** `headerTitleContainerStyle`（`tsc` 會報型別錯誤），只需要 `headerTitleAlign: 'center'`，原生 header 通常會自己正確處理置中。

- **Drawer 專屬頁的返回箭頭（`app/(drawer)/_layout.tsx` 的 `HeaderBackButton`）** — `about`/`faq`/`privacy` 是跟 `(tabs)` 同層的 Drawer 畫面（不是 `(tabs)` 的子畫面），底部 Tab Bar 是 `(tabs)` 巢狀導覽自己畫的，離開 `(tabs)` 進到這三頁後 Tab Bar 結構上就不會顯示；這是刻意接受的設計（改動小、風險低），不打算為了保留 Tab Bar 把這三頁重構進 `(tabs)` 底下。但 Drawer 預設 header 左上角只有選單漢堡按鈕、沒有返回箭頭，不管是從首頁功能 Grid 用 `router.push` 進來、還是從 Drawer 選單點進來都會卡住回不去，所以這三頁的 `headerLeft` 改用 `HeaderBackButton`（`navigation.canGoBack() ? navigation.goBack() : navigation.navigate('(tabs)')`）取代漢堡按鈕。`(tabs)` 底下的 5 個分頁（我的收藏／通知／設定／我的優惠券）維持原本的漢堡選單 + Tab Bar，不需要返回箭頭——這是正常的 Tab 行為，直接點首頁分頁就能回去，跟直接點底部分頁列效果一樣。

- **首頁功能 Grid 與小型活動輪播（`app/(drawer)/(tabs)/home.tsx`）** — 首頁「歡迎回來」下方依序是：小型活動輪播（`PromoCarousel`）→ 3x3 功能 Grid（`QuickActionsGrid`）→ 大輪播（4 張橫幅）→ 跑馬燈 → 商品分類標籤。`QuickActionsGrid` 的 9 個入口（`QUICK_ACTIONS` 常數）全部對應 App 內既有畫面，用 `router.push('/xxx')` 導航（不含路由群組前綴，比照 `settings.tsx` 既有寫法），最後一個「全部服務」比較特殊，是用 `useNavigation()` + `DrawerActions.openDrawer()`（`@react-navigation/native`）開啟 Drawer 選單，不是 `router.push`；通知入口的紅點數字直接讀 `useNotificationStore` 的 `unreadCount`，跟 Tab Bar 徽章同一份即時資料，不是另外造的假資料。原本是 4x2（8 個入口），新增「紅利點數」後改成 3x3（9 個入口），`quickAction` 的 `width` 也從 `25%` 改成 `33.33%`。`PromoCarousel`（`PROMO_COPY` 常數）文案是純前端假資料，圖片則比照大輪播抓 DummyJSON 商品照片（`fetchPromoImages`，用 `skip` 參數跟大輪播的 `fetchBannerImages` 錯開，避免抓到重複圖片）；純文案的假資料之後若要改成後端可控（不用出 App 版本就能換活動內容），可以參考 `plan.md`（如果還在）或跟 `back-end` session 討論一張通用的 banner/promotion 表（`title`／`link_target`／`sort_order`／`start_at`／`end_at`／`is_active` 等欄位）。

### 主題系統（Theme／深色模式）

- **`constants/Colors.ts`** — 全站唯一的顏色定義來源，`Colors.light` / `Colors.dark` 兩組語意色票（`background`／`surface`／`surfaceAlt`／`border`／`text`／`textMuted`／`textSubtle`／`tint`／`onTint`／`accent`／`danger`／`dangerSurface`／`success`／`warning`／`warningSurface`／`highlight`／`white`）。淺色是原本就有的 MUJI 木質/大地色系，深色是對應設計的深木質炭褐色系，不是隨便套一套深色 palette。`tint` 統一取代了改版前混用的 `#007AFF`（藍，舊畫面按鈕）與 `#A69B8D`（裝飾用強調色），兩者現在共用同一個語意色，避免畫面之間風格不一致；`accent` 則保留給對比度需求較低的純裝飾用途（輪播小圓點、底線、Section 色塊）。

- **`hooks/useThemeColors.ts`** — 畫面元件要顏色一律呼叫這個 hook，**不要**自己 `import { Colors }` 再手動判斷 scheme。同檔案也匯出 `useResolvedScheme()`，回傳目前實際生效的 `'light' | 'dark'`（結合系統設定與使用者手動選擇，邏輯見下一點），`app/_layout.tsx` 的 `ThemeProvider`（React Navigation 導覽層顏色）也是呼叫這個 function，確保畫面內容色跟 header/Tab Bar 色永遠同步、不會不一致。

- **`store/useThemeModeStore.ts`** — 使用者可在「設定」頁手動選擇外觀模式（`'light' | 'dark' | 'system'`，預設 `'system'`），Zustand + `persist` middleware 存在 `expo-secure-store`（比照 `useFavoritesStore.ts` 的做法，只存裝置本機、不同步後端）。`useResolvedScheme()` 內部：`mode === 'system'` 時退回 `useColorScheme()`（跟裝置系統設定走），否則直接用使用者選的值蓋過系統設定。手動切換的 UI 在 `settings.tsx` 的「外觀模式」區塊，三個 Pressable 分頁（淺色／深色／系統預設）。

- **畫面裡的使用語法** — 因為顏色現在是執行期才決定（可能隨系統設定或使用者選擇改變），`StyleSheet.create` 不能再是 module 層級的靜態常數，要改成一個吃 `colors` 參數的工廠函式，搭配 `useMemo` 快取：

  ```tsx
  import { useMemo } from 'react';
  import { StyleSheet } from 'react-native';
  import { ThemeColors } from '../constants/Colors';
  import { useThemeColors } from '../hooks/useThemeColors';

  export default function SomeScreen() {
    const colors = useThemeColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    return <View style={styles.container} />;
  }

  const createStyles = (colors: ThemeColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
  });
  ```

  多個小型子元件共用同一組 `createStyles` 時（例如 `home.tsx` 裡的 `Marquee`／`QuickActionsGrid`／`FavoriteButton` 等），每個子元件各自呼叫一次 `useThemeColors()` + `useMemo`，不要把 `styles` 用 props 一路往下傳（React Context 讀取成本很低，這樣寫更單純）。

- **刻意不套用主題色、維持寫死色碼的例外**（全部有加註解說明原因）：Google（`#4285F4`）／LINE（`#06C755`）第三方登入按鈕的品牌色，改主題會違反品牌規範；`coupon/[id].tsx` 的 QR Code 白底，掃描器需要固定的黑白高對比，不能隨深色模式變灰；`home.tsx` 的 `BANNER_COPY`／Promo 輪播的粉彩色系，視為行銷內容資料而非 App 介面色，比照大部分 App 促銷輪播圖維持品牌一致外觀的做法。

- **`app.json` 的 `expo-splash-screen` plugin** — 深色模式的 `backgroundColor` 已改成 `#1C1815`（對齊 `Colors.dark.background`），跟淺色模式的 `#ffffff`（對齊 `Colors.light.background`）一樣，讓原生 Splash、`components/FallbackSplash.tsx`（`app/_layout.tsx` 在字型/登入狀態還沒準備好時顯示的 JS 版 Splash，同樣透過 `useThemeColors()` 取色）、與真正的 App 內容三者背景色一致。**這是原生設定，只有重新 `eas build` 才會反映**，光 reload JS 不會生效。

### 路由（Expo Router 檔案式路由）

- `app/_layout.tsx` — 根佈局。初始化 `QueryClient`、`GestureHandlerRootView` 與 `Toast`。啟動時透過 `useAuthStore.loadToken()` 從 SecureStore 讀取 JWT。`<Stack.Screen name="magic-login" />` 刻意放在 `userToken` 條件判斷**之外**，確保 Magic Link 的 deep link 不論登入狀態都能被導航到；依 `userToken` 狀態，用 `<Stack.Protected guard={...}>` 包住整組畫面來條件式渲染 `(drawer)` 群組（已登入）或 `index`/`register` 畫面（未登入）——**不要**改回 `{condition && <Stack.Screen />}` 的寫法，`condition` 為 `false` 時子元素會是布林值，Expo Router 的 Layout 子元素型別檢查會判定「不是 Screen」，在 console 狂噴 `Layout children must be of type Screen` 警告（雖然畫面沒問題，但每次重新 render 都再印一次）。同時設定全域的推播通知點擊監聽器，導向 `/inbox`（寫成不含路由群組前綴的純路徑，群組名稱本身不影響網址，之後群組怎麼調整巢狀層級都不用改這裡）。

- `app/index.tsx` — 登入畫面。全域設定 `Notifications.setNotificationHandler`（僅需在此設定一次）。支援四種登入方式：帳密（`POST /login/access-token`）、Google（`services/googleAuth.ts` 取得 idToken 後打 `POST /login/google`）、LINE（`services/lineAuth.ts` 取得 idToken 後打 `POST /login/line`）、Magic Link（`POST /login/magic-link/request`，沿用表單目前的 Email 欄位值）。四者取得 `access_token` 後都呼叫共用的 `services/authFlow.ts` 的 `completeLogin()` 收尾。

- `app/magic-login.tsx` — Magic Link 的 deep link 落地畫面。後端信件連結會先落地在一個由後端提供的網頁（`GET /login/magic-link/redirect`），再轉跳到 `mynotification://magic-login?token=xxx`；Expo Router 依檔名自動把這個 scheme 導到這支檔案。用 `useLocalSearchParams()` 讀 `token`、呼叫 `POST /login/magic-link/verify` 換取 JWT，再呼叫 `completeLogin()`。用 `useRef` 防止同一個 token（單次使用）被重複驗證。

- `app/coupon/[id].tsx` — 優惠券詳情/核銷頁，只在已登入時可達（於 `app/_layout.tsx` 的 `userToken` 分支註冊）。按「使用」呼叫 `POST /coupons/{id}/redeem-code` 產生 10 分鐘效期的 6 位數核銷碼並顯示 QR Code（`react-native-qrcode-svg`），下方有「分享核銷連結給店員」按鈕（`Share.share()`，RN 內建、不需要額外套件），組出 `staffscanner://redeem?code=xxx` 這個 deep link 分享出去，給店員 App（`staff-scanner`，另一個 Claude Code session `staff` 負責）在 QR 掃描失敗時的備援手動核銷管道；`staffscanner://` 的 scheme/path 格式已跟 `staff` session 確認相容，這裡只能組字串代入 code，不可自行更動格式。原本這裡還有一個「人工核銷」輸入框讓顧客自己呼叫 `POST /coupons/redeem`（模擬還沒有店員 App 之前的核銷動作），2026-09-06 `back-end` 把這支端點的授權改成需要 `role=staff`（`get_current_staff_user` 依賴，`role=customer` 呼叫會直接 403），加上 `staff-scanner` 已經正式上線，這個過渡方案已經拿掉。畫面一開始就會用 `['myCoupons']` 快取判斷這張優惠券是否已使用/已過期，避免使用者透過連結跳進一張不能用的優惠券卻只看到「使用」按鈕。

- `app/(drawer)/(tabs)/coupons.tsx` — 我的優惠券列表。有「待使用／已使用／已過期／全部」篩選標籤（各自顯示數量），排序規則是待使用優先、待使用內部依到期日由近到遠、已使用/已過期則是最新的排最前面。已使用/已過期超過 `HIDE_AFTER_DAYS`（目前 30 天，已使用用 `used_at`、已過期用 `expired_at` 當基準）會直接從列表濾掉，不占畫面版位。

- `services/authFlow.ts` — 四種登入方式共用的收尾邏輯 `completeLogin(accessToken)`：存 Token、同步 Expo Push Token、導向 `/home`。刻意寫成不依賴 React hook 的獨立函式（用 `useAuthStore.getState()` 而非 hook、用 `expo-router` 的 imperative `router` 而非 `useRouter()`），這樣非畫面元件（例如 `magic-login.tsx` 的 `useEffect`）也能直接呼叫。

- `services/googleAuth.ts` — 封裝 `@react-native-google-signin/google-signin`。`signInWithGoogle()` 回傳 idToken 或 `null`（使用者取消選擇帳號時，不視為錯誤）。此套件需要原生模組，**Expo Go 無法測試**，必須用 EAS Development Build。

- `services/lineAuth.ts` — LINE 登入，封裝原生 SDK `@xmartlabs/react-native-line`（v6，TurboModule，需要 New Architecture，本專案 `app.json` 已開 `newArchEnabled: true`）。架構完全比照 `services/googleAuth.ts`：模組載入時準備好 `Line.setup({ channelId })`（非同步，用模組層級 Promise 快取避免重複呼叫），`signInWithLine()` 呼叫 `Line.login({ scopes: [Scope.Profile, Scope.OpenId] })` 直接在 Promise 裡拿到 `idToken`，回傳格式跟 `signInWithGoogle()` 一樣是 `string | null`，全程不經過瀏覽器、不需要任何 Deep Link 轉跳；回傳 `null` 代表使用者中途取消（不視為錯誤）。取消的錯誤格式各平台不一致（Android 是 `error.code === 'LOGIN_CANCELLED'`，iOS/Web 是訊息字串包含 "cancel"），兩種都要判斷。後端只需要 `idToken`（已跟 `back-end` session 確認 `POST /login/line` 契約，不用額外傳 `idTokenNonce`）。此套件需要原生模組，**Expo Go 無法測試**，必須用 EAS Development Build；LINE Developers Console 的 Channel 設定要是 **Mobile app** 類型（Callback URL 那套是舊版瀏覽器 OAuth 才需要的東西，已經不需要）。這是原生 SDK 版本的實作，取代了舊版「瀏覽器版 OAuth + 後端中繼落地頁」（`app/redirect.tsx`、`EXPO_PUBLIC_LINE_REDIRECT_URI` 都已移除），完整的除錯歷史留在 `plan-line-login.md`，改版決策記錄在 `plan-line-login-native-sdk.md`。

  **LINE Developers Console 的 Mobile app 設定**（已完成，Channel ID `2011410702`，Console 裡是逐欄位 Edit/Update、不是整頁存檔）：LINE Login 分頁的 App types 勾了 **Mobile app**（跟舊版的 Web app 並存，之後確定不再用瀏覽器版才需要回來取消 Web app）。Android 區塊：**Package name** 填 `com.stevenchouis.mynotification`；**Package signature**（簽章金鑰 SHA-1 指紋，必填，填錯登入會在裝置上失敗）因為這個專案是 EAS Build（沒有本機 keystore），是用 `eas credentials` → Android → 選 build profile → Keystore 選項查出來的 EAS 管理金鑰指紋，目前登記的值是 `AF0692400692242B4C9B276BA3FABBCF67955DAA`——**這個值綁定特定的 keystore**，如果之後 `eas credentials` 換了新的 Android keystore（例如切換 build profile、或手動重新產生金鑰），舊指紋會失效、原生 LINE 登入會突然壞掉，必須回 Console 重新查詢並更新這個欄位。iOS 區塊的 **Bundle ID** 也已填 `com.stevenchouis.mynotification`，但 iOS 測試目前卡在還沒有 Apple Developer 帳號。

- `app/(drawer)/_layout.tsx` — 包住 `(tabs)` 的 Drawer 導航（左上角選單），提供「首頁」（連到 `(tabs)`）、「關於此 App」、「常見問題」、「隱私權政策」等次要頁面的入口。因為 Drawer 是這個區域唯一顯示 header／選單按鈕的地方，`(tabs)/_layout.tsx` 的 `Tabs` 把 `headerShown` 設為 `false`，把 header 完全交給 Drawer，避免雙重 header。登出功能刻意只放在 `settings.tsx`，Drawer 不重複提供。`about.tsx`／`faq.tsx`／`privacy.tsx` 都是靜態內容頁，沒有串接後端。

- `app/(drawer)/(tabs)/_layout.tsx` — 分頁列佈局（原路徑 `app/(tabs)/_layout.tsx`，因為新增 Drawer 而巢狀多一層）。掛載時會再次將 Expo Push Token 同步到後端（處理重新登入的情況），透過 TanStack Query 輪詢通知，並透過 `useEffect` 將 `unreadCount` 導出至 `useNotificationStore`。也會處理前景推播通知，呼叫 `queryClient.invalidateQueries({ queryKey: ['notifications'] })` — 切勿在監聽器中直接發送請求。共 5 個分頁：首頁／我的收藏／通知／設定／我的優惠券，「我的收藏」的 `tabBarBadge` 讀 `useFavoritesStore` 的收藏數量。

- `app/(drawer)/(tabs)/home.tsx` — 首頁，版面配置參考 MUJI 官網（大留白、木質/大地色系、極簡卡片列表），同時是測試多種列表/滾動元件的地方：
  - **輪播（`react-native-reanimated-carousel`）**：4 張橫幅，文案是假資料，背景圖抓 DummyJSON 商品的真實照片疊一層半透明黑色遮罩
  - **Marquee 跑馬燈**：手刻（沒有另外裝套件），用 Reanimated 的 `withRepeat`，把文字重複兩份接在一起做無縫捲動
  - **商品分類標籤**：抓 DummyJSON 的 `/products/categories`，點擊切換 `queryKey: ['products', category]`
  - **商品 Grid（`@shopify/flash-list` v2，`numColumns={3}`）**：候選池抓 30 筆（`fetchProducts`），實際顯示的 12 筆用 Fisher-Yates 洗牌隨機抽選；下拉重新整理（`onRefresh`）會重新 `refetch()` 再重新洗牌一次，確保每次下拉都看得出畫面有變化
  - **商品推薦（水平 `ScrollView`）**：卡片寬度約螢幕 62% 露出下一張的提示，下方是自製的捲動進度條（依 `onScroll` 的 `contentOffset.x` 換算比例，不是原生捲軸樣式）
  - **收藏愛心按鈕**：Grid 卡片、商品推薦卡片右上角都有，串 `useFavoritesStore`
  - 這裡的商品/分類資料全部來自公開測試 API（DummyJSON），純展示用，跟自家後端無關；共用的型別與 fetch 函式在 `services/products.ts`（`home.tsx` 與 `favorites.tsx` 共用）

- `app/(drawer)/(tabs)/favorites.tsx` — 我的收藏。用 `useQueries`（TanStack Query）依 `useFavoritesStore` 存的商品 id 陣列，各自打 `GET /products/{id}` 抓詳細資料再排成跟首頁一樣的 3 欄 Grid。

### 紅利點數（Loyalty Points）

完整規劃見 `plan-loyalty-points.md`。消費 NT$100 得 1 點（無條件捨去）、1 點折抵 NT$1、單筆訂單最高折抵訂單金額 50%、點數自入帳日起 1 年後過期——這幾個比例是跟 `back-end` 定案的常數，寫死在雙邊程式碼裡（非後台可調），前端定義在 `constants/loyalty.ts`（`POINTS_TO_CURRENCY_RATE`、`MAX_REDEEM_RATIO`）。

- **`app/points.tsx`** — 「紅利點數」畫面，比照 `app/coupon/[id].tsx` 掛在 `app/_layout.tsx` 的 `userToken` 分支下（獨立 Stack.Screen，非 Tab）。上方顯示 `GET /loyalty/me` 的餘額，下方是 `GET /loyalty/transactions` 的收支明細列表，5 種交易類型（`earn`／`redeem`／`expire`／`reverse_earn`／`reverse_redeem`）各自有固定的圖示、語意色與正負號（`app/points.tsx` 的 `TX_DISPLAY` 常數）。入口在 `settings.tsx` 的「帳號管理」區塊（顯示目前餘額）與首頁 `QUICK_ACTIONS`。
- **`reverse_earn`／`reverse_redeem`（2026-09-09 跟 `back-end` 定案）** — 原本規劃只有一個方向不固定的 `reverse` type，`back-end` 實作前重新設計拆成兩個獨立 type，讓每個 type 都維持「type 決定方向」的既有規則（跟 `earn`/`redeem`/`expire` 一致，前端不用額外判斷方向）：`reverse_earn` 是訂單取消時收回已賺點數（固定負向），`reverse_redeem` 是訂單取消/退款時退還已折抵點數（固定正向）；人類可讀的說明另外放在 `reason` 欄位（例如「訂單 #123 取消，收回消費回饋點數」），跟 type 分開、不互相打架。
- **結帳頁折抵（`app/cart.tsx`、`app/dine-in/cart.tsx`）** — 「使用點數折抵」用一個數字輸入框 + 「全部使用」按鈕（沒有另外裝滑桿套件），可折抵上限 = `min(目前點數餘額, floor(訂單金額 × MAX_REDEEM_RATIO))`，前端只做送出前的即時試算擋一次，實際折抵金額仍以後端回應為準。送出訂單時把折抵點數帶進 `use_points` 欄位（`services/shop.ts` 的 `createOrder`、`services/dineIn.ts` 的 `submitDineInOrder` 新增可選參數），成功後除了既有的 `['my-orders']`/`['my-dine-in-orders']`，也要 `invalidateQueries(['loyalty-balance'])` 與 `['loyalty-transactions'])`，不然使用者回到「紅利點數」畫面會看到舊餘額。
- **錯誤分流（已跟 `back-end` 對過規格，2026-09-07）** — `POST /orders`／`POST /dine-in-orders` 的既有庫存不足錯誤維持不變（`409`，`detail` 是純文字字串）；新增的兩種點數錯誤刻意避開 422（FastAPI 驗證失敗的 422 `detail` 是陣列，形狀不同，會跟手動 `raise HTTPException` 的 `detail` 混淆），改用「`detail` 是物件」來分辨：點數餘額不足是 `409 { error_code: "insufficient_points", message }`、超過 50% 折抵上限是 `400 { error_code: "points_cap_exceeded", message }`。前端判斷順序是先檢查 `detail` 是否為帶 `error_code` 的物件（點數錯誤），才落到既有的「純文字 `detail` + status code」分流（庫存不足／格式錯誤），不用文字比對，一律用 `error_code` 精確判斷。
- **網購路徑「消費賺點數」尚未真正上線** — 要等 `Order.status` 變成 `paid`（ECPay 尚未串接，永遠停在 `pending`，見 `plan.md`），這塊只是前端邏輯先寫好、掛勾在既有的 `paid` 狀態轉換上；`app/order/[id].tsx` 的「本筆訂單賺到/折抵了多少點數」區塊用 `points_earned > 0 || points_used > 0` 才顯示，`pending` 訂單的 `points_earned` 會是 0，不會誤導使用者以為網購結帳當下就賺到點數。堂食路徑（`DineInOrder.status → completed`，店員 App 觸發）沒有這個限制，可以直接測試。
- **`types/dineIn.ts` 補上的技術債** — `DineInOrderStatus` 原本只有 `'pending'`，但後端 `PATCH /dine-in-orders/{id}/status`（店員 App 專用）早就能把訂單標成 `'completed'`，這次順便補上 `'completed'` 值與「已完成」標籤，不然顧客端點餐紀錄遇到已完成訂單會顯示空白狀態文字。

### 狀態管理模式

三個職責嚴格分離的 store：

- **`store/useAuthStore.ts`** — 用於身分驗證的 Zustand store。將 JWT 持久化存於 `expo-secure-store`。提供 `loadToken`（僅在啟動時呼叫一次）、`setUserToken` 與 `logout`。初始狀態 `isLoading: true` 可避免在 token 檢查完成前閃現登入畫面。

- **`store/useNotificationStore.ts`** — 僅用於 UI 狀態的 Zustand store。存放分頁列徽章所需的 `unreadCount`。它從不主動抓取資料，永遠是由 `useEffect` 回應 TanStack Query 的資料變化來更新。

- **`store/useFavoritesStore.ts`** — 「我的收藏」的商品 id 清單，只存在裝置本機。用 Zustand 的 `persist` middleware + `expo-secure-store` 當儲存後端（沒有另外裝 `AsyncStorage`，沿用專案已有的 SecureStore 依賴）；收藏的是 DummyJSON 的測試商品 id，換裝置/重裝 App 會消失，**不會同步到後端**。

**TanStack Query** 是所有伺服器狀態的唯一真實來源（source of truth）。`['notifications']` 這個 query key 由 `(drawer)/(tabs)/_layout.tsx`（負責輪詢）與 `inbox.tsx`（負責顯示與變更）共用 — 兩者會自動去重複（deduplicate）。`home.tsx` 的商品/分類資料（`['products', category]`、`['product-categories']`）目前接的是公開測試 API（DummyJSON），純粹展示用，跟自家後端無關。

### API 層

- **`services/api.ts`** — 預先設定好的 Axios 實例，內建 request 攔截器（自動從 SecureStore 附加 `Authorization: Bearer <token>`）與 response 攔截器（遇到 401 時清除已儲存的 token）。需要驗證的呼叫請從此處匯入 `api`，而非直接使用原生 `axios`。注意：目前部分畫面仍直接在內部呼叫 `axios.create()` — 應優先改用共用的 `api` 實例。

### Supabase 整合

僅用於 `settings.tsx` 中的頭像圖片儲存。圖片會直接從客戶端上傳至 `avatars` bucket，為了相容 Android，使用 `arrayBuffer`（而非 `blob()`）；上傳後取得的公開 URL 會再透過 `PUT /api/v1/users/me` 同步回 FastAPI 後端。

### 後端 API 路由（FastAPI）

| 方法 | 路徑 | 用途 |
|--------|------|---------|
| POST | `/api/v1/login/access-token` | 帳密登入（form-encoded） |
| POST | `/api/v1/login/google` | Google 登入，body `{ id_token }`，回應格式與帳密登入一致 |
| POST | `/api/v1/login/line` | LINE 登入（原生 SDK 版本），body `{ id_token }`，後端送去 LINE 的 `/oauth2/v2.1/verify` 驗證簽章與 audience、拿 `sub` 比對 `User.line_id`，回應格式與帳密登入一致（舊版瀏覽器 OAuth 是 `{ code }`，已隨原生 SDK 改版棄用） |
| POST | `/api/v1/login/magic-link/request` | 請求寄送 Magic Link 登入信，body `{ email }`，回傳 204 |
| GET | `/api/v1/login/magic-link/redirect` | 信件連結的落地頁，轉跳到 `mynotification://magic-login?token=xxx`（不消耗 token，避免信箱安全掃描機器人誤觸） |
| POST | `/api/v1/login/magic-link/verify` | 用連結中的 token 換取 JWT，token 為單次使用 |
| POST | `/api/v1/users/register` | 註冊。後端會在同一個 DB transaction 內順便建立一張新會員歡迎禮券（$100、30 天效期），回應格式不受影響，前端不需要處理 |
| GET | `/api/v1/users/me` | 取得目前使用者資料 |
| PUT | `/api/v1/users/me` | 更新個人資料（例如 avatar_url） |
| POST | `/api/v1/users/push-tokens` | 註冊 Expo Push Token |
| GET | `/api/v1/notifications/inbox` | 取得通知列表 |
| PUT | `/api/v1/notifications/:id/read` | 將單筆標記為已讀 |
| PUT | `/api/v1/notifications/read-all` | 將全部標記為已讀 |
| DELETE | `/api/v1/notifications/:id` | 刪除通知 |
| GET | `/api/v1/coupons/me` | 取得目前使用者的優惠券列表 |
| POST | `/api/v1/coupons/:id/redeem-code` | 產生一組 10 分鐘效期、單次使用的核銷碼（優惠券須屬於自己），回傳 `{ code, expires_at }` |
| POST | `/api/v1/coupons/redeem` | 用核銷碼完成核銷，body `{ code }`。2026-09-06 起改為 `get_current_staff_user` 依賴，**需要 `role=staff`**，`role=customer`（一般會員）帳號呼叫會收到 `403 {"detail": "需要店員權限"}`——只有店員 App（`staff-scanner`）能呼叫，之前「顧客自己核銷」的暫代設計已隨此變更淘汰（見 `app/coupon/[id].tsx` 說明） |
| POST | `/api/v1/coupons/admin/issue` | 管理者手動發券（活動加碼、客訴補償用），**不在 Swagger `/docs` 裡**。2026-09-06 起授權改為 `deps.verify_admin_or_staff`，**雙軌並存、擇一即可**：帶對的 `X-Admin-Key` header（密鑰存後端 `.env`，前端不會用到），**或**用 `role="staff"` 帳號的 `Authorization: Bearer <JWT>` 都能通過（`role=customer` 呼叫會 403，未帶任何認證會 401）——這是應 `staff` session 要求保留的雙軌設計（營運端仍想留 Postman + Admin Key 手動發券的管道，不想拔掉）。body `{ user_email, title, discount_amount(>0), valid_days(選填，預設 30) }`，回傳完整 Coupon 物件；`staff-scanner` 那邊之後可能會用店員 JWT 直接呼叫做成 App 內的補償券 UI，mynotification 這邊目前沒有對應畫面 |
| GET | `/api/v1/loyalty/me` | 取得目前使用者的紅利點數餘額，回傳 `{ balance }` |
| GET | `/api/v1/loyalty/transactions` | 取得目前使用者的點數收支明細，新到舊，見「紅利點數」章節 |
| POST | `/api/v1/orders`、`/api/v1/dine-in-orders` | body 新增可選欄位 `use_points`；點數餘額不足回 `409 { error_code: "insufficient_points" }`，超過 50% 折抵上限回 `400 { error_code: "points_cap_exceeded" }`，跟既有庫存不足的 `409`（`detail` 純文字）分開判斷，見「紅利點數」章節 |

### 表單驗證

使用 `react-hook-form` + `zod`。Schema 定義於 `schemas/authSchema.ts`。登入採用寬鬆的密碼規則（僅檢查是否存在）；註冊則要求至少 8 個字元、包含數字與特殊符號。型別皆透過 `z.infer<>` 推導取得。
