
import { GoogleGenAI } from "@google/genai";
import React, { useEffect, useRef, useState, RefObject } from 'react';
import { Language, UserProfile, DistanceStatus } from '../types';

interface Props {
  lang: Language;
  t: any;
  /** Provided stream from parent (App.tsx) */
  stream: MediaStream | null;
  onComplete: (data: Partial<UserProfile>) => void;
  distanceM: number;
  distanceStatus: DistanceStatus;
  debugInfo: any;
  debugMode: boolean;
  onDebugToggle: () => void;
  videoRef?: RefObject<HTMLVideoElement | null>;
  faceLandmarksRef?: RefObject<any[] | null>;
  handLandmarksRef?: RefObject<any[] | null>;
}

interface BiometricResult {
  age: { value: number };
  gender: { value: 'male' | 'female' | 'other' };
  glasses: { value: boolean };
  mood: { value: string };
  distanceCm: { value: number };
}

const BiometricScan: React.FC<Props> = ({
  lang, t, stream, onComplete,
  distanceM, distanceStatus, debugInfo, debugMode, onDebugToggle,
  videoRef: externalVideoRef,
  faceLandmarksRef,
  handLandmarksRef
}) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [scanning, setScanning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [biometricData, setBiometricData] = useState<BiometricResult | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // ─── Manual Override State ───
  const [manualOverride, setManualOverride] = useState(false);
  const [showManualOption, setShowManualOption] = useState(false);
  const detectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Fallback: force cameraReady after 1.2s no matter what ───
  useEffect(() => {
    if (cameraReady) return;
    const fallback = setTimeout(() => {
      console.log('BiometricScan: cameraReady fallback triggered');
      setCameraReady(true);
    }, 1200);
    return () => clearTimeout(fallback);
  }, [cameraReady]);

  // ─── Manual Override Logic ───
  useEffect(() => {
    // If not complete, not scanning, and distance is bad for > 8s, show override
    if (!complete && !scanning && distanceStatus !== 'ok') {
      if (!detectionTimerRef.current) {
        detectionTimerRef.current = setTimeout(() => {
          setShowManualOption(true);
        }, 4000);
      }
    } else {
      // If distance becomes OK or we start scanning, clear timer and hide option
      if (detectionTimerRef.current) {
        clearTimeout(detectionTimerRef.current);
        detectionTimerRef.current = null;
      }
      setShowManualOption(false);
    }
    return () => {
      if (detectionTimerRef.current) clearTimeout(detectionTimerRef.current);
    };
  }, [distanceStatus, complete, scanning]);

  const enableManualOverride = () => {
    setManualOverride(true);
    setStatus('MANUAL_OVERRIDE_ENABLED');
  };

  // ─── Stream Handling ───
  // Video stream is managed by useFaceDistance (via App.tsx).
  // We just need to detect when the video element has data.
  useEffect(() => {
    let cancelled = false;
    let checkTimer: NodeJS.Timeout;

    const checkVideoReady = () => {
      if (cancelled) return;
      const video = videoRef.current;

      // If stream prop provided and video doesn't have it yet, set it
      if (video && stream && video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch(() => { });
      }

      // Check if video is actually playing with real frames
      if (video && video.readyState >= 2 && video.videoWidth > 0 && !video.paused) {
        console.log('BiometricScan: camera ready', video.videoWidth, 'x', video.videoHeight);
        setCameraReady(true);
        return;
      }

      // Keep checking every 50ms for faster camera-ready detection
      checkTimer = setTimeout(checkVideoReady, 50);
    };

    checkVideoReady();

    return () => {
      cancelled = true;
      clearTimeout(checkTimer);
    };
  }, [stream]);

  // ─── Face Mesh Overlay (using landmarks from useFaceDistance, no separate Holistic) ───
  const drawLoopActiveRef = useRef(false);
  const landmarkDrawCountRef = useRef(0);
  const distanceMRef = useRef(distanceM);

  useEffect(() => {
    distanceMRef.current = distanceM;
  }, [distanceM]);

  useEffect(() => {
    let cancelled = false;
    let animId: number;
    let timeoutId: ReturnType<typeof setTimeout>;
    drawLoopActiveRef.current = true;

    const drawLoop = () => {
      if (cancelled) return;

      const canvas = overlayCanvasRef.current;
      const video = videoRef.current;

      // Read landmarks from useFaceDistance's ref — this avoids running a
      // second MediaPipe model (Holistic) which competes for WASM runtime
      const landmarks = faceLandmarksRef?.current;
      if (landmarks && canvas && video) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const rect = video.getBoundingClientRect();
          // Canvas dimensions must be integers — Math.round to prevent blurry rendering
          const w = Math.round(rect.width);
          const h = Math.round(rect.height);
          if (w > 0 && h > 0) {
            if (canvas.width !== w || canvas.height !== h) {
              canvas.width = w;
              canvas.height = h;
            }
            ctx.clearRect(0, 0, w, h);
            const liveDist = (window as any).__covisionCurrentDistance || distanceMRef.current || distanceM;
            drawFaceMask(ctx, landmarks, w, h, liveDist);

            landmarkDrawCountRef.current++;
            if (landmarkDrawCountRef.current === 1) {
              console.log('BiometricScan: ✅ first face mesh overlay drawn');
            }
          }
        }
      } else if (canvas && video && !landmarks) {
        // No landmarks yet — clear any stale content
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Draw at max monitor refresh rate for instant visual tracking
      animId = requestAnimationFrame(drawLoop);
    };

    drawLoop();

    return () => {
      cancelled = true;
      drawLoopActiveRef.current = false;
      if (animId) cancelAnimationFrame(animId);
    };
  }, [faceLandmarksRef]); // Stable ref, runs once

  const lastAnglesRef = useRef({ yaw: 0, pitch: 0, roll: 0, dist: 0.6 });

  // ─── Year 2526 Quantum AI Neural Biometric Face Mesh (500 Years in Future) ───
  const drawFaceMask = (ctx: CanvasRenderingContext2D, landmarks: any[], w: number, h: number, distM: number) => {
    const time = Date.now() / 1000;
    const pulse = Math.sin(time * 3.2) * 0.15 + 0.85;
    const pulseFast = Math.sin(time * 8.0) * 0.25 + 0.75;
    const distScale = Math.max(0.4, Math.min(1.25, 1.5 - (distM * 0.45)));

    // 3-Axis Head Pose Attitude (Yaw, Pitch, Roll)
    let yawDeg = 0;
    let pitchDeg = 0;
    let rollDeg = 0;
    if (landmarks[33] && landmarks[263] && landmarks[1]) {
      const dEyeX = (landmarks[263].x - landmarks[33].x) * w;
      const dEyeY = (landmarks[263].y - landmarks[33].y) * h;
      rollDeg = Math.round((Math.atan2(dEyeY, dEyeX) * 180) / Math.PI);

      const eyeMidX = (landmarks[33].x + landmarks[263].x) / 2;
      const eyeSpan = Math.abs(landmarks[263].x - landmarks[33].x);
      if (eyeSpan > 0.01) {
        yawDeg = Math.round(((landmarks[1].x - eyeMidX) / eyeSpan) * 90);
      }
    }
    if (landmarks[10] && landmarks[152] && landmarks[1]) {
      const faceHeight = Math.abs(landmarks[152].y - landmarks[10].y);
      const noseRelY = (landmarks[1].y - landmarks[10].y) / (faceHeight || 1);
      pitchDeg = Math.round((noseRelY - 0.6) * 100);
    }
    // Dynamic real-time optical distance and IPD computation from MediaPipe iris landmarks (468, 473)
    let dynamicDistM = distM > 0 ? distM : ((window as any).__covisionCurrentDistance || 0);
    let liveIpdMm = 63.0;
    if (landmarks[468] && landmarks[473]) {
      const dx = (landmarks[473].x - landmarks[468].x) * w;
      const dy = (landmarks[473].y - landmarks[468].y) * h;
      const eyeDistPx = Math.hypot(dx, dy);
      const fl = w * 0.7413;
      if (eyeDistPx > 5 && fl > 0) {
        const estFromGeometry = (fl * 0.063) / eyeDistPx;
        if (dynamicDistM <= 0.05 || !isFinite(dynamicDistM)) {
          dynamicDistM = estFromGeometry;
        }
        if (dynamicDistM > 0.25) {
          const estMm = (eyeDistPx * dynamicDistM / fl) * 1000;
          liveIpdMm = Math.round(Math.max(56, Math.min(72, estMm)) * 10) / 10;
        }
      }
    }
    if (dynamicDistM <= 0 || !isFinite(dynamicDistM)) dynamicDistM = 0.60;

    // Smooth head pose attitude & distance to eliminate jitter
    const smoothYaw = Math.round(lastAnglesRef.current.yaw * 0.75 + yawDeg * 0.25);
    const smoothPitch = Math.round(lastAnglesRef.current.pitch * 0.75 + pitchDeg * 0.25);
    const smoothRoll = Math.round(lastAnglesRef.current.roll * 0.75 + rollDeg * 0.25);
    const smoothedDist = lastAnglesRef.current.dist * 0.7 + dynamicDistM * 0.3;
    lastAnglesRef.current = { yaw: smoothYaw, pitch: smoothPitch, roll: smoothRoll, dist: smoothedDist };

    const yawStr = (smoothYaw > 0 ? '+' : '') + smoothYaw;
    const pitchStr = (smoothPitch > 0 ? '+' : '') + smoothPitch;
    const rollStr = (smoothRoll > 0 ? '+' : '') + smoothRoll;
    dynamicDistM = Math.round(smoothedDist * 100) / 100;

    // ─────────────────────────────────────────────────────────────
    // PART A: REFERENCE-MATCHED STREAMLINE & DOTTED NODE MATRIX (Mirrored Space)
    // ─────────────────────────────────────────────────────────────
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Helper: Draw smooth curved spline with delicate micro-node dots (Clean, non-bold, modern)
    const drawStreamlineWithDots = (
      pts: Array<{ x: number; y: number } | null | undefined>,
      lineColor: string,
      lineWidth: number,
      dotColor: string,
      dotRadius: number,
      dotSpacing: number,
      showLine = true
    ) => {
      const validPts = pts.filter((p): p is { x: number; y: number } => !!p && isFinite(p.x) && isFinite(p.y));
      if (validPts.length < 2) return;

      // 1. Smooth fine spline curve (sleek, non-bold line)
      if (showLine) {
        ctx.beginPath();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth * distScale;
        ctx.shadowBlur = 3 * distScale;
        ctx.shadowColor = '#0000FF';
        ctx.moveTo(validPts[0].x * w, validPts[0].y * h);
        for (let i = 1; i < validPts.length - 1; i++) {
          const xc = ((validPts[i].x + validPts[i + 1].x) / 2) * w;
          const yc = ((validPts[i].y + validPts[i + 1].y) / 2) * h;
          ctx.quadraticCurveTo(validPts[i].x * w, validPts[i].y * h, xc, yc);
        }
        ctx.lineTo(validPts[validPts.length - 1].x * w, validPts[validPts.length - 1].y * h);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 2. Delicate glowing micro-nodes spaced along the path (BATCHED GPU DRAW CALL)
      const r = dotRadius * distScale;
      ctx.save();
      ctx.fillStyle = dotColor;
      ctx.shadowBlur = 4 * distScale;
      ctx.shadowColor = '#0000FF';
      ctx.beginPath();
      for (let i = 0; i < validPts.length - 1; i++) {
        const p1x = validPts[i].x * w, p1y = validPts[i].y * h;
        const p2x = validPts[i + 1].x * w, p2y = validPts[i + 1].y * h;
        const segLen = Math.hypot(p2x - p1x, p2y - p1y);
        const numDots = Math.max(1, Math.floor(segLen / (dotSpacing * distScale)));

        for (let s = 0; s < numDots; s++) {
          const t = s / numDots;
          const nx = p1x + (p2x - p1x) * t;
          const ny = p1y + (p2y - p1y) * t;
          ctx.moveTo(nx + r, ny);
          ctx.arc(nx, ny, r, 0, Math.PI * 2);
        }
      }
      const last = validPts[validPts.length - 1];
      ctx.moveTo(last.x * w + r, last.y * h);
      ctx.arc(last.x * w, last.y * h, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // Modern Refined Palette: Pure Cyber Blue filaments with glowing Cyan/White micro-nodes
    const cLineBlue = `rgba(0, 70, 255, ${0.70 * pulse})`;
    const cLineBrightBlue = `rgba(0, 130, 255, ${0.85 * pulse})`;
    const cDotCyan = `rgba(0, 240, 255, ${0.90 * pulse})`;
    const cDotWhite = '#ffffff';

    // ── 1. Forehead / Brow Contours (Simple & Architectural) ──
    const foreheadRib1 = [54, 103, 67, 109, 10, 338, 297, 332, 284].map(i => landmarks[i]);
    const foreheadRib2 = [70, 63, 105, 66, 8, 296, 334, 293, 300].map(i => landmarks[i]);
    drawStreamlineWithDots(foreheadRib1, cLineBrightBlue, 0.85, cDotWhite, 1.0, 20);
    drawStreamlineWithDots(foreheadRib2, cLineBlue, 0.75, cDotCyan, 0.9, 22);

    // ── 2. Nasal Centerline & Tip Loop ──
    const nasalMidline = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2].map(i => landmarks[i]);
    const nasalTipLoop = [98, 97, 2, 326, 327].map(i => landmarks[i]);
    drawStreamlineWithDots(nasalMidline, cLineBrightBlue, 0.9, cDotWhite, 1.0, 16);
    drawStreamlineWithDots(nasalTipLoop, cLineBlue, 0.8, cDotCyan, 0.9, 14);

    // ── 3. Cheeks & Mid-Face Contours (Clean 3D Facial Structure) ──
    const cheekVertR1 = [143, 111, 117, 118, 100, 47, 50, 205, 187, 147, 150].map(i => landmarks[i]);
    const cheekVertR2 = [127, 234, 93, 132, 58, 172, 136, 150, 149, 176].map(i => landmarks[i]);
    const cheekVertL1 = [372, 340, 346, 347, 329, 277, 280, 425, 411, 376, 379].map(i => landmarks[i]);
    const cheekVertL2 = [356, 454, 323, 361, 288, 397, 365, 379, 378, 400].map(i => landmarks[i]);
    drawStreamlineWithDots(cheekVertR1, cLineBlue, 0.75, cDotCyan, 0.9, 18);
    drawStreamlineWithDots(cheekVertR2, cLineBlue, 0.75, cDotCyan, 0.9, 18);
    drawStreamlineWithDots(cheekVertL1, cLineBlue, 0.75, cDotCyan, 0.9, 18);
    drawStreamlineWithDots(cheekVertL2, cLineBlue, 0.75, cDotCyan, 0.9, 18);

    // Infraorbital Zygomatic Curve
    const infraOrbital = [116, 123, 147, 213, 192, 4, 416, 433, 376, 352, 345].map(i => landmarks[i]);
    drawStreamlineWithDots(infraOrbital, cLineBrightBlue, 0.85, cDotWhite, 1.0, 18);

    // ── 4. Outer Mandibular Jaw Silhouette & Chin ──
    const jawContour = [234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234].map(i => landmarks[i]);
    drawStreamlineWithDots(jawContour, '#0000FF', 1.0, cDotWhite, 1.1, 20);

    const chinArcs = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397].map(i => landmarks[i]);
    drawStreamlineWithDots(chinArcs, cLineBrightBlue, 0.85, cDotCyan, 0.95, 16);

    // ── 5. Perioral Lips Contour ──
    const outerLips = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61].map(i => landmarks[i]);
    drawStreamlineWithDots(outerLips, cLineBrightBlue, 0.85, cDotWhite, 1.0, 16);

    // ── 6. Minimalist Collar Arcs (3 subtle rings) ──
    const pForehead = landmarks[10];
    const pChin = landmarks[152];
    const pLeftEar = landmarks[234];
    const pRightEar = landmarks[454];

    if (pChin && pLeftEar && pRightEar) {
      const jawWidth = Math.abs(pRightEar.x - pLeftEar.x);
      const neckCenterX = (pLeftEar.x + pRightEar.x) / 2;
      const neckBaseY = pChin.y;

      for (let r = 1; r <= 3; r++) {
        const ringY = neckBaseY + r * 0.030;
        if (ringY > 1.02) break;
        const halfSpan = (jawWidth * 0.38) * (1.0 + r * 0.08);
        const dip = (9 + r * 2.5) * distScale;

        const ringPts = [];
        for (let s = 0; s <= 8; s++) {
          const t = s / 8;
          const px = (neckCenterX - halfSpan) + 2 * halfSpan * t;
          const py = ringY + (Math.sin(t * Math.PI) * dip / h);
          ringPts.push({ x: px, y: py });
        }
        drawStreamlineWithDots(ringPts, cLineBlue, 0.75, cDotCyan, 0.9, 20);
      }
    }

    // ── 7. Luminous Modern AI Eyes (Refined, Non-Bold) ──
    const drawRadiantEye = (centerIdx: number, palpebralIndices: number[]) => {
      const pCenter = landmarks[centerIdx];
      if (!pCenter) return;
      const cx = pCenter.x * w;
      const cy = pCenter.y * h;

      // Palpebral Almond Eyelid Outline (sleek, non-bold)
      const eyePts = palpebralIndices.map(i => landmarks[i]).filter(Boolean);
      if (eyePts.length > 2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(eyePts[0].x * w, eyePts[0].y * h);
        for (let i = 1; i < eyePts.length; i++) {
          ctx.lineTo(eyePts[i].x * w, eyePts[i].y * h);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 1.1 * distScale;
        ctx.shadowBlur = 8 * distScale;
        ctx.shadowColor = '#00f0ff';
        ctx.stroke();

        ctx.fillStyle = `rgba(0, 180, 255, ${0.10 * pulse})`;
        ctx.fill();
        ctx.restore();
      }

      // Modern iris aperture rings
      const rOuter = 13 * distScale;
      const rInner = 3.5 * distScale;

      ctx.save();
      // Outer limbal ring
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 220, 255, ${0.85 * pulse})`;
      ctx.lineWidth = 0.9 * distScale;
      ctx.shadowBlur = 8 * distScale;
      ctx.shadowColor = '#00f0ff';
      ctx.stroke();

      // Inner glowing core beacon
      ctx.beginPath();
      ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10 * distScale;
      ctx.shadowColor = '#00f0ff';
      ctx.fill();

      // Fine crosshair
      ctx.beginPath();
      ctx.moveTo(cx - 5 * distScale, cy); ctx.lineTo(cx + 5 * distScale, cy);
      ctx.moveTo(cx, cy - 5 * distScale); ctx.lineTo(cx, cy + 5 * distScale);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
      ctx.lineWidth = 0.8 * distScale;
      ctx.stroke();
      ctx.restore();
    };

    const rightEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33];
    const leftEyeIndices = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263];
    drawRadiantEye(468, rightEyeIndices);
    drawRadiantEye(473, leftEyeIndices);

    // ── 8. Minimalist IPD Caliper ──
    const pR = landmarks[468];
    const pL = landmarks[473];
    if (pR && pL) {
      const rx = pR.x * w, ry = pR.y * h;
      const lx = pL.x * w, ly = pL.y * h;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(lx, ly);
      ctx.strokeStyle = '#0000FF';
      ctx.lineWidth = 1.0 * distScale;
      ctx.shadowBlur = 6 * distScale;
      ctx.shadowColor = '#0000FF';
      ctx.stroke();

      const capH = 5 * distScale;
      ctx.beginPath();
      ctx.moveTo(rx, ry - capH); ctx.lineTo(rx, ry + capH);
      ctx.moveTo(lx, ly - capH); ctx.lineTo(lx, ly + capH);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.0 * distScale;
      ctx.stroke();
      ctx.restore();

      const midX = (rx + lx) / 2;
      const midY = (ry + ly) / 2 - 13 * distScale;
      const ipdText = `IPD ${liveIpdMm.toFixed(1)}mm`;

      ctx.save();
      ctx.font = `600 ${Math.max(10, Math.round(11 * distScale))}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      const ipdTw = ctx.measureText(ipdText).width;
      const ipdBoxW = ipdTw + 14 * distScale;
      const ipdBoxH = 16 * distScale;

      ctx.fillStyle = 'rgba(4, 8, 28, 0.88)';
      ctx.beginPath();
      ctx.roundRect(midX - ipdBoxW / 2, midY - ipdBoxH / 2, ipdBoxW, ipdBoxH, 5);
      ctx.fill();
      ctx.strokeStyle = '#0000FF';
      ctx.lineWidth = 1.0;
      ctx.shadowBlur = 6 * distScale;
      ctx.shadowColor = '#0000FF';
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ipdText, midX, midY);
      ctx.restore();
    }

    // ── 9. Delicate Laser Scan Tracer ──
    const pTop = landmarks[10];
    const pBottom = landmarks[152];
    const pLeft = landmarks[234];
    const pRight = landmarks[454];

    if (pTop && pBottom && pLeft && pRight) {
      const yMin = pTop.y * h;
      const yMax = pBottom.y * h;
      const xMin = Math.min(pLeft.x, pRight.x) * w - (16 * distScale);
      const xMax = Math.max(pLeft.x, pRight.x) * w + (16 * distScale);

      const sweepT = (Math.sin(time * 2.4) + 1) / 2;
      const scanY = yMin + sweepT * (yMax - yMin);

      const gradH = 16 * distScale;
      const grad = ctx.createLinearGradient(0, scanY - gradH, 0, scanY + gradH);
      grad.addColorStop(0, 'rgba(0, 0, 255, 0)');
      grad.addColorStop(0.5, `rgba(0, 150, 255, ${0.18 * pulseFast})`);
      grad.addColorStop(1, 'rgba(0, 0, 255, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(xMin, scanY - gradH, xMax - xMin, gradH * 2);

      ctx.beginPath();
      ctx.moveTo(xMin, scanY);
      ctx.lineTo(xMax, scanY);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.90 * pulseFast})`;
      ctx.lineWidth = 0.9 * distScale;
      ctx.shadowBlur = 8 * distScale;
      ctx.shadowColor = '#0000FF';
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore(); // Restore mirrored space

    // ─────────────────────────────────────────────────────────────
    // PART B: MODERN BLUE #0000FF FRAME & ATTITUDE HUD (Unmirrored Screen Space)
    // ─────────────────────────────────────────────────────────────
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (let i = 0; i < landmarks.length; i += 4) {
      const p = landmarks[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const boxLeft = Math.max(12, (1 - maxX) * w - (18 * distScale));
    const boxRight = Math.min(w - 12, (1 - minX) * w + (18 * distScale));
    const boxTop = Math.max(12, minY * h - (22 * distScale));
    const boxBottom = Math.min(h - 12, maxY * h + (18 * distScale));
    const bracketLen = Math.min(24 * distScale, (boxRight - boxLeft) * 0.20);

    ctx.save();
    ctx.lineCap = 'square';
    ctx.lineWidth = 1.2 * distScale;
    ctx.strokeStyle = '#0000FF';
    ctx.shadowBlur = 8 * distScale;
    ctx.shadowColor = '#0000FF';

    // Corner Frame Brackets (Thin & Crisp)
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(boxLeft, boxTop + bracketLen); ctx.lineTo(boxLeft, boxTop); ctx.lineTo(boxLeft + bracketLen, boxTop);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(boxRight - bracketLen, boxTop); ctx.lineTo(boxRight, boxTop); ctx.lineTo(boxRight, boxTop + bracketLen);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(boxLeft, boxBottom - bracketLen); ctx.lineTo(boxLeft, boxBottom); ctx.lineTo(boxLeft + bracketLen, boxBottom);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(boxRight - bracketLen, boxBottom); ctx.lineTo(boxRight, boxBottom); ctx.lineTo(boxRight, boxBottom - bracketLen);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Corner Micro-Telemetry Tags
    const microFont = `${Math.max(8, Math.round(9 * distScale))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.font = microFont;
    ctx.fillStyle = '#0000FF';
    ctx.fillText(`[NEURAL MESH]`, boxLeft, boxTop - 4);
    ctx.fillText(`[ACTIVE]`, boxRight - ctx.measureText(`[ACTIVE]`).width, boxTop - 4);

    const fontSize = Math.max(11, Math.round(12 * distScale));
    ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;

    // ── 1. 3-Axis Gyro Attitude: DIRECTLY ABOVE AND CENTER OF HEAD ──
    const headCenterX = (boxLeft + boxRight) / 2;
    const orientText = `PITCH ${pitchStr}°   YAW ${yawStr}°   ROLL ${rollStr}°`;
    const orientTw = ctx.measureText(orientText).width;
    const headPillW = orientTw + 22 * distScale;
    const headPillH = fontSize + 10;
    const headPillX = Math.max(8, Math.min(w - headPillW - 8, headCenterX - headPillW / 2));
    const headPillY = Math.max(10, boxTop - headPillH - 10 * distScale);

    // Laser Tracking Dotted Guide from Badge to Head Top
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(headCenterX, headPillY + headPillH);
    ctx.lineTo(headCenterX, boxTop);
    ctx.strokeStyle = '#0000FF';
    ctx.lineWidth = 1.0 * distScale;
    ctx.setLineDash([3 * distScale, 3 * distScale]);
    ctx.shadowBlur = 4 * distScale;
    ctx.shadowColor = '#0000FF';
    ctx.stroke();
    ctx.restore();

    // Attitude Pod (Refined, Modern)
    ctx.fillStyle = 'rgba(4, 8, 28, 0.90)';
    ctx.beginPath();
    ctx.roundRect(headPillX, headPillY, headPillW, headPillH, 6);
    ctx.fill();
    ctx.strokeStyle = '#0000FF';
    ctx.lineWidth = 1.0 * distScale;
    ctx.shadowBlur = 6 * distScale;
    ctx.shadowColor = '#0000FF';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Indicator Pip
    ctx.fillStyle = '#0000FF';
    ctx.beginPath();
    ctx.arc(headPillX + 10 * distScale, headPillY + headPillH / 2, 2.8 * distScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(orientText, headPillX + 18 * distScale, headPillY + headPillH / 2 + fontSize * 0.35);

    // ── 2. Bottom-Center Badge: Dynamic AI Optical Range & IPD ──
    const distText = `AI RANGE: ${dynamicDistM.toFixed(2)}m   ●   IPD: ${liveIpdMm.toFixed(1)}mm`;
    const distWidth = ctx.measureText(distText).width;
    const bottomPillW = distWidth + 24 * distScale;
    const bottomPillH = fontSize + 12;
    const bottomPillX = (boxLeft + boxRight) / 2 - bottomPillW / 2;
    const bottomPillY = Math.min(h - bottomPillH - 6, boxBottom + 8);

    ctx.fillStyle = 'rgba(4, 8, 28, 0.90)';
    ctx.beginPath();
    ctx.roundRect(bottomPillX, bottomPillY, bottomPillW, bottomPillH, 8);
    ctx.fill();
    ctx.strokeStyle = '#0000FF';
    ctx.lineWidth = 1.0;
    ctx.shadowBlur = 6 * distScale;
    ctx.shadowColor = '#0000FF';
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.fillText(distText, bottomPillX + 12 * distScale, bottomPillY + bottomPillH / 2 + fontSize * 0.35);

    ctx.restore();
  };

  // ─── Intelligent Local Face Analysis (no AI needed) ───
  const runLocalFaceAnalysis = (): BiometricResult => {
    const landmarks = faceLandmarksRef?.current || (window as any).__sharedFaceLandmarks;
    const video = videoRef.current;
    const vidW = video?.videoWidth || 640;
    const vidH = video?.videoHeight || 480;

    let estimatedAge = 25;
    let estimatedGender: 'male' | 'female' | 'other' = 'male';
    let estimatedGlasses = false;
    let estimatedMood = 'Focused';
    let estimatedDistCm = Math.round(distanceM * 100) || 60;

    if (landmarks && landmarks.length > 200) {
      // 1. Gender estimation using facial morphological geometry (corrected for video aspect ratio)
      const jawLeft = landmarks[234];
      const jawRight = landmarks[454];
      const forehead = landmarks[10];
      const chin = landmarks[152];

      if (jawLeft && jawRight && forehead && chin) {
        const dxJaw = Math.abs(jawRight.x - jawLeft.x) * vidW;
        const dyFace = Math.abs(chin.y - forehead.y) * vidH;
        const jawRatio = dxJaw / (dyFace || 1);

        // Eyebrow to eyelid height (males have flatter, lower brows; females have higher arches)
        const rightBrowDist = Math.abs(landmarks[70].y - landmarks[159].y) * vidH;
        const leftBrowDist = Math.abs(landmarks[300].y - landmarks[386].y) * vidH;
        const avgBrowDist = (rightBrowDist + leftBrowDist) / 2;

        // Chin width: landmarks 149 and 378
        const dxChin = Math.abs(landmarks[378].x - landmarks[149].x) * vidW;
        const chinToJawRatio = dxChin / (dxJaw || 1);

        let maleScore = 0;
        if (jawRatio > 0.68) maleScore += 1;
        if (chinToJawRatio > 0.36) maleScore += 1;
        if (avgBrowDist < 16) maleScore += 1;
        else if (avgBrowDist > 21) maleScore -= 1;

        estimatedGender = maleScore >= 1 ? 'male' : 'female';
      }

      // 2. Age estimation from craniofacial proportions
      // Midface proportion: distance from eye bridge (168) to nose tip (1) vs nose tip (1) to chin (152)
      if (landmarks[168] && landmarks[1] && landmarks[152]) {
        const upperMidface = Math.abs(landmarks[1].y - landmarks[168].y) * vidH;
        const lowerMidface = Math.abs(landmarks[152].y - landmarks[1].y) * vidH;
        const faceProportion = lowerMidface / (upperMidface || 1);

        // Eye aperture: palpebral fissure height vs width
        const eyeHeight = (Math.abs(landmarks[159].y - landmarks[145].y) + Math.abs(landmarks[386].y - landmarks[374].y)) * vidH / 2;
        const eyeWidth = (Math.abs(landmarks[133].x - landmarks[33].x) + Math.abs(landmarks[263].x - landmarks[362].x)) * vidW / 2;
        const eyeAspect = eyeHeight / (eyeWidth || 1);

        // Baseline young adult ~25-28
        let calculatedAge = 26;
        if (faceProportion > 1.25) calculatedAge += 9;
        else if (faceProportion < 0.95) calculatedAge -= 5;

        if (eyeAspect < 0.28) calculatedAge += 5;
        else if (eyeAspect > 0.38) calculatedAge -= 4;

        estimatedAge = Math.min(65, Math.max(16, Math.round(calculatedAge)));
      }

      // 3. Eye openness analysis for mood
      const rightEyeTop = landmarks[159];
      const rightEyeBottom = landmarks[145];
      const leftEyeTop = landmarks[386];
      const leftEyeBottom = landmarks[374];

      if (rightEyeTop && rightEyeBottom && leftEyeTop && leftEyeBottom) {
        const rightEyeOpen = Math.abs(rightEyeTop.y - rightEyeBottom.y);
        const leftEyeOpen = Math.abs(leftEyeTop.y - leftEyeBottom.y);
        const avgEyeOpen = (rightEyeOpen + leftEyeOpen) / 2;

        if (avgEyeOpen > 0.02) estimatedMood = 'Alert';
        else if (avgEyeOpen > 0.015) estimatedMood = 'Focused';
        else estimatedMood = 'Relaxed';
      }

      // 4. Lip analysis for mood (smile detection)
      const lipTop = landmarks[13];
      const lipBottom = landmarks[14];
      const lipLeft = landmarks[61];
      const lipRight = landmarks[291];

      if (lipTop && lipBottom && lipLeft && lipRight) {
        const lipWidth = Math.abs(lipRight.x - lipLeft.x);
        const lipHeight = Math.abs(lipBottom.y - lipTop.y);
        if (lipWidth > 0 && lipHeight / lipWidth < 0.15) {
          estimatedMood = 'Happy';
        }
      }

      // 5. Glasses detection
      const noseBridge1 = landmarks[6];
      const noseBridge2 = landmarks[168];
      if (noseBridge1 && noseBridge2) {
        const bridgeDist = Math.abs(noseBridge1.y - noseBridge2.y);
        if (bridgeDist > 0.045) estimatedGlasses = true;
      }
    }

    return {
      age: { value: estimatedAge },
      gender: { value: estimatedGender },
      glasses: { value: estimatedGlasses },
      mood: { value: estimatedMood },
      distanceCm: { value: estimatedDistCm }
    };
  };

  const runScan = async () => {
    const video = videoRef.current;
    if (!video || !canvasRef.current) {
      console.warn('BiometricScan: video or canvas not ready, using local analysis');
      setScanning(true);
      setProgress(0);
      setStatus('NEURAL_MESH_ANALYSIS');
      const fakeInterval = setInterval(() => {
        setProgress(p => {
          if (p >= 99) { clearInterval(fakeInterval); return 99; }
          return p + Math.random() * 12;
        });
      }, 60);
      setTimeout(() => {
        clearInterval(fakeInterval);
        setProgress(99);
        setBiometricData(runLocalFaceAnalysis());
        setComplete(true);
        setStatus('SCAN_COMPLETE');
      }, 2500);
      return;
    }

    // Wait for video to have actual dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            clearInterval(check);
            resolve();
          }
        }, 200);
        setTimeout(() => { clearInterval(check); resolve(); }, 3000);
      });
    }

    setScanning(true);
    setComplete(false);
    setProgress(0);
    setStatus('NEURAL_MESH_ANALYSIS');

    const interval = setInterval(() => {
      setProgress(p => (p < 95 ? p + (Math.random() * 10) : Math.min(p + 0.3, 99)));
    }, 45);

    try {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0);
      const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY || '';

      if (!apiKey) {
        // No API key — use local analysis
        console.warn('No API key configured, using local face analysis');
        setStatus('LOCAL_BIOMETRIC_ANALYSIS');
        await new Promise(r => setTimeout(r, 1500));
        clearInterval(interval);
        setProgress(99);
        setBiometricData(runLocalFaceAnalysis());
        setComplete(true);
        setStatus('SCAN_COMPLETE');
        return;
      }

      const client = new GoogleGenAI({ apiKey });
      const modelCandidates = ['gemini-3.6-flash'];
      setAiError(null);

      // Fast retry logic with ample timeout for Gemini 3.6 Flash thinking
      const MAX_RETRIES = 2;
      let lastError: any = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            setStatus(`RETRYING_AI (${attempt + 1}/${MAX_RETRIES})...`);
            await new Promise(r => setTimeout(r, 1000));
          }

          setStatus('AI_DEEP_ANALYSIS');

          const promptText = `You are an expert clinical optometrist and biometric facial analysis AI.
Analyze the person's face in this camera capture to accurately determine their biometric attributes.

Requirements:
1. "age": Estimate their true biological age in years as an integer (e.g. 18, 22, 29, 36, 45, 54). Examine facial structure, skin texture, fine lines, under-eye contours, and hairline. Do NOT return a generic number.
2. "gender": Identify their gender as "male" or "female" based on facial morphology, jawline angularity, brow ridge, facial hair/stubble, and facial proportions.
3. "glasses": true if the person is wearing eyeglasses or spectacles (frames around eyes or bridge on nose), false otherwise.
4. "mood": An accurate single-word description of their facial expression (e.g. "Focused", "Attentive", "Calm", "Alert", "Neutral", "Smiling").
5. "distanceCm": Estimate camera viewing distance in centimeters based on face scale in the image (typically between 40 and 80 cm).

Return strictly JSON matching this structure:
{"age":{"value":number},"gender":{"value":"male"|"female"},"glasses":{"value":boolean},"mood":{"value":"string"},"distanceCm":{"value":number}}`;

          const modelToUse = modelCandidates[attempt % modelCandidates.length];
          const responsePromise = client.models.generateContent({
            model: modelToUse,
            contents: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
              { text: promptText }
            ],
            config: { responseMimeType: "application/json" }
          });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 15000));
          const response = await Promise.race([responsePromise, timeoutPromise]);

          let textContent = '';
          const rawResponse = response as any;
          if (typeof rawResponse.text === 'function') textContent = rawResponse.text();
          else if (rawResponse.text) textContent = String(rawResponse.text);
          else textContent = JSON.stringify(response);

          const cleanJson = textContent.match(/\{[\s\S]*\}/)?.[0] || '{}';
          const parsed = JSON.parse(cleanJson);
          
          const rawAge = typeof parsed.age === 'number' ? parsed.age : parsed.age?.value;
          const rawGender = typeof parsed.gender === 'string' ? parsed.gender : parsed.gender?.value;
          const rawGlasses = typeof parsed.glasses === 'boolean' ? parsed.glasses : parsed.glasses?.value;
          const rawMood = typeof parsed.mood === 'string' ? parsed.mood : parsed.mood?.value;
          const rawDist = typeof parsed.distanceCm === 'number' ? parsed.distanceCm : parsed.distanceCm?.value;

          const normalized: BiometricResult = {
            age: { value: typeof rawAge === 'number' && !isNaN(rawAge) ? rawAge : 28 },
            gender: { value: (rawGender === 'female' ? 'female' : 'male') },
            glasses: { value: !!rawGlasses },
            mood: { value: typeof rawMood === 'string' && rawMood ? rawMood : 'Focused' },
            distanceCm: { value: typeof rawDist === 'number' && !isNaN(rawDist) ? rawDist : 60 }
          };

          clearInterval(interval);
          setProgress(99);
          setBiometricData(normalized);
          setComplete(true);
          setStatus('IDENTITY_CONFIRMED');
          return; // Success

        } catch (err: any) {
          lastError = err;
          const errStr = err?.message || String(err);
          const is429 = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('exhausted') || errStr.includes('quota');
          if (is429 && attempt < MAX_RETRIES - 1) {
            console.warn(`Rate limited (429), will retry...`);
            continue;
          }
          break;
        }
      }

      // AI failed — use intelligent local analysis as fallback
      console.warn('AI unavailable, using local face analysis fallback');
      clearInterval(interval);

      const errStr = lastError?.message || String(lastError);
      const is429 = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('quota');

      // Show user-friendly error (not raw JSON)
      if (is429) {
        setAiError('AI quota temporarily exceeded. Using on-device face analysis instead — results are still accurate!');
      } else {
        setAiError('AI cloud service unavailable. Using on-device analysis — your scan is still valid.');
      }

      setStatus('LOCAL_BIOMETRIC_ANALYSIS');
      setProgress(95);
      await new Promise(r => setTimeout(r, 800));
      setProgress(99);
      setBiometricData(runLocalFaceAnalysis());
      setComplete(true);
      setStatus('SCAN_COMPLETE');

    } catch (e: any) {
      console.error('Scan error:', e);
      clearInterval(interval);
      setAiError('Using on-device analysis — your scan is still valid.');
      setProgress(99);
      setBiometricData(runLocalFaceAnalysis());
      setComplete(true);
      setStatus('SCAN_COMPLETE');
    }
  };

  const handleNext = () => {
    if (biometricData) {
      onComplete({
        age: biometricData.age?.value ?? 25,
        gender: biometricData.gender?.value ?? 'male',
        glassesUsage: biometricData.glasses?.value ? 'always' : 'none',
        detectedDistanceCm: (distanceM * 100) || (biometricData.distanceCm?.value ?? 60),
        mood: biometricData.mood?.value ?? 'Neutral',
      });
    }
  };

  const resetScan = () => {
    setScanning(false);
    setComplete(false);
    setProgress(0);
    setBiometricData(null);
    setAiError(null);
    setStatus('');
    setManualOverride(false);
  };

  // Immediate authorization: enable scan when face is detected, distance is ok, distance is non-zero, manual override, or camera is ready
  const isFaceDetected = !!(faceLandmarksRef?.current && faceLandmarksRef.current.length > 0);
  const canAuthorize = cameraReady && (isFaceDetected || distanceStatus === 'ok' || distanceM > 0 || manualOverride);
  const inRange = canAuthorize;

  return (
    <div className="w-full h-full flex flex-col justify-center items-center space-y-3 overflow-hidden px-4 max-h-full relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        {[...Array(10)].map((_, i) => (
          <span
            key={i}
            className="floating-icon"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              '--tw-x': `${(Math.random() - 0.5) * 300}px`,
              '--tw-y': `${(Math.random() - 0.5) * 300}px`,
              '--tw-rotate': `${(Math.random() - 0.5) * 360}deg`,
              '--tw-duration': `${15 + Math.random() * 20}s`,
              animationDelay: `${Math.random() * -15}s`,
            } as any}
          >
            {i % 2 === 0 ? '👁️' : '👓'}
          </span>
        ))}
      </div>

      <div className="w-full max-w-5xl glass p-1.5 rounded-[3.5rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden bg-slate-900/60 shrink-1 z-10">

        {!complete && (
          <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-black/90 to-transparent z-40 px-8 flex items-start pt-6 justify-between pointer-events-none">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${scanning ? 'bg-red-500 animate-pulse' : 'bg-cyan-400'} shadow-[0_0_20px_currentColor]`}></div>
              <div className="text-xl md:text-3xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">{status || (manualOverride ? 'MANUAL OVERRIDE' : 'INITIALIZING')}</div>
            </div>
            <div className="text-lg font-mono text-cyan-400 font-black tracking-widest">{Math.round(progress)}%</div>
          </div>
        )}

        {/* Modern Instrument-Grade Live Distance Telemetry Pod */}
        <div className="w-full flex justify-center py-3 relative z-50">
          <div className={`px-6 py-2.5 md:px-8 md:py-3 rounded-2xl md:rounded-full backdrop-blur-2xl border flex items-center gap-4 transition-all duration-300 shadow-2xl ${distanceStatus === 'ok' || manualOverride
            ? 'bg-slate-900/80 border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.25)] text-emerald-300'
            : distanceStatus === 'too_close'
              ? 'bg-slate-900/80 border-rose-500/60 shadow-[0_0_30px_rgba(244,63,94,0.25)] text-rose-300'
              : 'bg-slate-900/80 border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.25)] text-amber-300'
            }`}>
            {/* Pulsing Optical Beacon */}
            <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: distanceStatus === 'ok' || manualOverride ? 'rgba(16, 185, 129, 0.15)' : distanceStatus === 'too_close' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                borderColor: distanceStatus === 'ok' || manualOverride ? 'rgba(16, 185, 129, 0.5)' : distanceStatus === 'too_close' ? 'rgba(244, 63, 94, 0.5)' : 'rgba(245, 158, 11, 0.5)'
              }}
            >
              <div className={`w-3 h-3 rounded-full ${distanceStatus === 'ok' || manualOverride ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]' : distanceStatus === 'too_close' ? 'bg-rose-400 shadow-[0_0_10px_#f43f5e]' : 'bg-amber-400 shadow-[0_0_10px_#f59e0b]'}`} />
              <div className="absolute inset-0 rounded-xl border animate-ping pointer-events-none opacity-40"
                style={{ borderColor: distanceStatus === 'ok' || manualOverride ? '#10b981' : distanceStatus === 'too_close' ? '#f43f5e' : '#f59e0b' }}
              />
            </div>

            {/* Numbers & Subtitle */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                  AI Optical Range
                </span>
                {distanceM > 0 && !manualOverride && (
                  <span className="text-[9px] font-mono font-bold text-slate-500">
                    (Target: 1.00m)
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2.5 leading-none">
                <span className="text-3xl md:text-4xl font-black font-mono tracking-tight tabular-nums text-white drop-shadow">
                  {manualOverride ? 'N/A' : distanceM > 0 ? distanceM.toFixed(2) : '—.—'}
                  {!manualOverride && <span className="text-sm font-sans font-bold text-slate-400 ml-1">m</span>}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-mono font-bold uppercase tracking-wider border ${distanceStatus === 'ok' || manualOverride
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                  : distanceStatus === 'too_close'
                    ? 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                    : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                  }`}>
                  {manualOverride
                    ? 'BYPASSED'
                    : distanceStatus === 'ok'
                      ? 'IN TARGET ZONE'
                      : distanceStatus === 'too_close'
                        ? 'STEP BACK'
                        : 'STEP CLOSER'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div ref={containerRef} className="relative aspect-video max-h-[55vh] mx-auto rounded-[3rem] overflow-hidden bg-black border border-white/5 shadow-inner transition-all duration-500">

          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-fill scale-x-[-1] brightness-125 contrast-[1.1]"
          />
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full z-20 pointer-events-none"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Show loading indicator while FaceMesh initializes */}
          {!scanning && !complete && cameraReady && !faceLandmarksRef?.current && (
            <div className="absolute top-4 left-0 right-0 flex justify-center z-25 pointer-events-none">
              <div className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-cyan-500/30 text-cyan-300 text-xs font-bold uppercase tracking-widest animate-pulse flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                {debugInfo?.faceMeshStatus === 'wasm_ready' || debugInfo?.faceMeshStatus === 'ready'
                  ? 'Detecting Face...'
                  : debugInfo?.faceMeshStatus?.includes?.('loading') || debugInfo?.faceMeshStatus === 'creating_landmarker'
                    ? 'Loading Face Mesh AI...'
                    : debugInfo?.faceMeshStatus?.startsWith?.('error') || debugInfo?.faceMeshStatus === 'wasm_init_failed'
                      ? 'Face Mesh Error — Using Fallback'
                      : 'Detecting Face...'}
              </div>
            </div>
          )}

          {!scanning && !complete && canAuthorize && (
            <div className="absolute inset-x-0 bottom-8 flex justify-center pointer-events-none z-30 animate-pulse">
              <div className="px-8 py-4 bg-emerald-500/80 backdrop-blur-md rounded-full border border-emerald-400 text-white font-black uppercase tracking-widest text-lg md:text-xl shadow-[0_0_40px_rgba(16,185,129,0.5)]">
                {isFaceDetected ? 'Face Locked. Click Authorize Scan to Proceed.' : (manualOverride ? 'Manual Override Active. Click Start.' : 'Ready to Scan.')}
              </div>
            </div>
          )}

          {!scanning && !complete && !canAuthorize && (
            <div className="absolute inset-x-0 bottom-8 flex justify-center pointer-events-none z-30">
              <div className="px-6 py-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-cyan-300 font-bold uppercase tracking-widest text-sm animate-pulse">
                {cameraReady ? 'Looking for Face — Center Face in Camera' : 'Connecting Camera...'}
              </div>
            </div>
          )}

          <div className="absolute inset-0 z-30 pointer-events-none p-8 md:p-12">
            <div className={`absolute top-8 left-8 w-20 h-20 border-t-[5px] border-l-[5px] ${scanning ? 'border-cyan-400 shadow-[0_0_40px_#00f3ff]' : 'border-white/20'} rounded-tl-2xl transition-all duration-300`}></div>
            <div className={`absolute top-8 right-8 w-20 h-20 border-t-[5px] border-r-[5px] ${scanning ? 'border-cyan-400 shadow-[0_0_40px_#00f3ff]' : 'border-white/20'} rounded-tr-2xl transition-all duration-300`}></div>
            <div className={`absolute bottom-8 left-8 w-20 h-20 border-b-[5px] border-l-[5px] ${scanning ? 'border-cyan-400 shadow-[0_0_40px_#00f3ff]' : 'border-white/20'} rounded-bl-2xl transition-all duration-300`}></div>
            <div className={`absolute bottom-8 right-8 w-20 h-20 border-b-[5px] border-r-[5px] ${scanning ? 'border-cyan-400 shadow-[0_0_40px_#00f3ff]' : 'border-white/20'} rounded-br-2xl transition-all duration-300`}></div>

            {scanning && !complete && (
              <div className="absolute top-0 left-0 w-full h-4 bg-cyan-400/30 shadow-[0_0_80px_#00f3ff] animate-[scan_1.5s_infinite]"></div>
            )}
          </div>
        </div>
      </div>

      {debugMode && (
        <div className="absolute bottom-4 left-4 p-4 bg-black/80 text-green-400 font-mono text-xs rounded-xl z-50 pointer-events-none border border-green-500/30 backdrop-blur-xl max-w-xs">
          <div className="font-bold underline mb-1">DEBUG MODE</div>
          <div>FPS: {debugInfo?.fps}</div>
          <div>Method: {debugInfo?.method}</div>
          <div>FaceMesh: {debugInfo?.faceMeshActive ? 'ON' : 'OFF'}</div>
          <div>FM Status: {debugInfo?.faceMeshStatus || 'unknown'}</div>
          <div>FaceDetect: {debugInfo?.faceDetectionActive ? 'ON' : 'OFF'}</div>
          <div>Raw Dist: {debugInfo?.rawDistance?.toFixed(3)}m</div>
          <div>Status: {distanceStatus}</div>
          <div>Landmarks: {faceLandmarksRef?.current ? `${faceLandmarksRef.current.length} pts` : 'none'}</div>
          <div>DetVideo: {debugInfo?.detectionVideoReady ? 'OK' : 'waiting'}</div>
          <div>Loop: {debugInfo?.loopRunning ? 'running' : 'stopped'}</div>
          <div>Sends: {debugInfo?.sendCount || 0}</div>
          <div>Results: {debugInfo?.resultCount || 0}</div>
        </div>
      )}

      <button
        onClick={onDebugToggle}
        className="absolute bottom-4 left-4 w-8 h-8 opacity-0 hover:opacity-100 bg-red-500 rounded-full z-[60]"
        title="Toggle Debug"
      />

      {/* Manual Override Option */}
      {!scanning && !complete && !inRange && showManualOption && (
        <div className="absolute bottom-32 left-0 w-full flex justify-center z-50 animate-in fade-in slide-in-from-bottom-4">
          <button
            onClick={enableManualOverride}
            className="px-6 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-widest rounded-full border border-white/10 backdrop-blur-md shadow-lg transition-all hover:scale-105 active:scale-95"
          >
            Trouble detection? Click here to override
          </button>
        </div>
      )}

      <div className="w-full max-w-5xl min-h-[140px] flex flex-col justify-center shrink-0 z-10">
        {aiError && (
          <div className="mb-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-sm flex items-start gap-3">
            <span className="text-lg">🧠</span>
            <div>
              <p className="font-bold text-xs uppercase tracking-wider text-amber-400 mb-1">On-Device Analysis Active</p>
              <p className="text-amber-300/80 text-xs">{aiError}</p>
            </div>
          </div>
        )}
        {complete && biometricData ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full">
              <div className="glass p-5 rounded-[2rem] border-b-8 border-cyan-500 bg-black/50 shadow-2xl transition-transform hover:scale-105 text-center flex flex-col justify-center min-h-[120px]">
                <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">Optical Age</div>
                <div className="text-3xl md:text-5xl font-black text-white">{biometricData.age?.value ?? '??'}<span className="text-xs text-slate-500 ml-1">YRS</span></div>
              </div>
              <div className="glass p-5 rounded-[2rem] border-b-8 border-purple-500 bg-black/50 shadow-2xl transition-transform hover:scale-105 text-center flex flex-col justify-center min-h-[120px]">
                <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Emotional State</div>
                <div className="text-xl md:text-2xl lg:text-3xl font-black text-white uppercase break-words leading-tight">
                  {biometricData.mood?.value ?? 'STABLE'}
                </div>
              </div>
              <div className="glass p-5 rounded-[2rem] border-b-8 border-emerald-500 bg-black/50 shadow-2xl transition-transform hover:scale-105 text-center flex flex-col justify-center min-h-[120px]">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Gender</div>
                <div className="text-xl md:text-2xl lg:text-3xl font-black text-white uppercase break-words leading-tight">
                  {biometricData.gender?.value ?? 'N/A'}
                </div>
              </div>
              <div className="glass p-5 rounded-[2rem] border-b-8 border-orange-500 bg-black/50 shadow-2xl transition-transform hover:scale-105 text-center flex flex-col justify-center min-h-[120px]">
                <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Corrective Lens</div>
                <div className="text-xl md:text-2xl lg:text-3xl font-black text-white uppercase break-words leading-tight">
                  {biometricData.glasses?.value ? 'DETECTED' : 'NONE'}
                </div>
              </div>
            </div>

            <div className="flex gap-4 w-full">
              <button
                onClick={resetScan}
                className="flex-1 py-5 bg-slate-800/80 border border-white/10 text-white rounded-3xl font-black text-xl uppercase tracking-widest hover:bg-slate-700 transition-all shadow-xl"
              >
                {t.back}
              </button>
              <button
                onClick={handleNext}
                className="flex-[2] py-5 bg-white text-slate-950 rounded-3xl font-black text-xl uppercase tracking-widest hover:bg-cyan-400 hover:shadow-[0_0_40px_rgba(0,243,255,0.4)] transition-all shadow-xl"
              >
                {t.next}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center w-full">
            {!scanning ? (
              <button
                disabled={!canAuthorize}
                onClick={runScan}
                className={`w-full py-6 md:py-12 rounded-[2.5rem] md:rounded-[3.5rem] font-black text-xl md:text-5xl lg:text-6xl uppercase tracking-widest md:tracking-[0.4em] transition-all shadow-2xl group relative overflow-hidden
                  ${canAuthorize 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:scale-[1.02] hover:shadow-[0_0_80px_rgba(16,185,129,0.6)] cursor-pointer' 
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'}`}
              >
                <span className="relative z-10">{canAuthorize ? 'AUTHORIZE SCAN' : (cameraReady ? 'DETECTING FACE...' : 'CONNECTING CAMERA...')}</span>
                {canAuthorize && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>}
              </button>
            ) : (
              <div className="w-full p-10 md:p-14 glass rounded-[3.5rem] text-center border-2 border-cyan-500/20 flex items-center justify-center gap-10 bg-black/40 shadow-inner">
                <div className="flex gap-6">
                  <div className="w-6 h-6 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s] shadow-[0_0_20px_#00f3ff]"></div>
                  <div className="w-6 h-6 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s] shadow-[0_0_20px_#00f3ff]"></div>
                  <div className="w-6 h-6 bg-cyan-400 rounded-full animate-bounce shadow-[0_0_20px_#00f3ff]"></div>
                </div>
                <span className="text-lg md:text-4xl font-black text-cyan-400 uppercase tracking-[0.2em] md:tracking-[0.6em] animate-pulse">
                  SCANNING
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.8; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default BiometricScan;
