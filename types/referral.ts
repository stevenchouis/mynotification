// types/referral.ts
// 推薦好友（2026-11-08，見 plan-referral.md）。獎勵金額、每年上限、補填期限都由後端決定，前端只顯示。
import { Coupon } from './index';

export interface ReferredBy {
  display_name: string; // 有暱稱用暱稱，沒有就是遮罩過的 email
}

// GET /api/v1/referrals/me
export interface ReferralMe {
  code: string;
  successful_count: number; // 已完成首購的推薦人數
  pending_count: number; // 已填碼、還沒首購
  rewarded_this_year: number;
  yearly_limit: number;
  referred_by: ReferredBy | null;
  can_apply_code: boolean; // 註冊 7 天內、沒消費過、還沒被推薦過
  apply_deadline: string | null;
}

// POST /api/v1/referrals/apply 的成功回應
export interface ApplyReferralResult {
  coupon: Coupon;
  referred_by: ReferredBy;
}

// 推薦碼相關錯誤（detail 是帶 error_code 的物件）對應的顯示文字，register.tsx 與 referral.tsx 共用
export const REFERRAL_ERROR_MESSAGE: Record<string, string> = {
  invalid_referral_code: '推薦碼不存在，請確認後再輸入',
  self_referral: '不能填自己的推薦碼',
  already_referred: '你已經填過推薦碼了',
  apply_window_closed: '補填期限已過（限註冊 7 天內、尚未消費）',
};

// 推薦碼 6 碼英數，去掉容易看錯的 0/O/1/I；輸入時自動轉大寫、去空白
export const REFERRAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
export const normalizeReferralCode = (value: string) => value.replace(/\s/g, '').toUpperCase();
