// services/coupons.ts
// 之前 (drawer)/(tabs)/coupons.tsx 直接內嵌呼叫 api.get('/api/v1/coupons/me')，
// 2026-09-15 隨「優惠券可折抵網購/堂食訂單」抽出成共用函式，讓 cart.tsx／dine-in/cart.tsx
// 的優惠券選擇 UI 可以用同一個 ['myCoupons'] query key（TanStack Query 自動去重複快取）。
import { api } from './api';
import { Coupon } from '../types';

export async function fetchMyCoupons(): Promise<Coupon[]> {
  const res = await api.get('/api/v1/coupons/me');
  return res.data;
}
