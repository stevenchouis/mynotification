// services/lineAuth.ts
// LINE 登入：改用原生 SDK（@xmartlabs/react-native-line），架構比照 services/googleAuth.ts——
// 原生畫面/跳轉 LINE App 完成授權後，直接在 Promise 裡拿到憑證，全程不經過瀏覽器、不需要
// 任何 Deep Link 轉跳（取代舊版「瀏覽器版 OAuth + 後端中繼落地頁」的做法，見 plan-line-login.md）。
// 這支檔案只負責「跟 LINE 拿到憑證」，不呼叫自家後端（呼叫 /login/line、completeLogin() 收尾
// 都留在 app/index.tsx 的 onLineLogin）。
//
// scopes 帶 Scope.OpenId 才會在回應裡拿到 idToken（OIDC ID Token，JWT，內含 LINE 使用者 sub）；
// 後端只驗證這個 idToken（比照 Google 登入），已跟 back-end session 確認不需要額外傳 nonce。
import Line, { Scope } from '@xmartlabs/react-native-line';

const CHANNEL_ID = process.env.EXPO_PUBLIC_LINE_CHANNEL_ID!;

// Line.setup() 是非同步的，且官方規定「必須在呼叫其他方法前完成」；用模組層級的 Promise
// 快取起來，確保多次呼叫 signInWithLine() 只會真正 setup 一次、且都會等它完成。
let setupPromise: Promise<void> | null = null;
function ensureSetup(): Promise<void> {
  if (!setupPromise) {
    setupPromise = Line.setup({ channelId: CHANNEL_ID });
  }
  return setupPromise;
}

// 回傳 LINE idToken；使用者中途取消授權時回傳 null（不視為錯誤，比照 signInWithGoogle）。
// 取消的錯誤格式各平台不一致：Android 是 error.code === 'LOGIN_CANCELLED'，
// iOS／Web 目前觀察到的是訊息字串裡包含 "cancel"，所以兩種都要檢查。
export async function signInWithLine(): Promise<string | null> {
  try {
    await ensureSetup();
    const result = await Line.login({ scopes: [Scope.Profile, Scope.OpenId] });

    if (!result.accessToken.idToken) {
      throw new Error('未取得 LINE ID Token');
    }

    return result.accessToken.idToken;
  } catch (error: any) {
    if (error?.code === 'LOGIN_CANCELLED' || /cancel/i.test(error?.message ?? '')) {
      return null;
    }
    throw error;
  }
}
