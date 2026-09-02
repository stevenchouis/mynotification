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

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function MagicLoginScreen() {
  const router = useRouter();
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
      <Pressable style={styles.button} onPress={() => router.replace('/')}>
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
