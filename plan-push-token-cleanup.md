# Plan：清除失效的推播 token＋登出解除推播

## 目標

後端每則推播都會發給該帳號所有登記過的 Expo Push Token，但從來不清：重裝 App、換手機、移除 App 留下的舊 token 永遠留著（`stevenchouis@hotmail.com` 曾累積 4 個），浪費發送額度、測試時也分不清是哪台收到。另外**登出後手機還是會收到原帳號的推播**，同一支手機換人登入甚至會收到前一位使用者的推播。

完成的定義：失效的 token 會自動被刪掉；90 天沒出現的 token 也會被清掉；登出後這支手機不再收到該帳號的推播；同一支手機換帳號登入，推播只送給目前登入的人。

背景見 `backlog.md`「後端清除失效的推播 token」（2026-10-16 發現）。

### 使用者 2026-11-09 定案的決策

| 題目 | 決定 |
|---|---|
| 判斷失效 | **讀 Expo 回執（receipt）＋ 90 天沒出現就清** |
| 登出 | **登出就解除這支手機的推播**（顧客 App、店員 App 都做） |

## 規則（提案）

- **Ticket 階段**：發送當下 Expo 就回 `DeviceNotRegistered` → 直接刪除該 token
- **Receipt 階段**：保留 ticket id，約 15 分鐘後、24 小時內向 Expo 查回執；回 `DeviceNotRegistered` → 刪除。查詢時機由 back-end 決定（Render 沒有常駐 worker，可用既有排程或下次發送時順便查）
- **最後出現時間**：App 每次打開都會重新登記 token（既有行為），後端記 `last_seen_at`；超過 **90 天**沒出現的刪除
- **一個 token 只屬於一個人**：同一個 token 被另一個帳號登記時，從舊帳號移到新帳號（換人登入只推給目前的人）
- **登出解除**：登出時 App 呼叫解除端點，刪除這支手機在這個帳號下的 token；如果登出原因是通行證和續期證都失效（呼叫會 401），就略過，靠「換人登入時移轉」和 90 天清除補上
- `MessageTooBig`、`InvalidCredentials` 等其他錯誤只記 log，不刪 token

## API 契約（back-end 2026-11-09 照提案實作，`14507b9`）

- 既有 `POST /api/v1/users/push-tokens`：行為改成「同一個 token 已存在就更新擁有者與 `last_seen_at`」（不重複建立），回應不變
- 新增 `POST /api/v1/users/push-tokens/unregister`（需登入），body `{ "token": "ExponentPushToken[...]" }` → `204`；只刪屬於目前使用者的那一筆，找不到也回 `204`

## Scope

### May modify（mynotification）
- `services/authFlow.ts`、`app/(drawer)/(tabs)/_layout.tsx` — 登記 token 成功後，把 token 存進 SecureStore（`expoPushToken`），登出時才知道要解除哪一個
- `store/useAuthStore.ts` — `logout()` 先呼叫解除端點（帶目前的通行證，不等結果、失敗照常登出），再作廢續期證、清本機
- `CLAUDE.md`、`backlog.md`（移除這一項）

### Must not modify
- 推播收到後的處理（前景、點擊導頁）

### 分工
- **back-end**：`last_seen_at`、token 唯一與移轉、ticket／receipt 清除、90 天清除、解除端點
- **staff-scanner**：登出時一樣呼叫解除端點（它登記 token 時帶 `app_id="staff-scanner"`）

## 驗證
1. **登出解除**：手機登入 A 帳號 → 登出 → 用 staff-scanner 對 A 觸發推播（例如叫號）→ 這支手機**收不到**
2. **換人登入**：同一支手機登出 A、登入 B → 對 A 觸發推播收不到、對 B 觸發收得到
3. **失效清除**（back-end 驗證）：用假的或已移除 App 的 token 發送 → token 被刪；`last_seen_at` 超過 90 天的被刪
- `stevenchouis@hotmail.com` 的舊 token 數量在清除後減少（back-end 回報）

## 完成條件
- [x] back-end 部署（`14507b9`，migration `877197b3840b`；receipt 排程在正式環境因 asyncpg「Future attached to a different loop」從沒成功過，`4282795` 改用排程專用 NullPool DB 工廠修好；同樣問題的生日禮券／點數到期收回／到期提醒三支既有排程，使用者決定一起修）
- [x] staff-scanner 完成（`1cc4905`；閒置後登出通行證過期時先換證再解除，mynotification 同做法）
- [x] mynotification 完成，驗證 1 實機通過（2026-11-09：登出後店員叫號收不到、登入回來兩則測試推播都收到）；測試推播確認 id 1 的 3 個舊 mynotification token 是 DeviceNotRegistered
- [x] CLAUDE.md、backlog.md 更新

## 風險與還原
- 風險：誤刪還有效的 token，使用者收不到推播。處理：只在 Expo 明確回 `DeviceNotRegistered` 時刪；90 天清除只看 `last_seen_at`，App 每次打開都會更新
- 還原：前端拿掉解除呼叫即可；後端清除邏輯可單獨關掉
