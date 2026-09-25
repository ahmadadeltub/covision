import React, { useEffect, useState } from 'react';
import { AIBotState } from '../hooks/useAIBot';

interface Props {
  botState: AIBotState;
  /** Whether the user's eye is uncovered (not properly covered) */
  isEyeUncovered?: boolean;
  /** Which eye should be covered: 'left' or 'right' */
  coverEye?: 'left' | 'right';
  /** Whether the microphone is actively listening */
  isListening?: boolean;
  /** What the microphone currently hears */
  transcript?: string;
}

/**
 * AI Robot Assistant Bubble — clean readable guidance instructions
 * for testing sidebars without blocking stimuli.
 */
const AIBotBubble: React.FC<Props> = ({ botState, isEyeUncovered = false, coverEye = 'left', isListening, transcript }) => {
  const { message, accuracy, correct, total, mood, streak } = botState;
  const [visible, setVisible] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (message) {
      setVisible(true);
      setAnimKey(message.id);
      const timer = setTimeout(() => setVisible(false), 5500);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const pct = total > 0 ? Math.round(accuracy * 100) : 100;
  const ringColor = isEyeUncovered ? '#ef4444' : pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const moodEmoji = isEyeUncovered ? '🚨' : mood === 'happy' ? '😎' : mood === 'neutral' ? '🤖' : mood === 'worried' ? '😟' : '⚠️';

  // Ring SVG params
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = isEyeUncovered ? 0 : circumference * accuracy;
  const strokeGap = circumference - strokeDash;

  const glowColor = isEyeUncovered ? 'rgba(239,68,68,0.35)' :
    mood === 'happy' ? 'rgba(16,185,129,0.3)' :
    mood === 'worried' ? 'rgba(245,158,11,0.3)' :
    mood === 'alert' ? 'rgba(239,68,68,0.3)' :
    'rgba(6,182,212,0.25)';

  const coverMsg = isEyeUncovered ? {
    text: `Cover ${coverEye.toUpperCase()} eye gently.`,
    emoji: '🤚',
    color: '#ef4444',
  } : null;

  const displayMsg = coverMsg || (visible && message ? message : null);
  const showBubble = !!displayMsg;

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-[260px] mx-auto select-none pointer-events-none">
      {/* ─── Speech Bubble with Increased Font ─── */}
      <div
        className="relative w-full"
        style={{
          minHeight: showBubble ? 44 : 0,
          opacity: showBubble ? 1 : 0,
          transform: showBubble ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.95)',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {displayMsg && (
          <div
            key={isEyeUncovered ? 'cover-warn' : animKey}
            className={`w-full rounded-2xl px-3.5 py-2.5 border shadow-lg ${isEyeUncovered ? 'animate-pulse' : ''}`}
            style={{
              background: isEyeUncovered ? 'rgba(127,29,29,0.95)' : 'var(--bg-card)',
              borderColor: (displayMsg.color || '#06b6d4') + '60',
              backdropFilter: 'blur(14px)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl shrink-0">{displayMsg.emoji}</span>
              <p className="text-xs sm:text-sm md:text-base font-bold leading-snug flex-1" style={{ color: isEyeUncovered ? '#ffffff' : (displayMsg.color && displayMsg.color !== '#06b6d4' ? displayMsg.color : 'var(--text-primary)') }}>
                {displayMsg.text}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Robot Avatar + Progress Ring ─── */}
      <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
        <div
          className={`absolute inset-0 rounded-full blur-md ${isEyeUncovered ? 'animate-ping' : 'animate-pulse'}`}
          style={{ background: glowColor, transform: 'scale(1.2)' }}
        />

        <svg width="56" height="56" className="absolute">
          <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          {isEyeUncovered ? (
            <circle cx="28" cy="28" r={radius} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 4"
              className="animate-spin" style={{ animationDuration: '3s' }} />
          ) : (
            <circle cx="28" cy="28" r={radius} fill="none" stroke={ringColor} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${strokeGap}`} strokeDashoffset={circumference * 0.25}
              className="transition-all duration-500" style={{ filter: `drop-shadow(0 0 5px ${ringColor})` }} />
          )}
        </svg>

        <div
          className="relative w-[46px] h-[46px] rounded-full flex items-center justify-center text-2xl z-10"
          style={{
            background: `linear-gradient(135deg, ${
              isEyeUncovered ? 'rgba(239,68,68,0.3)' :
              mood === 'happy' ? 'rgba(16,185,129,0.25)' :
              mood === 'worried' ? 'rgba(245,158,11,0.25)' :
              mood === 'alert' ? 'rgba(239,68,68,0.25)' :
              'rgba(6,182,212,0.25)'
            }, var(--bg-primary))`,
            border: `2px solid ${ringColor}60`,
            boxShadow: `0 2px 10px rgba(0,0,0,0.2)`,
          }}
        >
          {moodEmoji}
        </div>

        {streak >= 3 && !isEyeUncovered && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center z-20 shadow">
            <span className="text-xs font-black text-black">🔥</span>
          </div>
        )}
      </div>

      {/* ─── Label & Mic Status with Increased Font ─── */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isEyeUncovered ? 'bg-red-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`} />
          <span className={`text-xs sm:text-sm font-black uppercase tracking-wider ${isEyeUncovered ? 'text-red-400' : 'text-cyan-400'}`}>
            {isEyeUncovered ? 'COVER EYE' : 'AI COACH'}
          </span>
        </div>

        {/* Mic Status */}
        {isListening !== undefined && (
          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${isListening ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/50 border-white/10 text-slate-400'}`}>
            <span className={`text-xs ${isListening ? 'animate-pulse' : ''}`}>🎤</span>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate max-w-[130px]">
              {isListening ? (transcript ? `"${transcript}"` : 'Listening') : 'Mic Off'}
            </span>
          </div>
        )}
      </div>

      {/* ─── Stats Card ─── */}
      {total > 0 && !isEyeUncovered && (
        <div className="w-full glass rounded-xl border border-white/10 px-3 py-1.5 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: ringColor }} />
            <span className="text-xs sm:text-sm font-black uppercase" style={{ color: ringColor }}>
              {pct}%
            </span>
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-300">
            {correct}/{total}
          </span>
          {streak >= 2 && (
            <span className="text-xs font-bold text-amber-400">🔥{streak}</span>
          )}
        </div>
      )}

      {/* ─── Eye Cover Warning Card ─── */}
      {isEyeUncovered && (
        <div className="w-full glass rounded-xl border border-red-500/50 px-3 py-1.5 animate-pulse text-center bg-red-950/40">
          <span className="text-xs sm:text-sm font-black text-red-300 uppercase tracking-wider">
            Cover {coverEye.toUpperCase()} Eye
          </span>
        </div>
      )}
    </div>
  );
};

export default AIBotBubble;
