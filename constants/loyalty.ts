// constants/loyalty.ts
// 紅利點數比例常數，跟 back-end 已定案、寫死在雙邊程式碼裡（非後台可調設定），之後調整
// 就是改這裡的數字。前端只用這些常數做「即時試算」顯示，事實來源仍在後端（見 plan-loyalty-points.md）。
export const POINTS_TO_CURRENCY_RATE = 1; // 1 點折抵 NT$1
export const MAX_REDEEM_RATIO = 0.5; // 單筆訂單最高折抵訂單金額 50%
