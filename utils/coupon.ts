// utils/coupon.ts
// 優惠券狀態判斷共用邏輯，原本各自寫在 coupons.tsx，2026-09-15 隨「優惠券可折抵網購/堂食訂單」
// 功能抽出來，讓 cart.tsx／dine-in/cart.tsx 的優惠券選擇 UI 可以共用同一套「待使用」判斷，
// 純粹搬邏輯、不改行為（見 plan-coupon-checkout-discount.md）。
import { Coupon } from '../types';

export type CouponStatus = 'active' | 'used' | 'expired';

// 已使用/已過期的優惠券，超過這段時間就不再顯示，避免列表一直堆積舊紀錄（coupons.tsx 專用）
export const HIDE_AFTER_DAYS = 30;
export const HIDE_AFTER_MS = HIDE_AFTER_DAYS * 24 * 60 * 60 * 1000;

export function getCouponStatus(coupon: Coupon): CouponStatus {
  if (coupon.is_used) return 'used';
  if (new Date(coupon.expired_at).getTime() < Date.now()) return 'expired';
  return 'active';
}

// 已使用：以 used_at 為基準；已過期未使用：以 expired_at 為基準
export function isStale(coupon: Coupon, status: CouponStatus): boolean {
  if (status === 'active') return false;
  const referenceDate = status === 'used' ? coupon.used_at : coupon.expired_at;
  if (!referenceDate) return false;
  return Date.now() - new Date(referenceDate).getTime() > HIDE_AFTER_MS;
}
