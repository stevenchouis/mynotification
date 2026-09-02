// services/api.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// 建立 Axios 實例
export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://your-backend-ip:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// 回應攔截器：處理 Token 過期 (401) 的情況
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // 可以在這裡觸發 Logout 邏輯，例如清除 SecureStore
      await SecureStore.deleteItemAsync('userToken');
      // 或是導向登入頁面
      console.warn("身份驗證過期，請重新登入");
    }
    return Promise.reject(error);
  }
);