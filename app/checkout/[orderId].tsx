// app/checkout/[orderId].tsx
// ECPay 結帳頁：從 app/cart.tsx 送出訂單成功後導航進來。呼叫 startOrderCheckout 拿到
// 「收銀台網址 + 已簽章的 hidden fields」，組成一個 onload 自動送出的 HTML 表單丟給 WebView
// 顯示（AioCheckOut 是 POST 表單送出，不能直接開一個 GET 網址）。
//
// 付款完成後 ECPay 會把使用者的瀏覽器導去後端組好的 ClientBackURL（deep link，
// 格式 mynotification://order/{orderId}/result，跟 back-end session 確認過，見 CLAUDE.md
// ECPay 章節）。在 WebView 內用 onShouldStartLoadWithRequest 攔截這個 custom scheme，
// 直接在 App 內導頁，不讓 WebView 真的嘗試開啟它（開了也只會失敗，custom scheme 不是真的網址）。
//
// 2026-09-14：跟 back-end 對過契約但對方尚未實作 POST /orders/{id}/checkout，
// 這支畫面先寫好、呼叫失敗時顯示錯誤畫面即可，等後端端點上線後不用再改前端。
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';

import Text from '../../components/Text';
import { ThemeColors } from '../../constants/Colors';
import { useThemeColors } from '../../hooks/useThemeColors';
import { startOrderCheckout } from '../../services/shop';
import { CheckoutForm } from '../../types/shop';

// ECPay ClientBackURL 導回來的 deep link，跟 back-end 約定的格式：mynotification://order/{id}/result
const RESULT_DEEP_LINK_PREFIX = 'mynotification://order/';

function escapeHtmlAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 把後端回傳的 action_url + fields 組成一個載入就自動 submit 的表單頁面，
// AioCheckOut 規定用 POST 送出，WebView 不能直接用 source={{ uri }} 開 GET 網址。
// 明確宣告 <meta charset="utf-8">：ItemName/TradeDesc 等欄位含中文，Android WebView
// 載入沒宣告編碼的原始 HTML 字串時，中文字有機率被系統用非 UTF-8 編碼重新編碼一次才送出，
// 導致 ECPay 收到的位元組跟後端算 CheckMacValue 簽章時用的不一致（CheckMacValue Error）
function buildAutoSubmitHtml(form: CheckoutForm): string {
  const inputs = Object.entries(form.fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtmlAttr(name)}" value="${escapeHtmlAttr(value)}" />`)
    .join('\n');
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body onload="document.forms[0].submit()">
    <form method="POST" action="${escapeHtmlAttr(form.action_url)}">
      ${inputs}
    </form>
  </body>
</html>`;
}

// btoa 只能處理 Latin1 範圍的字元，中文字需要先用 encodeURIComponent/unescape 轉成
// Latin1-safe 的位元組字串再編碼，這是瀏覽器環境常見的 UTF-8 安全 base64 編碼寫法
function utf8ToBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

export default function CheckoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm | null>(null);

  useEffect(() => {
    let cancelled = false;
    startOrderCheckout(Number(orderId))
      .then((form) => {
        if (cancelled) return;
        setCheckoutForm(form);
        setStatus('ready');
      })
      .catch((error: any) => {
        if (cancelled) return;
        setErrorMessage(error.response?.data?.detail || '無法開啟付款頁，請稍後再試');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const goToOrderResult = () => {
    queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    queryClient.invalidateQueries({ queryKey: ['loyalty-balance'] });
    queryClient.invalidateQueries({ queryKey: ['loyalty-transactions'] });
    router.replace(`/order/${orderId}`);
  };

  const handleShouldStartLoad = (request: WebViewNavigation) => {
    if (request.url.startsWith(RESULT_DEEP_LINK_PREFIX)) {
      goToOrderResult();
      return false;
    }
    return true;
  };

  if (status === 'loading') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={styles.loadingText}>正在開啟付款頁，請稍候...</Text>
      </View>
    );
  }

  if (status === 'error' || !checkoutForm) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable style={styles.button} onPress={goToOrderResult}>
          <Text style={styles.buttonText}>查看訂單狀態</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <WebView
      style={styles.webview}
      originWhitelist={['*']}
      // 用 data: URI 明確帶 charset=utf-8 + base64 內容載入，比 source={{ html }} 更可靠——
      // 後者在 Android 上是呼叫 loadDataWithBaseURL 載入原始字串，實測遇過中文欄位被系統
      // 重新編碼導致送給 ECPay 的位元組跟後端算 CheckMacValue 簽章時不一致（CheckMacValue Error）
      source={{ uri: `data:text/html;charset=utf-8;base64,${utf8ToBase64(buildAutoSubmitHtml(checkoutForm))}` }}
      onShouldStartLoadWithRequest={handleShouldStartLoad}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      )}
    />
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  webview: { flex: 1, backgroundColor: colors.background },
  centerContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 30, backgroundColor: colors.background,
  },
  loadingText: { marginTop: 16, fontSize: 15, color: colors.textMuted },
  errorText: { fontSize: 15, color: colors.danger, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: colors.tint, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  buttonText: { color: colors.onTint, fontSize: 16, fontWeight: 'bold' },
});
