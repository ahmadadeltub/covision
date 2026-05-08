import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Language, DistanceStatus } from '../types';
import { translations } from '../translations';

interface Props {
    lang: Language;
    distanceStatus: DistanceStatus;
    distanceM?: number;
    isStable?: boolean;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    stream?: MediaStream | null;
    poseLandmarksRef?: React.RefObject<any[] | null>;
    onStart: () => void;
}

type EyeCoverStatus = 'right_covered' | 'left_covered' | 'none_covered' | 'both_covered' | 'no_detection';

const EAR_THRESHOLD = 0.16;
const DETECTION_INTERVAL = 200;

const CoverEyeScreen: React.FC<Props> = ({
    lang, distanceStatus, distanceM = 0, isStable = false,
    videoRef, stream, poseLandmarksRef, onStart
}) => {
    const t = translations[lang];
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [eyeCoverStatus, setEyeCoverStatus] = useState<EyeCoverStatus>('no_detection');
    const [localDistanceM] = useState(0);
    const [coverConfidence, setCoverConfidence] = useState(0);
    const coverHistoryRef = useRef<EyeCoverStatus[]>([]);

    // Use stream to set up local video
    useEffect(() => {
        const vid = localVideoRef.current;
        if (!vid || !stream) return;
        if (vid.srcObject !== stream) { vid.srcObject = stream; }
        vid.play().catch(() => {});
    }, [stream]);

    // EAR calculation
    const computeEAR = useCallback((landmarks: any[], eyeIndices: number[]) => {
        const [p1, p2, p3, p4, p5, p6] = eyeIndices.map(i => landmarks[i]);
        if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.3;
        const d = (a: any, b: any) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + ((a.z || 0) - (b.z || 0)) ** 2);
        const v1 = d(p2, p6);
        const v2 = d(p3, p5);
        const hz = d(p1, p4);
        return hz > 0 ? (v1 + v2) / (2 * hz) : 0.3;
    }, []);

    // Update cover status with history smoothing
    const updateCoverStatus = useCallback((status: EyeCoverStatus) => {
        const history = coverHistoryRef.current;
        history.push(status);
        if (history.length > 12) history.shift();
        const counts: Record<string, number> = {};
        history.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
        let best = status;
        let bestCount = 0;
        for (const [s, c] of Object.entries(counts)) {
            if (c > bestCount) { bestCount = c; best = s as EyeCoverStatus; }
        }
        setCoverConfidence(Math.round((bestCount / history.length) * 100));
        setEyeCoverStatus(best);
    }, []);

    // Detection + drawing loop (reads shared landmarks from useFaceDistance)
    useEffect(() => {
        if (!stream) return;
        let stopped = false;

        const detect = () => {
            if (stopped) return;

            const faceLandmarks = (window as any).__sharedFaceLandmarks as any[] | null;
            const poseLandmarks = poseLandmarksRef?.current ?? null;

            // EAR-based eye cover detection
            if (faceLandmarks && faceLandmarks.length >= 468) {
                const LEFT_EYE = [33, 160, 158, 133, 153, 144];
                const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
                const leftEAR = computeEAR(faceLandmarks, LEFT_EYE);
                const rightEAR = computeEAR(faceLandmarks, RIGHT_EYE);
                let status: EyeCoverStatus = 'none_covered';
                if (leftEAR < EAR_THRESHOLD && rightEAR < EAR_THRESHOLD) status = 'both_covered';
                else if (rightEAR < EAR_THRESHOLD) status = 'right_covered';
                else if (leftEAR < EAR_THRESHOLD) status = 'left_covered';
                updateCoverStatus(status);
            } else {
                updateCoverStatus('no_detection');
            }

            // Draw overlay
            const canvas = overlayCanvasRef.current;
            const video = localVideoRef.current;
            if (canvas && video && video.videoWidth > 0) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const w = canvas.width, h = canvas.height;
                    ctx.clearRect(0, 0, w, h);
                    if (faceLandmarks && faceLandmarks.length >= 468) drawFaceMesh(ctx, faceLandmarks, w, h);
                    if (poseLandmarks && poseLandmarks.length >= 25) drawPose(ctx, poseLandmarks, w, h);
                }
            }

            setTimeout(() => { if (!stopped) detect(); }, DETECTION_INTERVAL);
        };

        detect();
        return () => { stopped = true; };
    }, [stream, poseLandmarksRef, computeEAR, updateCoverStatus]);

    // Face Mesh Drawing (premium neon style)
    const drawFaceMesh = (ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) => {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-w, 0);
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 2) * 0.1 + 0.9;

        const drawP = (pts: number[], color: string, lw: number, close = false) => {
            if (pts.some(i => !lm[i])) return;
            ctx.beginPath(); ctx.lineWidth = lw; ctx.strokeStyle = color;
            ctx.moveTo(lm[pts[0]].x * w, lm[pts[0]].y * h);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(lm[pts[i]].x * w, lm[pts[i]].y * h);
            if (close) ctx.closePath();
            ctx.stroke();
        };

        // Jaw
        ctx.shadowBlur = 8; ctx.shadowColor = '#0055ff';
        drawP([10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10], `rgba(0,120,255,${0.6 * pulse})`, 3.5, true);
        ctx.shadowBlur = 0;
        // Eyes
        ctx.shadowBlur = 12; ctx.shadowColor = '#00f3ff';
        drawP([33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33], `rgba(0,243,255,${0.95 * pulse})`, 4, true);
        drawP([263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263], `rgba(0,243,255,${0.95 * pulse})`, 4, true);
        ctx.shadowBlur = 0;
        // Eyebrows
        ctx.shadowBlur = 10; ctx.shadowColor = '#0088ff';
        drawP([70, 63, 105, 66, 107, 55, 65, 52, 53, 46], `rgba(0,180,255,${0.8 * pulse})`, 3.5);
        drawP([300, 293, 334, 296, 336, 285, 295, 282, 283, 276], `rgba(0,180,255,${0.8 * pulse})`, 3.5);
        ctx.shadowBlur = 0;
        // Nose
        ctx.shadowBlur = 8; ctx.shadowColor = '#00f3ff';
        drawP([168, 6, 197, 195, 5, 4, 1, 19], `rgba(0,243,255,${0.7 * pulse})`, 3.5);
        ctx.shadowBlur = 0;
        // Lips
        ctx.shadowBlur = 15; ctx.shadowColor = '#00ff88';
        drawP([61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61], `rgba(0,255,136,${0.8 * pulse})`, 3.5, true);
        ctx.shadowBlur = 0;
        // Cheek lines
        ctx.shadowBlur = 6; ctx.shadowColor = '#0066ff';
        drawP([127, 234, 93, 132], `rgba(0,150,255,${0.5 * pulse})`, 2.5);
        drawP([356, 454, 323, 361], `rgba(0,150,255,${0.5 * pulse})`, 2.5);
        ctx.shadowBlur = 0;
        // Techno dots
        [10, 152, 1, 33, 263, 133, 362, 61, 291, 168, 0, 17].forEach(i => {
            const p = lm[i]; if (!p) return;
            ctx.beginPath(); ctx.fillStyle = '#00f3ff'; ctx.shadowBlur = 15; ctx.shadowColor = '#00f3ff';
            ctx.arc(p.x * w, p.y * h, 5 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        });

        ctx.restore();
    };

    // Body Pose Drawing (bold blue)
    const drawPose = (ctx: CanvasRenderingContext2D, lm: any[], w: number, h: number) => {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-w, 0);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 2) * 0.1 + 0.9;

        const drawLine = (a: number, b: number, color: string, lw: number) => {
            const pa = lm[a], pb = lm[b];
            if (!pa || !pb || (pa.visibility ?? 1) < 0.5 || (pb.visibility ?? 1) < 0.5) return;
            ctx.beginPath(); ctx.lineWidth = lw; ctx.strokeStyle = color;
            ctx.shadowBlur = lw * 4; ctx.shadowColor = color;
            ctx.moveTo(pa.x * w, pa.y * h); ctx.lineTo(pb.x * w, pb.y * h);
            ctx.stroke(); ctx.shadowBlur = 0;
        };

        const drawJoint = (i: number, r: number, color: string) => {
            const p = lm[i];
            if (!p || (p.visibility ?? 1) < 0.5) return;
            ctx.beginPath(); ctx.fillStyle = color; ctx.shadowBlur = r * 5; ctx.shadowColor = color;
            ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        };

        const blue = `rgba(30,100,255,${0.95 * pulse})`;
        const blueGlow = `rgba(60,140,255,${0.85 * pulse})`;

        drawLine(11, 12, blue, 8);
        drawLine(11, 13, blue, 7); drawLine(13, 15, blue, 6);
        drawLine(12, 14, blue, 7); drawLine(14, 16, blue, 6);
        drawLine(11, 23, blue, 6); drawLine(12, 24, blue, 6); drawLine(23, 24, blue, 6);
        const midSh = lm[11] && lm[12] ? { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2 } : null;
        if (midSh && lm[0]) {
            ctx.beginPath(); ctx.lineWidth = 5;
            ctx.strokeStyle = `rgba(0,200,255,${0.7 * pulse})`;
            ctx.shadowBlur = 15; ctx.shadowColor = '#0088ff';
            ctx.moveTo(midSh.x * w, midSh.y * h); ctx.lineTo(lm[0].x * w, lm[0].y * h);
            ctx.stroke(); ctx.shadowBlur = 0;
        }
        [11, 12, 13, 14, 15, 16, 23, 24].forEach(i => drawJoint(i, 8 * pulse, blueGlow));

        ctx.restore();
    };

    // Status configs
    const effectiveDist = localDistanceM > 0 ? localDistanceM : distanceM;
    const statusConfig: Record<DistanceStatus, { label: string; color: string; bg: string; icon: string }> = {
        ok: { label: t.distance_ok, color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '\u2705' },
        too_close: { label: t.too_close, color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: '\ud83d\udd34' },
        too_far: { label: t.too_far, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '\ud83d\udfe1' },
        no_face: { label: t.no_face, color: '#6b7280', bg: 'rgba(107,114,128,0.15)', icon: '\u26ab' },
    };
    const s = statusConfig[distanceStatus];
    const isRightEyeCovered = eyeCoverStatus === 'right_covered' || eyeCoverStatus === 'both_covered';
    const canStart = isRightEyeCovered;

    const coverStatusConfig: Record<EyeCoverStatus, { label: string; color: string; icon: string }> = {
        right_covered: { label: '\u2705 Right eye is covered \u2014 READY!', color: '#10b981', icon: '\ud83d\udfe2' },
        left_covered: { label: '\u26a0\ufe0f Wrong eye! Cover your RIGHT eye', color: '#f59e0b', icon: '\ud83d\udfe1' },
        none_covered: { label: '\u274c Please cover your RIGHT eye with your hand', color: '#ef4444', icon: '\ud83d\udd34' },
        both_covered: { label: '\u26a0\ufe0f Both eyes covered \u2014 only cover RIGHT eye', color: '#f59e0b', icon: '\ud83d\udfe1' },
        no_detection: { label: 'Looking for face\u2026', color: '#6b7280', icon: '\u26ab' },
    };
    const cs = coverStatusConfig[eyeCoverStatus];

    return (
        <div className="w-full h-full flex items-center justify-center p-2 md:p-4 overflow-hidden">
            <div className="glass w-full max-w-5xl h-full max-h-[90vh] rounded-[3rem] md:rounded-[4rem] shadow-[0_0_150px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col items-center justify-between relative overflow-hidden bg-slate-900/60 p-4 md:p-8 animate-in fade-in zoom-in-95 duration-700">
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-cyan-500 rounded-full animate-[ping_15s_infinite]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-cyan-500/30 rounded-full animate-[ping_20s_infinite_reverse]"></div>
                </div>
                <div className="relative z-10 w-full text-center shrink-0">
                    <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-2xl">
                        {t.cover_eye_title}
                    </h2>
                    <p className="text-xs md:text-lg text-cyan-400 font-bold uppercase tracking-[0.3em] mt-1">
                        {t.cover_eye_desc}
                    </p>
                </div>
                <div className="relative z-10 flex-1 w-full max-w-3xl mx-auto flex flex-col items-center justify-center gap-3 min-h-0 my-2">
                    <div className="relative w-full max-w-lg aspect-[4/3] rounded-[2rem] overflow-hidden bg-black border-2 shadow-[0_0_40px_rgba(0,200,255,0.15)]"
                        style={{ borderColor: isRightEyeCovered ? '#10b98180' : s.color + '40' }}
                    >
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover scale-x-[-1] brightness-110"
                        />
                        <canvas
                            ref={overlayCanvasRef}
                            className="absolute inset-0 w-full h-full pointer-events-none"
                        />
                        <div className="absolute inset-0 pointer-events-none p-4">
                            <div className="absolute top-4 left-4 w-10 h-10 border-t-3 border-l-3 rounded-tl-lg" style={{ borderColor: isRightEyeCovered ? '#10b981' : s.color }}></div>
                            <div className="absolute top-4 right-4 w-10 h-10 border-t-3 border-r-3 rounded-tr-lg" style={{ borderColor: isRightEyeCovered ? '#10b981' : s.color }}></div>
                            <div className="absolute bottom-4 left-4 w-10 h-10 border-b-3 border-l-3 rounded-bl-lg" style={{ borderColor: isRightEyeCovered ? '#10b981' : s.color }}></div>
                            <div className="absolute bottom-4 right-4 w-10 h-10 border-b-3 border-r-3 rounded-br-lg" style={{ borderColor: isRightEyeCovered ? '#10b981' : s.color }}></div>
                        </div>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 glass px-4 py-1.5 rounded-full border flex items-center gap-2"
                            style={{ borderColor: s.color + '50' }}
                        >
                            <span className="text-base">{s.icon}</span>
                            <span className="font-black text-xs md:text-sm uppercase tracking-wider" style={{ color: s.color }}>
                                {effectiveDist > 0 ? `${effectiveDist.toFixed(2)}m` : s.label}
                            </span>
                        </div>
                        <div className="absolute top-3 left-3 glass px-3 py-1 rounded-full border border-cyan-500/30 flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">AI Eye Detection</span>
                        </div>
                        {eyeCoverStatus !== 'no_detection' && (
                            <div className="absolute top-3 right-3 glass px-3 py-1 rounded-full border border-white/10">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{coverConfidence}% conf</span>
                            </div>
                        )}
                    </div>
                    <div className="w-full max-w-lg flex items-center gap-3 py-3 px-5 rounded-[1.5rem] border transition-all duration-300"
                        style={{ background: cs.color + '10', borderColor: cs.color + '30' }}
                    >
                        <span className="text-xl shrink-0">{cs.icon}</span>
                        <p className="font-bold text-sm md:text-base uppercase tracking-wider" style={{ color: cs.color }}>
                            {cs.label}
                        </p>
                    </div>
                    {distanceStatus === 'ok' && !isStable && (
                        <div className="flex items-center gap-2 text-amber-400 animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                            <span className="font-bold text-sm uppercase tracking-wider">{t.hold_steady}</span>
                        </div>
                    )}
                    {isStable && (
                        <div className="flex items-center gap-2 text-emerald-400">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                            <span className="font-bold text-sm uppercase tracking-wider">{t.stable}</span>
                        </div>
                    )}
                </div>
                <div className="relative z-10 w-full max-w-3xl shrink-0">
                    <button
                        onClick={onStart}
                        disabled={!canStart}
                        className={`group w-full py-5 md:py-7 rounded-[2.5rem] font-black text-lg md:text-3xl uppercase tracking-[0.3em] transition-all transform hover:scale-[1.02] active:scale-95 relative overflow-hidden shadow-2xl ${canStart
                            ? 'bg-white text-slate-950 hover:bg-cyan-400 hover:shadow-[0_0_80px_rgba(0,243,255,0.5)]'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                            }`}
                    >
                        <span className="relative z-10">
                            {canStart ? t.start_test : 'Cover Right Eye to Continue'}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CoverEyeScreen;
