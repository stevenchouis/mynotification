// components/FriendAvatar.tsx
// 好友頭貼顯示，抽成共用元件（原本只在 app/friends/index.tsx 用，2026-10-12 新增
// FriendPickerSheet 也要用同一套樣式，抽出來避免重複）。沒有頭貼時顯示人像圖示的 tint 色底。
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { useThemeColors } from '../hooks/useThemeColors';

export default function FriendAvatar({ uri, size = 48 }: { uri: string | null; size?: number }) {
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
