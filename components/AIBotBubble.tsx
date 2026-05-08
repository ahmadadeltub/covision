import React, { useEffect, useState } from 'react';
import { AIBotState } from '../hooks/useAIBot';

interface Props {
  botState: AIBotState;
  /** Whether the user's eye is uncovered (not properly covered) */
  isEyeUncovered?: boolean;
  /** Which eye should be covered: 'left' or 'right' */
  coverEye?: 'left' | 'right';
}

/**
 * Floating AI Robot Bot — shows real-time accuracy feedback
 * AND eye-cover coaching instructions. LARGE size for visibility.
 */
const AIBotBubble: React.FC<Props> = ({ botState, isEyeUncovered = false, coverEye = 'left' }) => {
  const { message, accuracy, correct, total, mood, streak } = botState;
  const [visible, setVisible] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (message) {
      setVisible(true);
      setAnimKey(message.id);
      const timer = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const pct = total > 0 ? Math.round(accuracy * 100) : 100;
  const ringColor = isEyeUncovered ? '#ef4444' : pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const moodEmoji = isEyeUncovered ? '🚨' : mood === 'happy' ? '😎' : mood === 'neutral' ? '🤖' : mood === 'worried' ? '😟' : '⚠️';

  // Ring SVG params — MASSIVE
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = isEyeUncovered ? 0 : circumference * accuracy;
  const strokeGap = circumference - strokeDash;

  const glowColor = isEyeUncovered ? 'rgba(239,68,68,0.5)' :
    mood === 'happy' ? 'rgba(16,185,129,0.5)' :
    mood === 'worried' ? 'rgba(245,158,11,0.5)' :
    mood === 'alert' ? 'rgba(239,68,68,0.5)' :
    'rgba(6,182,212,0.4)';

  const coverMsg = isEyeUncovered ? {
    text: `Cover your ${coverEye.toUpperCase()} eye! Use your hand gently — don't press on the eyelid.`,
    emoji: '🤚',
    color: '#ef4444',
  } : null;

  const displayMsg = coverMsg || (visible && message ? message : null);
  const showBubble = !!displayMsg;

  return (
    <div className="flex flex-col items-center gap-4 w-full" style={{ maxWidth: 300 }}>
      {/* ─── Speech Bubble — LARGE ─── */}
      <div
        className="relative w-full"
        style={{
          minHeight: 64,
          opacity: showBubble ? 1 : 0,
          transform: showBubble ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.9)',
          transition: 'all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: 'none',
        }}
      >
        {displayMsg && (
          <div
            key={isEyeUncovered ? 'cover-warn' : animKey}
            className={`w-full rounded-2xl px-5 py-5 border shadow-2xl ${isEyeUncovered ? 'animate-pulse' : ''}`}
            style={{
              background: isEyeUncovered ? 'rgba(127,29,29,0.95)' : 'var(--bg-card)',
              borderColor: (displayMsg.color || '#06b6d4') + '60',
              boxShadow: `0 8px 40px ${(displayMsg.color || '#06b6d4')}35`,
              backdropFilter: 'blur(16px)',
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-4xl shrink-0">{displayMsg.emoji}</span>
              <p className="text-base font-bold leading-relaxed" style={{ color: displayMsg.color || '#e2e8f0' }}>
                {displayMsg.text}
              </p>
            </div>
            {isEyeUncovered && (
              <div className="mt-3 flex items-center gap-2 pt-2.5 border-t border-red-500/30">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
                <span className="text-xs font-black text-red-300 uppercase tracking-wider">Test paused — cover eye to continue</span>
              </div>
            )}
          </div>
        )}
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rotate-45"
          style={{
            background: isEyeUncovered ? 'rgba(127,29,29,0.95)' : 'var(--bg-card)',
            borderRight: `1px solid ${(displayMsg?.color || '#06b6d4')}60`,
            borderBottom: `1px solid ${(displayMsg?.color || '#06b6d4')}60`,
          }}
        />
      </div>

      {/* ─── Robot Avatar + Ring — MASSIVE ─── */}
      <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
        <div
          className={`absolute inset-0 rounded-full blur-2xl ${isEyeUncovered ? 'animate-ping' : 'animate-pulse'}`}
          style={{ background: glowColor, transform: 'scale(1.8)' }}
        />

        <svg width="140" height="140" className="absolute">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
          {isEyeUncovered ? (
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" strokeDasharray="12 8"
              className="animate-spin" style={{ animationDuration: '3s', filter: 'drop-shadow(0 0 10px #ef4444)' }} />
          ) : (
            <circle cx="70" cy="70" r={radius} fill="none" stroke={ringColor} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${strokeGap}`} strokeDashoffset={circumference * 0.25}
              className="transition-all duration-700" style={{ filter: `drop-shadow(0 0 10px ${ringColor})` }} />
          )}
        </svg>

        <div
          className="relative w-[116px] h-[116px] rounded-full flex items-center justify-center text-[3.5rem] z-10"
          style={{
            background: `linear-gradient(135deg, ${
              isEyeUncovered ? 'rgba(239,68,68,0.3)' :
              mood === 'happy' ? 'rgba(16,185,129,0.25)' :
              mood === 'worried' ? 'rgba(245,158,11,0.25)' :
              mood === 'alert' ? 'rgba(239,68,68,0.25)' :
              'rgba(6,182,212,0.25)'
            }, var(--bg-primary))`,
            border: `4px solid ${ringColor}60`,
            boxShadow: `inset 0 -8px 20px rgba(0,0,0,0.3), 0 0 40px ${ringColor}25`,
          }}
        >
          {moodEmoji}
        </div>

        {streak >= 3 && !isEyeUncovered && (
          <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center z-20 shadow-lg shadow-amber-500/50 animate-bounce">
            <span className="text-base font-black text-black">🔥</span>
          </div>
        )}
      </div>

      {/* ─── Label ─── */}
      <div className="flex items-center gap-2.5">
        <div className={`w-3 h-3 rounded-full ${isEyeUncovered ? 'bg-red-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`} />
        <span className={`text-sm font-black uppercase tracking-[0.2em] ${isEyeUncovered ? 'text-red-400' : 'text-cyan-400'}`}>
          {isEyeUncovered ? 'COVER EYE!' : 'AI ASSISTANT'}
        </span>
      </div>

      {/* ─── Stats Card — LARGE ─── */}
      {total > 0 && !isEyeUncovered && (
        <div className="w-full glass rounded-2xl border border-white/10 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full" style={{ background: ringColor }} />
              <span className="text-base font-black uppercase tracking-wider" style={{ color: ringColor }}>
                {pct}%
              </span>
            </div>
            <span className="text-base font-bold text-slate-400">
              {correct}/{total}
            </span>
            {streak >= 2 && (
              <span className="text-base font-bold text-amber-400">🔥{streak}</span>
            )}
          </div>
          <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: ringColor }} />
          </div>
        </div>
      )}

      {/* ─── Eye Cover Card ─── */}
      {isEyeUncovered && (
        <div className="w-full glass rounded-2xl border-2 border-red-500/40 px-5 py-4 animate-pulse">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-2xl">👁️</span>
            <span className="text-sm font-black text-red-400 uppercase tracking-wider">Eye Cover Required</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🤚</span>
              <span className="text-sm text-slate-300">Cover your <span className="font-black text-white">{coverEye.toUpperCase()}</span> eye</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-lg">⚡</span>
              <span className="text-sm text-slate-300">Don't press on the eyelid</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-lg">✅</span>
              <span className="text-sm text-slate-300">Test resumes automatically</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIBotBubble;
