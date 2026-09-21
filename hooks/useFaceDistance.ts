
import { useState, useRef, useCallback, useEffect, RefObject } from 'react';
import { DistanceStatus, DistanceReading } from '../types';

interface FaceDistanceReturn {
    videoRef: RefObject<HTMLVideoElement | null>;
    faceLandmarksRef: RefObject<any[] | null>;
    poseLandmarksRef: RefObject<any[] | null>;
    handLandmarksRef: RefObject<any[] | null>;
    status: DistanceStatus;
    distanceM: number;
    isStable: boolean;
    complianceLog: DistanceReading[];
    debugInfo: {
        faceMeshActive: boolean;
        faceDetectionActive: boolean;
        fps: number;
        method: 'facemesh' | 'detection' | 'pixels' | 'none';
        rawDistance: number;
    };
    startCamera: () => void;
    stopCamera: () => void;
    setDebugMode: (enabled: boolean) => void;
    debugMode: boolean;
}

interface FaceDistanceOptions {
    pxPerMm?: number;
    ipdMm?: number;
    targetDistanceM?: number;
    toleranceM?: number;
    stream?: MediaStream | null;
}

const IPD_DEFAULT_MM = 63.0;          // Anatomical Interpupillary Distance (iris 468 ↔ 473)
const IRIS_DIAMETER_MM = 11.7;        // Horizontal Visible Iris Diameter (HVID) anatomical standard
const OUTER_CANTHAL_WIDTH_MM = 90.0;  // outer eye corner to outer eye corner (33 ↔ 263)
const INNER_CANTHAL_WIDTH_MM = 32.0;  // inner eye corner to inner eye corner (133 ↔ 362)
const FACE_WIDTH_MM = 140.0;          // cheekbone to cheekbone (234 ↔ 454)
const DEFAULT_FACE_WIDTH_MM = 140.0;
const FOREHEAD_WIDTH_MM = 110.0;      // forehead width (10 ↔ 338)
const NOSE_TO_CHIN_MM = 115.0;        // nose tip to chin (1 ↔ 199)
const SMOOTHING_BUFFER = 15;
const WARMUP_FRAMES = 1;              // Instant: show mesh on very first detected frame
const STATE_UPDATE_INTERVAL = 16;     // 60fps React state updates
const NO_FACE_TIMEOUT = 4000;         // ms before declaring no face
const GRACE_HOLD_MS = 600;            // Reduced: reset faster so new detection locks on quickly

// Modern MediaPipe Tasks Vision CDN
const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18';
// Valid official model asset path (200 OK verified)
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export function useFaceDistance(options?: FaceDistanceOptions): FaceDistanceReturn {
    const {
        pxPerMm = 4.0,
        ipdMm = 63,
        targetDistanceM = 1.0,
        toleranceM = 0.15,
        stream: externalStream
    } = options || {};

    const targetRef = useRef(targetDistanceM);
    const toleranceRef = useRef(toleranceM);

    useEffect(() => {
        targetRef.current = targetDistanceM;
        toleranceRef.current = toleranceM;
    }, [targetDistanceM, toleranceM]);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const detectionVideoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animFrameRef = useRef<number>(0);

    // State — updated at throttled intervals only
    const [status, setStatus] = useState<DistanceStatus>('no_face');
    const [distanceM, setDistanceM] = useState(0);
    const [isStable, setIsStable] = useState(false);
    const [debugMode, setDebugMode] = useState(false);

    // Refs for intermediate values (updated every frame, no re-renders)
    const currentDistanceRef = useRef(0);
    const currentStatusRef = useRef<DistanceStatus>('no_face');
    const currentStableRef = useRef(false);
    const lastStateUpdateRef = useRef(0);

    // ML model refs (FaceLandmarker ONLY — maximum speed and zero GPU contention)
    const faceLandmarkerRef = useRef<any>(null);
    const faceDetectorRef = useRef<any>(null);
    const frameCountRef = useRef(0);
    const warmupCountRef = useRef(0);
    const lastFpsTimeRef = useRef(0);
    const fpsRef = useRef(0);
    const debugInfoRef = useRef<any>({
        faceMeshActive: false, faceDetectionActive: false,
        method: 'none', rawDistance: 0, fps: 0,
        faceMeshStatus: 'loading', sendCount: 0, resultCount: 0,
    });
    const lastUpdateRef = useRef<number>(0);
    const sendCountRef = useRef(0);
    const resultCountRef = useRef(0);

    const distanceBufferRef = useRef<number[]>([]);
    const emaRef = useRef<number>(0); // exponential moving average
    const lastFilterTimeRef = useRef<number>(performance.now());
    const distanceHistoryRef = useRef<Array<{ time: number; dist: number }>>([]);
    const filterXhatRef = useRef<number>(0); // 1€ filter smoothed position
    const filterDhatRef = useRef<number>(0); // 1€ filter smoothed derivative
    const pendingStatusRef = useRef<DistanceStatus>('no_face');
    const lastValidDistanceRef = useRef(0); // last good reading for grace period
    const lastValidTimeRef = useRef(0); // when last good reading was
    const complianceLogRef = useRef<DistanceReading[]>([]);
    const inRangeSinceRef = useRef<number | null>(null);
    const faceLandmarksRef = useRef<any[] | null>(null);
    const smoothedFaceLandmarksRef = useRef<any[] | null>(null);
    const poseLandmarksRef = useRef<any[] | null>(null);
    const handLandmarksRef = useRef<any[] | null>(null);
    // First N frames after detection starts → use alpha=1.0 (instant snap, no filter lag)
    const snapFramesRef = useRef(0);

    // ─── Throttled state flush — pushes ref values to React state at max ~10fps ───
    const flushStateToReact = useCallback(() => {
        const now = Date.now();
        if (now - lastStateUpdateRef.current < STATE_UPDATE_INTERVAL) return;
        lastStateUpdateRef.current = now;

        const d = currentDistanceRef.current;
        const s = currentStatusRef.current;
        const st = currentStableRef.current;

        setDistanceM(prev => Math.abs(prev - d) > 0.005 ? d : prev);
        setStatus(prev => prev !== s ? s : prev);
        setIsStable(prev => prev !== st ? st : prev);
    }, []);

    // ─── Initialize FaceLandmarker + PoseLandmarker (modern MediaPipe Tasks Vision) ───
    useEffect(() => {
        let active = true;

        // Chrome FaceDetector fallback
        if ('FaceDetector' in window) {
            try {
                faceDetectorRef.current = new (window as any).FaceDetector({
                    maxDetectedFaces: 1,
                    fastMode: true,
                });
            } catch (e) {
                console.warn("FaceDetector failed init", e);
            }
        }

        const initModels = async () => {
            debugInfoRef.current.faceMeshStatus = 'loading_module';
            console.log('useFaceDistance: Loading MediaPipe Tasks Vision module...');
            try {
                const vision = await import(
                    /* @vite-ignore */
                    `${VISION_CDN}/vision_bundle.mjs`
                );
                if (!active) return;

                const { FaceLandmarker, FilesetResolver } = vision;

                debugInfoRef.current.faceMeshStatus = 'loading_wasm';
                const wasmFileset = await FilesetResolver.forVisionTasks(
                    `${VISION_CDN}/wasm`
                );
                if (!active) return;

                // Init FaceLandmarker (GPU first, automatic CPU fallback if unsupported/WebGL issue)
                debugInfoRef.current.faceMeshStatus = 'creating_landmarker';
                console.log('useFaceDistance: Creating FaceLandmarker...');
                let faceLandmarker: any = null;
                try {
                    faceLandmarker = await FaceLandmarker.createFromOptions(wasmFileset, {
                        baseOptions: {
                            modelAssetPath: FACE_MODEL_URL,
                            delegate: 'GPU',
                        },
                        outputFaceBlendshapes: false,
                        runningMode: 'VIDEO',
                        numFaces: 1,
                        minFaceDetectionConfidence: 0.15,
                        minFacePresenceConfidence: 0.15,
                        minTrackingConfidence: 0.15,
                    });
                } catch (gpuErr) {
                    console.warn('FaceLandmarker GPU delegate failed, falling back to CPU:', gpuErr);
                    faceLandmarker = await FaceLandmarker.createFromOptions(wasmFileset, {
                        baseOptions: {
                            modelAssetPath: FACE_MODEL_URL,
                            delegate: 'CPU',
                        },
                        outputFaceBlendshapes: false,
                        runningMode: 'VIDEO',
                        numFaces: 1,
                        minFaceDetectionConfidence: 0.15,
                        minFacePresenceConfidence: 0.15,
                        minTrackingConfidence: 0.15,
                    });
                }
                if (!active) return;
                faceLandmarkerRef.current = faceLandmarker;
                debugInfoRef.current.faceMeshStatus = 'ready';
                debugInfoRef.current.faceMeshActive = true;
                console.log('useFaceDistance: ✅ FaceLandmarker ready (dedicated face-only pipeline)');
            } catch (error) {
                console.error('useFaceDistance: Model init failed', error);
                debugInfoRef.current.faceMeshStatus = 'error: ' + (error as any)?.message;
            }
        };

        initModels();

        return () => {
            active = false;
            if (faceLandmarkerRef.current) {
                try { faceLandmarkerRef.current.close(); } catch (e) { }
                faceLandmarkerRef.current = null;
            }
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            if (detectionVideoRef.current) {
                detectionVideoRef.current.pause();
                detectionVideoRef.current.srcObject = null;
                detectionVideoRef.current.remove();
                detectionVideoRef.current = null;
            }
        };
    }, []);

    // ─── Handle external stream ───
    useEffect(() => {
        if (!externalStream) return;
        let cancelled = false;

        if (!detectionVideoRef.current) {
            const vid = document.createElement('video');
            vid.muted = true;
            vid.playsInline = true;
            vid.autoplay = true;
            // Offscreen with real dimensions: prevents browser throttling/dropping frames on 1px elements
            vid.style.position = 'fixed';
            vid.style.left = '-9999px';
            vid.style.top = '-9999px';
            vid.style.width = '640px';
            vid.style.height = '480px';
            vid.style.opacity = '1';
            vid.style.pointerEvents = 'none';
            vid.style.zIndex = '-9999';
            document.body.appendChild(vid);
            detectionVideoRef.current = vid;
        }

        const vid = detectionVideoRef.current;
        vid.srcObject = externalStream;

        const ensurePlaying = async () => {
            if (cancelled) return;
            try {
                await vid.play();
            } catch (e) {
                if (!cancelled) setTimeout(ensurePlaying, 100);
                return;
            }
            const waitForData = () => {
                if (cancelled) return;
                if (vid.readyState >= 2 && vid.videoWidth > 0) {
                    console.log('useFaceDistance: detection video ready', vid.videoWidth, 'x', vid.videoHeight);
                    startDetectionLoop();
                } else {
                    setTimeout(waitForData, 30); // Poll at 30ms for near-instant start
                }
            };
            waitForData();
        };
        ensurePlaying();

        if (videoRef.current) {
            videoRef.current.srcObject = externalStream;
            videoRef.current.play().catch(() => { });
        }

        return () => { cancelled = true; };
    }, [externalStream]);

    // ─── Pinhole Camera Focal Length Calibration (~68° HFOV) ───
    const getFocalLength = (w: number, h: number): number => {
        const isPortrait = h > w;
        const baseDim = isPortrait ? h : w;
        return baseDim * 0.7413;
    };

    // ─── 3D Head Pose (Yaw, Pitch, Roll) Trigonometric Compensation ───
    const calculateHeadAngles = (landmarks: any[], vidW: number, vidH: number) => {
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const noseTip = landmarks[1];
        const chin = landmarks[152] || landmarks[199];
        const forehead = landmarks[10];

        if (!leftEye || !rightEye || !noseTip) {
            return { yawCos: 1.0, pitchCos: 1.0, yawDeg: 0, pitchDeg: 0, rollDeg: 0 };
        }

        // 1. Roll angle (ear tilt toward shoulder)
        const dEyeX = (rightEye.x - leftEye.x) * vidW;
        const dEyeY = (rightEye.y - leftEye.y) * vidH;
        const rollRad = Math.atan2(dEyeY, dEyeX);
        const rollDeg = (rollRad * 180) / Math.PI;

        // 2. True inter-ocular 2D Euclidean distance (invariant to head roll tilt)
        const eyeDistPx = Math.hypot(dEyeX, dEyeY);
        const halfEyeDist = eyeDistPx / (2 * vidW);

        // Midpoint of eyes
        const midEyeX = (leftEye.x + rightEye.x) / 2;
        const midEyeY = (leftEye.y + rightEye.y) / 2;

        // Rotate nose displacement into head frame (decouples roll from yaw)
        const dNoseX = (noseTip.x - midEyeX);
        const dNoseY = (noseTip.y - midEyeY) * (vidH / vidW);
        const cosRoll = Math.cos(-rollRad);
        const sinRoll = Math.sin(-rollRad);
        const rotNoseX = dNoseX * cosRoll - dNoseY * sinRoll;

        // Yaw angle (head turn left/right)
        const yawOffset = halfEyeDist > 0.001 ? rotNoseX / halfEyeDist : 0;
        const clampedYaw = Math.max(-0.65, Math.min(0.65, yawOffset));
        const yawRad = Math.asin(clampedYaw);
        const yawDeg = (yawRad * 180) / Math.PI;
        const yawCos = Math.max(0.70, Math.cos(yawRad));

        // 3. Pitch angle (head tilt up/down)
        let pitchRad = 0;
        let pitchDeg = 0;
        let pitchCos = 1.0;
        if (forehead && chin) {
            const faceHeight = Math.abs(chin.y - forehead.y);
            if (faceHeight > 0.01) {
                const expectedNoseY = midEyeY + 0.35 * faceHeight;
                const pitchOffset = ((noseTip.y - expectedNoseY) / faceHeight) * 2.2;
                const clampedPitch = Math.max(-0.55, Math.min(0.55, pitchOffset));
                pitchRad = Math.asin(clampedPitch);
                pitchDeg = (pitchRad * 180) / Math.PI;
                pitchCos = Math.max(0.75, Math.cos(pitchRad));
            }
        }

        return { yawCos, pitchCos, yawDeg, pitchDeg, rollDeg };
    };

    // Helper for 1€ filter smoothing coefficient
    const calcOneEuroAlpha = (rate: number, cutoff: number) => {
        const tau = 1.0 / (2 * Math.PI * cutoff);
        const te = 1.0 / rate;
        return 1.0 / (1.0 + tau / te);
    };

    // ─── 1€ Filter (One Euro Filter) — State-of-the-Art Speed-Adaptive Low-Pass Filter ───
    const smoothDistance = (newDist: number) => {
        const now = performance.now();
        const dt = Math.max(0.008, Math.min(0.1, (now - lastFilterTimeRef.current) / 1000));
        lastFilterTimeRef.current = now;
        const rate = 1.0 / dt;

        if (filterXhatRef.current === 0) {
            filterXhatRef.current = newDist;
            filterDhatRef.current = 0;
            emaRef.current = newDist;
            return newDist;
        }

        const prevX = filterXhatRef.current;
        const delta = Math.abs(newDist - prevX);

        // Stationary deadband (2mm): prevents micro-pixel noise from toggling millimeters
        if (delta < 0.002 && Math.abs(filterDhatRef.current) < 0.025) {
            return prevX;
        }

        // 1. Filter derivative (instant velocity in m/s)
        const rawDx = (newDist - prevX) / dt;
        const aD = calcOneEuroAlpha(rate, 1.2); // derivative cutoff = 1.2 Hz
        const dHat = aD * rawDx + (1 - aD) * filterDhatRef.current;
        filterDhatRef.current = dHat;

        // 2. Dynamic cutoff frequency: minCutoff = 0.55 Hz, beta = 0.95
        const cutoff = 0.55 + 0.95 * Math.abs(dHat);

        // 3. Filter position
        const a = calcOneEuroAlpha(rate, cutoff);
        const xHat = a * newDist + (1 - a) * prevX;
        filterXhatRef.current = xHat;
        emaRef.current = xHat;
        return xHat;
    };

    // ─── Adaptive Temporal Landmark Smoothing (Rock-Solid Stability) ───
    const smoothFaceLandmarks = (raw: any[]): any[] => {
        const prev = smoothedFaceLandmarksRef.current;
        if (!prev || prev.length !== raw.length) {
            // First detection (or face re-acquired after loss): snap instantly with zero lag
            const initial = raw.map(p => ({ ...p }));
            smoothedFaceLandmarksRef.current = initial;
            snapFramesRef.current = 5; // burn next 5 frames at alpha=1.0
            return initial;
        }

        // For the first N frames after initial lock-on, bypass filter entirely (instant snap)
        if (snapFramesRef.current > 0) {
            snapFramesRef.current--;
            const instant = raw.map(p => ({ ...p }));
            smoothedFaceLandmarksRef.current = instant;
            return instant;
        }

        // Measure head movement velocity using landmark 1 (nose tip)
        const nose = raw[1];
        const prevNose = prev[1];
        let movement = 0;
        if (nose && prevNose) {
            const dx = nose.x - prevNose.x;
            const dy = nose.y - prevNose.y;
            movement = Math.hypot(dx, dy);
        }

        // Adaptive alpha:
        // When stationary (movement < 0.002), alpha is 0.26 for rock-solid stability and zero jitter.
        // When moving quickly (movement > 0.02), alpha ramps to 0.88 for instantaneous response with zero lag.
        const alpha = Math.min(0.88, Math.max(0.26, 0.26 + movement * 25));

        const smoothed = raw.map((curr, idx) => {
            const p = prev[idx];
            if (!p) return { ...curr };
            return {
                x: p.x + (curr.x - p.x) * alpha,
                y: p.y + (curr.y - p.y) * alpha,
                z: p.z !== undefined && p.z !== null ? p.z + ((curr.z ?? 0) - p.z) * alpha : curr.z,
                visibility: curr.visibility
            };
        });

        smoothedFaceLandmarksRef.current = smoothed;
        return smoothed;
    };

    // ─── Process face landmarks ───
    const firstResultLoggedRef = useRef(false);

    const processLandmarks = (rawLandmarks: any[], video: HTMLVideoElement) => {
        // Apply temporal jitter suppression
        const landmarks = smoothFaceLandmarks(rawLandmarks);

        resultCountRef.current++;
        debugInfoRef.current.resultCount = resultCountRef.current;

        if (!firstResultLoggedRef.current) {
            console.log('useFaceDistance: ✅ first FaceLandmarker result, landmarks:', landmarks.length);
            firstResultLoggedRef.current = true;
        }

        faceLandmarksRef.current = landmarks;
        // Share with useEyeCoverDetection (no separate ML model needed)
        (window as any).__sharedFaceLandmarks = landmarks;

        const vidW = video.videoWidth || 640;
        const vidH = video.videoHeight || 480;

        const focalLength = getFocalLength(vidW, vidH);
        const { yawCos, pitchCos, yawDeg, pitchDeg, rollDeg } = calculateHeadAngles(landmarks, vidW, vidH);

        // Share telemetry with UI components (BiometricScan HUD, etc.)
        (window as any).__covisionTelemetry = {
            yawDeg: Math.round(yawDeg * 10) / 10,
            pitchDeg: Math.round(pitchDeg * 10) / 10,
            rollDeg: Math.round(rollDeg * 10) / 10,
            focalLength: Math.round(focalLength),
            nodesCount: landmarks.length,
            trackingLocked: true
        };

        const userIpdMm = ipdMm || IPD_DEFAULT_MM;
        const measurements: Array<{ distMm: number; weight: number; name: string }> = [];

        // ── Method 1: True Iris Interpupillary Distance (landmarks 468 ↔ 473) — Optometric Gold Standard ──
        const rightIris = landmarks[468];
        const leftIris = landmarks[473];
        if (rightIris && leftIris) {
            const dx = (leftIris.x - rightIris.x) * vidW;
            const dy = (leftIris.y - rightIris.y) * vidH;
            const rawPx = Math.sqrt(dx * dx + dy * dy);
            const compPx = rawPx / yawCos;
            if (compPx > 4) {
                measurements.push({
                    distMm: (focalLength * userIpdMm) / compPx,
                    weight: 1.7,
                    name: 'iris_ipd'
                });
            }
        }

        // ── Method 1b: Right Iris Horizontal Diameter HVID (469 ↔ 471, 11.7mm) ──
        const rIrisR = landmarks[469];
        const rIrisL = landmarks[471];
        if (rIrisR && rIrisL) {
            const dx = (rIrisL.x - rIrisR.x) * vidW;
            const dy = (rIrisL.y - rIrisR.y) * vidH;
            const rawPx = Math.sqrt(dx * dx + dy * dy);
            const compPx = rawPx / yawCos;
            if (compPx > 2) {
                measurements.push({
                    distMm: (focalLength * IRIS_DIAMETER_MM) / compPx,
                    weight: 1.3,
                    name: 'right_iris_hvid'
                });
            }
        }

        // ── Method 1c: Left Iris Horizontal Diameter HVID (474 ↔ 476, 11.7mm) ──
        const lIrisR = landmarks[474];
        const lIrisL = landmarks[476];
        if (lIrisR && lIrisL) {
            const dx = (lIrisL.x - lIrisR.x) * vidW;
            const dy = (lIrisL.y - lIrisR.y) * vidH;
            const rawPx = Math.sqrt(dx * dx + dy * dy);
            const compPx = rawPx / yawCos;
            if (compPx > 2) {
                measurements.push({
                    distMm: (focalLength * IRIS_DIAMETER_MM) / compPx,
                    weight: 1.3,
                    name: 'left_iris_hvid'
                });
            }
        }

        // ── Method 2: Outer canthus (33 ↔ 263) — Highly reliable lateral eye baseline ──
        const leftOuter = landmarks[33];
        const rightOuter = landmarks[263];
        if (leftOuter && rightOuter) {
            const dx = (rightOuter.x - leftOuter.x) * vidW;
            const dy = (rightOuter.y - leftOuter.y) * vidH;
            const rawPx = Math.sqrt(dx * dx + dy * dy);
            const compPx = rawPx / yawCos;
            if (compPx > 5) {
                measurements.push({
                    distMm: (focalLength * OUTER_CANTHAL_WIDTH_MM) / compPx,
                    weight: 1.2,
                    name: 'outer_canthus'
                });
            }
        }

        // ── Method 3: Cheekbone width (234 ↔ 454) ──
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];
        if (leftCheek && rightCheek) {
            const dx = (rightCheek.x - leftCheek.x) * vidW;
            const dy = (rightCheek.y - leftCheek.y) * vidH;
            const rawPx = Math.sqrt(dx * dx + dy * dy);
            const compPx = rawPx / yawCos;
            if (compPx > 5) {
                measurements.push({
                    distMm: (focalLength * FACE_WIDTH_MM) / compPx,
                    weight: 1.0,
                    name: 'cheekbone'
                });
            }
        }

        // ── Method 4: Inner eye corners IPD (133 ↔ 362) ──
        const leftInner = landmarks[133];
        const rightInner = landmarks[362];
        if (leftInner && rightInner) {
            const dx = (rightInner.x - leftInner.x) * vidW;
            const dy = (rightInner.y - leftInner.y) * vidH;
            const rawPx = Math.sqrt(dx * dx + dy * dy);
            const compPx = rawPx / yawCos;
            if (compPx > 3) {
                measurements.push({
                    distMm: (focalLength * INNER_CANTHAL_WIDTH_MM) / compPx,
                    weight: 0.9,
                    name: 'inner_canthus'
                });
            }
        }

        // ── Method 5: Forehead width (landmark 10 ↔ 338) ──
        const foreheadLeft = landmarks[10];
        const foreheadRight = landmarks[338];
        if (foreheadLeft && foreheadRight) {
            const dx = (foreheadRight.x - foreheadLeft.x) * vidW;
            const dy = (foreheadRight.y - foreheadLeft.y) * vidH;
            const rawPx = Math.sqrt(dx * dx + dy * dy);
            const compPx = rawPx / yawCos;
            if (compPx > 3) {
                measurements.push({
                    distMm: (focalLength * FOREHEAD_WIDTH_MM) / compPx,
                    weight: 0.7,
                    name: 'forehead'
                });
            }
        }

        // ── Method 6: Nose tip to chin (1 ↔ 199) — pitch-compensated ──
        const noseTip = landmarks[1];
        const chin = landmarks[199];
        if (noseTip && chin) {
            const dy = (chin.y - noseTip.y) * vidH;
            const dx = (chin.x - noseTip.x) * vidW;
            const rawPx = Math.sqrt(dx * dx + dy * dy);
            const compPx = rawPx / pitchCos;
            if (compPx > 3) {
                measurements.push({
                    distMm: (focalLength * NOSE_TO_CHIN_MM) / compPx,
                    weight: 0.7,
                    name: 'nose_chin'
                });
            }
        }

        if (measurements.length === 0) return;

        // ── Robust Consensus Filtering: Outlier Rejection (>15% from median) ──
        const sortedDistances = measurements.map(m => m.distMm).sort((a, b) => a - b);
        const medianDistMm = sortedDistances[Math.floor(sortedDistances.length / 2)];

        const consensus = measurements.filter(m => Math.abs(m.distMm - medianDistMm) / medianDistMm <= 0.15);
        const finalSet = consensus.length > 0 ? consensus : [{ distMm: medianDistMm, weight: 1.0, name: 'median' }];

        const totalWeight = finalSet.reduce((acc, m) => acc + m.weight, 0);
        const weightedMm = finalSet.reduce((acc, m) => acc + m.distMm * m.weight, 0) / totalWeight;

        // Clamp to plausible range (0.2m – 3.5m)
        const clampedM = Math.min(3.5, Math.max(0.2, weightedMm / 1000));
        updateDistance(clampedM, 'facemesh');
    };

    // ─── Update distance (writes to refs, NOT direct React state) ───
    const updateDistance = (rawDist: number, method: 'facemesh' | 'detection' | 'pixels') => {
        lastUpdateRef.current = Date.now();
        if (warmupCountRef.current < WARMUP_FRAMES) return;

        const smoothed = smoothDistance(Math.max(0.3, rawDist));
        currentDistanceRef.current = smoothed;
        (window as any).__covisionCurrentDistance = smoothed;
        lastValidDistanceRef.current = smoothed;
        lastValidTimeRef.current = Date.now();

        debugInfoRef.current = {
            ...debugInfoRef.current,
            rawDistance: rawDist,
            method,
            fps: fpsRef.current,
            faceMeshActive: !!faceLandmarkerRef.current,
            faceDetectionActive: !!faceDetectorRef.current,
        };

        const target = targetRef.current;
        const tolerance = toleranceRef.current;

        // Determine candidate status
        let candidateStatus: DistanceStatus = 'ok';
        if (smoothed < target - tolerance) candidateStatus = 'too_close';
        else if (smoothed > target + tolerance) candidateStatus = 'too_far';

        pendingStatusRef.current = candidateStatus;
        currentStatusRef.current = candidateStatus;

        const now = Date.now();
        const inRange = currentStatusRef.current === 'ok';

        if (now % 500 < 50) {
            complianceLogRef.current.push({ timestamp: now, distanceM: smoothed, inRange });
        }

        // Rolling history for precision stability verification (1500ms window)
        distanceHistoryRef.current.push({ time: now, dist: smoothed });
        distanceHistoryRef.current = distanceHistoryRef.current.filter(entry => now - entry.time <= 1500);

        let isStationary = false;
        if (distanceHistoryRef.current.length >= 10) {
            const distances = distanceHistoryRef.current.map(e => e.dist);
            const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
            const variance = distances.reduce((a, b) => a + (b - mean) ** 2, 0) / distances.length;
            const stdDev = Math.sqrt(variance);
            isStationary = stdDev < 0.025; // under 2.5cm variance
        }

        if (inRange && isStationary) {
            if (!inRangeSinceRef.current) inRangeSinceRef.current = now;
            currentStableRef.current = (now - inRangeSinceRef.current >= 1500);
        } else {
            inRangeSinceRef.current = null;
            currentStableRef.current = false;
        }

        // Throttled flush to React
        flushStateToReact();
    };

    // ─── Detection loop ───
    const startDetectionLoop = () => {
        if (!animFrameRef.current) {
            frameCountRef.current = 0;
            warmupCountRef.current = 0;
            lastUpdateRef.current = Date.now();
            detectLoop();
        } else {
            lastUpdateRef.current = Date.now();
        }
    };

    const lastFaceSendRef = useRef(0);
    const lastPoseSendRef = useRef(0);
    const lastHandSendRef = useRef(0);

    const detectLoop = () => {
        // Prioritize active on-screen visible video if ready; fall back to offscreen detection video
        const video = (videoRef.current && videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0 && !videoRef.current.paused)
            ? videoRef.current
            : (detectionVideoRef.current || videoRef.current);

        if (!video || video.readyState < 2 || video.paused || video.ended) {
            animFrameRef.current = requestAnimationFrame(detectLoop);
            return;
        }

        const now = Date.now();
        frameCountRef.current++;
        warmupCountRef.current++;
        if (now - lastFpsTimeRef.current >= 1000) {
            fpsRef.current = frameCountRef.current;
            frameCountRef.current = 0;
            lastFpsTimeRef.current = now;
        }

        // No face timeout — with grace period to hold last distance
        const timeSinceUpdate = now - lastUpdateRef.current;
        if (timeSinceUpdate > GRACE_HOLD_MS && warmupCountRef.current > WARMUP_FRAMES) {
            // During grace period (GRACE_HOLD_MS to NO_FACE_TIMEOUT): hold last valid distance
            if (timeSinceUpdate < NO_FACE_TIMEOUT && lastValidDistanceRef.current > 0) {
                currentDistanceRef.current = lastValidDistanceRef.current;
                // Keep current status — don't flicker
                flushStateToReact();
            } else if (timeSinceUpdate >= NO_FACE_TIMEOUT) {
                // Fully timed out — declare no face; reset snap so next detection is instant
                currentStatusRef.current = 'no_face';
                currentDistanceRef.current = 0;
                currentStableRef.current = false;
                faceLandmarksRef.current = null;
                smoothedFaceLandmarksRef.current = null;
                poseLandmarksRef.current = null;
                handLandmarksRef.current = null;
                snapFramesRef.current = 0;
                emaRef.current = 0;
                distanceBufferRef.current = [];
                pendingStatusRef.current = 'no_face';
                debugInfoRef.current.method = 'none';
                flushStateToReact();
            }
        }

        const timestamp = performance.now();

        // FaceLandmarker ONLY — unthrottled dedicated execution with zero competing models
        if (faceLandmarkerRef.current && timestamp - lastFaceSendRef.current > 10) {
            try {
                lastFaceSendRef.current = timestamp;
                sendCountRef.current++;
                debugInfoRef.current.sendCount = sendCountRef.current;

                const results = faceLandmarkerRef.current.detectForVideo(video, timestamp);
                if (results?.faceLandmarks?.length > 0) {
                    processLandmarks(results.faceLandmarks[0], video);
                }
            } catch (e: any) {
                if (sendCountRef.current < 5) {
                    console.warn('FaceLandmarker error:', e?.message || e);
                }
            }
        }

        // Fallback to Chrome FaceDetector if FaceLandmarker missing or stale
        const faceMeshStale = (now - lastUpdateRef.current > 500);
        if ((!faceLandmarkerRef.current || faceMeshStale) && faceDetectorRef.current && video.readyState >= 2) {
            try {
                if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
                const canvas = canvasRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0);
                    faceDetectorRef.current.detect(canvas).then((faces: any) => {
                        if (faces.length > 0) {
                            const widthPx = faces[0].boundingBox.width;
                            const focalLength = getFocalLength(video.videoWidth, video.videoHeight);
                            const distMm = (focalLength * DEFAULT_FACE_WIDTH_MM) / widthPx;
                            updateDistance(distMm / 1000, 'detection');
                        }
                    }).catch(() => { });
                }
            } catch (e) { }
        }

        animFrameRef.current = requestAnimationFrame(detectLoop);
    };

    const startCamera = useCallback(async () => {
        // Already running or no stream
        if (animFrameRef.current) return;
        startDetectionLoop();
    }, []);

    useEffect(() => {
        if (videoRef.current && videoRef.current.srcObject) {
            startDetectionLoop();
        }
    }, [videoRef.current?.srcObject]);

    const stopCamera = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = 0;
        }
    }, []);

    return {
        videoRef,
        faceLandmarksRef,
        poseLandmarksRef,
        handLandmarksRef,
        status,
        distanceM,
        isStable,
        complianceLog: complianceLogRef.current,
        debugInfo: debugInfoRef.current,
        debugMode,
        setDebugMode,
        startCamera,
        stopCamera,
    };
}
