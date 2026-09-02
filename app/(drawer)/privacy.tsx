// app/(drawer)/privacy.tsx
import { ScrollView, StyleSheet, View } from 'react-native';

import Text from '../../components/Text';

export default function PrivacyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.updated}>最後更新日期：2026 年 9 月</Text>

      <Section title="我們蒐集哪些資料">
        <Bullet>帳號資料：Email、密碼（加密儲存）、生日</Bullet>
        <Bullet>第三方登入資料：使用 Google 登入時，會取得 Google 提供的 Email 與帳號識別碼（不會取得您的 Google 密碼）</Bullet>
        <Bullet>裝置推播 Token：用於發送推播通知，不含個人身分資訊</Bullet>
        <Bullet>頭像圖片：您主動上傳至個人資料的照片</Bullet>
        <Bullet>優惠券使用紀錄：核銷時間與核銷結果</Bullet>
      </Section>

      <Section title="資料的用途">
        <Bullet>驗證身分並讓您登入使用本 App</Bullet>
        <Bullet>發送與您帳號相關的推播通知</Bullet>
        <Bullet>提供優惠券查詢與核銷功能</Bullet>
        <Bullet>顯示您設定的個人資料與頭像</Bullet>
      </Section>

      <Section title="第三方服務">
        <Bullet>Google：用於「使用 Google 帳號登入」功能，僅用來驗證身分</Bullet>
        <Bullet>Resend：用於寄送 Email 連結登入信件</Bullet>
        <Bullet>Supabase：用於儲存您上傳的頭像圖片</Bullet>
        <Bullet>Expo：用於發送裝置推播通知</Bullet>
      </Section>

      <Section title="資料的保存與安全">
        <Text style={styles.paragraph}>
          登入憑證（JWT）僅儲存在您裝置的安全儲存區（SecureStore），不會以明文形式傳輸或儲存於伺服器。
          密碼採加密方式儲存，我們無法讀取您的原始密碼。透過 Email 連結或優惠券核銷產生的一次性驗證碼，
          伺服器僅儲存其雜湊值，並設有效期限與使用次數限制。
        </Text>
      </Section>

      <Section title="您的權利">
        <Text style={styles.paragraph}>
          您可以在「設定」頁面隨時更新個人資料與頭像。若需要刪除帳號或有其他資料相關的疑問，
          請透過下方聯絡方式與我們聯繫。
        </Text>
      </Section>

      <Section title="政策更新">
        <Text style={styles.paragraph}>
          本政策可能因功能調整而更新，重大變更會透過 App 內推播通知告知。
        </Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bullet}>・{children}</Text>;
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  updated: { fontSize: 12, color: '#B0AA9C', marginBottom: 20 },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#333333', marginBottom: 10 },
  bullet: { fontSize: 13, color: '#5C5449', lineHeight: 21, marginBottom: 4 },
  paragraph: { fontSize: 13, color: '#5C5449', lineHeight: 21 },
});
