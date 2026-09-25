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
 * Compact AI Robot Assistant Bubble — small fit fonts,
 * clean non-intrusive sidebar badge for tests.
 */
const AIBotBubble: React.FC<Props> = ({ botState, isEyeUncovered = false, coverEye = 'left', isListening, transcript }) => {
  const { message, accuracy, correct, total, mood, streak } = botState;
  const [visible, setVisible] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (message) {
      setVisible(true);
      setAnimKey(message.id);
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const pct = total > 0 ? Math.round(accuracy * 100) : 100;
  const ringColor = isEyeUncovered ? '#ef4444' : pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const moodEmoji = isEyeUncovered ? '🚨' : mood === 'happy' ? '😎' : mood === 'neutral' ? '🤖' : mood === 'worried' ? '😟' : '⚠️';

  // Compact Ring SVG params
  const radius = 22;
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
    <div className="flex flex-col items-center gap-2 w-full max-w-[210px] mx-auto select-none pointer-events-none">
      {/* ─── Compact Speech Bubble ─── */}
      <div
        className="relative w-full"
        style={{
          minHeight: showBubble ? 36 : 0,
          opacity: showBubble ? 1 : 0,
          transform: showBubble ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.95)',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {displayMsg && (
          <div
            key={isEyeUncovered ? 'cover-warn' : animKey}
            className={`w-full rounded-xl px-2.5 py-1.5 border shadow-md ${isEyeUncovered ? 'animate-pulse' : ''}`}
            style={{
              background: isEyeUncovered ? 'rgba(127,29,29,0.92)' : 'var(--bg-card)',
              borderColor: (displayMsg.color || '#06b6d4') + '50',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base shrink-0">{displayMsg.emoji}</span>
              <p className="text-[11px] font-semibold leading-tight flex-1" style={{ color: isEyeUncovered ? '#ffffff' : (displayMsg.color && displayMsg.color !== '#06b6d4' ? displayMsg.color : 'var(--text-primary)') }}>
                {displayMsg.text}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Compact Robot Avatar + Progress Ring ─── */}
      <div className="relative flex items-center justify-center" style={{ width: 52, height: 52 }}>
        <div
          className={`absolute inset-0 rounded-full blur-md ${isEyeUncovered ? 'animate-ping' : 'animate-pulse'}`}
          style={{ background: glowColor, transform: 'scale(1.2)' }}
        />

        <svg width="52" height="52" className="absolute">
          <circle cx="26" cy="26" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          {isEyeUncovered ? (
            <circle cx="26" cy="26" r={radius} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 4"
              className="animate-spin" style={{ animationDuration: '3s' }} />
          ) : (
            <circle cx="26" cy="26" r={radius} fill="none" stroke={ringColor} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${strokeGap}`} strokeDashoffset={circumference * 0.25}
              className="transition-all duration-500" style={{ filter: `drop-shadow(0 0 4px ${ringColor})` }} />
          )}
        </svg>

        <div
          className="relative w-[42px] h-[42px] rounded-full flex items-center justify-center text-xl z-10"
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
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center z-20 shadow">
            <span className="text-[9px] font-black text-black">🔥</span>
          </div>
        )}
      </div>

      {/* ─── Compact Label & Mic Status ─── */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isEyeUncovered ? 'bg-red-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`} />
          <span className={`text-[9px] font-black uppercase tracking-wider ${isEyeUncovered ? 'text-red-400' : 'text-cyan-400'}`}>
            {isEyeUncovered ? 'COVER EYE' : 'AI COACH'}
          </span>
        </div>

        {/* Mic Status */}
        {isListening !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${isListening ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/40 border-white/5 text-slate-500'}`}>
            <span className={`text-[9px] ${isListening ? 'animate-pulse' : ''}`}>🎤</span>
            <span className="text-[8px] font-bold uppercase tracking-wider truncate max-w-[110px]">
              {isListening ? (transcript ? `"${transcript}"` : 'Listening') : 'Mic Off'}
            </span>
          </div>
        )}
      </div>

      {/* ─── Compact Stats ─── */}
      {total > 0 && !isEyeUncovered && (
        <div className="w-full glass rounded-lg border border-white/10 px-2 py-1 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: ringColor }} />
            <span className="text-[10px] font-black uppercase" style={{ color: ringColor }}>
              {pct}%
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            {correct}/{total}
          </span>
          {streak >= 2 && (
            <span className="text-[9px] font-bold text-amber-400">🔥{streak}</span>
          )}
        </div>
      )}

      {/* ─── Eye Cover Warning Card ─── */}
      {isEyeUncovered && (
        <div className="w-full glass rounded-lg border border-red-500/40 px-2 py-1 animate-pulse text-center">
          <span className="text-[9px] font-black text-red-400 uppercase tracking-wider">
            Cover {coverEye.toUpperCase()} Eye
          </span>
        </div>
      )}
    </div>
  );
};

export default AIBotBubble;
