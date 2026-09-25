import React, { useEffect, useState, useRef } from 'react';
import { GlobalBotState } from '../hooks/useGlobalBot';
import { AppStep } from '../types';

interface Props {
  globalBotState: GlobalBotState;
}

/**
 * GlobalAIBot — floating AI assistant.
 * Note: HIDDEN during tests to ensure it NEVER shows on or obscures vision tests.
 * Shows prominent, readable AI guidance instructions on informational and calibration pages.
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
    distanceStatus === 'ok' ? 'PERFECT DISTANCE' :
    distanceStatus === 'too_close' ? 'TOO CLOSE — STEP BACK' :
    distanceStatus === 'too_far' ? 'TOO FAR — STEP CLOSER' : 'SEARCHING FOR FACE';

  const distIcon =
    distanceStatus === 'ok' ? '✅' :
    distanceStatus === 'too_close' ? '⬅️' :
    distanceStatus === 'too_far' ? '➡️' : '👤';

  // Ring params
  const radius = 26;
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
          : { bottom: 20, right: 20 }),
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMobile ? 'flex-start' : 'flex-end',
        gap: 8,
        pointerEvents: 'auto',
      }}
    >
      {/* ─── Speech Bubble with Large, Readable Guidance Instructions ─── */}
      <div
        style={{
          maxWidth: 380,
          opacity: showBubble ? 1 : 0,
          transform: showBubble ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.92)',
          transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: showBubble ? 'auto' : 'none',
        }}
      >
        {message && (
          <div
            key={animKey}
            className="rounded-3xl px-5 py-4 border shadow-2xl relative"
            style={{
              background: 'var(--bg-card)',
              borderColor: (message.color || '#06b6d4') + '60',
              boxShadow: `0 12px 40px ${(message.color || '#06b6d4')}30, 0 4px 16px rgba(0,0,0,0.3)`,
              backdropFilter: 'blur(16px)',
            }}
          >
            <div className="flex items-start gap-3.5">
              <span className="text-3xl shrink-0 mt-0.5">{message.emoji}</span>
              <div className="flex-1 min-w-0">
                {/* AI Guidance Instruction Heading */}
                <span className="text-[11px] font-black uppercase tracking-widest block mb-1" style={{ color: message.color || '#06b6d4' }}>
                  AI Guidance Instruction
                </span>
                {/* Increased Font Size for Guidance Text */}
                <p className="text-sm sm:text-base md:text-lg font-bold leading-relaxed" style={{ color: message.color || 'var(--text-primary)' }}>
                  {message.text}
                </p>
                {totalTips > 0 && tipIndex >= 0 && !isDistanceActive && (
                  <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-white/10">
                    <div className="flex gap-1.5">
                      {Array.from({ length: totalTips }).map((_, i) => (
                        <div
                          key={i}
                          className="w-2 h-2 rounded-full transition-all duration-300"
                          style={{
                            background: i <= tipIndex ? ringColor : 'rgba(255,255,255,0.2)',
                            boxShadow: i <= tipIndex ? `0 0 5px ${ringColor}` : 'none',
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-400 font-bold ml-auto">
                      Tip {tipIndex + 1} of {totalTips}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {/* Arrow pointing down-right */}
            <div
              className="absolute -bottom-2 right-7 w-4 h-4 rotate-45"
              style={{
                background: 'var(--bg-card)',
                borderRight: `1px solid ${(message.color || '#06b6d4')}60`,
                borderBottom: `1px solid ${(message.color || '#06b6d4')}60`,
              }}
            />
          </div>
        )}
      </div>

      {/* ─── Live Distance Bar with Increased Guidance Font ─── */}
      {isDistanceActive && expanded && (
        <div
          className="rounded-2xl border shadow-xl overflow-hidden"
          style={{
            width: 250,
            background: 'var(--bg-card)',
            borderColor: distBarColor + '50',
            backdropFilter: 'blur(16px)',
            boxShadow: `0 6px 25px ${distBarColor}25`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1">
            <div className="flex items-center gap-2">
              <span className="text-base">{distIcon}</span>
              <span className="text-xs font-black uppercase tracking-wider" style={{ color: distBarColor }}>
                {distLabel}
              </span>
            </div>
            <span className="text-sm font-black tabular-nums" style={{ color: distBarColor }}>
              {distanceM > 0 ? `${distanceM.toFixed(2)}m` : '—'}
            </span>
          </div>

          {/* Visual distance bar */}
          <div className="px-3.5 pb-2">
            <div className="relative w-full h-3.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="absolute h-full rounded-full opacity-25"
                style={{
                  left: '35%',
                  width: '30%',
                  background: '#10b981',
                }}
              />
              <div
                className="absolute top-0 h-full w-2 rounded-full transition-all duration-300"
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

      {/* ─── Robot Avatar (Clickable to toggle) ─── */}
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded && message) {
            setBubbleVisible(true);
          }
        }}
        className="relative group flex items-center gap-2.5 cursor-pointer"
        style={{
          background: 'none',
          border: 'none',
          outline: 'none',
          padding: 0,
        }}
        title={expanded ? 'Minimize AI Guide' : 'Expand AI Guide'}
      >
        <div className="relative" style={{ width: 58, height: 58 }}>
          {/* Subtle Glow */}
          <div
            className={`absolute inset-0 rounded-full blur-xl ${isAlert ? 'animate-ping' : 'animate-pulse'}`}
            style={{ background: glowColor, transform: 'scale(1.25)' }}
          />

          {/* Progress Ring */}
          <svg width="58" height="58" className="absolute inset-0">
            <circle cx="29" cy="29" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
            <circle
              cx="29" cy="29" r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="3.5"
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
              width: 46,
              height: 46,
              fontSize: '1.6rem',
              background: `linear-gradient(135deg, ${glowColor}, var(--bg-primary))`,
              border: `2px solid ${ringColor}60`,
              boxShadow: `0 4px 15px rgba(0,0,0,0.3)`,
            }}
          >
            {moodEmoji}
          </div>

          {/* Small Active Dot */}
          <div
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: isDistanceActive ? distBarColor : ringColor, boxShadow: `0 0 8px ${isDistanceActive ? distBarColor : ringColor}` }}
          >
            <div className="w-2 h-2 rounded-full bg-white animate-ping" />
          </div>
        </div>

        {/* Larger Prominent Badge */}
        <div className="px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 flex items-center gap-2 shadow-lg">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: isDistanceActive ? distBarColor : ringColor }} />
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider" style={{ color: isDistanceActive ? distBarColor : ringColor }}>
            {isDistanceActive ? (distanceStatus === 'ok' ? 'IN RANGE' : 'DISTANCE') : 'AI Guide'}
          </span>
        </div>
      </button>
    </div>
  );
};

export default GlobalAIBot;
