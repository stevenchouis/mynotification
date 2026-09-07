// app/(drawer)/about.tsx
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';

export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons name="notifications" size={40} color={colors.onTint} />
      </View>

      <Text style={styles.appName}>mynotification</Text>
      <Text style={styles.version}>版本 {version}</Text>

      <Text style={styles.paragraph}>
        mynotification 是一款整合推播通知與優惠券核銷的行動應用程式。使用者可以透過 Email 帳密、Google
        帳號或 Email 連結（Magic Link）登入，即時接收系統推播的通知，並在 App 內查看、使用手上的優惠券。
      </Text>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>主要功能</Text>
      <Text style={styles.listItem}>・多種登入方式（帳密 / Google / Email 連結）</Text>
      <Text style={styles.listItem}>・即時推播通知與未讀提醒</Text>
      <Text style={styles.listItem}>・優惠券管理與 QR Code 核銷</Text>
      <Text style={styles.listItem}>・個人資料與頭像管理</Text>

      <View style={styles.divider} />

      <Text style={styles.footer}>© 2026 mynotification</Text>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { padding: 24, alignItems: 'center', backgroundColor: colors.background },
  iconWrapper: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: colors.tint,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16
  },
  appName: { fontSize: 22, fontWeight: '700', color: colors.text },
  version: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 20 },
  paragraph: { fontSize: 14, color: colors.textMuted, lineHeight: 22, textAlign: 'left', alignSelf: 'stretch' },
  divider: { height: 1, backgroundColor: colors.border, alignSelf: 'stretch', marginVertical: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, alignSelf: 'flex-start', marginBottom: 10 },
  listItem: { fontSize: 14, color: colors.textMuted, alignSelf: 'flex-start', marginBottom: 6, lineHeight: 20 },
  footer: { fontSize: 12, color: colors.textSubtle },
});
