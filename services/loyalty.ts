// services/loyalty.ts
// 紅利點數 API，跟 services/shop.ts／services/dineIn.ts 刻意分開、不共用。
import { api } from './api';
import { LoyaltyTransaction } from '../types/loyalty';

export async function fetchLoyaltyBalance(): Promise<number> {
  const res = await api.get('/api/v1/loyalty/me');
  return res.data.balance;
}

export async function fetchLoyaltyTransactions(): Promise<LoyaltyTransaction[]> {
  const res = await api.get('/api/v1/loyalty/transactions');
  return res.data;
}
