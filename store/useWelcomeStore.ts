// store/useWelcomeStore.ts
// 「本次開啟 App 是否已看過 Welcome 畫面」——刻意只存在記憶體（不用 persist），App 完全重啟時
// JS 環境重新載入會自然重置，維持「每次開 App 都要看一次」的設計（見 plan.md）。
//
// 為什麼不放在 app/_layout.tsx 的 useState：Expo Router 的根 _layout 本身是內部導覽器裡
// `__root` 這個畫面的元件，導覽狀態被重設時會整個卸載再重新掛載，useState 也跟著歸零。
// 2026-10-14～15 實際踩過：已登入啟動時 `/`（index）被 Stack.Protected 擋住，Expo Router 改導到
// Stack 裡第一個可進的畫面，當時 magic-login 排第一個，先被導進 magic-login 再 replace 回 /home，
// 過程中 RootLayout 被重掛，Welcome 出現兩次（magic-login 已移到 Stack 最後面，見 _layout.tsx）。
// 放在 module 層級的 store 不受元件重掛影響，當作保險繼續保留。
import { create } from 'zustand';

interface WelcomeState {
  hasSeenWelcome: boolean;
  markWelcomeSeen: () => void;
}

export const useWelcomeStore = create<WelcomeState>((set) => ({
  hasSeenWelcome: false,
  markWelcomeSeen: () => set({ hasSeenWelcome: true }),
}));
