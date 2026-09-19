// store/useFriendStarStore.ts
// 好友加星號標記 — 只存在裝置本機（expo-secure-store），不同步到後端，比照 useFavoritesStore，
// 換裝置/重裝 App 會消失。key 存 friendshipId。
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface FriendStarState {
  starredIds: number[];
  toggleStar: (friendshipId: number) => void;
  isStarred: (friendshipId: number) => boolean;
}

const secureJSONStorage = {
  getItem: async (name: string) => (await SecureStore.getItemAsync(name)) ?? null,
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

export const useFriendStarStore = create<FriendStarState>()(
  persist(
    (set, get) => ({
      starredIds: [],
      toggleStar: (friendshipId) =>
        set((state) => ({
          starredIds: state.starredIds.includes(friendshipId)
            ? state.starredIds.filter((id) => id !== friendshipId)
            : [...state.starredIds, friendshipId],
        })),
      isStarred: (friendshipId) => get().starredIds.includes(friendshipId),
    }),
    {
      name: 'starred-friendship-ids',
      storage: createJSONStorage(() => secureJSONStorage),
    }
  )
);
