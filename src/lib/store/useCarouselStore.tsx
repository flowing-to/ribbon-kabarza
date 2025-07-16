import { create } from "zustand";

type CarouselState = {
  hovered: boolean;
  setHovered: (hovered: boolean) => void;
  currentText: number;
  setCurrentText: (currentText: number) => void;
  carouselReady: boolean;
  setIsCarouselReady: (carouselReady: boolean) => void;
};

export const useCarouselStore = create<CarouselState>((set) => ({
  hovered: false,
  setHovered: (hovered) => set({ hovered }),
  currentText: 0,
  setCurrentText: (currentText) => set({ currentText }),
  carouselReady: false,
  setIsCarouselReady: (carouselReady) => set({ carouselReady }),
}));
