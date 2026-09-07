// services/api.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

import { useAuthStore } from '../store/useAuthStore';

// 建立 Axios 實例
export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://your-backend-ip:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 刻意保留：之前 LINE 登入除錯時，終端機殘留的手動 $env:EXPO_PUBLIC_API_URL 蓋過了
// .env.local/.env.development，導致 App 實際打的網址跟以為的不一樣、誤判成後端邏輯錯誤
// （見 plan-line-login.md 除錯回顧第 4 點）。留著這行，每次啟動能在終端機直接看到目前生效的網址。
console.log(`[api] baseURL = ${api.defaults.baseURL}`);

// 請求攔截器：自動為每個請求加上 Authorization Header
api.interceptors.request.use(
  async (config) => {
    // 從 SecureStore 讀取 Token
    const token = await SecureStore.getItemAsync('userToken');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 回應攔截器：處理 Token 過期 (401) 的情況。
// 原本只清 SecureStore、沒有同步更新 Zustand 的 userToken 狀態，畫面還是停在已登入的樣子，
// 但 request 攔截器抓不到 token（已被清掉）導致之後每一次 API 呼叫都繼續 401、無限重複——
// 使用者會看到功能「按了沒反應」或「一直失敗」，卻不知道其實是登入過期。改成呼叫
// useAuthStore.logout()：會同步清 SecureStore + 更新 store 的 userToken，讓 app/_layout.tsx
// 的 Stack.Protected 反應式地把畫面切回登入頁。用 userToken 存在與否當守門，避免同時間
// 好幾個請求都收到 401 時重複觸發 logout/跳好幾次 Toast。
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { userToken, logout } = useAuthStore.getState();
      if (userToken) {
        await logout();
        Toast.show({ type: 'error', text1: '登入已過期', text2: '請重新登入' });
      }
    }
    return Promise.reject(error);
  }
);