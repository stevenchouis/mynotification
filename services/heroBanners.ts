// services/heroBanners.ts
// 首頁大輪播的資料來源，改由後端資料庫提供（取代 home.tsx 寫死的 BANNER_COPY，BANNER_COPY 改當備援）。
// 公開端點、不需要 token；內容由 staff-scanner 後台維護（見 plan-hero-banner-admin.md）。
import { api } from './api';
import { HeroBannerRoute, isHeroBannerRoute } from '../constants/heroBannerRoutes';

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  imageUrl?: string;
  // 不在白名單內的值一律當成 undefined（點了不導向）
  linkRoute?: HeroBannerRoute;
}

interface HeroBannerResponse {
  id: number | string;
  title: string;
  subtitle: string;
  color: string;
  image_url: string | null;
  link_route: string | null;
}

export async function fetchHeroBanners(): Promise<HeroBanner[]> {
  const { data } = await api.get<HeroBannerResponse[]>('/api/v1/hero-banners');
  return data.map((item) => ({
    id: String(item.id),
    title: item.title,
    subtitle: item.subtitle,
    color: item.color,
    imageUrl: item.image_url ?? undefined,
    linkRoute: isHeroBannerRoute(item.link_route) ? item.link_route : undefined,
  }));
}
