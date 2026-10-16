# Backlog：未來要加的功能

尚未排入開發、僅先記錄構想的功能清單。真的要動工時再展開成獨立的 `plan-*.md`（比照 `plan-line-login.md`／`plan-admin-coupon.md` 等既有慣例）並跟 `back-end` session 確認 API 契約。

（原本的「收藏商品到貨/降價通知」構想已於 2026-09-11 完整實作並驗證上線，見 `plan-favorites-notification.md`，故從此清單移除。）

## 後端清除失效的推播 token（讀 Expo push receipt）

- **負責方**：`back-end`（mynotification 前端預期不用改）
- **現況（2026-10-16 發現）**：後端發推播只看 Expo 回的 push **ticket**（`status=ok` 只代表 Expo 收下了，不代表裝置收得到），沒有回頭讀 push **receipt**，所以重灌 App、換手機、移除 App 留下的舊 token 永遠不會被清掉。實例：`stevenchouis@hotmail.com` 帳號累積了 4 個 token（其中 2 個是 2026-09 的舊 token），每則推播都會發 4 份
- **影響**：浪費 Expo 發送額度；舊 Dev Build／舊裝置可能還收到通知，測試時難以判斷是哪一台收到；token 數量只增不減
- **構想**：發送後保留 ticket id，延遲一段時間（Expo 建議約 15 分鐘後、24 小時內）呼叫 Expo 的 receipt API（`getPushNotificationReceiptsAsync`／`POST https://exp.host/--/api/v2/push/getReceipts`），receipt 回 `DeviceNotRegistered` 時刪除該筆 `PushToken`；ticket 階段就回 `DeviceNotRegistered` 的也直接刪
- **待跟 `back-end` 討論**：延遲查 receipt 怎麼排程（Render 上沒有常駐 worker，可能要用既有排程機制或下次發送時順便查）、ticket id 存哪裡、其他錯誤（`MessageTooBig`／`InvalidCredentials`）要不要記 log 告警

