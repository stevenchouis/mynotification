// app/(drawer)/faq.tsx
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: 'login-methods',
    question: '有哪些登入方式？',
    answer: '目前支援三種：Email 帳號密碼、Google 帳號一鍵登入，以及不需要密碼的 Email 連結（Magic Link）登入。三種方式登入後的功能完全相同。',
  },
  {
    id: 'forgot-password',
    question: '忘記密碼怎麼辦？',
    answer: '目前沒有另外的「忘記密碼」流程，建議直接改用「Email 連結登入」，用同一個信箱就能免密碼登入同一個帳號。',
  },
  {
    id: 'no-notification',
    question: '為什麼收不到推播通知？',
    answer: '請確認：1) 是使用實體手機而非模擬器（模擬器無法取得推播 Token）；2) App 的通知權限有開啟；3) 網路連線正常。開啟 App 時系統會自動同步推播 Token 到伺服器。',
  },
  {
    id: 'coupon-redeem',
    question: '優惠券要怎麼使用？',
    answer: '在「我的優惠券」點擊一張尚未使用的優惠券，按「使用」會產生一組 10 分鐘內有效的核銷碼與 QR Code。目前可以在「人工核銷」欄位直接輸入該核銷碼完成核銷（用於測試，模擬未來店員掃碼核銷的情境）。',
  },
  {
    id: 'google-email-conflict',
    question: '用 Google 登入，但這個 Email 之前用密碼註冊過怎麼辦？',
    answer: '系統會自動把 Google 帳號綁定到同一個 Email 的既有帳號上，之後這兩種方式都能登入同一個帳號，不需要另外處理。',
  },
  {
    id: 'magic-link-expiry',
    question: 'Email 連結登入的信件，多久內要點擊？',
    answer: '信件中的連結只在寄出後 15 分鐘內有效，且只能使用一次。如果超過時間或已經點過一次，需要重新在登入畫面索取新的連結。',
  },
];

export default function FaqScreen() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {FAQ_ENTRIES.map((entry) => {
        const isExpanded = expandedId === entry.id;
        return (
          <Pressable
            key={entry.id}
            style={styles.card}
            onPress={() => setExpandedId(isExpanded ? null : entry.id)}
          >
            <View style={styles.questionRow}>
              <Text style={styles.question}>{entry.question}</Text>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.accent} />
            </View>
            {isExpanded && <Text style={styles.answer}>{entry.answer}</Text>}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { padding: 16, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12,
  },
  questionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  question: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, marginRight: 8 },
  answer: { fontSize: 13, color: colors.textMuted, lineHeight: 20, marginTop: 10 },
});
