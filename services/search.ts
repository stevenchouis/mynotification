// services/search.ts
// 「熱門搜尋標籤」資料來源，走自家後端（不是 DummyJSON）。這支 API 由 back-end session 負責，
// 路徑/格式已跟 back-end session 確認定案（公開端點、不需要 token）；資料表目前是空的（還沒塞測試資料），
// 所以回傳空陣列時也一併 fallback，避免上線初期搜尋頁看起來像壞掉。
import { api } from './api';

export const FALLBACK_KEYWORDS = ['沐浴乳', '收納盒', '文具', '廚房用品', '香氛'];

interface SearchSuggestion {
  keyword: string;
}

export async function fetchSearchSuggestions(): Promise<string[]> {
  try {
    const { data } = await api.get<SearchSuggestion[]>('/api/v1/search/suggestions');
    const keywords = data.map((item) => item.keyword).filter(Boolean);
    return keywords.length > 0 ? keywords : FALLBACK_KEYWORDS;
  } catch {
    return FALLBACK_KEYWORDS;
  }
}
