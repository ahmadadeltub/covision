import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TestResult, CalibrationData } from '../../types';

import { useAIBot } from '../../hooks/useAIBot';
import AIBotBubble from '../AIBotBubble';

interface Props {
  calibration: CalibrationData;
  t: any;
  stream?: MediaStream | null;
  onFinish: (result: TestResult) => void;
}

// ─── Trial Types ───
type TrialType = 'letter' | 'tumbling-e' | 'landolt-c';
type Direction = 'up' | 'down' | 'left' | 'right';
const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

const ALL_LETTERS = ['C', 'D', 'E', 'F', 'L', 'O', 'P', 'T', 'Z'];

// ─── Row-to-Snellen lookup (for acuity calculation) ───
const ROW_TO_SNELLEN = [
  { label: '20/200', denom: 200 },
  { label: '20/100', denom: 100 },
  { label: '20/70',  denom: 70 },
  { label: '20/50',  denom: 50 },
  { label: '20/40',  denom: 40 },
  { label: '20/30',  denom: 30 },
  { label: '20/25',  denom: 25 },
  { label: '20/20',  denom: 20 },
  { label: '20/15',  denom: 15 },
  { label: '20/13',  denom: 13 },
  { label: '20/10',  denom: 10 },
];

// ─── 15 Letter samples — decreasing size + decreasing opacity (transparency) ───
const LETTER_SAMPLES = [
  { sizePx: 320, opacity: 1.00, rowMap: 0 },   //  1. Full visibility, extra large
  { sizePx: 260, opacity: 0.92, rowMap: 1 },   //  2.
  { sizePx: 210, opacity: 0.85, rowMap: 2 },   //  3.
  { sizePx: 175, opacity: 0.78, rowMap: 3 },   //  4.
  { sizePx: 145, opacity: 0.70, rowMap: 4 },   //  5.
  { sizePx: 120, opacity: 0.62, rowMap: 5 },   //  6.
  { sizePx: 100, opacity: 0.54, rowMap: 5 },   //  7. Medium
  { sizePx: 82,  opacity: 0.46, rowMap: 6 },   //  8.
  { sizePx: 68,  opacity: 0.38, rowMap: 7 },   //  9.
  { sizePx: 55,  opacity: 0.30, rowMap: 7 },   // 10.
  { sizePx: 44,  opacity: 0.24, rowMap: 8 },   // 11.
  { sizePx: 35,  opacity: 0.20, rowMap: 8 },   // 12.
  { sizePx: 26,  opacity: 0.16, rowMap: 9 },   // 13. Small + faint
  { sizePx: 20,  opacity: 0.12, rowMap: 9 },   // 14.
  { sizePx: 16,  opacity: 0.08, rowMap: 10 },  // 15. Tiny + nearly invisible
];

// ─── 15 Tumbling E samples — each a unique random size (big → small) ───
const TUMBLING_E_SIZES = [
  { sizePx: 320, rowMap: 0 },   //  1. Extra large
  { sizePx: 280, rowMap: 0 },   //  2. Very large
  { sizePx: 240, rowMap: 1 },   //  3. Large
  { sizePx: 200, rowMap: 2 },   //  4.
  { sizePx: 170, rowMap: 3 },   //  5.
  { sizePx: 145, rowMap: 4 },   //  6.
  { sizePx: 120, rowMap: 5 },   //  7. Medium-large
  { sizePx: 100, rowMap: 5 },   //  8. Medium
  { sizePx: 82,  rowMap: 6 },   //  9.
  { sizePx: 68,  rowMap: 7 },   // 10.
  { sizePx: 55,  rowMap: 7 },   // 11. Medium-small
  { sizePx: 44,  rowMap: 8 },   // 12.
  { sizePx: 34,  rowMap: 9 },   // 13. Small
  { sizePx: 24,  rowMap: 9 },   // 14. Very small
  { sizePx: 16,  rowMap: 10 },  // 15. Tiny
];

// ─── 15 Landolt C samples — each a unique random size (big → small) ───
const LANDOLT_C_SIZES = [
  { sizePx: 300, rowMap: 0 },   //  1. Extra large
  { sizePx: 260, rowMap: 1 },   //  2. Very large
  { sizePx: 220, rowMap: 2 },   //  3. Large
  { sizePx: 190, rowMap: 2 },   //  4.
  { sizePx: 160, rowMap: 3 },   //  5.
  { sizePx: 135, rowMap: 4 },   //  6.
  { sizePx: 110, rowMap: 5 },   //  7. Medium-large
  { sizePx: 92,  rowMap: 5 },   //  8. Medium
  { sizePx: 76,  rowMap: 6 },   //  9.
  { sizePx: 62,  rowMap: 7 },   // 10.
  { sizePx: 50,  rowMap: 7 },   // 11. Medium-small
  { sizePx: 40,  rowMap: 8 },   // 12.
  { sizePx: 30,  rowMap: 9 },   // 13. Small
  { sizePx: 22,  rowMap: 9 },   // 14. Very small
  { sizePx: 14,  rowMap: 10 },  // 15. Tiny
];

interface Trial {
  type: TrialType;
  sizePx: number;
  rowIndex: number;
  letter?: string;
  direction?: Direction;
  label?: string;
  denom?: number;
  opacity?: number;
}

function buildTrialSequence(): Trial[] {
  const trials: Trial[] = [];

  // Letter trials with varying size and transparency (15 total)
  LETTER_SAMPLES.forEach((sample) => {
    const letter = ALL_LETTERS[Math.floor(Math.random() * ALL_LETTERS.length)];
    trials.push({
      type: 'letter', sizePx: sample.sizePx, rowIndex: sample.rowMap,
      letter, opacity: sample.opacity,
      label: ROW_TO_SNELLEN[sample.rowMap]?.label,
      denom: ROW_TO_SNELLEN[sample.rowMap]?.denom,
    });
  });

  // Tumbling E trials (15 unique sizes)
  TUMBLING_E_SIZES.forEach((level) => {
    trials.push({
      type: 'tumbling-e', sizePx: level.sizePx, rowIndex: level.rowMap,
      direction: DIRECTIONS[Math.floor(Math.random() * 4)],
    });
  });

  // Landolt C trials (15 unique sizes)
  LANDOLT_C_SIZES.forEach((level) => {
    trials.push({
      type: 'landolt-c', sizePx: level.sizePx, rowIndex: level.rowMap,
      direction: DIRECTIONS[Math.floor(Math.random() * 4)],
    });
  });

  // Group by type: Tumbling E first, then Landolt C, then Letters
  const eTrials = trials.filter(t => t.type === 'tumbling-e');
  const cTrials = trials.filter(t => t.type === 'landolt-c');
  const letterTrials = trials.filter(t => t.type === 'letter');

  // Shuffle within each group
  const shuffle = (arr: Trial[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  return [...shuffle(eTrials), ...shuffle(cTrials), ...shuffle(letterTrials)];
}

// ─── Phases ───
type TestPhase = 'testing' | 'done';

const AcuityTest: React.FC<Props> = ({ calibration, t, stream, onFinish }) => {
  const trialSequence = useMemo(() => buildTrialSequence(), []);
  const totalTrials = trialSequence.length;

  const [phase, setPhase] = useState<TestPhase>('testing');
  const [currentIndex, setCurrentIndex] = useState(0);

  const [results, setResults] = useState<{ answer: string; correct: boolean; timeMs: number; rowIndex: number }[]>([]);
  const [wrongInRow, setWrongInRow] = useState(0);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const lastTime = useRef(Date.now());

  const currentTrial = trialSequence[currentIndex] || trialSequence[0];

  const { botState, botStart, botRecordTrial, botFinish } = useAIBot();

  // Letter choices (only for letter-type trials)
  const letterChoices = useMemo(() => {
    if (currentTrial.type !== 'letter' || !currentTrial.letter) return [];
    const correct = currentTrial.letter;
    const others = ALL_LETTERS.filter(l => l !== correct);
    const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 5);
    return [...shuffled, correct].sort(() => Math.random() - 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrial.letter, currentTrial.type, currentIndex]);

  // AI Bot lifecycle — start immediately
  useEffect(() => {
    if (phase === 'testing') botStart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => { lastTime.current = Date.now(); }, [currentIndex]);

  // ─── Handle answer (letter OR direction) ───
  const handleSelect = useCallback((answer: string) => {
    if (phase !== 'testing') return;

    setActiveButton(answer);
    setTimeout(() => setActiveButton(null), 250);

    const timeMs = Date.now() - lastTime.current;
    const isCorrect = currentTrial.type === 'letter'
      ? answer === currentTrial.letter
      : answer === currentTrial.direction;

    botRecordTrial(isCorrect, currentIndex, totalTrials);
    const entry = { answer, correct: isCorrect, timeMs, rowIndex: currentTrial.rowIndex };
    const newWrong = isCorrect ? 0 : wrongInRow + 1;
    setWrongInRow(newWrong);

    const updated = [...results, entry];
    setResults(updated);
    if (newWrong >= 3 || currentIndex >= totalTrials - 1) {
      finishTest(updated);
      return;
    }
    setCurrentIndex(prev => prev + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentTrial, currentIndex, results, wrongInRow, totalTrials]);

  const finishTest = (allResults: typeof results) => {
    setPhase('done');

    const getAcuity = (res: typeof results) => {
      let lastPassedRow = 0;
      for (let ri = 0; ri < ROW_TO_SNELLEN.length; ri++) {
        const rowTrials = res.filter(r => r.rowIndex === ri);
        if (rowTrials.length === 0) continue;
        const correct = rowTrials.filter(r => r.correct).length;
        if (correct / rowTrials.length >= 0.5) lastPassedRow = ri;
      }
      return ROW_TO_SNELLEN[lastPassedRow];
    };

    const acuity = getAcuity(allResults);
    const allTimes = allResults.map(r => r.timeMs);
    const totalCorrect = allResults.filter(r => r.correct).length;
    const totalAttempted = allResults.length;
    const difficulty = acuity.denom <= 20 ? 'hard' : acuity.denom <= 50 ? 'medium' : 'easy';

    let findings: string;
    let confidence: number;

    if (acuity.denom <= 20) {
      findings = `Excellent visual acuity — ${acuity.label}. Normal or better than normal vision.`;
      confidence = 0.96;
    } else if (acuity.denom <= 40) {
      findings = `Adequate visual acuity — ${acuity.label}. Meets standard driving requirements.`;
      confidence = 0.92;
    } else if (acuity.denom <= 70) {
      findings = `Reduced visual acuity — ${acuity.label}. Corrective lenses may be beneficial.`;
      confidence = 0.90;
    } else {
      findings = `Significantly reduced visual acuity — ${acuity.label}. Professional exam strongly recommended.`;
      confidence = 0.93;
    }

    botFinish(totalCorrect, totalAttempted);

    onFinish({
      testName: 'Visual Acuity',
      score: totalCorrect, total: totalAttempted, confidence, findings,
      difficulty: difficulty as 'easy' | 'medium' | 'hard',
      timestamps: allTimes,
      perSampleScores: allResults.map((r, i) => ({ sample: i + 1, correct: r.correct, timeMs: r.timeMs })),
      rawResponseTimes: allTimes,
    });
  };



  const progressPct = ((currentIndex + 1) / totalTrials) * 100;
  const difficultyLabel = currentTrial.rowIndex < 4 ? 'EASY' : currentTrial.rowIndex < 8 ? 'MEDIUM' : 'HARD';
  const difficultyColor = currentTrial.rowIndex < 4 ? '#10b981' : currentTrial.rowIndex < 8 ? '#f59e0b' : '#ef4444';
  const typeLabel = currentTrial.type === 'letter' ? 'Letter' : currentTrial.type === 'tumbling-e' ? 'Tumbling E' : 'Landolt C';

  // Rotation for E/C shapes: direction = where the prongs/gap point
  const rotation = currentTrial.direction === 'right' ? 0 : currentTrial.direction === 'down' ? 90 : currentTrial.direction === 'left' ? 180 : 270;

  if (phase === 'done') return null;

  // ─── Testing Phase UI ───
  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-2 md:gap-4 animate-in fade-in duration-500 overflow-x-hidden overflow-y-auto relative">

      {/* ─── LEFT: Test Info Panel (hidden on mobile) ─── */}
      <div className="hidden md:flex shrink-0 flex-col gap-3 items-center" style={{ width: 300 }}>
        {/* Test Info Panel */}
        <div className="w-full glass rounded-2xl border border-white/5 p-3 space-y-2">
          <div className="text-center">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{typeLabel}</div>
            <div className="text-lg font-black text-white">
              {currentTrial.type === 'letter'
                ? `${currentTrial.label} · ${Math.round((currentTrial.opacity ?? 1) * 100)}%`
                : `${currentTrial.sizePx}px`}
            </div>
          </div>
          <div className="h-px bg-white/5"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Trial</span>
            <span className="text-sm font-black text-white">{currentIndex + 1}/{totalTrials}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Type</span>
            <span className="text-sm font-black text-white">{typeLabel}</span>
          </div>
          <div className="flex items-center justify-center pt-1 gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              BOTH EYES
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
              style={{ background: difficultyColor + '20', color: difficultyColor, border: `1px solid ${difficultyColor}40` }}>
              {difficultyLabel}
            </span>
          </div>
        </div>

        <div className="text-center px-2">
          <div className="text-[10px] font-bold text-cyan-400/80 flex items-center gap-1 justify-center">
            <span>{currentTrial.type === 'letter' ? 'Select the letter' : 'Select the direction'}</span>
          </div>
        </div>
        <AIBotBubble botState={botState} isEyeUncovered={false} coverEye={undefined} />
      </div>

      {/* ─── RIGHT: Test Content ─── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header Bar */}
        <div className="shrink-0 px-3 md:px-6 py-2 md:py-3">
          <h3 className="text-base md:text-2xl font-black text-white uppercase tracking-tight leading-none">{t.visual_acuity}</h3>
          <p className="text-[10px] md:text-xs text-cyan-400 font-bold uppercase tracking-widest mt-0.5">
            Trial {currentIndex + 1}/{totalTrials} · {typeLabel}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="shrink-0 px-3 md:px-6 pt-1 md:pt-2">
          <div className="w-full bg-slate-800 h-1 md:h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Optotype Display — centered */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-2 md:p-4 overflow-hidden">
          <div className="flex items-center justify-center transition-all duration-300"
            style={{ width: `${currentTrial.sizePx}px`, height: `${currentTrial.sizePx}px` }}
          >
            {/* Snellen Letter */}
            {currentTrial.type === 'letter' && (
              <span
                className="font-black text-white select-none leading-none"
                style={{
                  fontSize: `${currentTrial.sizePx}px`,
                  fontFamily: "'Courier New', 'Courier', monospace",
                  opacity: currentTrial.opacity ?? 1,
                  filter: `drop-shadow(0 0 ${Math.round((currentTrial.opacity ?? 1) * 20)}px rgba(255,255,255,${(currentTrial.opacity ?? 1) * 0.4}))`,
                }}
              >
                {currentTrial.letter}
              </span>
            )}

            {/* Tumbling E — SVG */}
            {currentTrial.type === 'tumbling-e' && (
              <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                <rect x="0" y="0" width="100" height="20" />
                <rect x="0" y="40" width="100" height="20" />
                <rect x="0" y="80" width="100" height="20" />
                <rect x="0" y="0" width="20" height="100" />
              </svg>
            )}

            {/* Landolt C — SVG */}
            {currentTrial.type === 'landolt-c' && (
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                <path
                  d="M 100 40 L 100 60 L 80 60 A 30 30 0 1 1 80 40 Z"
                  fill="white"
                  transform="rotate(0 50 50)"
                />
                <circle cx="50" cy="50" r="50" fill="white" />
                <circle cx="50" cy="50" r="30" fill="black" />
                <rect x="50" y="40" width="55" height="20" fill="black" />
              </svg>
            )}
          </div>
        </div>

        {/* Answer Buttons */}
        <div className="shrink-0 p-2 md:p-4 pt-0">
          {currentTrial.type === 'letter' ? (
            /* Letter choice grid — 3 columns × 2 rows */
            <div className="grid grid-cols-3 gap-2 md:gap-3 max-w-2xl mx-auto">
              {letterChoices.map((letter, idx) => (
                <button
                  key={`${letter}-${idx}`}
                  onClick={() => handleSelect(letter)}
                  className={`
                    py-2 md:py-5 glass border-2 rounded-xl md:rounded-3xl
                    text-xl md:text-4xl lg:text-5xl font-black transition-all active:scale-95
                    ${activeButton === letter
                      ? 'border-cyan-400 bg-cyan-500/40 shadow-[0_0_50px_rgba(0,243,255,0.6)] scale-105'
                      : 'border-white/10 hover:border-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_40px_rgba(0,243,255,0.4)]'}
                  `}
                  style={{ fontFamily: "'Courier New', 'Courier', monospace" }}
                >
                  <span className="text-white drop-shadow-lg">{letter}</span>
                </button>
              ))}
            </div>
          ) : (
            /* Direction choice grid — 2×2 for Tumbling E / Landolt C */
            <div className="grid grid-cols-2 gap-2 md:gap-3 max-w-md mx-auto">
              {DIRECTIONS.map(dir => (
                <button
                  key={dir}
                  onClick={() => handleSelect(dir)}
                  className={`
                    py-3 md:py-7 glass border-2 rounded-xl md:rounded-3xl
                    text-2xl md:text-5xl lg:text-6xl transition-all active:scale-95
                    ${activeButton === dir
                      ? 'border-cyan-400 bg-cyan-500/40 shadow-[0_0_50px_rgba(0,243,255,0.6)] scale-105'
                      : 'border-white/10 hover:border-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_40px_rgba(0,243,255,0.4)]'}
                  `}
                >
                  <span className="inline-block drop-shadow-lg">
                    {dir === 'up' && '⬆️'}
                    {dir === 'down' && '⬇️'}
                    {dir === 'left' && '⬅️'}
                    {dir === 'right' && '➡️'}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="text-center mt-3">
            <button
              onClick={() => handleSelect('?')}
              className="px-6 py-2 glass border border-white/5 rounded-full text-xs text-slate-500 font-black uppercase tracking-[0.3em] hover:text-white transition-colors"
            >
              Can't See
            </button>
          </div>
          <div className="text-center mt-2 text-xs text-slate-500 uppercase tracking-widest opacity-60">
            Voice: {currentTrial.type === 'letter' ? 'Say the letter' : 'Say "Up", "Down", "Left", "Right"'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcuityTest;
