// store/useFavoritesStore.ts
// 「我的收藏」— 只存在裝置本機（expo-secure-store），不同步到後端。
// 收藏的是首頁展示用的 DummyJSON 商品 id，跟自家後端資料無關，換裝置/重裝 App 會消失。
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface FavoritesState {
  favoriteIds: number[];
  toggleFavorite: (id: number) => void;
  isFavorite: (id: number) => boolean;
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

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favoriteIds: [],
      toggleFavorite: (id) =>
        set((state) => ({
          favoriteIds: state.favoriteIds.includes(id)
            ? state.favoriteIds.filter((favoriteId) => favoriteId !== id)
            : [...state.favoriteIds, id],
        })),
      isFavorite: (id) => get().favoriteIds.includes(id),
    }),
    {
      name: 'favorite-product-ids',
      storage: createJSONStorage(() => secureJSONStorage),
    }
  )
);
