// constants/loyalty.ts
// 紅利點數比例常數，跟 back-end 已定案、寫死在雙邊程式碼裡（非後台可調設定），之後調整
// 就是改這裡的數字。前端只用這些常數做「即時試算」顯示，事實來源仍在後端（見 plan-loyalty-points.md）。
export const POINTS_TO_CURRENCY_RATE = 1; // 1 點折抵 NT$1
export const MAX_REDEEM_RATIO = 0.5; // 單筆訂單最高折抵訂單金額 50%

// 會員等級（2026-11-07，見 plan-member-tier.md）。門檻、倍率跟 back-end 寫死同一份，
// 前端只用來顯示（權益對照表、進度條），實際等級與入帳點數以後端 GET /loyalty/me 為準。
// badgeColor 是「會員卡」的品牌色（銀、金），比照輪播粉彩色系視為內容色，刻意不隨深淺色主題切換。
export type MemberTier = 'regular' | 'silver' | 'gold';

export const MEMBER_TIERS: Record<
  MemberTier,
  { label: string; threshold: number; multiplier: number; upgradeCoupon: number | null; birthdayMultiplier: number; badgeColor: string }
> = {
  regular: { label: '一般會員', threshold: 0, multiplier: 1, upgradeCoupon: null, birthdayMultiplier: 1, badgeColor: '#A69B8D' },
  silver: { label: '銀卡', threshold: 10000, multiplier: 1.5, upgradeCoupon: 100, birthdayMultiplier: 2, badgeColor: '#8E9AA3' },
  gold: { label: '金卡', threshold: 30000, multiplier: 2, upgradeCoupon: 200, birthdayMultiplier: 3, badgeColor: '#C49A2C' },
};

export const MEMBER_TIER_ORDER: MemberTier[] = ['regular', 'silver', 'gold'];

export function isMemberTier(value: unknown): value is MemberTier {
  return value === 'regular' || value === 'silver' || value === 'gold';
}
