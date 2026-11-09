// constants/heroBannerRoutes.ts
// 首頁大輪播與開屏彈窗（見 plan-popup-banner.md）共用的 link_route 白名單。back-end（驗證，不在清單內回 422）、staff-scanner（下拉選單）
// 三方寫死同一份，之後要增減路徑三邊都要同步改（見 plan-hero-banner-admin.md）。
// 前端也檢查一次：後端之後若加了新路徑、舊版 App 不認得，點了就不動作，避免跳到不存在的畫面。
export const HERO_BANNER_ROUTES = [
  '/coupons',
  '/points',
  '/favorites',
  '/inbox',
  '/member-code',
  '/shop',
  '/search',
  '/settings',
  // 2026-11-09 隨開屏彈窗新增（使用者決定），三方同步：
  '/referral',
  '/points-exchange',
] as const;

export type HeroBannerRoute = (typeof HERO_BANNER_ROUTES)[number];

export function isHeroBannerRoute(value: unknown): value is HeroBannerRoute {
  return typeof value === 'string' && (HERO_BANNER_ROUTES as readonly string[]).includes(value);
}
