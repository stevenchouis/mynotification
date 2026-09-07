// store/useThemeModeStore.ts
// 使用者手動選擇的外觀模式（淺色／深色／跟隨系統），只存在裝置本機（expo-secure-store，
// 比照 useFavoritesStore.ts 的做法），不會同步到後端。預設是 'system'，也就是沒手動選過時
// 維持原本「跟系統深色模式走」的行為。
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeModeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
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

export const useThemeModeStore = create<ThemeModeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'theme-mode-preference',
      storage: createJSONStorage(() => secureJSONStorage),
    }
  )
);
