// types/loyalty.ts
// 紅利點數型別，跟 types/shop.ts／types/dineIn.ts 刻意分開，不共用既有 interface。
// 欄位對齊已跟 back-end session 確認的 LoyaltyTransaction 設計（見 plan-loyalty-points.md）。
export type LoyaltyTransactionType = 'earn' | 'redeem' | 'expire' | 'reverse_earn' | 'reverse_redeem';

// 交易類型顯示文字，比照 types/shop.ts 的 ORDER_STATUS_LABEL 寫法
export const LOYALTY_TX_TYPE_LABEL: Record<LoyaltyTransactionType, string> = {
  earn: '賺取',
  redeem: '折抵',
  expire: '過期',
  reverse_earn: '收回',
  reverse_redeem: '退還',
};

export interface LoyaltyTransaction {
  id: number;
  type: LoyaltyTransactionType;
  amount: number;
  reason: string;
  related_order_id: number | null;
  related_dine_in_order_id: number | null;
  created_at: string;
  expires_at: string | null; // 只有 type === 'earn' 才有值
  // 2026-09-11 多門市功能新增，純記錄/報表用途——餘額仍是統一帳戶層級，不影響能不能折抵
  // （見 CLAUDE.md「多門市」章節），堂食交易由後端從訂單的 table_id 反查門市自動帶入
  restaurant_id?: number | null;
}
