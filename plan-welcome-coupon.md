# Plan: 新會員註冊禮券（後端功能，前端僅小改文案）

## Goal
使用者要求：註冊完成時，在 `/users/register` 的同一個資料庫交易裡順便發一張新會員歡迎禮券，不需要另外呼叫發券 API 或等 CronJob。這次幾乎全是後端工作，前端只需要視情況調整註冊成功的提示文案。

## 提案內容（待 back-end 回覆確認）

### 交易一致性
- 在 `POST /api/v1/users/register` 建立 `User` 的**同一個 DB transaction** 裡，順便建立一張 `Coupon`（title 例如「新會員歡迎禮券」），一起 commit。因為註冊本身天生只會發生一次（不能用同一個 email 重複註冊），不需要額外的冪等性檢查（不像生日禮券 CronJob 或 admin 發券那樣有重複觸發風險）
- 建議內容：`discount_amount` 比照 admin 發券預設值抓 100、`valid_days` 比照抓 30（皆為建議值，實際金額/天數由 back-end 或使用者決定）

### ⚠️ 重要提醒：這個時間點註冊使用者還沒有 Push Token
前端這邊的登入流程是：`services/authFlow.ts` 的 `completeLogin()` 才會同步 Expo Push Token 到後端，而 `register.tsx` 目前**只呼叫 `/register`，不會自動登入**（註冊成功後彈出 Alert，使用者要自己再回登入畫面登入）。也就是說：**註冊當下這個使用者在後端根本還沒有任何 push token 記錄**，如果 `/register` 這裡也比照 admin 發券／生日禮券呼叫 `send_user_push_notifications`，會因為找不到裝置 token 而送不出真推播（不是 bug，是預期行為）。使用者會在**之後登入、Push Token 同步完成**才有辦法收到即時推播；在那之前，只能透過打開 App 查看「我的優惠券」/通知列表才會看到這張禮券。

這點只是想先讓 back-end 知道，設計上不需要為此做任何特殊處理，正常呼叫共用的發券邏輯即可，push 送不出去會被目前的錯誤處理機制正常吞掉（比照先前生日禮券「推播失敗不擋住其他人」的設計）。

### 前端配合的小改動（等 back-end 確認規格後才動手）
- `app/register.tsx` 的註冊成功 `Alert` 文案，考慮加一句提醒使用者「登入後可以看到新會員禮券」，避免使用者不知道要去哪裡找（因為當下收不到即時推播）

## back-end 已確認的設計
1. 同意在 `/register` 同一個交易裡建立 Coupon，不需要冪等性檢查（email unique 天然防重複）
2. `discount_amount=100`、`valid_days=30`、`title`「新會員歡迎禮券」都照建議值實作
3. 部分共用：admin 發券與新會員禮券都是「N 天後到期」模式，會抽一個共用的 `build_coupon()` helper（放 `app/services/coupon_service.py`）；生日禮券的到期日邏輯是「下個月最後一天」，計算方式不同，維持原本獨立邏輯，不會硬套同一個 helper
- 沒有 Push Token 這件事：同意是預期行為，推播查無 token 會靜默跳過，不特別處理

back-end 正在實作中。

## 實作完成
- ✅ `POST /api/v1/users/register` 現在會在同一交易內建立 User + 歡迎禮券（標題「新會員歡迎禮券」、$100、30 天效期），一起 commit；回應格式不變，前端不需要改任何程式碼
- ✅ 註冊完會透過 BackgroundTask 觸發推播，這時候通常還沒有 Push Token 會靜默跳過，只留 NotificationLog，不影響其他流程
- ✅ 「建立優惠券」邏輯已抽成共用的 `build_coupon()` helper（`app/services/coupon_service.py`），admin 發券與歡迎禮券共用；生日禮券到期日算法本質不同（下月最後一天 vs N 天後），維持原樣
- ✅ back-end 已用一次性測試帳號跑過完整流程驗證：200 回應、同一筆交易確實建立了禮券，測試資料已清除
- ✅ 前端 `register.tsx` 的成功提示文案已同步更新
- 文件在後端的 `docs/welcome-coupon.md`
