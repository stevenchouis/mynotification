// app/magic-login.tsx
// 後端寄出的信件連結會落地在一個網頁，網頁再轉跳到 mynotification://magic-login?token=xxx
// Expo Router 會依檔名自動把這個 deep link 導到這支畫面
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Text from '../components/Text';
import { completeLogin } from '../services/authFlow';
import { useAuthStore } from '../store/useAuthStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function MagicLoginScreen() {
  const router = useRouter();
  // 這支畫面不論登入狀態都能被導航到（見 app/_layout.tsx），錯誤畫面的「返回登入」
  // 要看目前是否已登入決定要導去哪裡：已登入時 index 不在目前的 Stack.Protected 群組裡，
  // 硬導去 '/' 會噴 "action REPLACE...was not handled by any navigator"
  const userToken = useAuthStore((state) => state.userToken);
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  // token 為單次使用，避免重複渲染/導航造成同一個 token 被驗證兩次
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const verify = async () => {
      if (!token) {
        // 這支畫面「不論登入狀態都能被導航到」，任何登入方式成功後 Stack.Protected 的
        // guard 翻轉都會讓整個 Stack 重新初始化，這時 Expo Router 有機率重新套用裝置上
        // 殘留的舊 magic-login deep link（沒有 token），並不是真的連結壞掉。已經是登入
        // 狀態的話代表就是這種情況，直接靜默導回首頁，不要嚇使用者跳出一個錯誤畫面。
        if (useAuthStore.getState().userToken) {
          router.replace('/home');
          return;
        }
        setStatus('error');
        setErrorMessage('登入連結格式不正確');
        return;
      }
      try {
        const res = await axios.post(`${API_URL}/api/v1/login/magic-link/verify`, { token });
        await completeLogin(res.data.access_token);
      } catch (error: any) {
        setStatus('error');
        setErrorMessage(error.response?.data?.detail || '登入連結已失效或過期，請重新索取');
      }
    };
    verify();
  }, [token]);

  if (status === 'verifying') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.text}>登入中，請稍候...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.errorText}>{errorMessage}</Text>
      <Pressable style={styles.button} onPress={() => router.replace(userToken ? '/home' : '/')}>
        <Text style={styles.buttonText}>返回登入</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#fff' },
  text: { marginTop: 16, fontSize: 16, color: '#666' },
  errorText: { fontSize: 16, color: '#FF3B30', textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#007AFF', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
