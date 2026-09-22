
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

    // Helper: Draw smooth modern dotted lines (dots line) in luminous light blue
    const drawDottedLineMesh = (
      pts: Array<{ x: number; y: number } | null | undefined>,
      dotColor: string,
      dotSize: number, // diameter of dots
      dotSpacing: number, // distance between dots
      accentColor = '#ffffff'
    ) => {
      const validPts = pts.filter((p): p is { x: number; y: number } => !!p && isFinite(p.x) && isFinite(p.y));
      if (validPts.length < 2) return;

      const size = dotSize * distScale;
      const spacing = dotSpacing * distScale;

      ctx.save();

      // 1. Ultra-subtle ethereal hairline guide trace connecting the points
      ctx.beginPath();
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.14 * pulse})`;
      ctx.lineWidth = 0.5 * distScale;
      ctx.setLineDash([]);
      ctx.moveTo(validPts[0].x * w, validPts[0].y * h);
      for (let i = 1; i < validPts.length - 1; i++) {
        const xc = ((validPts[i].x + validPts[i + 1].x) / 2) * w;
        const yc = ((validPts[i].y + validPts[i + 1].y) / 2) * h;
        ctx.quadraticCurveTo(validPts[i].x * w, validPts[i].y * h, xc, yc);
      }
      ctx.lineTo(validPts[validPts.length - 1].x * w, validPts[validPts.length - 1].y * h);
      ctx.stroke();

      // 2. High-precision Dotted Line (Dots Line) with luminous light blue glow
      ctx.beginPath();
      ctx.strokeStyle = dotColor;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.setLineDash([0, spacing]); // Dash length 0 + round cap = perfect circular dots
      ctx.shadowBlur = 5 * distScale;
      ctx.shadowColor = '#38bdf8';
      ctx.moveTo(validPts[0].x * w, validPts[0].y * h);
      for (let i = 1; i < validPts.length - 1; i++) {
        const xc = ((validPts[i].x + validPts[i + 1].x) / 2) * w;
        const yc = ((validPts[i].y + validPts[i + 1].y) / 2) * h;
        ctx.quadraticCurveTo(validPts[i].x * w, validPts[i].y * h, xc, yc);
      }
      ctx.lineTo(validPts[validPts.length - 1].x * w, validPts[validPts.length - 1].y * h);
      ctx.stroke();

      // 3. Highlight luminous micro-nodes at key facial landmark vertices
      ctx.setLineDash([]);
      ctx.fillStyle = accentColor;
      ctx.shadowBlur = 6 * distScale;
      ctx.shadowColor = '#7dd3fc';
      ctx.beginPath();
      const nodeR = Math.max(0.9, size * 0.55);
      for (let i = 0; i < validPts.length; i++) {
        const px = validPts[i].x * w;
        const py = validPts[i].y * h;
        ctx.moveTo(px + nodeR, py);
        ctx.arc(px, py, nodeR, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.restore();
    };

    // Modern Light Blue Biometric Palette
    const cLightBlue = `rgba(56, 189, 248, ${0.92 * pulse})`; // Sky-400 light blue
    const cCyanLight = `rgba(125, 211, 252, ${0.95 * pulse})`; // Sky-300 bright light blue
    const cDotWhite = '#ffffff';

    // ── 1. Forehead Matrix (3 Horizontal Arcs + 3 Vertical Ribs) ──
    const foreheadTop = [21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251].map(i => landmarks[i]);
    const foreheadMid = [162, 71, 68, 104, 69, 108, 151, 337, 299, 333, 298, 301, 389].map(i => landmarks[i]);
    const foreheadLow = [70, 63, 105, 66, 107, 9, 336, 296, 334, 293, 300].map(i => landmarks[i]);
    const foreheadVertMid = [10, 151, 9, 8, 168].map(i => landmarks[i]);
    const foreheadVertR = [67, 68, 69, 108, 107].map(i => landmarks[i]);
    const foreheadVertL = [297, 298, 299, 337, 336].map(i => landmarks[i]);

    drawDottedLineMesh(foreheadTop, cCyanLight, 2.1, 5, cDotWhite);
    drawDottedLineMesh(foreheadMid, cLightBlue, 1.9, 5, cCyanLight);
    drawDottedLineMesh(foreheadLow, cCyanLight, 2.0, 5, cDotWhite);
    drawDottedLineMesh(foreheadVertMid, cCyanLight, 2.0, 5, cDotWhite);
    drawDottedLineMesh(foreheadVertR, cLightBlue, 1.8, 5.5, cCyanLight);
    drawDottedLineMesh(foreheadVertL, cLightBlue, 1.8, 5.5, cCyanLight);

    // ── 2. Eyebrows (Full Upper & Lower Arches) ──
    const browRightLower = [70, 63, 105, 66, 107].map(i => landmarks[i]);
    const browRightUpper = [46, 53, 52, 65, 55, 107].map(i => landmarks[i]);
    const browLeftLower = [336, 296, 334, 293, 300].map(i => landmarks[i]);
    const browLeftUpper = [336, 285, 295, 282, 283, 276].map(i => landmarks[i]);

    drawDottedLineMesh(browRightLower, cCyanLight, 2.1, 4.5, cDotWhite);
    drawDottedLineMesh(browRightUpper, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(browLeftLower, cCyanLight, 2.1, 4.5, cDotWhite);
    drawDottedLineMesh(browLeftUpper, cLightBlue, 1.8, 5, cCyanLight);

    // ── 3. Outer Eye Orbit Sockets ──
    const orbitRight = [226, 247, 30, 29, 27, 28, 56, 190, 243, 112, 26, 22, 23, 24, 110, 25, 226].map(i => landmarks[i]);
    const orbitLeft = [446, 467, 260, 259, 257, 258, 286, 414, 463, 341, 256, 252, 253, 254, 339, 255, 446].map(i => landmarks[i]);
    drawDottedLineMesh(orbitRight, cLightBlue, 1.8, 5.5, cCyanLight);
    drawDottedLineMesh(orbitLeft, cLightBlue, 1.8, 5.5, cCyanLight);

    // ── 4. Nasal Complex & Bridge Architecture ──
    const nasalMidline = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2].map(i => landmarks[i]);
    const nasalBridgeHoriz1 = [189, 221, 55, 193, 168, 417, 285, 441, 413].map(i => landmarks[i]);
    const nasalBridgeHoriz2 = [122, 196, 197, 419, 351].map(i => landmarks[i]);
    const nasalRightRidge = [196, 198, 131, 115, 49, 102, 64, 98].map(i => landmarks[i]);
    const nasalLeftRidge = [419, 420, 360, 344, 279, 331, 294, 327].map(i => landmarks[i]);
    const nasalTipLoop = [98, 97, 2, 326, 327].map(i => landmarks[i]);
    const nasalBaseWing = [129, 98, 2, 327, 358].map(i => landmarks[i]);
    const philtrumColumella = [98, 164, 0, 327].map(i => landmarks[i]);

    drawDottedLineMesh(nasalMidline, cCyanLight, 2.2, 4.5, cDotWhite);
    drawDottedLineMesh(nasalBridgeHoriz1, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(nasalBridgeHoriz2, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(nasalRightRidge, cLightBlue, 1.9, 5, cCyanLight);
    drawDottedLineMesh(nasalLeftRidge, cLightBlue, 1.9, 5, cCyanLight);
    drawDottedLineMesh(nasalTipLoop, cCyanLight, 2.1, 4.5, cDotWhite);
    drawDottedLineMesh(nasalBaseWing, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(philtrumColumella, cLightBlue, 1.8, 5, cCyanLight);

    // ── 5. Cheeks, Temples & Zygomatic Arches ──
    const cheekVertR1 = [143, 111, 117, 118, 100, 47, 50, 205, 187, 147, 150].map(i => landmarks[i]);
    const cheekVertR2 = [127, 234, 93, 132, 58, 172, 136, 150, 149, 176].map(i => landmarks[i]);
    const cheekVertR3 = [227, 137, 177, 215, 138, 135, 169, 170, 140, 171, 175].map(i => landmarks[i]);
    const cheekVertL1 = [372, 340, 346, 347, 329, 277, 280, 425, 411, 376, 379].map(i => landmarks[i]);
    const cheekVertL2 = [356, 454, 323, 361, 288, 397, 365, 379, 378, 400].map(i => landmarks[i]);
    const cheekVertL3 = [447, 366, 401, 435, 367, 364, 394, 395, 369, 396, 399].map(i => landmarks[i]);
    const infraOrbital = [116, 123, 147, 213, 192, 4, 416, 433, 376, 352, 345].map(i => landmarks[i]);
    const nasolabialR = [98, 203, 92, 165, 186, 57, 43, 106, 182].map(i => landmarks[i]);
    const nasolabialL = [327, 423, 322, 391, 410, 287, 273, 335, 406].map(i => landmarks[i]);
    const zygomaticCheekArcR = [116, 123, 147, 187, 205, 207, 214].map(i => landmarks[i]);
    const zygomaticCheekArcL = [345, 352, 376, 411, 425, 427, 434].map(i => landmarks[i]);
    const templeRidgeR = [103, 54, 21, 162, 127, 234].map(i => landmarks[i]);
    const templeRidgeL = [332, 284, 251, 389, 356, 454].map(i => landmarks[i]);

    drawDottedLineMesh(cheekVertR1, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(cheekVertR2, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(cheekVertR3, cLightBlue, 1.7, 5.5, cCyanLight);
    drawDottedLineMesh(cheekVertL1, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(cheekVertL2, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(cheekVertL3, cLightBlue, 1.7, 5.5, cCyanLight);
    drawDottedLineMesh(infraOrbital, cCyanLight, 2.0, 5, cDotWhite);
    drawDottedLineMesh(nasolabialR, cCyanLight, 2.0, 4.8, cDotWhite);
    drawDottedLineMesh(nasolabialL, cCyanLight, 2.0, 4.8, cDotWhite);
    drawDottedLineMesh(zygomaticCheekArcR, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(zygomaticCheekArcL, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(templeRidgeR, cLightBlue, 1.8, 5.5, cCyanLight);
    drawDottedLineMesh(templeRidgeL, cLightBlue, 1.8, 5.5, cCyanLight);

    // ── 6. Perioral Lips & Mouth Structure ──
    const outerLips = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61].map(i => landmarks[i]);
    const innerLips = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78].map(i => landmarks[i]);
    drawDottedLineMesh(outerLips, cCyanLight, 2.1, 4.5, cDotWhite);
    drawDottedLineMesh(innerLips, cLightBlue, 1.8, 5, cCyanLight);

    // ── 7. Mandibular Jawline & Chin Architecture ──
    const jawContour = [234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234].map(i => landmarks[i]);
    const chinArcs = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397].map(i => landmarks[i]);
    const chinMentalCrease = [202, 212, 214, 192, 213, 148, 152, 377, 433, 416, 434, 432, 422].map(i => landmarks[i]);
    const jawInnerFlangeR = [132, 58, 172, 136, 150, 149, 176].map(i => landmarks[i]);
    const jawInnerFlangeL = [361, 288, 397, 365, 379, 378, 400].map(i => landmarks[i]);

    drawDottedLineMesh(jawContour, cLightBlue, 2.2, 5.5, cDotWhite);
    drawDottedLineMesh(chinArcs, cCyanLight, 2.0, 4.8, cCyanLight);
    drawDottedLineMesh(chinMentalCrease, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(jawInnerFlangeR, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(jawInnerFlangeL, cLightBlue, 1.8, 5, cCyanLight);

    // ── 8. High-Density Facial Landmark Dot Matrix (Glowing Surface Dots) ──
    const surfaceDotIndices = [
      10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2,
      116, 123, 147, 213, 192, 214, 207, 205, 187, 120, 119, 100, 47, 50,
      345, 352, 376, 433, 416, 434, 427, 425, 411, 349, 348, 329, 277, 280,
      70, 63, 105, 66, 107, 55, 65, 52, 53, 46,
      336, 296, 334, 293, 300, 276, 283, 282, 295, 285,
      162, 127, 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
      389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
      198, 131, 115, 49, 102, 64, 98, 97, 326, 327, 279, 331, 294, 420, 360, 344,
      164, 0, 11, 12, 13, 14, 15, 16, 17, 18
    ];
    ctx.save();
    ctx.fillStyle = cCyanLight;
    ctx.shadowBlur = 6 * distScale;
    ctx.shadowColor = '#38bdf8';
    ctx.beginPath();
    const dotR = 1.35 * distScale;
    for (const idx of surfaceDotIndices) {
      const p = landmarks[idx];
      if (p && isFinite(p.x) && isFinite(p.y)) {
        const px = p.x * w;
        const py = p.y * h;
        ctx.moveTo(px + dotR, py);
        ctx.arc(px, py, dotR, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    ctx.restore();

    // ── 9. Minimalist Collar Arcs (3 subtle rings) ──
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
        drawDottedLineMesh(ringPts, cLightBlue, 1.8, 6, cCyanLight);
      }
    }

    // ── 10. Luminous Modern AI Eyes (Light Blue Dotted Outlines & Rings) ──
    const drawRadiantEye = (centerIdx: number, palpebralIndices: number[]) => {
      const pCenter = landmarks[centerIdx];
      if (!pCenter) return;
      const cx = pCenter.x * w;
      const cy = pCenter.y * h;

      // Palpebral Almond Eyelid Outline (Modern light blue dotted line)
      const eyePts = palpebralIndices.map(i => landmarks[i]).filter(Boolean);
      if (eyePts.length > 2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(eyePts[0].x * w, eyePts[0].y * h);
        for (let i = 1; i < eyePts.length; i++) {
          ctx.lineTo(eyePts[i].x * w, eyePts[i].y * h);
        }
        ctx.closePath();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8 * distScale;
        ctx.lineCap = 'round';
        ctx.setLineDash([0, 6 * distScale]);
        ctx.shadowBlur = 6 * distScale;
        ctx.shadowColor = '#38bdf8';
        ctx.stroke();

        ctx.fillStyle = `rgba(56, 189, 248, ${0.08 * pulse})`;
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
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.85 * pulse})`;
      ctx.lineWidth = 1.0 * distScale;
      ctx.shadowBlur = 8 * distScale;
      ctx.shadowColor = '#38bdf8';
      ctx.stroke();

      // Inner glowing core beacon
      ctx.beginPath();
      ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10 * distScale;
      ctx.shadowColor = '#38bdf8';
      ctx.fill();

      // Fine crosshair
      ctx.beginPath();
      ctx.moveTo(cx - 5 * distScale, cy); ctx.lineTo(cx + 5 * distScale, cy);
      ctx.moveTo(cx, cy - 5 * distScale); ctx.lineTo(cx, cy + 5 * distScale);
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.8)';
      ctx.lineWidth = 0.8 * distScale;
      ctx.stroke();
      ctx.restore();
    };

    const rightEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33];
    const leftEyeIndices = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263];
    drawRadiantEye(468, rightEyeIndices);
    drawRadiantEye(473, leftEyeIndices);

    // ── 8. Minimalist Light Blue IPD Caliper ──
    const pR = landmarks[468];
    const pL = landmarks[473];
    if (pR && pL) {
      const rx = pR.x * w, ry = pR.y * h;
      const lx = pL.x * w, ly = pL.y * h;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(lx, ly);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.0 * distScale;
      ctx.setLineDash([2 * distScale, 3 * distScale]);
      ctx.shadowBlur = 6 * distScale;
      ctx.shadowColor = '#38bdf8';
      ctx.stroke();

      const capH = 5 * distScale;
      ctx.setLineDash([]);
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
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.0;
      ctx.shadowBlur = 6 * distScale;
      ctx.shadowColor = '#38bdf8';
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ipdText, midX, midY);
      ctx.restore();
    }

    // ── 9. Delicate Light Blue Laser Scan Tracer ──
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
      grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      grad.addColorStop(0.5, `rgba(56, 189, 248, ${0.18 * pulseFast})`);
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(xMin, scanY - gradH, xMax - xMin, gradH * 2);

      ctx.beginPath();
      ctx.moveTo(xMin, scanY);
      ctx.lineTo(xMax, scanY);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.90 * pulseFast})`;
      ctx.lineWidth = 0.9 * distScale;
      ctx.shadowBlur = 8 * distScale;
      ctx.shadowColor = '#38bdf8';
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore(); // Restore mirrored space

    // ─────────────────────────────────────────────────────────────
    // PART B: MODERN LIGHT BLUE FRAME & ATTITUDE HUD (Unmirrored Screen Space)
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
    ctx.strokeStyle = '#38bdf8';
    ctx.shadowBlur = 8 * distScale;
    ctx.shadowColor = '#38bdf8';

    // Corner Frame Brackets (Thin & Crisp Light Blue)
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
    ctx.fillStyle = '#38bdf8';
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
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.0 * distScale;
    ctx.setLineDash([3 * distScale, 3 * distScale]);
    ctx.shadowBlur = 4 * distScale;
    ctx.shadowColor = '#38bdf8';
    ctx.stroke();
    ctx.restore();

    // Attitude Pod (Refined Light Blue Modern)
    ctx.fillStyle = 'rgba(4, 8, 28, 0.90)';
    ctx.beginPath();
    ctx.roundRect(headPillX, headPillY, headPillW, headPillH, 6);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.0 * distScale;
    ctx.shadowBlur = 6 * distScale;
    ctx.shadowColor = '#38bdf8';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Indicator Pip
    ctx.fillStyle = '#38bdf8';
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
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.0;
    ctx.shadowBlur = 6 * distScale;
    ctx.shadowColor = '#38bdf8';
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
    <div className="w-full flex-1 flex items-center justify-center p-1 sm:p-2 md:p-3 overflow-y-auto md:overflow-hidden bg-transparent">
      <div className="glass w-full max-w-[98vw] lg:max-w-7xl h-auto min-h-0 md:h-[94vh] md:max-h-[96vh] rounded-2xl md:rounded-[2.5rem] shadow-2xl border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-between relative overflow-y-auto md:overflow-hidden bg-white/70 dark:bg-slate-900/60 p-2 sm:p-3 md:p-4 lg:p-5 animate-in fade-in zoom-in-95 duration-700">

        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] border border-cyan-500 rounded-full animate-[ping_15s_infinite]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-cyan-500/20 rounded-full animate-[ping_20s_infinite_reverse]"></div>
        </div>

        {/* Header */}
        <div className="relative z-10 w-full text-center shrink-0 mb-1 sm:mb-2">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none drop-shadow-sm">
            {t.calibration_title}
          </h2>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* MODERN INSTRUMENT-GRADE DISTANCE TELEMETRY */}
        {/* ═══════════════════════════════════════════ */}
        <div
          className="distance-telemetry-pod w-full max-w-5xl lg:max-w-6xl mx-auto shrink-0 bg-slate-950/85 dark:bg-slate-950/85 border border-slate-700/60 rounded-xl sm:rounded-2xl md:rounded-3xl p-2.5 sm:p-3 md:p-3.5 backdrop-blur-xl shadow-xl relative overflow-hidden"
          style={{ borderColor: getDistanceColor() + '40', boxShadow: `0 0 30px ${getDistanceColor()}18` }}
        >
          {/* Top Row: Distance readout + Guidance + Delta + Stability status */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 sm:mb-2 px-1">
            {/* Left: Distance metric */}
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-2xl sm:text-3xl md:text-4xl font-black font-mono tabular-nums leading-none tracking-tight" style={{ color: getDistanceColor() }}>
                {effectiveDistanceM > 0 ? effectiveDistanceM.toFixed(2) : '—.—'}
              </span>
              <span className="text-sm sm:text-base text-slate-400 font-bold uppercase">m</span>
              <span className="text-[10px] md:text-xs font-mono font-bold text-slate-400 uppercase tracking-widest ml-1 hidden sm:inline">
                (Target: 1.00m)
              </span>
            </div>

            {/* Right: Badges */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Guidance Instruction Badge */}
              <div
                className="flex items-center gap-1.5 py-1 px-2.5 sm:px-3 rounded-full border text-[11px] sm:text-xs font-black uppercase tracking-wider animate-pulse"
                style={{ background: getDistanceColor() + '18', borderColor: getDistanceColor() + '40', color: getDistanceColor() }}
              >
                <span className="text-sm sm:text-base">{guidance.icon}</span>
                <span>{guidance.text}</span>
              </div>

              {/* Delta Badge */}
              {effectiveDistanceM > 0 && (
                <div
                  className="px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-mono font-bold border items-center gap-1 hidden md:flex"
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
                <div className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-mono font-black border flex items-center gap-1 shadow-sm ${effectiveStable || stableCountdown === 0
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
          <div className="relative w-full h-6 sm:h-7 rounded-full bg-slate-900/90 border border-slate-700/80 overflow-hidden shadow-inner flex items-center">
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
                className="absolute top-1/2 w-5 sm:w-6 h-5 sm:h-6 rounded-full border-2 border-white transition-all duration-300 ease-out flex items-center justify-center z-20 pointer-events-none"
                style={{
                  left: `${Math.min((effectiveDistanceM / 2) * 100, 100)}%`,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: getDistanceColor(),
                  boxShadow: `0 0 16px ${getDistanceColor()}`
                }}
              >
                <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-white animate-pulse" />
              </div>
            )}
          </div>

          {/* Calibrated Ticks */}
          <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-mono font-bold text-slate-500 px-2 mt-1 select-none">
            <span>0.0m</span>
            <span>0.5m</span>
            <span className="text-emerald-400 font-black">1.0m (TARGET ZONE)</span>
            <span>1.5m</span>
            <span>2.0m</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* CAMERA FEED — ENLARGED, CENTERED, FITS PAGE */}
        {/* ═══════════════════════════════════════════ */}
        <div
          className="relative flex-1 w-full max-w-5xl lg:max-w-6xl min-h-[340px] sm:min-h-[420px] md:min-h-[480px] lg:min-h-[520px] max-h-[64vh] md:max-h-[68vh] rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] overflow-hidden bg-black border-2 shadow-[0_0_50px_rgba(0,200,255,0.15)] mx-auto flex items-center justify-center my-2 transition-all duration-300"
          style={{ borderColor: getDistanceColor() + '60' }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1] brightness-110"
          />
          {/* Face Mesh + Biometric Overlay */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 5 }}
          />
          {/* Camera overlay corners */}
          <div className="absolute inset-0 pointer-events-none p-4 sm:p-6 md:p-8">
            <div className="absolute top-4 sm:top-6 left-4 sm:left-6 w-10 sm:w-16 h-10 sm:h-16 border-t-4 border-l-4 rounded-tl-2xl transition-colors duration-300" style={{ borderColor: getDistanceColor() }}></div>
            <div className="absolute top-4 sm:top-6 right-4 sm:right-6 w-10 sm:w-16 h-10 sm:h-16 border-t-4 border-r-4 rounded-tr-2xl transition-colors duration-300" style={{ borderColor: getDistanceColor() }}></div>
            <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 w-10 sm:w-16 h-10 sm:h-16 border-b-4 border-l-4 rounded-bl-2xl transition-colors duration-300" style={{ borderColor: getDistanceColor() }}></div>
            <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 w-10 sm:w-16 h-10 sm:h-16 border-b-4 border-r-4 rounded-br-2xl transition-colors duration-300" style={{ borderColor: getDistanceColor() }}></div>
          </div>

          {/* Live Distance Overlay */}
          <div
            className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 glass px-5 sm:px-7 py-2 sm:py-2.5 rounded-full border flex items-center gap-2 backdrop-blur-md shadow-2xl z-20"
            style={{ borderColor: getDistanceColor() + '60' }}
          >
            <span className="text-xs sm:text-sm animate-pulse" style={{ color: getDistanceColor() }}>●</span>
            <span className="text-white font-black text-xs sm:text-sm md:text-base uppercase tracking-widest whitespace-nowrap">
              {t.distance_live || 'DISTANCE'}: <span style={{ color: getDistanceColor(), fontSize: '1.25rem' }}>
                {effectiveDistanceM > 0 ? effectiveDistanceM.toFixed(2) : '--'}
              </span> <span className="text-slate-400 text-[10px] sm:text-xs">{t.meters?.toUpperCase?.() || 'METERS'}</span>
            </span>
          </div>

          {/* Stability countdown indicator */}
          {localStatus === 'ok' && !effectiveStable && (
            <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 glass px-5 py-2 rounded-full border border-amber-400/50 backdrop-blur-md shadow-2xl z-20">
              <span className="text-amber-300 font-black text-xs sm:text-sm uppercase tracking-wider animate-pulse flex items-center gap-2">
                <span>⏱</span> {t.hold_steady || 'HOLD STEADY'}: {stableCountdown}s
              </span>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* ACTION CONTROLS */}
        {/* ═══════════════════════════════════════════ */}
        <div className="relative z-10 w-full max-w-5xl lg:max-w-6xl mx-auto flex flex-row items-center justify-between gap-3 sm:gap-4 shrink-0 mt-1 sm:mt-2">
          <button
            onClick={handleFinish}
            className="py-3 sm:py-3.5 px-4 sm:px-6 rounded-2xl font-bold text-xs sm:text-sm uppercase tracking-wider md:tracking-widest transition-all bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-black dark:hover:text-white border border-slate-300 dark:border-slate-700 shadow-sm shrink-0"
          >
            Skip 1m (Testing)
          </button>

          <button
            onClick={handleFinish}
            disabled={!canProceed}
            className={`group flex-1 py-3.5 sm:py-4 rounded-2xl md:rounded-3xl font-black text-sm sm:text-base md:text-xl uppercase tracking-wider md:tracking-[0.25em] transition-all transform hover:scale-[1.01] active:scale-95 relative overflow-hidden shadow-xl ${canProceed
              ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white hover:from-sky-500 hover:to-indigo-500 hover:shadow-[0_0_40px_rgba(2,132,199,0.5)] cursor-pointer'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
              }`}
          >
            <span className="relative z-10">{t.next}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-300/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Calibration;
