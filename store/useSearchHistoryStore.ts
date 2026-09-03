// store/useSearchHistoryStore.ts
// 「最近搜尋」— 只存在裝置本機（expo-secure-store），不同步到後端。
// 寫法比照 store/useFavoritesStore.ts 的 persist middleware + SecureStore storage。
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MAX_HISTORY = 10;

interface SearchHistoryState {
  keywords: string[];
  addKeyword: (keyword: string) => void;
  clearHistory: () => void;
}

// zustand persist middleware 需要 { getItem, setItem, removeItem } 介面，包一層 SecureStore
const secureJSONStorage = {
  getItem: async (name: string) => (await SecureStore.getItemAsync(name)) ?? null,
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      keywords: [],
      addKeyword: (keyword) =>
        set((state) => {
          const trimmed = keyword.trim();
          if (!trimmed) return state;
          // 移除舊的重複項目，把這次搜尋放到最前面，超過上限就砍掉最舊的
          const deduped = state.keywords.filter((k) => k !== trimmed);
          return { keywords: [trimmed, ...deduped].slice(0, MAX_HISTORY) };
        }),
      clearHistory: () => set({ keywords: [] }),
    }),
    {
      name: 'search-history-keywords',
      storage: createJSONStorage(() => secureJSONStorage),
    }
  )
);
