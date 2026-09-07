// app/coupon/[id].tsx
// 優惠券詳情頁：按「使用」產生限時核銷碼，顯示 QR Code 給店員掃描，或用「分享核銷連結」
// 傳給店員手動開啟核銷（掃描失敗時的備援）。原本這裡還有一個「人工核銷」輸入框讓顧客自己
// 呼叫 POST /coupons/redeem（模擬還沒有店員 App 之前的核銷動作），2026-09-06 back-end 把
// 這支端點的授權收緊成需要 role=staff，顧客自己的 JWT 呼叫會直接 403，且 staff-scanner
// 已經正式上線、不再需要這個過渡方案，所以拿掉了。
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, Share, StyleSheet, View
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { api } from '../../services/api';
import { Coupon, RedeemCodeResponse } from '../../types';

export default function CouponDetailScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();

  // 沿用 coupons.tsx 的 ['myCoupons'] 快取，避免重複打 API；找不到快取時會自動 refetch
  const { data: coupons, isLoading: isCouponLoading } = useQuery<Coupon[]>({
    queryKey: ['myCoupons'],
    queryFn: async () => {
      const res = await api.get('/api/v1/coupons/me');
      return res.data;
    },
  });
  const coupon = coupons?.find((c) => c.id === Number(id));
  const isExpired = coupon ? new Date(coupon.expired_at).getTime() < Date.now() : false;
  const isUnusable = coupon ? coupon.is_used || isExpired : false;

  const [redeemCode, setRedeemCode] = useState<RedeemCodeResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // 每秒更新倒數計時，核銷碼過期後提示使用者重新產生
  useEffect(() => {
    if (!redeemCode) return;
    const tick = () => {
      const secondsLeft = Math.max(
        0,
        Math.floor((new Date(redeemCode.expires_at).getTime() - Date.now()) / 1000)
      );
      setRemainingSeconds(secondsLeft);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [redeemCode]);

  const onGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const res = await api.post<RedeemCodeResponse>(`/api/v1/coupons/${id}/redeem-code`);
      setRedeemCode(res.data);
    } catch (error: any) {
      Alert.alert('錯誤', error.response?.data?.detail || '產生核銷碼失敗，請稍後再試');
    } finally {
      setIsGenerating(false);
    }
  };

  const isCodeExpired = redeemCode !== null && remainingSeconds <= 0;

  // QR 掃描失敗（光線不佳、鏡頭故障）時的備援：把核銷碼組成 staff-scanner 的 deep link 分享出去，
  // 讓店員在自己手機上點開連結直接進核銷畫面，不需要相機掃碼。scheme/path 是 staff-scanner 那邊
  // 既有的格式（已跟 staff session 確認相容），這裡只能組字串代入 code，不能自行更動格式。
  const onShareCode = async () => {
    if (!redeemCode) return;
    try {
      await Share.share({
        message: `優惠券核銷碼：${redeemCode.code}\n請店員點擊以下連結完成核銷：\nstaffscanner://redeem?code=${redeemCode.code}`,
      });
    } catch {
      Alert.alert('錯誤', '分享失敗，請稍後再試');
    }
  };

  if (isCouponLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!coupon) {
    return (
      <View style={styles.container}>
        <Text style={styles.expiredText}>找不到這張優惠券</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>返回</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.couponInfo}>
        <Text style={styles.couponTitle}>{coupon.title}</Text>
        <Text style={styles.couponAmount}>${coupon.discount_amount}</Text>
        <Text style={styles.couponExpiry}>
          有效期至：{new Date(coupon.expired_at).toLocaleDateString('zh-TW')}
        </Text>
      </View>

      {isUnusable ? (
        <Text style={styles.expiredText}>
          {coupon.is_used ? '此優惠券已使用過，無法再次核銷' : '此優惠券已過期，無法使用'}
        </Text>
      ) : !redeemCode || isCodeExpired ? (
        <>
          {isCodeExpired && <Text style={styles.expiredText}>核銷碼已過期，請重新產生</Text>}
          <Pressable style={styles.button} onPress={onGenerateCode} disabled={isGenerating}>
            {isGenerating ? (
              <ActivityIndicator color={colors.onTint} />
            ) : (
              <Text style={styles.buttonText}>{redeemCode ? '重新產生核銷碼' : '使用'}</Text>
            )}
          </Pressable>
        </>
      ) : (
        <View style={styles.codeSection}>
          <View style={styles.qrWrapper}>
            <QRCode value={redeemCode.code} size={200} />
          </View>
          <Text style={styles.codeText}>{redeemCode.code}</Text>
          <Text style={styles.countdownText}>{remainingSeconds} 秒後過期</Text>

          <Pressable style={styles.shareButton} onPress={onShareCode}>
            <Text style={styles.shareButtonText}>分享核銷連結給店員</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center', alignItems: 'center' },
  couponInfo: { alignItems: 'center', marginBottom: 32 },
  couponTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  couponAmount: { fontSize: 32, fontWeight: '900', color: colors.danger, marginTop: 6 },
  couponExpiry: { fontSize: 13, color: colors.textSubtle, marginTop: 6 },
  codeSection: { width: '100%', alignItems: 'center' },
  // QR Code 需要黑白高對比才能被掃描器辨識，固定白底，不隨深色模式切換
  qrWrapper: { padding: 16, backgroundColor: '#fff', borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 16 },
  codeText: { fontSize: 28, fontWeight: 'bold', letterSpacing: 4, color: colors.text },
  countdownText: { fontSize: 13, color: colors.textSubtle, marginTop: 4 },
  shareButton: {
    marginTop: 16, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 10, borderWidth: 1, borderColor: colors.tint,
  },
  shareButtonText: { color: colors.tint, fontSize: 14, fontWeight: '600' },
  expiredText: { fontSize: 15, color: colors.danger, marginBottom: 16, textAlign: 'center' },
  button: {
    backgroundColor: colors.tint, paddingVertical: 16, paddingHorizontal: 40,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 200
  },
  buttonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },
});
