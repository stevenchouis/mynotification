// store/useAuthStore.ts
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { queryClient } from '../services/queryClient';

// 續期證（refresh token，見 plan-refresh-token.md）。只存 SecureStore，不放進 Zustand 狀態：
// 畫面不需要它，只有 services/api.ts 換證、logout 作廢時讀。舊後端不回 refresh_token 時不會存在。
export const REFRESH_TOKEN_KEY = 'refreshToken';
const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface AuthState {
  userToken: string | null;
  isLoading: boolean;           // 必須新增這一行
  setUserToken: (token: string | null, refreshToken?: string | null) => void;
  loadToken: () => Promise<void>; // 新增：讀取本地 Token 的函式
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userToken: null,
  isLoading: true, // 初始狀態為正在載入

  setUserToken: async (token, refreshToken) => {
    // 換人登入前先清空所有伺服器資料快取：快取的 query key（['notifications']、['myCoupons'] 等）
    // 沒有帶使用者身分，加上全域 5 分鐘 staleTime，不清的話新登入的使用者會先看到上一位使用者的
    // 資料（通知、優惠券、好友…），要手動下拉刷新才會變正確。此時還沒有已登入畫面掛載，
    // 不會有 observer 把舊資料立刻又抓回來
    queryClient.clear();
    if (token) {
      await SecureStore.setItemAsync('userToken', token);
    } else {
      await SecureStore.deleteItemAsync('userToken');
    }
    if (token && refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
    
    // 修正：設定完 Token 後，也要確保載入狀態為 false
    set({ 
        userToken: token, 
        isLoading: false 
    });
  },
  loadToken: async () => {
    // 應用啟動時呼叫，從 SecureStore 讀取 token 並更新全局狀態
    const token = await SecureStore.getItemAsync('userToken');
    
    // 修正：這裡必須將 isLoading 設為 false
    set({ 
        userToken: token, 
        isLoading: false  // 告訴 _layout.tsx 檢查完畢，可以渲染畫面了
    });
  },
  logout: async () => {
    // 0. 通知後端作廢這台裝置的續期證（見 plan-refresh-token.md）。不等結果、失敗也照常登出；
    //    用原生 fetch 而不是 services/api.ts，避免循環引用、也不會進到 401 換證流程
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      fetch(`${API_URL}/api/v1/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }

    // 1. 清除手機本地儲存的 Token
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    
    // 2. 更新全局狀態
    set({ 
        userToken: null, 
        isLoading: false // 確保狀態回到初始但「非讀取中」的狀態
    });

    // 登出（含 api.ts 遇到 401 的自動登出）也清快取。必須放在 set 之後：先清快取的話，
    // 還掛載著的畫面會用舊 token 又把資料抓回來，重新寫進剛清空的快取
    queryClient.clear();
  },
}));