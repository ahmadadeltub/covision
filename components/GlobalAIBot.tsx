import React, { useEffect, useState, useRef } from 'react';
import { GlobalBotState } from '../hooks/useGlobalBot';

interface Props {
  globalBotState: GlobalBotState;
}

/**
 * GlobalAIBot — persistent floating AI assistant visible on EVERY page.
 * Fixed bottom-right corner. Shows page-contextual guidance & tips.
 * Includes live distance bar during calibration/testing.
 * Collapsible via click on robot face.
 */
const GlobalAIBot: React.FC<Props> = ({ globalBotState }) => {
  const { message, mood, step, tipIndex, totalTips, distanceM, distanceStatus, isDistanceActive } = globalBotState;
  const [expanded, setExpanded] = useState(true);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const prevMsgRef = useRef<number | null>(null);

  // Show bubble when new message arrives
  useEffect(() => {
    if (message && message.id !== prevMsgRef.current) {
      prevMsgRef.current = message.id;
      setBubbleVisible(true);
      setAnimKey(message.id);
      setExpanded(true);
      const timer = setTimeout(() => setBubbleVisible(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [message]);

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
    isAlert ? 'rgba(239,68,68,0.5)' :
    mood === 'happy' ? 'rgba(16,185,129,0.4)' :
    mood === 'celebrate' ? 'rgba(245,158,11,0.4)' :
    mood === 'guide' ? 'rgba(139,92,246,0.4)' :
    'rgba(6,182,212,0.4)';

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

  // Ring params — BIG
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const tipProgress = totalTips > 0 ? (tipIndex + 1) / totalTips : 1;
  // When distance active, use ring to show distance compliance instead of tip progress
  const ringProgress = isDistanceActive
    ? (distanceStatus === 'ok' ? 1 : distanceStatus === 'too_close' || distanceStatus === 'too_far' ? 0.35 : 0.1)
    : tipProgress;
  const strokeDash = circumference * ringProgress;
  const strokeGap = circumference - strokeDash;

  const showBubble = expanded && bubbleVisible && message;

  return (
    <div
      className="fixed z-[9999] no-print"
      style={{
        bottom: window.innerWidth <= 768 ? 8 : 24,
        right: window.innerWidth <= 768 ? 8 : 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: window.innerWidth <= 768 ? 6 : 12,
        pointerEvents: 'auto',
        transform: window.innerWidth <= 768 ? 'scale(0.55)' : 'scale(1)',
        transformOrigin: 'bottom right',
      }}
    >
      {/* ─── Speech Bubble ─── */}
      <div
        style={{
          maxWidth: 400,
          opacity: showBubble ? 1 : 0,
          transform: showBubble ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.85)',
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: showBubble ? 'auto' : 'none',
        }}
      >
        {message && (
          <div
            key={animKey}
            className="rounded-3xl px-6 py-5 border shadow-2xl"
            style={{
              background: 'var(--bg-card)',
              borderColor: (message.color || '#06b6d4') + '50',
              boxShadow: `0 12px 50px ${(message.color || '#06b6d4')}30, 0 4px 20px rgba(0,0,0,0.3)`,
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-start gap-4">
              <span className="text-4xl shrink-0 mt-0.5">{message.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold leading-relaxed" style={{ color: message.color || 'var(--text-primary)' }}>
                  {message.text}
                </p>
                {totalTips > 0 && tipIndex >= 0 && !isDistanceActive && (
                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/10">
                    <div className="flex gap-1.5">
                      {Array.from({ length: totalTips }).map((_, i) => (
                        <div
                          key={i}
                          className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                          style={{
                            background: i <= tipIndex ? ringColor : 'rgba(255,255,255,0.15)',
                            boxShadow: i <= tipIndex ? `0 0 6px ${ringColor}` : 'none',
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-500 font-bold ml-auto">
                      Tip {tipIndex + 1}/{totalTips}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {/* Arrow pointing down-right */}
            <div
              className="absolute -bottom-2.5 right-8 w-5 h-5 rotate-45"
              style={{
                background: 'var(--bg-card)',
                borderRight: `1px solid ${(message.color || '#06b6d4')}50`,
                borderBottom: `1px solid ${(message.color || '#06b6d4')}50`,
              }}
            />
          </div>
        )}
      </div>

      {/* ─── Live Distance Bar (only during calibration/testing) ─── */}
      {isDistanceActive && expanded && (
        <div
          className="w-full rounded-2xl border shadow-xl overflow-hidden"
          style={{
            width: 260,
            background: 'var(--bg-card)',
            borderColor: distBarColor + '40',
            backdropFilter: 'blur(16px)',
            boxShadow: `0 4px 30px ${distBarColor}20`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">{distIcon}</span>
              <span className="text-xs font-black uppercase tracking-[0.15em]" style={{ color: distBarColor }}>
                {distLabel}
              </span>
            </div>
            <span className="text-lg font-black tabular-nums" style={{ color: distBarColor }}>
              {distanceM > 0 ? `${distanceM.toFixed(2)}m` : '—'}
            </span>
          </div>

          {/* Visual distance bar */}
          <div className="px-4 pb-2">
            <div className="relative w-full h-5 bg-white/5 rounded-full overflow-hidden">
              {/* Target zone indicator */}
              <div
                className="absolute h-full rounded-full opacity-15"
                style={{
                  left: '35%',
                  width: '30%',
                  background: '#10b981',
                }}
              />
              {/* Animated position marker */}
              <div
                className="absolute top-0 h-full w-2 rounded-full transition-all duration-300"
                style={{
                  left: `${Math.min(95, Math.max(5, (distanceM / 3) * 100))}%`,
                  background: distBarColor,
                  boxShadow: `0 0 12px ${distBarColor}, 0 0 4px ${distBarColor}`,
                }}
              />
              {/* Fill bar */}
              <div
                className={`h-full rounded-full transition-all duration-500 ${distanceStatus !== 'ok' ? 'animate-pulse' : ''}`}
                style={{
                  width: distanceStatus === 'ok' ? '100%' : distanceStatus === 'too_close' ? '30%' : distanceStatus === 'too_far' ? '70%' : '10%',
                  background: `linear-gradient(90deg, ${distBarColor}40, ${distBarColor}90)`,
                }}
              />
            </div>
          </div>

          {/* Direction hint */}
          <div className="flex items-center justify-center gap-2 pb-3 pt-0.5">
            {distanceStatus === 'too_close' && (
              <>
                <span className="text-lg animate-bounce">⬅️</span>
                <span className="text-xs font-bold text-red-400">Step backward</span>
                <span className="text-lg animate-bounce">⬅️</span>
              </>
            )}
            {distanceStatus === 'too_far' && (
              <>
                <span className="text-lg animate-bounce">➡️</span>
                <span className="text-xs font-bold text-amber-400">Step forward</span>
                <span className="text-lg animate-bounce">➡️</span>
              </>
            )}
            {distanceStatus === 'ok' && (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-emerald-400">Hold steady — perfect!</span>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </>
            )}
            {distanceStatus === 'no_face' && (
              <>
                <span className="text-lg">📸</span>
                <span className="text-xs font-bold text-slate-400">Face the camera</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Robot Avatar (clickable to toggle) ─── */}
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded && message) {
            setBubbleVisible(true);
          }
        }}
        className="relative group"
        style={{
          width: 152,
          height: 152,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          outline: 'none',
          padding: 0,
        }}
        title={expanded ? 'Click to minimize assistant' : 'Click to expand assistant'}
      >
        {/* Outer glow */}
        <div
          className={`absolute inset-0 rounded-full blur-3xl ${isAlert ? 'animate-ping' : 'animate-pulse'}`}
          style={{ background: glowColor, transform: 'scale(1.6)' }}
        />

        {/* SVG progress ring */}
        <svg width="152" height="152" className="absolute inset-0">
          <circle cx="76" cy="76" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          {isAlert && isDistanceActive ? (
            <circle
              cx="76" cy="76" r={radius}
              fill="none"
              stroke={distBarColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="14 10"
              className="animate-spin"
              style={{ animationDuration: '4s', filter: `drop-shadow(0 0 10px ${distBarColor})` }}
            />
          ) : (
            <circle
              cx="76" cy="76" r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${strokeGap}`}
              strokeDashoffset={circumference * 0.25}
              className="transition-all duration-1000"
              style={{ filter: `drop-shadow(0 0 8px ${ringColor})` }}
            />
          )}
        </svg>

        {/* Bot face */}
        <div
          className={`absolute inset-0 m-auto rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-105 ${isAlert ? 'animate-pulse' : ''}`}
          style={{
            width: 130,
            height: 130,
            fontSize: '4rem',
            background: `linear-gradient(135deg, ${glowColor}, var(--bg-primary))`,
            border: `4px solid ${ringColor}60`,
            boxShadow: `inset 0 -10px 24px rgba(0,0,0,0.3), 0 0 50px ${ringColor}30, 0 10px 40px rgba(0,0,0,0.4)`,
          }}
        >
          {moodEmoji}
        </div>

        {/* Pulsing dot - indicates active */}
        <div
          className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: isDistanceActive ? distBarColor : ringColor, boxShadow: `0 0 14px ${isDistanceActive ? distBarColor : ringColor}` }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
        </div>
      </button>

      {/* ─── Label ─── */}
      <div className="flex items-center gap-2.5 mr-4">
        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: isDistanceActive ? distBarColor : ringColor }} />
        <span className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: isDistanceActive ? distBarColor : ringColor }}>
          {isDistanceActive ? (distanceStatus === 'ok' ? '✓ IN RANGE' : 'DISTANCE') : 'AI Guide'}
        </span>
      </div>
    </div>
  );
};

export default GlobalAIBot;
