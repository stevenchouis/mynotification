# Plan：優惠券可折抵網購/堂食訂單

## Goal

使用者目前擁有的優惠券（`GET /api/v1/coupons/me`）只能靠 `app/coupon/[id].tsx` 產生 10 分鐘效期核銷碼、到店給店員用 staff-scanner 掃碼/手動輸入核銷——跟 App 內網購（`app/cart.tsx`）、堂食點餐（`app/dine-in/cart.tsx`）結帳完全是兩條不相干的路。這次要讓使用者在這兩個結帳頁除了現有的「使用點數折抵」，也能額外選一張優惠券直接折抵訂單金額，兩者可以疊加使用。完成的定義：結帳頁可以選一張「待使用」狀態的優惠券折抵訂單金額，跟點數折抵可以同時使用，送出訂單成功後該券立即標記已使用（無法再拿去給店員核銷或重複用於下一筆訂單），訂單詳情頁顯示本筆用了哪張券、折了多少錢。

**已跟 `back-end` 對過的設計共識**（2026-09-15）：
- 不共用現有的核銷碼機制，是新增的獨立通路：`POST /orders`/`POST /dine-in-orders` 新增 `coupon_id` 欄位，後端驗證 `user_id` 相符、`is_used=False`、未過期，用原子性 conditional UPDATE（`WHERE is_used=False`）直接標記已使用，不產生核銷碼、不需要店員介入。
- 沒有雙重使用風險：不管走「App 結帳」還是「店員掃碼核銷」，都是靠同一個 `is_used` 欄位的原子性 UPDATE 才能成功，先搶先贏，另一條路自然失敗。唯一的邊角案例是使用者先產生核銷碼準備到店、卻搶先在 App 內用掉同一張券，此時店員端看到的會是「核銷碼無效」而非更精確的「此券已使用」——文案問題，不影響資料正確性，這次不處理。
- 到店 QR 核銷流程（`redeem-code`/`redeem`）保留，兩者並存，只是使用情境不同（到店 vs. 線上），不動既有程式碼。
- **券+點數可疊加使用**（已跟使用者確認）：計算順序是先套用券折扣（`coupon_total = max(0, subtotal - discount_amount)`），點數折抵上限改成抓「券後金額」的 50%（不是原始 subtotal），這樣疊加後 `total_amount` 保證不會是負的。

## Architecture / flow

```mermaid
flowchart TD
    Cart[app/cart.tsx\napp/dine-in/cart.tsx] -->|開啟| Picker[優惠券選擇 Modal/清單]
    Picker -->|讀取可用券| CouponsCache[('myCoupons' query cache\n共用 coupons.tsx 已有的資料)]
    Picker -->|選一張| Cart
    Cart -->|即時試算：先套券折扣\n再算點數上限=券後金額*50%| Preview[折抵後金額預覽]
    Cart -->|createOrder/submitDineInOrder\n帶 coupon_id + use_points| API[POST /orders\nPOST /dine-in-orders]
    API -->|驗證 coupon 屬於使用者\n未使用/未過期\n原子性 UPDATE is_used| DB[(Coupon 表)]
    API -->|回應 Order 含\ncoupon_discount/coupon_title| OrderDetail[app/order/[id].tsx\napp/dine-in/order/[id].tsx]
    API -->|coupon 狀態衝突| ErrorHandling[前端錯誤分流\n比照 insufficient_points 模式]

    style Cart fill:#dff0d8,stroke:#3c763d
    style Picker fill:#dff0d8,stroke:#3c763d
    style OrderDetail fill:#dff0d8,stroke:#3c763d
    style ErrorHandling fill:#dff0d8,stroke:#3c763d
```

## Scope

### May modify
- `app/cart.tsx`、`app/dine-in/cart.tsx`（新增優惠券選擇 UI + 折抵試算邏輯，跟既有點數折抵區塊並列）
- `app/order/[id].tsx`、`app/dine-in/order/[id].tsx`（訂單詳情頁新增「本筆使用優惠券」顯示，比照現有 `points_earned`/`points_used` 卡片）
- `services/shop.ts` 的 `createOrder`、`services/dineIn.ts` 的 `submitDineInOrder`（新增可選的 `couponId` 參數，body 帶 `coupon_id`）
- `types/shop.ts`、`types/dineIn.ts`（`Order`/`DineInOrder` 新增 `coupon_id`/`coupon_discount`/`coupon_title` 欄位，實際欄位名稱以 back-end 回覆為準）
- `types/index.ts`（如果 `getCouponStatus` 判斷邏輯要共用，可能新增一個 `utils/coupon.ts` 或類似位置，把 `coupons.tsx` 裡目前 local 的 `getCouponStatus`/`isStale` 抽出來給 `cart.tsx`/`dine-in/cart.tsx` 共用，避免三處重複實作同一套「待使用/已使用/已過期」判斷）
- `app/(drawer)/(tabs)/coupons.tsx`（如果抽取 `getCouponStatus` 到共用檔案，這裡改成 import，不改行為）

### Must not modify
- `app/coupon/[id].tsx`、`services/api.ts` 的核銷碼相關呼叫（到店核銷流程不動）
- `store/useCartStore.ts`、`store/useDineInOrderStore.ts`（購物車/點餐清單本身的資料結構不變，優惠券選擇是結帳頁當下的 local state，不需要跨畫面持久化）
- `constants/loyalty.ts` 的 `MAX_REDEEM_RATIO`、`POINTS_TO_CURRENCY_RATE`（點數規則不變，只是折抵上限的計算基準從 subtotal 換成券後金額）
- staff-scanner 端所有程式碼（不在這個 repo）

## Existing patterns to follow
- 折抵 UI 直接比照 `cart.tsx` 現有的「使用點數折抵」區塊（`pointsRow`/`pointsInputRow`/`useAllButton` 那組 style 跟 layout），優惠券選擇可以用類似的一行「已選：XXX（折 $50）／點擊更換」+ 一個簡單的底部選單或新頁面列出可用券，不用另外裝套件，仿照現有 `Pressable` + 條件渲染的寫法
- 可用券清單直接 `useQuery({ queryKey: ['myCoupons'], ... })` 沿用 `coupons.tsx` 已經在用的同一份快取（TanStack Query 自動去重複，不會多打一次 API），篩選邏輯用 `getCouponStatus(coupon) === 'active'`
- 錯誤分流比照 `cart.tsx` 現有 `insufficient_points`/`points_cap_exceeded` 的判斷方式：先檢查 `detail` 是否為帶 `error_code` 的物件，新增的 coupon 相關錯誤代碼（例如 `coupon_already_used`/`coupon_not_found`/`coupon_expired`，實際代碼以 back-end 回覆為準）比照同一套判斷順序插入，不用文字比對
- `createOrder`/`submitDineInOrder` 新增參數的寫法比照現有 `usePoints?: number` 可選參數 + body 用 `...(couponId ? { coupon_id: couponId } : {})` 展開，維持函式簽章的一致風格
- 訂單詳情頁新增區塊比照現有 `pointsCard`（`order.points_earned > 0 || order.points_used > 0` 才顯示）的條件渲染模式

## Constraints
- 一筆訂單只能選**一張**優惠券（不支援多張優惠券疊加，只有「券 + 點數」可以疊加），`coupon_id` 是單一數字而非陣列——如果後端設計是陣列，這裡要跟著調整，但目前跟 back-end 對過的方向是單一
- 前端折抵試算只是送出前的即時預覽（比照現有點數折抵的做法），實際折抵金額與是否成功仍以後端回應為準
- 折抵金額不能讓 `discountedTotal` 顯示負數（`Math.max(0, ...)`），即使前端算錯也不該讓畫面出現負的金額
- 不新增第三方套件，優惠券選擇 UI 用現有的 `Pressable`/`Modal`（RN 內建）或直接複用 `coupons.tsx` 的卡片樣式精簡版

## Verification
- 3 個端對端測試（手動操作，肉眼確認）：
  1. Happy path：購物車選一張優惠券 + 填一些點數 → 折抵後金額正確反映「先扣券、再照券後金額算點數上限」→ 送出訂單成功 → 訂單詳情頁正確顯示用了哪張券、折了多少、點數用了多少
  2. 錯誤案例：兩個分頁/裝置同時對同一張券結帳（或先產生核銷碼再搶著在 App 結帳用掉），確認後端擋下重複使用、前端顯示清楚的錯誤訊息，不會兩邊都折抵成功
  3. 邊界案例：優惠券折扣金額 ≥ 訂單金額時（例如訂單 $50、券面額 $100），確認前端試算跟後端回應都是折抵後金額 = $0，不會出現負數，且點數折抵上限也正確變成 0（券後金額 0 的 50% 還是 0）
- 手動驗證：堂食（`dine-in/cart.tsx`）跟網購（`cart.tsx`）兩邊都各跑一次，確認兩個結帳頁行為一致
- 不涉及長時間執行流程，不需要額外的 stress test

## Done definition
- [x] `cart.tsx`/`dine-in/cart.tsx` 都能選一張「待使用」優惠券折抵，跟點數折抵可疊加使用——程式碼已完成，待實機驗證
- [x] 折抵計算順序正確：先券後點數，點數上限抓券後金額 50%——程式碼已完成，待實機驗證
- [x] 訂單詳情頁（網購+堂食）正確顯示本筆使用的優惠券與折抵金額——程式碼已完成，待實機驗證
- [x] 新的 coupon 相關錯誤（已使用/不存在/過期）有清楚的使用者提示，不是泛用的「送出失敗」——程式碼已完成，待實機驗證
- [x] 到店 QR 核銷流程（`app/coupon/[id].tsx`）完全沒被改動、行為不變——git diff 確認沒有異動這個檔案
- [ ] 3 個端對端測試都通過——待實機操作驗證
- [ ] PR/commit 說明正確標示 AI 協作——尚未 commit

## 實作紀錄（2026-09-15）
後端契約由 back-end 當天確認並實作完成（commit `a0c08db`）：`coupon_id`/`coupon_discount` 欄位、`404`「優惠券不存在」（純字串）、`409 coupon_already_used`、`409 coupon_expired`。前端當天同步完成：
- 新增 `utils/coupon.ts`（把 `coupons.tsx` 原本 local 的 `getCouponStatus`/`isStale` 抽出來共用）、`services/coupons.ts`（`fetchMyCoupons`，`coupons.tsx` 也改成呼叫這支，取代原本內嵌的 `api.get`）
- `cart.tsx`/`dine-in/cart.tsx` 都新增優惠券選擇 Modal（沿用 `['myCoupons']` 快取）+ 折抵試算（券後金額再算點數上限）+ 對應的錯誤處理分流
- `types/shop.ts`/`types/dineIn.ts` 的 `Order`/`DineInOrder` 新增 `coupon_id`/`coupon_discount`
- `order/[id].tsx`/`dine-in/order/[id].tsx` 新增「本筆優惠券折抵 $X」顯示
- `npx tsc --noEmit`、`npm run lint` 都乾淨（lint 剩的 3 個 warning 是既有、跟這次改動無關的檔案）

## ✅ 實機測試發現的重大 bug（2026-09-15，已修復並驗證，過程紀錄如下）
使用者實機測試時：選券＋點數送出訂單 → ECPay 填卡付款按下後顯示「訂單過期」，付款沒有成功 → 但訂單 `status` 仍是 `pending`，`coupon.is_used` 卻已經被標記 `True`（4 張可用券變 3 張）、44 點紅利點數也已扣款。**目前完全沒有「訂單沒能成功付款」時的資源回收機制**：
- 沒有 `pending` 訂單逾期自動取消/退還的排程 job
- 前端也沒有任何「取消」或「重新繼續付款」的入口，使用者的券/點數等於憑空消失、訂單卻卡在 `pending` 兩邊都拿不到

**已回報 back-end，請他們評估/實作**：
1. `pending` 訂單逾期自動轉 `cancelled`/`expired` 的排程 job，退還 `coupon.is_used`/`points_used`（比照 `reverse_redeem` 方向）
2. **`POST /orders/{id}/cancel`（客戶自己可呼叫，僅限自己名下 `pending` 訂單）**——使用者已確認需要這個主動取消功能，已請 back-end 優先做

**前端已做的兩個按鈕（`app/order/[id].tsx`，`status === 'pending'` 時都顯示）**：
1. **「繼續付款」**——導到 `/checkout/{order.id}`，重叫 `POST /orders/{id}/checkout`。實測一開始發現會失敗：後端 `MerchantTradeNo` 原本是訂單建立當下就固定、每次呼叫 `/checkout` 都重複沿用同一個，綠界擋掉重複的交易編號，顯示「訂單編號重複」。back-end 已修復（commit `b53d104`）：`/checkout` 每次呼叫都產生新的 `MerchantTradeNo` 覆寫回訂單（`Order.id` 仍是不變的內部主鍵），callback 反查邏輯不用改。**2026-09-15 使用者實機重新測試 TEST OK，可以正常付款成功。**
2. **「取消訂單」**——`services/shop.ts` 新增 `cancelOrder(orderId)`，呼叫 back-end 已上線的 `POST /orders/{id}/cancel`（commit `bae3152`）。點擊有二次確認 Alert，成功後 invalidate `['my-orders']`/`['myCoupons']`/`['loyalty-balance']`/`['loyalty-transactions']`。**這顆現在就能正常運作**——back-end 已在正式 DB 驗證過退還邏輯（庫存/優惠券/點數三者跟狀態變更包在同一個 transaction）。使用者卡住的測試訂單，建議直接用這顆按鈕取消、然後重新走一次全新訂單（新訂單的 `MerchantTradeNo` 是全新的，不會撞到重複交易編號的問題）。

**根因更新**：back-end 一開始猜測是「畫面 `useEffect` 重複呼叫」，但拿「繼續付款」實測後確認是**設計層面的必然行為**（不是偶發競態）——只要同一個 `MerchantTradeNo` 送去綠界超過一次就會被擋。已請 back-end 評估把 `MerchantTradeNo` 改成每次呼叫 `/checkout` 都重新產生。

## Risks & rollback
- 風險：券後金額 + 點數上限的計算如果前後端邏輯沒對齊（例如前端算的上限跟後端實際允許的上限不一致），會出現「前端顯示可以送出，後端卻回錯誤」的落差——這正是為什麼前端試算只是預覽，實際錯誤都要靠 `error_code` 精確分流處理，不能只靠前端擋
- 風險：`getCouponStatus` 如果真的抽成共用檔案，要確保 `coupons.tsx` 原本的行為（排序、隱藏規則）不受影響，抽取時只搬邏輯不改行為
- Rollback：全部是既有畫面的新增區塊 + 2 個 service 函式新增可選參數，沒有刪除既有欄位/邏輯，`git diff`/還原這幾個檔案即可完整回退

## Open questions
- **新增的 coupon 相關錯誤 `error_code` 具體代碼**——已請 back-end 提供，實作前要確認清楚（例如已使用/不存在/過期是三種不同代碼還是合併成一種），不能用猜的
- `Order`/`DineInOrder` 回應新增的欄位確切命名（`coupon_discount` vs `discount_amount` 等）——待 back-end 契約確認後再定案，目前先用上面列的暫定名稱
- 優惠券選擇 UI 要做成獨立頁面（`app/coupon-picker.tsx`）還是結帳頁內的 Modal/BottomSheet？兩種都不需要額外套件，實作時再依畫面複雜度決定，不影響整體架構
