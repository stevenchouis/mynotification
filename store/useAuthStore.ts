// store/useAuthStore.ts
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { queryClient } from '../services/queryClient';

// 續期證（refresh token，見 plan-refresh-token.md）。只存 SecureStore，不放進 Zustand 狀態：
// 畫面不需要它，只有 services/api.ts 換證、logout 作廢時讀。舊後端不回 refresh_token 時不會存在。
export const REFRESH_TOKEN_KEY = 'refreshToken';
// 這支手機登記給後端的 Expo Push Token（見 plan-push-token-cleanup.md），登出時才知道要解除哪一個
export const EXPO_PUSH_TOKEN_KEY = 'expoPushToken';
const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface AuthState {
  userToken: string | null;
  isLoading: boolean;           // 必須新增這一行
  setUserToken: (token: string | null, refreshToken?: string | null) => void;
  loadToken: () => Promise<void>; // 新增：讀取本地 Token 的函式
  logout: () => void;
}

// 登出時在背景通知後端（不等結果、失敗吞掉），用原生 fetch 避免跟 services/api.ts 循環引用與 401 換證流程：
// 1. 解除這支手機的推播（見 plan-push-token-cleanup.md），不然登出後還會收到這個帳號的推播。
//    閒置超過 30 分鐘才登出時通行證已過期會 401：用續期證換一次新的再重試（staff-scanner 提議、兩邊同做法）；
//    換不到（被迫登出、續期證也失效）就略過——後端在換人登入時會移轉 token、90 天沒出現也會清
// 2. 作廢這台裝置的續期證（見 plan-refresh-token.md）；如果第 1 步換過證，要作廢的是換出來的新那張
async function revokeOnServer(accessToken: string | null, refreshToken: string | null, pushToken: string | null) {
  const post = (path: string, body: object, token?: string | null) =>
    fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  let currentRefresh = refreshToken;
  try {
    if (pushToken && accessToken) {
      const res = await post('/api/v1/users/push-tokens/unregister', { token: pushToken }, accessToken);
      if (res.status === 401 && currentRefresh) {
        const refreshed = await post('/api/v1/login/refresh', { refresh_token: currentRefresh });
        if (refreshed.ok) {
          const data = await refreshed.json();
          currentRefresh = data.refresh_token ?? currentRefresh;
          await post('/api/v1/users/push-tokens/unregister', { token: pushToken }, data.access_token);
        }
      }
    }
  } catch {
    // 網路失敗就算了，不影響登出
  }
  if (currentRefresh) {
    post('/api/v1/logout', { refresh_token: currentRefresh }).catch(() => {});
  }
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
    // 0. 先讀出通行證、續期證、推播 token，再在背景依序：解除推播 → 作廢續期證。
    //    清本機、切回登入頁不用等這兩個呼叫（值已經先讀出來傳進去）。
    const [accessToken, refreshToken, pushToken] = await Promise.all([
      SecureStore.getItemAsync('userToken'),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.getItemAsync(EXPO_PUSH_TOKEN_KEY),
    ]);
    revokeOnServer(accessToken, refreshToken, pushToken);

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