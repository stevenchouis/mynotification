// types/einvoice.ts
// 電子發票載具（財政部手機條碼，2026-11-09，見 plan-einvoice-carrier.md）。
// 格式：「/」加 7 碼，每碼 0-9、A-Z、.、+、-。前端只做格式檢查，事實來源是後端（同一條規則）。
export const EINVOICE_CARRIER_PATTERN = /^\/[0-9A-Z.+-]{7}$/;

// 輸入時自動轉大寫、去空白（後端也會再 normalize 一次）
export const normalizeEinvoiceCarrier = (value: string) => value.replace(/\s/g, '').toUpperCase();
