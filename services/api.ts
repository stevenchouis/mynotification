// services/api.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

import { REFRESH_TOKEN_KEY, useAuthStore } from '../store/useAuthStore';

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

// ===== 自動續期（refresh token，見 plan-refresh-token.md）=====
// 通行證過期（401）時先用續期證換一組新的，再重送原請求，使用者不會被登出。
// 同時多個請求 401 時共用同一次換證（refreshPromise），避免同一張續期證被用兩次——後端每次換證都會
// 作廢舊的那張，第二次使用會被當成外洩、整個帳號所有裝置一起被登出。
// 換證請求用原生 axios（不是 api 實例），不會再進到這個攔截器造成無限循環。
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null; // 舊後端／登入前就存在的舊 session 沒有續期證，照舊登出
  try {
    const res = await axios.post(
      `${api.defaults.baseURL}/api/v1/login/refresh`,
      { refresh_token: refreshToken },
      { timeout: 10000 },
    );
    const { access_token: newAccess, refresh_token: newRefresh } = res.data;
    await SecureStore.setItemAsync('userToken', newAccess);
    // 一定要存新的續期證：舊的已經被後端作廢
    if (newRefresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefresh);
    // 同步 Zustand（不經過 setUserToken：那個會清掉所有查詢快取，換證不是換人）
    useAuthStore.setState({ userToken: newAccess });
    // 留著：實機驗證自動續期時，可用 adb logcat 確認換證有發生（不印 token 內容）
    console.log('[auth] 通行證已自動續期');
    return newAccess;
  } catch (e: any) {
    console.log('[auth] 自動續期失敗', e?.response?.status ?? String(e));
    return null;
  }
}

function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

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
    const original = error.config;
    // 先試著換證重送；每個請求只重送一次（_retried），重送後還是 401 才登出
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      // 這個請求帶的是舊通行證、而別的請求已經換好新的：直接用新的重送，不用再換一次證
      const current = await SecureStore.getItemAsync('userToken');
      const sentWith = String(original.headers?.Authorization ?? '').replace('Bearer ', '');
      const newAccess = current && current !== sentWith ? current : await refreshOnce();
      if (newAccess) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      }
    }
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