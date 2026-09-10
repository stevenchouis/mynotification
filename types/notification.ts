// types/notification.ts
// `data` 是後端 NotificationLog 的通用 JSON 欄位，跟實際推播的 data payload 是同一個物件
// （已跟 back-end 確認，2026-09-09）。目前已知會出現的形狀：
// - 收藏商品到貨/降價通知：{ type: 'product_restock' | 'product_price_drop', screen: 'ProductDetail', product_id: number }
// - 優惠券通知（新會員歡迎禮券/生日禮券/管理者手動發券共用，2026-09-11 確認）：
//   { coupon_id: number, screen: 'Coupons' }
// 其他既有通知（一般通知、堂食新訂單）的 data 可能是別的形狀或不存在，讀取前要判斷欄位是否存在。
export interface NotificationData {
    type?: string;
    screen?: string;
    product_id?: number;
    coupon_id?: number;
    [key: string]: unknown;
}

export interface Notification {
    id: number;
    title: string;
    body: string;
    is_read: boolean;
    created_at: string;
    data?: NotificationData | null;
}

// 未來如果有後端回傳的 API 格式也可以定義在這
export interface NotificationResponse {
    data: Notification[];
    total: number;
}