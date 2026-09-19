// store/useAuthStore.ts
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { queryClient } from '../services/queryClient';

interface AuthState {
  userToken: string | null;
  isLoading: boolean;           // 必須新增這一行
  setUserToken: (token: string | null) => void;
  loadToken: () => Promise<void>; // 新增：讀取本地 Token 的函式
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userToken: null,
  isLoading: true, // 初始狀態為正在載入

  setUserToken: async (token) => {
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
    // 1. 清除手機本地儲存的 Token
    await SecureStore.deleteItemAsync('userToken'); 
    
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