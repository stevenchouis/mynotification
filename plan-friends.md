# Plan: 好友功能（第一期：加好友 + 快速訊息 + 推播）

## Goal
使用者想在 mynotification 新增好友系統，體驗參考 Pokémon GO／Pikmin Bloom 的好友卡片（使用者提供截圖）：顧客可以出示自己的 QR Code，另一位顧客用相機掃描後送出好友邀請，**需要對方確認才成立好友關係**；好友列表可以加星號標記重要好友；好友卡片下方有幾顆預設的快速訊息按鈕（例如「謝謝！」「加油！」），按下後對方會收到 App 推播通知。

**第一期範圍刻意不含紅利點數互轉**（已跟使用者確認留到下一個獨立 plan，理由是點數等同貨幣，牽涉防詐騙/單日上限/交易記錄，設計份量足以獨立一個 plan）。

完成的定義：顧客能顯示自己的好友 QR Code、用相機掃描別人的 QR Code 送出邀請、在好友頁看到待確認邀請並接受/拒絕、好友列表可以加星號（本機標記，比照「我的收藏」不同步後端）、好友卡片顯示對方大頭貼、對好友按下快速訊息按鈕後對方能在通知列表看到並收到推播。入口放在「我的」分頁（`coupons.tsx`）的 header 右上角圖示按鈕。

## Architecture / flow

```mermaid
sequenceDiagram
    participant A as 顧客 A<br/>app/friends/scan.tsx (新)
    participant BE as back-end<br/>/api/v1/friends/* (新)
    participant B as 顧客 B<br/>app/friends/index.tsx (新)

    A->>A: 開「掃描好友 QR Code」(expo-camera)
    A->>BE: POST /friends/requests { target_user_id }<br/>(掃到 B 的 QR Code 解出 user_id)
    BE->>BE: 建立 pending 好友邀請，防重複/防自己加自己
    BE-->>A: 201 送出成功
    BE->>B: 推播通知 { type: friend_request, screen: 'Friends' }
    B->>BE: GET /friends/requests（待確認清單）
    B->>BE: POST /friends/requests/{id}/accept
    BE->>BE: 狀態 → accepted
    BE-->>B: 200
    BE->>A: 推播通知 { type: friend_request_accepted, screen: 'Friends' }

    A->>BE: GET /friends（好友列表）
    A->>A: app/friends/[friendshipId].tsx 對 B 按「謝謝！」
    A->>BE: POST /friends/{friendshipId}/greetings { message: "謝謝！" }
    BE->>B: 推播通知 { type: friend_greeting, screen: 'Friends' }
    B->>BE: GET /notifications/inbox（既有端點，看到這則）

    style A fill:#dff0d8,stroke:#3c763d
    style B fill:#dff0d8,stroke:#3c763d
```

## Scope

### May modify / create（mynotification）
- `types/friends.ts`（新）— `Friend`／`FriendRequest`／`FriendshipStatus`（`Friend`/`FriendRequest` 皆含 `avatar_url: string | null`，來源是對方 `settings.tsx` 既有的 Supabase 頭像欄位），`QUICK_MESSAGES` 常數（前端定義的固定選項字串陣列：`['讚讚！', '謝謝！', '加油！', '太厲害了！']`，後端只負責原樣存起來/推播，不驗證內容）
- `services/friends.ts`（新）— `fetchFriends()`／`fetchFriendRequests()`／`sendFriendRequest(targetUserId)`／`respondToFriendRequest(id, action)`／`sendGreeting(friendshipId, message)`，比照 `services/dineIn.ts`／`services/loyalty.ts` 的寫法透過 `services/api.ts` 的 `api` 實例呼叫
- `store/useFriendStarStore.ts`（新）— 好友加星號標記，**本機 only**，比照 `store/useFavoritesStore.ts` 的 `persist` + SecureStore 寫法（key 存 `friendshipId` 陣列）
- `app/friends/index.tsx`（新）— 好友列表 + 待確認邀請區塊（比照 `app/(drawer)/(tabs)/coupons.tsx` 的區段切換 UI：「好友」／「待確認邀請」兩個 Pill），列表卡片用 `expo-image` 顯示 `avatar_url`，沒設定時顯示預設圖示（比照 `settings.tsx` 頭像沒設定時的既有 fallback 寫法）
- `app/friends/scan.tsx`（新）— 相機掃描畫面，用 `expo-camera` 的 `CameraView`（`barcodeScannerSettings: { barcodeTypes: ['qr'] }`），掃到後解析 `user_id` 呼叫 `sendFriendRequest`
- `app/friends/my-code.tsx`（新）— 顯示自己的 QR Code（`react-native-qrcode-svg`，QR 內容是自己的 `user.id`），文案比照 `app/member-code.tsx`「出示此畫面給對方掃描」
- `app/friends/[friendshipId].tsx`（新）— 好友卡片詳情頁：大頭貼/名稱、加星號按鈕、快速訊息按鈕列（`QUICK_MESSAGES.map`）
- `app/_layout.tsx` — 在 `Stack.Protected guard={!!userToken}` 區塊新增 4 個 `Stack.Screen`（`friends/index`／`friends/scan`／`friends/my-code`／`friends/[friendshipId]`）；推播點擊導航新增 `data.screen === 'Friends'` 分支導去 `/friends`
- `app/(drawer)/_layout.tsx` — **入口改放 header 右上角**：`(tabs)` 的 `Drawer.Screen` 目前 `options` 只依 `getFocusedRouteNameFromRoute(route)` 算 `title`，這裡額外加 `headerRight`，只在目前分頁是 `coupons`（我的）時顯示一個好友圖示按鈕（`Ionicons name="people-outline"`），用 `expo-router` 的 imperative `router.push('/friends')`（比照 `services/authFlow.ts` 的寫法，不需要 `navigation` prop），其餘 4 個分頁 `headerRight` 維持 `undefined`
- `app.json` — 加入 `expo-camera` 的 config plugin 並宣告相機權限說明文字
- `package.json` — 新增 `expo-camera` 依賴

### Must not modify
- `store/useFavoritesStore.ts`、`app/(drawer)/(tabs)/favorites.tsx`、`app/(drawer)/(tabs)/home.tsx` 的 DummyJSON 展示邏輯 — 好友功能是全新獨立範疇，不共用
- `store/useThemeModeStore.ts`、`services/loyalty.ts`、紅利點數相關檔案 — 點數轉贈是下一期，這次不動
- `app/member-code.tsx`、`app/coupon/[id].tsx` 既有 QR/條碼邏輯 — 好友 QR Code 是全新畫面，樣式可以參考但不共用元件（好友碼不像會員碼有 10 分鐘時效／單次使用限制，性質不同）
- 不新增点数转赠、不新增聊天/自由輸入訊息（快速訊息僅限預設選項，不做文字輸入框）

## Existing patterns to follow
- **本機 only 的標記型 store**：比照 `store/useFavoritesStore.ts`
- **列表 + 詳情頁 + 區段切換**：比照 `app/(drawer)/(tabs)/coupons.tsx`（Pill 切換、`useQuery` + `queryKey`）
- **QR Code 顯示**：比照 `app/member-code.tsx`（`react-native-qrcode-svg`，白底 wrapper 不隨深色模式變色，理由跟核銷碼一致——QR 需要黑白高對比）
- **推播點擊導航**：比照 `app/_layout.tsx` 現有的 `data.screen` 字串比對分支（`"Coupons"`／`"Points"` 等）新增 `"Friends"` 分支
- **獨立 Stack 頁掛在 `userToken` 分支**：`app/friends/index.tsx` 等 4 個新畫面比照 `app/points.tsx`／`app/member-code.tsx`，是獨立 Stack.Screen（非 Tab、非 Drawer 次要頁），從「我的」分頁 header 按鈕 `router.push` 進入，`headerBackTitle: '返回'`
- **依目前分頁動態調整 header 內容**：`app/(drawer)/_layout.tsx` 的 `(tabs)` `Drawer.Screen` 現有 `options` 已經用 `getFocusedRouteNameFromRoute(route)` 動態算 `title`，這次比照同一個機制、同一個 `options` function 內再多算一個 `headerRight`
- **主題**：所有新畫面用 `useThemeColors()` + `useMemo(() => createStyles(colors), [colors])`

## Constraints
- 快速訊息是前端定義的固定選項（enum-like 字串陣列），不開放自由輸入文字，避免變成聊天室/內容審核問題
- 好友加星號**不同步後端**，換裝置/重灌 App 會消失（比照收藏的既有取捨，一致的使用者預期）
- 相機掃描僅支援 QR（`barcodeTypes: ['qr']`），不需要同時支援 Code128（會員碼/核銷碼那套跟這個功能無關）
- 新增 `expo-camera` 是原生模組變更，**加完要重新 `eas build --profile development` 才會生效**（比照 CLAUDE.md 記錄的 google-services.json／LINE SDK 前例），Expo Go 沒有相機掃碼原生能力也無法測試這段

## Verification
- 3 個端對端測試（需要兩台實體裝置或模擬器，各登入不同帳號）：
  1. Happy path：裝置 A 開「我的好友 QR Code」→ 裝置 B 開「掃描好友」對準 A 的畫面掃描 → B 送出邀請成功 → A 收到推播、進「好友」頁「待確認邀請」看到 B → A 按「接受」→ 雙方好友列表都出現對方 → A 對 B 按「謝謝！」→ B 收到推播並在通知列表看到這則
  2. 錯誤案例：A 嘗試掃描「自己的」QR Code（例如兩台裝置登入同一帳號測試），畫面顯示清楚錯誤訊息（不能加自己好友），不送出請求
  3. 錯誤案例：A 對已經是好友的對象重複掃描/送出邀請，後端回傳「已經是好友」錯誤，畫面訊息清楚、不產生重複的好友關係
- 手動驗證：淺色/深色模式各跑一次 Happy path；相機權限被拒絕時顯示清楚的引導文字（打開設定授權相機），不是白屏或崩潰
- 不涉及長時間執行流程，不需要額外的 stress test

## Done definition
- [ ] 已跟 back-end 確認 `/api/v1/friends/*` 端點契約並等待部署
- [ ] `app/friends/*` 四個畫面完成，`tsc`/`lint` 乾淨
- [ ] 「我的」分頁 header 右上角新增好友入口圖示
- [ ] 推播點擊能正確導到好友頁
- [ ] 3 個端對端測試都通過（需要兩台裝置、需要 EAS Dev Build 重新建置含 `expo-camera`）
- [ ] Commit 說明正確標示 AI 協作

## Risks & rollback
- 風險：`expo-camera` 是原生模組，這次改動無法用 Expo Go 完整測試，必須重新建置 Dev Build，測試週期會拉長
- 風險：好友 QR Code 直接編碼 `user_id`（沿用 settings.tsx 已經公開顯示「會員編號」的既有慣例），理論上知道對方會員編號就能建立好友邀請請求——但因為**需要對方確認才成立**，被騷擾風險有限（跟被陌生人加好友的一般社交 App 風險等級相同），如果之後想加防護（例如允許封鎖/停用邀請），可以留到之後再補
- Rollback：全部是新檔案 + `app/_layout.tsx`／`app/(drawer)/_layout.tsx` 兩處小範圍新增（各自獨立區塊，`git diff` 還原即可）+ `app.json`/`package.json` 的 `expo-camera` 依賴移除

## 後端設計（2026-09-19 跟 back-end 對齊定案）
- `Friendship` 單一表＋正規化 pair（`user_a_id`／`user_b_id` 建立時排序成較小/較大 id，`requester_id` 另外記錄真正發起者），`UniqueConstraint(user_a_id, user_b_id)` 防止重複關係，不另開歷史表——拒絕後維持同一列、`status` 改回 `pending` 即可重新邀請
- **雙方互相掃描直接自動判定為互相接受**：B 對已存在的 pending pair 送出邀請時，後端直接把該列改成 `accepted`（不用 B 再確認一次），符合「雙方都主動出示 QR Code」等同雙方同意的直覺
- 自己重複邀請同一人是 idempotent（回傳現有狀態，不報錯），防止自己加自己在 `target_user_id === 自己` 時回 400
- **推播 payload 三種 type 都要帶 `friendship_id`**（比照 `product_id`／`order_id` 既有慣例）：`{ type: 'friend_request' | 'friend_request_accepted' | 'friend_greeting', screen: 'Friends', friendship_id }`——`types/notification.ts` 的 `NotificationData` 之後要記得補上 `friendship_id?: number`
- 好友列表/邀請 API 回傳 `avatar_url`（讀 `User.avatar_url` 既有欄位，不需另開端點）——已確認

## Open questions
- 目前設計已跟 back-end 對齊，暫無阻塞的開放問題；`back-end` 表示規模跟當初 StoreCheckout 差不多、抓一次 session 可以做完，但**尚未排入開發**，等雙方使用者確認優先序後才會正式動工
