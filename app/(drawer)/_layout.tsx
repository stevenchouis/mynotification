// app/(drawer)/_layout.tsx
// 包住 (tabs) 的 Drawer 導航（左上角選單）。(tabs) 本身的 Tabs 已把 headerShown 關掉，
// 所以這裡是整個已登入區域唯一顯示 header／選單按鈕的地方。
import { Ionicons } from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Pressable } from 'react-native';

// header title 置中，只有首頁維持品牌名稱「寶雅電子商城」，其餘頁面改顯示各自的功能名稱，
// 讓使用者能從 header 直接看出目前在哪個功能。drawerLabel 是 Drawer 選單裡的顯示名稱，跟 header title 分開維護。
const BRAND_TITLE = '寶雅電子商城';

// (tabs) 底下的 5 個分頁共用同一個 Drawer.Screen（Tabs 自己的 headerShown 是 false，
// header 統一由這裡的 Drawer 畫），所以要用 getFocusedRouteNameFromRoute 讀出目前是哪個分頁，
// 才能讓 header title 跟著切換分頁動態改變；對應名稱跟 (tabs)/_layout.tsx 每個 Tabs.Screen 的 title 一致
const TAB_TITLES: Record<string, string> = {
  home: BRAND_TITLE,
  favorites: '我的收藏',
  inbox: '通知',
  settings: '設定',
  coupons: '我的優惠券',
};

// about/faq/privacy 是 Drawer 底下跟 (tabs) 同層的畫面（不是 (tabs) 的子畫面），
// 離開 (tabs) 之後底部分頁列本來就不會顯示；Drawer 預設 header 左上角只有選單漢堡按鈕、沒有返回箭頭，
// 不管是從首頁功能 Grid router.push 進來、還是從 Drawer 選單點進來都會卡住回不去，
// 所以這三頁改用明確的返回箭頭取代漢堡按鈕，一鍵回到上一頁（通常是首頁）
function HeaderBackButton({ navigation }: { navigation: DrawerNavigationProp<Record<string, object | undefined>> }) {
  return (
    <Pressable
      onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('(tabs)'))}
      hitSlop={12}
      style={{ marginLeft: 12 }}
    >
      <Ionicons name="chevron-back" size={24} color="#333333" />
    </Pressable>
  );
}

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
        options={({ route }) => ({
          title: TAB_TITLES[getFocusedRouteNameFromRoute(route) ?? 'home'] ?? BRAND_TITLE,
          drawerLabel: '首頁',
          drawerIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        })}
      />
      <Drawer.Screen
        name="about"
        options={({ navigation }) => ({
          title: '關於此 App',
          drawerLabel: '關於此 App',
          drawerIcon: ({ color, size }) => <Ionicons name="information-circle-outline" size={size} color={color} />,
          headerLeft: () => <HeaderBackButton navigation={navigation} />,
        })}
      />
      <Drawer.Screen
        name="faq"
        options={({ navigation }) => ({
          title: '常見問題',
          drawerLabel: '常見問題',
          drawerIcon: ({ color, size }) => <Ionicons name="help-circle-outline" size={size} color={color} />,
          headerLeft: () => <HeaderBackButton navigation={navigation} />,
        })}
      />
      <Drawer.Screen
        name="privacy"
        options={({ navigation }) => ({
          title: '隱私權政策',
          drawerLabel: '隱私權政策',
          drawerIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" size={size} color={color} />,
          headerLeft: () => <HeaderBackButton navigation={navigation} />,
        })}
      />
    </Drawer>
  );
}
