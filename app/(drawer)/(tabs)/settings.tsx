import { Ionicons } from '@expo/vector-icons';
import { createClient } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import Text from '../../../components/Text';
import { useAuthStore } from '../../../store/useAuthStore';
import { useNotificationStore } from '../../../store/useNotificationStore';

console.log("Supabase URL:", process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log("Supabase ANON Key:", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
// 1. 初始化 Supabase Client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout, userToken } = useAuthStore();
  const resetNotifications = useNotificationStore(state => state.reset);
  
  const [isUploading, setIsUploading] = useState(false);

  // 2. 抓取使用者資料 (Server State)
  const { data: user, isLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      return response.data;
    },
    enabled: !!userToken,
  });

  // 3. 更新後端頭像網址的 Mutation
  const updateAvatarMutation = useMutation({
    mutationFn: (url: string) => 
      axios.put(`${API_URL}/api/v1/users/me`, { avatar_url: url }, {
        headers: { Authorization: `Bearer ${userToken}` }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      Alert.alert("成功", "個人頭像已更新");
    },
    onError: () => {
      Alert.alert("錯誤", "同步資料至伺服器失敗");
    }
  });

  // 4. Android 穩定版圖片轉換函式 (使用 XMLHttpRequest)
  const uriToBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        console.log("uriToBlob Error:", e);
        reject(new Error("uriToBlob failed"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });
  };

  // 5. 處理圖片挑選與上傳
  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      uploadToSupabase(result.assets[0].uri);
    }
  };

const uploadToSupabase = async (uri: string) => {
  try {
    const fileExt = uri.split('.').pop();
    const fileName = `${user.id}/avatar_${Date.now()}.${fileExt}`;

    // --- 修改這裡：改用更穩定的方式轉換圖片 ---
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer(); // 改用 arrayBuffer 而非 blob()

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, arrayBuffer, { // 直接傳入 arrayBuffer
        contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        upsert: true
      });
    // ------------------------------------

    if (error) throw error;

      // 取得公開 URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // 同步回 FastAPI
      updateAvatarMutation.mutate(publicUrl);

    } catch (error) {
      console.error("上傳詳細錯誤:", error);
      Alert.alert("上傳失敗", "網路連接失敗，請檢查 Supabase 設定與網路環境");
    } finally {
      setIsUploading(false);
    }
  };

  // 6. 處理登出邏輯
  const handleLogout = () => {
    Alert.alert('登出確認', '您確定要登出系統嗎？', [
      { text: '取消', style: 'cancel' },
      { 
        text: '確定登出', 
        style: 'destructive',
        onPress: async () => {
          queryClient.clear(); // 清空 TanStack Query 快取
          resetNotifications(); // 重置 Zustand 通知計數
          await logout(); 
          router.replace('/'); 
        } 
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>個人設定</Text>

      <View style={styles.profileCard}>
        <Pressable 
          onPress={handlePickImage} 
          disabled={isUploading || isLoading}
          style={({ pressed }) => [
            styles.avatarWrapper,
            pressed && { opacity: 0.7 }
          ]}
        >
          <View style={styles.avatarContainer}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#fff" />
              </View>
            )}
            
            {isUploading && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}

            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </View>
        </Pressable>

        <View style={styles.userInfo}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <>
              <Text style={styles.userName}>{user?.username || 'User'}</Text>
              <Text style={styles.userEmail}>{user?.email || 'No email'}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionLabel}>帳號管理</Text>
        <Text style={styles.label}>個人福利</Text>
        <Pressable 
                // 3. 改用 router.push，路徑直接對應檔名
                onPress={() => router.push('/coupons')} 
                style={styles.menuItem}
        >
          <Text style={styles.menuItemText}>我的優惠券</Text>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>可用</Text>
          </View>
        </Pressable>
        <Pressable 
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed
          ]}
        >
          <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>登出系統</Text>
        </Pressable>
      </View>
      
      <Text style={styles.versionText}>版本號：1.0.3 (Android Blob Fix)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  profileCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  avatarWrapper: { position: 'relative' },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { 
    width: '100%', 
    height: '100%', 
    backgroundColor: '#007AFF', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff'
  },
  userInfo: { flex: 1, marginLeft: 20 },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  userEmail: { fontSize: 14, color: '#666', marginTop: 4 },
  // 修正你的紅字報錯
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    marginTop: 16,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  // menuSection: { marginTop: 10 },
  // sectionLabel: { fontSize: 14, color: '#999', marginBottom: 12, marginLeft: 5 },
  // 選單區塊容器
  menuSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 10,
    // 如果你有定義 shadow 也可以加上
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
 // 優惠券選單項目
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    // 加上一點陰影讓它跟按鈕區分開來
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  menuItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  badgeContainer: {
    backgroundColor: '#FF9500', // 優惠券經典橘色
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  }, 
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#ff4d4f',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  versionText: { textAlign: 'center', color: '#ccc', marginTop: 50, fontSize: 12 },
});

