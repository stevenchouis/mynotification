// types/notification.ts
// `data` 是後端 NotificationLog 的通用 JSON 欄位，跟實際推播的 data payload 是同一個物件
// （已跟 back-end 確認，2026-09-09）。目前已知會出現的形狀：
// - 收藏商品到貨/降價通知：{ type: 'product_restock' | 'product_price_drop', screen: 'ProductDetail', product_id: number }
// - 優惠券通知（新會員歡迎禮券/生日禮券/管理者手動發券共用，2026-09-11 確認）：
//   { coupon_id: number, screen: 'Coupons' }
// - 紅利點數通知，screen: 'Points' 共用、依是否帶 store_checkout_id 分流（見 plan-points-expiry-reminder.md）：
//   門市收銀完成 { type: 'store_checkout_completed', screen: 'Points', store_checkout_id: number }
//   點數即將到期提醒 { type: 'points_expiring_soon', screen: 'Points' }（規劃中，待 back-end 實作）
// - 好友推播（見 plan-friends.md），screen: 'Friends' 共用：
//   { type: 'friend_request' | 'friend_request_accepted' | 'friend_greeting', screen: 'Friends', friendship_id: number }
// - 商品分享給好友（規劃中，見 plan-product-share-friends.md），刻意沿用 ProductDetail 既有格式：
//   { type: 'friend_product_share', screen: 'ProductDetail', product_id: number }
// 其他既有通知（一般通知、堂食新訂單）的 data 可能是別的形狀或不存在，讀取前要判斷欄位是否存在。
export interface NotificationData {
    type?: string;
    screen?: string;
    product_id?: number;
    coupon_id?: number;
    friendship_id?: number;
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