// app/+native-intent.tsx
// Expo Router 在處理外部打開 App 的連結（deep link）之前，會先呼叫這裡的 redirectSystemPath 改寫路徑。
//
// 推薦連結（見 plan-referral.md）mynotification://register?ref=XXXXXX 指向註冊頁，但 register 只註冊在
// 未登入的 Stack.Protected 分支裡；已登入時點連結，導覽器找不到這個畫面會報
// 「The 'state' or 'screen' passed in the params couldn't be applied to the navigator」（使用者 2026-11-08 實測）。
// 所以已登入時改導到 /referral?code=XXXXXX：還能補填推薦碼的帳號會看到輸入框已帶好朋友的碼。
//
// 冷啟動時 useAuthStore 的 token 可能還沒讀完，這裡直接讀 SecureStore（跟 useAuthStore 用同一個 key）。
import * as SecureStore from 'expo-secure-store';

const REGISTER_LINK = /(?:^|\/)register(?:\?|$)/;

export async function redirectSystemPath({ path }: { path: string | null; initial: boolean }) {
  if (!path || !REGISTER_LINK.test(path.replace(/^[a-z]+:\/\//i, ''))) return path;

  try {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) return path;

    const ref = path.match(/[?&]ref=([^&#]+)/)?.[1];
    return ref ? `/referral?code=${ref}` : '/referral';
  } catch {
    // 讀不到登入狀態就照原路徑，最壞情況是導覽器報找不到畫面，不會閃退
    return path;
  }
}
