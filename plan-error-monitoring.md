# Plan：錯誤監控（Sentry）

## 目標

App 或後端出錯時自動回報到 Sentry 並寄信通知，不用等使用者回報、也不用接 USB 讀紀錄。起因：2026-11-09 首頁 FlashList 無限重新渲染整頁壞掉、後端 APScheduler 排程在正式環境從沒成功過卻沒人發現。

### 使用者 2026-11-09 定案的決策

| 題目 | 決定 |
|---|---|
| 服務 | **App 和後端都用 Sentry**（原本考慮 EAS Observe，但它要 Expo SDK 55+，我們是 SDK 54；而且官方說明 Observe 沒有閃退回報，主要是效能指標） |
| 範圍 | 只開 **Error monitoring**，不開 Session replay（牽涉個資）、Tracing／Profiling（免費額度有限） |
| 通知 | High priority issues（新錯誤、復發、暴增）寄 Email |

## 設定

- Sentry 組織 `kc-1n`（`kc-1n.sentry.io`，美國區），專案 `mynotification`（React Native）、`fastapi-pj`（FastAPI）；staff-scanner 之後可用同一組織再建專案
- **App**：`@sentry/react-native` ~7.2.0；`app.json` plugin `@sentry/react-native/expo`（org `kc-1n`、project `mynotification`）；`metro.config.js` 用 `getSentryExpoConfig`；`app/_layout.tsx` 的 `Sentry.init`（DSN 讀 `EXPO_PUBLIC_SENTRY_DSN`、`sendDefaultPii: false`、`tracesSampleRate: 0`、environment 依 `__DEV__`）並 `export default Sentry.wrap(RootLayout)`
- **環境變數**：`EXPO_PUBLIC_SENTRY_DSN` 在本機 `.env` 與 EAS（development／preview／production，plaintext）；`SENTRY_AUTH_TOKEN`（Organization Token `eas-build`）只在 EAS preview／production（secret），雲端打包時上傳 source map；`eas.json` 的 development profile 設 `SENTRY_DISABLE_AUTO_UPLOAD=true`（開發版 JS 來自 Metro，不需要上傳，也不用金鑰）
- **原生模組**：裝了之後 Dev Build 要重新 `eas build`（2026-11-09 已重 build：d626712a）
- **後端**（back-end `13cb74a`）：`sentry-sdk[fastapi]`，Render 環境變數 `SENTRY_DSN`（沒設不啟用）；回報 API 5xx、排程例外（含被 try/except 吞掉的）、推播與寄信異常；不送 body／cookie／query string／Authorization／admin key，user 只帶 id，文字再遮 Email 與 token。測試端點 `POST /api/v1/monitoring/test-error`（`?source=scheduler`），需 `X-Admin-Key`

## 驗證（2026-11-09）
- [x] 後端：使用者用 Postman 打測試端點，Sentry fastapi-pj 收到 API 與排程兩筆
- [x] App：臨時按鈕 `Sentry.captureException` → Sentry mynotification 收到、標出檔案位置、使用者收到 Email（按鈕已移除）
- [ ] Preview／正式版 build 的 source map 上傳：`SENTRY_AUTH_TOKEN` 已於 2026-11-09 存進 EAS preview／production（secret），下次打包 Preview 時確認 build 成功、Sentry 的錯誤顯示原始檔名行號

## 之後可以做
- staff-scanner 也接 Sentry
- 使用者回報問題時，Sentry 事件帶 user id 方便對照
