// types/storeCheckout.ts
// 門市收銀交易型別，跟 types/shop.ts（網購）／types/dineIn.ts（堂食）刻意分開，不共用——
// 這是全新的門市通路（會員條碼 + 店員手動收銀），不是既有 Order/DineInOrder 的延伸，
// 見 plan-member-code-checkout.md。欄位對齊已跟 back-end session 確認的 StoreCheckout 設計。
export type StoreCheckoutPaymentMethod = 'cash' | 'jkopay';

// GET /api/v1/store-checkouts/me、POST /api/v1/store-checkouts 共用的回應格式
export interface StoreCheckout {
  id: number;
  user_id: number;
  staff_user_id: number;
  restaurant_id: number;
  subtotal: number;
  payment_method: StoreCheckoutPaymentMethod;
  coupon_id: number | null;
  coupon_discount: number;
  points_used: number;
  points_discount: number;
  total_amount: number;
  points_earned: number;
  status: string;
  created_at: string;
}
