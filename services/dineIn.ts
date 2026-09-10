// services/dineIn.ts
// 堂食點餐 API，跟 services/shop.ts（網購商店用）刻意分開、不共用。
// 端點路徑已跟 back-end session 確認（2026-09-06，見 plan-dine-in-order.md），部署前呼叫會失敗，
// 屬預期行為，不用等後端就緒才動工前端 UI。
// fetchRestaurants／fetchRestaurantTables 是 2026-09-10 多門市功能新增（見 CLAUDE.md）。
import { api } from './api';
import { DineInOrder, DineInTable, MenuItem, Restaurant } from '../types/dineIn';

// 公開端點，不需要登入，給顧客「選餐廳」這一步用
export async function fetchRestaurants(): Promise<Restaurant[]> {
  const res = await api.get('/api/v1/restaurants');
  return res.data;
}

// 公開端點，不需要登入，給顧客「選桌號」這一步用；回傳的桌位不帶佔用狀態
// （已跟使用者確認：這是既有 QR Code 掃碼流程的防呆備援，不是「找空桌」情境，見跨 session 討論）
export async function fetchRestaurantTables(restaurantId: number): Promise<DineInTable[]> {
  const res = await api.get(`/api/v1/restaurants/${restaurantId}/tables`);
  return res.data;
}

// 菜單是每間門市各自獨立（2026-09-10 跟使用者確認），帶 restaurantId 時依門市篩選，
// 不帶則維持後端舊行為（回全部）——僅在還沒有門市可篩選的過渡狀態使用
export async function fetchMenu(restaurantId?: number): Promise<MenuItem[]> {
  const res = await api.get('/api/v1/menu-items', {
    params: restaurantId ? { restaurant_id: restaurantId } : undefined,
  });
  return res.data;
}

export async function submitDineInOrder(
  tableId: number,
  items: { menu_item_id: number; quantity: number }[],
  usePoints?: number
): Promise<DineInOrder> {
  const res = await api.post('/api/v1/dine-in-orders', {
    table_id: tableId,
    items,
    ...(usePoints ? { use_points: usePoints } : {}),
  });
  return res.data;
}

export async function fetchMyDineInOrders(): Promise<DineInOrder[]> {
  const res = await api.get('/api/v1/dine-in-orders/me');
  return res.data;
}
