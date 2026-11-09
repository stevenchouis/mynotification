// services/popupBanners.ts
// 首頁開屏活動彈窗（見 plan-popup-banner.md）。內容由 staff-scanner 後台維護，公開端點不需 token。
// 「今日不再顯示」只記在裝置本機（SecureStore 存台灣日期），不同步後端。
import * as SecureStore from 'expo-secure-store';

import { api } from './api';
import { HeroBannerRoute, isHeroBannerRoute } from '../constants/heroBannerRoutes';

export interface PopupBanner {
  id: string;
  title: string; // 不顯示在畫面上，給無障礙朗讀用
  imageUrl: string;
  // 不在白名單內的值一律當成 undefined（點了只關閉、不導頁）
  linkRoute?: HeroBannerRoute;
}

interface PopupBannerResponse {
  id: number | string;
  title: string;
  image_url: string | null;
  link_route: string | null;
}

export async function fetchPopupBanners(): Promise<PopupBanner[]> {
  const { data } = await api.get<PopupBannerResponse[]>('/api/v1/popup-banners');
  return data
    .filter((item) => !!item.image_url)
    .map((item) => ({
      id: String(item.id),
      title: item.title,
      imageUrl: item.image_url as string,
      linkRoute: isHeroBannerRoute(item.link_route) ? item.link_route : undefined,
    }));
}

const DISMISSED_DATE_KEY = 'popupBannerDismissedDate';

// 台灣時間（UTC+8）的日期字串 YYYY-MM-DD，「今日不再顯示」隔天 00:00 自動恢復
function taiwanToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function isPopupDismissedToday(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(DISMISSED_DATE_KEY)) === taiwanToday();
  } catch {
    return false;
  }
}

export async function dismissPopupForToday(): Promise<void> {
  try {
    await SecureStore.setItemAsync(DISMISSED_DATE_KEY, taiwanToday());
  } catch {
    // 存不進去最多就是今天還會再跳，不影響使用
  }
}
