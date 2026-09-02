// services/googleAuth.ts
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  offlineAccess: false,
});

// 回傳 Google id_token；使用者在帳號選擇畫面按下取消時回傳 null（不視為錯誤）
export async function signInWithGoogle(): Promise<string | null> {
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();

    if (isCancelledResponse(response)) {
      return null;
    }
    if (!isSuccessResponse(response) || !response.data.idToken) {
      throw new Error('未取得 Google idToken');
    }
    return response.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    throw error;
  }
}
