
import React, { useEffect, useRef, useState, RefObject } from 'react';
import { CalibrationData, Language, DistanceStatus } from '../types';

interface Props {
  lang: Language;
  t: any;
  stream: MediaStream | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  faceLandmarksRef?: RefObject<any[] | null>;
  poseLandmarksRef?: RefObject<any[] | null>;
  handLandmarksRef?: RefObject<any[] | null>;
  distanceStatus?: DistanceStatus;
  distanceM?: number;
  isStable?: boolean;
  onComplete: (data: CalibrationData) => void;
}

const Calibration: React.FC<Props> = ({ lang, t, stream, videoRef, faceLandmarksRef, poseLandmarksRef, handLandmarksRef, distanceStatus = 'no_face', distanceM = 0, isStable = false, onComplete }) => {
  const [stableCountdown, setStableCountdown] = useState(3);
  const stableStartRef = useRef<number | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const IS_DEV = new URLSearchParams(window.location.search).get('dev') === 'true';
  const TARGET_M = IS_DEV ? 0.5 : 1.0;
  const TOLERANCE_M = IS_DEV ? 0.3 : 0.15;

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => { });
    }
  }, [stream, videoRef]);

  // ─── Draw face mesh overlay from useFaceDistance landmarks ───
  const distanceMRef = useRef(distanceM);
  useEffect(() => {
    distanceMRef.current = distanceM;
  }, [distanceM]);

  useEffect(() => {
    if (!faceLandmarksRef) return;
    let stopped = false;
    const loop = () => {
      if (stopped) return;
      const canvas = overlayCanvasRef.current;
      const vid = videoRef.current;
      if (canvas && vid) {
        const rect = vid.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const lm = faceLandmarksRef.current;
          const liveDist = (window as any).__covisionCurrentDistance || distanceMRef.current || distanceM;

          if (lm && lm.length > 0) {
            drawFaceOverlay(ctx, lm, canvas.width, canvas.height, liveDist);
          }
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
    return () => { stopped = true; };
  }, [faceLandmarksRef, videoRef]);

  const lastAnglesRef = useRef({ yaw: 0, pitch: 0, roll: 0, dist: 1.0 });

  // ─── Year 2526 Quantum AI Neural Biometric Face Mesh (500 Years in Future) ───
  const drawFaceOverlay = (ctx: CanvasRenderingContext2D, landmarks: any[], w: number, h: number, distM: number) => {
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
    if (dynamicDistM <= 0 || !isFinite(dynamicDistM)) dynamicDistM = 1.00;

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

    // ── 2. Bottom-Center Badge: Dynamic AI Optical Range & Target ──
    const distText = `AI RANGE: ${dynamicDistM.toFixed(2)}m   ●   TARGET: 1.00m   ●   IPD: ${liveIpdMm.toFixed(1)}mm`;
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

  // Use distance from useFaceDistance hook (same source as the global bot)
  // Re-derive status from distanceM with local thresholds so both bars agree
  let localStatus: DistanceStatus = 'no_face';
  if (distanceM > 0) {
    if (distanceM < TARGET_M - TOLERANCE_M) localStatus = 'too_close';
    else if (distanceM > TARGET_M + TOLERANCE_M) localStatus = 'too_far';
    else localStatus = 'ok';
  }
  const effectiveDistanceM = distanceM;
  const effectiveStable = localStatus === 'ok' ? isStable : false;

  useEffect(() => {
    if (localStatus === 'ok') {
      if (!stableStartRef.current) stableStartRef.current = Date.now();
      const interval = setInterval(() => {
        const elapsed = (Date.now() - (stableStartRef.current || Date.now())) / 1000;
        setStableCountdown(Math.max(0, Math.ceil(3 - elapsed)));
      }, 200);
      return () => clearInterval(interval);
    } else {
      stableStartRef.current = null;
      setStableCountdown(3);
    }
  }, [localStatus]);

  const handleFinish = () => {
    const pxPerMm = 4.0;
    const viewingDistanceCm = 100;
    onComplete({ pxPerMm, viewingDistanceCm });
  };

  // Distance color — uses local distance
  const getDistanceColor = () => {
    if (localStatus === 'ok') return '#10b981';
    if (localStatus === 'too_close') return '#ef4444';
    if (localStatus === 'too_far') return '#f59e0b';
    return '#6b7280';
  };

  const getGuidanceText = () => {
    if (localStatus === 'too_close') return { text: 'Move Back →', icon: '🔴' };
    if (localStatus === 'too_far') return { text: '← Move Closer', icon: '🟡' };
    if (localStatus === 'ok' && !effectiveStable) return { text: t.hold_steady || 'Hold Steady', icon: '🟢' };
    if (effectiveStable && localStatus === 'ok') return { text: t.stable || 'Stable', icon: '✅' };
    return { text: t.no_face || 'Looking for face...', icon: '⚫' };
  };

  const guidance = getGuidanceText();
  const canProceed = localStatus === 'ok';

  return (
    <div className="w-full flex-1 flex items-center justify-center p-0 md:p-2 overflow-hidden bg-transparent">
      <div className="glass w-full max-w-[98vw] h-auto min-h-0 max-h-[96vh] rounded-[1.5rem] md:rounded-[2rem] shadow-[0_0_150px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col items-center justify-between relative overflow-hidden bg-slate-900/60 p-2 md:p-4 animate-in fade-in zoom-in-95 duration-700">

        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] border border-cyan-500 rounded-full animate-[ping_15s_infinite]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-cyan-500/20 rounded-full animate-[ping_20s_infinite_reverse]"></div>
        </div>

        {/* Header */}
        <div className="relative z-10 w-full text-center shrink-0">
          <h2 className="text-3xl md:text-5xl lg:text-5xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-2xl">
            {t.calibration_title}
          </h2>
        </div>

        {/* Instruction Note */}
        <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center gap-2 shrink-0 mt-2">
          {/* Guidance Arrow */}
          <div className="flex items-center gap-2 py-1 px-4 rounded-full" style={{ background: getDistanceColor() + '15', borderColor: getDistanceColor() + '30' }}>
            <span className="text-lg">{guidance.icon}</span>
            <span className="font-black text-sm md:text-base uppercase tracking-wider animate-pulse" style={{ color: getDistanceColor() }}>
              {guidance.text}
            </span>
          </div>

          {/* ═══════════════════════════════════════════ */}
          {/* MODERN INSTRUMENT-GRADE DISTANCE TELEMETRY */}
          {/* ═══════════════════════════════════════════ */}
          <div className="w-full max-w-3xl mx-auto mt-1 bg-slate-950/70 border border-slate-700/60 rounded-3xl p-3 md:p-4 backdrop-blur-xl shadow-2xl relative overflow-hidden"
            style={{ borderColor: getDistanceColor() + '40', boxShadow: `0 0 35px ${getDistanceColor()}20` }}
          >
            {/* Top Row: Distance readout + Delta badge + Stability status */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2 px-1">
              {/* Numeric Metric */}
              <div className="flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-black font-mono tabular-nums leading-none tracking-tight" style={{ color: getDistanceColor() }}>
                  {effectiveDistanceM > 0 ? effectiveDistanceM.toFixed(2) : '—.—'}
                </span>
                <span className="text-lg text-slate-400 font-bold uppercase">m</span>
                <span className="text-[10px] md:text-xs font-mono font-bold text-slate-400 uppercase tracking-widest ml-1">
                  (Target: 1.00m)
                </span>
              </div>

              {/* Delta & Stability Pill */}
              <div className="flex items-center gap-2">
                {effectiveDistanceM > 0 && (
                  <div className="px-3 py-1 rounded-full text-xs font-mono font-bold border flex items-center gap-1.5"
                    style={{
                      backgroundColor: localStatus === 'ok' ? 'rgba(16, 185, 129, 0.15)' : getDistanceColor() + '18',
                      borderColor: getDistanceColor() + '50',
                      color: getDistanceColor()
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: getDistanceColor() }} />
                    <span>
                      {localStatus === 'ok'
                        ? Math.abs(Math.round((effectiveDistanceM - TARGET_M) * 100)) <= 2
                          ? 'PERFECT ALIGNMENT'
                          : `Δ ${(effectiveDistanceM - TARGET_M > 0 ? '+' : '') + Math.round((effectiveDistanceM - TARGET_M) * 100)}cm`
                        : `Δ ${(effectiveDistanceM - TARGET_M > 0 ? '+' : '') + Math.round((effectiveDistanceM - TARGET_M) * 100)}cm`}
                    </span>
                  </div>
                )}

                {/* Countdown / Lock Badge */}
                {localStatus === 'ok' && (
                  <div className={`px-3 py-1 rounded-full text-xs font-mono font-black border flex items-center gap-1.5 shadow-sm ${effectiveStable || stableCountdown === 0
                    ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300 animate-pulse'
                    : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                    }`}>
                    <span className="text-xs">🔒</span>
                    <span>{effectiveStable || stableCountdown === 0 ? 'LOCKED' : `HOLD ${stableCountdown}s`}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Precision Caliper Rail */}
            <div className="relative w-full h-7 md:h-8 rounded-full bg-slate-900/90 border border-slate-700/80 overflow-hidden shadow-inner flex items-center">
              {/* Green target zone (0.85m - 1.15m on a 0-2m scale) */}
              <div
                className="absolute top-0 h-full border-x transition-all duration-300 pointer-events-none"
                style={{
                  left: `${(0.85 / 2) * 100}%`,
                  width: `${((1.15 - 0.85) / 2) * 100}%`,
                  backgroundColor: localStatus === 'ok' ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.12)',
                  borderColor: 'rgba(52, 211, 153, 0.6)'
                }}
              >
                <div className="w-full h-full opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:6px_6px]" />
              </div>

              {/* Filled bar up to current distance */}
              <div
                className="h-full rounded-full transition-all duration-300 ease-out pointer-events-none"
                style={{
                  width: `${Math.min((effectiveDistanceM / 2) * 100, 100)}%`,
                  background: `linear-gradient(90deg, ${getDistanceColor()}33, ${getDistanceColor()})`,
                  boxShadow: `0 0 15px ${getDistanceColor()}88`
                }}
              />

              {/* Target wire at 1.0m */}
              <div
                className="absolute top-0 h-full w-[2px] bg-white z-10 pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                style={{ left: `${(1.0 / 2) * 100}%`, transform: 'translateX(-50%)' }}
              />

              {/* Current position reticle cursor */}
              {effectiveDistanceM > 0 && (
                <div
                  className="absolute top-1/2 w-6 h-6 rounded-full border-2 border-white transition-all duration-300 ease-out flex items-center justify-center z-20 pointer-events-none"
                  style={{
                    left: `${Math.min((effectiveDistanceM / 2) * 100, 100)}%`,
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: getDistanceColor(),
                    boxShadow: `0 0 16px ${getDistanceColor()}`
                  }}
                >
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
              )}
            </div>

            {/* Calibrated Ticks */}
            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-500 px-2 mt-1.5 select-none">
              <span>0.0m</span>
              <span>0.5m</span>
              <span className="text-emerald-400 font-black">1.0m (TARGET ZONE)</span>
              <span>1.5m</span>
              <span>2.0m</span>
            </div>
          </div>
        </div>

        {/* Main Content Area (Buttons + Camera) */}
        <div className="relative z-10 w-full mx-auto flex-1 min-h-0 flex flex-col md:flex-row gap-4 md:gap-6 my-2">

          {/* Action Buttons (Left Side) */}
          <div className="relative z-10 w-full md:w-56 shrink-0 flex flex-row md:flex-col justify-center gap-3 md:gap-4 order-2 md:order-1">
            <button
              onClick={handleFinish}
              className="w-full py-3 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700 shadow-sm"
            >
              Skip 1m (Testing)
            </button>

            <button
              onClick={handleFinish}
              disabled={!canProceed}
              className={`group w-full py-4 md:py-6 rounded-2xl md:rounded-3xl font-black text-base md:text-2xl uppercase tracking-widest md:tracking-[0.3em] transition-all transform hover:scale-[1.02] active:scale-95 relative overflow-hidden shadow-xl flex-1 md:flex-none ${canProceed
                ? 'bg-white text-slate-950 hover:bg-cyan-400 hover:shadow-[0_0_80px_rgba(0,243,255,0.7)]'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
            >
              <span className="relative z-10">{t.next}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </button>
          </div>

          {/* Camera Feed — compact, reduced width */}
          <div className="relative min-h-0 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden bg-black border-2 shadow-[0_0_40px_rgba(0,200,255,0.1)] order-1 md:order-2 mx-auto"
            style={{ borderColor: getDistanceColor() + '40', maxHeight: 'clamp(360px, 64vh, 640px)', width: 'clamp(320px, 80vw, 720px)' }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1] brightness-110"
            />
            {/* Face Mesh + Body Overlay */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 5 }}
            />
            {/* Camera overlay corners */}
            <div className="absolute inset-0 pointer-events-none p-6">
              <div className="absolute top-6 left-6 w-14 h-14 border-t-4 border-l-4 rounded-tl-xl" style={{ borderColor: getDistanceColor() }}></div>
              <div className="absolute top-6 right-6 w-14 h-14 border-t-4 border-r-4 rounded-tr-xl" style={{ borderColor: getDistanceColor() }}></div>
              <div className="absolute bottom-6 left-6 w-14 h-14 border-b-4 border-l-4 rounded-bl-xl" style={{ borderColor: getDistanceColor() }}></div>
              <div className="absolute bottom-6 right-6 w-14 h-14 border-b-4 border-r-4 rounded-br-xl" style={{ borderColor: getDistanceColor() }}></div>
            </div>

            {/* Live Distance Overlay */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 glass px-6 py-2 rounded-full border flex items-center gap-2"
              style={{ borderColor: getDistanceColor() + '50' }}
            >
              <span className="text-sm animate-pulse" style={{ color: getDistanceColor() }}>●</span>
              <span className="text-white font-black text-sm md:text-base uppercase tracking-widest whitespace-nowrap">
                {t.distance_live || 'DISTANCE'}: <span style={{ color: getDistanceColor(), fontSize: '1.2rem' }}>
                  {effectiveDistanceM > 0 ? effectiveDistanceM.toFixed(2) : '--'}
                </span> <span className="text-slate-400 text-xs">{t.meters?.toUpperCase?.() || 'METERS'}</span>
              </span>
            </div>

            {/* Stability countdown */}
            {localStatus === 'ok' && !effectiveStable && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 glass px-6 py-2 rounded-full border border-amber-400/30">
                <span className="text-amber-400 font-black text-sm uppercase tracking-wider animate-pulse">
                  ⏱ {stableCountdown}s
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calibration;
