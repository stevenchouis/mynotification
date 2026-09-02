// schemas/userSchema.ts
import { z } from 'zod';

export const userSettingsSchema = z.object({
  username: z.string()
    .min(2, { message: "名稱至少需要 2 個字" })
    .max(20),
    
  // 修正 URL：允許 null 或空字串，且只有在有值時才檢查 URL 格式
  avatar_url: z.union([
    z.string().url({ message: "圖片網址格式不正確" }),
    z.string().length(0),
    z.null()
  ]).optional(),

  // 生日：必填（預設就是必填，不能 null 或 undefined）
  birthday: z.date()
    .refine((date) => date <= new Date(), {
      message: "生日不能是未來的日期",
    }),
});

export type UserSettingsFormData = z.infer<typeof userSettingsSchema>;