// components/BirthdayPicker.tsx
// 生日選擇器：年／月／日三欄可捲動、點選的選單（取代 @react-native-community/datetimepicker）。
// 原生 DatePicker 在 Android 是月曆對話框，選幾十年前的生日要一直往前翻月份、或先點年份再找，很難用；
// 這裡三欄各自獨立、直接捲到或點選要的數字。純 JS 實作，沒有新增原生模組，不需要重建 Dev Build。
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import Text from './Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const MIN_YEAR = 1900;
// 沒選過時的預設停留位置，比起停在今年，離大多數使用者的生日近很多
const DEFAULT_YEAR = 1990;

interface Props {
  value: Date | undefined;
  onChange: (date: Date) => void;
  hasError?: boolean;
}

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

export function formatDateLocal(date: Date): string {
  // 不能用 toISOString()：它是 UTC，台灣（UTC+8）的本地午夜會被換算成前一天
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function Column({
  items, selected, onSelect, suffix, colors, styles,
}: {
  items: number[];
  selected: number;
  onSelect: (value: number) => void;
  suffix: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const listRef = useRef<FlatList<number>>(null);
  const selectedIndex = Math.max(0, items.indexOf(selected));

  // 一開啟（跳到目前選的值）、以及選項數量改變（例如切到 2 月只剩 28 天）使選中的日子被夾到新範圍時，
  // 都要把捲動位置對齊選中的項目
  useEffect(() => {
    // 上方有兩格空白 header，所以「第 i 項在視窗正中央」剛好等於捲動位移 i * ITEM_HEIGHT
    listRef.current?.scrollToOffset({ offset: selectedIndex * ITEM_HEIGHT, animated: false });
  }, [selectedIndex, items.length]);

  return (
    <FlatList
      ref={listRef}
      style={styles.column}
      data={items}
      keyExtractor={(item) => String(item)}
      // offset 要加上上方兩格空白 header 的高度
      getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * (index + 2), index })}
      showsVerticalScrollIndicator={false}
      // 上下各留兩格空白，讓最前/最後的選項也能捲到中間
      ListHeaderComponent={<View style={{ height: ITEM_HEIGHT * 2 }} />}
      ListFooterComponent={<View style={{ height: ITEM_HEIGHT * 2 }} />}
      renderItem={({ item }) => {
        const isSelected = item === selected;
        return (
          <Pressable style={[styles.item, isSelected && styles.itemSelected]} onPress={() => onSelect(item)}>
            <Text style={[styles.itemText, isSelected && { color: colors.onTint, fontWeight: '700' }]}>
              {item}{suffix}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

export default function BirthdayPicker({ value, onChange, hasError }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);

  const today = new Date();
  const currentYear = today.getFullYear();
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);

  const years = useMemo(
    () => Array.from({ length: currentYear - MIN_YEAR + 1 }, (_, i) => currentYear - i),
    [currentYear]
  );
  // 今年只能選到目前的月份、本月只能選到今天，避免選出未來的生日
  const maxMonth = year === currentYear ? today.getMonth() + 1 : 12;
  const months = useMemo(() => Array.from({ length: maxMonth }, (_, i) => i + 1), [maxMonth]);
  const maxDay =
    year === currentYear && month === today.getMonth() + 1 ? today.getDate() : daysInMonth(year, month);
  const days = useMemo(() => Array.from({ length: maxDay }, (_, i) => i + 1), [maxDay]);

  const open = () => {
    const base = value ?? new Date(DEFAULT_YEAR, 0, 1);
    setYear(base.getFullYear());
    setMonth(base.getMonth() + 1);
    setDay(base.getDate());
    setVisible(true);
  };

  // 換年/月造成目前選的月/日超出範圍時，夾到合法的最大值
  const selectYear = (next: number) => {
    setYear(next);
    const nextMaxMonth = next === currentYear ? today.getMonth() + 1 : 12;
    const nextMonth = Math.min(month, nextMaxMonth);
    setMonth(nextMonth);
    const nextMaxDay =
      next === currentYear && nextMonth === today.getMonth() + 1 ? today.getDate() : daysInMonth(next, nextMonth);
    setDay((d) => Math.min(d, nextMaxDay));
  };
  const selectMonth = (next: number) => {
    setMonth(next);
    const nextMaxDay =
      year === currentYear && next === today.getMonth() + 1 ? today.getDate() : daysInMonth(year, next);
    setDay((d) => Math.min(d, nextMaxDay));
  };

  const confirm = () => {
    onChange(new Date(year, month - 1, day));
    setVisible(false);
  };

  return (
    <>
      <Pressable style={[styles.field, hasError && styles.fieldError]} onPress={open}>
        <Text style={{ color: value ? colors.text : colors.textSubtle, fontSize: 16 }}>
          {value ? `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日` : '請點擊選擇生日'}
        </Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setVisible(false)} hitSlop={8}>
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>選擇生日</Text>
            <Pressable onPress={confirm} hitSlop={8}>
              <Text style={styles.confirmText}>確定</Text>
            </Pressable>
          </View>
          <View style={styles.columns}>
            <Column items={years} selected={year} onSelect={selectYear} suffix=" 年" colors={colors} styles={styles} />
            <Column items={months} selected={month} onSelect={selectMonth} suffix=" 月" colors={colors} styles={styles} />
            <Column items={days} selected={day} onSelect={setDay} suffix=" 日" colors={colors} styles={styles} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  field: {
    padding: 15, backgroundColor: colors.surfaceAlt, borderRadius: 8,
    borderWidth: 1, borderColor: 'transparent',
  },
  fieldError: { borderColor: colors.danger },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cancelText: { fontSize: 15, color: colors.textMuted },
  confirmText: { fontSize: 15, color: colors.tint, fontWeight: '700' },
  columns: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 },
  column: { flex: 1, height: ITEM_HEIGHT * VISIBLE_ITEMS },
  item: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4, borderRadius: 10 },
  itemSelected: { backgroundColor: colors.tint },
  itemText: { fontSize: 16, color: colors.textMuted },
});
