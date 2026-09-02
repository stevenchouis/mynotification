# Plan: 管理者手動發放優惠券 API（後端功能，前端無 UI）

## Goal
目前優惠券唯一的產生管道是每月 25 日的生日禮券 CronJob，完全沒有人工發放的方式。使用者要求補上一支給管理者用的 API，可以在活動加碼、客訴補償等情境手動對特定使用者發一張優惠券。**這次不做前端管理介面**，使用者說明會直接用 Postman 呼叫，前端這邊只需要協調 API 契約、記錄決策。

## 已規劃、待 back-end 回覆確認的設計

### API 契約提案
```
POST /api/v1/coupons/admin/issue
Headers: X-Admin-Key: <ADMIN_API_KEY>
Body: {
  "user_email": "user@example.com",
  "title": "客訴補償券",
  "discount_amount": 200,
  "valid_days": 30
}
Response: { "id", "title", "discount_amount", "expired_at", "is_used" }
```

### 認證方式：建議用固定的 Admin API Key（不是建 admin 角色/RBAC）
- 用一組存在後端環境變數的密鑰（例如 `ADMIN_API_KEY`），呼叫時帶在 `X-Admin-Key` header，後端比對相符才放行
- 理由：這個專案目前完全沒有「管理者身分」的概念（users 表沒有 role/is_admin），要做一個真正的管理者角色系統（登入、權限、JWT 帶 role claim）對目前規模是過度設計；用一組密鑰保護一支低風險端點（濫用後果頂多是被發免費優惠券，不是資料外洩）是務實的做法
- 這組密鑰不能寫死在程式碼裡、不能 commit 進 repo，只能放在後端的 `.env`，且不應該出現在對外公開的 Swagger/OpenAPI 文件裡（或至少該端點在文件上要標注清楚是內部用）

### 是否同時發通知：建議「是」，跟生日禮券的行為一致
- 使用者問「Notification 也會同時發出嗎」——建議發放優惠券的同時，比照現有生日禮券的邏輯，一併寫一筆 NotificationLog（`data` 帶 `coupon_id`，讓前端點通知能深連結跳轉到優惠券詳情頁），並觸發實際的 Expo 推播
- 需要 back-end 確認：現有生日禮券流程建立 NotificationLog 之後，是否真的會觸發一次 Expo 推播（不只是寫進 DB 讓使用者下次打開 App 才看到），如果會，麻煩這支新 API 直接複用同一段發送邏輯

### 請求欄位的設計考量
- 用 `user_email` 而不是 `user_id`：Postman 手動觸發時，用 Email 比記使用者的資料庫 ID 直覺好用
- `valid_days`（例如 30）而不是直接傳 `expired_at`：呼叫者不用自己算日期，後端用 `now() + valid_days` 計算到期日；如果 back-end 覺得直接傳 `expired_at` 更彈性也可以，這點請 back-end 決定即可
- `title` 兼作發放原因/備註用途（例如「客訴補償 - 訂單#123」），沿用現有 `Coupon.title` 欄位，不需要新增備註欄位

## Scope
### 前端
- 這次**不需要修改任何前端程式碼**，純粹是後端新增一支端點
- 若未來要在 App 裡加一個管理者操作介面，屬於另一個獨立功能，需要屆時重新規劃（含要不要做真正的管理者登入角色）

### 後端（由 back-end session 負責）
- 新增 `POST /api/v1/coupons/admin/issue`
- 新增 `ADMIN_API_KEY` 環境變數與驗證中介層
- 複用（或抽出共用函式）生日禮券流程裡「建立 Coupon + 寫 NotificationLog + 觸發推播」的邏輯，避免兩處邏輯分岔
- 記得套用先前補上的冪等性防呆邏輯是否適用於這支 API（例如同一個使用者短時間內被重複呼叫兩次會不會發兩張——這支是「手動觸發」，理論上不需要跟生日禮券共用同一套「當月只發一次」的防重複規則，但仍需要基本的輸入驗證：例如 `discount_amount` 不可為負數、`user_email` 對應的使用者必須存在）

## back-end 已確認的設計
- 認證：同意 Admin API Key，會加 constant-time 比對防 timing attack、`include_in_schema=False` 排除在公開 Swagger 外、`ADMIN_API_KEY` 強制從 `.env` 讀取不給預設值。密鑰由 back-end 自己產生高強度亂數字串，不需要使用者去外部服務申請
- 用 `valid_days`（int，預設 30），後端計算到期日
- `discount_amount` 用 Pydantic `Field(gt=0)` 擋 0/負數，回 422；`user_email` 找不到對應使用者回 404

## ⚠️ back-end 發現的既有不一致（非這次新增問題，順帶請教使用者）
- **生日禮券目前完全沒有觸發真實推播**：`scheduler_service.py` 是直接手動 `db.add(NotificationLog(...))`，只會寫進 App 內收件匣，**不會**呼叫 `push_service.send_user_push_notifications`，所以手機不會跳出系統推播通知
- 這支新的 admin 發券 API 會採用「正確」的做法（呼叫 `send_user_push_notifications`，會自動寫 DB log + 觸發真推播），所以會出現：**管理者手動發券手機會真的跳通知，但生日禮券不會**，兩者行為不一致
- back-end 詢問：要不要順便把生日禮券也改成呼叫同一個 `send_user_push_notifications`？這是題外話，不影響 admin API 這次的實作，back-end 會先做完 admin 發券 API 再等使用者回覆這題
- ✅ **使用者已確認要修，back-end 已完成**：生日禮券現在改呼叫 `send_user_push_notifications`（跟 admin 發券 API 同一個函式），會真的觸發手機推播。實作上是「資料庫交易 commit 完成後，才對本次實際發券成功的使用者逐一觸發推播」，推播失敗不影響已成功寫入的優惠券，也不會因單一使用者推播失敗擋住其他人。原本手動寫 `NotificationLog` 的程式碼已移除（`send_user_push_notifications` 會自動處理）。不影響 API/DB schema，不需要 migration。⚠️ 這個 CronJob 要等下個月 25 日才會實際觸發，沒辦法立即端到端測試，但邏輯跟已驗證過的 admin 發券路徑共用，風險低

## 實作完成
- ✅ `POST /api/v1/coupons/admin/issue` 已上線，不會出現在 `/docs` Swagger 文件裡，`X-Admin-Key` header 保護
- ✅ 請求格式：`{ "user_email", "title", "discount_amount"(>0), "valid_days"(選填，預設 30，>0) }`，回應完整 Coupon 物件
- ✅ 錯誤處理：401（Key 錯誤）、404（email 查無使用者）、422（參數不合法），已用 curl 驗證這幾條錯誤路徑
- ✅ **使用者已用 Postman 實測完整成功路徑**：Android Dev Build 已完成 FCM V1 推播憑證設定（`google-services.json` 接進 `app.json` → Firebase 服務帳戶金鑰上傳並指派給 EAS 的 Push Notifications (FCM V1) 用途 → 重新建置 Dev Build），呼叫 API 後手機**確實收到系統推播通知**，端到端全部驗證通過
- `ADMIN_API_KEY` 已設進後端 `.env`，back-end 已告知使用者
- 文件在後端的 `docs/admin-coupon-issue.md`

## Android 推播（FCM V1）設定記錄
這次順便解決了先前「Token 同步失敗」的問題（`FirebaseApp is not initialized`），完整走過的設定步驟：
1. Firebase Console 建立 Android App（package name `com.stevenchouis.mynotification`），下載 `google-services.json` 放進專案根目錄
2. `app.json` 的 `android.googleServicesFile` 指向該檔案
3. Firebase Console →「專案設定」→「服務帳戶」產生服務帳戶私密金鑰 JSON
4. `eas credentials` → Android → **Google Service Account** → Upload 該金鑰 → 再進 **Manage...for Push Notifications (FCM V1)** → **Select an existing** 指派剛上傳的金鑰給推播用途（Upload 跟指派用途是兩個分開的步驟）
5. `eas build --profile development --platform android` 重新建置（新增原生設定必須重建）
6. 安裝到手機、`npx expo start --dev-client` 重啟 dev server

現在生日禮券、admin 發券、（未來排程觸發的）各種推播都能正常送達手機了。
