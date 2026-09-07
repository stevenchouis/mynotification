// hooks/useShopFavorites.ts
// 商店收藏（願望清單）共用邏輯，商店 Grid、商品詳情頁、「我的」分頁的收藏區段都用這個 hook，
// 確保三個地方的收藏狀態永遠同步（同一份 TanStack Query 快取）。收藏是 DB 權威資料，
// 不像舊版 useFavoritesStore 存裝置本機——換裝置、重裝 App 都不會消失。
//
// 用 onMutate 做樂觀更新：點下愛心當下就先更新本機快取、圖示立刻變化，不用等後端回應，
// 體感才會是「按了馬上有反應」；如果後端請求失敗，onError 會把快取復原並跳 Toast 顯示錯誤，
// 不會讓使用者以為按了沒反應、卻不知道其實是哪裡出了問題。
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import Toast from 'react-native-toast-message';

import { addFavorite, fetchFavoriteProducts, removeFavorite } from '../services/shop';
import { ShopProduct } from '../types/shop';

const FAVORITES_KEY = ['shop-favorites'];

// 除錯用：把 axios 錯誤攤成「狀態碼 + 後端回應內容」的字串，直接顯示在 Toast 上，
// 不用還要去接 Metro 終端機的 log 才知道實際失敗原因
function describeError(error: any): string {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail ?? error?.message ?? '未知錯誤';
  return status ? `[${status}] ${detail}` : String(detail);
}

export function useShopFavorites() {
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery<ShopProduct[]>({
    queryKey: FAVORITES_KEY,
    queryFn: fetchFavoriteProducts,
  });

  const favoriteIds = useMemo(() => new Set(favorites.map((p) => p.id)), [favorites]);

  const addMutation = useMutation({
    mutationFn: (product: ShopProduct) => addFavorite(product.id),
    onMutate: async (product) => {
      await queryClient.cancelQueries({ queryKey: FAVORITES_KEY });
      const previous = queryClient.getQueryData<ShopProduct[]>(FAVORITES_KEY) ?? [];
      queryClient.setQueryData<ShopProduct[]>(FAVORITES_KEY, [product, ...previous]);
      return { previous };
    },
    onError: (error, _product, context) => {
      if (context) queryClient.setQueryData(FAVORITES_KEY, context.previous);
      console.warn('加入收藏失敗', error);
      Toast.show({ type: 'error', text1: '加入收藏失敗', text2: describeError(error), visibilityTime: 4000 });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: FAVORITES_KEY }),
  });

  const removeMutation = useMutation({
    mutationFn: (product: ShopProduct) => removeFavorite(product.id),
    onMutate: async (product) => {
      await queryClient.cancelQueries({ queryKey: FAVORITES_KEY });
      const previous = queryClient.getQueryData<ShopProduct[]>(FAVORITES_KEY) ?? [];
      queryClient.setQueryData<ShopProduct[]>(
        FAVORITES_KEY,
        previous.filter((p) => p.id !== product.id)
      );
      return { previous };
    },
    onError: (error, _product, context) => {
      if (context) queryClient.setQueryData(FAVORITES_KEY, context.previous);
      console.warn('取消收藏失敗', error);
      Toast.show({ type: 'error', text1: '取消收藏失敗', text2: describeError(error), visibilityTime: 4000 });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: FAVORITES_KEY }),
  });

  const toggleFavorite = (product: ShopProduct) => {
    if (favoriteIds.has(product.id)) {
      removeMutation.mutate(product);
    } else {
      addMutation.mutate(product);
    }
  };

  return { favorites, favoriteIds, isLoading, toggleFavorite };
}
