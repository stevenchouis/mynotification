// services/loyalty.ts
// 紅利點數 API，跟 services/shop.ts／services/dineIn.ts 刻意分開、不共用。
import { api } from './api';
import { LoyaltyTransaction, MemberCodeResponse } from '../types/loyalty';

export async function fetchLoyaltyBalance(): Promise<number> {
  const res = await api.get('/api/v1/loyalty/me');
  return res.data.balance;
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
