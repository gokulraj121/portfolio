// Simple global memory store to sync state between Header and pages across client-side navigations
export const globalStore = {
  hasLoaded: false,
  portalState: 'idle', // 'idle' | 'collapsing' | 'loading' | 'expanding'
  targetRoute: null,
  
  // New flags for true asset loading tracking
  isRouteReady: false,
  isCanvasReady: false,
};
