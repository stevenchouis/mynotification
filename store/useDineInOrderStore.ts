// store/useDineInOrderStore.ts
// 堂食點餐的桌號 + 本次點餐清單，刻意只存在記憶體（不比照 useCartStore.ts 的 persist/SecureStore
// 做法）——這是「單次到店」情境，不需要跨 App 重啟或跨裝置保留，見 plan-dine-in-order.md 的
// Scope 說明。app/dine-in/table.tsx 每次掛載都會呼叫 clear()，確保每次進點餐流程都是全新狀態。
import { create } from 'zustand';

import { MenuItem } from '../types/dineIn';

export interface DineInCartItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
}

interface DineInOrderState {
  tableNumber: string;
  items: DineInCartItem[];
  setTableNumber: (tableNumber: string) => void;
  addItem: (menuItem: MenuItem, quantity: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
  removeItem: (menuItemId: number) => void;
  clear: () => void;
}

export const useDineInOrderStore = create<DineInOrderState>()((set) => ({
  tableNumber: '',
  items: [],
  setTableNumber: (tableNumber) => set({ tableNumber }),
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
  clear: () => set({ tableNumber: '', items: [] }),
}));
