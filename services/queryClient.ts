// services/queryClient.ts
// 全站唯一的 TanStack Query QueryClient。獨立成模組（而不是寫在 app/_layout.tsx 裡）是因為
// useAuthStore 換人登入/登出時需要清空快取，store 檔案沒辦法從 _layout 反向 import。
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});
