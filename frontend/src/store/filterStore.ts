import { create } from "zustand";

interface FilterState {
  timeRange: [number, number] | null;
  userId: number | null;
  zone: number | null;
  eventType: number | null;
  setTimeRange: (r: [number, number] | null) => void;
  setUserId: (id: number | null) => void;
  setZone: (z: number | null) => void;
  setEventType: (t: number | null) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  timeRange: null,
  userId: null,
  zone: null,
  eventType: null,
  setTimeRange: (r) => set({ timeRange: r }),
  setUserId: (id) => set({ userId: id }),
  setZone: (z) => set({ zone: z }),
  setEventType: (t) => set({ eventType: t }),
  reset: () => set({ timeRange: null, userId: null, zone: null, eventType: null }),
}));
