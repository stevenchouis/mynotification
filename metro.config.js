// metro.config.js
// Sentry（見 plan-error-monitoring.md）：用 Sentry 包過的 Expo Metro 設定，打包時產生 debug ID，
// 讓 Sentry 能把正式版壓縮過的程式碼還原成原始檔名與行號。其他行為跟 Expo 預設一樣。
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;
