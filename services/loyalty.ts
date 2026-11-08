// services/loyalty.ts
// 紅利點數 API，跟 services/shop.ts／services/dineIn.ts 刻意分開、不共用。
import { api } from './api';
import { Coupon } from '../types';
import { ExchangeOptionsResponse, LoyaltyMe, LoyaltyTransaction, MemberCodeResponse } from '../types/loyalty';

export async function fetchLoyaltyBalance(): Promise<number> {
  const res = await api.get('/api/v1/loyalty/me');
  return res.data.balance;
}

// 完整的 /loyalty/me（含會員等級，見 plan-member-tier.md）。queryKey 請用 LOYALTY_ME_QUERY_KEY：
// 它的開頭是 'loyalty-balance'，既有程式裡所有 invalidateQueries(['loyalty-balance']) 會一併刷新等級，
// 不用每個地方都補一行；fetchLoyaltyBalance 維持只回數字，既有畫面不用改
export const LOYALTY_ME_QUERY_KEY = ['loyalty-balance', 'me'] as const;

export async function fetchLoyaltyMe(): Promise<LoyaltyMe> {
  const res = await api.get('/api/v1/loyalty/me');
  return res.data;
}

export async function fetchLoyaltyTransactions(): Promise<LoyaltyTransaction[]> {
  const res = await api.get('/api/v1/loyalty/transactions');
  return res.data;
}

// 產生限時會員碼供店員掃描辨識身份，比照 POST /coupons/{id}/redeem-code（見 app/coupon/[id].tsx）
export async function generateMemberCode(): Promise<MemberCodeResponse> {
  const res = await api.post('/api/v1/loyalty/member-code');
  return res.data;
}

// 點數兌換優惠券（見 plan-points-exchange.md）
export const EXCHANGE_OPTIONS_QUERY_KEY = ['loyalty-exchange-options'] as const;

export async function fetchExchangeOptions(): Promise<ExchangeOptionsResponse> {
  const res = await api.get('/api/v1/loyalty/exchange-options');
  return res.data;
}

// 扣點、寫明細、建券由後端在同一個 transaction 完成；點數不足回 409 insufficient_points，
// 本月已達上限回 409 exchange_limit_reached（detail 是帶 error_code 的物件）
export async function exchangePoints(optionId: string): Promise<{ coupon: Coupon; balance: number }> {
  const res = await api.post('/api/v1/loyalty/exchange', { option_id: optionId });
  return res.data;
}
