// app/dine-in/table.tsx
// 堂食點餐流程第一步：輸入桌號，或由桌上 QR Code 掃碼直接帶入桌號跳過這一步。
// 桌牌 QR Code 內容是 mynotification://dine-in/table?table=A3 這種 deep link——因為
// app.json 的 scheme 是 mynotification，Expo Router 會自動把這個 URL 導到這支畫面，
// 不需要額外的原生設定。手機內建的相機/QR 掃描器掃到後，作業系統會直接跳出「用
// mynotification 開啟」的提示（或已安裝時直接開啟），不需要另外裝掃碼 App。
// 這支畫面在 app/_layout.tsx 裡是 Stack.Protected（需要登入）的畫面，如果顧客掃碼當下
// 還沒登入，會先卡在登入畫面、桌號參數會遺失，需要重新掃碼——這是跟現有其他需要登入的
// deep link（例如優惠券詳情頁）一樣的既有限制，沒有另外做「登入後自動導回」的機制。
// 沒有帶 table 參數時（手動從商店分頁點「到店點餐」進來），每次掛載都清空
// useDineInOrderStore，確保每次進點餐流程都是全新狀態，不會殘留上一次（甚至中途放棄的
// 上一次）的桌號/品項。
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useDineInOrderStore } from '../../store/useDineInOrderStore';

export default function DineInTableScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { table: tableFromQr } = useLocalSearchParams<{ table?: string }>();

  const clear = useDineInOrderStore((state) => state.clear);
  const setTableNumber = useDineInOrderStore((state) => state.setTableNumber);
  const [input, setInput] = useState('');

  useEffect(() => {
    const trimmed = tableFromQr?.trim();
    if (trimmed) {
      setTableNumber(trimmed);
      router.replace('/dine-in/menu');
      return;
    }
    clear();
  }, [tableFromQr, clear, setTableNumber, router]);

  const onNext = () => {
    const trimmed = input.trim();
    if (trimmed.length === 0) return;
    setTableNumber(trimmed);
    router.push('/dine-in/menu');
  };

  // 有帶 QR Code 桌號參數時，畫面只會短暫顯示這個載入態，上面的 useEffect 會立刻導去菜單，
  // 不要讓使用者看到一閃而過的手動輸入表單
  if (tableFromQr?.trim()) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={styles.subtitle}>掃碼成功，正在為您帶入桌號 {tableFromQr.trim()}...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>請輸入您的桌號</Text>
      <Text style={styles.subtitle}>店員將依桌號為您出餐</Text>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder="例如：A3"
        placeholderTextColor={colors.textSubtle}
        autoFocus
      />
      <Pressable
        style={[styles.button, input.trim().length === 0 && styles.buttonDisabled]}
        onPress={onNext}
        disabled={input.trim().length === 0}
      >
        <Text style={styles.buttonText}>下一步：瀏覽菜單</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textSubtle, textAlign: 'center', marginTop: 8, marginBottom: 32 },
  input: {
    height: 55, backgroundColor: colors.surfaceAlt, borderRadius: 12,
    paddingHorizontal: 16, fontSize: 20, textAlign: 'center', letterSpacing: 2,
    color: colors.text, marginBottom: 24,
  },
  button: {
    backgroundColor: colors.tint, paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },
});
