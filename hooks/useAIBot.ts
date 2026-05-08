import { useState, useCallback, useRef } from 'react';

/**
 * AI Robot Bot — real-time feedback about user test accuracy.
 *
 * Tracks correct/incorrect answers and generates contextual messages
 * with an emoji mood and color. Designed to feel like a cognitive
 * assistant giving encouragement, warnings, and clinical observations.
 */

export interface BotMessage {
  text: string;
  emoji: string;
  color: string; // tailwind-compatible hex
  id: number;
}

export interface AIBotState {
  /** Current bot message */
  message: BotMessage | null;
  /** Running accuracy 0-1 */
  accuracy: number;
  /** Total correct so far */
  correct: number;
  /** Total answered so far */
  total: number;
  /** Streak of consecutive correct answers */
  streak: number;
  /** Bot mood: 'happy' | 'neutral' | 'worried' | 'alert' */
  mood: 'happy' | 'neutral' | 'worried' | 'alert';
}

// ─── Message Banks ───

const EXCELLENT_MSGS = [
  { text: 'Perfect vision! Keep going 🎯', emoji: '🤩' },
  { text: 'Incredible accuracy! Your eyes are sharp', emoji: '🏆' },
  { text: 'Outstanding! Flawless so far', emoji: '⭐' },
  { text: 'Top-tier performance detected', emoji: '💎' },
  { text: 'Exceptional results — impressive!', emoji: '🚀' },
];

const GOOD_MSGS = [
  { text: 'Good job! Keep it up', emoji: '👍' },
  { text: 'You\'re doing well — stay focused', emoji: '🎯' },
  { text: 'Nice answer! Looking good', emoji: '✅' },
  { text: 'Solid performance so far', emoji: '💪' },
  { text: 'Great work — steady progress', emoji: '👏' },
];

const STREAK_MSGS = [
  { text: '🔥 {n} in a row! Amazing streak!', emoji: '🔥' },
  { text: 'Hot streak! {n} correct answers!', emoji: '⚡' },
  { text: '{n}-answer winning streak! On fire!', emoji: '🔥' },
];

const WRONG_MSGS = [
  { text: 'No worries — that one was tricky', emoji: '🤔' },
  { text: 'Don\'t stress — just focus on the next one', emoji: '😌' },
  { text: 'It happens! Take your time', emoji: '💭' },
  { text: 'Stay calm — one miss is normal', emoji: '🧘' },
];

const STRUGGLING_MSGS = [
  { text: 'This level is tough — take your time', emoji: '🧐' },
  { text: 'Multiple misses detected — stay relaxed', emoji: '😐' },
  { text: 'Difficulty increasing — focus on the center', emoji: '👁️' },
  { text: 'Hard level — blink and refocus', emoji: '💡' },
];

const LOW_ACCURACY_MSGS = [
  { text: 'Significant difficulty detected', emoji: '⚠️' },
  { text: 'Results suggest possible vision concern', emoji: '📋' },
  { text: 'Reduced accuracy — we\'ll note this', emoji: '📝' },
  { text: 'Don\'t worry — this helps us measure precisely', emoji: '🔬' },
];

const START_MSGS = [
  { text: 'Test starting — I\'ll monitor your accuracy', emoji: '🤖' },
  { text: 'AI Bot ready — let\'s begin!', emoji: '🤖' },
  { text: 'I\'m watching your performance in real-time', emoji: '🤖' },
];

const SWITCH_EYE_MSGS = [
  { text: 'Switching eyes — let\'s test the other one', emoji: '🔄' },
  { text: 'Great! Now let\'s check your other eye', emoji: '👁️' },
  { text: 'Eye switch — fresh measurements ahead', emoji: '🔄' },
];

const HALFWAY_MSGS = [
  { text: 'Halfway there! Current accuracy: {pct}%', emoji: '📊' },
  { text: 'Half done — you\'re at {pct}% accuracy', emoji: '📈' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function useAIBot() {
  const [state, setState] = useState<AIBotState>({
    message: null,
    accuracy: 1,
    correct: 0,
    total: 0,
    streak: 0,
    mood: 'neutral',
  });

  const msgId = useRef(0);
  const lastWrong = useRef(0);
  const halfwaySent = useRef(false);

  const pushMessage = useCallback((text: string, emoji: string, color: string) => {
    msgId.current++;
    setState(prev => ({
      ...prev,
      message: { text, emoji, color, id: msgId.current },
    }));
  }, []);

  /** Call when the test starts (or eye switches) */
  const botStart = useCallback(() => {
    halfwaySent.current = false;
    const m = pick(START_MSGS);
    pushMessage(m.text, m.emoji, '#06b6d4');
  }, [pushMessage]);

  /** Call when switching eyes */
  const botSwitchEye = useCallback((rightCorrect: number, rightTotal: number) => {
    halfwaySent.current = false;
    lastWrong.current = 0;
    const pct = rightTotal > 0 ? Math.round((rightCorrect / rightTotal) * 100) : 0;
    const m = pick(SWITCH_EYE_MSGS);
    pushMessage(`Right eye done: ${pct}% accuracy. ${m.text}`, m.emoji, '#8b5cf6');
  }, [pushMessage]);

  /** Call after each trial with correct/incorrect */
  const botRecordTrial = useCallback((isCorrect: boolean, trialIndex: number, trialsPerEye: number) => {
    setState(prev => {
      const newCorrect = prev.correct + (isCorrect ? 1 : 0);
      const newTotal = prev.total + 1;
      const newStreak = isCorrect ? prev.streak + 1 : 0;
      const newAccuracy = newTotal > 0 ? newCorrect / newTotal : 1;

      let mood: AIBotState['mood'] = 'neutral';
      if (newAccuracy >= 0.8) mood = 'happy';
      else if (newAccuracy >= 0.5) mood = 'neutral';
      else if (newAccuracy >= 0.3) mood = 'worried';
      else mood = 'alert';

      return { ...prev, correct: newCorrect, total: newTotal, streak: newStreak, accuracy: newAccuracy, mood };
    });

    // ── Decide which message to show ──
    const newTotal = state.total + 1;
    const newCorrect = state.correct + (isCorrect ? 1 : 0);
    const newStreak = isCorrect ? state.streak + 1 : 0;
    const pct = newTotal > 0 ? Math.round((newCorrect / newTotal) * 100) : 100;

    // Halfway checkpoint
    if (!halfwaySent.current && trialIndex >= Math.floor(trialsPerEye / 2) - 1 && trialIndex <= Math.floor(trialsPerEye / 2) + 1) {
      halfwaySent.current = true;
      const m = pick(HALFWAY_MSGS);
      pushMessage(m.text.replace('{pct}', String(pct)), m.emoji, '#6366f1');
      return;
    }

    if (isCorrect) {
      lastWrong.current = 0;

      // Streak celebration
      if (newStreak >= 5 && newStreak % 3 === 0) {
        const m = pick(STREAK_MSGS);
        pushMessage(m.text.replace('{n}', String(newStreak)), m.emoji, '#f59e0b');
        return;
      }
      if (newStreak === 3) {
        pushMessage('3 in a row! Nice streak 🔥', '🔥', '#f59e0b');
        return;
      }

      // High accuracy praise (don't spam — every 3rd correct)
      if (pct >= 90 && newTotal % 3 === 0) {
        const m = pick(EXCELLENT_MSGS);
        pushMessage(m.text, m.emoji, '#10b981');
        return;
      }

      // Occasional good feedback
      if (pct >= 60 && newTotal % 4 === 0) {
        const m = pick(GOOD_MSGS);
        pushMessage(m.text, m.emoji, '#10b981');
        return;
      }
    } else {
      lastWrong.current++;

      // Single miss — encouraging
      if (lastWrong.current === 1) {
        const m = pick(WRONG_MSGS);
        pushMessage(m.text, m.emoji, '#f59e0b');
        return;
      }

      // Multiple misses — more clinical
      if (lastWrong.current >= 2 && lastWrong.current <= 3) {
        const m = pick(STRUGGLING_MSGS);
        pushMessage(m.text, m.emoji, '#f97316');
        return;
      }

      // Low accuracy warning
      if (pct < 40 && lastWrong.current >= 3) {
        const m = pick(LOW_ACCURACY_MSGS);
        pushMessage(m.text, m.emoji, '#ef4444');
        return;
      }
    }
  }, [state, pushMessage]);

  /** Call when test is done */
  const botFinish = useCallback((finalCorrect: number, finalTotal: number) => {
    const pct = finalTotal > 0 ? Math.round((finalCorrect / finalTotal) * 100) : 0;
    let text: string, emoji: string, color: string;

    if (pct >= 90) {
      text = `Test complete! ${pct}% accuracy — Outstanding result!`;
      emoji = '🏆';
      color = '#10b981';
    } else if (pct >= 70) {
      text = `Test complete! ${pct}% accuracy — Good performance`;
      emoji = '✅';
      color = '#10b981';
    } else if (pct >= 50) {
      text = `Test complete. ${pct}% accuracy — Some concerns noted`;
      emoji = '📋';
      color = '#f59e0b';
    } else {
      text = `Test complete. ${pct}% accuracy — Results recorded for review`;
      emoji = '📝';
      color = '#ef4444';
    }

    pushMessage(text, emoji, color);
    setState(prev => ({ ...prev, mood: pct >= 70 ? 'happy' : pct >= 50 ? 'neutral' : 'worried' }));
  }, [pushMessage]);

  /** Reset for a new test */
  const botReset = useCallback(() => {
    msgId.current = 0;
    lastWrong.current = 0;
    halfwaySent.current = false;
    setState({ message: null, accuracy: 1, correct: 0, total: 0, streak: 0, mood: 'neutral' });
  }, []);

  return {
    botState: state,
    botStart,
    botSwitchEye,
    botRecordTrial,
    botFinish,
    botReset,
  };
}
