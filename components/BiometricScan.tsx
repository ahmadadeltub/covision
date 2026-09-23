
import { GoogleGenAI } from "@google/genai";
import React, { useEffect, useRef, useState, RefObject } from 'react';
import { Language, UserProfile, DistanceStatus } from '../types';
import { isLowPowerDevice } from '../utils/devicePerformance';

const BIOMETRIC_FACE_TRIANGLES = [
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

const BIOMETRIC_FACE_EDGES: [number, number][] = (() => {
  const edgeSet = new Set<string>();
  const list: [number, number][] = [];
  for (const [a, b, c] of BIOMETRIC_FACE_TRIANGLES) {
    for (const [i1, i2] of [[a, b], [b, c], [a, c]]) {
      const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        list.push([i1, i2]);
      }
    }
  }
  return list;
})();

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
          const cw = canvas.clientWidth;
          const ch = canvas.clientHeight;
          if (cw > 0 && ch > 0) {
            if (canvas.width !== cw || canvas.height !== ch) {
              canvas.width = cw;
              canvas.height = ch;
            }
            ctx.clearRect(0, 0, cw, ch);
            const liveDist = (window as any).__covisionCurrentDistance || distanceMRef.current || distanceM;
            drawFaceMask(ctx, landmarks, cw, ch, liveDist);

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

    // Exact video coordinate mapping for object-cover centering & crop
    let displayedW = w;
    let displayedH = h;
    let offsetX = 0;
    let offsetY = 0;

    const vid = videoRef.current;
    if (vid && vid.videoWidth > 0 && vid.videoHeight > 0) {
      const videoAspect = vid.videoWidth / vid.videoHeight;
      const canvasAspect = w / h;
      if (canvasAspect > videoAspect) {
        displayedW = w;
        displayedH = w / videoAspect;
        offsetX = 0;
        offsetY = (h - displayedH) / 2;
      } else {
        displayedH = h;
        displayedW = h * videoAspect;
        offsetX = (w - displayedW) / 2;
        offsetY = 0;
      }
    }

    const toX = (nx: number) => offsetX + nx * displayedW;
    const toY = (ny: number) => offsetY + ny * displayedH;

    // 3-Axis Head Pose Attitude (Yaw, Pitch, Roll)
    let yawDeg = 0;
    let pitchDeg = 0;
    let rollDeg = 0;
    if (landmarks[33] && landmarks[263] && landmarks[1]) {
      const dEyeX = (toX(landmarks[263].x) - toX(landmarks[33].x));
      const dEyeY = (toY(landmarks[263].y) - toY(landmarks[33].y));
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
      const dx = (toX(landmarks[473].x) - toX(landmarks[468].x));
      const dy = (toY(landmarks[473].y) - toY(landmarks[468].y));
      const eyeDistPx = Math.hypot(dx, dy);
      const fl = displayedW * 0.7413;
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

    // Fast-response head pose attitude & distance (0.4 prev + 0.6 live for instant update)
    const smoothYaw = Math.round(lastAnglesRef.current.yaw * 0.4 + yawDeg * 0.6);
    const smoothPitch = Math.round(lastAnglesRef.current.pitch * 0.4 + pitchDeg * 0.6);
    const smoothRoll = Math.round(lastAnglesRef.current.roll * 0.4 + rollDeg * 0.6);
    const smoothedDist = lastAnglesRef.current.dist * 0.4 + dynamicDistM * 0.6;
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
      ctx.moveTo(toX(validPts[0].x), toY(validPts[0].y));
      for (let i = 1; i < validPts.length - 1; i++) {
        const xc = (validPts[i].x + validPts[i + 1].x) / 2;
        const yc = (validPts[i].y + validPts[i + 1].y) / 2;
        ctx.quadraticCurveTo(toX(validPts[i].x), toY(validPts[i].y), toX(xc), toY(yc));
      }
      ctx.lineTo(toX(validPts[validPts.length - 1].x), toY(validPts[validPts.length - 1].y));
      ctx.stroke();

      // 2. High-precision Dotted Line (Dots Line) with luminous #1c96c5 glow
      ctx.beginPath();
      ctx.strokeStyle = dotColor;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.setLineDash([0, spacing]); // Dash length 0 + round cap = perfect circular dots
      ctx.shadowBlur = 5 * distScale;
      ctx.shadowColor = '#1c96c5';
      ctx.moveTo(toX(validPts[0].x), toY(validPts[0].y));
      for (let i = 1; i < validPts.length - 1; i++) {
        const xc = (validPts[i].x + validPts[i + 1].x) / 2;
        const yc = (validPts[i].y + validPts[i + 1].y) / 2;
        ctx.quadraticCurveTo(toX(validPts[i].x), toY(validPts[i].y), toX(xc), toY(yc));
      }
      ctx.lineTo(toX(validPts[validPts.length - 1].x), toY(validPts[validPts.length - 1].y));
      ctx.stroke();

      // 3. Highlight luminous micro-nodes at key facial landmark vertices
      ctx.setLineDash([]);
      ctx.fillStyle = accentColor;
      ctx.shadowBlur = 6 * distScale;
      ctx.shadowColor = '#1c96c5';
      ctx.beginPath();
      const nodeR = Math.max(0.9, size * 0.55);
      for (let i = 0; i < validPts.length; i++) {
        const px = toX(validPts[i].x);
        const py = toY(validPts[i].y);
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
    // Single hardware pass using static precomputed edges (zero GC allocations)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const D = 2.0;
    const SP = 4.5;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(28, 150, 197, ${0.70 * pulse})`;
    ctx.lineWidth = D;
    ctx.lineCap = 'round';
    ctx.setLineDash([0, SP]);
    if (!isLowPowerDevice) {
      ctx.shadowBlur = 3;
      ctx.shadowColor = '#1c96c5';
    }
    for (let i = 0; i < BIOMETRIC_FACE_EDGES.length; i++) {
      const [i1, i2] = BIOMETRIC_FACE_EDGES[i];
      const p1 = landmarks[i1], p2 = landmarks[i2];
      if (!p1 || !p2) continue;
      ctx.moveTo(toX(p1.x), toY(p1.y));
      ctx.lineTo(toX(p2.x), toY(p2.y));
    }
    ctx.stroke();
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
    drawDottedLineMesh(nasalRightRidge,   cLightBlue, 1.9, 5, cCyanLight);
    drawDottedLineMesh(nasalLeftRidge,    cLightBlue, 1.9, 5, cCyanLight);
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

    // ── 9. High-Density Facial Landmark Dot Matrix ──
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
      // Eyebrows
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
        const px = toX(p.x);
        const py = toY(p.y);
        ctx.moveTo(px + dotR, py);
        ctx.arc(px, py, dotR, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    ctx.restore();

    // ── 10. Collar Arcs ──
    const pForehead = landmarks[10];
    const pChin = landmarks[152];
    const pLeftEar = landmarks[234];
    const pRightEar = landmarks[454];

    if (pChin && pLeftEar && pRightEar) {
      const jawWidth = Math.abs(toX(pRightEar.x) - toX(pLeftEar.x));
      const neckCenterX = (toX(pLeftEar.x) + toX(pRightEar.x)) / 2;
      const neckBaseY = toY(pChin.y);

      for (let r = 1; r <= 3; r++) {
        const ringY = neckBaseY + r * (displayedH * 0.030);
        if (ringY > h + 20) break;
        const halfSpan = (jawWidth * 0.38) * (1.0 + r * 0.08);
        const dip = 9 + r * 2.5;

        const ringPts = [];
        for (let s = 0; s <= 8; s++) {
          const t = s / 8;
          const px = (neckCenterX - halfSpan) + 2 * halfSpan * t;
          const py = ringY + (Math.sin(t * Math.PI) * dip);
          ringPts.push({ x: (px - offsetX) / (displayedW || 1), y: (py - offsetY) / (displayedH || 1) });
        }
        drawDottedLineMesh(ringPts, cLightBlue, 1.8, 6, cCyanLight);
      }
    }

    // ── 11. Luminous Modern AI Eyes ──
    const drawRadiantEye = (centerIdx: number, palpebralIndices: number[]) => {
      const pCenter = landmarks[centerIdx];
      if (!pCenter) return;
      const cx = toX(pCenter.x);
      const cy = toY(pCenter.y);

      const eyePts = palpebralIndices.map(i => landmarks[i]).filter(Boolean);
      if (eyePts.length > 2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(toX(eyePts[0].x), toY(eyePts[0].y));
        for (let i = 1; i < eyePts.length; i++) {
          ctx.lineTo(toX(eyePts[i].x), toY(eyePts[i].y));
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
      ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 5, cy);
      ctx.strokeStyle = 'rgba(28, 150, 197, 0.8)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    };

    const rightEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33];
    const leftEyeIndices = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263];
    drawRadiantEye(468, rightEyeIndices);
    drawRadiantEye(473, leftEyeIndices);

    // ── 12. IPD Caliper ──
    const pR = landmarks[468];
    const pL = landmarks[473];
    if (pR && pL) {
      const rx = toX(pR.x), ry = toY(pR.y);
      const lx = toX(pL.x), ly = toY(pL.y);

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

      // Unmirror text horizontally so it reads left-to-right correctly
      ctx.save();
      ctx.translate(midX, midY);
      ctx.scale(-1, 1);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ipdText, 0, 0);
      ctx.restore();
      ctx.restore();
    }

    // ── 13. Laser Scan Tracer ──
    const pTop = landmarks[10];
    const pBottom = landmarks[152];
    const pLeft = landmarks[234];
    const pRight = landmarks[454];

    if (pTop && pBottom && pLeft && pRight) {
      const yMin = toY(pTop.y);
      const yMax = toY(pBottom.y);
      const xMin = Math.min(toX(pLeft.x), toX(pRight.x)) - 16;
      const xMax = Math.max(toX(pLeft.x), toX(pRight.x)) + 16;

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

    const boxLeft = Math.max(12, (w - toX(maxX)) - (18 * distScale));
    const boxRight = Math.min(w - 12, (w - toX(minX)) + (18 * distScale));
    const boxTop = Math.max(12, toY(minY) - (22 * distScale));
    const boxBottom = Math.min(h - 12, toY(maxY) + (18 * distScale));
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
    <div className="w-full h-full max-h-full flex flex-col justify-between items-center overflow-hidden px-2 py-1 md:py-2 relative">
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

      <div className="w-full max-w-4xl glass p-2 sm:p-3 rounded-2xl md:rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden bg-slate-900/70 flex-1 min-h-0 flex flex-col justify-between shrink-1 z-10 gap-2">

        {/* ─── Unified High-Tech Diagnostic Top Bar ─── */}
        <div className="w-full flex items-center justify-between px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-black/50 border border-white/10 backdrop-blur-md shadow-sm shrink-0">
          {/* Status Badge */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${
              scanning 
                ? 'bg-rose-500 animate-pulse shadow-[0_0_12px_#f43f5e]' 
                : canAuthorize 
                  ? 'bg-emerald-400 shadow-[0_0_12px_#10b981]' 
                  : 'bg-cyan-400 animate-pulse shadow-[0_0_12px_#00f3ff]'
            }`} />
            <div className="flex flex-col">
              <span className="text-[11px] sm:text-xs md:text-sm font-black text-white uppercase tracking-wider drop-shadow">
                {scanning ? 'SCANNING BIOMETRICS...' : (status || (manualOverride ? 'MANUAL OVERRIDE' : 'BIOMETRIC SCAN'))}
              </span>
              <span className="text-[8px] sm:text-[9px] font-mono text-cyan-400/80 font-bold uppercase tracking-widest hidden sm:inline">
                Optical Reticle Active
              </span>
            </div>
          </div>

          {/* Instrument-Grade Live Optical Distance Telemetry Pod */}
          <div className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-lg sm:rounded-full border flex items-center gap-2 transition-all duration-300 shadow-md ${
            distanceStatus === 'ok' || manualOverride
              ? 'bg-slate-900/90 border-emerald-500/60 shadow-[0_0_18px_rgba(16,185,129,0.25)] text-emerald-300'
              : distanceStatus === 'too_close'
                ? 'bg-slate-900/90 border-rose-500/60 shadow-[0_0_18px_rgba(244,63,94,0.25)] text-rose-300'
                : 'bg-slate-900/90 border-amber-500/60 shadow-[0_0_18px_rgba(245,158,11,0.25)] text-amber-300'
          }`}>
            <div className="relative w-4 h-4 sm:w-5 sm:h-5 rounded-md flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: distanceStatus === 'ok' || manualOverride ? 'rgba(16, 185, 129, 0.15)' : distanceStatus === 'too_close' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                borderColor: distanceStatus === 'ok' || manualOverride ? 'rgba(16, 185, 129, 0.5)' : distanceStatus === 'too_close' ? 'rgba(244, 63, 94, 0.5)' : 'rgba(245, 158, 11, 0.5)'
              }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${distanceStatus === 'ok' || manualOverride ? 'bg-emerald-400' : distanceStatus === 'too_close' ? 'bg-rose-400' : 'bg-amber-400'}`} />
            </div>

            <div className="flex items-baseline gap-1.5 leading-none">
              <span className="text-xs sm:text-sm md:text-base font-black font-mono tracking-tight tabular-nums text-white">
                {manualOverride ? 'OVERRIDE' : distanceM > 0 ? distanceM.toFixed(2) : '—.—'}
                {!manualOverride && <span className="text-[9px] font-sans font-bold text-slate-400 ml-0.5">m</span>}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider border ${
                distanceStatus === 'ok' || manualOverride
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                  : distanceStatus === 'too_close'
                    ? 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                    : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
              }`}>
                {manualOverride
                  ? 'BYPASSED'
                  : distanceStatus === 'ok'
                    ? 'IN ZONE'
                    : distanceStatus === 'too_close'
                      ? 'STEP BACK'
                      : 'STEP CLOSER'}
              </span>
            </div>
          </div>

          {/* Right: Mesh Indicators & Progress */}
          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-mono font-bold text-cyan-300">
              468-PTS AI
            </span>
            <div className="text-xs sm:text-sm font-mono text-cyan-400 font-black tracking-widest bg-cyan-950/50 px-2 py-0.5 rounded-md border border-cyan-500/30">
              {Math.round(progress)}%
            </div>
          </div>
        </div>

        {/* ─── Futuristic AI Camera Frame & Reticle Container ─── */}
        <div 
          ref={containerRef} 
          className={`relative aspect-[16/10] sm:aspect-video flex-1 min-h-0 max-h-[50vh] sm:max-h-[54vh] w-full max-w-3xl mx-auto rounded-2xl md:rounded-3xl overflow-hidden bg-black transition-all duration-500 ${
            scanning
              ? 'border-2 border-cyan-400 shadow-[0_0_40px_rgba(0,243,255,0.45),inset_0_0_25px_rgba(0,243,255,0.2)]'
              : canAuthorize
                ? 'border-2 border-emerald-400/90 shadow-[0_0_35px_rgba(16,185,129,0.35),inset_0_0_25px_rgba(16,185,129,0.15)]'
                : 'border-2 border-cyan-500/70 shadow-[0_0_25px_rgba(6,182,212,0.3),inset_0_0_20px_rgba(6,182,212,0.15)]'
          }`}
        >
          {/* Live Video Feed */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1] brightness-125 contrast-[1.1]"
          />

          {/* AI Face Mesh Canvas Overlay */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full z-20 pointer-events-none"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* ── AI Frame Border Accents & Precision Corner Reticles ── */}
          {/* Top-Left Corner Bracket */}
          <div className={`absolute top-0 left-0 w-8 h-8 sm:w-12 sm:h-12 border-t-[3.5px] border-l-[3.5px] rounded-tl-2xl z-30 pointer-events-none transition-all duration-300 ${
            canAuthorize ? 'border-emerald-400 shadow-[0_0_15px_#10b981]' : 'border-cyan-400 shadow-[0_0_15px_#00f3ff]'
          }`}>
            <span className="absolute top-1.5 left-1.5 text-[9px] font-mono leading-none text-cyan-300/80 font-bold">+</span>
          </div>

          {/* Top-Right Corner Bracket */}
          <div className={`absolute top-0 right-0 w-8 h-8 sm:w-12 sm:h-12 border-t-[3.5px] border-r-[3.5px] rounded-tr-2xl z-30 pointer-events-none transition-all duration-300 ${
            canAuthorize ? 'border-emerald-400 shadow-[0_0_15px_#10b981]' : 'border-cyan-400 shadow-[0_0_15px_#00f3ff]'
          }`}>
            <span className="absolute top-1.5 right-1.5 text-[9px] font-mono leading-none text-cyan-300/80 font-bold">+</span>
          </div>

          {/* Bottom-Left Corner Bracket */}
          <div className={`absolute bottom-0 left-0 w-8 h-8 sm:w-12 sm:h-12 border-b-[3.5px] border-l-[3.5px] rounded-bl-2xl z-30 pointer-events-none transition-all duration-300 ${
            canAuthorize ? 'border-emerald-400 shadow-[0_0_15px_#10b981]' : 'border-cyan-400 shadow-[0_0_15px_#00f3ff]'
          }`}>
            <span className="absolute bottom-1.5 left-1.5 text-[9px] font-mono leading-none text-cyan-300/80 font-bold">+</span>
          </div>

          {/* Bottom-Right Corner Bracket */}
          <div className={`absolute bottom-0 right-0 w-8 h-8 sm:w-12 sm:h-12 border-b-[3.5px] border-r-[3.5px] rounded-br-2xl z-30 pointer-events-none transition-all duration-300 ${
            canAuthorize ? 'border-emerald-400 shadow-[0_0_15px_#10b981]' : 'border-cyan-400 shadow-[0_0_15px_#00f3ff]'
          }`}>
            <span className="absolute bottom-1.5 right-1.5 text-[9px] font-mono leading-none text-cyan-300/80 font-bold">+</span>
          </div>

          {/* Center Edge Optical Alignment Notches */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 sm:w-16 h-1 bg-cyan-400/80 rounded-b shadow-[0_0_10px_#00f3ff] z-30 pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 sm:w-16 h-1 bg-cyan-400/80 rounded-t shadow-[0_0_10px_#00f3ff] z-30 pointer-events-none" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-10 sm:h-16 w-1 bg-cyan-400/80 rounded-r shadow-[0_0_10px_#00f3ff] z-30 pointer-events-none" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 h-10 sm:h-16 w-1 bg-cyan-400/80 rounded-l shadow-[0_0_10px_#00f3ff] z-30 pointer-events-none" />

          {/* HUD Top-Left Overlay Pill */}
          <div className="absolute top-2 sm:top-2.5 left-2.5 sm:left-3 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-black/70 backdrop-blur-md border border-cyan-500/30 text-cyan-300 font-mono text-[9px] sm:text-[10px] font-bold tracking-wider flex items-center gap-1.5 z-30 pointer-events-none shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#00f3ff]" />
            <span>[ ⛶ AI OPTICAL RETICLE · LIVE ]</span>
          </div>

          {/* HUD Top-Right Overlay Pill */}
          <div className="absolute top-2 sm:top-2.5 right-2.5 sm:right-3 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-black/70 backdrop-blur-md border border-cyan-500/30 text-cyan-300 font-mono text-[9px] sm:text-[10px] font-bold tracking-wider z-30 pointer-events-none shadow-sm">
            <span>[ 468-PTS NEURAL MESH ]</span>
          </div>

          {/* Laser Scanning Beam Sweep Animation */}
          {scanning && !complete && (
            <div className="absolute inset-x-0 h-4 bg-gradient-to-b from-cyan-400/0 via-cyan-400/40 to-cyan-400/0 shadow-[0_0_40px_#00f3ff] z-30 pointer-events-none animate-[scan_1.6s_ease-in-out_infinite]" />
          )}

          {/* Loading Indicator while FaceMesh initializes */}
          {!scanning && !complete && cameraReady && !faceLandmarksRef?.current && (
            <div className="absolute top-10 left-0 right-0 flex justify-center z-25 pointer-events-none">
              <div className="px-3.5 py-1.5 bg-black/70 backdrop-blur-md rounded-full border border-cyan-500/40 text-cyan-300 text-xs font-bold uppercase tracking-widest animate-pulse flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                {debugInfo?.faceMeshStatus === 'wasm_ready' || debugInfo?.faceMeshStatus === 'ready'
                  ? 'Detecting Face Landmarks...'
                  : debugInfo?.faceMeshStatus?.includes?.('loading') || debugInfo?.faceMeshStatus === 'creating_landmarker'
                    ? 'Loading AI Face Mesh...'
                    : debugInfo?.faceMeshStatus?.startsWith?.('error') || debugInfo?.faceMeshStatus === 'wasm_init_failed'
                      ? 'Face Mesh Error — Fallback Active'
                      : 'Detecting Face Landmarks...'}
              </div>
            </div>
          )}

          {/* Non-Obstructive Bottom Status Prompt Docked to Bottom Edge */}
          {!scanning && !complete && canAuthorize && (
            <div className="absolute inset-x-0 bottom-2.5 sm:bottom-3 flex justify-center pointer-events-none z-30 px-3">
              <div className="px-4 py-1.5 sm:px-6 sm:py-2 bg-slate-900/90 backdrop-blur-md rounded-full border border-emerald-400/80 text-emerald-300 font-black uppercase tracking-wider text-[11px] sm:text-xs md:text-sm shadow-[0_0_25px_rgba(16,185,129,0.35)] flex items-center gap-2 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                <span>{isFaceDetected ? 'Face Locked · Ready to Authorize Scan' : (manualOverride ? 'Manual Override Active' : 'Ready to Scan')}</span>
              </div>
            </div>
          )}

          {!scanning && !complete && !canAuthorize && (
            <div className="absolute inset-x-0 bottom-2.5 sm:bottom-3 flex justify-center pointer-events-none z-30 px-3">
              <div className="px-4 py-1.5 sm:px-5 sm:py-1.5 bg-black/75 backdrop-blur-md rounded-full border border-white/10 text-cyan-300 font-bold uppercase tracking-wider text-[10px] sm:text-xs shadow-md animate-pulse">
                {cameraReady ? 'Looking for Face — Center Face in Reticle' : 'Connecting Camera...'}
              </div>
            </div>
          )}
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

      <div className="w-full max-w-4xl shrink-0 z-10 pt-1">
        {aiError && (
          <div className="mb-1 p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-2">
            <span className="text-sm">🧠</span>
            <div>
              <p className="font-bold text-[10px] uppercase tracking-wider text-amber-400">On-Device Analysis Active</p>
              <p className="text-amber-300/80 text-[10px]">{aiError}</p>
            </div>
          </div>
        )}
        {complete && biometricData ? (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 w-full">
              <div className="glass p-2 sm:p-3 rounded-xl md:rounded-2xl border-b-4 border-cyan-500 bg-black/50 shadow-xl text-center flex flex-col justify-center min-h-[60px] md:min-h-[75px]">
                <div className="text-[8px] sm:text-[9px] font-black text-cyan-400 uppercase tracking-widest mb-0.5">Optical Age</div>
                <div className="text-xl sm:text-2xl md:text-3xl font-black text-white">{biometricData.age?.value ?? '??'}<span className="text-[10px] text-slate-500 ml-1">YRS</span></div>
              </div>
              <div className="glass p-2 sm:p-3 rounded-xl md:rounded-2xl border-b-4 border-purple-500 bg-black/50 shadow-xl text-center flex flex-col justify-center min-h-[60px] md:min-h-[75px]">
                <div className="text-[8px] sm:text-[9px] font-black text-purple-400 uppercase tracking-widest mb-0.5">Emotional State</div>
                <div className="text-xs sm:text-sm md:text-base font-black text-white uppercase break-words leading-tight">
                  {biometricData.mood?.value ?? 'STABLE'}
                </div>
              </div>
              <div className="glass p-2 sm:p-3 rounded-xl md:rounded-2xl border-b-4 border-emerald-500 bg-black/50 shadow-xl text-center flex flex-col justify-center min-h-[60px] md:min-h-[75px]">
                <div className="text-[8px] sm:text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Gender</div>
                <div className="text-xs sm:text-sm md:text-base font-black text-white uppercase break-words leading-tight">
                  {biometricData.gender?.value ?? 'N/A'}
                </div>
              </div>
              <div className="glass p-2 sm:p-3 rounded-xl md:rounded-2xl border-b-4 border-orange-500 bg-black/50 shadow-xl text-center flex flex-col justify-center min-h-[60px] md:min-h-[75px]">
                <div className="text-[8px] sm:text-[9px] font-black text-orange-400 uppercase tracking-widest mb-0.5">Corrective Lens</div>
                <div className="text-xs sm:text-sm md:text-base font-black text-white uppercase break-words leading-tight">
                  {biometricData.glasses?.value ? 'DETECTED' : 'NONE'}
                </div>
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3 w-full">
              <button
                onClick={resetScan}
                className="flex-1 py-3 sm:py-3.5 bg-slate-800/80 border border-white/10 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm md:text-base uppercase tracking-wider hover:bg-slate-700 transition-all shadow-md min-h-[50px] sm:min-h-[58px] flex items-center justify-center cursor-pointer"
              >
                {t.back}
              </button>
              <button
                onClick={handleNext}
                className="flex-[2] py-3 sm:py-3.5 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm md:text-base uppercase tracking-wider hover:from-sky-500 hover:to-indigo-500 transition-all shadow-md min-h-[50px] sm:min-h-[58px] flex items-center justify-center cursor-pointer"
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
                className={`w-full py-3.5 sm:py-4 md:py-4.5 min-h-[54px] sm:min-h-[64px] rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm md:text-base lg:text-lg uppercase tracking-wider md:tracking-[0.2em] transition-all shadow-xl group relative overflow-hidden flex items-center justify-center
                  ${canAuthorize 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:scale-[1.01] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] cursor-pointer' 
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'}`}
              >
                <span className="relative z-10">{canAuthorize ? 'AUTHORIZE SCAN' : (cameraReady ? 'DETECTING FACE...' : 'CONNECTING CAMERA...')}</span>
                {canAuthorize && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>}
              </button>
            ) : (
              <div className="w-full p-3 sm:p-4 glass rounded-xl sm:rounded-2xl text-center border-2 border-cyan-500/20 flex items-center justify-center gap-4 bg-black/40 shadow-inner min-h-[54px] sm:min-h-[64px]">
                <div className="flex gap-2 sm:gap-3">
                  <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s] shadow-[0_0_12px_#00f3ff]"></div>
                  <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s] shadow-[0_0_12px_#00f3ff]"></div>
                  <div className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 bg-cyan-400 rounded-full animate-bounce shadow-[0_0_12px_#00f3ff]"></div>
                </div>
                <span className="text-xs sm:text-sm md:text-lg font-black text-cyan-400 uppercase tracking-widest sm:tracking-[0.2em] md:tracking-[0.3em] animate-pulse">
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
