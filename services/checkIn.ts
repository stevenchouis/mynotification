// services/checkIn.ts
// 每日簽到 API（2026-11-08，見 plan-daily-check-in.md）。台灣時間 00:00 換日、連續天數、
// 獎勵點數都由後端計算，前端只顯示。
import { api } from './api';
import { CheckInResult, CheckInStatus } from '../types/loyalty';

export const CHECK_IN_STATUS_QUERY_KEY = ['check-in-status'] as const;

export async function fetchCheckInStatus(): Promise<CheckInStatus> {
  const res = await api.get('/api/v1/check-in/status');
  return res.data;
}

// 今天已簽過回 409 { error_code: "already_checked_in" }
export async function checkIn(): Promise<CheckInResult> {
  const res = await api.post('/api/v1/check-in');
  return res.data;
}
