// app/friends/my-code.tsx
// 顯示自己的好友 QR Code，出示給對方用「掃描好友」畫面掃描（見 plan-friends.md）。
// 好友碼不像會員碼有時效/單次使用限制，性質不同，所以不共用 app/member-code.tsx 的元件。
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { api } from '../../services/api';
import { buildFriendQrValue } from '../../types/friends';

export default function FriendMyCodeScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // 跟 settings.tsx 共用 ['userProfile'] 快取
  const { data: user, isLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => (await api.get('/api/v1/users/me')).data,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>出示此畫面給對方掃描</Text>
      <Text style={styles.subtitle}>對方掃描後會送出好友邀請，需要您確認才會成為好友</Text>

      {isLoading || user?.id == null ? (
        <ActivityIndicator color={colors.tint} />
      ) : (
        <>
          {/* QR Code 需要黑白高對比才能被掃描器辨識，wrapper 固定白底，不隨深色模式切換 */}
          <View style={styles.codeWrapper}>
            <QRCode value={buildFriendQrValue(user.id)} size={220} />
          </View>
          <Text style={styles.userName}>{user.nickname || '未設定暱稱'}</Text>
          <Text style={styles.userId}>會員編號：{user.id}</Text>
        </>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textSubtle, marginTop: 6, marginBottom: 32, textAlign: 'center' },
  codeWrapper: {
    padding: 16, backgroundColor: '#fff', borderRadius: 12, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  userName: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  userId: { fontSize: 13, color: colors.textSubtle, marginTop: 4 },
});
