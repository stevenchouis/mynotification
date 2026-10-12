// components/FriendPickerSheet.tsx
// 底部彈出的好友選擇清單，目前唯一的用途是「商品分享給好友」（見 plan-product-share-friends.md），
// 選好友的 UI 刻意獨立成元件、不耦合商品邏輯，方便之後有其他「選一位好友」情境時共用。
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import FriendAvatar from './FriendAvatar';
import Text from './Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { fetchFriends } from '../services/friends';
import { Friend } from '../types/friends';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectFriend: (friend: Friend) => void;
  // 選完之後呼叫端還在送出 API（例如分享中），選單要鎖住避免重複點擊
  isSubmitting?: boolean;
  title?: string;
}

export default function FriendPickerSheet({ visible, onClose, onSelectFriend, isSubmitting, title = '選擇好友' }: Props) {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // 複用 ['friends'] 快取（跟好友頁同一份資料），彈窗開啟時才需要抓，關閉時不用保持訂閱
  const { data: friends, isLoading } = useQuery<Friend[]>({
    queryKey: ['friends'],
    queryFn: fetchFriends,
    enabled: visible,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.cancelText}>取消</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginVertical: 32 }} color={colors.tint} />
        ) : (
          <FlatList
            data={friends ?? []}
            keyExtractor={(item) => String(item.friendship_id)}
            style={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>還沒有好友</Text>
                <Pressable
                  onPress={() => {
                    onClose();
                    router.push('/friends');
                  }}
                >
                  <Text style={styles.emptyLink}>去加好友</Text>
                </Pressable>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                disabled={isSubmitting}
                onPress={() => onSelectFriend(item)}
              >
                <FriendAvatar uri={item.avatar_url} size={40} />
                <Text style={styles.name} numberOfLines={1}>{item.username}</Text>
                {isSubmitting && <ActivityIndicator size="small" color={colors.tint} />}
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 24, maxHeight: '70%',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  cancelText: { fontSize: 15, color: colors.textMuted },
  list: { paddingHorizontal: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 8, paddingVertical: 12,
  },
  name: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
  emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  empty: { color: colors.textSubtle, fontSize: 14 },
  emptyLink: { color: colors.tint, fontSize: 14, fontWeight: '600' },
});
