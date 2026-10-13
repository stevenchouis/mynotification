// components/DebugErrorBoundary.tsx
// 暫時除錯用（見 plan.md「已登入卻出現兩次 Welcome 畫面」待查）：有些渲染錯誤在開發模式下
// 會被 Fast Refresh 的自動恢復機制蓋掉、畫面一閃就消失，來不及看清楚內容。這個元件把捕捉到的
// 錯誤完整印到終端機，排查完會拿掉。
import { Component, ReactNode } from 'react';
import { Text, View } from 'react-native';

export default class DebugErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.log('[DEBUG] DebugErrorBoundary 攔截到渲染錯誤：', error.message);
    console.log('[DEBUG] componentStack：', info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' }}>
          <Text style={{ color: 'red', fontWeight: 'bold', marginBottom: 12 }}>渲染錯誤（除錯用）</Text>
          <Text style={{ color: '#333' }}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}
