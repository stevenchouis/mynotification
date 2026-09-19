// services/friends.ts
// 好友功能 API（見 plan-friends.md），跟其他 services 刻意分開、不共用。
import { api } from './api';
import { Friend, FriendRequest, FriendRequestAction } from '../types/friends';

export async function fetchFriends(): Promise<Friend[]> {
  const res = await api.get('/api/v1/friends');
  return res.data;
}

// 別人寄給我、待我確認的邀請
export async function fetchFriendRequests(): Promise<FriendRequest[]> {
  const res = await api.get('/api/v1/friends/requests');
  return res.data;
}

export async function sendFriendRequest(targetUserId: number): Promise<void> {
  await api.post('/api/v1/friends/requests', { target_user_id: targetUserId });
}

export async function respondToFriendRequest(id: number, action: FriendRequestAction): Promise<void> {
  await api.post(`/api/v1/friends/requests/${id}/${action}`);
}

export async function sendGreeting(friendshipId: number, message: string): Promise<void> {
  await api.post(`/api/v1/friends/${friendshipId}/greetings`, { message });
}
