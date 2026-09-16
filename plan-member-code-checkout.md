# Plan: 會員條碼/QR Code + 實體門市結帳（mynotification 端）

## Goal
顧客在 mynotification App 開啟「會員條碼」畫面，出示限時、可切換顯示格式（條碼／QR Code）的會員辨識碼給實體門市店員；店員用 staff-scanner 掃描後辨識會員身份，於店內輸入結帳金額（簡易收銀，不綁定商品/庫存），可套用顧客的紅利點數/優惠券折抵，選擇現金或街口支付（街口支付這次僅做選項記錄，不做真實金流串接）完成結帳。完成後顧客端收到推播、紅利點數依既有比例入帳。**這份 plan.md 只涵蓋 mynotification（顧客 App）這一側的範圍**：會員碼產生/顯示畫面、格式切換、推播接收。店員端掃描/結帳畫面由 `staff-scanner` session 自己的 plan 負責，後端新端點由 `back-end` session 自己的 plan 負責——已分別發訊息提案，回覆待補（見下方 Open questions）。

Done 的定義：顧客可以在 App 內產生限時會員碼、切換條碼/QR Code 兩種格式顯示，過期後可重新產生；店員完成一筆門市結帳後，顧客收到推播且點數餘額/明細正確更新。

## Architecture / flow

```mermaid
sequenceDiagram
    participant C as 顧客
    participant M as mynotification App
    participant B as Backend (FastAPI)
    participant S as staff-scanner App
    participant St as 店員

    C->>M: 開啟「會員條碼」畫面
    M->>B: POST /loyalty/member-code (顧客 JWT)
    B-->>M: { code, expires_at }
    M->>C: 顯示條碼/QR Code（可切換格式，同一組 code）
    C->>St: 出示畫面
    St->>S: 掃描會員碼
    S->>B: 查詢會員碼 (staff JWT)
    B-->>S: 會員資料 + 點數餘額 + 可用優惠券
    St->>S: 輸入金額 + 選付款方式 + 選用點數/券
    S->>B: 送出門市結帳 (staff JWT)
    B-->>S: 結帳成功（點數入帳/扣券/member_code 標記已用）
    B--)M: 推播通知（store_checkout_completed）
    M->>C: 點擊推播 → /points 顯示新增點數明細

    style M fill:#dff0d8,stroke:#3c763d
    style C fill:#dff0d8,stroke:#3c763d
```

## Scope（mynotification 這個 repo）

### May modify
- `app/member-code.tsx`（新檔案）— 會員條碼/QR Code 畫面，比照 `app/coupon/[id].tsx` 的限時碼產生 + 倒數 + 重新產生模式，額外加格式切換 UI
- `app/_layout.tsx` — 在 `userToken` 分支下註冊新 `Stack.Screen`（比照 `points.tsx`/`coupon/[id].tsx`），推播點擊監聽器新增 `screen === "StoreCheckoutCompleted"`（或類似，待 back-end 確認實際值）分支導向 `/points`
- `services/loyalty.ts` — 新增 `generateMemberCode()`
- `types/loyalty.ts` — 新增 `MemberCodeResponse` 型別
- `app/(drawer)/(tabs)/home.tsx` 的 `QUICK_ACTIONS` — 新增一個入口（3x3 grid 需要調整或替換現有較少用的項目，待確認）
- `app/(drawer)/(tabs)/settings.tsx` — 「帳號管理」區塊可能新增入口（比照 `points.tsx` 現有入口方式）
- `package.json` — 新增條碼渲染套件（提案 `react-native-barcode-svg`，純 JS/SVG，跟既有 `react-native-svg`/`react-native-qrcode-svg` 同技術棧，理論上不需要額外 native build，實作時要驗證）

### Must not modify
- `staff-scanner` repo（掃描/結帳畫面，對方自己的 plan 負責）
- `back-end` repo（新端點，對方自己的 plan 負責）
- 現有 `services/shop.ts`／`services/dineIn.ts`／既有訂單相關程式碼（這是全新的門市通路，不是既有線上商店/堂食訂單的延伸，刻意不共用 `Order` 型別，保持獨立）

## Existing patterns to follow
- **限時碼產生/倒數/重新產生 UI**：完全比照 `app/coupon/[id].tsx` 的 `onGenerateCode`/`remainingSeconds`/`isCodeExpired` 邏輯
- **QR Code 渲染**：沿用 `react-native-qrcode-svg`（已是既有依賴）
- **主題色/樣式**：`useThemeColors()` + `createStyles(colors)` 工廠函式模式（`CLAUDE.md` 主題系統章節），QR/條碼固定白底（跟 `coupon/[id].tsx` 的 `qrWrapper` 一樣，不隨深色模式變灰，掃描器需要高對比）
- **格式切換 Tab UI**：比照 `shop.tsx` 商品分類標籤／`coupons.tsx` 篩選標籤的底線指示樣式
- **推播導航**：比照 `app/_layout.tsx` 既有的 `screen` 分支模式（`ProductDetail`/`OrderDetail`/`Coupons`）

## Constraints
- 街口支付這次只做「選項記錄」，不接真實金流 API（沒有商用金鑰，見使用者確認）
- 會員碼比照優惠券核銷碼：使用者手動按鈕產生/重新產生，不做自動輪替（跟真實支付 App 常見的「自動每隔幾秒換碼」不同，這是刻意簡化，待 back-end/使用者未來若覺得安全性不足再考慮升級）
- 不新增 Expo Go 無法測試的原生模組依賴（`react-native-barcode-svg` 若驗證後發現需要原生模組，需改選其他方案或重新跟使用者討論）

## Verification
- 3 個端對端測試（需要 mynotification + staff-scanner 兩台裝置/模擬器同時操作）：
  1. **Happy path**：顧客開啟會員條碼畫面 → 產生限時碼 → 切換條碼/QR Code 兩種格式皆正確顯示同一組值 → 店員在 staff-scanner 掃描 → 看到會員資料/點數/可用券 → 輸入金額、選現金、送出 → 顧客端收到推播 → 點擊導去 `/points` → 該筆消費的點數明細正確顯示
  2. **錯誤情境**：會員碼過期後店員才掃描，應該被拒絕並提示「已過期」，顧客需重新產生（跟現有優惠券核銷碼過期邏輯一致）
  3. **錯誤情境**：套用點數折抵超過上限（或餘額不足）時，staff-scanner 送出結帳應收到對應錯誤訊息，不能結帳成功卻沒正確扣點
- 手動驗證：因跨兩個 App 操作，無法單靠 `tsc`/`lint` 驗證，需要實機測試
- Observability：沿用既有推播 infra，若失敗需要能在 mynotification 端看到清楚的錯誤訊息（比照 `coupon/[id].tsx` 的 `Alert.alert` 錯誤處理模式）

## Done definition
- [ ] 3 個端對端測試通過（需等 staff-scanner 端完成對應功能才能真正測試）
- [ ] `npx tsc --noEmit`、`npm run lint` 乾淨
- [ ] 條碼/QR Code 格式切換視覺正確（兩種格式都能被真實掃描器讀取，非只是前端邏輯正確）
- [ ] 深色模式下條碼/QR 區塊維持白底高對比
- [ ] 推播點擊正確導航
- [ ] PR/commit 說明標註 AI 協作

## Risks & rollback
- **Risk**：條碼渲染套件跟 RN 0.81 New Architecture 相容性未知，需要實作時才能驗證
  - Rollback：若不相容，MVP 先只做 QR Code（現有 `react-native-qrcode-svg` 已驗證可用），拿掉「切換條碼格式」這個次要需求，之後再找替代方案
- **Risk**：這個功能高度依賴 back-end／staff-scanner 同步完成，三邊有一邊延遲會卡住整條端對端測試
  - Rollback：mynotification 這側（顯示會員碼畫面）可以獨立完成並先用假資料/手動打 API 驗證產生碼的 UI，不需要等對方完全就緒才能開始寫

## 已定案（back-end 2026-09-16 回覆）
- **新開獨立 entity**（暫定 `StoreCheckout`），不沿用 `Order`——理由跟當初 `DineInOrder` 獨立出來一樣：`Order` 的欄位（`merchant_trade_no`、`OrderItem`、ECPay 相關語意）對門市收銀完全不適用，硬塞會讓 `Order` 到處長出「跟通路無關就是 NULL」的欄位。
- 欄位大致方向：`id`／`user_id`／`staff_user_id`（記錄是哪個店員經手，`Order`/`DineInOrder` 沒有這個概念，因為那兩個是顧客自助操作）／`restaurant_id`（自動 scope 到登入店員的門市，**不接受 body 傳入**，跟 `tables`/`menu-items/admin`/`dine-in-orders` 同慣例）／`subtotal`（店員輸入的原始金額，命名對齊 `Order.subtotal`，不叫 `amount`）／`payment_method`（純字串 enum `"cash"|"jkopay"`，無 DB enum，跟 `Order.status`/`User.role` 同慣例）／`coupon_id`／`coupon_discount`／`points_used`／`points_discount`／`total_amount`（折抵後實付）／`status`（先留著，方便以後加「作廢/退款」）／`created_at`
- **會員碼機制**：比照 `POST /coupons/{id}/redeem-code`——6 碼數字、sha256 存 hash、**10 分鐘效期**、單次使用。「查詢會員碼」端點（店員 preview）**只查不消費**，不會在查詢當下就標記已使用；「送出結帳」端點才是真正消費會員碼的時機。這個設計已經解決 staff-scanner 提出的「查詢到送出之間可能隔幾十秒到幾分鐘」風險。
- **券/點數折抵邏輯直接複用既有的 `coupon_service.apply_coupon_for_checkout`／`loyalty_service`**（跟線上結帳折抵是同一套函式、同一套原子性 `is_used` gate、同一套錯誤格式 `coupon_already_used`/`coupon_expired`/`insufficient_points`/`points_cap_exceeded`），不是另外重新設計一套——這解決了 staff-scanner 擔心的「優惠券三條核銷路徑各自防重複」風險。
- `amount`（`subtotal`）由店員手動輸入，**後端不做金額的二次驗證來源**（沒有商品/庫存可比對，這是信任店員輸入層級，跟店員能直接改 `Product`/`MenuItem` 價格是同一個信任級別，會在文件明記避免誤解成跟 `/orders` 一樣後端權威計算）
- 推播沿用既有 `send_user_push_notifications(app_id="mynotification", ...)` infra，欄位名稱由前端（這裡）定案：提案 `{"type": "store_checkout_completed", "screen": "Points", "store_checkout_id": <id>}`
- `LoyaltyTransaction` 會新增第三個 nullable FK `related_store_checkout_id`（跟現有 `related_order_id`/`related_dine_in_order_id` 對稱）

## 已定案：條碼格式與切換功能範圍
staff-scanner 確認會支援一維條碼掃描（`scan.tsx` 的 `barcodeScannerSettings.barcodeTypes` 會加開對應格式），並詢問要用哪種編碼標準。決定採用 **Code128**：會員碼是 6 碼數字（比照 `POST /coupons/{id}/redeem-code` 的設計），Code128 可直接編碼純數字/英數混合字串、無固定長度限制，不像 EAN-13/UPC-A 需要特定位數＋檢查碼，是最泛用的選擇（會員卡/內部條碼常見標準）。已同步 staff-scanner。使用者確認**現在就先把條碼顯示/切換 UI 寫好**（不等 staff-scanner 端實際完成掃描支援），front-end 先備好，之後對方端點/掃描就緒即可直接互通。

## 已釐清：優惠券門市限定（維持現況，不影響本次範圍）
back-end 查證確認：優惠券 `restaurant_id` 在現有四條核銷路徑（到店 QR／線上結帳／堂食結帳，以及即將新增的門市收銀）都不會實際檢查門市限定，純記錄用途，這是 2026-09-10 多門市工作時使用者已確認過的既有決定，不是這次的遺漏。staff-scanner 查證後確認他們 `issue-coupon.tsx` 的「限定本門市使用」文案（`ddf6fd8`）字面意圖確實是「真的要限制」，跟 back-end 的既有決定沒同步到位，但這是 staff-scanner 自己畫面文案要不要修正的獨立問題（要問他們的使用者），**不影響**這次門市收銀的行為——門市收銀維持跟現況一致、不加門市限定檢查，已確認不會製造新的不一致。

## Open questions（尚存，不阻擋開始動工）
- `StoreCheckout`（或其他命名）、三支端點的最終路徑/回應格式，待 back-end 實作時給出（方向已確認，細節命名不影響前端這側的規劃）
- 條碼渲染套件最終選型（提案 `react-native-barcode-svg`，需支援 Code128 格式，實作時要驗證相容性與格式支援）
- `QUICK_ACTIONS`/`settings.tsx` 的入口放置位置，待畫面設計時再定（目前 3x3 grid 已滿 9 格，需要討論是否要替換掉較少用的項目，或改成 3x4）
