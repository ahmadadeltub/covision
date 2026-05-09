
import { useState, useRef, useCallback, useEffect, RefObject } from 'react';

export type EyeCoverStatus = 'right_covered' | 'left_covered' | 'both_covered' | 'none_covered' | 'no_detection';

interface UseEyeCoverDetectionOptions {
  /** Which phase we're testing: 'testing-right' | 'testing-left' etc. */
  phase: string;
  /** Is the test actively running? */
  isTesting: boolean;
  /** Camera video ref for reading frames */
  cameraRef: RefObject<HTMLVideoElement | null>;
  /** Optional canvas ref for drawing detection overlay */
  coverCanvasRef?: RefObject<HTMLCanvasElement | null>;
  /** External stream — used to trigger frame-send loop */
  stream?: MediaStream | null;
}

interface UseEyeCoverDetectionReturn {
  isEyeUncovered: boolean;
  eyeCoverStatus: EyeCoverStatus;
  coverConfidence: number;
}

/**
 * Eye cover detection using Eye Aspect Ratio (EAR) from FaceLandmarker.
 * 
 * Reads face landmarks from the shared FaceLandmarker (via useFaceDistance)
 * stored on window.__faceLandmarksRef. Uses EAR to detect if an eye is
 * closed/covered. No Holistic dependency.
 * 
 * ── DISABLED ── Set to false to re-enable eye cover enforcement.
 */
const EYE_COVER_DISABLED = false;

export function useEyeCoverDetection({
  phase,
  isTesting,
  cameraRef,
  coverCanvasRef,
  stream,
}: UseEyeCoverDetectionOptions): UseEyeCoverDetectionReturn {
  // ── Short-circuit: when disabled, never report eye as uncovered ──
  if (EYE_COVER_DISABLED) {
    return { isEyeUncovered: false, eyeCoverStatus: 'no_detection', coverConfidence: 0 };
  }
  const [eyeCoverStatus, setEyeCoverStatus] = useState<EyeCoverStatus>('no_detection');
  const [isEyeUncovered, setIsEyeUncovered] = useState(false);
  const [coverConfidence, setCoverConfidence] = useState(0);
  const coverHistoryRef = useRef<EyeCoverStatus[]>([]);
  const testingStartTimeRef = useRef<number>(0);

  // ─── Update cover status with history smoothing ───
  const updateCoverStatus = useCallback((status: EyeCoverStatus) => {
    const history = coverHistoryRef.current;
    history.push(status);
    if (history.length > 12) history.shift();
    const counts: Record<string, number> = {};
    history.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    let maxCount = 0, dominant: EyeCoverStatus = 'no_detection';
    for (const [s, c] of Object.entries(counts)) {
      if (c > maxCount) { maxCount = c; dominant = s as EyeCoverStatus; }
    }
    setEyeCoverStatus(dominant);
    setCoverConfidence(Math.round((maxCount / history.length) * 100));
  }, []);

  // ─── EAR-based detection using shared FaceLandmarker landmarks ───
  useEffect(() => {
    if (!isTesting) {
      coverHistoryRef.current = [];
      return;
    }

    let stopped = false;

    const getEAR = (faceLm: any[], indices: { top: number[]; bottom: number[]; left: number; right: number }) => {
      const topY = indices.top.reduce((s, i) => s + faceLm[i].y, 0) / indices.top.length;
      const bottomY = indices.bottom.reduce((s, i) => s + faceLm[i].y, 0) / indices.bottom.length;
      const leftX = faceLm[indices.left].x;
      const rightX = faceLm[indices.right].x;
      const vertical = Math.abs(topY - bottomY);
      const horizontal = Math.abs(leftX - rightX);
      return horizontal > 0 ? vertical / horizontal : 0;
    };

    const detect = () => {
      if (stopped) return;

      // Read face landmarks from the shared FaceLandmarker (set by useFaceDistance)
      const faceLm = (window as any).__sharedFaceLandmarks;
      if (!faceLm || faceLm.length < 468) {
        updateCoverStatus('no_detection');
        setTimeout(detect, 200);
        return;
      }

      // Compute EAR for both eyes
      const rightEAR = getEAR(faceLm, { top: [159, 158, 160], bottom: [145, 144, 153], left: 33, right: 133 });
      const leftEAR = getEAR(faceLm, { top: [386, 385, 387], bottom: [374, 373, 380], left: 263, right: 362 });

      // EAR < 0.16 typically means the eye is closed or covered
      const EAR_THRESHOLD = 0.16;
      const rightClosed = rightEAR < EAR_THRESHOLD;
      const leftClosed = leftEAR < EAR_THRESHOLD;

      let status: EyeCoverStatus;
      if (rightClosed && leftClosed) status = 'both_covered';
      else if (rightClosed) status = 'right_covered';
      else if (leftClosed) status = 'left_covered';
      else status = 'none_covered';

      updateCoverStatus(status);

      // Draw simple overlay on canvas
      const canvas = coverCanvasRef?.current;
      const vid = cameraRef.current;
      if (canvas && vid) {
        const rect = vid.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width; canvas.height = rect.height;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save(); ctx.scale(-1, 1); ctx.translate(-canvas.width, 0);
          const drawZone = (center: { x: number; y: number }, covered: boolean, label: string) => {
            const cx = center.x * canvas.width, cy = center.y * canvas.height, r = 22;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = covered ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.85)';
            ctx.lineWidth = 3; ctx.shadowBlur = covered ? 15 : 8;
            ctx.shadowColor = covered ? '#10b981' : '#ef4444'; ctx.stroke();
            if (covered) { ctx.fillStyle = 'rgba(16, 185, 129, 0.15)'; ctx.fill(); }
            ctx.shadowBlur = 0; ctx.font = 'bold 9px Inter, sans-serif';
            ctx.fillStyle = covered ? '#10b981' : '#ef4444'; ctx.textAlign = 'center';
            ctx.fillText(covered ? `✅ ${label}` : `❌ ${label}`, cx, cy - r - 6);
          };
          const rightEyeCenter = {
            x: (faceLm[33].x + faceLm[133].x) / 2,
            y: (faceLm[159].y + faceLm[145].y) / 2,
          };
          const leftEyeCenter = {
            x: (faceLm[263].x + faceLm[362].x) / 2,
            y: (faceLm[386].y + faceLm[374].y) / 2,
          };

          // Draw Eye Mesh (dots)
          ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
          const drawDots = (indices: number[]) => {
            indices.forEach(idx => {
              if (faceLm[idx]) {
                ctx.beginPath();
                ctx.arc(faceLm[idx].x * canvas.width, faceLm[idx].y * canvas.height, 1.5, 0, Math.PI * 2);
                ctx.fill();
              }
            });
          };
          drawDots([33, 159, 158, 160, 133, 145, 144, 153]); // Right Eye
          drawDots([263, 386, 385, 387, 362, 374, 373, 380]); // Left Eye
          // Draw Face Oval (some points)
          drawDots([10, 152, 234, 454]); 

          // Draw Hand Landmarks if available
          const hands = (window as any).__sharedHandLandmarks;
          const handednesses = (window as any).__sharedHandednesses;
          if (hands && hands.length > 0) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
            ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
            const connections = [
              [0,1],[1,2],[2,3],[3,4], // Thumb
              [0,5],[5,6],[6,7],[7,8], // Index
              [5,9],[9,10],[10,11],[11,12], // Middle
              [9,13],[13,14],[14,15],[15,16], // Ring
              [13,17],[17,18],[18,19],[19,20], // Pinky
              [0,17] // Base
            ];
            hands.forEach((hand: any[], idx: number) => {
              // Draw lines
              ctx.beginPath();
              connections.forEach(([start, end]) => {
                const s = hand[start], e = hand[end];
                if (s && e) {
                  ctx.moveTo(s.x * canvas.width, s.y * canvas.height);
                  ctx.lineTo(e.x * canvas.width, e.y * canvas.height);
                }
              });
              ctx.stroke();
              // Draw joints
              hand.forEach((joint: any) => {
                ctx.beginPath();
                ctx.arc(joint.x * canvas.width, joint.y * canvas.height, 3, 0, Math.PI * 2);
                ctx.fill();
              });

              // Draw Left/Right label at wrist (joint 0)
              if (handednesses && handednesses[idx] && handednesses[idx].length > 0) {
                 const label = handednesses[idx][0].categoryName;
                 const score = Math.round(handednesses[idx][0].score * 100);
                 const wrist = hand[0];
                 ctx.save();
                 ctx.translate(wrist.x * canvas.width, wrist.y * canvas.height);
                 // Need to scale back x because canvas is mirrored (-1) so text isn't backwards
                 ctx.scale(-1, 1);
                 ctx.font = 'bold 14px Inter, sans-serif';
                 ctx.fillStyle = '#10b981';
                 ctx.shadowBlur = 4;
                 ctx.shadowColor = '#000';
                 ctx.textAlign = 'center';
                 ctx.fillText(`${label} Hand (${score}%)`, 0, 20);
                 ctx.restore();
              }
            });
          }

          drawZone(rightEyeCenter, rightClosed, 'R');
          drawZone(leftEyeCenter, leftClosed, 'L');
          ctx.restore();
        }
      }

      setTimeout(detect, 200); // ~5fps polling
    };

    detect();
    return () => { stopped = true; };
  }, [isTesting, updateCoverStatus, cameraRef, coverCanvasRef]);

  // ─── Check eye cover compliance ───
  useEffect(() => {
    if (!isTesting) {
      setIsEyeUncovered(false);
      testingStartTimeRef.current = 0;
      coverHistoryRef.current = [];
      return;
    }
    if (testingStartTimeRef.current === 0) {
      testingStartTimeRef.current = Date.now();
    }
    // Grace period: don't enforce for first 8 seconds
    const elapsed = Date.now() - testingStartTimeRef.current;
    if (elapsed < 8000) {
      setIsEyeUncovered(false);
      return;
    }
    if (phase === 'testing-right') {
      const ok = eyeCoverStatus === 'left_covered' || eyeCoverStatus === 'both_covered' || eyeCoverStatus === 'no_detection';
      setIsEyeUncovered(!ok && coverConfidence > 80);
    } else {
      const ok = eyeCoverStatus === 'right_covered' || eyeCoverStatus === 'both_covered' || eyeCoverStatus === 'no_detection';
      setIsEyeUncovered(!ok && coverConfidence > 80);
    }
  }, [eyeCoverStatus, phase, coverConfidence, isTesting]);

  return { isEyeUncovered, eyeCoverStatus, coverConfidence };
}
