// components/Text.tsx
// 全域套用 Noto Sans TC 繁中字型的 Text 元件。React Native 的 <Text> 在 RN 0.81 是函式元件，
// React 19 已經不支援函式元件的 defaultProps，沒辦法用 `Text.defaultProps.style = ...` 這招套全域字型，
// 所以改成用這個包裝元件取代 react-native 原生的 Text，各畫面把 import 換成這裡即可。
// 依傳入 style 的 fontWeight 自動挑選對應的 Noto Sans TC 字重檔；找不到對應字重就退回 400 Regular。
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

const WEIGHT_TO_FONT_FAMILY: Record<string, string> = {
  '100': 'NotoSansTC_400Regular',
  '200': 'NotoSansTC_400Regular',
  '300': 'NotoSansTC_400Regular',
  '400': 'NotoSansTC_400Regular',
  normal: 'NotoSansTC_400Regular',
  '500': 'NotoSansTC_500Medium',
  '600': 'NotoSansTC_600SemiBold',
  '700': 'NotoSansTC_700Bold',
  bold: 'NotoSansTC_700Bold',
  '800': 'NotoSansTC_700Bold',
  '900': 'NotoSansTC_900Black',
};

export default function Text({ style, ...props }: TextProps) {
  const flattened = StyleSheet.flatten(style) ?? {};
  const weightKey = flattened.fontWeight != null ? String(flattened.fontWeight) : '400';
  const fontFamily = WEIGHT_TO_FONT_FAMILY[weightKey] ?? 'NotoSansTC_400Regular';

  // Noto Sans TC（中文字型）預設的 lineHeight 比系統字型高不少；只用 padding 撐高度、
  // 沒有手動指定 lineHeight 的按鈕/容器會因此意外變胖變高，這裡沒指定時用 fontSize 換算一個
  // 比較貼近系統字型比例的預設值，已經手動指定 lineHeight 的地方則保留原樣不覆蓋
  const computedLineHeight =
    flattened.lineHeight ?? (flattened.fontSize ? Math.round(flattened.fontSize * 1.3) : undefined);

  // fontWeight 強制設回 normal：字重已經用對應的字型檔表達，避免系統對自訂字型再做一次「假粗體」合成
  return (
    <RNText
      {...props}
      style={[
        style,
        { fontFamily, fontWeight: 'normal' },
        computedLineHeight ? { lineHeight: computedLineHeight } : null,
      ]}
    />
  );
}
