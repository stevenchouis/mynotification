// types/loyalty.ts
// 紅利點數型別，跟 types/shop.ts／types/dineIn.ts 刻意分開，不共用既有 interface。
// 欄位對齊已跟 back-end session 確認的 LoyaltyTransaction 設計（見 plan-loyalty-points.md）。
// exchange：點數兌換優惠券（2026-11-07，見 plan-points-exchange.md），固定負向
// check_in：每日簽到（2026-11-08，見 plan-daily-check-in.md），固定正向，跟 earn 一樣有 expires_at
export type LoyaltyTransactionType =
  'earn' | 'redeem' | 'expire' | 'reverse_earn' | 'reverse_redeem' | 'exchange' | 'check_in';

// 交易類型顯示文字，比照 types/shop.ts 的 ORDER_STATUS_LABEL 寫法
export const LOYALTY_TX_TYPE_LABEL: Record<LoyaltyTransactionType, string> = {
  earn: '賺取',
  redeem: '折抵',
  expire: '過期',
  reverse_earn: '收回',
  reverse_redeem: '退還',
  exchange: '兌換',
  check_in: '簽到',
};

export interface LoyaltyTransaction {
  id: number;
  type: LoyaltyTransactionType;
  amount: number;
  reason: string;
  related_order_id: number | null;
  related_dine_in_order_id: number | null;
  // 門市收銀交易（見 plan-member-code-checkout.md），back-end 已於 2026-09-16 加上
  // （commit d2a8dc2），跟 related_order_id/related_dine_in_order_id 對稱
  related_store_checkout_id: number | null;
  // 點數兌換優惠券（見 plan-points-exchange.md），只有 type === 'exchange' 才有值
  related_coupon_id?: number | null;
  created_at: string;
  expires_at: string | null; // 只有 type === 'earn'／'check_in' 才有值
  // 2026-09-11 多門市功能新增，純記錄/報表用途——餘額仍是統一帳戶層級，不影響能不能折抵
  // （見 CLAUDE.md「多門市」章節），堂食交易由後端從訂單的 table_id 反查門市自動帶入
  restaurant_id?: number | null;
}

// POST /api/v1/loyalty/member-code 的回應，比照 RedeemCodeResponse（types/index.ts）的
// 6 碼數字/10 分鐘效期/單次使用設計，見 plan-member-code-checkout.md
export interface MemberCodeResponse {
  code: string;
  expires_at: string;
}

// GET /api/v1/loyalty/me 的完整回應。會員等級欄位是 2026-11-07 新增（見 plan-member-tier.md），
// 舊後端只回 balance，所以等級欄位都是可選的，畫面上沒有 tier 就不顯示等級區塊
export interface LoyaltyMe {
  balance: number;
  tier?: string;
  year_spend?: number;
  next_tier?: string | null;
  amount_to_next_tier?: number | null;
  tier_expires_at?: string | null;
  earn_multiplier?: number;
}

// 點數兌換優惠券（2026-11-07，見 plan-points-exchange.md）。兌換目錄寫死在後端，前端只顯示後端回傳的內容
export interface ExchangeOption {
  id: string; // 例如 'coupon_100'
  title: string;
  points_cost: number;
  discount_amount: number;
  valid_days: number;
}

// GET /api/v1/loyalty/exchange-options 的回應；每月上限以台灣時間自然月計算，三種品項合計
export interface ExchangeOptionsResponse {
  options: ExchangeOption[];
  monthly_limit: number;
  used_this_month: number;
}

// 每日簽到（2026-11-08，見 plan-daily-check-in.md）。獎勵數字寫死在後端，前端顯示用 rewards
// GET /api/v1/check-in/status 的回應
export interface CheckInStatus {
  checked_in_today: boolean;
  streak: number; // 目前連續天數（今天已簽含今天）
  cycle_day: number; // 1～7：已簽＝今天是第幾天；未簽＝今天簽的話是第幾天
  today_reward: number;
  rewards: number[]; // 一輪 7 天各天的點數，例如 [1,1,1,1,1,1,5]
}

// POST /api/v1/check-in 的成功回應
export interface CheckInResult {
  points_awarded: number;
  streak: number;
  cycle_day: number;
  balance: number;
}
