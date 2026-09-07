// types/dineIn.ts
// 堂食點餐型別，跟 types/shop.ts（網購商店用）刻意分開，不共用。欄位對齊已跟 back-end
// session 確認的 MenuItem／DineInOrder／DineInOrderItem 設計（見 plan-dine-in-order.md）。
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

export type DineInOrderStatus = 'pending';

// 訂單狀態顯示文字，比照 types/shop.ts 的 ORDER_STATUS_LABEL 寫法。目前後端只會回傳
// 'pending'（送出後現場結帳、備餐狀態由店員口頭/現場掌握，App 端不做即時狀態追蹤）
export const DINE_IN_ORDER_STATUS_LABEL: Record<DineInOrderStatus, string> = {
  pending: '處理中（等待店家確認）',
};

export interface DineInOrder {
  id: number;
  table_number: string;
  status: DineInOrderStatus;
  items: DineInOrderItem[];
  total_amount: number;
  created_at: string;
}
