// constants/Colors.ts
// App 唯一的顏色定義來源。維持專案原本的 MUJI 木質/大地色系（淺色），深色模式則對應到
// 深木質炭褐色系，不是隨便找一套深色 palette 套上去。所有畫面的 StyleSheet 都不應該再直接寫死
// 色碼（Google/LINE 第三方登入按鈕的品牌色除外，那些依規範必須固定，不隨主題切換），一律透過
// hooks/useThemeColors.ts 取得對應色票。
//
// 語意命名說明：
// - tint：主要互動色（按鈕、連結、啟用中的分頁/圖示），取代原本混用的 #007AFF 藍與 #A69B8D 裝飾色
// - accent：純裝飾用的柔和強調色（輪播小圓點、底線、Section 色塊），對比度不需要跟 tint 一樣高
// - onTint：疊在 tint 色塊上的文字/圖示顏色（依淺色/深色模式各自反相，確保可讀）
// - surface / surfaceAlt：卡片、輸入框、圓形圖示底、Chip 等「比背景再深一階」的底色
// - highlight：需要輕微標示但不到警示等級的底色（例如通知列表未讀項目的底色）
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  tint: string;
  onTint: string;
  accent: string;
  danger: string;
  dangerSurface: string;
  success: string;
  warning: string;
  warningSurface: string;
  highlight: string;
  white: string;
}

export const Colors: Record<'light' | 'dark', ThemeColors> = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F3EF',
    surfaceAlt: '#EFE9DF',
    border: '#E5DED2',
    text: '#333333',
    textMuted: '#8A8377',
    textSubtle: '#B0AA9C',
    tint: '#7A6A54',
    onTint: '#FFFFFF',
    accent: '#A69B8D',
    danger: '#C1443B',
    dangerSurface: '#F7E7E5',
    success: '#6B8F5D',
    warning: '#B8823D',
    warningSurface: '#F5E9D8',
    highlight: '#F3EEE6',
    white: '#FFFFFF',
  },
  dark: {
    background: '#1C1815',
    surface: '#2A2420',
    surfaceAlt: '#332C25',
    border: '#453B31',
    text: '#F0EBE3',
    textMuted: '#B8AB9A',
    textSubtle: '#8A7D6C',
    tint: '#D8B788',
    onTint: '#1C1815',
    accent: '#BBAA95',
    danger: '#E2685F',
    dangerSurface: '#3A2624',
    success: '#8FB37D',
    warning: '#E0A75E',
    warningSurface: '#3A2F1F',
    highlight: '#332C24',
    white: '#FFFFFF',
  },
};

export type ColorSchemeName = keyof typeof Colors;
