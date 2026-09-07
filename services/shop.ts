// services/shop.ts
// 自家後端商店 API，跟 services/products.ts（DummyJSON 展示頁用）刻意分開、不共用。
// 商品清單一次抓全部（目前 194 筆，資料量小），分類/搜尋都在前端本機過濾，見 shop.tsx。
import { api } from './api';
import { Order, ShopProduct } from '../types/shop';

export async function fetchShopProducts(): Promise<ShopProduct[]> {
  const res = await api.get('/api/v1/products');
  return res.data;
}

export async function fetchShopProductById(id: number): Promise<ShopProduct> {
  const res = await api.get(`/api/v1/products/${id}`);
  return res.data;
}

export async function createOrder(items: { product_id: number; quantity: number }[]): Promise<Order> {
  const res = await api.post('/api/v1/orders', { items });
  return res.data;
}

export async function fetchMyOrders(): Promise<Order[]> {
  const res = await api.get('/api/v1/orders/me');
  return res.data;
}

// 收藏（願望清單），DB 權威、跟裝置無關。加/取消收藏都是 idempotent，後端重複呼叫不會報錯，
// 前端不用先查有沒有收藏過。
export async function fetchFavoriteProducts(): Promise<ShopProduct[]> {
  const res = await api.get('/api/v1/favorites/me');
  return res.data;
}

export async function addFavorite(productId: number): Promise<void> {
  await api.post('/api/v1/favorites', { product_id: productId });
}

export async function removeFavorite(productId: number): Promise<void> {
  await api.delete(`/api/v1/favorites/${productId}`);
}
