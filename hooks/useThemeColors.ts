// hooks/useThemeColors.ts
// 讀取「目前實際生效的外觀模式」並回傳對應的語意色票（constants/Colors.ts）。畫面元件需要顏色時
// 一律用 useThemeColors()，不要自己 import Colors 再手動判斷 scheme。
import { useColorScheme } from 'react-native';

import { Colors, ColorSchemeName, ThemeColors } from '../constants/Colors';
import { useThemeModeStore } from '../store/useThemeModeStore';

// 使用者可以在「設定」頁手動選淺色/深色，選 system 才會跟著裝置系統設定走；
// app/_layout.tsx 的 ThemeProvider（React Navigation 導覽層顏色）也要用同一個 hook，
// 確保畫面內容跟 header/Tab Bar 顏色永遠一致，不會出現手動選了深色、但 header 還是淺色的情況。
export function useResolvedScheme(): ColorSchemeName {
  const systemScheme = useColorScheme();
  const mode = useThemeModeStore((state) => state.mode);
  if (mode === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return mode;
}

export function useThemeColors(): ThemeColors {
  const scheme = useResolvedScheme();
  return Colors[scheme];
}
