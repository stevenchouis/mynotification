// app/einvoice-carrier.tsx
// 電子發票載具（財政部手機條碼，見 plan-einvoice-carrier.md）。從 settings.tsx「帳號管理」進來，
// 掛在 app/_layout.tsx 的 userToken 分支。存在後端會員資料（PUT /users/me 的 einvoice_carrier），
// 下單時後端自動把當下的載具記在訂單上，這裡只負責設定／清除與出示條碼。只檢查格式，不向財政部驗證。
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import CarrierBarcode from '../components/CarrierBarcode';
import Text from '../components/Text';
import { ThemeColors } from '../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { USER_PROFILE_QUERY_KEY, fetchMyProfile, updateEinvoiceCarrier } from '../services/users';
import { EINVOICE_CARRIER_PATTERN, normalizeEinvoiceCarrier } from '../types/einvoice';

export default function EinvoiceCarrierScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({ queryKey: USER_PROFILE_QUERY_KEY, queryFn: fetchMyProfile });
  const savedCarrier = profile?.einvoice_carrier ?? null;

  // 沒綁定時直接顯示輸入框；已綁定時先顯示條碼，按「修改」才出現輸入框
  const [isEditing, setIsEditing] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!isLoading && !savedCarrier) setIsEditing(true);
  }, [isLoading, savedCarrier]);

  const normalized = normalizeEinvoiceCarrier(input);
  const isValid = EINVOICE_CARRIER_PATTERN.test(normalized);
  // 打了字但格式還不對才提示，空白時不顯示紅字
  const showFormatHint = input.length > 0 && !isValid;

  const saveMutation = useMutation({
    mutationFn: (carrier: string | null) => updateEinvoiceCarrier(carrier),
    onSuccess: (_data, carrier) => {
      queryClient.invalidateQueries({ queryKey: USER_PROFILE_QUERY_KEY });
      setIsEditing(carrier === null);
      setInput('');
      Toast.show({ type: 'success', text1: carrier ? '已儲存發票載具' : '已清除發票載具' });
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.error_code === 'invalid_einvoice_carrier') {
        Alert.alert('格式不正確', detail.message || '手機條碼是「/」加 7 碼英數字');
      } else {
        Alert.alert('儲存失敗', '目前無法儲存，請檢查網路後再試');
      }
    },
  });

  const handleSave = () => {
    if (!isValid || saveMutation.isPending) return;
    saveMutation.mutate(normalized);
  };

  const handleClear = () => {
    Alert.alert('清除發票載具', '清除後，之後的消費不會再自動帶入載具。確定要清除嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '清除', style: 'destructive', onPress: () => saveMutation.mutate(null) },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        // edgeToEdgeEnabled：整個捲動區在 Android 導覽列上方截止（見 CLAUDE.md SafeArea 規則）
        style={[styles.container, { marginBottom: insets.bottom }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {savedCarrier && !isEditing && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>我的手機條碼</Text>
            <View style={styles.barcodeArea}>
              <CarrierBarcode carrier={savedCarrier} />
            </View>
            <Text style={styles.hint}>結帳時出示給店員掃描；網購、堂食與門市結帳也會自動記在訂單上</Text>
            <View style={styles.actionRow}>
              <Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={() => setIsEditing(true)}>
                <Text style={styles.secondaryButtonText}>修改</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, styles.dangerButton, { flex: 1 }]}
                onPress={handleClear}
                disabled={saveMutation.isPending}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>清除</Text>
              </Pressable>
            </View>
          </View>
        )}

        {isEditing && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{savedCarrier ? '修改手機條碼' : '設定手機條碼'}</Text>
            <TextInput
              style={[styles.input, showFormatHint && styles.inputError]}
              value={input}
              onChangeText={(text) => setInput(normalizeEinvoiceCarrier(text))}
              placeholder="/ABC1234"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
            />
            {showFormatHint ? (
              <Text style={styles.errorText}>格式是「/」加 7 碼（英文大寫、數字或 + - .）</Text>
            ) : (
              <Text style={styles.hint}>請仔細核對，打錯一個字發票會開不到你的載具</Text>
            )}
            <Pressable
              style={[styles.primaryButton, (!isValid || saveMutation.isPending) && styles.primaryButtonDisabled]}
              onPress={handleSave}
              disabled={!isValid || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator color={colors.onTint} />
              ) : (
                <Text style={[styles.primaryButtonText, !isValid && styles.primaryButtonTextDisabled]}>儲存</Text>
              )}
            </Pressable>
            {savedCarrier && (
              <Pressable style={styles.cancelLink} onPress={() => { setIsEditing(false); setInput(''); }}>
                <Text style={styles.cancelLinkText}>取消</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>什麼是手機條碼？</Text>
          <Text style={styles.noteText}>・手機條碼是財政部提供的雲端發票載具，消費時出示，發票會自動存到你的載具，不用保存紙本</Text>
          <Text style={styles.noteText}>・還沒有的話，可以到「財政部電子發票整合服務平台」網站或「統一發票兌獎」App 免費申請</Text>
          <Text style={styles.noteText}>・格式是「/」加 7 碼，例如 /ABC1234</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16 },
  cardLabel: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 12 },
  barcodeArea: { alignItems: 'center', marginBottom: 12 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  errorText: { fontSize: 12, color: colors.danger, marginTop: 6 },

  input: {
    height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingHorizontal: 14, fontSize: 20, color: colors.text, letterSpacing: 3,
  },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerSurface },

  primaryButton: {
    height: 46, borderRadius: 12, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  primaryButtonDisabled: { backgroundColor: colors.surfaceAlt },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: colors.onTint },
  primaryButtonTextDisabled: { color: colors.textSubtle },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  secondaryButton: {
    height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dangerButton: { borderColor: colors.danger },
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: colors.text },
  cancelLink: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  cancelLinkText: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'underline' },

  noteBox: { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: colors.surface },
  noteTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  noteText: { fontSize: 12, color: colors.textMuted, lineHeight: 20 },
});
