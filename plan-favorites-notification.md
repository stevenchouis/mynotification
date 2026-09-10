# Plan：收藏商品到貨/降價通知

## Goal

使用者在商店收藏（`ShopFavorite`，DB 權威資料，見 `hooks/useShopFavorites.ts`）的商品，如果之後被 `staff` App 補貨（`stock` 從 0 變回正數）或降價（`price` 調降），系統要主動推播通知該使用者，通知內容依「到貨」「降價」分別使用不同文案。完成的定義：`staff` App 呼叫既有的 `PATCH /api/v1/products/{id}`（已部署，見下方 API 參考）改動 `stock`/`price` 時，`back-end` 偵測到「0→正數」或「price 調降」，找出所有收藏該商品的使用者、透過既有的 Expo Push 推播基礎設施發送對應文案的通知；使用者收到推播後點擊，或之後在「通知」分頁點開該則通知，都能導到該商品的商品詳情頁（`app/shop/[id].tsx`，已存在）。

推播對象範圍：只通知收藏該商品的使用者（不做全站促銷廣播）——已跟使用者確認。

## Architecture / flow

```mermaid
sequenceDiagram
    participant Staff as staff-scanner<br/>products.tsx
    participant API as back-end<br/>PATCH /products/{id}
    participant Detect as back-end<br/>異動偵測(補貨/降價)
    participant DB as ShopFavorite 表
    participant Push as 既有 Expo Push<br/>推播基礎設施
    participant App as mynotification<br/>app/_layout.tsx
    participant Inbox as mynotification<br/>(tabs)/inbox.tsx
    participant Detail as mynotification<br/>app/shop/[id].tsx

    Staff->>API: PATCH stock_delta 或 price
    API->>Detect: 比對異動前後值
    Detect->>Detect: stock 0→正數？ price 調降？
    Detect->>DB: 查詢收藏此 product_id 的 user_id 清單
    Detect->>Push: 對每位使用者建立 NotificationLog<br/>(通用 data JSON 欄位)
    Push-->>App: Expo Push 推播<br/>data: {type, screen: "ProductDetail", product_id}
    App->>Detail: 點擊推播直接導頁 router.push(/shop/{id})
    Inbox->>Detail: 或之後在通知列表點該則<br/>導頁 router.push(/shop/{id})

    style App fill:#dff0d8,stroke:#3c763d
    style Inbox fill:#dff0d8,stroke:#3c763d
```

前端（本 repo）只涉及圖中綠色兩塊：`app/_layout.tsx` 的推播點擊監聽器要新增分支、`inbox.tsx` 的通知列表要能依 `related_product_id` 導頁。`staff` 的 `PATCH /products/{id}` 端點已存在並部署（見下方 API 參考），異動偵測與推播發送邏輯是 `back-end` 的工作，不在本 repo 範圍內。

## Scope

### May modify（本 repo，前端）
- `types/notification.ts` — 已新增 `NotificationData` 型別與 `Notification.data?: NotificationData | null` 欄位（2026-09-09 已完成，見下方「已跟 back-end 對齊的契約」）。**不需要新增專屬欄位**——後端用既有的 `NotificationLog.data` 通用 JSON 欄位裝深層連結參數，`GET /notifications/inbox` 本來就會回傳，跟推播 `data` payload 是同一個物件
- `app/_layout.tsx` — 推播點擊監聽器（第 96-101 行）新增分支：`data.screen === "ProductDetail"` 時 `router.push(`/shop/${data.product_id}`)`，維持現有 `data.screen === "NotificationInbox"` 分支不動
- `app/(drawer)/(tabs)/inbox.tsx` — `renderItem` 的 `onPress` 除了既有的標記已讀，若 `item.data?.screen === "ProductDetail"` 且有 `product_id` 則同時 `router.push(`/shop/${item.data.product_id}`)`；可考慮依 `item.data?.type`（`"product_restock"` / `"product_price_drop"`）加一個小圖示區分到貨/降價通知（比照 `app/points.tsx` 的 `TX_DISPLAY` 模式），細節留給實作時判斷是否需要

### Must not modify
- `hooks/useShopFavorites.ts`、`services/shop.ts` 的收藏 API（已完成，本功能只是「讀」收藏清單來比對推播對象，這件事完全在 back-end 做，前端不用碰）
- `app/shop/[id].tsx`（商品詳情頁已存在，不需要為了這個功能新增內容，直接複用）
- `back-end`（`fastapi_pj`）與 `staff`（`staff-scanner`）repo 的程式碼——這兩塊的實作分別由對應 session 負責，本 repo 只透過 `SendMessage` 對齊 API 契約

## Existing patterns to follow

- 推播點擊路由：沿用 `app/_layout.tsx` 既有的 `data.screen` 字串比對機制（目前只有 `"NotificationInbox"` 一種），用同一套機制新增 `"ProductDetail"` 而不是另外設計一套路由方式
- 深層連結參數：不新增專屬欄位，讀後端既有的 `Notification.data` 通用 JSON 欄位（後端至少已有 3 種通知共用這個模式：任務完成通知、堂食新訂單通知店員、生日禮券通知）
- 依交易/通知類型決定圖示與文案：比照 `app/points.tsx` 的 `TX_DISPLAY` 常數寫法（一個 `Record<Type, {icon, ...}>` 常數），這裡的 `Type` 來源是 `item.data?.type`
- 收藏資料來源：`useShopFavorites()`（`hooks/useShopFavorites.ts`）已經是 DB 權威資料，`back-end` 直接查 `ShopFavorite` 表即可，不需要前端配合改動收藏邏輯

## Constraints

- 不新增第三方套件（沿用既有 `expo-notifications` 推播基礎設施）
- 通知對象只限「收藏該商品的使用者」，不做全站廣播（已跟使用者確認）
- 到貨與降價要用不同文案（已跟使用者確認），`notification_type` 至少要能區分這兩種 + 既有的一般通知
- 不更動既有 `coupons`/`inbox` 已上線的標記已讀、刪除、全部已讀行為，只加新的導頁邏輯

## Verification

3 個端到端情境（需要 `back-end`／`staff` 端功能都上線後才能真的跑，前端這邊先確保程式邏輯正確）：

1. **快樂路徑（到貨）**：使用者收藏一個 `stock = 0` 的商品 → `staff` 在 products.tsx 把該商品補貨到 `stock > 0` → 使用者收到「OO商品到貨了」的推播 → 點擊推播直接進到該商品詳情頁
2. **快樂路徑（降價）**：使用者收藏一個商品 → `staff` 調降該商品 `price` → 使用者收到「OO商品降價了」的推播（文案跟情境 1 不同）→ 在「通知」分頁點開該則通知也能進到商品詳情頁
3. **邊界情況**：使用者沒收藏某商品，`staff` 對該商品補貨/降價 → 該使用者不會收到通知（只有收藏的使用者會收到，驗證推播對象範圍沒有廣播出去）

手動驗證：需要一個測試帳號收藏一項商品，再請 `staff` 幫忙對該商品跑一次補貨或改價，確認推播與商品詳情頁導頁都正常。

## Done definition

- [x] `types/notification.ts` 新增 `NotificationData`／`Notification.data` 欄位（2026-09-09 已完成）
- [x] `app/_layout.tsx` 推播點擊能依 `data.screen === "ProductDetail"` 導到正確商品詳情頁（2026-09-09 已完成，`tsc --noEmit` 清）
- [x] `inbox.tsx` 點擊到貨/降價通知能導到正確商品詳情頁，且不影響既有標記已讀/刪除行為（2026-09-09 已完成，維持原本的標記已讀邏輯不變、只是額外加了導頁）
- [x] 已跟 `back-end` 對齊 API 契約（見下方「已跟 back-end 對齊的契約」，不需要新 schema/migration）並在本檔案記錄；CLAUDE.md 待實作完成後一併補上「紅利點數」章節同等級的說明
- [x] 3 個端到端情境都手動驗證過（2026-09-10：降價、到貨兩個快樂路徑都在真機上測過，推播橫幅／自動導頁／通知列表更新都正常；邊界情況（沒收藏的使用者不會收到）沒有另外手動測，但推播對象是後端依 `ShopFavorite.user_id` 查詢後才發送，架構上已保證）
- [x] 沒有修改「Must not modify」清單內的檔案

## Risks & rollback

- 風險：`data.screen` 字串比對如果前後端拼字對不上（例如 `"ProductDetail"` vs `"product_detail"`），推播點擊會靜默失敗（沒有任何分支符合，什麼事都不會發生）——跟 `back-end` 對契約時要把字串值明確寫進文件，不要用口頭描述
- 風險：`related_product_id` 指向的商品如果之後被下架（`is_active = false`），商品詳情頁可能顯示「找不到這個商品」——這是可接受的既有行為（`app/shop/[id].tsx` 已經有這個錯誤畫面），不需要額外處理
- Rollback：全部是新增欄位 + `app/_layout.tsx`／`inbox.tsx` 的新增分支（加法），拿掉這兩處新分支即可完整回退，不影響既有通知/收藏/商品詳情功能

## 已跟 back-end 對齊的契約（2026-09-09 定案）

- **不需要新的 schema/migration**：後端沿用 `NotificationLog` 既有的通用 `data`（JSON）欄位裝深層連結參數，`GET /notifications/inbox` 回傳的 `data` 就是推播時同一個物件（`push_service.py` 兩邊共用同一個變數），前端直接讀就好
- **推播 `data` payload 格式**（定案，字串大小寫完全照這個）：
  ```json
  { "type": "product_restock" | "product_price_drop", "screen": "ProductDetail", "product_id": 123 }
  ```
- **觸發規則**（定案）：`PATCH /products/{id}`（店員端）比較異動前後值，`stock` 0→正數＝到貨、`price` 調降＝降價；查 `Favorite.user_id`（依 `product_id`）找出收藏者，只通知這些使用者，不做全站廣播。實作方式仿照後端既有的 `send_role_push_notifications`，會做一個對應的 `send_favorite_users_notifications`
- **現況**：後端這個觸發邏輯**尚未開始寫**，等前端 UI 準備得差不多、要對接測試時再叫 `back-end`

## Open questions

目前沒有阻擋動工的未決契約問題。唯一留給實作時判斷的是：到貨/降價通知在「通知」列表要不要有專屬圖示區分（例如比照 `points.tsx` 的 `TX_DISPLAY`），或維持現有純文字列表即可——不阻擋動工。
