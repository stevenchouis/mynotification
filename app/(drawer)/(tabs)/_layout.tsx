import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // 1. 匯入 Query 工具
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';

import { useAuthStore } from '../../../store/useAuthStore';
import { useFavoritesStore } from '../../../store/useFavoritesStore';
import { useNotificationStore } from '../../../store/useNotificationStore';
import { Notification } from '../../../types/notification';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function TabLayout() {
  const queryClient = useQueryClient();
  const { userToken } = useAuthStore();
  
  // 從 Store 只取出狀態和更新函式
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);
  const favoriteCount = useFavoritesStore((state) => state.favoriteIds.length);

  // 2. 使用 useQuery 建立全域通知監聽
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/v1/notifications/inbox`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      return response.data;
    },
    enabled: !!userToken, // 只有在有 Token 時才抓取
  });

  // 3. 當 notifications 更新時，同步更新 Zustand 的 unreadCount
  useEffect(() => {
    const count = notifications.filter(n => !n.is_read).length;
    setUnreadCount(count);
  }, [notifications, setUnreadCount]);

  // 4. 處理 Push Token 同步
  useEffect(() => {
    const syncPushToken = async () => {
      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        await axios.post(
          `${API_URL}/api/v1/users/push-tokens`,
          { token, device_name: Platform.OS },
          { headers: { Authorization: `Bearer ${userToken}` } }
        );
        Toast.show({
          type: 'success',
          text1: '系統同步',
          text2: '裝置推送 Token 同步成功！🚀',
          visibilityTime: 2000,
        });
      } catch (e) {
        console.warn("Token 同步失敗", e);
      }
    };

    if (userToken) {
      syncPushToken();
    }
  }, [userToken]);

  // 5. 處理前景收到推播
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log("前景收到通知：", notification.request.content.data);
      
      // 關鍵：不再呼叫 fetchNotifications()
      // 而是讓 TanStack Query 的快取失效，它會自動重新抓取並觸發上面的 useEffect 更新數字
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      Toast.show({
        type: 'info',
        text1: notification.request.content.title || '新通知',
        text2: notification.request.content.body || '',
      });
    });

    return () => subscription.remove();
  }, [queryClient]);

  return (
    // headerShown: false — header 交給外層的 (drawer)/_layout.tsx 統一顯示（含選單按鈕）
    <Tabs screenOptions={{ tabBarActiveTintColor: '#007AFF', headerShown: false }}>
      <Tabs.Screen
        name="home"
        options={{
          title: '首頁',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: '我的收藏',
          tabBarIcon: ({ color }) => <Ionicons name="heart" size={26} color={color} />,
          tabBarBadge: favoriteCount > 0 ? favoriteCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#FF3B30' }
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: '通知',
          tabBarIcon: ({ color }) => <Ionicons name="notifications" size={28} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: 'red' }
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="coupons" // 必須對應檔名 coupons.tsx
        options={{
          title: '我的優惠券',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="card-giftcard" size={24} color={color} />
          ),
          // 如果你不想在底部 Tab Bar 看到它，可以設定：
          // href: null, 
        }}
      />
    </Tabs>
  );
}

