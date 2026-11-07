// services/users.ts
// 帳號本身的操作。目前只有刪除帳號（見 plan-delete-account.md）；個人資料讀寫仍寫在
// settings.tsx 裡，之後有需要再一起搬過來。
import { api } from './api';

// DELETE /api/v1/users/me：立即刪除（匿名化）目前登入的帳號，成功回 204。
// role=staff 的帳號後端會回 403，由呼叫端自己判斷 error.response.status 顯示提示
export async function deleteMyAccount(): Promise<void> {
  await api.delete('/api/v1/users/me');
}
