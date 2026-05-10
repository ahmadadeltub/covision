
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
          const effectiveDistanceM = distanceM > 0 ? distanceM : TARGET_M;

          if (lm && lm.length > 0) {
            drawBodyOverlay(ctx, lm, canvas.width, canvas.height, effectiveDistanceM);
          }

          // Draw Hands
          const handsLm = handLandmarksRef?.current;
          if (handsLm && handsLm.length > 0) {
            handsLm.forEach((hand) => {
              drawHandMesh(ctx, hand, canvas.width, canvas.height, effectiveDistanceM);
            });
          }
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
    return () => { stopped = true; };
  }, [faceLandmarksRef, handLandmarksRef, videoRef]);

  // ─── Hand Mesh Drawing ───
  const drawHandMesh = (ctx: CanvasRenderingContext2D, landmarks: any[], w: number, h: number, distM: number) => {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const time = Date.now() / 1000;
    const pulse = Math.sin(time * 5) * 0.2 + 0.8; // Faster pulse for hands

    // Scale thickness based on distance (closer = thicker, 2m away = thinner)
    const distScale = Math.max(0.3, Math.min(1.5, 1.8 - (distM * 0.5)));

    const drawLine = (i1: number, i2: number, color: string, baseLw: number) => {
      const p1 = landmarks[i1], p2 = landmarks[i2];
      if (!p1 || !p2 || p1.visibility < 0.1 || p2.visibility < 0.1) return;
      const lw = baseLw * distScale;
      ctx.beginPath();
      ctx.lineWidth = lw;
      ctx.strokeStyle = color;
      ctx.shadowBlur = lw * 2;
      ctx.shadowColor = color;
      ctx.moveTo(p1.x * w, p1.y * h);
      ctx.lineTo(p2.x * w, p2.y * h);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const drawJoint = (i: number, baseR: number, color: string) => {
      const p = landmarks[i];
      if (!p || p.visibility < 0.1) return;
      const r = baseR * distScale;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.shadowBlur = r * 3;
      ctx.shadowColor = color;
      ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const cLine = `rgba(0, 255, 200, ${0.8 * pulse})`;
    const cJoint = `rgba(150, 255, 255, ${0.9 * pulse})`;
    const cPalm = `rgba(0, 200, 255, ${0.15 * pulse})`;

    // --- Fill the palm to make it a continuous glowing MESH surface ---
    const palmIndices = [0, 1, 5, 9, 13, 17];
    ctx.beginPath();
    let started = false;
    palmIndices.forEach((idx) => {
      const p = landmarks[idx];
      if (!p || p.visibility < 0.1) return;
      if (!started) {
        ctx.moveTo(p.x * w, p.y * h);
        started = true;
      } else {
        ctx.lineTo(p.x * w, p.y * h);
      }
    });
    ctx.closePath();
    if (started) {
      ctx.fillStyle = cPalm;
      ctx.fill();
    }

    // Thumb
    drawLine(0, 1, cLine, 4); drawLine(1, 2, cLine, 4); drawLine(2, 3, cLine, 4); drawLine(3, 4, cLine, 4);
    // Index
    drawLine(0, 5, cLine, 4); drawLine(5, 6, cLine, 4); drawLine(6, 7, cLine, 4); drawLine(7, 8, cLine, 4);
    // Middle
    drawLine(9, 10, cLine, 4); drawLine(10, 11, cLine, 4); drawLine(11, 12, cLine, 4);
    // Ring
    drawLine(13, 14, cLine, 4); drawLine(14, 15, cLine, 4); drawLine(15, 16, cLine, 4);
    // Pinky
    drawLine(17, 18, cLine, 4); drawLine(18, 19, cLine, 4); drawLine(19, 20, cLine, 4);
    // Palm Base
    drawLine(5, 9, cLine, 4); drawLine(9, 13, cLine, 4); drawLine(13, 17, cLine, 4); drawLine(0, 17, cLine, 4);

    // Draw joints
    for (let i = 0; i < 21; i++) {
      drawJoint(i, i === 0 ? 6 : 4, cJoint);
    }

    ctx.restore();
  };

  // ─── Body Mesh Drawing (DISTANCE ADAPTIVE) ───
  const drawBodyOverlay = (ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number, distM: number) => {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const time = Date.now() / 1000;
    const pulse = Math.sin(time * 3) * 0.15 + 0.85;

    // Scale thickness based on distance (closer = thicker, 2m away = much thinner)
    // At 0.5m scale is ~1.0. At 2.0m scale is ~0.4
    const distScale = Math.max(0.3, Math.min(1.2, 1.5 - (distM * 0.45)));

    // ─── Body Skeleton (PoseLandmarker — real 33-point body detection) ───
    const poseLm = poseLandmarksRef?.current;
    if (poseLm && poseLm.length >= 25) {
      const blue = `rgba(30, 100, 255, ${0.9 * pulse})`;
      const blueGlow = `rgba(60, 140, 255, ${0.8 * pulse})`;

      const drawBodyLine = (i1: number, i2: number, color: string, lw: number) => {
        const p1 = poseLm[i1], p2 = poseLm[i2];
        // Only drop line if EXTREMELY low visibility (e.g. clearly off screen) to support 2M distances
        if (!p1 || !p2 || p1.visibility < 0.1 || p2.visibility < 0.1) return;
        const scaledLw = lw * distScale;
        ctx.beginPath();
        ctx.lineWidth = scaledLw;
        ctx.strokeStyle = color;
        ctx.shadowBlur = scaledLw * 3;
        ctx.shadowColor = color;
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
        ctx.stroke();
        ctx.shadowBlur = 0;
      };

      const drawBodyJoint = (i: number, r: number, color: string) => {
        const p = poseLm[i];
        if (!p || p.visibility < 0.1) return;
        const scaledR = r * distScale;
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.shadowBlur = scaledR * 4;
        ctx.shadowColor = color;
        ctx.arc(p.x * w, p.y * h, scaledR, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      };

      // Pose Landmark indices (MediaPipe Pose):
      // 11=left shoulder, 12=right shoulder, 13=left elbow, 14=right elbow
      // 15=left wrist, 16=right wrist, 23=left hip, 24=right hip

      // Shoulders
      drawBodyLine(11, 12, blue, 10);

      // Left arm (Thicker, more prominent)
      drawBodyLine(11, 13, blue, 8); // Upper arm
      drawBodyLine(13, 15, blue, 7); // Lower arm
      drawBodyLine(15, 17, blue, 5); // Wrist to pinky
      drawBodyLine(15, 19, blue, 5); // Wrist to index
      drawBodyLine(15, 21, blue, 5); // Wrist to thumb
      drawBodyLine(17, 19, blue, 4); // Pinky to index

      // Right arm
      drawBodyLine(12, 14, blue, 8);
      drawBodyLine(14, 16, blue, 7);
      drawBodyLine(16, 18, blue, 5);
      drawBodyLine(16, 20, blue, 5);
      drawBodyLine(16, 22, blue, 5);
      drawBodyLine(18, 20, blue, 4);

      // Torso (Box + Cross + Spine + Geometric Ribcage)
      drawBodyLine(11, 23, blue, 8); // Left side
      drawBodyLine(12, 24, blue, 8); // Right side
      drawBodyLine(23, 24, blue, 8); // Hip connector
      drawBodyLine(11, 24, `rgba(0, 150, 255, ${0.4 * pulse})`, 4); // Cross torso L-R
      drawBodyLine(12, 23, `rgba(0, 150, 255, ${0.4 * pulse})`, 4); // Cross torso R-L

      // Smart Ribcage Geometry (connecting mid-points)
      if (poseLm[11] && poseLm[12] && Math.min(poseLm[11].visibility, poseLm[12].visibility) > 0.1) {
        ctx.beginPath();
        const chestX = (poseLm[11].x + poseLm[12].x) / 2 * w;
        const chestY = (poseLm[11].y + poseLm[12].y) / 2 * h;

        ctx.fillStyle = `rgba(0, 255, 255, ${0.1 * pulse})`;
        ctx.arc(chestX, chestY, 20 * distScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(0, 255, 255, ${0.6 * pulse})`;
        ctx.lineWidth = 2 * distScale;
        ctx.moveTo(poseLm[11].x * w, poseLm[11].y * h);
        ctx.lineTo(chestX, chestY);
        ctx.lineTo(poseLm[12].x * w, poseLm[12].y * h);
        ctx.stroke();
      }

      // Spine estimation (mid shoulder to mid hip)
      if (poseLm[11] && poseLm[12] && poseLm[23] && poseLm[24]) {
        const midShoulderX = (poseLm[11].x + poseLm[12].x) / 2;
        const midShoulderY = (poseLm[11].y + poseLm[12].y) / 2;
        const midHipX = (poseLm[23].x + poseLm[24].x) / 2;
        const midHipY = (poseLm[23].y + poseLm[24].y) / 2;
        ctx.beginPath();
        ctx.lineWidth = 6 * distScale;
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.4 * pulse})`;
        ctx.moveTo(midShoulderX * w, midShoulderY * h);
        ctx.lineTo(midHipX * w, midHipY * h);
        ctx.stroke();
      }

      // Legs (if visible) — Cybernetic jointing
      drawBodyLine(23, 25, `rgba(20, 80, 220, ${0.8 * pulse})`, 8); // L Thigh
      drawBodyLine(24, 26, `rgba(20, 80, 220, ${0.8 * pulse})`, 8); // R Thigh
      drawBodyLine(25, 27, `rgba(20, 80, 220, ${0.7 * pulse})`, 6); // L Calf
      drawBodyLine(26, 28, `rgba(20, 80, 220, ${0.7 * pulse})`, 6); // R Calf

      // Feet
      drawBodyLine(27, 29, `rgba(20, 80, 220, ${0.6 * pulse})`, 5); // L Ankle to heel
      drawBodyLine(27, 31, `rgba(20, 80, 220, ${0.6 * pulse})`, 5); // L Ankle to toe
      drawBodyLine(29, 31, `rgba(20, 80, 220, ${0.5 * pulse})`, 4); // L Heel to toe

      drawBodyLine(28, 30, `rgba(20, 80, 220, ${0.6 * pulse})`, 5); // R Ankle to heel
      drawBodyLine(28, 32, `rgba(20, 80, 220, ${0.6 * pulse})`, 5); // R Ankle to toe
      drawBodyLine(30, 32, `rgba(20, 80, 220, ${0.5 * pulse})`, 4); // R Heel to toe

      // Face tracking bounds overlay (from Pose array points 0-10)
      if (poseLm[0] && poseLm[0].visibility > 0.1) {
        // Draw cyber-goggles over eyes using pose features
        drawBodyLine(2, 0, `rgba(0, 255, 255, ${0.8 * pulse})`, 3); // L Eye to Nose
        drawBodyLine(5, 0, `rgba(0, 255, 255, ${0.8 * pulse})`, 3); // R Eye to Nose
        drawBodyLine(7, 2, `rgba(0, 255, 255, ${0.6 * pulse})`, 2); // L Ear to Eye
        drawBodyLine(8, 5, `rgba(0, 255, 255, ${0.6 * pulse})`, 2); // R Ear to Eye

        // Face geometry bounding
        ctx.beginPath();
        ctx.fillStyle = `rgba(0, 255, 255, ${0.05 * pulse})`;
        ctx.moveTo(poseLm[7]?.x * w, poseLm[7]?.y * h);
        ctx.lineTo(poseLm[8]?.x * w, poseLm[8]?.y * h);
        ctx.lineTo(poseLm[10]?.x * w, poseLm[10]?.y * h);
        ctx.lineTo(poseLm[9]?.x * w, poseLm[9]?.y * h);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(0, 255, 255, ${0.4 * pulse})`;
        ctx.lineWidth = 1 * distScale;
        ctx.stroke();
      }

      // Neck (Connect Face Chin to Pose Shoulders)
      const faceChin = lm[152]; // From FaceLandmarker (High precision)
      const lShoulder = poseLm[11];
      const rShoulder = poseLm[12];

      if (faceChin && lShoulder && rShoulder) {
        const midShoulderX = ((lShoulder.x + rShoulder.x) / 2) * w;
        const midShoulderY = ((lShoulder.y + rShoulder.y) / 2) * h;

        // Draw solid neck connection
        ctx.beginPath();
        ctx.lineWidth = 10 * distScale;
        ctx.strokeStyle = `rgba(0, 150, 255, ${0.5 * pulse})`;
        ctx.lineCap = 'round';
        ctx.moveTo(faceChin.x * w, faceChin.y * h);
        ctx.lineTo(midShoulderX, midShoulderY);
        ctx.stroke();

        // Inner glowing core of neck
        ctx.beginPath();
        ctx.lineWidth = 4 * distScale;
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.8 * pulse})`;
        ctx.moveTo(faceChin.x * w, faceChin.y * h);
        ctx.lineTo(midShoulderX, midShoulderY);
        ctx.stroke();
      }

      // Joints (Larger, brighter)
      const jointR = 10 * pulse;
      [11, 12].forEach(i => drawBodyJoint(i, jointR, blueGlow)); // Shoulders
      [13, 14].forEach(i => drawBodyJoint(i, jointR * 0.9, blueGlow)); // Elbows
      [15, 16].forEach(i => drawBodyJoint(i, jointR * 0.8, blueGlow)); // Wrists
      [17, 18, 19, 20, 21, 22].forEach(i => drawBodyJoint(i, jointR * 0.4, blueGlow)); // Fingers

      [23, 24].forEach(i => drawBodyJoint(i, jointR * 0.9, blueGlow)); // Hips
      [25, 26].forEach(i => drawBodyJoint(i, jointR * 0.8, `rgba(40, 120, 255, ${0.8 * pulse})`)); // Knees
      [27, 28].forEach(i => drawBodyJoint(i, jointR * 0.7, `rgba(40, 120, 255, ${0.7 * pulse})`)); // Ankles
      [29, 30, 31, 32].forEach(i => drawBodyJoint(i, jointR * 0.5, `rgba(40, 120, 255, ${0.6 * pulse})`)); // Heels/Toes
    }

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
          {/* REAL-TIME DISTANCE GAUGE */}
          {/* ═══════════════════════════════════════════ */}
          <div className="w-full max-w-3xl mx-auto mt-1">
            {/* Big Distance Number */}
            <div className="text-center mb-2">
              <span className="text-4xl md:text-5xl font-black tabular-nums leading-none" style={{ color: getDistanceColor() }}>
                {effectiveDistanceM > 0 ? effectiveDistanceM.toFixed(2) : '0.00'}
              </span>
              <span className="text-xl text-slate-400 font-bold ml-1">m</span>
              <span className="block text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                Target: 1.00 m
              </span>
            </div>

            {/* Distance Bar */}
            <div className="relative w-full h-8 md:h-10 rounded-full bg-slate-800/80 border border-slate-700/50 overflow-hidden">
              {/* Green target zone (0.85m - 1.15m on a 0-2m scale) */}
              <div
                className="absolute top-0 h-full bg-emerald-500/20 border-x-2 border-emerald-400/50"
                style={{ left: `${(0.85 / 2) * 100}%`, width: `${((1.15 - 0.85) / 2) * 100}%` }}
              />

              {/* Filled bar up to current distance */}
              <div
                className="absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min((effectiveDistanceM / 2) * 100, 100)}%`,
                  background: `linear-gradient(90deg, ${getDistanceColor()}88, ${getDistanceColor()})`,
                  boxShadow: `0 0 20px ${getDistanceColor()}66`
                }}
              />

              {/* Target line at 1.0m */}
              <div
                className="absolute top-0 h-full w-0.5 bg-white/80"
                style={{ left: `${(1.0 / 2) * 100}%` }}
              />
              <div
                className="absolute -top-6 text-xs font-bold text-white/70"
                style={{ left: `${(1.0 / 2) * 100}%`, transform: 'translateX(-50%)' }}
              >
                1.0m
              </div>

              {/* Current position marker */}
              {effectiveDistanceM > 0 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-5 h-5 md:w-6 md:h-6 rounded-full border-3 border-white shadow-lg transition-all duration-500 ease-out"
                  style={{
                    left: `${Math.min((effectiveDistanceM / 2) * 100, 100)}%`,
                    transform: 'translate(-50%, -50%)',
                    background: getDistanceColor(),
                    boxShadow: `0 0 15px ${getDistanceColor()}`
                  }}
                />
              )}

              {/* Scale labels */}
              <div className="absolute -bottom-5 left-0 text-[10px] text-slate-500 font-bold">0m</div>
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 font-bold">1m</div>
              <div className="absolute -bottom-5 right-0 text-[10px] text-slate-500 font-bold">2m</div>
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
