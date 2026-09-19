// types/friends.ts
// 好友功能（見 plan-friends.md）。契約已跟 back-end 對齊（2026-09-19，後端文件 docs/friends.md）。
// 注意：username 目前是後端暫代值（email 前綴遮罩如 `st***`，純 LINE 帳號是 `用戶{id}`），
// User 還沒有暱稱欄位，之後新增暱稱時後端只改一個函式、回應欄位不變。

// 好友列表項目：對象一律是「對方」的資料，friendship_id 是這段好友關係本身的 id
export interface Friend {
    friendship_id: number;
    user_id: number;
    username: string;
    avatar_url: string | null;
    // 成為好友的時間（back-end 2026-09-19 確認多回傳的欄位）
    since: string;
}

// 別人寄給我、待我確認的好友邀請，id 同樣是 friendship_id
export interface FriendRequest {
    id: number;
    requester_id: number;
    username: string;
    avatar_url: string | null;
    created_at: string;
}

export type FriendRequestAction = 'accept' | 'reject';

// 快速訊息是前端定義的固定選項，後端只負責原樣存起來/推播、不驗證內容，
// 刻意不開放自由輸入文字（避免變成聊天室／內容審核問題）
export const QUICK_MESSAGES = ['讚讚！', '謝謝！', '加油！', '太厲害了！'] as const;

// 好友 QR Code 內容：不用純 user.id，因為會員碼/核銷碼也是純數字 QR，掃錯碼時
// 純數字會被誤當成 user_id 送出邀請，所以帶 deep link 前綴，掃描端只接受這個格式
const FRIEND_QR_PREFIX = 'mynotification://friends/add?user_id=';

export function buildFriendQrValue(userId: number): string {
    return `${FRIEND_QR_PREFIX}${userId}`;
}

// 不是好友 QR Code 格式回傳 null
export function parseFriendQrValue(value: string): number | null {
    if (!value.startsWith(FRIEND_QR_PREFIX)) return null;
    const id = Number(value.slice(FRIEND_QR_PREFIX.length));
    return Number.isInteger(id) && id > 0 ? id : null;
}
