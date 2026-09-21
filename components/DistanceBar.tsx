
import React, { useEffect, useRef } from 'react';

interface Props {
    /** Distance in meters — from useFaceDistance hook */
    distanceM?: number;
    /** Status — from useFaceDistance hook */
    status?: 'ok' | 'too_close' | 'too_far' | 'no_face';
    /** Target distance in meters (default 1.0) */
    targetM?: number;
    /** Tolerance in meters (default 0.15) */
    toleranceM?: number;
    /** Called when distance status changes */
    onStatusChange?: (status: 'ok' | 'too_close' | 'too_far' | 'no_face') => void;
    /** If true, show a "PAUSED" overlay message when too close */
    showPauseOverlay?: boolean;
}

/**
 * Compact real-time distance enforcement bar.
 * Pure presentation component — receives distance data as props from useFaceDistance.
 * No internal ML models or camera access.
 */
const DistanceBar: React.FC<Props> = ({
    distanceM = 0,
    status = 'no_face',
    targetM = 1.0,
    toleranceM = 0.15,
    onStatusChange,
    showPauseOverlay = true,
}) => {
    const lastStatusRef = useRef<string>('no_face');

    // Notify parent on status change
    useEffect(() => {
        if (status !== lastStatusRef.current) {
            lastStatusRef.current = status;
            onStatusChange?.(status);
        }
    }, [status, onStatusChange]);

    // Theme colors
    const isOk = status === 'ok';
    const isClose = status === 'too_close';
    const isFar = status === 'too_far';

    const themeColor = isOk ? '#10b981' : isClose ? '#f43f5e' : isFar ? '#f59e0b' : '#64748b';
    const themeGlow = isOk
        ? 'rgba(16, 185, 129, 0.35)'
        : isClose
            ? 'rgba(244, 63, 94, 0.35)'
            : isFar
                ? 'rgba(245, 158, 11, 0.35)'
                : 'rgba(100, 116, 139, 0.15)';

    // Deviation from target
    const deltaCm = distanceM > 0 ? Math.round((distanceM - targetM) * 100) : null;
    const deltaSign = deltaCm !== null && deltaCm > 0 ? `+${deltaCm}cm` : `${deltaCm}cm`;

    // Status description
    const statusLabel = isOk
        ? 'DISTANCE OPTIMAL'
        : isClose
            ? 'TOO CLOSE — STEP BACK'
            : isFar
                ? 'TOO FAR — STEP CLOSER'
                : 'SEARCHING FOR SUBJECT';

    // Gauge geometry (0 to 2.0 meters scale)
    const minM = 0.4;
    const maxM = 1.8;
    const clampedM = Math.max(minM, Math.min(maxM, distanceM || targetM));
    const fillPct = ((clampedM - minM) / (maxM - minM)) * 100;
    const targetPct = ((targetM - minM) / (maxM - minM)) * 100;
    const zoneLeft = (((targetM - toleranceM) - minM) / (maxM - minM)) * 100;
    const zoneWidth = ((2 * toleranceM) / (maxM - minM)) * 100;

    return (
        <div className="w-full shrink-0 relative transition-all duration-300" style={{ zIndex: 50 }}>
            {/* Instrument-Grade Optical Telemetry Pod */}
            <div
                className="w-full px-4 py-2.5 rounded-2xl md:rounded-3xl border backdrop-blur-xl transition-all duration-500 shadow-xl flex flex-col md:flex-row items-center gap-3 md:gap-4 relative overflow-hidden"
                style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.82)',
                    borderColor: `${themeColor}45`,
                    boxShadow: `0 0 25px ${themeGlow}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`
                }}
            >
                {/* Background Tech Watermark */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-5 text-4xl font-mono font-black select-none tracking-widest text-white">
                    DISTANCE-AI
                </div>

                {/* Left: Distance Monospace Telemetry & Beacon */}
                <div className="flex items-center gap-3 shrink-0 self-stretch md:self-auto justify-between md:justify-start">
                    <div className="flex items-center gap-2.5">
                        {/* Radar Pulse Beacon */}
                        <div className="relative w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
                            style={{ backgroundColor: `${themeColor}15`, borderColor: `${themeColor}40` }}
                        >
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeColor, boxShadow: `0 0 10px ${themeColor}` }}></div>
                            <div
                                className="absolute inset-0 rounded-xl border animate-ping pointer-events-none opacity-40"
                                style={{ borderColor: themeColor }}
                            />
                        </div>

                        {/* Numeric Digits */}
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-1 leading-none">
                                <span className="text-2xl md:text-3xl font-black font-mono tracking-tight tabular-nums" style={{ color: themeColor }}>
                                    {distanceM > 0 ? distanceM.toFixed(2) : '—.—'}
                                </span>
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">m</span>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                Optical Range
                            </span>
                        </div>
                    </div>

                    {/* Delta Badge */}
                    {distanceM > 0 && (
                        <div
                            className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider border flex items-center gap-1.5"
                            style={{
                                backgroundColor: isOk ? 'rgba(16, 185, 129, 0.15)' : `${themeColor}20`,
                                borderColor: `${themeColor}50`,
                                color: themeColor
                            }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: themeColor }} />
                            <span>{isOk ? (Math.abs(deltaCm || 0) <= 2 ? 'PERFECT' : `Δ ${deltaSign}`) : `Δ ${deltaSign}`}</span>
                        </div>
                    )}
                </div>

                {/* Center: Precision Optical Caliper Rail */}
                <div className="flex-1 w-full relative flex flex-col justify-center py-1">
                    {/* Caliper Rail Track */}
                    <div className="relative w-full h-5 rounded-full bg-slate-950/80 border border-slate-700/60 overflow-hidden shadow-inner flex items-center">
                        {/* Target Tolerance Zone (Green Caliper Box) */}
                        <div
                            className="absolute top-0 h-full border-x transition-all duration-300 pointer-events-none"
                            style={{
                                left: `${zoneLeft}%`,
                                width: `${zoneWidth}%`,
                                backgroundColor: isOk ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.12)',
                                borderColor: 'rgba(52, 211, 153, 0.6)'
                            }}
                        >
                            {/* Inner hatching / laser pulse in target zone */}
                            <div className="w-full h-full opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:6px_6px]" />
                        </div>

                        {/* Filled Distance Vector Bar */}
                        <div
                            className="h-full rounded-full transition-all duration-300 ease-out pointer-events-none"
                            style={{
                                width: distanceM > 0 ? `${fillPct}%` : '0%',
                                background: `linear-gradient(90deg, ${themeColor}33, ${themeColor})`,
                                boxShadow: `0 0 12px ${themeColor}88`
                            }}
                        />

                        {/* Target Center Reference Wire (1.00m) */}
                        <div
                            className="absolute top-0 h-full w-[2px] bg-white z-10 pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                            style={{ left: `${targetPct}%`, transform: 'translateX(-50%)' }}
                        />

                        {/* Moving Reticle Crosshair Cursor */}
                        {distanceM > 0 && (
                            <div
                                className="absolute top-1/2 w-5 h-5 rounded-full border-2 border-white transition-all duration-300 ease-out flex items-center justify-center z-20 pointer-events-none"
                                style={{
                                    left: `${fillPct}%`,
                                    transform: 'translate(-50%, -50%)',
                                    backgroundColor: themeColor,
                                    boxShadow: `0 0 14px ${themeColor}`
                                }}
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            </div>
                        )}
                    </div>

                    {/* Scale Calibration Ticks */}
                    <div className="flex justify-between items-center text-[9px] font-mono font-bold text-slate-500 px-1 mt-1 select-none">
                        <span>0.6m</span>
                        <span className="text-slate-400">0.8m</span>
                        <span className="text-emerald-400 font-black">1.0m (TARGET)</span>
                        <span className="text-slate-400">1.2m</span>
                        <span>1.5m</span>
                    </div>
                </div>

                {/* Right: Live Telemetry Status Pill */}
                <div className="shrink-0 flex items-center gap-2">
                    <div
                        className="px-3.5 py-1.5 rounded-xl border text-[10px] md:text-xs font-mono font-black tracking-widest uppercase transition-all duration-300 flex items-center gap-2 shadow-sm"
                        style={{
                            backgroundColor: `${themeColor}18`,
                            borderColor: `${themeColor}50`,
                            color: themeColor
                        }}
                    >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor, boxShadow: `0 0 6px ${themeColor}` }}></span>
                        <span>{statusLabel}</span>
                    </div>
                </div>
            </div>

            {/* Emergency HUD Warning: Too Close */}
            {showPauseOverlay && isClose && (
                <div className="absolute inset-0 -bottom-4 flex items-center justify-center pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-6 py-2 bg-rose-600/95 backdrop-blur-md rounded-full border-2 border-rose-300 shadow-[0_0_40px_rgba(244,63,94,0.7)] flex items-center gap-3 animate-pulse">
                        <span className="text-lg">⚠️</span>
                        <span className="text-white font-black text-xs md:text-sm uppercase tracking-[0.25em]">
                            TEST PAUSED — STEP BACK TO {targetM.toFixed(2)}M
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DistanceBar;
