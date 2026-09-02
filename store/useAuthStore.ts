// store/useAuthStore.ts
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

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
  },
}));