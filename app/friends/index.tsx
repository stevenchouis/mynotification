// app/friends/index.tsx
// 好友列表 + 待確認邀請（見 plan-friends.md）。區段切換 UI 比照 (tabs)/coupons.tsx。
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { fetchFriendRequests, fetchFriends, respondToFriendRequest } from '../../services/friends';
import { useFriendStarStore } from '../../store/useFriendStarStore';
import { Friend, FriendRequest, FriendRequestAction } from '../../types/friends';

type Section = 'friends' | 'requests';

function Avatar({ uri, size = 48 }: { uri: string | null; size?: number }) {
  const colors = useThemeColors();
  const style = { width: size, height: size, borderRadius: size / 2 };
  return uri ? (
    <Image source={{ uri }} style={style} contentFit="cover" />
  ) : (
    <View style={[style, { backgroundColor: colors.tint, justifyContent: 'center', alignItems: 'center' }]}>
      <Ionicons name="person" size={size * 0.5} color={colors.onTint} />
    </View>
  );
}

export default function FriendsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [section, setSection] = useState<Section>('friends');
  const starredIds = useFriendStarStore((state) => state.starredIds);

  const friendsQuery = useQuery<Friend[]>({ queryKey: ['friends'], queryFn: fetchFriends });
  const requestsQuery = useQuery<FriendRequest[]>({ queryKey: ['friend-requests'], queryFn: fetchFriendRequests });

  // 邀請/好友關係是別人在他們的裝置上操作才會改變的（對方掃我的碼、對方接受我的邀請），
  // 全域 5 分鐘 staleTime 下重新進入這個畫面不會重抓，所以每次取得焦點都讓快取失效重抓
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    }, [queryClient])
  );

  // 加星號的好友排最前面，其餘維持後端回傳順序
  const sortedFriends = useMemo(() => {
    const list = friendsQuery.data ?? [];
    return [...list].sort(
      (a, b) => Number(starredIds.includes(b.friendship_id)) - Number(starredIds.includes(a.friendship_id))
    );
  }, [friendsQuery.data, starredIds]);

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: FriendRequestAction }) =>
      respondToFriendRequest(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      Alert.alert('錯誤', (typeof detail === 'string' ? detail : detail?.message) || '操作失敗，請稍後再試');
    },
  });

  const requestCount = requestsQuery.data?.length ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.actionRow}>
        <Pressable style={styles.actionButton} onPress={() => router.push('/friends/my-code')}>
          <Ionicons name="qr-code-outline" size={18} color={colors.onTint} />
          <Text style={styles.actionButtonText}>我的 QR Code</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => router.push('/friends/scan')}>
          <Ionicons name="scan-outline" size={18} color={colors.onTint} />
          <Text style={styles.actionButtonText}>掃描好友</Text>
        </Pressable>
      </View>

      <View style={styles.sectionSwitchRow}>
        <Pressable
          style={[styles.sectionTab, section === 'friends' && styles.sectionTabActive]}
          onPress={() => setSection('friends')}
        >
          <Text style={[styles.sectionTabText, section === 'friends' && styles.sectionTabTextActive]}>
            好友（{friendsQuery.data?.length ?? 0}）
          </Text>
        </Pressable>
        <Pressable
          style={[styles.sectionTab, section === 'requests' && styles.sectionTabActive]}
          onPress={() => setSection('requests')}
        >
          <Text style={[styles.sectionTabText, section === 'requests' && styles.sectionTabTextActive]}>
            待確認邀請（{requestCount}）
          </Text>
        </Pressable>
      </View>

      {section === 'friends' ? (
        <FlatList
          data={sortedFriends}
          keyExtractor={(item) => String(item.friendship_id)}
          refreshing={friendsQuery.isRefetching}
          onRefresh={friendsQuery.refetch}
          ListEmptyComponent={
            friendsQuery.isLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.tint} />
            ) : (
              <Text style={styles.empty}>還沒有好友，掃描對方的 QR Code 來加好友吧</Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: '/friends/[friendshipId]', params: { friendshipId: String(item.friendship_id) } })}
            >
              <Avatar uri={item.avatar_url} />
              <Text style={styles.name} numberOfLines={1}>{item.username}</Text>
              {starredIds.includes(item.friendship_id) && (
                <Ionicons name="star" size={18} color={colors.warning} />
              )}
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={requestsQuery.data ?? []}
          keyExtractor={(item) => String(item.id)}
          refreshing={requestsQuery.isRefetching}
          onRefresh={requestsQuery.refetch}
          ListEmptyComponent={
            requestsQuery.isLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.tint} />
            ) : (
              <Text style={styles.empty}>目前沒有待確認的好友邀請</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Avatar uri={item.avatar_url} />
              <Text style={styles.name} numberOfLines={1}>{item.username}</Text>
              <Pressable
                style={styles.rejectButton}
                disabled={respondMutation.isPending}
                onPress={() => respondMutation.mutate({ id: item.id, action: 'reject' })}
              >
                <Text style={styles.rejectButtonText}>拒絕</Text>
              </Pressable>
              <Pressable
                style={styles.acceptButton}
                disabled={respondMutation.isPending}
                onPress={() => respondMutation.mutate({ id: item.id, action: 'accept' })}
              >
                <Text style={styles.acceptButtonText}>接受</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 15 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actionButton: {
    flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tint,
  },
  actionButtonText: { color: colors.onTint, fontSize: 14, fontWeight: '600' },
  sectionSwitchRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  sectionTab: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center', backgroundColor: colors.surface },
  sectionTabActive: { backgroundColor: colors.tint },
  sectionTabText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  sectionTabTextActive: { color: colors.onTint },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  rejectButton: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  rejectButtonText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  acceptButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.tint },
  acceptButtonText: { fontSize: 13, color: colors.onTint, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 50, color: colors.textSubtle },
});
