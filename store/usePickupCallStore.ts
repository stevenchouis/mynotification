// store/usePickupCallStore.ts
// 取餐叫號全螢幕彈窗要顯示哪一筆（見 plan-dine-in-pickup-call.md）。純 UI 狀態，比照
// useNotificationStore：不抓資料，只由 (tabs)/_layout.tsx 的前景推播監聽器寫入、
// components/PickupCallModal.tsx 讀取與關閉。
import { create } from 'zustand';

export interface PickupCall {
  orderId: number;
  pickupNumber: number | null;
}

interface PickupCallState {
  call: PickupCall | null;
  show: (call: PickupCall) => void;
  dismiss: () => void;
}

export const usePickupCallStore = create<PickupCallState>((set) => ({
  call: null,
  // 連續收到多次叫號（店員再叫一次）時直接覆蓋成最新一筆，不排隊
  show: (call) => set({ call }),
  dismiss: () => set({ call: null }),
}));
