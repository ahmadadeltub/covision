import React, { useEffect, useRef, useState, RefObject } from 'react';
import { isLowPowerDevice } from '../utils/devicePerformance';

// ─── 22-SECOND FLUSHING CYCLE CONFIGURATION ───
export const FLUSH_CYCLE_DURATION = 22.0; // Exactly 22 seconds total cycle

export interface FlushCycleState {
  cycleSeconds: number; // 0.0 to 22.0
  cycleProgress: number; // 0.0 to 1.0
  globalAlpha: number; // 0.35 (ambient stealth) to 1.0 (peak flush surge)
  surgeEnergy: number; // 0.0 to 1.0 energy multiplier for flush wave
  phase: 'showing' | 'flushing' | 'active' | 'hidden';
  phaseLabel: string;
  wavePos: number; // 0.0 to 1.0 diagonal wave position
  waveActive: boolean;
}

/**
 * Calculates the exact state of the 22-second flushing cycle at any time.
 * Note: Base ambient alpha is maintained at ~0.38 so the room background is ALWAYS
 * visibly populated with quantum nodes, while the 22s cycle surges, flushes, and relaxes.
 */
export function getFlushCycleState(timeSec?: number): FlushCycleState {
  const now = timeSec !== undefined ? timeSec : (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000);
  const cycleSeconds = now % FLUSH_CYCLE_DURATION;
  const cycleProgress = cycleSeconds / FLUSH_CYCLE_DURATION;

  const BASE_AMBIENT = 0.38; // Always populated in background
  let surgeEnergy = 0.0;
  let phase: 'showing' | 'flushing' | 'active' | 'hidden' = 'active';
  let phaseLabel = 'ACTIVE MATRIX';
  let wavePos = 0;
  let waveActive = false;

  // 1. Phase 1: Showing / Emergence Surge (0.0s - 5.0s)
  if (cycleSeconds < 5.0) {
    phase = 'showing';
    phaseLabel = 'SHOWING · NEURAL WAKE';
    const p = cycleSeconds / 5.0; // 0 to 1
    // Smooth sine rise from ambient to peak
    surgeEnergy = 0.5 - 0.5 * Math.cos(p * Math.PI);
  }
  // 2. Phase 2: High-Energy Quantum Flush Wave (5.0s - 12.0s)
  else if (cycleSeconds < 12.0) {
    phase = 'flushing';
    phaseLabel = 'QUANTUM WAVE FLUSH';
    surgeEnergy = 1.0;
    waveActive = true;
    wavePos = (cycleSeconds - 5.0) / 7.0; // 0.0 to 1.0 sweep
  }
  // 3. Phase 3: Active AI Constellation Shimmer (12.0s - 17.0s)
  else if (cycleSeconds < 17.0) {
    phase = 'active';
    phaseLabel = 'ACTIVE AI MATRIX';
    const subP = (cycleSeconds - 12.0) / 5.0;
    surgeEnergy = 0.85 + 0.15 * Math.sin(subP * Math.PI * 2);
  }
  // 4. Phase 4: Dissolving / Stealth Mode (17.0s - 22.0s)
  else {
    phase = 'hidden';
    phaseLabel = 'STEALTH · DISSOLVING';
    const p = (cycleSeconds - 17.0) / 5.0; // 0 to 1
    // Smooth sine descent back to ambient baseline
    surgeEnergy = 0.5 + 0.5 * Math.cos(p * Math.PI);
  }

  const globalAlpha = BASE_AMBIENT + (1.0 - BASE_AMBIENT) * surgeEnergy;

  return {
    cycleSeconds,
    cycleProgress,
    globalAlpha: Math.max(0.25, Math.min(1.0, globalAlpha)),
    surgeEnergy,
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
      if (now - lastUpdate > 100) {
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
interface RoomParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  layer: number; // 0: micro-telemetry, 1: neural grid node, 2: quantum beacon
  hue: number;
  pulsePhase: number;
  pulseSpeed: number;
  reticleType: number; // 0: glowing node, 1: crosshair [+], 2: concentric ring, 3: diamond [◇]
  glyph?: string;
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

    // High density to richly populate the room background
    const roomParticleCount = isLowPowerDevice ? 45 : 85;
    const roomParticles: RoomParticle[] = [];

    // Dedicated wrap-around nodes that contour the person's silhouette
    const WRAP_NODE_COUNT = isLowPowerDevice ? 16 : 24;

    const GLYPHS = ['+', '◇', '⬡', '·', '⛶'];

    const initParticles = (w: number, h: number) => {
      roomParticles.length = 0;
      for (let i = 0; i < roomParticleCount; i++) {
        const layer = Math.random() < 0.35 ? 0 : Math.random() < 0.75 ? 1 : 2;
        roomParticles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * (0.3 + layer * 0.15),
          vy: (Math.random() - 0.5) * (0.3 + layer * 0.15),
          baseRadius: layer === 0 ? 1.4 : layer === 1 ? 2.4 : 3.6,
          layer,
          hue: 182 + Math.random() * 28, // Electric cyan to neon teal
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 1.2 + Math.random() * 2.2,
          reticleType: Math.random() < 0.3 ? 1 : Math.random() < 0.55 ? 2 : Math.random() < 0.75 ? 3 : 0,
          glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        });
      }
    };

    const resize = () => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw > 0 && ch > 0 && (canvas.width !== cw || canvas.height !== ch)) {
        canvas.width = cw;
        canvas.height = ch;
        if (roomParticles.length === 0) initParticles(cw, ch);
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
        const { globalAlpha, surgeEnergy, waveActive, wavePos } = flushState;

        // Determine face center & silhouette envelope in screen coordinates
        let faceX = cw / 2;
        let faceY = ch * 0.46;
        let faceRadius = Math.min(cw, ch) * 0.22;
        let hasFace = false;

        const landmarks = faceLandmarksRef?.current;
        const vid = videoRef.current;

        if (landmarks && landmarks.length > 0 && vid && vid.videoWidth > 0 && vid.videoHeight > 0) {
          hasFace = true;
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

          // Video is mirrored via scale-x-[-1]
          if (landmarks[1]) {
            faceX = cw - toX(landmarks[1].x);
            faceY = toY(landmarks[1].y);
          }
          if (landmarks[454] && landmarks[234] && landmarks[10] && landmarks[152]) {
            const faceW = Math.abs(toX(landmarks[454].x) - toX(landmarks[234].x));
            const faceH = Math.abs(toY(landmarks[152].y) - toY(landmarks[10].y));
            // Actual face feature radius (tight to face, not covering background)
            faceRadius = Math.max(faceW, faceH) * 0.52;
          }
        }

        const totalDiag = cw + ch;
        const currentWaveCoord = waveActive ? wavePos * (totalDiag + 220) - 110 : -999;

        // ═════════════════════════════════════════════════════════════
        // LAYER 1: 3D HOLOGRAPHIC PERSPECTIVE DEPTH GRID IN ROOM BACKGROUND
        // ═════════════════════════════════════════════════════════════
        ctx.save();
        ctx.lineWidth = 0.5;
        // Subtle perspective lines radiating into the background room
        const gridAlpha = (0.04 + surgeEnergy * 0.06) * globalAlpha;
        ctx.strokeStyle = `rgba(0, 243, 255, ${gridAlpha})`;
        const vpX = faceX;
        const vpY = faceY - 20;

        // Radial rays from vanishing point to room corners
        const rayAngles = [-2.8, -2.4, -2.0, -1.6, -1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8];
        ctx.beginPath();
        for (const ang of rayAngles) {
          const r1 = faceRadius * 1.5;
          const r2 = Math.max(cw, ch) * 1.2;
          ctx.moveTo(vpX + Math.cos(ang) * r1, vpY + Math.sin(ang) * r1);
          ctx.lineTo(vpX + Math.cos(ang) * r2, vpY + Math.sin(ang) * r2);
        }
        ctx.stroke();

        // Concentric depth rings in the room space behind person
        ctx.beginPath();
        for (let ring = 1; ring <= 4; ring++) {
          const r = faceRadius * (1.6 + ring * 0.65);
          ctx.arc(vpX, vpY, r, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.restore();

        // ═════════════════════════════════════════════════════════════
        // LAYER 2: 22s QUANTUM SCANWAVE SWEEP ACROSS ROOM BACKGROUND
        // ═════════════════════════════════════════════════════════════
        if (waveActive) {
          ctx.save();
          const waveX = (currentWaveCoord / totalDiag) * cw;
          const waveGrad = ctx.createLinearGradient(waveX - 110, 0, waveX + 110, ch);
          waveGrad.addColorStop(0, 'rgba(0, 243, 255, 0)');
          waveGrad.addColorStop(0.5, `rgba(0, 243, 255, ${0.18 * globalAlpha})`);
          waveGrad.addColorStop(0.52, `rgba(255, 255, 255, ${0.28 * globalAlpha})`);
          waveGrad.addColorStop(1, 'rgba(0, 243, 255, 0)');
          ctx.fillStyle = waveGrad;
          ctx.fillRect(0, 0, cw, ch);
          ctx.restore();
        }

        // ═════════════════════════════════════════════════════════════
        // LAYER 3: SYNAPTIC FILAMENTS CONNECTING ROOM BACKGROUND NODES
        // ═════════════════════════════════════════════════════════════
        const maxLineDist = isLowPowerDevice ? 85 : 115;
        ctx.lineWidth = 0.7;

        for (let i = 0; i < roomParticles.length; i++) {
          const p1 = roomParticles[i];
          for (let j = i + 1; j < roomParticles.length; j++) {
            const p2 = roomParticles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.hypot(dx, dy);

            if (dist < maxLineDist) {
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;
              const distToFace = Math.hypot(midX - faceX, midY - faceY);

              // Only attenuate if strictly across the central face features
              let atten = 1.0;
              if (distToFace < faceRadius * 0.75) {
                atten = Math.max(0, (distToFace - faceRadius * 0.4) / (faceRadius * 0.35));
              }

              if (atten > 0.05) {
                const lineAlpha = (1 - dist / maxLineDist) * atten * globalAlpha * (0.28 + surgeEnergy * 0.32);
                ctx.strokeStyle = `rgba(0, 243, 255, ${lineAlpha})`;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();

                // High-speed photon energy packets zipping between nodes
                if (lineAlpha > 0.12 && (waveActive || surgeEnergy > 0.6)) {
                  const packetT = (now * 2.0 + (i + j) * 0.2) % 1;
                  const pktX = p1.x + (p2.x - p1.x) * packetT;
                  const pktY = p1.y + (p2.y - p1.y) * packetT;
                  ctx.fillStyle = `rgba(255, 255, 255, ${lineAlpha * 1.8})`;
                  ctx.beginPath();
                  ctx.arc(pktX, pktY, 1.3, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }
          }
        }

        // ═════════════════════════════════════════════════════════════
        // LAYER 4: ROOM BACKGROUND QUANTUM NODES (POPULATING ENTIRE ROOM)
        // ═════════════════════════════════════════════════════════════
        for (let i = 0; i < roomParticles.length; i++) {
          const p = roomParticles[i];

          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 12) { p.x = 12; p.vx *= -1; }
          if (p.x > cw - 12) { p.x = cw - 12; p.vx *= -1; }
          if (p.y < 12) { p.y = 12; p.vy *= -1; }
          if (p.y > ch - 12) { p.y = ch - 12; p.vy *= -1; }

          // Clean only the inner facial core (eyes/nose/mouth)
          const distToFace = Math.hypot(p.x - faceX, p.y - faceY);
          let faceAtten = 1.0;
          if (distToFace < faceRadius * 0.78) {
            faceAtten = Math.max(0, (distToFace - faceRadius * 0.35) / (faceRadius * 0.43));
            faceAtten = Math.pow(faceAtten, 1.8);
          }

          if (faceAtten <= 0.02) continue;

          // Wave surge on this room node
          const dotCoord = p.x + p.y;
          const distToWave = Math.abs(dotCoord - currentWaveCoord);
          let waveBoost = 0;
          if (waveActive && distToWave < 150) {
            waveBoost = Math.cos((distToWave / 150) * (Math.PI / 2));
          }

          const pulse = Math.sin(now * p.pulseSpeed + p.pulsePhase) * 0.25 + 0.75;
          const radius = (p.baseRadius * pulse) * (1 + waveBoost * 1.6);
          const finalAlpha = Math.min(1.0, (0.55 + pulse * 0.35 + waveBoost * 0.7) * faceAtten * globalAlpha);

          ctx.save();

          // Intense neon halo glow
          if ((p.layer === 2 || waveBoost > 0.2) && !isLowPowerDevice) {
            ctx.shadowColor = waveBoost > 0.35 ? '#ffffff' : '#00f3ff';
            ctx.shadowBlur = (10 + waveBoost * 18) * pulse;
          }

          // Expanding wave ripple ring
          if (waveBoost > 0.3) {
            const rippleR = radius + (1 - distToWave / 150) * 18;
            ctx.strokeStyle = `rgba(0, 243, 255, ${waveBoost * 0.8 * globalAlpha})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, rippleR, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Quantum Node Core
          ctx.fillStyle = waveBoost > 0.45
            ? `rgba(255, 255, 255, ${finalAlpha})`
            : `hsla(${p.hue}, 100%, ${65 + waveBoost * 30}%, ${finalAlpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.9, radius), 0, Math.PI * 2);
          ctx.fill();

          // Cybernetic glyph accents & reticle marks
          if (p.layer >= 1 && finalAlpha > 0.35) {
            if (p.reticleType === 1) {
              // Micro crosshair [+]
              ctx.strokeStyle = `rgba(0, 243, 255, ${finalAlpha * 0.75})`;
              ctx.lineWidth = 0.85;
              const tick = radius + 3.8;
              ctx.beginPath();
              ctx.moveTo(p.x - tick, p.y);
              ctx.lineTo(p.x + tick, p.y);
              ctx.moveTo(p.x, p.y - tick);
              ctx.lineTo(p.x, p.y + tick);
              ctx.stroke();
            } else if (p.reticleType === 2) {
              // Concentric orbital ring
              ctx.strokeStyle = `rgba(56, 189, 248, ${finalAlpha * 0.55})`;
              ctx.lineWidth = 0.75;
              ctx.beginPath();
              ctx.arc(p.x, p.y, radius + 4.5, 0, Math.PI * 2);
              ctx.stroke();
            } else if (p.reticleType === 3 && p.layer === 2) {
              // Diamond halo [◇]
              ctx.strokeStyle = `rgba(0, 243, 255, ${finalAlpha * 0.65})`;
              ctx.lineWidth = 0.8;
              const d = radius + 3.5;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y - d);
              ctx.lineTo(p.x + d, p.y);
              ctx.lineTo(p.x, p.y + d);
              ctx.lineTo(p.x - d, p.y);
              ctx.closePath();
              ctx.stroke();
            }
          }

          ctx.restore();
        }

        // ═════════════════════════════════════════════════════════════
        // LAYER 5: QUANTUM NODES WRAPPING AROUND PERSON'S SILHOUETTE
        // ═════════════════════════════════════════════════════════════
        // These nodes dynamically contour, hug, and orbit the person's head & shoulders!
        ctx.save();
        const wrapPoints: { x: number; y: number; r: number; theta: number }[] = [];

        for (let i = 0; i < WRAP_NODE_COUNT; i++) {
          const baseTheta = (i / WRAP_NODE_COUNT) * 2 * Math.PI;
          // Orbital breathing wobble
          const theta = baseTheta + Math.sin(now * 0.8 + i * 0.4) * 0.08;

          // Asymmetrical silhouette radii:
          // Crown / top: 1.25x
          // Temples / sides: 1.35x
          // Shoulders / lower: 1.65x
          const isLower = Math.sin(theta) > 0; // lower half toward shoulders
          const radMultiplier = isLower
            ? 1.45 + 0.35 * Math.sin(theta) // flares out over shoulders
            : 1.22 + 0.12 * Math.cos(theta * 2); // contours crown and temples

          const wobble = Math.sin(now * 1.6 + i * 1.2) * 6;
          const wrapR = faceRadius * radMultiplier + wobble;

          const wx = faceX + Math.cos(theta) * wrapR * 1.15;
          const wy = faceY + Math.sin(theta) * wrapR * (isLower ? 1.42 : 1.15);

          wrapPoints.push({ x: wx, y: wy, r: wrapR, theta });
        }

        // A. Draw luminous wrap-around contour aura ribbon
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 243, 255, ${(0.32 + surgeEnergy * 0.38) * globalAlpha})`;
        ctx.lineWidth = 1.2;
        if (!isLowPowerDevice) {
          ctx.shadowColor = '#00f3ff';
          ctx.shadowBlur = 12 * (0.8 + surgeEnergy * 0.4);
        }

        // Smooth closed spline around person
        for (let i = 0; i < wrapPoints.length; i++) {
          const pt = wrapPoints[i];
          const nextPt = wrapPoints[(i + 1) % wrapPoints.length];
          const midX = (pt.x + nextPt.x) / 2;
          const midY = (pt.y + nextPt.y) / 2;
          if (i === 0) {
            ctx.moveTo(midX, midY);
          } else {
            ctx.quadraticCurveTo(pt.x, pt.y, midX, midY);
          }
        }
        ctx.closePath();
        ctx.stroke();

        // B. Secondary concentric inner wrap ring
        ctx.beginPath();
        ctx.strokeStyle = `rgba(56, 189, 248, ${(0.22 + surgeEnergy * 0.25) * globalAlpha})`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 6]);
        for (let i = 0; i < wrapPoints.length; i++) {
          const pt = wrapPoints[i];
          const innerX = faceX + (pt.x - faceX) * 0.88;
          const innerY = faceY + (pt.y - faceY) * 0.88;
          if (i === 0) ctx.moveTo(innerX, innerY);
          else ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        // C. Render each Wrap-Around Quantum Node with intense aura beacons
        for (let i = 0; i < wrapPoints.length; i++) {
          const pt = wrapPoints[i];
          const pulse = Math.sin(now * 3.0 + i * 0.5) * 0.3 + 0.7;
          const nodeR = (3.0 + pulse * 1.5) * (1 + surgeEnergy * 0.4);

          // Radial connection to nearest background room nodes
          if (i % 2 === 0) {
            const nearestRoomNode = roomParticles[i % roomParticles.length];
            const distToRoom = Math.hypot(nearestRoomNode.x - pt.x, nearestRoomNode.y - pt.y);
            if (distToRoom < 160) {
              ctx.strokeStyle = `rgba(0, 243, 255, ${(1 - distToRoom / 160) * 0.35 * globalAlpha})`;
              ctx.lineWidth = 0.75;
              ctx.beginPath();
              ctx.moveTo(pt.x, pt.y);
              ctx.lineTo(nearestRoomNode.x, nearestRoomNode.y);
              ctx.stroke();
            }
          }

          // Quantum Beacon Halo
          if (!isLowPowerDevice) {
            ctx.shadowColor = '#00f3ff';
            ctx.shadowBlur = 14 * pulse;
          }

          // Outer Concentric Ring
          ctx.strokeStyle = `rgba(0, 243, 255, ${(0.65 + pulse * 0.35) * globalAlpha})`;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, nodeR + 3.5, 0, Math.PI * 2);
          ctx.stroke();

          // Brilliant White/Cyan Core
          ctx.fillStyle = `rgba(255, 255, 255, ${(0.85 + pulse * 0.15) * globalAlpha})`;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, nodeR, 0, Math.PI * 2);
          ctx.fill();

          // Micro Crosshair on key perimeter anchors
          if (i % 3 === 0) {
            ctx.strokeStyle = `rgba(0, 243, 255, ${0.8 * globalAlpha})`;
            ctx.lineWidth = 0.9;
            const t = nodeR + 5;
            ctx.beginPath();
            ctx.moveTo(pt.x - t, pt.y);
            ctx.lineTo(pt.x + t, pt.y);
            ctx.moveTo(pt.x, pt.y - t);
            ctx.lineTo(pt.x, pt.y + t);
            ctx.stroke();
          }
        }

        ctx.restore();
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

    const count = isLowPowerDevice ? 35 : 70;
    const particles: RoomParticle[] = [];

    const init = (w: number, h: number) => {
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        const layer = Math.random() < 0.4 ? 0 : Math.random() < 0.8 ? 1 : 2;
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * (0.22 + layer * 0.12),
          vy: (Math.random() - 0.5) * (0.22 + layer * 0.12),
          baseRadius: layer === 0 ? 1.2 : layer === 1 ? 2.0 : 3.2,
          layer,
          hue: 180 + Math.random() * 30, // Cyan to electric blue
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 1.0 + Math.random() * 2.0,
          reticleType: Math.random() < 0.3 ? 1 : 0,
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
        const { globalAlpha, surgeEnergy, waveActive, wavePos } = flushState;

        const totalDiag = cw + ch;
        const currentWaveCoord = waveActive ? wavePos * (totalDiag + 220) - 110 : -999;

        // Connect nearby dots
        const maxDist = isLowPowerDevice ? 90 : 125;
        ctx.lineWidth = 0.6;
        for (let i = 0; i < particles.length; i++) {
          const p1 = particles[i];
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.hypot(dx, dy);

            if (dist < maxDist) {
              const alpha = (1 - dist / maxDist) * globalAlpha * (0.16 + surgeEnergy * 0.22);
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
            ctx.strokeStyle = `rgba(0, 243, 255, ${alpha * 0.45})`;
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
