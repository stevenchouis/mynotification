// services/storeCheckouts.ts
// 門市收銀 API，跟 services/shop.ts／services/dineIn.ts 刻意分開，不共用。
// 店員視角的查詢/送出結帳在 staff-scanner 那邊，mynotification 這裡只需要顧客回頭查自己的
// 消費紀錄（給 app/points.tsx 顯示 related_store_checkout_id 對應的金額用）。
import { api } from './api';
import { StoreCheckout } from '../types/storeCheckout';

export async function fetchMyStoreCheckouts(): Promise<StoreCheckout[]> {
  const res = await api.get('/api/v1/store-checkouts/me');
  return res.data;
}
