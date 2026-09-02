// app/coupon/[id].tsx
// 優惠券詳情頁：按「使用」產生限時核銷碼並顯示 QR Code。
// 目前還沒有店員核銷 App，先提供「人工核銷」輸入框讓使用者直接輸入核銷碼完成核銷（測試用，模擬未來店員掃碼後的動作）。
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import Text from '../../components/Text';
import { api } from '../../services/api';
import { Coupon, RedeemCodeResponse } from '../../types';

export default function CouponDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
  const [manualCode, setManualCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
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
      setManualCode('');
    } catch (error: any) {
      Alert.alert('錯誤', error.response?.data?.detail || '產生核銷碼失敗，請稍後再試');
    } finally {
      setIsGenerating(false);
    }
  };

  const onManualRedeem = async () => {
    if (manualCode.trim().length !== 6) {
      Alert.alert('提示', '請輸入 6 位數核銷碼');
      return;
    }
    setIsRedeeming(true);
    try {
      await api.post('/api/v1/coupons/redeem', { code: manualCode.trim() });
      await queryClient.invalidateQueries({ queryKey: ['myCoupons'] });
      Alert.alert('核銷成功', '優惠券已使用', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('錯誤', error.response?.data?.detail || '核銷失敗，請確認核銷碼是否正確或已過期');
    } finally {
      setIsRedeeming(false);
    }
  };

  const isCodeExpired = redeemCode !== null && remainingSeconds <= 0;

  if (isCouponLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
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
              <ActivityIndicator color="#fff" />
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

          <View style={styles.divider} />

          <Text style={styles.label}>人工核銷（測試用，模擬店員掃碼）</Text>
          <TextInput
            style={styles.input}
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="輸入 6 位數核銷碼"
            keyboardType="number-pad"
            maxLength={6}
          />
          <Pressable style={styles.button} onPress={onManualRedeem} disabled={isRedeeming}>
            {isRedeeming ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>OK，核銷</Text>}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center', alignItems: 'center' },
  couponInfo: { alignItems: 'center', marginBottom: 32 },
  couponTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  couponAmount: { fontSize: 32, fontWeight: '900', color: '#FF3B30', marginTop: 6 },
  couponExpiry: { fontSize: 13, color: '#999', marginTop: 6 },
  codeSection: { width: '100%', alignItems: 'center' },
  qrWrapper: { padding: 16, backgroundColor: '#fff', borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 16 },
  codeText: { fontSize: 28, fontWeight: 'bold', letterSpacing: 4, color: '#1a1a1a' },
  countdownText: { fontSize: 13, color: '#999', marginTop: 4 },
  expiredText: { fontSize: 15, color: '#FF3B30', marginBottom: 16, textAlign: 'center' },
  divider: { width: '100%', height: 1, backgroundColor: '#eee', marginVertical: 24 },
  label: { fontSize: 13, color: '#666', marginBottom: 12, textAlign: 'center' },
  input: {
    width: '100%', height: 55, backgroundColor: '#F2F2F7', borderRadius: 12,
    paddingHorizontal: 16, fontSize: 20, textAlign: 'center', letterSpacing: 6, marginBottom: 16
  },
  button: {
    backgroundColor: '#007AFF', paddingVertical: 16, paddingHorizontal: 40,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 200
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
