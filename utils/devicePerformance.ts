/**
 * CoVision Edge & Embedded Performance Utility
 * Specifically optimized for:
 * - NVIDIA Jetson Orin Nano / Orin NX / AGX Orin (Ampere architecture, Tensor Cores, high GPU performance)
 * - NVIDIA Jetson Nano / TX2 / Xavier (Maxwell / Volta architecture)
 * - Raspberry Pi 5 & 4
 * - Desktop Chrome / Chromium
 */

// Check query param override for manual debugging (e.g. ?perf=low or ?perf=high or ?perf=orin)
const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const forcedPerf = urlParams?.get('perf');

// Query WebGL unmasked renderer string
function detectGpuRenderer(): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';
    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return '';
    return ((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
  } catch {
    return '';
  }
}

const gpuRenderer = detectGpuRenderer();

// Embedded and hardware heuristics
const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '').toLowerCase() : '';
const isArmLinux = /arm|aarch64|raspberry|jetson|tegra/i.test(ua);
const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 8) : 8;
const memory = typeof navigator !== 'undefined' ? ((navigator as any).deviceMemory || 8) : 8;

const hasNvidiaTegra = /nvidia|tegra|nvgpu/i.test(gpuRenderer) || /tegra|jetson/i.test(ua);
const isOrinArchitecture = /orin|ampere/i.test(gpuRenderer) || (isArmLinux && hasNvidiaTegra && cores >= 6);

/**
 * Specifically NVIDIA Jetson Orin Nano / Orin NX / AGX Orin
 * Features: 1024-core Ampere GPU, Tensor Cores, 6+ ARM Cortex-A78AE cores.
 * High-performance edge AI system — capable of full 30-60 FPS real-time MediaPipe inference!
 */
export const isJetsonOrin: boolean = (() => {
  if (forcedPerf === 'orin') return true;
  if (forcedPerf === 'low') return false;
  return isOrinArchitecture;
})();

/**
 * Original NVIDIA Jetson Nano (Maxwell GPU, 4 Cortex-A57 cores)
 */
export const isJetsonNano: boolean = (() => {
  if (forcedPerf === 'orin') return false;
  return hasNvidiaTegra && !isJetsonOrin;
})();

/**
 * Any NVIDIA Jetson platform
 */
export const isJetson: boolean = isJetsonOrin || isJetsonNano || hasNvidiaTegra;

/**
 * Low power device flag:
 * Jetson Orin Nano is an AI powerhouse with Ampere GPU and is NOT considered low-power.
 * Original Jetson Nano (4 cores) or low-end Raspberry Pi/phones ARE considered low-power CPU.
 */
export const isLowPowerDevice: boolean = (() => {
  if (forcedPerf === 'high' || forcedPerf === 'orin') return false;
  if (forcedPerf === 'low') return true;
  if (isJetsonOrin) return false; // Jetson Orin has ample GPU power!
  if (isJetsonNano) return true;  // Original Nano benefits from lightweight canvas
  // Raspberry Pi or 4-core low-memory devices
  return isArmLinux || cores <= 4 || memory <= 4;
})();

/**
 * Returns dynamic minimum delay (ms) before triggering the next MediaPipe inference frame.
 * On Jetson Orin Nano: 0ms (runs at native camera frame rate ~30 FPS with zero lag!).
 * On high-end desktop: 0ms (immediate).
 * On Jetson Nano / RPi: budgets smoothly based on actual hardware execution duration.
 */
export function getAdaptiveInferenceInterval(lastInferenceDurationMs: number): number {
  // Jetson Orin Nano & High-End Desktop: zero artificial throttling
  if (isJetsonOrin || forcedPerf === 'orin' || forcedPerf === 'high') {
    return 0;
  }

  // Original Jetson Nano with hardware WebGL:
  if (isJetsonNano) {
    if (lastInferenceDurationMs <= 25) return 0; // GPU running fast, don't throttle!
    if (lastInferenceDurationMs <= 40) return 20; // Steady ~30 FPS
    return Math.min(45, Math.round(lastInferenceDurationMs * 1.1));
  }

  // General low-power hardware
  if (isLowPowerDevice) {
    if (lastInferenceDurationMs > 35) {
      return Math.max(40, Math.round(lastInferenceDurationMs * 1.2));
    }
    return 25;
  }

  // Standard desktop: 0ms cap (natural camera frame rate)
  return 0;
}

/**
 * Recommended background particle count based on device capability
 */
export const RECOMMENDED_PARTICLE_COUNT: number = (isJetson || isLowPowerDevice) ? 0 : 18;

/**
 * Helper to check if heavy shadow blur should be avoided.
 * Embedded ARM / Jetson 2D canvas should use crisp hardware strokes instead of Gaussian shadowBlur.
 */
export const SUPPORTS_EXPENSIVE_SHADOWS: boolean = !isJetson && !isLowPowerDevice;
