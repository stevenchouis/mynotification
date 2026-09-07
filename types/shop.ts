// types/shop.ts
// 自家後端商店的型別，跟 services/products.ts（DummyJSON 展示頁用）刻意分開，不共用。
export interface ShopProduct {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  thumbnail: string;
  images: string[];
}

export interface OrderItem {
  product_id: number;
  title: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

// 訂單狀態顯示文字，(tabs)/coupons.tsx 的「我的訂單」區段跟 order/[id].tsx 訂單詳情頁共用
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '處理中',
  paid: '已付款',
  failed: '付款失敗',
  cancelled: '已取消',
};

export interface Order {
  id: number;
  status: OrderStatus;
  total_amount: number;
  payment_provider: string;
  merchant_trade_no: string;
  created_at: string;
  paid_at: string | null;
  items: OrderItem[];
  points_earned: number;
  points_used: number;
}
