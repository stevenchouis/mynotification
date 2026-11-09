// services/users.ts
// 帳號本身的操作：刪除帳號（見 plan-delete-account.md）、電子發票載具（見 plan-einvoice-carrier.md）。
// 暱稱、頭像的讀寫仍寫在 settings.tsx 裡，之後有需要再一起搬過來。
import { api } from './api';

// DELETE /api/v1/users/me：立即刪除（匿名化）目前登入的帳號，成功回 204。
// role=staff 的帳號後端會回 403，由呼叫端自己判斷 error.response.status 顯示提示
export async function deleteMyAccount(): Promise<void> {
  await api.delete('/api/v1/users/me');
}

// GET /api/v1/users/me。queryKey 沿用 settings.tsx 的 ['userProfile']，兩邊共用同一份快取
export const USER_PROFILE_QUERY_KEY = ['userProfile'] as const;

export interface UserProfile {
  email: string;
  nickname?: string | null;
  avatar_url?: string | null;
  einvoice_carrier?: string | null; // 2026-11-09 新增，舊後端沒有這個欄位
}

export async function fetchMyProfile(): Promise<UserProfile> {
  const res = await api.get('/api/v1/users/me');
  return res.data;
}

// PUT /api/v1/users/me 只帶 einvoice_carrier：字串＝設定（格式不合回 400 invalid_einvoice_carrier），
// null＝清除；不影響暱稱、頭像
export async function updateEinvoiceCarrier(carrier: string | null): Promise<UserProfile> {
  const res = await api.put('/api/v1/users/me', { einvoice_carrier: carrier });
  return res.data;
}
