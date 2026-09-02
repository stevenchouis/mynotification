import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
// Alert (React Native 內建) 用來顯示彈窗提示
// react-native-toast-message 是一個第三方庫，可以顯示更美觀的 Toast 通知，提供更多自定義選項和更好的使用者體驗
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import Text from '../components/Text';
// 根據你的目錄結構匯入
// LoginFormValues 是Form 的Typescript 型別定義，loginSchema 是 Zod 驗證規則
import { LoginFormValues, loginSchema } from '../schemas/authSchema';
// 共用的登入收尾流程（存 Token、同步 Push Token、導頁），帳密/Google/Magic Link 登入都共用
import { completeLogin } from '../services/authFlow';
// Google 原生登入（帳號選擇畫面 -> 取得 idToken）
import { signInWithGoogle } from '../services/googleAuth';
// Global Status JWT userToken 和 setUserToken 方法
import { useAuthStore } from '../store/useAuthStore';

// ⚠️ 請確保這是你電腦的 LAN IP，且 FastAPI 已啟動並監聽 0.0.0.0
// 每次執行後端都要確認 IP 沒有變動，若有變動,則要修改這裡的 API_URL
// const API_URL = 'http://192.168.68.59:8000'; 
const API_URL = process.env.EXPO_PUBLIC_API_URL;

// 這段程式碼是 expo-notifications 中的核心設定，它的作用是定義：當 App 正在「前景」（Foreground，也就是使用者正在盯著 App 看）時，收到通知該如何反應。
// 預設情況下，iOS 和 Android 為了避免干擾使用者，當 App 開啟時收到通知是不會彈出橫幅或發出聲音的。這段程式碼就是用來「打破」這個預設行為。
// 這是一個全域的監聽設定。你只需要在 App 的進入點（例如 _layout.tsx 或 app.json 相關配置）設定一次，它就會影響整個 App 對於「前景通知」的處理邏輯。
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    // shouldShowAlert 已棄用，改用 shouldShowBanner（前景橫幅）與 shouldShowList（通知中心列表）取代
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const LoginIndex = () => {
  const router = useRouter();
  // 從全局狀態管理的Hook中取得 userToken 和 setUserToken 方法
  const { userToken } = useAuthStore();
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isMagicLinkSubmitting, setIsMagicLinkSubmitting] = useState(false);

  // 1. 自動檢查登入狀態, 若沒有取得TOken, 就停留在登入頁面；如果有Token, 就直接跳轉到 Home 頁面
  useEffect(() => {
    if (userToken) {
      router.replace('/home'); 
    }
  }, [userToken, router]);
  // 2. 使用 react-hook-form 來管理表單狀態和驗證，搭配 zodResolver 將 Zod 的驗證規則整合進來
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    // 這裡的 defaultValues 是為了方便開發測試，實際上你可以留空或設為其他值
    defaultValues: { username: 'stevenchouis@hotmail.com', password: '123456' },
  });

  // 2. onLogin 是按下登入按鈕後要執行的非同步函式
  const onLogin = async (data: LoginFormValues) => {
    try {
      // 取得 JWT Access Token
      // URLSearchParams 這個名字聽起來很像是在處理 URL 後面的 ?a=1&b=2，但在這裡，你是將 params 物件作為 axios.post 的第二個參數傳入。
      // 這樣做的效果是，axios 會自動將這個 params 物件轉換成 application/x-www-form-urlencoded 格式的字串，並且在 HTTP 請求的 Body 中發送給後端。
      // 數據長相：username=test%40example.com&password=password123。
      // 這個字串被放在 POST 請求的「信封（Body）」裡面，而不是寫在URL上。
      // 用一般的方式傳送（例如 { username: data.username }），Axios 會預設使用 application/json，Body 會長這樣：{"username": "...", "password": "..."}。
      const params = new URLSearchParams();
      params.append('username', data.username);
      params.append('password', data.password);
      // 使用POST Method 呼叫後端的登入 API，並且將帳密以表單格式傳送
      const loginRes = await axios.post(
        `${API_URL}/api/v1/login/access-token`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      await completeLogin(loginRes.data.access_token);
    } catch (error: any) {
      const detail = error.response?.data?.detail || '登入失敗，請檢查網路或帳密';
      Alert.alert('錯誤', detail);
      console.error("Login process error:", error.message);
    }
  };

  // 3. onGoogleLogin：跳出原生 Google 帳號選擇畫面，取得 idToken 後換取後端 JWT
  const onGoogleLogin = async () => {
    setIsGoogleSubmitting(true);
    try {
      const idToken = await signInWithGoogle();
      if (!idToken) {
        // 使用者在帳號選擇畫面按下取消，不視為錯誤，直接返回
        return;
      }
      const loginRes = await axios.post(`${API_URL}/api/v1/login/google`, { id_token: idToken });
      await completeLogin(loginRes.data.access_token);
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'Google 登入失敗，請稍後再試';
      Alert.alert('錯誤', detail);
      console.error("Google login process error:", error.message);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // 4. onRequestMagicLink：拿表單目前輸入的 Email，請後端寄送登入連結（免密碼）
  const onRequestMagicLink = async () => {
    const email = watch('username');
    const emailCheck = z.string().min(1).email().safeParse(email);
    if (!emailCheck.success) {
      Alert.alert('提示', '請先在上方輸入正確的 Email 格式');
      return;
    }

    setIsMagicLinkSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/v1/login/magic-link/request`, { email });
      Alert.alert('已寄出登入連結', '請至信箱查收，點擊信件中的連結即可完成登入（連結 15 分鐘內有效）');
    } catch (error: any) {
      const detail = error.response?.data?.detail || '寄送失敗，請稍後再試';
      Alert.alert('錯誤', detail);
      console.error("Magic link request error:", error.message);
    } finally {
      setIsMagicLinkSubmitting(false);
    }
  };

  return (
    // 「登入」或「註冊」這類包含輸入框（TextInput）的頁面時，最常遇到的問題就是：當虛擬鍵盤彈出時，會直接遮住下半部的輸入框或按鈕，導致使用者看不到自己輸入了什麼，也按不到提交鍵。
    // 為了解決這個問題，React Native 提供了一個專門的組件叫做 KeyboardAvoidingView。它的作用就是當鍵盤彈出時，自動調整內部元素的位置，確保輸入框和按鈕不會被鍵盤遮住。
    // 它的作用是根據鍵盤的高度自動調整自身的位置或高度，確保輸入區域始終保持在可視範圍內。
    // behavior (最重要的屬性)
    // 這個屬性決定了元件如何避開鍵盤。不同平台的預設表現不同，通常需要做平台判斷：
    // padding：增加底部的內距（Padding），將內容推上去。在 iOS 上表現最穩定。
    // height：直接改變元件的高度。
    // position：改變元件的絕對位置。
    // keyboardVerticalOffset 屬性
    // 有時候你的頁面頂部有導航列（Navigation Bar）或狀態列，這會導致計算避讓高度時出現偏差。
    // 如果發現鍵盤彈出後，輸入框被推得「太高」或「不夠高」，可以調整這個數值（單位為像素）。
    // 確保 KeyboardAvoidingView 的 style 有設定 { flex: 1 }，否則它無法正確計算剩餘空間來進行位移。
    // 如果你的表單很長，建議結構如下：KeyboardAvoidingView > ScrollView > TouchableWithoutFeedback (點擊空白處收起鍵盤)。
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>FastAPI 系統</Text>
        <Text style={styles.subtitle}>請輸入您的帳號密碼</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>帳號 (Email)</Text>
          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, onBlur, value } }) => (
              // 若果有驗證錯誤，就套用 inputError 的樣式，否則使用正常的 input 樣式
              <TextInput
                style={[styles.input, errors.username && styles.inputError]}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                placeholder="example@mail.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            )}
          />
          {/* 如果 username 欄位有錯誤，就顯示錯誤訊息，否則不顯示任何東西 */}
          {errors.username && <Text style={styles.errorText}>{errors.username.message}</Text>}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>密碼</Text>
          {/* { field: { onChange, onBlur, value } } 直接解構物件中的key field 的Value, Value也是物件型別, 解構出個別的onChange, onBlur, value */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              // 若果有驗證錯誤，就套用 inputError 的樣式，否則使用正常的 input 樣式
              // secureTextEntry 這個屬性會將輸入的文字隱藏起來，通常用於密碼欄位，讓使用者輸入時不會直接看到文字內容，增加安全性。
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                placeholder="請輸入密碼"
                secureTextEntry
              />
            )}
          />
          {/* 如果 password 欄位有錯誤，就顯示錯誤訊息，否則不顯示任何東西 */}
          {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
        </View>

        {/* 登入按鈕：改用 Pressable */}
        {/* 使用 react-hook-form，isSubmitting 會在 handleSubmit 非同步函式執行期間自動變為 true。 */}
        <Pressable 
          style={({ pressed }) => [
            styles.button,
            isSubmitting && styles.buttonDisabled,
            pressed && styles.buttonPressed // 加入按下的視覺回饋
          ]} 
          onPress={handleSubmit(onLogin)}
          disabled={isSubmitting}
        >
          {/* // 按鈕內部所包的內容：如果正在提交，就顯示 ActivityIndicator 的轉圈圈動畫，
          // 否則顯示「登入」文字 */}
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>登入</Text>
          )}
        </Pressable>

        {/* 分隔線 */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>或</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google 登入按鈕：跳出原生帳號選擇畫面 */}
        <Pressable
          style={({ pressed }) => [
            styles.googleButton,
            isGoogleSubmitting && styles.buttonDisabled,
            pressed && { opacity: 0.85 }
          ]}
          onPress={onGoogleLogin}
          disabled={isGoogleSubmitting || isSubmitting}
        >
          {isGoogleSubmitting ? (
            <ActivityIndicator color="#4285F4" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#4285F4" style={{ marginRight: 10 }} />
              <Text style={styles.googleButtonText}>使用 Google 登入</Text>
            </>
          )}
        </Pressable>

        {/* Magic Link 登入入口：使用表單目前輸入的 Email，請後端寄送登入連結 */}
        <Pressable
          style={({ pressed }) => [styles.magicLinkLink, pressed && { opacity: 0.6 }]}
          onPress={onRequestMagicLink}
          disabled={isMagicLinkSubmitting}
        >
          {isMagicLinkSubmitting ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <Text style={styles.magicLinkText}>改用 Email 連結登入（免密碼）</Text>
          )}
        </Pressable>

        {/* 在登入按鈕下方, SHOW 出"還沒有帳號？立即註冊", 可切換到註冊的路由
            它也是個Presable, 只是用style控制沒有按鈕外觀(沒背景色及外框) */}
        <Pressable 
          style={({ pressed }) => [
            styles.registerLink,
            pressed && { opacity: 0.6 } // 簡單的按壓透明度回饋
          ]}
          // 改成router.replace('/register'), 
          // 從登入頁（index）跳轉到註冊頁（register）後，不能透過物理返回鍵或手勢滑回登入頁
          // onPress={() => router.push('/register')}
          onPress={() => router.replace('/register')}
        >
          <Text style={styles.registerLinkText}>還沒有帳號？立即註冊</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginIndex;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  // View inner 的樣式：使用 flexbox 來垂直置中內容，並且加上適當的內距
  inner: { flex: 1, justifyContent: 'center', padding: 30 },
  // Text title 的樣式：較大的字體、加粗、深色、置中，以及底部的外距
  title: { fontSize: 32, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center', marginBottom: 5 },
  // Text subtitle 的樣式：中等字體、較淺的顏色、置中，以及底部的外距
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 40 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, color: '#333', marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  inputError: { borderColor: '#ff4d4d', backgroundColor: '#fff2f0' },
  errorText: { color: '#ff4d4d', fontSize: 12, marginTop: 6 },
  // 按鈕的基本樣式，包含背景色、內距、圓角、對齊方式，以及陰影效果
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
  },
  // 新增：按鈕按下的縮放或顏色變化效果
  buttonPressed: {
    backgroundColor: '#0056b3',
    transform: [{ scale: 0.98 }], 
  },
  buttonDisabled: { backgroundColor: '#bae7ff' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  // 分隔線「或」的樣式
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerText: { marginHorizontal: 12, color: '#999', fontSize: 13 },
  // Google 登入按鈕樣式：白底、灰色外框，符合 Google 品牌按鈕慣例
  googleButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: { color: '#333', fontSize: 16, fontWeight: '600' },
  // Magic Link 連結樣式，比照 registerLink 的簡樸連結風格
  magicLinkLink: { marginTop: 16, alignItems: 'center' },
  magicLinkText: { color: '#007AFF', fontSize: 14, fontWeight: '500' },
  // Pressable 註冊連結的樣式，包含上邊距、對齊方式，以及文字顏色和字體大小, 沒背景色和外框
  registerLink: { marginTop: 20, alignItems: 'center' },
  // Pressable 註冊連結內文字的樣式，包含顏色、字體大小和字重，讓它看起來像個可點擊的連結
  registerLinkText: { color: '#007AFF', fontSize: 14, fontWeight: '500' },
});