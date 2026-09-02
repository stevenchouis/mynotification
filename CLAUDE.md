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

- **品牌標題「寶雅電子商城」置中** — 所有頁面的 header title 統一顯示這個字串（`app/(drawer)/_layout.tsx` 的 `BRAND_TITLE` 常數），各頁面在 Drawer 選單裡的顯示名稱（`drawerLabel`）維持各自的說明文字（首頁／關於此 App／常見問題／隱私權政策），只有 header 上顯示的 `title` 統一。置中這件事在兩種 header 實作裡處理方式不同：`(drawer)/_layout.tsx` 用的是 `@react-navigation/drawer`（JS 渲染的 header），`headerTitleAlign: 'center'` 預設是相對於**左右按鈕之間的剩餘空間**計算，左邊有選單按鈕、右邊沒東西時標題會被推向右側，所以額外加了 `headerTitleContainerStyle: { left: 0, right: 0 }` 讓標題容器忽略左右按鈕寬度、撐滿整個 header 才能真正置中；而根目錄 `app/_layout.tsx` 的 `Stack`（`coupon/[id].tsx`、`register.tsx` 用）是 native-stack，委託給原生系統的 header 元件渲染，**不支援** `headerTitleContainerStyle`（`tsc` 會報型別錯誤），只需要 `headerTitleAlign: 'center'`，原生 header 通常會自己正確處理置中。

### 路由（Expo Router 檔案式路由）

- `app/_layout.tsx` — 根佈局。初始化 `QueryClient`、`GestureHandlerRootView` 與 `Toast`。啟動時透過 `useAuthStore.loadToken()` 從 SecureStore 讀取 JWT。`<Stack.Screen name="magic-login" />` 刻意放在 `userToken` 條件判斷**之外**，確保 Magic Link 的 deep link 不論登入狀態都能被導航到；依 `userToken` 狀態，條件式渲染 `(drawer)` 群組（已登入）或 `index`/`register` 畫面（未登入）。同時設定全域的推播通知點擊監聽器，導向 `/inbox`（寫成不含路由群組前綴的純路徑，群組名稱本身不影響網址，之後群組怎麼調整巢狀層級都不用改這裡）。

- `app/index.tsx` — 登入畫面。全域設定 `Notifications.setNotificationHandler`（僅需在此設定一次）。支援三種登入方式：帳密（`POST /login/access-token`）、Google（`services/googleAuth.ts` 取得 idToken 後打 `POST /login/google`）、Magic Link（`POST /login/magic-link/request`，沿用表單目前的 Email 欄位值）。三者取得 `access_token` 後都呼叫共用的 `services/authFlow.ts` 的 `completeLogin()` 收尾。

- `app/magic-login.tsx` — Magic Link 的 deep link 落地畫面。後端信件連結會先落地在一個由後端提供的網頁（`GET /login/magic-link/redirect`），再轉跳到 `mynotification://magic-login?token=xxx`；Expo Router 依檔名自動把這個 scheme 導到這支檔案。用 `useLocalSearchParams()` 讀 `token`、呼叫 `POST /login/magic-link/verify` 換取 JWT，再呼叫 `completeLogin()`。用 `useRef` 防止同一個 token（單次使用）被重複驗證。

- `app/coupon/[id].tsx` — 優惠券詳情/核銷頁，只在已登入時可達（於 `app/_layout.tsx` 的 `userToken` 分支註冊）。按「使用」呼叫 `POST /coupons/{id}/redeem-code` 產生 10 分鐘效期的 6 位數核銷碼並顯示 QR Code（`react-native-qrcode-svg`），下方「人工核銷」輸入框呼叫 `POST /coupons/redeem` 完成核銷 —— 這是暫代方案，因為目前沒有店員端核銷 App；`/coupons/redeem` 刻意不檢查優惠券擁有者（核銷碼本身就是授權憑證），這個權限模型上線前需要重新設計。畫面一開始就會用 `['myCoupons']` 快取判斷這張優惠券是否已使用/已過期，避免使用者透過連結跳進一張不能用的優惠券卻只看到「使用」按鈕。

- `app/(drawer)/(tabs)/coupons.tsx` — 我的優惠券列表。有「待使用／已使用／已過期／全部」篩選標籤（各自顯示數量），排序規則是待使用優先、待使用內部依到期日由近到遠、已使用/已過期則是最新的排最前面。已使用/已過期超過 `HIDE_AFTER_DAYS`（目前 30 天，已使用用 `used_at`、已過期用 `expired_at` 當基準）會直接從列表濾掉，不占畫面版位。

- `services/authFlow.ts` — 三種登入方式共用的收尾邏輯 `completeLogin(accessToken)`：存 Token、同步 Expo Push Token、導向 `/home`。刻意寫成不依賴 React hook 的獨立函式（用 `useAuthStore.getState()` 而非 hook、用 `expo-router` 的 imperative `router` 而非 `useRouter()`），這樣非畫面元件（例如 `magic-login.tsx` 的 `useEffect`）也能直接呼叫。

- `services/googleAuth.ts` — 封裝 `@react-native-google-signin/google-signin`。`signInWithGoogle()` 回傳 idToken 或 `null`（使用者取消選擇帳號時，不視為錯誤）。此套件需要原生模組，**Expo Go 無法測試**，必須用 EAS Development Build。

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
| POST | `/api/v1/coupons/redeem` | 用核銷碼完成核銷，body `{ code }`；**不檢查優惠券擁有者**（核銷碼本身即授權憑證），這是店員 App 尚未存在前的暫代設計 |
| POST | `/api/v1/coupons/admin/issue` | 管理者手動發券（活動加碼、客訴補償用），**不在 Swagger `/docs` 裡**，用 `X-Admin-Key` header 保護（密鑰存後端 `.env`，前端不會用到）。body `{ user_email, title, discount_amount(>0), valid_days(選填，預設 30) }`，回傳完整 Coupon 物件；用 Postman 手動觸發，前端目前沒有對應畫面 |

### 表單驗證

使用 `react-hook-form` + `zod`。Schema 定義於 `schemas/authSchema.ts`。登入採用寬鬆的密碼規則（僅檢查是否存在）；註冊則要求至少 8 個字元、包含數字與特殊符號。型別皆透過 `z.infer<>` 推導取得。
