import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView,
  StyleSheet, TextInput, TouchableOpacity, View
} from 'react-native';

// 匯入剛剛定義好的 Schema 與 Type
import DateTimePicker from '@react-native-community/datetimepicker';
import Text from '../components/Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { RegisterFormValues, registerSchema } from '../schemas/authSchema';

export default function RegisterScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // const API_URL = 'http://192.168.68.53:8000'; 
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // 初始化 Hook Form
  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' }
  });

  // 監聽密碼欄位以實作即時強度顯示
  const passwordValue = watch('password') || '';
  const isLengthMet = passwordValue.length >= 8;
  const hasNumber = /\d/.test(passwordValue);
  const hasSpecial = /[!@#$%^&*]/.test(passwordValue);

  // 設定 Header 右側清空按鈕
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => reset()} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginRight: 15 })}>
          <Text style={{ color: colors.danger, fontWeight: '600' }}>清空</Text>
        </Pressable>
      ),
    });
  }, [navigation, reset, colors.danger]);

  const onSubmit = async (data: RegisterFormValues) => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/v1/users/register`, {
        email: data.email,
        password: data.password,
        birthday: data.birthday.toISOString().split('T')[0], // 轉成後端要的字串
      });
      Alert.alert("註冊成功", "我們已經準備了一張新會員歡迎禮券，登入後至「我的優惠券」查看", [
        { text: "OK", onPress: () => router.replace('/') }
      ]);
    } catch (error: any) {
      Alert.alert("註冊失敗", error.response?.data?.detail || "伺服器連線失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollInner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>建立新帳號</Text>
        
        {/* Email 欄位 */}
        <Text style={styles.label}>Email</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput 
              style={[styles.input, errors.email && styles.inputError]}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="請輸入 Email"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          )}
        />
        {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}

        {/* 密碼欄位 */}
        <Text style={styles.label}>密碼</Text>
        <View style={styles.passwordWrapper}>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput 
                style={[styles.input, { flex: 1 }, errors.password && styles.inputError]}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                placeholder="請輸入密碼"
                secureTextEntry={!isPasswordVisible}
              />
            )}
          />
          <Pressable style={styles.eyeIcon} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
            <Ionicons name={isPasswordVisible ? "eye-off" : "eye"} size={22} color={colors.textSubtle} />
          </Pressable>
        </View>

        {/* 即時強度提示區 */}
        <View style={styles.strengthRow}>
          <ValidationItem label="8位數" isMet={isLengthMet} colors={colors} styles={styles} />
          <ValidationItem label="含數字" isMet={hasNumber} colors={colors} styles={styles} />
          <ValidationItem label="含符號" isMet={hasSpecial} colors={colors} styles={styles} />
        </View>
        {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}

        {/* 確認密碼欄位 */}
        <Text style={styles.label}>確認密碼</Text>
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput 
              style={[styles.input, errors.confirmPassword && styles.inputError]}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              placeholder="請再次輸入密碼"
              secureTextEntry={!isPasswordVisible}
            />
          )}
        />
        {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>}
        
        <Text style={{ marginTop: 20, color: colors.text }}>生日</Text>
        <Controller
          control={control}
          name="birthday"
          render={({ field: { onChange, value } }) => (
            <>
              <TouchableOpacity
                onPress={() => setShowPicker(true)}
                style={{
                  padding: 15,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 8,
                  borderColor: errors.birthday ? colors.danger : 'transparent',
                  borderWidth: 1
                }}
              >
                <Text style={{ color: colors.text }}>{value ? value.toLocaleDateString() : "請點擊選擇生日"}</Text>
              </TouchableOpacity>

              {showPicker && (
                <DateTimePicker
                  value={value || new Date()}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={(event, date) => {
                    setShowPicker(false);
                    if (date) onChange(date); // 將 Date 物件傳回 React Hook Form
                  }}
                />
              )}
            </>
          )}
        />
      {errors.birthday && <Text style={{ color: colors.danger }}>{errors.birthday.message}</Text>}

        {/* 提交按鈕 */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            loading && { opacity: 0.7 }
          ]}
          onPress={handleSubmit(onSubmit)}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={colors.onTint} /> : <Text style={styles.buttonText}>註冊</Text>}
        </Pressable>

        <Pressable onPress={() => router.replace('/')} style={styles.linkContainer}>
          <Text style={styles.linkText}>已經有帳號了？返回登入</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// 輔助組件：驗證清單項
const ValidationItem = ({
  label, isMet, colors, styles,
}: { label: string; isMet: boolean; colors: ThemeColors; styles: ReturnType<typeof createStyles> }) => (
  <View style={styles.validationItem}>
    <Ionicons
      name={isMet ? "checkmark-circle" : "ellipse-outline"}
      size={14}
      color={isMet ? colors.success : colors.border}
    />
    <Text style={[styles.validationText, isMet && { color: colors.success }]}>{label}</Text>
  </View>
);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollInner: { padding: 24, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginBottom: 8, marginLeft: 4 },
  input: {
    height: 55, backgroundColor: colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 16,
    fontSize: 16, borderWidth: 1.5, borderColor: 'transparent', color: colors.text,
  },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerSurface },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center' },
  eyeIcon: { position: 'absolute', right: 16, height: 55, justifyContent: 'center' },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 4, marginBottom: 12, marginLeft: 4 },
  strengthRow: { flexDirection: 'row', marginTop: 8, marginBottom: 4, paddingLeft: 4 },
  validationItem: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
  validationText: { fontSize: 12, color: colors.textSubtle, marginLeft: 4 },
  button: {
    backgroundColor: colors.tint, height: 55, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 20
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: colors.onTint, fontSize: 18, fontWeight: 'bold' },
  linkContainer: { marginTop: 25, alignItems: 'center' },
  linkText: { color: colors.tint, fontSize: 15, textDecorationLine: 'underline' }
});


// import axios from 'axios';
// import { useRouter } from 'expo-router';
// import React, { useState } from 'react';
// import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

// export default function RegisterScreen() {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [loading, setLoading] = useState(false);
//   const router = useRouter();

//   // 建議統一使用與 index.tsx 相同的 IP
//   const API_URL = 'http://192.168.68.53:8000'; 

//   const handleRegister = async () => {
//     if (!email || !password) {
//       Alert.alert("提示", "請輸入 Email 與密碼");
//       return;
//     }

//     setLoading(true);
//     try {
//       await axios.post(`${API_URL}/api/v1/users/register`, {
//         email,
//         password
//       });
      
//       Alert.alert("註冊成功", "您現在可以登入了", [
//         { text: "OK", onPress: () => router.replace('/') } // 使用 replace 跳回登入頁
//       ]);
//     } catch (error: any) {
//       const errorMsg = error.response?.data?.detail || "註冊時發生錯誤";
//       Alert.alert("註冊失敗", errorMsg);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <KeyboardAvoidingView 
//       behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
//       style={styles.container}
//     >
//       <View style={styles.inner}>
//         <Text style={styles.title}>建立新帳號</Text>
        
//         <TextInput 
//           style={styles.input}
//           placeholder="Email"
//           value={email}
//           onChangeText={setEmail}
//           autoCapitalize="none"
//           keyboardType="email-address"
//         />
//         <TextInput 
//           style={styles.input}
//           placeholder="密碼"
//           value={password}
//           onChangeText={setPassword}
//           secureTextEntry
//         />

//         <Pressable 
//           style={({ pressed }) => [
//             styles.button, 
//             pressed && styles.buttonPressed,
//             loading && { opacity: 0.7 }
//           ]} 
//           onPress={handleRegister}
//           disabled={loading}
//         >
//           <Text style={styles.buttonText}>{loading ? '註冊中...' : '註冊'}</Text>
//         </Pressable>

//         {/* 新增：切換回登入頁面的入口 */}
//         <Pressable 
//           style={({ pressed }) => [styles.linkContainer, pressed && { opacity: 0.6 }]}
//           onPress={() => router.replace('/')} // 跳回 index.tsx
//         >
//           <Text style={styles.linkText}>已經有帳號了？點此登入</Text>
//         </Pressable>
//       </View>
//     </KeyboardAvoidingView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#fff' },
//   inner: { flex: 1, padding: 24, justifyContent: 'center' },
//   title: { fontSize: 28, fontWeight: 'bold', marginBottom: 40, textAlign: 'center', color: '#1a1a1a' },
//   input: { 
//     height: 55, 
//     borderWidth: 1, 
//     borderColor: '#eee', 
//     borderRadius: 12, 
//     marginBottom: 16, 
//     paddingHorizontal: 16,
//     backgroundColor: '#f9f9f9',
//     fontSize: 16
//   },
//   button: { 
//     backgroundColor: '#007AFF', 
//     height: 55, 
//     borderRadius: 12, 
//     justifyContent: 'center', 
//     alignItems: 'center',
//     marginTop: 10,
//     elevation: 2,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//   },
//   buttonPressed: { backgroundColor: '#0056b3', transform: [{ scale: 0.98 }] },
//   buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
//   // 連結樣式
//   linkContainer: { marginTop: 20, alignItems: 'center', padding: 10 },
//   linkText: { color: '#007AFF', fontSize: 15, fontWeight: '500', textDecorationLine: 'underline' }
// });