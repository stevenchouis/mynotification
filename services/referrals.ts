// services/referrals.ts
// 推薦好友 API（2026-11-08，見 plan-referral.md）
import { api } from './api';
import { ApplyReferralResult, ReferralMe } from '../types/referral';

export const REFERRAL_ME_QUERY_KEY = ['referrals-me'] as const;

export async function fetchReferralMe(): Promise<ReferralMe> {
  const res = await api.get('/api/v1/referrals/me');
  return res.data;
}

// 錯誤：400 invalid_referral_code／self_referral、409 already_referred／apply_window_closed
export async function applyReferralCode(code: string): Promise<ApplyReferralResult> {
  const res = await api.post('/api/v1/referrals/apply', { code });
  return res.data;
}
