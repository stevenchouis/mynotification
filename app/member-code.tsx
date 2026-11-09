// app/member-code.tsx
// 會員條碼/QR Code 畫面：按「產生會員碼」出示限時碼給店員掃描辨識身份，於門市收銀結帳。
// 限時碼產生/倒數/重新產生邏輯完全比照 app/coupon/[id].tsx 的核銷碼設計（10 分鐘效期、單次使用）。
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Barcode from 'react-native-barcode-svg';
import QRCode from 'react-native-qrcode-svg';

import CarrierBarcode from '../components/CarrierBarcode';
import Text from '../components/Text';
import TierBadge from '../components/TierBadge';
import { ThemeColors } from '../constants/Colors';
import { isMemberTier } from '../constants/loyalty';
import { useThemeColors } from '../hooks/useThemeColors';
import { fetchLoyaltyMe, generateMemberCode, LOYALTY_ME_QUERY_KEY } from '../services/loyalty';
import { USER_PROFILE_QUERY_KEY, fetchMyProfile } from '../services/users';
import { MemberCodeResponse } from '../types/loyalty';

type CodeFormat = 'barcode' | 'qrcode';
// 上方切換：會員條碼（原本的畫面）／發票載具（見 plan-einvoice-carrier.md）
type ScreenMode = 'member' | 'carrier';

export default function MemberCodeScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [memberCode, setMemberCode] = useState<MemberCodeResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [format, setFormat] = useState<CodeFormat>('barcode');
  const [mode, setMode] = useState<ScreenMode>('member');
  const { data: profile } = useQuery({ queryKey: USER_PROFILE_QUERY_KEY, queryFn: fetchMyProfile });
  const carrier = profile?.einvoice_carrier ?? null;
  // 會員等級徽章（見 plan-member-tier.md），出示給店員時一眼看出是不是銀卡/金卡
  const { data: loyaltyMe } = useQuery({ queryKey: LOYALTY_ME_QUERY_KEY, queryFn: fetchLoyaltyMe });

  // 每秒更新倒數計時，會員碼過期後提示使用者重新產生
  useEffect(() => {
    if (!memberCode) return;
    const tick = () => {
      const secondsLeft = Math.max(
        0,
        Math.floor((new Date(memberCode.expires_at).getTime() - Date.now()) / 1000)
      );
      setRemainingSeconds(secondsLeft);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [memberCode]);

  const onGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const res = await generateMemberCode();
      setMemberCode(res);
    } catch (error: any) {
      Alert.alert('錯誤', error.response?.data?.detail || '產生會員碼失敗，請稍後再試');
    } finally {
      setIsGenerating(false);
    }
  };

  const isCodeExpired = memberCode !== null && remainingSeconds <= 0;

  const modeTabs = (
    <View style={styles.modeTabRow}>
      {(['member', 'carrier'] as const).map((m) => (
        <Pressable
          key={m}
          style={[styles.modeTab, mode === m && styles.modeTabActive]}
          onPress={() => setMode(m)}
        >
          <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
            {m === 'member' ? '會員條碼' : '發票載具'}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  if (mode === 'carrier') {
    return (
      <View style={styles.container}>
        {modeTabs}
        {carrier ? (
          <>
            <Text style={styles.title}>出示給店員掃描發票載具</Text>
            <Text style={styles.subtitle}>發票會存到你的手機條碼載具</Text>
            <CarrierBarcode carrier={carrier} />
          </>
        ) : (
          <>
            <Text style={styles.title}>還沒有設定發票載具</Text>
            <Text style={styles.subtitle}>設定手機條碼後，結帳時可以在這裡出示</Text>
            <Pressable style={styles.button} onPress={() => router.push('/einvoice-carrier')}>
              <Text style={styles.buttonText}>前往設定</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {modeTabs}
      {isMemberTier(loyaltyMe?.tier) && (
        <View style={styles.tierBadgeRow}>
          <TierBadge tier={loyaltyMe.tier} />
        </View>
      )}
      <Text style={styles.title}>出示此畫面給店員掃描</Text>
      <Text style={styles.subtitle}>店員掃描後即可辨識您的會員身份並完成結帳</Text>

      {!memberCode || isCodeExpired ? (
        <>
          {isCodeExpired && <Text style={styles.expiredText}>會員碼已過期，請重新產生</Text>}
          <Pressable style={styles.button} onPress={onGenerateCode} disabled={isGenerating}>
            {isGenerating ? (
              <ActivityIndicator color={colors.onTint} />
            ) : (
              <Text style={styles.buttonText}>{memberCode ? '重新產生會員碼' : '產生會員碼'}</Text>
            )}
          </Pressable>
        </>
      ) : (
        <View style={styles.codeSection}>
          <View style={styles.formatTabRow}>
            <Pressable style={styles.formatTab} onPress={() => setFormat('barcode')}>
              <Text style={[styles.formatTabText, format === 'barcode' && styles.formatTabTextActive]}>
                條碼
              </Text>
              {format === 'barcode' && <View style={styles.formatTabUnderline} />}
            </Pressable>
            <Pressable style={styles.formatTab} onPress={() => setFormat('qrcode')}>
              <Text style={[styles.formatTabText, format === 'qrcode' && styles.formatTabTextActive]}>
                QR Code
              </Text>
              {format === 'qrcode' && <View style={styles.formatTabUnderline} />}
            </Pressable>
          </View>

          {/* 條碼/QR Code 需要黑白高對比才能被掃描器辨識，wrapper 固定白底，不隨深色模式切換 */}
          <View style={styles.codeWrapper}>
            {format === 'barcode' ? (
              // react-native-barcode-svg 的 Barcode 是函式元件、靠 Barcode.defaultProps 給預設值，
              // 但 RN 0.81 + React 19 已經不支援函式元件的 defaultProps（跟 components/Text.tsx
              // 套用全域字型時遇到的問題同一個成因，見 CLAUDE.md），沒明確傳的 prop 會是 undefined。
              // 沒傳 singleBarWidth 時，套件內部拿 undefined 去乘會算出 NaN 寬度，產生無效的 SVG
              // path/viewBox，在 Android 上直接讓原生 react-native-svg 拋例外整包當掉——這裡所有
              // 會被套件當預設值用的 prop 都要明確傳值，不能依賴它的 defaultProps。
              <Barcode
                value={memberCode.code}
                format="CODE128"
                height={100}
                maxWidth={260}
                singleBarWidth={2}
                lineColor="#000000"
                backgroundColor="#ffffff"
              />
            ) : (
              <QRCode value={memberCode.code} size={200} />
            )}
          </View>
          <Text style={styles.codeText}>{memberCode.code}</Text>
          <Text style={styles.countdownText}>{remainingSeconds} 秒後過期</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center', alignItems: 'center' },
  tierBadgeRow: { alignItems: 'center', marginBottom: 12 },
  // 上方「會員條碼／發票載具」切換，固定在畫面頂端，不跟著內容置中
  modeTabRow: {
    position: 'absolute', top: 16, left: 24, right: 24, flexDirection: 'row',
    backgroundColor: colors.surface, borderRadius: 12, padding: 4,
  },
  modeTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  modeTabActive: { backgroundColor: colors.tint },
  modeTabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  modeTabTextActive: { color: colors.onTint },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textSubtle, marginTop: 6, marginBottom: 32, textAlign: 'center' },
  codeSection: { width: '100%', alignItems: 'center' },
  formatTabRow: { flexDirection: 'row', gap: 32, marginBottom: 20 },
  formatTab: { alignItems: 'center', paddingBottom: 4 },
  formatTabText: { fontSize: 14, color: colors.textSubtle, fontWeight: '600' },
  formatTabTextActive: { color: colors.text },
  formatTabUnderline: { marginTop: 6, height: 2, width: '100%', backgroundColor: colors.accent, borderRadius: 1 },
  codeWrapper: {
    padding: 16, backgroundColor: '#fff', borderRadius: 12, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 16,
    justifyContent: 'center', alignItems: 'center', minHeight: 132,
  },
  codeText: { fontSize: 28, fontWeight: 'bold', letterSpacing: 4, color: colors.text },
  countdownText: { fontSize: 13, color: colors.textSubtle, marginTop: 4 },
  expiredText: { fontSize: 15, color: colors.danger, marginBottom: 16, textAlign: 'center' },
  button: {
    backgroundColor: colors.tint, paddingVertical: 16, paddingHorizontal: 40,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 200
  },
  buttonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },
});
