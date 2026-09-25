import React, { useEffect, useState, useRef } from 'react';
import { GlobalBotState } from '../hooks/useGlobalBot';
import { AppStep } from '../types';

interface Props {
  globalBotState: GlobalBotState;
}

/**
 * GlobalAIBot — floating AI assistant.
 * Note: HIDDEN during tests to ensure it NEVER shows on or obscures vision tests.
 * Compact, small-font guidance widget for informational pages.
 */
const GlobalAIBot: React.FC<Props> = ({ globalBotState }) => {
  const { message, mood, step, tipIndex, totalTips, distanceM, distanceStatus, isDistanceActive } = globalBotState;
  const [expanded, setExpanded] = useState(true);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const prevMsgRef = useRef<number | null>(null);

  // Explicit requirement: Do NOT show on tests
  const isTestingStep = 
    step === AppStep.Testing || 
    step === AppStep.ColorTest || 
    (typeof step === 'string' && (step.toLowerCase().includes('test') || step.toLowerCase().includes('acuity')));

  // Show bubble when new message arrives
  useEffect(() => {
    if (message && message.id !== prevMsgRef.current) {
      prevMsgRef.current = message.id;
      setBubbleVisible(true);
      setAnimKey(message.id);
      setExpanded(true);
      const timer = setTimeout(() => setBubbleVisible(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (isTestingStep) {
    return null;
  }

  const isAlert = mood === 'alert';
  const moodEmoji =
    isAlert ? (distanceStatus === 'too_close' ? '😰' : distanceStatus === 'too_far' ? '🔭' : distanceStatus === 'no_face' ? '👻' : '⚠️') :
    mood === 'happy' ? '😊' : mood === 'celebrate' ? '🎉' : mood === 'guide' ? '🤖' : '🧠';

  const ringColor =
    isAlert ? '#ef4444' :
    mood === 'happy' ? '#10b981' :
    mood === 'celebrate' ? '#f59e0b' :
    mood === 'guide' ? '#8b5cf6' :
    '#06b6d4';

  const glowColor =
    isAlert ? 'rgba(239,68,68,0.35)' :
    mood === 'happy' ? 'rgba(16,185,129,0.3)' :
    mood === 'celebrate' ? 'rgba(245,158,11,0.3)' :
    mood === 'guide' ? 'rgba(139,92,246,0.3)' :
    'rgba(6,182,212,0.3)';

  // Distance bar colors
  const distBarColor =
    distanceStatus === 'ok' ? '#10b981' :
    distanceStatus === 'too_close' ? '#ef4444' :
    distanceStatus === 'too_far' ? '#f59e0b' : '#64748b';

  const distLabel =
    distanceStatus === 'ok' ? 'PERFECT' :
    distanceStatus === 'too_close' ? 'TOO CLOSE' :
    distanceStatus === 'too_far' ? 'TOO FAR' : 'NO FACE';

  const distIcon =
    distanceStatus === 'ok' ? '✅' :
    distanceStatus === 'too_close' ? '⬅️' :
    distanceStatus === 'too_far' ? '➡️' : '👤';

  // Compact Ring params
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const tipProgress = totalTips > 0 ? (tipIndex + 1) / totalTips : 1;
  const ringProgress = isDistanceActive
    ? (distanceStatus === 'ok' ? 1 : distanceStatus === 'too_close' || distanceStatus === 'too_far' ? 0.35 : 0.1)
    : tipProgress;
  const strokeDash = circumference * ringProgress;
  const strokeGap = circumference - strokeDash;

  const showBubble = expanded && bubbleVisible && message;
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <div
      className="fixed z-[9999] no-print"
      style={{
        ...(isMobile
          ? { top: 12, left: 12 }
          : { bottom: 16, right: 16 }),
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMobile ? 'flex-start' : 'flex-end',
        gap: 6,
        pointerEvents: 'auto',
      }}
    >
      {/* ─── Compact Speech Bubble with Small Fit Fonts ─── */}
      <div
        style={{
          maxWidth: 280,
          opacity: showBubble ? 1 : 0,
          transform: showBubble ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.92)',
          transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: showBubble ? 'auto' : 'none',
        }}
      >
        {message && (
          <div
            key={animKey}
            className="rounded-2xl px-3.5 py-2.5 border shadow-xl relative"
            style={{
              background: 'var(--bg-card)',
              borderColor: (message.color || '#06b6d4') + '50',
              boxShadow: `0 8px 30px ${(message.color || '#06b6d4')}25, 0 4px 12px rgba(0,0,0,0.25)`,
              backdropFilter: 'blur(16px)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-xl shrink-0 mt-0.5">{message.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-[13px] font-semibold leading-snug" style={{ color: message.color || 'var(--text-primary)' }}>
                  {message.text}
                </p>
                {totalTips > 0 && tipIndex >= 0 && !isDistanceActive && (
                  <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-white/10">
                    <div className="flex gap-1">
                      {Array.from({ length: totalTips }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                          style={{
                            background: i <= tipIndex ? ringColor : 'rgba(255,255,255,0.2)',
                            boxShadow: i <= tipIndex ? `0 0 4px ${ringColor}` : 'none',
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold ml-auto">
                      Tip {tipIndex + 1}/{totalTips}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {/* Small Arrow pointing down-right */}
            <div
              className="absolute -bottom-1.5 right-6 w-3 h-3 rotate-45"
              style={{
                background: 'var(--bg-card)',
                borderRight: `1px solid ${(message.color || '#06b6d4')}50`,
                borderBottom: `1px solid ${(message.color || '#06b6d4')}50`,
              }}
            />
          </div>
        )}
      </div>

      {/* ─── Live Distance Bar (Compact) ─── */}
      {isDistanceActive && expanded && (
        <div
          className="rounded-xl border shadow-lg overflow-hidden"
          style={{
            width: 210,
            background: 'var(--bg-card)',
            borderColor: distBarColor + '40',
            backdropFilter: 'blur(16px)',
            boxShadow: `0 4px 20px ${distBarColor}20`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{distIcon}</span>
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: distBarColor }}>
                {distLabel}
              </span>
            </div>
            <span className="text-xs font-black tabular-nums" style={{ color: distBarColor }}>
              {distanceM > 0 ? `${distanceM.toFixed(2)}m` : '—'}
            </span>
          </div>

          {/* Visual distance bar */}
          <div className="px-3 pb-1.5">
            <div className="relative w-full h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className="absolute h-full rounded-full opacity-20"
                style={{
                  left: '35%',
                  width: '30%',
                  background: '#10b981',
                }}
              />
              <div
                className="absolute top-0 h-full w-1.5 rounded-full transition-all duration-300"
                style={{
                  left: `${Math.min(95, Math.max(5, (distanceM / 3) * 100))}%`,
                  background: distBarColor,
                  boxShadow: `0 0 8px ${distBarColor}`,
                }}
              />
              <div
                className={`h-full rounded-full transition-all duration-500 ${distanceStatus !== 'ok' ? 'animate-pulse' : ''}`}
                style={{
                  width: distanceStatus === 'ok' ? '100%' : distanceStatus === 'too_close' ? '30%' : distanceStatus === 'too_far' ? '70%' : '10%',
                  background: `linear-gradient(90deg, ${distBarColor}40, ${distBarColor}90)`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Compact Robot Avatar (Clickable to toggle) ─── */}
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded && message) {
            setBubbleVisible(true);
          }
        }}
        className="relative group flex items-center gap-2 cursor-pointer"
        style={{
          background: 'none',
          border: 'none',
          outline: 'none',
          padding: 0,
        }}
        title={expanded ? 'Minimize AI Guide' : 'Expand AI Guide'}
      >
        <div className="relative" style={{ width: 54, height: 54 }}>
          {/* Subtle Glow */}
          <div
            className={`absolute inset-0 rounded-full blur-xl ${isAlert ? 'animate-ping' : 'animate-pulse'}`}
            style={{ background: glowColor, transform: 'scale(1.2)' }}
          />

          {/* Progress Ring */}
          <svg width="54" height="54" className="absolute inset-0">
            <circle cx="27" cy="27" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <circle
              cx="27" cy="27" r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${strokeGap}`}
              strokeDashoffset={circumference * 0.25}
              className="transition-all duration-700"
              style={{ filter: `drop-shadow(0 0 6px ${ringColor})` }}
            />
          </svg>

          {/* Bot face */}
          <div
            className="absolute inset-0 m-auto rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
            style={{
              width: 44,
              height: 44,
              fontSize: '1.5rem',
              background: `linear-gradient(135deg, ${glowColor}, var(--bg-primary))`,
              border: `2px solid ${ringColor}60`,
              boxShadow: `0 4px 15px rgba(0,0,0,0.3)`,
            }}
          >
            {moodEmoji}
          </div>

          {/* Small Active Dot */}
          <div
            className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
            style={{ background: isDistanceActive ? distBarColor : ringColor, boxShadow: `0 0 8px ${isDistanceActive ? distBarColor : ringColor}` }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          </div>
        </div>

        {/* Small Discreet Badge */}
        <div className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: isDistanceActive ? distBarColor : ringColor }} />
          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: isDistanceActive ? distBarColor : ringColor }}>
            {isDistanceActive ? (distanceStatus === 'ok' ? 'IN RANGE' : 'DISTANCE') : 'AI Guide'}
          </span>
        </div>
      </button>
    </div>
  );
};

export default GlobalAIBot;
