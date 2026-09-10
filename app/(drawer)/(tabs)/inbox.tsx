import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import Text from '../../../components/Text';
import { ThemeColors } from '../../../constants/Colors';
import { useThemeColors } from '../../../hooks/useThemeColors';
// 匯入型別與 Store
import { useAuthStore } from '../../../store/useAuthStore';
import { useNotificationStore } from '../../../store/useNotificationStore';
import { Notification } from '../../../types/notification';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const NOTIFICATIONS_API = `${API_URL}/api/v1/notifications`;

export default function InboxScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const token = useAuthStore(state => state.userToken);
  const setUnreadCount = useNotificationStore(state => state.setUnreadCount);

  // 建立 Axios 實例
  const api = axios.create({
    headers: { Authorization: `Bearer ${token}` }
  });

  // 1. 獲取通知列表
  const { 
    data: notifications = [], 
    isLoading, 
    isRefetching, 
    refetch 
  } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get(`${NOTIFICATIONS_API}/inbox`);
      return response.data;
    },
    enabled: !!token,
  });

  // 2. 同步未讀數到 Zustand (供 Tab Bar Badge 使用)
  useEffect(() => {
    const count = notifications.filter(n => !n.is_read).length;
    setUnreadCount(count);
  }, [notifications, setUnreadCount]);

  // 3. 標記已讀 Mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => api.put(`${NOTIFICATIONS_API}/${id}/read`),
    onSuccess: () => {
      // 讓快取失效並重新抓取，確保資料同步
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  // 4. 刪除通知 Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`${NOTIFICATIONS_API}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  // 5. 全部標記已讀 Mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => api.put(`${NOTIFICATIONS_API}/read-all`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const renderRightActions = (id: number) => (
    <RectButton
      style={styles.deleteButton}
      onPress={() => {
        Alert.alert("刪除通知", "確定要刪除這條通知嗎？", [
          { text: "取消", style: "cancel" },
          { text: "刪除", style: "destructive", onPress: () => deleteMutation.mutate(id) }
        ]);
      }}
    >
      <Text style={styles.deleteText}>刪除</Text>
    </RectButton>
  );

  const renderItem = ({ item }: { item: Notification }) => (
    <Swipeable renderRightActions={() => renderRightActions(item.id)}>
      <Pressable
        onPress={() => {
          if (!item.is_read) markAsReadMutation.mutate(item.id);
          if (item.data?.screen === 'ProductDetail' && item.data.product_id) {
            router.push(`/shop/${item.data.product_id}`);
          } else if (item.data?.screen === 'Coupons' && item.data.coupon_id) {
            queryClient.invalidateQueries({ queryKey: ['myCoupons'] });
            router.push(`/coupon/${item.data.coupon_id}`);
          }
        }}
        style={({ pressed }) => [
          styles.itemContainer,
          { backgroundColor: item.is_read ? colors.background : colors.highlight },
          pressed && { opacity: 0.7 }
        ]}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { fontWeight: item.is_read ? '400' : 'bold' }]}>
              {item.title}
            </Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.time}>{new Date(item.created_at).toLocaleString('zh-TW')}</Text>
        </View>
      </Pressable>
    </Swipeable>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.unreadText}>
          {unreadCount > 0 ? `有 ${unreadCount} 則未讀通知` : '暫無未讀通知'}
        </Text>
        {unreadCount > 0 && (
          <Pressable 
            onPress={() => markAllReadMutation.mutate()} 
            style={({ pressed }) => [styles.readAllButton, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.readAllText}>全部標記為已讀</Text>
          </Pressable>
        )}
      </View>

      <FlashList<Notification>
        data={notifications}
        renderItem={renderItem}
        onRefresh={refetch}
        refreshing={isRefetching}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>目前沒有通知</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  unreadText: { fontSize: 14, color: colors.textMuted },
  readAllButton: { paddingVertical: 4, paddingHorizontal: 8 },
  readAllText: { fontSize: 14, color: colors.tint, fontWeight: '600' },
  itemContainer: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row' },
  content: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 16, color: colors.text, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.tint, marginLeft: 8 },
  body: { fontSize: 14, color: colors.textMuted, marginBottom: 8 },
  time: { fontSize: 12, color: colors.textSubtle },
  deleteButton: { backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  deleteText: { color: colors.white, fontWeight: '600' },
  emptyContainer: { paddingTop: 100, alignItems: 'center' },
  emptyText: { color: colors.textSubtle, fontSize: 16 },
});



// import { FlashList } from "@shopify/flash-list";
// import React, { useEffect } from 'react';
// import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
// // 修改為：
// import { RectButton } from 'react-native-gesture-handler';
// import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable'; // 使用 Reanimated 版本
// // 修正重點：import 只要拿 Notification 型別和 useNotificationStore 鉤子
// import { Notification, useNotificationStore } from '../../store/useNotificationStore';

// export default function InboxScreen() {
//   // 修正重點：unreadCount 是從這裡「解構」出來的，不是 import 進來的
//   const { 
//     notifications, 
//     unreadCount, 
//     fetchNotifications, 
//     markAsRead, 
//     markAllAsRead, 
//     deleteNotification 
//   } = useNotificationStore();

//   useEffect(() => {
//     fetchNotifications();
//   }, []);

//   // 渲染左滑後的右側按鈕
//   const renderRightActions = (id: number) => {
//     return (
//       <RectButton
//         style={styles.deleteButton}
//         onPress={() => {
//           Alert.alert("刪除通知", "確定要刪除這條通知嗎？", [
//             { text: "取消", style: "cancel" },
//             { text: "刪除", style: "destructive", onPress: () => deleteNotification(id) }
//           ]);
//         }}
//       >
//         <Text style={styles.deleteText}>刪除</Text>
//       </RectButton>
//     );
//   };

//   const renderItem = ({ item }: { item: Notification }) => (
//     <Swipeable 
//       renderRightActions={() => renderRightActions(item.id)}
//       friction={2} // 阻力
//       rightThreshold={40} // 觸發滑開的閾值
//     >
//       <Pressable
//         onPress={() => markAsRead(item.id)}
//         style={({ pressed }) => [
//           styles.itemContainer,
//           { backgroundColor: item.is_read ? '#ffffff' : '#f0f8ff' }, // 未讀顯示淺藍色
//           pressed && { opacity: 0.7 }
//         ]}
//       >
//         <View style={styles.content}>
//           <View style={styles.header}>
//             <Text style={[styles.title, { fontWeight: item.is_read ? '400' : 'bold' }]}>
//               {item.title}
//             </Text>
//             {!item.is_read && <View style={styles.unreadDot} />}
//           </View>
//           <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
//           <Text style={styles.time}>
//             {new Date(item.created_at).toLocaleString('zh-TW')}
//           </Text>
//         </View>
//       </Pressable>
//     </Swipeable>
//   );

//   return (
//     <View style={styles.container}>
//       {/* 新增：頂部工具列 */}
//       <View style={styles.toolbar}>
//         <Text style={styles.unreadText}>
//           {unreadCount > 0 ? `有 ${unreadCount} 則未讀通知` : '暫無未讀通知'}
//         </Text>
//         {unreadCount > 0 && (
//           <Pressable onPress={markAllAsRead} style={styles.readAllButton}>
//             <Text style={styles.readAllText}>全部標記為已讀</Text>
//           </Pressable>
//         )}
//       </View>
//       <FlashList<Notification>
//         data={notifications}
//         renderItem={renderItem}
//         estimatedItemSize={100} // 解決 ts(2322) 錯誤
//         onRefresh={fetchNotifications}
//         refreshing={false}
//         keyExtractor={(item) => item.id.toString()}
//         ListEmptyComponent={
//           <View style={styles.emptyContainer}>
//             <Text style={styles.emptyText}>目前沒有通知</Text>
//           </View>
//         }
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#f5f5f5',
//   },
//   // 新增工具列樣式
//   toolbar: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingHorizontal: 16,
//     paddingVertical: 12,
//     backgroundColor: '#fff',
//     borderBottomWidth: 1,
//     borderBottomColor: '#eee',
//   },
//   unreadText: {
//     fontSize: 14,
//     color: '#666',
//   },
//   readAllButton: {
//     paddingVertical: 4,
//     paddingHorizontal: 8,
//   },
//   readAllText: {
//     fontSize: 14,
//     color: '#007AFF', // 使用系統藍色
//     fontWeight: '600',
//   },
//   itemContainer: {
//     padding: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: '#eee',
//     flexDirection: 'row',
//   },
//   content: {
//     flex: 1,
//   },
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 4,
//   },
//   title: {
//     fontSize: 16,
//     color: '#333',
//     flex: 1,
//   },
//   unreadDot: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     backgroundColor: '#007AFF',
//     marginLeft: 8,
//   },
//   body: {
//     fontSize: 14,
//     color: '#666',
//     marginBottom: 8,
//   },
//   time: {
//     fontSize: 12,
//     color: '#999',
//   },
//   deleteButton: {
//     backgroundColor: '#ff3b30',
//     justifyContent: 'center',
//     alignItems: 'center',
//     width: 80,
//     height: '100%',
//   },
//   deleteText: {
//     color: 'white',
//     fontWeight: '600',
//   },
//   emptyContainer: {
//     paddingTop: 100,
//     alignItems: 'center',
//   },
//   emptyText: {
//     color: '#999',
//     fontSize: 16,
//   },

// });