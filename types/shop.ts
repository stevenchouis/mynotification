// types/shop.ts
// 自家後端商店的型別，跟 services/products.ts（DummyJSON 展示頁用）刻意分開，不共用。
export interface ShopProduct {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  stock: number;
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

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'failed' | 'cancelled';

// 訂單狀態顯示文字，(tabs)/coupons.tsx 的「我的訂單」區段跟 order/[id].tsx 訂單詳情頁共用。
// 'shipped'：後端 PATCH /orders/{id}/status（店員 App staff-scanner 專用）標記出貨後的狀態，
// 前端不會呼叫這支端點，只需要能正確顯示這個狀態即可
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '處理中',
  paid: '已付款',
  shipped: '已出貨',
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

// ECPay AioCheckOut 的表單資料：action_url 是綠界的收銀台網址，fields 是連同
// CheckMacValue 簽章在內、要用 POST 送出的所有 hidden input 欄位（後端組好、前端不用自己算簽章）
export interface CheckoutForm {
  action_url: string;
  fields: Record<string, string>;
}
