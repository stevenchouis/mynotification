// schemas/userSchema.ts
// 設定頁的暱稱欄位（見 plan-nickname.md）。原本這裡還有 avatar_url／birthday 兩個欄位，
// 但 settings.tsx 從未真的用 react-hook-form 接過這個 schema，是孤兒檔案；而且那兩個欄位
// 跟目前實際行為對不上（avatar_url 不是使用者手打的文字，是選圖/拍照後上傳到 Supabase
// 才自動產生的公開網址；birthday 目前設定頁根本沒有編輯介面，PUT /users/me 後端也還沒
// 套用這個欄位），2026-10-13 清掉、只留暱稱這個真正在用的欄位。
import { z } from 'zod';

// 跟後端規則一致（已跟 back-end 確認，見 plan-nickname.md）：
// 沒有最少字數——空字串是合法輸入，代表清除暱稱（後端存成 null），送出前會 trim 再送
export const nicknameSchema = z.object({
  nickname: z.string().max(20, { message: '暱稱最多 20 個字' }),
});

export type NicknameFormValues = z.infer<typeof nicknameSchema>;
