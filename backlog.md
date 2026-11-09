# Backlog：未來要加的功能

尚未排入開發、僅先記錄構想的功能清單。真的要動工時再展開成獨立的 `plan-*.md`（比照 `plan-line-login.md`／`plan-admin-coupon.md` 等既有慣例）並跟 `back-end` session 確認 API 契約。

（原本的「收藏商品到貨/降價通知」構想已於 2026-09-11 完整實作並驗證上線，見 `plan-favorites-notification.md`，故從此清單移除。）

## 後端清除失效的推播 token（讀 Expo push receipt）

- **負責方**：`back-end`（mynotification 前端預期不用改）
- **現況（2026-10-16 發現）**：後端發推播只看 Expo 回的 push **ticket**（`status=ok` 只代表 Expo 收下了，不代表裝置收得到），沒有回頭讀 push **receipt**，所以重灌 App、換手機、移除 App 留下的舊 token 永遠不會被清掉。實例：`stevenchouis@hotmail.com` 帳號累積了 4 個 token（其中 2 個是 2026-09 的舊 token），每則推播都會發 4 份
- **影響**：浪費 Expo 發送額度；舊 Dev Build／舊裝置可能還收到通知，測試時難以判斷是哪一台收到；token 數量只增不減
- **構想**：發送後保留 ticket id，延遲一段時間（Expo 建議約 15 分鐘後、24 小時內）呼叫 Expo 的 receipt API（`getPushNotificationReceiptsAsync`／`POST https://exp.host/--/api/v2/push/getReceipts`），receipt 回 `DeviceNotRegistered` 時刪除該筆 `PushToken`；ticket 階段就回 `DeviceNotRegistered` 的也直接刪
- **待跟 `back-end` 討論**：延遲查 receipt 怎麼排程（Render 上沒有常駐 worker，可能要用既有排程機制或下次發送時順便查）、ticket id 存哪裡、其他錯誤（`MessageTooBig`／`InvalidCredentials`）要不要記 log 告警


## 首頁開屏活動彈窗（蓋版廣告／Popup Banner）

- **使用者 2026-11-09 提出**，參考 HAPPY GO App：打開 App 進首頁時，畫面中央跳出一張大圖活動彈窗（可左右滑的多張輪播＋下方小圓點），背景變暗，下方有「今日不再顯示」勾選框和關閉 ✕ 按鈕；點圖片可以進到活動頁
- **業界叫法**：開屏彈窗、蓋版廣告、首頁活動彈窗（Interstitial／Popup Banner）。跟現有的大輪播、小輪播不同，是「蓋在首頁上面、要使用者主動關掉」的強打版位，適合年度大活動、抽獎、重大公告
- **構想**：
  - 後端：比照 `hero-banners` 再開一組活動彈窗資料（圖片、點擊導頁路徑、開始／結束時間、排序、是否啟用），公開 `GET` 只回目前生效的；`staff-scanner` 後台管理（選圖上傳沿用 Supabase `promotions` bucket）
  - 前端：首頁掛一個全螢幕 `Modal`（深色半透明背景＋置中輪播），點圖片用 `link_route` 導頁（沿用 `constants/heroBannerRoutes.ts` 白名單）；「今日不再顯示」把台灣時間的日期存在裝置本機（SecureStore），當天不再跳；沒有生效中的活動就不顯示
- **待決定**：每次開 App 都跳還是一天一次？勾了「今日不再顯示」是全部彈窗都不跳還是只限那一張？要不要跟 Welcome 畫面、取餐叫號彈窗錯開，避免同時跳兩個？
- **負責方**：三方（back-end 資料與 API、staff-scanner 後台、mynotification 顯示）

## 推薦連結：上架 Google Play 時一起做（下載連結＋安裝後自動帶入推薦碼）

- **使用者 2026-11-09 確認：上架前維持手動輸入推薦碼，上架時一起做**（背景見 `plan-referral.md`）
- **現況**：沒裝 App 的人點推薦連結，只會停在後端中繼頁 `GET /api/v1/referrals/landing?code=`，自動跳 `mynotification://` 沒反應；網頁沒有下載連結，裝完 App 要自己回頭手動輸入推薦碼
- **要做的兩件事**：
  1. **下載連結**（back-end，改動小）：中繼頁加「前往 Google Play 下載」按鈕
  2. **安裝後自動帶入推薦碼**（Android，延遲深度連結 deferred deep link）：商店連結帶 `&referrer=ref%3DXXXXXX`，App 第一次打開時用 Google Play Install Referrer API 讀出推薦碼、帶進註冊頁。需要原生套件（例如 `react-native-play-install-referrer`），要重新 `eas build`；只有從 Google Play 正式安裝才讀得到，開發版／側載測不到
- **iOS**：沒有同等可靠的做法（剪貼簿方案體驗差、iOS 會跳貼上提示），先維持手動輸入
- **負責方**：back-end（中繼頁）、mynotification（Install Referrer）
