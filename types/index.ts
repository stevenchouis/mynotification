export interface Coupon {
    id: number;
    title: string;
    discount_amount: number;
    is_used: boolean;
    expired_at: string;
    used_at: string | null;
}

// POST /api/v1/coupons/{id}/redeem-code 的回應
export interface RedeemCodeResponse {
    code: string;
    expires_at: string;
}