// services/authFlow.ts
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

import { useAuthStore } from '../store/useAuthStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// 取得 accessToken 後的共用收尾流程：存 Token、同步 Push Token、導頁
// 帳密登入、Google 登入、Magic Link 登入都會呼叫這裡，確保三種登入方式的後續行為一致
export async function completeLogin(accessToken: string) {
  // 從後端回應中取得 Access Token，並且存到全局狀態管理的 userToken 中，這樣整個 App 就知道使用者已經登入了，並且可以在需要驗證的 API 呼叫中使用這個 Token 來授權。
  await useAuthStore.getState().setUserToken(accessToken);

  // 取得此裝置的 Expo Push Token
  // 註：實體手機才能取得有效 Token，模擬器會跳過此步驟
  let expoToken = null;
  try {
    // 先檢查是否已經取得通知權限，如果沒有就請求權限
    const tokenStatus = await Notifications.getPermissionsAsync();
    if (tokenStatus.status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
    // 嘗試取得 Expo Push Token，如果成功就存到 expoToken 變數中
    const pushTokenData = await Notifications.getExpoPushTokenAsync();
    expoToken = pushTokenData.data;
  } catch (e) {
    console.warn("無法取得 Push Token (可能是模擬器):", e);
  }

  // 將 Token 發送至後端 users.py 定義的路由，存到資料庫中, 讓後端知道這個使用者的裝置可以接收推播通知
  if (expoToken) {
    await axios.post(
      `${API_URL}/api/v1/users/push-tokens`,
      {
        token: expoToken,
        device_name: `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} - ${Platform.Version}`
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  }

  Alert.alert('登入成功', '歡迎使用系統');
  router.replace('/home');
}
