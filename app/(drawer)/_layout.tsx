// app/(drawer)/_layout.tsx
// 包住 (tabs) 的 Drawer 導航（左上角選單）。(tabs) 本身的 Tabs 已把 headerShown 關掉，
// 所以這裡是整個已登入區域唯一顯示 header／選單按鈕的地方。
import { Ionicons } from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';

// 所有頁面的 header title 統一顯示品牌名稱「寶雅電子商城」並置中，
// 各頁面在 Drawer 選單裡的顯示名稱（drawerLabel）維持各自的說明文字，方便辨識選單項目。
const BRAND_TITLE = '寶雅電子商城';

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerTintColor: '#333333',
        headerTitleAlign: 'center',
        // 預設的置中是相對於左右按鈕之間的剩餘空間計算，左邊選單按鈕會把它往右推；
        // 讓 title 容器忽略左右按鈕寬度、直接撐滿整個 header，才能真正對齊螢幕正中央
        headerTitleContainerStyle: { left: 0, right: 0 },
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          title: BRAND_TITLE,
          drawerLabel: '首頁',
          drawerIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="about"
        options={{
          title: BRAND_TITLE,
          drawerLabel: '關於此 App',
          drawerIcon: ({ color, size }) => <Ionicons name="information-circle-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="faq"
        options={{
          title: BRAND_TITLE,
          drawerLabel: '常見問題',
          drawerIcon: ({ color, size }) => <Ionicons name="help-circle-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="privacy"
        options={{
          title: BRAND_TITLE,
          drawerLabel: '隱私權政策',
          drawerIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" size={size} color={color} />,
        }}
      />
    </Drawer>
  );
}
