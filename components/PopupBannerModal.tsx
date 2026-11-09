// components/PopupBannerModal.tsx
// 首頁開屏活動彈窗（見 plan-popup-banner.md），版面參考使用者提供的 HAPPY GO 截圖：
// 半透明深色背景、置中 4:5 大圖輪播、小圓點、「今日不再顯示」勾選、下方圓形 ✕。
//
// 掛在 (tabs)/_layout.tsx（跟 PickupCallModal 同一層），「要不要跳」也在這裡判斷，刻意不碰 home.tsx：
// 2026-11-09 實測，把判斷邏輯（useNavigation + useFocusEffect）加進 HomeScreen 後，首頁的 FlashList
// 會陷入無限重新渲染（React「Maximum update depth exceeded」整頁壞掉），還原 home.tsx 就正常。
//
// 判斷規則（使用者定案）：
// - 每次「進到首頁」都判斷一次：打開 App 落在首頁、從其他分頁或其他畫面回到首頁（使用者 2026-11-09
//   改成跟 HAPPY GO 一樣）；從背景切回 App 畫面沒變，不跳
// - 等一下再確認目前畫面還是首頁：點推播／連結打開 App 會被帶去別頁，這次就不跳
// - 勾過「今日不再顯示」當天不跳；圖片 5 秒內沒載完這次不跳
// - 取餐叫號彈窗開著時先藏起來，關掉後再顯示
// 歡迎畫面在 app/_layout.tsx 就擋在 (drawer) 前面，這個元件掛上時歡迎畫面一定已經關掉。
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Carousel } from 'react-native-reanimated-carousel';

import Text from './Text';
import { HeroBannerRoute } from '../constants/heroBannerRoutes';
import {
  PopupBanner, dismissPopupForToday, fetchPopupBanners, isPopupDismissedToday,
} from '../services/popupBanners';
import { usePickupCallStore } from '../store/usePickupCallStore';

// 遮罩、白色按鈕這些是「蓋在任何畫面上」的固定樣式，比照叫號彈窗不隨深淺色主題切換
const OVERLAY = 'rgba(0, 0, 0, 0.6)';
// 首頁是 (tabs) 的第一個分頁，實測 usePathname() 回 '/'（直接 push 過去時是 '/home'），兩個都算首頁
const HOME_PATHS = ['/', '/home'];
const isHomePath = (path: string) => HOME_PATHS.includes(path);
// 打開 App 時等 1 秒：點推播打開 App 會先顯示首頁、再被帶去別頁，等一下確認還在首頁才跳；
// 從其他分頁／畫面切回首頁不會有這種情況，只等一下下（使用者 2026-11-09 覺得切回來要等太久）
const LAUNCH_DELAY_MS = 1000;
const RETURN_DELAY_MS = 0;
// 活動清單 5 分鐘內直接用上次抓的，切回首頁不用每次都等後端
const CACHE_MS = 5 * 60 * 1000;
let cachedList: { list: PopupBanner[]; at: number } | null = null;

// fromCache：用的是快取（圖片上次已經下載過），不用再等 Image.prefetch
async function getPopupBanners(): Promise<{ list: PopupBanner[]; fromCache: boolean }> {
  if (cachedList && Date.now() - cachedList.at < CACHE_MS) return { list: cachedList.list, fromCache: true };
  const list = await fetchPopupBanners();
  cachedList = { list, at: Date.now() };
  return { list, fromCache: false };
}
const IMAGE_TIMEOUT_MS = 5000;

export default function PopupBannerModal() {
  const { width: screenWidth } = useWindowDimensions();
  const [banners, setBanners] = useState<PopupBanner[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dontShowToday, setDontShowToday] = useState(false);
  const pickupCall = usePickupCallStore((state) => state.call);

  // 計時器裡要讀「當下」的畫面路徑，用 ref 存最新值
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  // 上一個畫面路徑：null 代表剛掛上（打開 App）；首頁內 '/' ↔ '/home' 互換不算「回到首頁」
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    pathnameRef.current = pathname;
    if (!isHomePath(pathname) || (prev !== null && isHomePath(prev))) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!isHomePath(pathnameRef.current)) return;
      if (await isPopupDismissedToday()) return;
      try {
        const { list, fromCache } = await getPopupBanners();
        if (list.length === 0) return;
        const loaded = fromCache || await Promise.race([
          Image.prefetch(list.map((b) => b.imageUrl)),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), IMAGE_TIMEOUT_MS)),
        ]);
        // 圖片沒載完不算數，清掉快取，下次回到首頁重新抓
        if (!loaded) cachedList = null;
        if (!loaded || cancelled || !isHomePath(pathnameRef.current)) return;
        setBanners(list);
      } catch {
        // 抓不到就不跳，不影響其他畫面
      }
    }, prev === null ? LAUNCH_DELAY_MS : RETURN_DELAY_MS);
    // 還沒跳出來就離開首頁（例如被推播／連結帶走）就取消
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pathname]);

  const visible = banners.length > 0 && !pickupCall;

  // 寬度約螢幕 85%，最大 420；圖片固定 4:5 直式
  const cardWidth = Math.min(screenWidth * 0.85, 420);
  const cardHeight = cardWidth * 1.25;
  const styles = useMemo(() => createStyles(cardWidth, cardHeight), [cardWidth, cardHeight]);

  // dontShow：關閉時是否勾了「今日不再顯示」；route：點圖片時要導去的頁面
  const onClose = (dontShow: boolean, route?: HeroBannerRoute) => {
    if (dontShow) dismissPopupForToday();
    setBanners([]);
    if (route) router.push(route);
  };

  if (banners.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => onClose(dontShowToday)}>
      {/* RN 的 Modal 在 Android 是另一個原生視窗，吃不到 app/_layout.tsx 最外層的 GestureHandlerRootView，
          輪播的左右滑手勢不會生效、手指一碰圖片就被當成點擊（使用者 2026-11-09 實測），所以 Modal 裡要自己再包一層 */}
      <GestureHandlerRootView style={styles.overlay}>
        <Carousel
          style={{ width: cardWidth, height: cardHeight }}
          data={banners}
          loop={banners.length > 1}
          scrollEnabled={banners.length > 1}
          autoplay={banners.length > 1}
          autoplayInterval={4000}
          keyExtractor={(item) => item.id}
          onSnapToItem={setActiveIndex}
          renderItem={({ item }) => (
            <Pressable
              style={styles.slide}
              onPress={() => onClose(dontShowToday, item.linkRoute)}
              accessibilityRole={item.linkRoute ? 'link' : 'image'}
              accessibilityLabel={item.title}
            >
              <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="contain" />
            </Pressable>
          )}
        />

        {banners.length > 1 && (
          <View style={styles.dotsRow}>
            {banners.map((item, index) => (
              <View key={item.id} style={[styles.dot, index === activeIndex && styles.dotActive]} />
            ))}
          </View>
        )}

        <Pressable
          style={styles.checkRow}
          onPress={() => setDontShowToday((value) => !value)}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: dontShowToday }}
        >
          <Ionicons name={dontShowToday ? 'checkbox' : 'square-outline'} size={20} color="#FFFFFF" />
          <Text style={styles.checkText}>今日不再顯示</Text>
        </Pressable>

        <Pressable
          style={styles.closeButton}
          onPress={() => onClose(dontShowToday)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="關閉"
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const createStyles = (cardWidth: number, cardHeight: number) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: OVERLAY, alignItems: 'center', justifyContent: 'center' },
  slide: { width: cardWidth, height: cardHeight, borderRadius: 16, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },

  dotsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.45)' },
  dotActive: { backgroundColor: '#FFFFFF' },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingVertical: 4 },
  checkText: { fontSize: 14, color: '#FFFFFF' },

  closeButton: {
    width: 48, height: 48, borderRadius: 24, marginTop: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.8)', backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
});
