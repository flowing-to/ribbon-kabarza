/// <reference types="vite/client" />

declare global {
  interface Window {
    onFlowingRibbonStart: (() => void)[];
    onFlowingCarouselSlideVisible: ((index:number) => void)[];
    onFlowingRibbonEnd: (() => void)[];
    onFlowingClick: ((index:number) => void)[];
    offFlowingClick: ((index:number) => void)[];
  }
}

export {};