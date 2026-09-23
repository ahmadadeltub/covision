import React, { useEffect, useRef, RefObject } from 'react';
import { isLowPowerDevice } from '../utils/devicePerformance';

interface FaceMeshCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  landmarksRef?: RefObject<any[] | null>;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  showHud?: boolean;
}

// Canonical MediaPipe FaceMesh triangle tessellation subset (covers full face)
const FACE_TRIANGLES = [
  [10, 338, 297], [10, 297, 332], [10, 332, 284], [10, 284, 251], [10, 251, 389], [10, 389, 356],
  [338, 297, 332], [297, 332, 284], [332, 284, 251], [284, 251, 389], [251, 389, 356],
  [21, 54, 103], [21, 103, 67], [21, 67, 109], [21, 109, 10], [54, 103, 67], [103, 67, 109],
  [162, 21, 54], [162, 54, 103], [162, 103, 71], [71, 103, 68], [68, 103, 104], [104, 103, 69],
  [69, 103, 108], [108, 103, 107], [107, 103, 66], [66, 103, 105], [105, 103, 63], [63, 103, 70],
  [389, 356, 454], [356, 454, 323], [454, 323, 361], [323, 361, 288], [361, 288, 397], [288, 397, 365],
  [397, 365, 379], [365, 379, 378], [379, 378, 400], [378, 400, 377], [400, 377, 152], [377, 152, 148],
  [152, 148, 176], [148, 176, 149], [176, 149, 150], [149, 150, 136], [150, 136, 172], [136, 172, 58],
  [172, 58, 132], [58, 132, 93], [132, 93, 234], [93, 234, 127], [234, 127, 162],
  [33, 7, 163], [7, 163, 144], [163, 144, 145], [144, 145, 153], [145, 153, 154], [153, 154, 155],
  [154, 155, 133], [155, 133, 173], [133, 173, 157], [173, 157, 158], [157, 158, 159], [158, 159, 160],
  [159, 160, 161], [160, 161, 246], [161, 246, 33],
  [263, 249, 390], [249, 390, 373], [390, 373, 374], [373, 374, 380], [374, 380, 381], [380, 381, 382],
  [381, 382, 362], [382, 362, 398], [362, 398, 384], [398, 384, 385], [384, 385, 386], [385, 386, 387],
  [386, 387, 388], [387, 388, 466], [388, 466, 263],
  [1, 2, 97], [2, 97, 326], [97, 326, 98], [98, 326, 327], [97, 98, 99], [99, 98, 60], [60, 98, 218],
  [218, 98, 115], [115, 98, 131], [131, 98, 132], [2, 19, 1], [19, 1, 94], [94, 1, 2],
  [0, 61, 37], [61, 37, 39], [37, 39, 40], [39, 40, 185], [40, 185, 61], [185, 61, 78],
  [267, 269, 270], [269, 270, 409], [270, 409, 291], [409, 291, 375], [291, 375, 321], [375, 321, 405],
  [321, 405, 314], [405, 314, 17], [314, 17, 84], [17, 84, 181], [84, 181, 91], [181, 91, 146],
  [91, 146, 61], [78, 80, 81], [80, 81, 82], [81, 82, 13], [82, 13, 312], [13, 312, 311],
  [312, 311, 310], [311, 310, 415], [310, 415, 308], [415, 308, 324], [308, 324, 318], [324, 318, 402],
  [318, 402, 317], [402, 317, 14], [317, 14, 87], [14, 87, 178], [87, 178, 88], [178, 88, 95],
  [116, 123, 147], [123, 147, 213], [147, 213, 192], [213, 192, 214], [192, 214, 207], [214, 207, 205],
  [207, 205, 187], [205, 187, 143], [187, 143, 111], [143, 111, 117], [111, 117, 118], [117, 118, 50],
  [118, 50, 101], [50, 101, 100], [101, 100, 47], [100, 47, 126], [47, 126, 217], [126, 217, 234],
  [345, 352, 376], [352, 376, 411], [376, 411, 433], [411, 433, 416], [433, 416, 434], [416, 434, 427],
  [434, 427, 425], [427, 425, 411], [425, 411, 349], [411, 349, 348], [349, 348, 329], [348, 329, 277],
  [329, 277, 350], [277, 350, 280], [350, 280, 330], [280, 330, 347], [330, 347, 346], [347, 346, 340],
  [346, 340, 372], [340, 372, 345], [372, 345, 352],
  [226, 247, 30], [247, 30, 29], [30, 29, 27], [29, 27, 28], [27, 28, 56], [28, 56, 190], [56, 190, 243],
  [190, 243, 112], [243, 112, 26], [112, 26, 22], [26, 22, 23], [22, 23, 24], [23, 24, 110], [24, 110, 25],
  [446, 467, 260], [467, 260, 259], [260, 259, 257], [259, 257, 258], [257, 258, 286], [258, 286, 414],
  [286, 414, 463], [414, 463, 341], [463, 341, 256], [341, 256, 252], [256, 252, 253], [252, 253, 254],
  [253, 254, 339], [254, 339, 255],
];

// Precomputed static unique edges — eliminates per-frame Set<string> allocations and deduplication
const FACE_EDGES: [number, number][] = (() => {
  const edgeSet = new Set<string>();
  const list: [number, number][] = [];
  for (const [a, b, c] of FACE_TRIANGLES) {
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

// Complete facial surface landmark matrix indices
const SURFACE_DOT_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 21, 54, 103, 67, 109,
  151, 9, 8, 168, 6, 197, 195, 5,
  71, 68, 104, 69, 108, 107, 66, 105, 63, 70,
  301, 298, 299, 337, 336, 285, 295, 282, 283, 276,
  162, 127, 234, 356, 389, 454, 93, 323,
  116, 123, 147, 213, 192, 214, 207, 205, 187, 143, 111, 117, 118, 50, 101, 100, 47, 126,
  345, 352, 376, 433, 416, 434, 427, 425, 411, 372, 340, 346, 347, 329, 277, 350, 280,
  4, 1, 19, 94, 2, 98, 97, 326, 327, 129, 358, 115, 49, 102, 64, 131, 198,
  360, 344, 279, 294, 331, 420, 419, 122, 196, 197, 168,
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
  375, 321, 405, 314, 17, 84, 181, 91, 146,
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
  132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361,
  46, 53, 52, 65, 55, 276, 283, 295, 285,
  164, 0, 11, 12, 13, 14, 15, 16, 17, 18, 200, 199, 175, 171, 140, 170, 169, 135, 138, 215,
  377, 396, 369, 395, 394, 364, 367, 435, 401, 366, 447,
];

// Contour definitions stored statically to avoid allocating arrays inside 60fps render loop
const CONTOURS = {
  faceOval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10],
  foreheadTop: [21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251],
  foreheadMid: [162, 71, 68, 104, 69, 108, 151, 337, 299, 333, 298, 301, 389],
  foreheadLow: [70, 63, 105, 66, 107, 9, 336, 296, 334, 293, 300],
  foreheadVertMid: [10, 151, 9, 8, 168, 6, 197],
  browRight: [70, 63, 105, 66, 107, 55],
  browLeft: [336, 296, 334, 293, 300, 285],
  orbitRight: [226, 247, 30, 29, 27, 28, 56, 190, 243, 112, 26, 22, 23, 24, 110, 25, 226],
  orbitLeft: [446, 467, 260, 259, 257, 258, 286, 414, 463, 341, 256, 252, 253, 254, 339, 255, 446],
  nasalMidline: [168, 6, 197, 195, 5, 4, 1, 19, 94, 2],
  nasalBridgeHoriz: [189, 221, 55, 193, 168, 417, 285, 441, 413],
  nasalWingR: [60, 218, 219, 220, 79, 166, 59],
  nasalWingL: [290, 438, 439, 440, 309, 391, 289],
  cheekVertR: [143, 111, 117, 118, 100, 47, 50, 205, 187, 147, 150],
  cheekVertL: [372, 340, 346, 347, 329, 277, 280, 425, 411, 376, 379],
  jawContour: [234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234],
  outerLips: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61],
  innerLips: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78],
};

export const FaceMeshCanvas: React.FC<FaceMeshCanvasProps> = ({
  videoRef,
  landmarksRef,
  className = 'absolute inset-0 w-full h-full pointer-events-none',
  style,
  color = '#1c96c5',
  showHud = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId = 0;
    let stopped = false;

    const render = () => {
      if (stopped) return;

      const canvas = canvasRef.current;
      const vid = videoRef.current;

      if (canvas && vid) {
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;

        if (cw > 0 && ch > 0) {
          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
          }

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, cw, ch);

            const lm = landmarksRef?.current || (window as any).__sharedFaceLandmarks;

            if (lm && lm.length >= 468) {
              const time = Date.now() / 1000;
              const pulse = Math.sin(time * 3.2) * 0.15 + 0.85;

              // Exact video coordinate mapping for object-cover centering & crop
              let displayedW = cw;
              let displayedH = ch;
              let offsetX = 0;
              let offsetY = 0;

              if (vid.videoWidth > 0 && vid.videoHeight > 0) {
                const videoAspect = vid.videoWidth / vid.videoHeight;
                const canvasAspect = cw / ch;
                if (canvasAspect > videoAspect) {
                  displayedW = cw;
                  displayedH = cw / videoAspect;
                  offsetX = 0;
                  offsetY = (ch - displayedH) / 2;
                } else {
                  displayedH = ch;
                  displayedW = ch * videoAspect;
                  offsetX = (cw - displayedW) / 2;
                  offsetY = 0;
                }
              }

              const toX = (nx: number) => offsetX + nx * displayedW;
              const toY = (ny: number) => offsetY + ny * displayedH;

              // ── PART A: Mirrored Face Mesh ──
              ctx.save();
              ctx.scale(-1, 1);
              ctx.translate(-cw, 0);

              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';

              // High-speed hardware-friendly contour drawer (zero allocations inside loop)
              const drawContourIndices = (
                indices: number[],
                dotColor: string,
                dotSize: number,
                dotSpacing: number,
                accentColor = color
              ) => {
                const len = indices.length;
                if (len < 2) return;

                // 1. Hardware hairline stroke
                ctx.beginPath();
                ctx.strokeStyle = `rgba(28, 150, 197, ${0.18 * pulse})`;
                ctx.lineWidth = 0.5;
                ctx.setLineDash([]);
                let started = false;
                for (let i = 0; i < len; i++) {
                  const p = lm[indices[i]];
                  if (!p || !isFinite(p.x) || !isFinite(p.y)) continue;
                  const x = toX(p.x), y = toY(p.y);
                  if (!started) { ctx.moveTo(x, y); started = true; }
                  else { ctx.lineTo(x, y); }
                }
                ctx.stroke();

                // 2. High-precision Dotted Line (Dots Line) with luminous #1c96c5
                ctx.beginPath();
                ctx.strokeStyle = dotColor;
                ctx.lineWidth = dotSize;
                ctx.lineCap = 'round';
                ctx.setLineDash([0, dotSpacing]);
                started = false;
                for (let i = 0; i < len; i++) {
                  const p = lm[indices[i]];
                  if (!p || !isFinite(p.x) || !isFinite(p.y)) continue;
                  const x = toX(p.x), y = toY(p.y);
                  if (!started) { ctx.moveTo(x, y); started = true; }
                  else { ctx.lineTo(x, y); }
                }
                ctx.stroke();

                // 3. Luminous micro-nodes at key vertices
                ctx.setLineDash([]);
                ctx.fillStyle = accentColor;
                ctx.beginPath();
                const nodeR = Math.max(0.8, dotSize * 0.55);
                for (let i = 0; i < len; i += 2) {
                  const p = lm[indices[i]];
                  if (!p || !isFinite(p.x) || !isFinite(p.y)) continue;
                  const px = toX(p.x), py = toY(p.y);
                  ctx.moveTo(px + nodeR, py);
                  ctx.arc(px, py, nodeR, 0, Math.PI * 2);
                }
                ctx.fill();
              };

              // Palette (#1c96c5)
              const cLightBlue = `rgba(28, 150, 197, ${0.90 * pulse})`;
              const cCyanLight = color;

              // ── 1. Triangles Tessellation (Single Hardware Pass) ──
              ctx.beginPath();
              ctx.strokeStyle = `rgba(28, 150, 197, ${0.68 * pulse})`;
              ctx.lineWidth = 1.6;
              ctx.setLineDash([0, 4.5]);
              for (let i = 0; i < FACE_EDGES.length; i++) {
                const [i1, i2] = FACE_EDGES[i];
                const p1 = lm[i1], p2 = lm[i2];
                if (!p1 || !p2) continue;
                ctx.moveTo(toX(p1.x), toY(p1.y));
                ctx.lineTo(toX(p2.x), toY(p2.y));
              }
              ctx.stroke();

              // ── 2. Facial Contours ──
              drawContourIndices(CONTOURS.faceOval, cCyanLight, 2.2, 5);
              drawContourIndices(CONTOURS.foreheadTop, cCyanLight, 1.9, 5);
              drawContourIndices(CONTOURS.foreheadMid, cLightBlue, 1.8, 5);
              drawContourIndices(CONTOURS.foreheadLow, cCyanLight, 1.8, 5);
              drawContourIndices(CONTOURS.foreheadVertMid, cCyanLight, 1.9, 5);
              drawContourIndices(CONTOURS.browRight, cCyanLight, 2.0, 4.5);
              drawContourIndices(CONTOURS.browLeft, cCyanLight, 2.0, 4.5);
              drawContourIndices(CONTOURS.orbitRight, cLightBlue, 1.7, 5);
              drawContourIndices(CONTOURS.orbitLeft, cLightBlue, 1.7, 5);
              drawContourIndices(CONTOURS.nasalMidline, cCyanLight, 2.1, 4.5);
              drawContourIndices(CONTOURS.nasalBridgeHoriz, cLightBlue, 1.7, 5);
              drawContourIndices(CONTOURS.nasalWingR, cLightBlue, 1.7, 5);
              drawContourIndices(CONTOURS.nasalWingL, cLightBlue, 1.7, 5);
              drawContourIndices(CONTOURS.cheekVertR, cLightBlue, 1.7, 5);
              drawContourIndices(CONTOURS.cheekVertL, cLightBlue, 1.7, 5);
              drawContourIndices(CONTOURS.jawContour, cLightBlue, 2.0, 5.5);
              drawContourIndices(CONTOURS.outerLips, cCyanLight, 2.0, 4.5);
              drawContourIndices(CONTOURS.innerLips, cLightBlue, 1.6, 5);

              // ── 3. High-Density Facial Landmark Dot Matrix ──
              ctx.setLineDash([]);
              ctx.fillStyle = cCyanLight;
              ctx.beginPath();
              const dotR = 1.5;
              for (let i = 0; i < SURFACE_DOT_INDICES.length; i++) {
                const p = lm[SURFACE_DOT_INDICES[i]];
                if (p && isFinite(p.x) && isFinite(p.y)) {
                  const px = toX(p.x);
                  const py = toY(p.y);
                  ctx.moveTo(px + dotR, py);
                  ctx.arc(px, py, dotR, 0, Math.PI * 2);
                }
              }
              ctx.fill();

              // ── 4. Radiant Iris Beacons (2 points only, lightweight glow) ──
              const drawRadiantEye = (centerIdx: number) => {
                const p = lm[centerIdx];
                if (!p) return;
                const cx = toX(p.x);
                const cy = toY(p.y);

                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, 9, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(28, 150, 197, ${0.85 * pulse})`;
                ctx.lineWidth = 1.2;
                if (!isLowPowerDevice) {
                  ctx.shadowBlur = 6;
                  ctx.shadowColor = color;
                }
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
                ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
                ctx.strokeStyle = `rgba(28, 150, 197, 0.85)`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.restore();
              };
              drawRadiantEye(468);
              drawRadiantEye(473);

              ctx.restore(); // Restore mirrored space

              // ── PART B: Unmirrored HUD Corners ──
              if (showHud) {
                let minX = 1, maxX = 0, minY = 1, maxY = 0;
                for (let i = 0; i < lm.length; i += 12) {
                  const p = lm[i];
                  if (p.x < minX) minX = p.x;
                  if (p.x > maxX) maxX = p.x;
                  if (p.y < minY) minY = p.y;
                  if (p.y > maxY) maxY = p.y;
                }

                const boxLeft = Math.max(4, (cw - toX(maxX)) - 8);
                const boxRight = Math.min(cw - 4, (cw - toX(minX)) + 8);
                const boxTop = Math.max(4, toY(minY) - 8);
                const boxBottom = Math.min(ch - 4, toY(maxY) + 8);
                const bLen = Math.min(14, (boxRight - boxLeft) * 0.25);

                ctx.save();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(boxLeft, boxTop + bLen); ctx.lineTo(boxLeft, boxTop); ctx.lineTo(boxLeft + bLen, boxTop);
                ctx.moveTo(boxRight - bLen, boxTop); ctx.lineTo(boxRight, boxTop); ctx.lineTo(boxRight, boxTop + bLen);
                ctx.moveTo(boxLeft, boxBottom - bLen); ctx.lineTo(boxLeft, boxBottom); ctx.lineTo(boxLeft + bLen, boxBottom);
                ctx.moveTo(boxRight - bLen, boxBottom); ctx.lineTo(boxRight, boxBottom); ctx.lineTo(boxRight, boxBottom - bLen);
                ctx.stroke();
                ctx.restore();
              }
            }
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      stopped = true;
      if (animId) cancelAnimationFrame(animId);
    };
  }, [videoRef, landmarksRef, color, showHud]);

  return <canvas ref={canvasRef} className={className} style={style} />;
};

export default FaceMeshCanvas;
