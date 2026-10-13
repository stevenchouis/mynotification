// services/marquee.ts
// 首頁跑馬燈的資料來源，改由後端資料庫提供（見 plan-marquee-backend.md）。公開端點、不需要
// token，比照 services/promotions.ts 的 fetchPromoBanners 寫法。管理（新增/編輯/上下架/刪除）
// 由 staff-scanner 呼叫對應的管理端點，這裡只負責 mynotification 端的讀取顯示。
import { api } from './api';

interface MarqueeItemResponse {
  text: string;
}

// 公開端點只回上架中、已生效、未過期的項目，且已經依 sort_order 排好序，前端直接依序顯示即可
export async function fetchMarqueeTexts(): Promise<string[]> {
  const { data } = await api.get<MarqueeItemResponse[]>('/api/v1/marquee');
  return data.map((item) => item.text);
}
