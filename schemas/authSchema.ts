// import { z } from 'zod';
// export const loginSchema = z.object({
// 直接使用 z.email() 取代 z.string().email()
//   username: z.email({ message: '請輸入正確的 Email 格式' }), 
// 密碼欄位維持原樣，因為它需要長度限制
//   password: z.string().min(6, '密碼至少需要 6 位數'),
// });
// export type LoginFormValues = z.infer<typeof loginSchema>;

import { z } from 'zod';

// 基礎 Email 規範
const emailRule = z.string().min(1, '請輸入 Email').email('Email 格式不正確');

// 基礎密碼規範 (註冊用)
const passwordRule = z.string()
  .min(8, '密碼至少需要 8 位')
  .regex(/\d/, '需包含至少一個數字')
  .regex(/[!@#$%^&*]/, '需包含特殊符號');

// 1. 登入用的 Schema
export const loginSchema = z.object({
  username: emailRule,
  password: z.string().min(1, '請輸入密碼'), // 登入時不重複檢查強度，只檢查有無輸入
});

// 2. 註冊用的 Schema
export const registerSchema = z.object({
  email: emailRule,
  password: passwordRule,
  confirmPassword: z.string().min(1, '請再次輸入密碼'),
  birthday: z.date()
    .refine((date) => date <= new Date(), {
      message: "生日不能是未來的日期",
    }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "兩次輸入的密碼不一致",
  path: ["confirmPassword"], 
});

// 定義 Type 供 TypeScript 使用
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;