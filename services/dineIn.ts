// services/dineIn.ts
// 堂食點餐 API，跟 services/shop.ts（網購商店用）刻意分開、不共用。
// 端點路徑已跟 back-end session 確認（2026-09-06，見 plan-dine-in-order.md），部署前呼叫會失敗，
// 屬預期行為，不用等後端就緒才動工前端 UI。
import { api } from './api';
import { DineInOrder, MenuItem } from '../types/dineIn';

export async function fetchMenu(): Promise<MenuItem[]> {
  const res = await api.get('/api/v1/menu-items');
  return res.data;
}

export async function submitDineInOrder(
  tableNumber: string,
  items: { menu_item_id: number; quantity: number }[],
  usePoints?: number
): Promise<DineInOrder> {
  const res = await api.post('/api/v1/dine-in-orders', {
    table_number: tableNumber,
    items,
    ...(usePoints ? { use_points: usePoints } : {}),
  });
  return res.data;
}

export async function fetchMyDineInOrders(): Promise<DineInOrder[]> {
  const res = await api.get('/api/v1/dine-in-orders/me');
  return res.data;
}
