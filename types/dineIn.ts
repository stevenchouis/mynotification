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

// 'served' 是 2026-09-16 新增的中間狀態（見 plan-dine-in-order-payment.md），把「出餐/用餐
// 完成」跟「已收款」分開：pending → served → completed，completed 維持是既有的紅利點數
// 觸發點，這段邏輯完全沒動（back-end 確認發點判斷式看的是「還不是 completed」，插入 served
// 不影響它）。狀態轉換順序由後端強制檢查（跳過會 409），mynotification 這邊純顯示，不需要
// 自己再檢查順序。
export type DineInOrderStatus = 'pending' | 'served' | 'completed';

// 訂單狀態顯示文字，比照 types/shop.ts 的 ORDER_STATUS_LABEL 寫法。狀態轉換由店員 App
// 透過 PATCH /dine-in-orders/{id}/status 觸發，顧客端查詢自己的點餐紀錄時可能會讀到，
// 'completed' 也是紅利點數「消費賺點數」在堂食路徑的觸發點（見 plan-loyalty-points.md）
export const DINE_IN_ORDER_STATUS_LABEL: Record<DineInOrderStatus, string> = {
  pending: '處理中（等待店家確認）',
  served: '已出餐，待收款',
  completed: '已完成',
};

// 門市收銀（StoreCheckout）也有同樣的 'cash'/'jkopay' 概念，但型別刻意分開不共用，
// 跟這個專案「各通路型別各自獨立」的既有慣例一致（見 types/storeCheckout.ts 開頭註解）
export type DineInPaymentMethod = 'cash' | 'jkopay';

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
  // 收款前是 null，店員在 served→completed 轉換時強制帶入（見 plan-dine-in-order-payment.md）
  payment_method: DineInPaymentMethod | null;
}
