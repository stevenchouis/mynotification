# Backlog：未來要加的功能

尚未排入開發、僅先記錄構想的功能清單。真的要動工時再展開成獨立的 `plan-*.md`（比照 `plan-line-login.md`／`plan-admin-coupon.md` 等既有慣例）並跟 `back-end` session 確認 API 契約。

（原本的「收藏商品到貨/降價通知」構想已於 2026-09-11 完整實作並驗證上線，見 `plan-favorites-notification.md`，故從此清單移除。）

（「後端清除失效的推播 token」已於 2026-11-09 排入開發，見 `plan-push-token-cleanup.md`，故從此清單移除。）

（「首頁開屏活動彈窗」已於 2026-11-09 完成上線，見 `plan-popup-banner.md`，故從此清單移除。）

## 推薦連結：上架 Google Play 時一起做（下載連結＋安裝後自動帶入推薦碼）

- **使用者 2026-11-09 確認：上架前維持手動輸入推薦碼，上架時一起做**（背景見 `plan-referral.md`）
- **現況**：沒裝 App 的人點推薦連結，只會停在後端中繼頁 `GET /api/v1/referrals/landing?code=`，自動跳 `mynotification://` 沒反應；網頁沒有下載連結，裝完 App 要自己回頭手動輸入推薦碼
- **要做的兩件事**：
  1. **下載連結**（back-end，改動小）：中繼頁加「前往 Google Play 下載」按鈕
  2. **安裝後自動帶入推薦碼**（Android，延遲深度連結 deferred deep link）：商店連結帶 `&referrer=ref%3DXXXXXX`，App 第一次打開時用 Google Play Install Referrer API 讀出推薦碼、帶進註冊頁。需要原生套件（例如 `react-native-play-install-referrer`），要重新 `eas build`；只有從 Google Play 正式安裝才讀得到，開發版／側載測不到
- **iOS**：沒有同等可靠的做法（剪貼簿方案體驗差、iOS 會跳貼上提示），先維持手動輸入
- **負責方**：back-end（中繼頁）、mynotification（Install Referrer）
