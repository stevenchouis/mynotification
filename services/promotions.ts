// services/promotions.ts
// 首頁小型活動輪播的資料來源，改由後端資料庫提供（取代 home.tsx 原本寫死的 PROMO_COPY + 抓 DummyJSON 圖片，
// 舊程式碼保留成註解在 home.tsx 裡對照）。路徑/格式已跟 back-end session 確認定案（公開端點、不需要 token），
// 種子資料已經照當初給的 3 筆塞好，內容應該跟 home.tsx 裡註解掉的舊版一模一樣。
import { api } from './api';

export interface PromoBanner {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  color: string;
  imageUrl: string;
}

interface PromoBannerResponse {
  id: number | string;
  tag: string;
  title: string;
  subtitle: string;
  color: string;
  image_url: string;
}

export async function fetchPromoBanners(): Promise<PromoBanner[]> {
  const { data } = await api.get<PromoBannerResponse[]>('/api/v1/promotions/home-banners');
  return data.map((item) => ({
    id: String(item.id),
    tag: item.tag,
    title: item.title,
    subtitle: item.subtitle,
    color: item.color,
    imageUrl: item.image_url,
  }));
}
