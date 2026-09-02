import { create } from 'zustand';

// 1. 只管理全域 UI 狀態，不負責 API 呼叫
interface NotificationState {
  unreadCount: number;
  // 提供一個方法讓外部（例如 TanStack Query 的 onSuccess 或 useEffect）更新計數
  setUnreadCount: (count: number) => void;
  // 如果未來有「即時推播」，可以用這個方法增加計數
  incrementUnreadCount: () => void;
  // 清空狀態（例如登出時使用）
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,

  setUnreadCount: (count) => set({ unreadCount: count }),

  incrementUnreadCount: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),

  reset: () => set({ unreadCount: 0 }),
}));

// import axios from 'axios';
// import { create } from 'zustand';
// import { useAuthStore } from './useAuthStore'; // 確保路徑正確以取得 token

// // 1. 務必加上 export，解決 inbox.tsx 的型別引用錯誤
// export interface Notification {
//     id: number;
//     title: string; // 修正：從 str 改為 string
//     body: string;  // 修正：從 str 改為 string
//     is_read: boolean;
//     created_at: string;
// }

// // 1. 在介面 (Interface) 中新增定義
// interface NotificationState {
//     notifications: Notification[];
//     unreadCount: number;
//     fetchNotifications: () => Promise<void>;
//     markAsRead: (id: number) => Promise<void>;
//     // 在 NotificationState 介面中加入
//     markAllAsRead: () => Promise<void>;
//     deleteNotification: (id: number) => Promise<void>; // 加入這一行
// }

// // 替換為你的後端實際位置
// const API_URL = process.env.EXPO_PUBLIC_API_URL;

// const API_URL_NOTIFICATIONS = `${API_URL}/api/v1/notifications`;
// // const API_URL = 'http://192.168.68.59:8000/api/v1/notifications';

// export const useNotificationStore = create<NotificationState>((set, get) => ({
//     notifications: [],
//     unreadCount: 0,

//     // 抓取通知列表並更新未讀計數
//     fetchNotifications: async () => {
//         try {
//         const token = useAuthStore.getState().userToken;
//         const response = await axios.get(`${API_URL_NOTIFICATIONS}/inbox`, {
//             headers: { Authorization: `Bearer ${token}` }
//         });
//         const data = response.data;
//         set({ 
//             notifications: data, 
//             unreadCount: data.filter((n: Notification) => !n.is_read).length 
//         });
//         } catch (error) {
//         console.error("抓取通知失敗:", error);
//         }
//     },

//     // 標記單筆通知為已讀
//     markAsRead: async (id: number) => {
//         try {
//         const token = useAuthStore.getState().userToken;
//         // 呼叫後端 PUT API
//         await axios.put(`${API_URL_NOTIFICATIONS}/${id}/read`, {}, {
//             headers: { Authorization: `Bearer ${token}` }
//         });

//         // 更新本地狀態：標記已讀並減少計數
//         set((state) => ({
//             notifications: state.notifications.map(n => 
//             n.id === id ? { ...n, is_read: true } : n
//             ),
//             unreadCount: Math.max(0, state.unreadCount - 1)
//         }));
//         } catch (error) {
//         console.error("更新單筆已讀狀態失敗:", error);
//         }
//     },

//     // 標記所有通知為已讀
//     markAllAsRead: async () => {
//         try {
//         const token = useAuthStore.getState().userToken;
//         await axios.put(`${API_URL_NOTIFICATIONS}/read-all`, {}, {
//             headers: { Authorization: `Bearer ${token}` }
//         });

//         // 同步更新本地所有通知為已讀狀態
//         set((state) => ({
//             notifications: state.notifications.map(n => ({ ...n, is_read: true })),
//             unreadCount: 0
//         }));
//         } catch (error) {
//         console.error("更新全部已讀狀態失敗:", error);
//         }
//     },
//     deleteNotification: async (id: number) => {
//         try {
//         // 這裡要對應你的後端 API 路徑
//         // 假設你的 API_URL 是 http://.../api/v1/notifications
//         const response = await axios.delete(`${API_URL_NOTIFICATIONS}/${id}`, {
//             headers: { 
//             Authorization: `Bearer ${useAuthStore.getState().userToken}` 
//             }
//         });

//         if (response.status === 200) {
//             // 更新本地狀態：過濾掉被刪除的那一筆
//             set((state) => ({
//             notifications: state.notifications.filter((n) => n.id !== id),
//             // 如果刪除的是未讀通知，記得減去未讀計數
//             unreadCount: state.notifications.find(n => n.id === id)?.is_read 
//                 ? state.unreadCount 
//                 : Math.max(0, state.unreadCount - 1)
//             }));
//         }
//         } catch (error) {
//         console.error("刪除通知失敗:", error);
//         throw error;
//         }
//     },
// }));