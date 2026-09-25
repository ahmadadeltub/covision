import React, { useEffect, useRef, useState, RefObject } from 'react';
import { isLowPowerDevice } from '../utils/devicePerformance';

// ─── 22-SECOND FLUSHING CYCLE CONFIGURATION ───
export const FLUSH_CYCLE_DURATION = 22.0; // Exactly 22 seconds total cycle

export interface FlushCycleState {
  cycleSeconds: number; // 0.0 to 22.0
  cycleProgress: number; // 0.0 to 1.0
  globalAlpha: number; // 0.0 (hidden) to 1.0 (fully showing)
  phase: 'showing' | 'flushing' | 'active' | 'hidden';
  phaseLabel: string;
  wavePos: number; // 0.0 to 1.0 diagonal wave position
  waveActive: boolean;
}

/**
 * Calculates the exact state of the 22-second flushing cycle at any time
 */
export function getFlushCycleState(timeSec?: number): FlushCycleState {
  const now = timeSec !== undefined ? timeSec : (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000);
  const cycleSeconds = now % FLUSH_CYCLE_DURATION;
  const cycleProgress = cycleSeconds / FLUSH_CYCLE_DURATION;

  let globalAlpha = 1.0;
  let phase: 'showing' | 'flushing' | 'active' | 'hidden' = 'active';
  let phaseLabel = 'ACTIVE MATRIX';
  let wavePos = 0;
  let waveActive = false;

  // 1. Phase 1: Showing / Emergence (0.0s - 5.0s)
  if (cycleSeconds < 5.0) {
    phase = 'showing';
    phaseLabel = 'SHOWING · NEURAL WAKE';
    const p = cycleSeconds / 5.0; // 0 to 1
    // Smooth sine ease in
    globalAlpha = 0.5 - 0.5 * Math.cos(p * Math.PI);
  }
  // 2. Phase 2: High-Energy Quantum Flush Wave (5.0s - 12.0s)
  else if (cycleSeconds < 12.0) {
    phase = 'flushing';
    phaseLabel = 'QUANTUM WAVE FLUSH';
    globalAlpha = 1.0;
    waveActive = true;
    wavePos = (cycleSeconds - 5.0) / 7.0; // 0.0 to 1.0 sweep
  }
  // 3. Phase 3: Active AI Constellation Shimmer (12.0s - 17.0s)
  else if (cycleSeconds < 17.0) {
    phase = 'active';
    phaseLabel = 'ACTIVE AI MATRIX';
    const subP = (cycleSeconds - 12.0) / 5.0;
    // Ambient breathing
    globalAlpha = 0.90 + 0.10 * Math.sin(subP * Math.PI * 2);
  }
  // 4. Phase 4: Dissolving / Stealth Mode (17.0s - 22.0s)
  else {
    phase = 'hidden';
    phaseLabel = 'STEALTH · DISSOLVING';
    const p = (cycleSeconds - 17.0) / 5.0; // 0 to 1
    // Smooth sine ease out
    globalAlpha = 0.5 + 0.5 * Math.cos(p * Math.PI);
  }

  return {
    cycleSeconds,
    cycleProgress,
    globalAlpha: Math.max(0, Math.min(1, globalAlpha)),
    phase,
    phaseLabel,
    wavePos,
    waveActive,
  };
}

/**
 * Hook to read the current 22-second flushing phase in React UI (updates ~10fps for badges)
 */
export function useAiDotsFlushPhase(): FlushCycleState {
  const [state, setState] = useState<FlushCycleState>(() => getFlushCycleState());

  useEffect(() => {
    let animId: number;
    let lastUpdate = 0;

    const tick = (now: number) => {
      if (now - lastUpdate > 100) { // 10 updates per second is plenty for HUD text
        setState(getFlushCycleState(now / 1000));
        lastUpdate = now;
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  return state;
}

// ─── PARTICLE INTERFACE ───
interface DotParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  layer: number; // 0: micro-dot, 1: neural node, 2: quantum beacon
  hue: number;
  pulsePhase: number;
  pulseSpeed: number;
  reticleType: number; // 0: simple node, 1: crosshair, 2: halo ring
}

// ─── 1. CAMERA BACKGROUND AI DOTS CANVAS (INSIDE CAMERA FRAME) ───
interface CameraDotsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  faceLandmarksRef?: RefObject<any[] | null>;
  isScanning?: boolean;
}

export const AiCameraDotsCanvas: React.FC<CameraDotsProps> = ({
  videoRef,
  faceLandmarksRef,
  isScanning = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let cancelled = false;

    // Responsive dot count
    const dotCount = isLowPowerDevice ? 24 : 48;
    const particles: DotParticle[] = [];

    const initParticles = (w: number, h: number) => {
      particles.length = 0;
      for (let i = 0; i < dotCount; i++) {
        const layer = Math.random() < 0.4 ? 0 : Math.random() < 0.8 ? 1 : 2;
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * (0.35 + layer * 0.15),
          vy: (Math.random() - 0.5) * (0.35 + layer * 0.15),
          baseRadius: layer === 0 ? 1.2 : layer === 1 ? 2.0 : 3.2,
          layer,
          hue: 185 + Math.random() * 25, // Cyan to electric blue
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 1.5 + Math.random() * 2.0,
          reticleType: Math.random() < 0.35 ? 1 : Math.random() < 0.6 ? 2 : 0,
        });
      }
    };

    const resize = () => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw > 0 && ch > 0 && (canvas.width !== cw || canvas.height !== ch)) {
        canvas.width = cw;
        canvas.height = ch;
        if (particles.length === 0) initParticles(cw, ch);
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      if (cancelled) return;

      const cw = canvas.width;
      const ch = canvas.height;

      if (cw > 0 && ch > 0) {
        ctx.clearRect(0, 0, cw, ch);

        const now = performance.now() / 1000;
        const flushState = getFlushCycleState(now);
        const { globalAlpha, waveActive, wavePos } = flushState;

        // Only draw if not completely hidden (alpha > 0.005)
        if (globalAlpha > 0.005) {
          // Determine face center in mirrored camera coordinate space
          let faceX = cw / 2;
          let faceY = ch * 0.48;
          let faceRadius = Math.min(cw, ch) * 0.35;
          let hasFace = false;

          const landmarks = faceLandmarksRef?.current;
          const vid = videoRef.current;

          if (landmarks && landmarks.length > 0 && vid && vid.videoWidth > 0 && vid.videoHeight > 0) {
            hasFace = true;
            // Map video object-cover scaling
            const videoAspect = vid.videoWidth / vid.videoHeight;
            const canvasAspect = cw / ch;
            let displayedW = cw;
            let displayedH = ch;
            let offsetX = 0;
            let offsetY = 0;

            if (canvasAspect > videoAspect) {
              displayedW = cw;
              displayedH = cw / videoAspect;
              offsetY = (ch - displayedH) / 2;
            } else {
              displayedH = ch;
              displayedW = ch * videoAspect;
              offsetX = (cw - displayedW) / 2;
            }

            const toX = (nx: number) => offsetX + nx * displayedW;
            const toY = (ny: number) => offsetY + ny * displayedH;

            // Video has CSS scale-x-[-1] so mirror horizontally
            if (landmarks[1]) {
              faceX = cw - toX(landmarks[1].x);
              faceY = toY(landmarks[1].y);
            }
            if (landmarks[454] && landmarks[234] && landmarks[10] && landmarks[152]) {
              const faceW = Math.abs(toX(landmarks[454].x) - toX(landmarks[234].x));
              const faceH = Math.abs(toY(landmarks[152].y) - toY(landmarks[10].y));
              faceRadius = Math.max(faceW, faceH) * 0.72;
            }
          }

          // Screen diagonal for sweeping wave
          const totalDiag = cw + ch;
          const currentWaveCoord = waveActive ? wavePos * (totalDiag + 200) - 100 : -999;

          // 1. Draw subtle ambient holographic scanning wave band when flushing
          if (waveActive) {
            ctx.save();
            const waveAngle = Math.PI / 4; // 45 degree diagonal
            const waveX = (currentWaveCoord / totalDiag) * cw;
            const waveGrad = ctx.createLinearGradient(
              waveX - 80, 0,
              waveX + 80, ch
            );
            waveGrad.addColorStop(0, 'rgba(0, 243, 255, 0)');
            waveGrad.addColorStop(0.5, `rgba(0, 243, 255, ${0.12 * globalAlpha})`);
            waveGrad.addColorStop(1, 'rgba(0, 243, 255, 0)');
            ctx.fillStyle = waveGrad;
            ctx.fillRect(0, 0, cw, ch);
            ctx.restore();
          }

          // 2. Connect nearby dots with synaptic neural lines
          const maxLineDist = isLowPowerDevice ? 75 : 95;
          ctx.lineWidth = 0.75;

          for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            for (let j = i + 1; j < particles.length; j++) {
              const p2 = particles[j];
              const dx = p1.x - p2.x;
              const dy = p1.y - p2.y;
              const dist = Math.hypot(dx, dy);

              if (dist < maxLineDist) {
                // Check if line crosses the person's face
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                const distToFace = Math.hypot(midX - faceX, midY - faceY);

                // Attenuation over person's face
                let personAtten = 1.0;
                if (distToFace < faceRadius * 1.3) {
                  personAtten = Math.max(0, (distToFace - faceRadius * 0.7) / (faceRadius * 0.6));
                }

                if (personAtten > 0.05) {
                  const lineFade = (1 - dist / maxLineDist) * personAtten * globalAlpha * 0.35;
                  ctx.strokeStyle = `rgba(0, 243, 255, ${lineFade})`;
                  ctx.beginPath();
                  ctx.moveTo(p1.x, p1.y);
                  ctx.lineTo(p2.x, p2.y);
                  ctx.stroke();

                  // Synaptic energy packet moving along line during active/flushing phases
                  if (lineFade > 0.1 && (waveActive || flushState.phase === 'active')) {
                    const packetT = (now * 1.5 + i * 0.3) % 1;
                    const pktX = p1.x + (p2.x - p1.x) * packetT;
                    const pktY = p1.y + (p2.y - p1.y) * packetT;
                    ctx.fillStyle = `rgba(255, 255, 255, ${lineFade * 1.5})`;
                    ctx.beginPath();
                    ctx.arc(pktX, pktY, 1.2, 0, Math.PI * 2);
                    ctx.fill();
                  }
                }
              }
            }
          }

          // 3. Render Individual AI Dots & Nodes
          for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            // Kinetic drift
            p.x += p.vx;
            p.y += p.vy;

            // Bounce gently off borders
            if (p.x < 10) { p.x = 10; p.vx *= -1; }
            if (p.x > cw - 10) { p.x = cw - 10; p.vx *= -1; }
            if (p.y < 10) { p.y = 10; p.vy *= -1; }
            if (p.y > ch - 10) { p.y = ch - 10; p.vy *= -1; }

            // Calculate distance to face center (Person Background Isolation)
            const distToFace = Math.hypot(p.x - faceX, p.y - faceY);
            let personAtten = 1.0;
            if (distToFace < faceRadius * 1.4) {
              // Smooth cosine falloff inside the face zone
              const normDist = Math.max(0, (distToFace - faceRadius * 0.75) / (faceRadius * 0.65));
              personAtten = Math.pow(normDist, 1.8);
            }

            // If dot is completely inside the face, skip to keep face clean
            if (personAtten <= 0.02) continue;

            // Calculate flush wave effect on this dot
            const dotCoord = p.x + p.y;
            const distToWave = Math.abs(dotCoord - currentWaveCoord);
            let waveBoost = 0;
            if (waveActive && distToWave < 140) {
              waveBoost = Math.cos((distToWave / 140) * (Math.PI / 2));
            }

            // Pulse shimmer
            const pulse = Math.sin(now * p.pulseSpeed + p.pulsePhase) * 0.25 + 0.75;
            const finalRadius = (p.baseRadius * pulse) * (1 + waveBoost * 1.5);
            const finalAlpha = Math.min(1.0, (0.55 + pulse * 0.45 + waveBoost * 0.8) * personAtten * globalAlpha);

            ctx.save();

            // A. Neon Halo Glow on Quantum Nodes or during wave boost
            if ((p.layer === 2 || waveBoost > 0.2) && !isLowPowerDevice) {
              ctx.shadowColor = waveBoost > 0.4 ? '#ffffff' : '#00f3ff';
              ctx.shadowBlur = (8 + waveBoost * 16) * pulse;
            }

            // B. Expanding ripple ring when wave flushes through the dot
            if (waveBoost > 0.35) {
              const rippleR = finalRadius + (1 - distToWave / 140) * 14;
              ctx.strokeStyle = `rgba(0, 243, 255, ${waveBoost * 0.65 * globalAlpha})`;
              ctx.lineWidth = 1.0;
              ctx.beginPath();
              ctx.arc(p.x, p.y, rippleR, 0, Math.PI * 2);
              ctx.stroke();
            }

            // C. Main Dot Body
            ctx.fillStyle = waveBoost > 0.5 
              ? `rgba(255, 255, 255, ${finalAlpha})` 
              : `hsla(${p.hue}, 100%, ${65 + waveBoost * 35}%, ${finalAlpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.8, finalRadius), 0, Math.PI * 2);
            ctx.fill();

            // D. Outer Reticle Accents for Quantum Nodes
            if (p.reticleType === 1 && p.layer >= 1 && finalAlpha > 0.3) {
              // Micro crosshair [+]
              ctx.strokeStyle = `rgba(0, 243, 255, ${finalAlpha * 0.6})`;
              ctx.lineWidth = 0.8;
              const tick = finalRadius + 3.5;
              ctx.beginPath();
              ctx.moveTo(p.x - tick, p.y);
              ctx.lineTo(p.x + tick, p.y);
              ctx.moveTo(p.x, p.y - tick);
              ctx.lineTo(p.x, p.y + tick);
              ctx.stroke();
            } else if (p.reticleType === 2 && p.layer >= 1 && finalAlpha > 0.3) {
              // Faint concentric orbital ring
              ctx.strokeStyle = `rgba(56, 189, 248, ${finalAlpha * 0.45})`;
              ctx.lineWidth = 0.6;
              ctx.beginPath();
              ctx.arc(p.x, p.y, finalRadius + 4, 0, Math.PI * 2);
              ctx.stroke();
            }

            ctx.restore();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [videoRef, faceLandmarksRef, isScanning]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-10 pointer-events-none"
    />
  );
};

// ─── 2. FULL PAGE AI DOTS BACKGROUND (SURROUNDING THE CAMERA ON BIOMETRIC PAGE) ───
export const AiPageDotsBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let cancelled = false;

    const count = isLowPowerDevice ? 28 : 55;
    const particles: DotParticle[] = [];

    const init = (w: number, h: number) => {
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        const layer = Math.random() < 0.4 ? 0 : Math.random() < 0.8 ? 1 : 2;
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * (0.2 + layer * 0.1),
          vy: (Math.random() - 0.5) * (0.2 + layer * 0.1),
          baseRadius: layer === 0 ? 1.0 : layer === 1 ? 1.8 : 2.8,
          layer,
          hue: 180 + Math.random() * 30, // Cyan to electric blue
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 1.0 + Math.random() * 2.0,
          reticleType: Math.random() < 0.25 ? 1 : 0,
        });
      }
    };

    const resize = () => {
      const cw = canvas.parentElement?.clientWidth || window.innerWidth;
      const ch = canvas.parentElement?.clientHeight || window.innerHeight;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        if (particles.length === 0) init(cw, ch);
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      if (cancelled) return;

      const cw = canvas.width;
      const ch = canvas.height;

      if (cw > 0 && ch > 0) {
        ctx.clearRect(0, 0, cw, ch);

        const now = performance.now() / 1000;
        const flushState = getFlushCycleState(now);
        const { globalAlpha, waveActive, wavePos } = flushState;

        if (globalAlpha > 0.005) {
          const totalDiag = cw + ch;
          const currentWaveCoord = waveActive ? wavePos * (totalDiag + 200) - 100 : -999;

          // Connect nearby dots
          const maxDist = isLowPowerDevice ? 90 : 120;
          ctx.lineWidth = 0.6;
          for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            for (let j = i + 1; j < particles.length; j++) {
              const p2 = particles[j];
              const dx = p1.x - p2.x;
              const dy = p1.y - p2.y;
              const dist = Math.hypot(dx, dy);

              if (dist < maxDist) {
                const alpha = (1 - dist / maxDist) * globalAlpha * 0.18;
                ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
              }
            }
          }

          // Draw particles
          for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0) p.x = cw;
            if (p.x > cw) p.x = 0;
            if (p.y < 0) p.y = ch;
            if (p.y > ch) p.y = 0;

            const dotCoord = p.x + p.y;
            const distToWave = Math.abs(dotCoord - currentWaveCoord);
            let waveBoost = 0;
            if (waveActive && distToWave < 160) {
              waveBoost = Math.cos((distToWave / 160) * (Math.PI / 2));
            }

            const pulse = Math.sin(now * p.pulseSpeed + p.pulsePhase) * 0.2 + 0.8;
            const radius = (p.baseRadius * pulse) * (1 + waveBoost * 1.6);
            const alpha = Math.min(1.0, (0.45 + pulse * 0.35 + waveBoost * 0.6) * globalAlpha);

            ctx.save();
            if (waveBoost > 0.3 && !isLowPowerDevice) {
              ctx.shadowColor = '#00f3ff';
              ctx.shadowBlur = 12 * waveBoost;
            }

            ctx.fillStyle = waveBoost > 0.4
              ? `rgba(255, 255, 255, ${alpha})`
              : `hsla(${p.hue}, 100%, ${65 + waveBoost * 30}%, ${alpha * 0.85})`;

            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.6, radius), 0, Math.PI * 2);
            ctx.fill();

            if (p.reticleType === 1 && alpha > 0.3) {
              ctx.strokeStyle = `rgba(0, 243, 255, ${alpha * 0.4})`;
              ctx.lineWidth = 0.6;
              const tick = radius + 2.5;
              ctx.beginPath();
              ctx.moveTo(p.x - tick, p.y);
              ctx.lineTo(p.x + tick, p.y);
              ctx.moveTo(p.x, p.y - tick);
              ctx.lineTo(p.x, p.y + tick);
              ctx.stroke();
            }

            ctx.restore();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};
