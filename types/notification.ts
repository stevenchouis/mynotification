// types/notification.ts

export interface Notification {
    id: number;
    title: string;
    body: string;
    is_read: boolean;
    created_at: string;
}

// 未來如果有後端回傳的 API 格式也可以定義在這
export interface NotificationResponse {
    data: Notification[];
    total: number;
}