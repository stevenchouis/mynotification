export interface Coupon {
    id: number;
    title: string;
    discount_amount: number;
    is_used: boolean;
    expired_at: string;
    used_at: string | null;
    // 2026-09-11 多門市功能新增，純記錄用途（統一錢包/優惠券不限門市核銷，見 CLAUDE.md）：
    // 有值＝這張券是特定門市發的（例如分店活動加碼），null＝連鎖層級（歡迎禮券/生日禮券）
    restaurant_id?: number | null;
}

// POST /api/v1/coupons/{id}/redeem-code 的回應
export interface RedeemCodeResponse {
    code: string;
    expires_at: string;
}