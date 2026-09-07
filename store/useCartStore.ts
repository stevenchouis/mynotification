// store/useCartStore.ts
// 購物車，只存在裝置本機，比照 useFavoritesStore.ts 的做法（Zustand persist + SecureStore），
// 不需要跨裝置同步（已跟使用者確認）。存的是「加入購物車當下」的商品快照（標題/縮圖/價格），
// 不是即時 join 商店 API 的最新資料——價格/庫存最終都以後端 POST /orders 的回應為準，
// 這裡顯示的小計只是給使用者看的估算值。
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { ShopProduct } from '../types/shop';

export interface CartItem {
  productId: number;
  title: string;
  thumbnail: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: ShopProduct, quantity: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clear: () => void;
}

// zustand persist middleware 需要 { getItem, setItem, removeItem } 介面，包一層 SecureStore
const secureJSONStorage = {
  getItem: async (name: string) => (await SecureStore.getItemAsync(name)) ?? null,
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (product, quantity) =>
        set((state) => {
          const existing = state.items.find((item) => item.productId === product.id);
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.productId === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                title: product.title,
                thumbnail: product.thumbnail,
                price: product.price,
                quantity,
              },
            ],
          };
        }),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter((item) => item.productId !== productId)
            : state.items.map((item) =>
                item.productId === productId ? { ...item, quantity } : item
              ),
        })),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'shop-cart-items',
      storage: createJSONStorage(() => secureJSONStorage),
    }
  )
);
