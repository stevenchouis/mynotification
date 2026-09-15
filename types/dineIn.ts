// types/dineIn.ts
// 堂食點餐型別，跟 types/shop.ts（網購商店用）刻意分開，不共用。欄位對齊已跟 back-end
// session 確認的 MenuItem／DineInOrder／DineInOrderItem 設計（見 plan-dine-in-order.md）。
// Restaurant／DineInTable 是 2026-09-10 多門市功能新增，見 CLAUDE.md「多門市（Restaurant）」章節。
export interface Restaurant {
  id: number;
  name: string;
}

export interface DineInTable {
  id: number;
  code: string;
  restaurant_id: number;
}

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string;
  is_available: boolean;
}

export interface DineInOrderItem {
  menu_item_id: number;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export type DineInOrderStatus = 'pending' | 'completed';

// 訂單狀態顯示文字，比照 types/shop.ts 的 ORDER_STATUS_LABEL 寫法。'completed' 是店員 App
// 透過 PATCH /dine-in-orders/{id}/status 標記的狀態，顧客端查詢自己的點餐紀錄時可能會讀到，
// 也是紅利點數「消費賺點數」在堂食路徑的觸發點（見 plan-loyalty-points.md）
export const DINE_IN_ORDER_STATUS_LABEL: Record<DineInOrderStatus, string> = {
  pending: '處理中（等待店家確認）',
  completed: '已完成',
};

export interface DineInOrder {
  id: number;
  table_number: string;
  status: DineInOrderStatus;
  items: DineInOrderItem[];
  total_amount: number;
  created_at: string;
  points_earned: number;
  points_used: number;
  // 優惠券線上折抵（2026-09-15，見 plan-coupon-checkout-discount.md），跟 use_points 平行：
  // coupon_id 有值代表這筆訂單用了哪張券，coupon_discount 是實際折抵的金額
  coupon_id: number | null;
  coupon_discount: number;
}
