// components/CarrierBarcode.tsx
// 電子發票載具條碼（見 plan-einvoice-carrier.md），app/einvoice-carrier.tsx 與 app/member-code.tsx 共用。
// 財政部手機條碼標準是 Code39；固定白底黑條，比照會員條碼不隨深色模式變色（掃描器需要高對比）。
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Barcode from 'react-native-barcode-svg';

import Text from './Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';

export default function CarrierBarcode({ carrier }: { carrier: string }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.codeWrapper}>
        {/* 套件靠 defaultProps 給預設值，React 19 已不支援，所有會被當預設值用的 prop 都要明確傳
            （原因見 app/member-code.tsx 的註解，沒傳 singleBarWidth 會算出 NaN 讓 Android 當掉） */}
        <Barcode
          value={carrier}
          format="CODE39"
          height={90}
          maxWidth={280}
          singleBarWidth={2}
          lineColor="#000000"
          backgroundColor="#ffffff"
        />
      </View>
      <Text style={styles.carrierText} selectable>{carrier}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { alignItems: 'center' },
  codeWrapper: {
    paddingVertical: 16, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 12, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 12,
    justifyContent: 'center', alignItems: 'center', minHeight: 122,
  },
  carrierText: { fontSize: 26, fontWeight: 'bold', letterSpacing: 3, color: colors.text },
});
