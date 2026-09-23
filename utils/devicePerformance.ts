/**
 * CoVision Edge & Embedded Performance Utility
 * Optimized for Nvidia Jetson Nano, Raspberry Pi 5 (8GB), and low-power ARM hardware.
 */

// Check query param override for manual debugging (e.g. ?perf=low or ?perf=high)
const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const forcedPerf = urlParams?.get('perf');

// Embedded and low-power hardware heuristics
export const isLowPowerDevice: boolean = (() => {
  if (forcedPerf === 'low') return true;
  if (forcedPerf === 'high') return false;
  if (typeof navigator === 'undefined') return false;

  const ua = (navigator.userAgent || '').toLowerCase();
  const isArmLinux = /arm|aarch64|raspberry|jetson/i.test(ua);
  const cores = navigator.hardwareConcurrency || 8;
  const memory = (navigator as any).deviceMemory || 8;

  // Jetson Nano: 4 cores, 2-4GB RAM, ARM Linux
  // Raspberry Pi 5: 4 cores, ARM Linux
  // Low-end mobile / laptops: <= 4 cores or <= 4GB RAM
  return isArmLinux || cores <= 4 || memory <= 4;
})();

/**
 * Returns dynamic minimum delay (ms) before triggering the next MediaPipe inference frame.
 * On high-end desktop: caps at ~30 FPS (33ms).
 * On Jetson / RPi: budgets inference to leave at least 30-40% of the JS event loop idle
 * so video playback, Web Audio, canvas rendering, and UI remain 100% smooth.
 */
export function getAdaptiveInferenceInterval(lastInferenceDurationMs: number): number {
  if (isLowPowerDevice) {
    if (lastInferenceDurationMs > 35) {
      // Very heavy inference (e.g. Jetson Nano CPU fallback) -> budget ~20 FPS (50ms)
      return Math.max(50, Math.round(lastInferenceDurationMs * 1.4));
    }
    if (lastInferenceDurationMs > 20) {
      // Moderate inference (e.g. RPi 5 CPU or GPU) -> budget ~25 FPS (40ms)
      return Math.max(40, Math.round(lastInferenceDurationMs * 1.3));
    }
    // Fast embedded inference -> budget 28-30 FPS (35ms)
    return 35;
  }

  // Standard / High-end hardware: steady 30 FPS cap
  return 33;
}

/**
 * Recommended background particle count based on device capability
 */
export const RECOMMENDED_PARTICLE_COUNT: number = isLowPowerDevice ? 8 : 24;

/**
 * Helper to check if heavy shadow blur should be avoided
 */
export const SUPPORTS_EXPENSIVE_SHADOWS: boolean = !isLowPowerDevice;
