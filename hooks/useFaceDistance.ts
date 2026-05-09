
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

const OUTER_CANTHAL_WIDTH_MM = 90;
const FACE_WIDTH_MM = 143;
const DEFAULT_FACE_WIDTH_MM = 140;
const FOCAL_MULTIPLIER = 0.87;
const SMOOTHING_BUFFER = 15;
const WARMUP_FRAMES = 5;
const STATE_UPDATE_INTERVAL = 30; // throttle React state updates to ~30fps 
const EMA_ALPHA = 0.25; // exponential moving average weight (lower = smoother)
const NO_FACE_TIMEOUT = 5000; // ms before declaring no face (was 3000)
const GRACE_HOLD_MS = 1500; // hold last distance this long after face lost

// Modern MediaPipe Tasks Vision CDN
const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18';
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const HAND_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export function useFaceDistance(options?: FaceDistanceOptions): FaceDistanceReturn {
    const {
        pxPerMm = 4.0,
        ipdMm = 63,
        targetDistanceM = 2.0,
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

    // ML model refs
    const faceLandmarkerRef = useRef<any>(null);
    const poseLandmarkerRef = useRef<any>(null);
    const handLandmarkerRef = useRef<any>(null);
    const handLandmarksStateRef = useRef<any[] | null>(null);
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
    const pendingStatusRef = useRef<DistanceStatus>('no_face');
    const lastValidDistanceRef = useRef(0); // last good reading for grace period
    const lastValidTimeRef = useRef(0); // when last good reading was
    const complianceLogRef = useRef<DistanceReading[]>([]);
    const inRangeSinceRef = useRef<number | null>(null);
    const faceLandmarksRef = useRef<any[] | null>(null);
    const poseLandmarksRef = useRef<any[] | null>(null);

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

                const { FaceLandmarker, PoseLandmarker, HandLandmarker, FilesetResolver } = vision;

                debugInfoRef.current.faceMeshStatus = 'loading_wasm';
                const wasmFileset = await FilesetResolver.forVisionTasks(
                    `${VISION_CDN}/wasm`
                );
                if (!active) return;

                // Init FaceLandmarker
                debugInfoRef.current.faceMeshStatus = 'creating_landmarker';
                console.log('useFaceDistance: Creating FaceLandmarker...');
                const faceLandmarker = await FaceLandmarker.createFromOptions(wasmFileset, {
                    baseOptions: {
                        modelAssetPath: FACE_MODEL_URL,
                        delegate: 'GPU',
                    },
                    outputFaceBlendshapes: false,
                    runningMode: 'VIDEO',
                    numFaces: 1,
                    minFaceDetectionConfidence: 0.3, // Lower threshold = easier to detect initially
                    minFacePresenceConfidence: 0.3,  // Lower threshold = harder to lose face
                    minTrackingConfidence: 0.3,      // Lower threshold = smoother tracking in tough angles
                });
                if (!active) return;
                faceLandmarkerRef.current = faceLandmarker;
                debugInfoRef.current.faceMeshStatus = 'ready';
                debugInfoRef.current.faceMeshActive = true;
                console.log('useFaceDistance: ✅ FaceLandmarker ready');

                // Init PoseLandmarker for body skeleton
                console.log('useFaceDistance: Creating PoseLandmarker...');
                try {
                    const poseLandmarker = await PoseLandmarker.createFromOptions(wasmFileset, {
                        baseOptions: {
                            modelAssetPath: POSE_MODEL_URL,
                            delegate: 'GPU',
                        },
                        runningMode: 'VIDEO',
                        numPoses: 1,
                        minPoseDetectionConfidence: 0.1, // EXTREMELY sensitive to find bodies far away
                        minPosePresenceConfidence: 0.1,
                        minTrackingConfidence: 0.1,
                    });
                    if (!active) return;
                    poseLandmarkerRef.current = poseLandmarker;
                    console.log('useFaceDistance: ✅ PoseLandmarker ready');
                } catch (poseErr) {
                    console.warn('useFaceDistance: PoseLandmarker init failed (body lines unavailable):', poseErr);
                }

                // Init HandLandmarker for articulate finger tracking
                console.log('useFaceDistance: Creating HandLandmarker...');
                try {
                    const handLandmarker = await HandLandmarker.createFromOptions(wasmFileset, {
                        baseOptions: {
                            modelAssetPath: HAND_MODEL_URL,
                            delegate: 'GPU',
                        },
                        runningMode: 'VIDEO',
                        numHands: 2,
                        minHandDetectionConfidence: 0.1, // Extensively lowered for distance
                        minHandPresenceConfidence: 0.1,
                        minTrackingConfidence: 0.1,
                    });
                    if (!active) return;
                    handLandmarkerRef.current = handLandmarker;
                    console.log('useFaceDistance: ✅ HandLandmarker ready');
                } catch (handErr) {
                    console.warn('useFaceDistance: HandLandmarker init failed:', handErr);
                }

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
            if (poseLandmarkerRef.current) {
                try { poseLandmarkerRef.current.close(); } catch (e) { }
                poseLandmarkerRef.current = null;
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
            vid.style.position = 'fixed';
            vid.style.opacity = '0.001';
            vid.style.width = '1px';
            vid.style.height = '1px';
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
                if (!cancelled) setTimeout(ensurePlaying, 300);
                return;
            }
            const waitForData = () => {
                if (cancelled) return;
                if (vid.readyState >= 2 && vid.videoWidth > 0) {
                    console.log('useFaceDistance: detection video ready', vid.videoWidth, 'x', vid.videoHeight);
                    startDetectionLoop();
                } else {
                    setTimeout(waitForData, 100);
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

    // ─── Smoothing with EMA ───
    const smoothDistance = (newDist: number) => {
        const ema = emaRef.current;
        const buffer = distanceBufferRef.current;

        buffer.push(newDist);
        if (buffer.length > SMOOTHING_BUFFER) buffer.shift();

        // Trimmed mean: drop top and bottom 20% to remove jitter
        let trimmedMean: number;
        if (buffer.length >= 8) {
            const sorted = [...buffer].sort((a, b) => a - b);
            const trimCount = Math.max(1, Math.floor(sorted.length * 0.2));
            const trimmed = sorted.slice(trimCount, -trimCount);
            trimmedMean = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
        } else {
            trimmedMean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
        }

        // Apply exponential moving average on top of trimmed mean
        if (ema === 0) {
            emaRef.current = trimmedMean;
        } else {
            emaRef.current = EMA_ALPHA * trimmedMean + (1 - EMA_ALPHA) * ema;
        }

        return emaRef.current;
    };

    // ─── Process face landmarks ───
    const firstResultLoggedRef = useRef(false);

    const processLandmarks = (landmarks: any[], video: HTMLVideoElement) => {
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
        const focalLength = vidW * FOCAL_MULTIPLIER;

        const measurements: number[] = [];

        // Method 1: Outer eye corners (33, 263)
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        if (leftEye && rightEye) {
            const dx = (rightEye.x - leftEye.x) * vidW;
            const dy = (rightEye.y - leftEye.y) * vidH;
            const pxDist = Math.sqrt(dx * dx + dy * dy);
            if (pxDist > 3) {
                measurements.push((focalLength * OUTER_CANTHAL_WIDTH_MM) / pxDist);
            }
        }

        // Method 2: Cheekbone width (234, 454)
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];
        if (leftCheek && rightCheek) {
            const dx = (rightCheek.x - leftCheek.x) * vidW;
            const dy = (rightCheek.y - leftCheek.y) * vidH;
            const pxDist = Math.sqrt(dx * dx + dy * dy);
            if (pxDist > 3) {
                // Smoothing dynamic distance based on cheeks
                measurements.push((focalLength * FACE_WIDTH_MM) / pxDist);
            }
        }

        if (measurements.length === 0) return;

        const avgDistMm = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        updateDistance(avgDistMm / 1000, 'facemesh');
    };

    // ─── Update distance (writes to refs, NOT direct React state) ───
    // Real-time exponential moving average (higher alpha = more reactive, lower = smoother)
    const updateDistance = (rawDist: number, method: 'facemesh' | 'detection' | 'pixels') => {
        lastUpdateRef.current = Date.now();
        if (warmupCountRef.current < WARMUP_FRAMES) return;

        const smoothed = smoothDistance(Math.max(0.3, rawDist));
        currentDistanceRef.current = smoothed;
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

        if (inRange) {
            if (!inRangeSinceRef.current) inRangeSinceRef.current = now;
            currentStableRef.current = (now - inRangeSinceRef.current >= 3000);
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
        const video = detectionVideoRef.current || videoRef.current;
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
                // Fully timed out — declare no face
                currentStatusRef.current = 'no_face';
                currentDistanceRef.current = 0;
                currentStableRef.current = false;
                faceLandmarksRef.current = null;
                poseLandmarksRef.current = null;
                handLandmarksStateRef.current = null;
                emaRef.current = 0;
                distanceBufferRef.current = [];
                pendingStatusRef.current = 'no_face';
                debugInfoRef.current.method = 'none';
                flushStateToReact();
            }
        }

        const timestamp = performance.now();

        // FaceLandmarker — run at ~30fps (33ms)
        if (faceLandmarkerRef.current && timestamp - lastFaceSendRef.current > 33) {
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

        // PoseLandmarker — run at ~30fps for stable body tracking
        if (poseLandmarkerRef.current && timestamp - lastPoseSendRef.current > 33) {
            try {
                lastPoseSendRef.current = timestamp;
                const poseResults = poseLandmarkerRef.current.detectForVideo(video, timestamp);
                if (poseResults?.landmarks?.length > 0) {
                    poseLandmarksRef.current = poseResults.landmarks[0];
                    (window as any).__sharedPoseLandmarks = poseResults.landmarks[0];
                } else {
                    (window as any).__sharedPoseLandmarks = null;
                }
            } catch (e: any) {
                // Silently fail — pose is optional overlay
            }
        }

        // HandLandmarker — run at ~15fps
        if (handLandmarkerRef.current && timestamp - lastHandSendRef.current > 66) {
            try {
                lastHandSendRef.current = timestamp;
                const handResults = handLandmarkerRef.current.detectForVideo(video, timestamp);
                if (handResults?.landmarks?.length > 0) {
                    handLandmarksStateRef.current = handResults.landmarks;
                    (window as any).__sharedHandLandmarks = handResults.landmarks;
                    (window as any).__sharedHandednesses = handResults.handednesses;
                } else {
                    handLandmarksStateRef.current = null;
                    (window as any).__sharedHandLandmarks = null;
                    (window as any).__sharedHandednesses = null;
                }
            } catch (e: any) {
                // Silently fail
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
                            const vidW = video.videoWidth;
                            const focalLength = vidW * FOCAL_MULTIPLIER;
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
        if (externalStream && detectionVideoRef.current) {
            try { await detectionVideoRef.current.play(); } catch (e) { }
            startDetectionLoop();
        } else {
            console.log('useFaceDistance.startCamera: waiting for external stream...');
        }
    }, [externalStream]);

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
        handLandmarksRef: handLandmarksStateRef,
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
