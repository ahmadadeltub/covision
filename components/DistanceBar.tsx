
import React, { useEffect, useRef } from 'react';

interface Props {
    /** Distance in meters — from useFaceDistance hook */
    distanceM?: number;
    /** Status — from useFaceDistance hook */
    status?: 'ok' | 'too_close' | 'too_far' | 'no_face';
    /** Target distance in meters (default 2.0) */
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
    targetM = 2.0,
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

    // Colors
    const barColor = status === 'ok' ? '#10b981' : status === 'too_close' ? '#ef4444' : status === 'too_far' ? '#f59e0b' : '#6b7280';
    const barBg = status === 'ok' ? 'rgba(16,185,129,0.1)' : status === 'too_close' ? 'rgba(239,68,68,0.1)' : status === 'too_far' ? 'rgba(245,158,11,0.1)' : 'rgba(107,114,128,0.1)';

    const statusIcon = status === 'ok' ? '✅' : status === 'too_close' ? '🔴' : status === 'too_far' ? '🟡' : '⚫';
    const statusText = status === 'ok' ? 'DISTANCE OK' : status === 'too_close' ? 'TOO CLOSE — Move Back' : status === 'too_far' ? 'TOO FAR — Move Closer' : 'Looking for face…';

    const minM = 0;
    const maxM = 3;
    const fillPct = distanceM > 0 ? Math.min(((distanceM - minM) / (maxM - minM)) * 100, 100) : 0;
    const targetPct = ((targetM - minM) / (maxM - minM)) * 100;
    const zoneLeft = (((targetM - toleranceM) - minM) / (maxM - minM)) * 100;
    const zoneWidth = ((2 * toleranceM) / (maxM - minM)) * 100;

    return (
        <div className="w-full shrink-0 relative" style={{ zIndex: 50 }}>
            {/* Compact bar */}
            <div
                className="w-full px-4 py-2 rounded-2xl border flex items-center gap-3"
                style={{ background: barBg, borderColor: barColor + '40' }}
            >
                {/* Status icon */}
                <span className="text-lg shrink-0">{statusIcon}</span>

                {/* Distance number */}
                <div className="shrink-0 flex items-baseline gap-1">
                    <span className="text-2xl font-black tabular-nums" style={{ color: barColor }}>
                        {distanceM > 0 ? distanceM.toFixed(2) : '—'}
                    </span>
                    <span className="text-xs text-slate-500 font-bold">m</span>
                </div>

                {/* Bar */}
                <div className="flex-1 relative h-4 rounded-full bg-slate-800/60 border border-slate-700/30 overflow-hidden">
                    {/* Green zone */}
                    <div
                        className="absolute top-0 h-full bg-emerald-500/15 border-x border-emerald-400/30"
                        style={{ left: `${zoneLeft}%`, width: `${zoneWidth}%` }}
                    />
                    {/* Fill */}
                    <div
                        className="absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                            width: `${fillPct}%`,
                            background: `linear-gradient(90deg, ${barColor}66, ${barColor})`,
                        }}
                    />
                    {/* Target line */}
                    <div
                        className="absolute top-0 h-full w-0.5 bg-white/60"
                        style={{ left: `${targetPct}%` }}
                    />
                    {/* Position dot */}
                    {distanceM > 0 && (
                        <div
                            className="absolute top-1/2 w-3 h-3 rounded-full border-2 border-white transition-all duration-500 ease-out"
                            style={{
                                left: `${fillPct}%`,
                                transform: 'translate(-50%, -50%)',
                                background: barColor,
                                boxShadow: `0 0 8px ${barColor}`,
                            }}
                        />
                    )}
                </div>

                {/* Status text */}
                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest" style={{ color: barColor }}>
                    {statusText}
                </span>
            </div>

            {/* PAUSED overlay when too close */}
            {showPauseOverlay && status === 'too_close' && (
                <div className="absolute inset-0 -bottom-4 flex items-center justify-center pointer-events-none" style={{ zIndex: 51 }}>
                    <div className="px-6 py-2 bg-red-600/90 rounded-full border-2 border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse">
                        <span className="text-white font-black text-sm uppercase tracking-[0.3em]">⚠️ TEST PAUSED — STEP BACK TO {targetM}M</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DistanceBar;
