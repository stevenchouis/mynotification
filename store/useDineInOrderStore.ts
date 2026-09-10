// store/useDineInOrderStore.ts
// 堂食點餐的門市/桌位選擇 + 本次點餐清單，刻意只存在記憶體（不比照 useCartStore.ts 的 persist/SecureStore
// 做法）——這是「單次到店」情境，不需要跨 App 重啟或跨裝置保留，見 plan-dine-in-order.md 的
// Scope 說明。app/dine-in/restaurant.tsx 每次掛載都會呼叫 clear()，確保每次進點餐流程都是全新狀態。
// restaurantId/tableId 取代原本的 tableNumber 自由文字欄位，是 2026-09-10 多門市功能改版
// （選餐廳→選桌號→選餐，見 CLAUDE.md），兩者一定成對設定（setTable 一次到位，不單獨改其中一個）。
import { create } from 'zustand';

import { MenuItem } from '../types/dineIn';

export interface DineInCartItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
}

interface DineInOrderState {
  restaurantId: number | null;
  restaurantName: string;
  tableId: number | null;
  tableCode: string;
  items: DineInCartItem[];
  setTable: (restaurantId: number, restaurantName: string, tableId: number, tableCode: string) => void;
  addItem: (menuItem: MenuItem, quantity: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
  removeItem: (menuItemId: number) => void;
  clear: () => void;
}

export const useDineInOrderStore = create<DineInOrderState>()((set) => ({
  restaurantId: null,
  restaurantName: '',
  tableId: null,
  tableCode: '',
  items: [],
  setTable: (restaurantId, restaurantName, tableId, tableCode) =>
    set({ restaurantId, restaurantName, tableId, tableCode }),
  addItem: (menuItem, quantity) =>
    set((state) => {
      const existing = state.items.find((item) => item.menuItemId === menuItem.id);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.menuItemId === menuItem.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          ),
        };
      }
      return {
        items: [
          ...state.items,
          { menuItemId: menuItem.id, name: menuItem.name, price: menuItem.price, quantity },
        ],
      };
    }),
  updateQuantity: (menuItemId, quantity) =>
    set((state) => ({
      items: quantity <= 0
        ? state.items.filter((item) => item.menuItemId !== menuItemId)
        : state.items.map((item) =>
            item.menuItemId === menuItemId ? { ...item, quantity } : item
          ),
    })),
  removeItem: (menuItemId) =>
    set((state) => ({ items: state.items.filter((item) => item.menuItemId !== menuItemId) })),
  clear: () => set({ restaurantId: null, restaurantName: '', tableId: null, tableCode: '', items: [] }),
}));
