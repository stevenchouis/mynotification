// app/search.tsx
// 搜尋頁面：從首頁搜尋列 push 進來（app/_layout.tsx 的 Stack.Screen，走原生 header，天生有返回箭頭）。
// 沒輸入關鍵字時顯示「最近搜尋」（本機記錄，store/useSearchHistoryStore.ts）跟「熱門搜尋」
// （後端 API 提供，見 services/search.ts；API 還沒就緒或失敗時用 fallback，不讓頁面壞掉）；
// 有輸入時 debounce 400ms 才打 DummyJSON /products/search，避免每打一個字就發一次請求。
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Pressable, StyleSheet, TextInput, View
} from 'react-native';

import Text from '../components/Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { Product, searchProducts } from '../services/products';
import { fetchSearchSuggestions } from '../services/search';
import { useSearchHistoryStore } from '../store/useSearchHistoryStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_WIDTH = SCREEN_WIDTH - 32;
const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const GRID_CARD_WIDTH = (CONTENT_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

const DEBOUNCE_MS = 400;

function KeywordChip({ label, onPress, styles }: { label: string; onPress: () => void; styles: Styles }) {
  return (
    <Pressable style={styles.chip} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

type Styles = ReturnType<typeof createStyles>;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const keywords = useSearchHistoryStore((state) => state.keywords);
  const addKeyword = useSearchHistoryStore((state) => state.addKeyword);
  const clearHistory = useSearchHistoryStore((state) => state.clearHistory);

  const { data: hotKeywords = [] } = useQuery({
    queryKey: ['search-suggestions'],
    queryFn: fetchSearchSuggestions,
  });

  // 打字停頓 400ms 後才真正觸發搜尋
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // 每次真正觸發搜尋（debounce 過後或點了 chip）都記進最近搜尋
  useEffect(() => {
    if (debouncedQuery) addKeyword(debouncedQuery);
  }, [debouncedQuery, addKeyword]);

  const {
    data: results = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['search-products', debouncedQuery],
    queryFn: () => searchProducts(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  });

  const runKeyword = (keyword: string) => {
    setQuery(keyword);
    setDebouncedQuery(keyword);
  };

  const showSuggestions = debouncedQuery.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="搜尋商品"
          placeholderTextColor={colors.textSubtle}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => setDebouncedQuery(query.trim())}
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setDebouncedQuery(''); }} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
          </Pressable>
        )}
      </View>

      {showSuggestions ? (
        <View style={styles.suggestionsContainer}>
          {keywords.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>最近搜尋</Text>
                <Pressable onPress={clearHistory} hitSlop={8}>
                  <Text style={styles.clearText}>清除</Text>
                </Pressable>
              </View>
              <View style={styles.chipRow}>
                {keywords.map((keyword) => (
                  <KeywordChip key={keyword} label={keyword} onPress={() => runKeyword(keyword)} styles={styles} />
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>熱門搜尋</Text>
            <View style={styles.chipRow}>
              {hotKeywords.map((keyword) => (
                <KeywordChip key={keyword} label={keyword} onPress={() => runKeyword(keyword)} styles={styles} />
              ))}
            </View>
          </View>
        </View>
      ) : (
        <FlashList<Product>
          data={results}
          keyExtractor={(item) => String(item.id)}
          numColumns={GRID_COLUMNS}
          contentContainerStyle={styles.resultsContent}
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
            ) : isError ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>搜尋失敗，請稍後再試</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>找不到符合「{debouncedQuery}」的商品</Text>
              </View>
            )
          }
          renderItem={({ item, index }) => {
            const isLastInRow = (index + 1) % GRID_COLUMNS === 0;
            return (
              <View style={[styles.productCard, { marginRight: isLastInRow ? 0 : GRID_GAP }]}>
                <Image source={{ uri: item.thumbnail }} style={styles.productThumb} contentFit="cover" />
                <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.productPrice}>${item.price}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    height: 40, borderRadius: 10, backgroundColor: colors.surface, paddingHorizontal: 12, gap: 8,
  },
  input: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },

  suggestionsContainer: { paddingHorizontal: 16, paddingTop: 8 },
  section: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  clearText: { fontSize: 12, color: colors.textSubtle },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface },
  chipText: { fontSize: 13, color: colors.textMuted },

  resultsContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  productCard: { width: GRID_CARD_WIDTH, marginBottom: GRID_GAP + 6 },
  productThumb: { width: GRID_CARD_WIDTH, height: GRID_CARD_WIDTH, borderRadius: 10, marginBottom: 8, backgroundColor: colors.surface },
  productTitle: { fontSize: 13, color: colors.text, fontWeight: '500', lineHeight: 18 },
  productPrice: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontWeight: '600' },

  emptyState: { paddingTop: 24, alignItems: 'center' },
  emptyStateText: { fontSize: 13, color: colors.textSubtle },
});
