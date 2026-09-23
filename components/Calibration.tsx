
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
      accentColor = '#1c96c5'
    ) => {
      const validPts = pts.filter((p): p is { x: number; y: number } => !!p && isFinite(p.x) && isFinite(p.y));
      if (validPts.length < 2) return;

      const size = dotSize * distScale;
      const spacing = dotSpacing * distScale;

      ctx.save();

      // 1. Ultra-subtle ethereal hairline guide trace connecting the points
      ctx.beginPath();
      ctx.strokeStyle = `rgba(28, 150, 197, ${0.16 * pulse})`;
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

      // 2. High-precision Dotted Line (Dots Line) with luminous #1c96c5 glow
      ctx.beginPath();
      ctx.strokeStyle = dotColor;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.setLineDash([0, spacing]); // Dash length 0 + round cap = perfect circular dots
      ctx.shadowBlur = 5 * distScale;
      ctx.shadowColor = '#1c96c5';
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
      ctx.shadowColor = '#1c96c5';
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


    // Modern Biometric Palette (#1c96c5)
    const cLightBlue = `rgba(28, 150, 197, ${0.92 * pulse})`; // #1c96c5 line stroke
    const cCyanLight = '#1c96c5'; // #1c96c5 dot & line
    const cDotWhite = '#1c96c5'; // #1c96c5 accent dot

    // ── FULL FACE TESSELLATION: Draw the complete MediaPipe mesh as connected triangles ──
    // These are the official MediaPipe FaceMesh triangle indices (subset of the 468-pt canonical)
    const FACE_TRIANGLES = [
      [10,338,297],[10,297,332],[10,332,284],[10,284,251],[10,251,389],[10,389,356],
      [338,297,332],[297,332,284],[332,284,251],[284,251,389],[251,389,356],
      [21,54,103],[21,103,67],[21,67,109],[21,109,10],[54,103,67],[103,67,109],
      [162,21,54],[162,54,103],[162,103,71],[71,103,68],[68,103,104],[104,103,69],
      [69,103,108],[108,103,107],[107,103,66],[66,103,105],[105,103,63],[63,103,70],
      [389,356,454],[356,454,323],[454,323,361],[323,361,288],[361,288,397],[288,397,365],
      [397,365,379],[365,379,378],[379,378,400],[378,400,377],[400,377,152],[377,152,148],
      [152,148,176],[148,176,149],[176,149,150],[149,150,136],[150,136,172],[136,172,58],
      [172,58,132],[58,132,93],[132,93,234],[93,234,127],[234,127,162],
      [33,7,163],[7,163,144],[163,144,145],[144,145,153],[145,153,154],[153,154,155],
      [154,155,133],[155,133,173],[133,173,157],[173,157,158],[157,158,159],[158,159,160],
      [159,160,161],[160,161,246],[161,246,33],
      [263,249,390],[249,390,373],[390,373,374],[373,374,380],[374,380,381],[380,381,382],
      [381,382,362],[382,362,398],[362,398,384],[398,384,385],[384,385,386],[385,386,387],
      [386,387,388],[387,388,466],[388,466,263],
      [1,2,97],[2,97,326],[97,326,98],[98,326,327],[97,98,99],[99,98,60],[60,98,218],
      [218,98,115],[115,98,131],[131,98,132],[2,19,1],[19,1,94],[94,1,2],
      [0,61,37],[61,37,39],[37,39,40],[39,40,185],[40,185,61],[185,61,78],
      [267,269,270],[269,270,409],[270,409,291],[409,291,375],[291,375,321],[375,321,405],
      [321,405,314],[405,314,17],[314,17,84],[17,84,181],[84,181,91],[181,91,146],
      [91,146,61],[78,80,81],[80,81,82],[81,82,13],[82,13,312],[13,312,311],
      [312,311,310],[311,310,415],[310,415,308],[415,308,324],[308,324,318],[324,318,402],
      [318,402,317],[402,317,14],[317,14,87],[14,87,178],[87,178,88],[178,88,95],
      [116,123,147],[123,147,213],[147,213,192],[213,192,214],[192,214,207],[214,207,205],
      [207,205,187],[205,187,143],[187,143,111],[143,111,117],[111,117,118],[117,118,50],
      [118,50,101],[50,101,100],[101,100,47],[100,47,126],[47,126,217],[126,217,234],
      [345,352,376],[352,376,411],[376,411,433],[411,433,416],[433,416,434],[416,434,427],
      [434,427,425],[427,425,411],[425,411,349],[411,349,348],[349,348,329],[348,329,277],
      [329,277,350],[277,350,280],[350,280,330],[280,330,347],[330,347,346],[347,346,340],
      [346,340,372],[340,372,345],[372,345,352],
      [226,247,30],[247,30,29],[30,29,27],[29,27,28],[27,28,56],[28,56,190],[56,190,243],
      [190,243,112],[243,112,26],[112,26,22],[26,22,23],[22,23,24],[23,24,110],[24,110,25],
      [446,467,260],[467,260,259],[260,259,257],[259,257,258],[257,258,286],[258,286,414],
      [286,414,463],[414,463,341],[463,341,256],[341,256,252],[256,252,253],[252,253,254],
      [253,254,339],[254,339,255],
    ];

    // Draw all mesh triangles as dotted edges
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const edgesDrawn = new Set<string>();
    const D = 2.0; // fixed base dot size for mesh triangles
    const SP = 4.5; // dot spacing

    for (const [a, b, c] of FACE_TRIANGLES) {
      const pa = landmarks[a], pb = landmarks[b], pc = landmarks[c];
      if (!pa || !pb || !pc) continue;
      const edges = [[a,b],[b,c],[a,c]];
      for (const [i1, i2] of edges) {
        const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
        if (edgesDrawn.has(key)) continue;
        edgesDrawn.add(key);
        const p1 = landmarks[i1], p2 = landmarks[i2];
        if (!p1 || !p2) continue;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(28, 150, 197, ${0.70 * pulse})`;
        ctx.lineWidth = D;
        ctx.lineCap = 'round';
        ctx.setLineDash([0, SP]);
        ctx.shadowBlur = 3;
        ctx.shadowColor = '#1c96c5';
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ── 1. Outer Face Oval / Hairline ──
    const faceOval = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10].map(i => landmarks[i]);
    drawDottedLineMesh(faceOval, cCyanLight, 2.4, 5, cDotWhite);

    // ── 2. Forehead Full Grid ──
    const foreheadTop = [21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251].map(i => landmarks[i]);
    const foreheadMid = [162, 71, 68, 104, 69, 108, 151, 337, 299, 333, 298, 301, 389].map(i => landmarks[i]);
    const foreheadLow = [70, 63, 105, 66, 107, 9, 336, 296, 334, 293, 300].map(i => landmarks[i]);
    const foreheadVertMid = [10, 151, 9, 8, 168, 6, 197].map(i => landmarks[i]);
    const foreheadVertR = [67, 68, 69, 108, 107, 55, 189].map(i => landmarks[i]);
    const foreheadVertL = [297, 298, 299, 337, 336, 285, 413].map(i => landmarks[i]);
    const foreheadVertR2 = [103, 104, 105, 66, 63].map(i => landmarks[i]);
    const foreheadVertL2 = [332, 333, 334, 296, 293].map(i => landmarks[i]);

    drawDottedLineMesh(foreheadTop, cCyanLight, 2.1, 5, cDotWhite);
    drawDottedLineMesh(foreheadMid, cLightBlue, 1.9, 5, cCyanLight);
    drawDottedLineMesh(foreheadLow, cCyanLight, 2.0, 5, cDotWhite);
    drawDottedLineMesh(foreheadVertMid, cCyanLight, 2.0, 5, cDotWhite);
    drawDottedLineMesh(foreheadVertR, cLightBlue, 1.8, 5.5, cCyanLight);
    drawDottedLineMesh(foreheadVertL, cLightBlue, 1.8, 5.5, cCyanLight);
    drawDottedLineMesh(foreheadVertR2, cLightBlue, 1.7, 6, cCyanLight);
    drawDottedLineMesh(foreheadVertL2, cLightBlue, 1.7, 6, cCyanLight);

    // ── 3. Eyebrows ──
    const browRightLower = [70, 63, 105, 66, 107, 55].map(i => landmarks[i]);
    const browRightUpper = [46, 53, 52, 65, 55, 107, 66, 105].map(i => landmarks[i]);
    const browLeftLower  = [336, 296, 334, 293, 300, 285].map(i => landmarks[i]);
    const browLeftUpper  = [276, 283, 282, 295, 285, 300, 293, 334].map(i => landmarks[i]);

    drawDottedLineMesh(browRightLower, cCyanLight, 2.1, 4.5, cDotWhite);
    drawDottedLineMesh(browRightUpper, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(browLeftLower,  cCyanLight, 2.1, 4.5, cDotWhite);
    drawDottedLineMesh(browLeftUpper,  cLightBlue, 1.8, 5, cCyanLight);

    // ── 4. Eye Orbits ──
    const orbitRight = [226, 247, 30, 29, 27, 28, 56, 190, 243, 112, 26, 22, 23, 24, 110, 25, 226].map(i => landmarks[i]);
    const orbitLeft  = [446, 467, 260, 259, 257, 258, 286, 414, 463, 341, 256, 252, 253, 254, 339, 255, 446].map(i => landmarks[i]);
    drawDottedLineMesh(orbitRight, cLightBlue, 1.8, 5.5, cCyanLight);
    drawDottedLineMesh(orbitLeft,  cLightBlue, 1.8, 5.5, cCyanLight);

    // ── 5. Nose ──
    const nasalMidline      = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2].map(i => landmarks[i]);
    const nasalBridgeHoriz1 = [189, 221, 55, 193, 168, 417, 285, 441, 413].map(i => landmarks[i]);
    const nasalBridgeHoriz2 = [122, 196, 197, 419, 351].map(i => landmarks[i]);
    const nasalRightRidge   = [196, 198, 131, 115, 49, 102, 64, 98].map(i => landmarks[i]);
    const nasalLeftRidge    = [419, 420, 360, 344, 279, 331, 294, 327].map(i => landmarks[i]);
    const nasalTipLoop      = [98, 97, 2, 326, 327].map(i => landmarks[i]);
    const nasalBaseWing     = [129, 98, 2, 327, 358].map(i => landmarks[i]);
    const philtrumColumella = [98, 164, 0, 327].map(i => landmarks[i]);
    const alanasalR         = [60, 218, 219, 220, 79, 166, 59, 75, 240, 235].map(i => landmarks[i]);
    const alanasalL         = [290, 438, 439, 440, 309, 391, 289, 305, 460, 455].map(i => landmarks[i]);

    drawDottedLineMesh(nasalMidline, cCyanLight, 2.2, 4.5, cDotWhite);
    drawDottedLineMesh(nasalBridgeHoriz1, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(nasalBridgeHoriz2, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(nasalRightRidge, cLightBlue, 1.9, 5, cCyanLight);
    drawDottedLineMesh(nasalLeftRidge,  cLightBlue, 1.9, 5, cCyanLight);
    drawDottedLineMesh(nasalTipLoop, cCyanLight, 2.1, 4.5, cDotWhite);
    drawDottedLineMesh(nasalBaseWing, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(philtrumColumella, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(alanasalR, cLightBlue, 1.7, 5, cCyanLight);
    drawDottedLineMesh(alanasalL, cLightBlue, 1.7, 5, cCyanLight);

    // ── 6. Cheeks + Temples + Zygomatic ──
    const cheekVertR1   = [143, 111, 117, 118, 100, 47, 50, 205, 187, 147, 150].map(i => landmarks[i]);
    const cheekVertR2   = [127, 234, 93, 132, 58, 172, 136, 150, 149, 176].map(i => landmarks[i]);
    const cheekVertR3   = [227, 137, 177, 215, 138, 135, 169, 170, 140, 171, 175].map(i => landmarks[i]);
    const cheekHorizR1  = [234, 93, 132, 172, 136, 150].map(i => landmarks[i]);
    const cheekHorizR2  = [127, 47, 126, 217, 234].map(i => landmarks[i]);
    const cheekVertL1   = [372, 340, 346, 347, 329, 277, 280, 425, 411, 376, 379].map(i => landmarks[i]);
    const cheekVertL2   = [356, 454, 323, 361, 288, 397, 365, 379, 378, 400].map(i => landmarks[i]);
    const cheekVertL3   = [447, 366, 401, 435, 367, 364, 394, 395, 369, 396, 399].map(i => landmarks[i]);
    const cheekHorizL1  = [454, 323, 361, 397, 365, 379].map(i => landmarks[i]);
    const cheekHorizL2  = [356, 277, 346, 437, 454].map(i => landmarks[i]);
    const infraOrbital  = [116, 123, 147, 213, 192, 4, 416, 433, 376, 352, 345].map(i => landmarks[i]);
    const nasolabialR   = [98, 203, 92, 165, 186, 57, 43, 106, 182].map(i => landmarks[i]);
    const nasolabialL   = [327, 423, 322, 391, 410, 287, 273, 335, 406].map(i => landmarks[i]);
    const zygomaticR    = [116, 123, 147, 187, 205, 207, 214, 192, 213].map(i => landmarks[i]);
    const zygomaticL    = [345, 352, 376, 411, 425, 427, 434, 416, 433].map(i => landmarks[i]);
    const templeRidgeR  = [21, 162, 127, 234, 93].map(i => landmarks[i]);
    const templeRidgeL  = [251, 389, 356, 454, 323].map(i => landmarks[i]);
    const templeDeepR   = [54, 103, 162, 21, 71, 68].map(i => landmarks[i]);
    const templeDeepL   = [284, 332, 389, 251, 301, 298].map(i => landmarks[i]);

    drawDottedLineMesh(cheekVertR1, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(cheekVertR2, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(cheekVertR3, cLightBlue, 1.7, 5.5, cCyanLight);
    drawDottedLineMesh(cheekHorizR1, cLightBlue, 1.6, 6, cCyanLight);
    drawDottedLineMesh(cheekHorizR2, cLightBlue, 1.6, 6, cCyanLight);
    drawDottedLineMesh(cheekVertL1, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(cheekVertL2, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(cheekVertL3, cLightBlue, 1.7, 5.5, cCyanLight);
    drawDottedLineMesh(cheekHorizL1, cLightBlue, 1.6, 6, cCyanLight);
    drawDottedLineMesh(cheekHorizL2, cLightBlue, 1.6, 6, cCyanLight);
    drawDottedLineMesh(infraOrbital, cCyanLight, 2.0, 5, cDotWhite);
    drawDottedLineMesh(nasolabialR, cCyanLight, 2.0, 4.8, cDotWhite);
    drawDottedLineMesh(nasolabialL, cCyanLight, 2.0, 4.8, cDotWhite);
    drawDottedLineMesh(zygomaticR, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(zygomaticL, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(templeRidgeR, cLightBlue, 1.8, 5.5, cCyanLight);
    drawDottedLineMesh(templeRidgeL, cLightBlue, 1.8, 5.5, cCyanLight);
    drawDottedLineMesh(templeDeepR, cLightBlue, 1.6, 6, cCyanLight);
    drawDottedLineMesh(templeDeepL, cLightBlue, 1.6, 6, cCyanLight);

    // ── 7. Lips ──
    const outerLips = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61].map(i => landmarks[i]);
    const innerLips = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78].map(i => landmarks[i]);
    const lipCupidR = [61, 40, 37, 0].map(i => landmarks[i]);
    const lipCupidL = [291, 270, 267, 0].map(i => landmarks[i]);
    drawDottedLineMesh(outerLips, cCyanLight, 2.1, 4.5, cDotWhite);
    drawDottedLineMesh(innerLips, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(lipCupidR, cLightBlue, 1.7, 5, cCyanLight);
    drawDottedLineMesh(lipCupidL, cLightBlue, 1.7, 5, cCyanLight);

    // ── 8. Jawline + Chin ──
    const jawContour      = [234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234].map(i => landmarks[i]);
    const chinArcs        = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397].map(i => landmarks[i]);
    const chinMentalCrease= [202, 212, 214, 192, 213, 148, 152, 377, 433, 416, 434, 432, 422].map(i => landmarks[i]);
    const jawInnerR       = [132, 58, 172, 136, 150, 149, 176].map(i => landmarks[i]);
    const jawInnerL       = [361, 288, 397, 365, 379, 378, 400].map(i => landmarks[i]);
    const mandibularR     = [93, 132, 58, 172, 136, 150, 149, 176, 148, 152].map(i => landmarks[i]);
    const mandibularL     = [323, 361, 288, 397, 365, 379, 378, 400, 377, 152].map(i => landmarks[i]);

    drawDottedLineMesh(jawContour, cLightBlue, 2.2, 5.5, cDotWhite);
    drawDottedLineMesh(chinArcs, cCyanLight, 2.0, 4.8, cCyanLight);
    drawDottedLineMesh(chinMentalCrease, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(jawInnerR, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(jawInnerL, cLightBlue, 1.8, 5, cCyanLight);
    drawDottedLineMesh(mandibularR, cLightBlue, 1.7, 5.5, cCyanLight);
    drawDottedLineMesh(mandibularL, cLightBlue, 1.7, 5.5, cCyanLight);

    // ── 9. High-Density Facial Landmark Dot Matrix (ALL key face points) ──
    const surfaceDotIndices = [
      // Forehead & scalp boundary
      10, 338, 297, 332, 284, 251, 389, 21, 54, 103, 67, 109,
      151, 9, 8, 168, 6, 197, 195, 5,
      71, 68, 104, 69, 108, 107, 66, 105, 63, 70,
      301, 298, 299, 337, 336, 285, 295, 282, 283, 276,
      // Temples
      162, 127, 234, 356, 389, 454, 93, 323,
      // Cheeks mid
      116, 123, 147, 213, 192, 214, 207, 205, 187, 143, 111, 117, 118, 50, 101, 100, 47, 126,
      345, 352, 376, 433, 416, 434, 427, 425, 411, 372, 340, 346, 347, 329, 277, 350, 280,
      // Nasal
      4, 1, 19, 94, 2, 98, 97, 326, 327, 129, 358, 115, 49, 102, 64, 131, 198,
      360, 344, 279, 294, 331, 420, 419, 122, 196, 197, 168,
      // Lips
      61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
      375, 321, 405, 314, 17, 84, 181, 91, 146,
      78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
      // Jaw & chin
      132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361,
      // Eyes brows
      46, 53, 52, 65, 55, 276, 283, 295, 285,
      // Lower face
      164, 0, 11, 12, 13, 14, 15, 16, 17, 18, 200, 199, 175, 171, 140, 170, 169, 135, 138, 215,
      377, 396, 369, 395, 394, 364, 367, 435, 401, 366, 447,
    ];
    ctx.save();
    ctx.fillStyle = cCyanLight;
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#1c96c5';
    ctx.beginPath();
    const dotR = 1.6;
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

    // ── 10. Collar Arcs ──
    const pChin2 = landmarks[152];
    const pLeftEar = landmarks[234];
    const pRightEar = landmarks[454];

    if (pChin2 && pLeftEar && pRightEar) {
      const jawWidth = Math.abs(pRightEar.x - pLeftEar.x);
      const neckCenterX = (pLeftEar.x + pRightEar.x) / 2;
      const neckBaseY = pChin2.y;

      for (let r = 1; r <= 3; r++) {
        const ringY = neckBaseY + r * 0.030;
        if (ringY > 1.02) break;
        const halfSpan = (jawWidth * 0.38) * (1.0 + r * 0.08);
        const dip = 9 + r * 2.5;

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

    // ── 11. Eyes ──
    const drawRadiantEye = (centerIdx: number, palpebralIndices: number[]) => {
      const pCenter = landmarks[centerIdx];
      if (!pCenter) return;
      const cx = pCenter.x * w;
      const cy = pCenter.y * h;

      const eyePts = palpebralIndices.map(i => landmarks[i]).filter(Boolean);
      if (eyePts.length > 2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(eyePts[0].x * w, eyePts[0].y * h);
        for (let i = 1; i < eyePts.length; i++) {
          ctx.lineTo(eyePts[i].x * w, eyePts[i].y * h);
        }
        ctx.closePath();
        ctx.strokeStyle = '#1c96c5';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.setLineDash([0, 5]);
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#1c96c5';
        ctx.stroke();
        ctx.fillStyle = `rgba(28, 150, 197, ${0.08 * pulse})`;
        ctx.fill();
        ctx.restore();
      }

      const rOuter = 13;
      const rInner = 3.5;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(28, 150, 197, ${0.85 * pulse})`;
      ctx.lineWidth = 1.0;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#1c96c5';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#1c96c5';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
      ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
      ctx.strokeStyle = 'rgba(28, 150, 197, 0.8)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    };

    const rightEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33];
    const leftEyeIndices  = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263];
    drawRadiantEye(468, rightEyeIndices);
    drawRadiantEye(473, leftEyeIndices);

    // ── 12. IPD Caliper ──
    const pR = landmarks[468];
    const pL = landmarks[473];
    if (pR && pL) {
      const rx = pR.x * w, ry = pR.y * h;
      const lx = pL.x * w, ly = pL.y * h;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(lx, ly);
      ctx.strokeStyle = '#1c96c5';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([2, 3]);
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#1c96c5';
      ctx.stroke();

      const capH = 5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(rx, ry - capH); ctx.lineTo(rx, ry + capH);
      ctx.moveTo(lx, ly - capH); ctx.lineTo(lx, ly + capH);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.0;
      ctx.stroke();
      ctx.restore();

      const midX = (rx + lx) / 2;
      const midY = (ry + ly) / 2 - 13;
      const ipdText = `IPD ${liveIpdMm.toFixed(1)}mm`;

      ctx.save();
      ctx.font = `600 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      const ipdTw = ctx.measureText(ipdText).width;
      const ipdBoxW = ipdTw + 14;
      const ipdBoxH = 16;

      ctx.fillStyle = 'rgba(4, 8, 28, 0.88)';
      ctx.beginPath();
      ctx.roundRect(midX - ipdBoxW / 2, midY - ipdBoxH / 2, ipdBoxW, ipdBoxH, 5);
      ctx.fill();
      ctx.strokeStyle = '#1c96c5';
      ctx.lineWidth = 1.0;
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#1c96c5';
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ipdText, midX, midY);
      ctx.restore();
    }

    // ── 13. Laser Scan Tracer ──
    const pTop2   = landmarks[10];
    const pBottom2= landmarks[152];
    const pLeft2  = landmarks[234];
    const pRight2 = landmarks[454];

    if (pTop2 && pBottom2 && pLeft2 && pRight2) {
      const yMin = pTop2.y * h;
      const yMax = pBottom2.y * h;
      const xMin = Math.min(pLeft2.x, pRight2.x) * w - 16;
      const xMax = Math.max(pLeft2.x, pRight2.x) * w + 16;

      const sweepT = (Math.sin(time * 2.4) + 1) / 2;
      const scanY = yMin + sweepT * (yMax - yMin);

      const gradH = 16;
      const grad = ctx.createLinearGradient(0, scanY - gradH, 0, scanY + gradH);
      grad.addColorStop(0, 'rgba(28, 150, 197, 0)');
      grad.addColorStop(0.5, `rgba(28, 150, 197, ${0.18 * pulseFast})`);
      grad.addColorStop(1, 'rgba(28, 150, 197, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(xMin, scanY - gradH, xMax - xMin, gradH * 2);

      ctx.beginPath();
      ctx.moveTo(xMin, scanY);
      ctx.lineTo(xMax, scanY);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.90 * pulseFast})`;
      ctx.lineWidth = 0.9;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#1c96c5';
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
    ctx.strokeStyle = '#1c96c5';
    ctx.shadowBlur = 8 * distScale;
    ctx.shadowColor = '#1c96c5';

    // Corner Frame Brackets (Thin & Crisp #1c96c5)
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
    ctx.fillStyle = '#1c96c5';
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
    ctx.strokeStyle = '#1c96c5';
    ctx.lineWidth = 1.0 * distScale;
    ctx.setLineDash([3 * distScale, 3 * distScale]);
    ctx.shadowBlur = 4 * distScale;
    ctx.shadowColor = '#1c96c5';
    ctx.stroke();
    ctx.restore();

    // Attitude Pod (Refined #1c96c5 Modern)
    ctx.fillStyle = 'rgba(4, 8, 28, 0.90)';
    ctx.beginPath();
    ctx.roundRect(headPillX, headPillY, headPillW, headPillH, 6);
    ctx.fill();
    ctx.strokeStyle = '#1c96c5';
    ctx.lineWidth = 1.0 * distScale;
    ctx.shadowBlur = 6 * distScale;
    ctx.shadowColor = '#1c96c5';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Indicator Pip
    ctx.fillStyle = '#1c96c5';
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
    ctx.strokeStyle = '#1c96c5';
    ctx.lineWidth = 1.0;
    ctx.shadowBlur = 6 * distScale;
    ctx.shadowColor = '#1c96c5';
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
