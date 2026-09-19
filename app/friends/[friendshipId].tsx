// app/friends/[friendshipId].tsx
// 好友卡片詳情：大頭貼/名稱、加星號、快速訊息按鈕列（見 plan-friends.md）。
// 後端沒有單筆查詢端點，從 ['friends'] 列表快取裡依 friendshipId 找出這位好友。
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { fetchFriends, sendGreeting } from '../../services/friends';
import { useFriendStarStore } from '../../store/useFriendStarStore';
import { Friend, QUICK_MESSAGES } from '../../types/friends';

export default function FriendDetailScreen() {
  const { friendshipId } = useLocalSearchParams<{ friendshipId: string }>();
  const id = Number(friendshipId);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isStarred = useFriendStarStore((state) => state.starredIds.includes(id));
  const toggleStar = useFriendStarStore((state) => state.toggleStar);

  const { data: friends, isLoading } = useQuery<Friend[]>({ queryKey: ['friends'], queryFn: fetchFriends });
  const friend = friends?.find((f) => f.friendship_id === id);

  const greetingMutation = useMutation({
    mutationFn: (message: string) => sendGreeting(id, message),
    onSuccess: (_data, message) => {
      Toast.show({ type: 'success', text1: `已傳送「${message}」` });
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      Alert.alert('錯誤', (typeof detail === 'string' ? detail : detail?.message) || '傳送失敗，請稍後再試');
    },
  });

  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.tint} />;
  }
  if (!friend) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>找不到這位好友</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Pressable style={styles.starButton} onPress={() => toggleStar(id)} hitSlop={8}>
          <Ionicons
            name={isStarred ? 'star' : 'star-outline'}
            size={26}
            color={isStarred ? colors.warning : colors.textSubtle}
          />
        </Pressable>
        {friend.avatar_url ? (
          <Image source={{ uri: friend.avatar_url }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={48} color={colors.onTint} />
          </View>
        )}
        <Text style={styles.name}>{friend.username}</Text>
        <Text style={styles.userId}>會員編號：{friend.user_id}</Text>
      </View>

      <Text style={styles.sectionLabel}>傳送快速訊息</Text>
      <View style={styles.messageRow}>
        {QUICK_MESSAGES.map((message) => (
          <Pressable
            key={message}
            style={({ pressed }) => [styles.messageButton, pressed && { opacity: 0.85 }]}
            disabled={greetingMutation.isPending}
            onPress={() => greetingMutation.mutate(message)}
          >
            <Text style={styles.messageButtonText}>{message}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 15 },
  empty: { textAlign: 'center', marginTop: 50, color: colors.textSubtle },
  card: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4,
  },
  starButton: { position: 'absolute', top: 14, right: 14 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  avatarPlaceholder: { backgroundColor: colors.tint, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  userId: { fontSize: 13, color: colors.textSubtle, marginTop: 4 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginTop: 24, marginBottom: 12 },
  messageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  messageButton: {
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24, backgroundColor: colors.tint,
  },
  messageButtonText: { color: colors.onTint, fontSize: 15, fontWeight: '600' },
});
