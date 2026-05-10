import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TestResult, CalibrationData } from '../../types';

import { useAIBot } from '../../hooks/useAIBot';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import AIBotBubble from '../AIBotBubble';

interface Props {
  calibration: CalibrationData;
  t: any;
  stream?: MediaStream | null;
  onFinish: (result: TestResult) => void;
}

// ─── Letters only (no E or C) ───
const ALL_LETTERS = ['D', 'F', 'H', 'K', 'L', 'N', 'O', 'P', 'R', 'S', 'T', 'V', 'Z'];

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

// ─── 5 Letter sizes from large to small ───
const LETTER_LEVELS = [
  { sizePx: 300, opacity: 1.00, rowMap: 0 },  // 20/200 — largest
  { sizePx: 220, opacity: 1.00, rowMap: 2 },  // 20/70
  { sizePx: 160, opacity: 1.00, rowMap: 4 },  // 20/40
  { sizePx: 110, opacity: 1.00, rowMap: 6 },  // 20/25
  { sizePx: 70,  opacity: 1.00, rowMap: 7 },  // 20/20 — smallest
];

interface Trial {
  type: 'letter';
  sizePx: number;
  rowIndex: number;
  letter: string;
  label?: string;
  denom?: number;
  opacity?: number;
}

function buildTrialSequence(): Trial[] {
  // Pick 5 random unique letters and assign each to a size level
  const shuffledLetters = [...ALL_LETTERS].sort(() => Math.random() - 0.5);
  return LETTER_LEVELS.map((level, i) => ({
    type: 'letter' as const,
    sizePx: level.sizePx,
    rowIndex: level.rowMap,
    letter: shuffledLetters[i % shuffledLetters.length],
    opacity: level.opacity,
    label: ROW_TO_SNELLEN[level.rowMap]?.label,
    denom: ROW_TO_SNELLEN[level.rowMap]?.denom,
  }));
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
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
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

  // Voice commands mapping — letters only
  const voiceCommands = useMemo(() => {
    const map: Record<string, string> = {
      "can't see": "?", "cant see": "?", "i don't know": "?", "لا أرى": "?", "لا اعرف": "?", "مش شايف": "?"
    };
    ALL_LETTERS.forEach(l => {
      map[l.toLowerCase()] = l;
      map[`letter ${l.toLowerCase()}`] = l;
    });
    return map;
  }, []);

  const { isListening, transcript } = useVoiceCommand({
    commands: voiceCommands,
    onCommand: (cmd) => handleSelect(cmd),
    isActive: phase === 'testing',
  });

  useEffect(() => { lastTime.current = Date.now(); }, [currentIndex]);

  // ─── Handle answer (letter OR direction) ───
  const handleSelect = useCallback((answer: string) => {
    if (phase !== 'testing' || feedback !== null) return;

    setActiveButton(answer);
    setTimeout(() => setActiveButton(null), 250);

    const timeMs = Date.now() - lastTime.current;
    const isCorrect = answer === currentTrial.letter;

    setFeedback(isCorrect ? 'correct' : 'incorrect');

    setTimeout(() => {
        setFeedback(null);
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
        setCurrentIndex(i => i + 1);
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, totalTrials, currentTrial, results, wrongInRow, botRecordTrial, feedback]);

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

  if (phase === 'done') return null;

  // ─── Testing Phase UI ───
  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-2 md:gap-4 animate-in fade-in duration-500 overflow-x-hidden overflow-y-auto relative">

      {/* ─── LEFT: Test Info Panel (hidden on mobile) ─── */}
      <div className="hidden md:flex shrink-0 flex-col gap-3 items-center" style={{ width: 300 }}>
        {/* Test Info Panel */}
        <div className="w-full glass rounded-2xl border border-white/5 p-3 space-y-2">
          <div className="text-center">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Letter</div>
            <div className="text-lg font-black text-white">
              {currentTrial.label} · {currentTrial.sizePx}px
            </div>
          </div>
          <div className="h-px bg-white/5"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Trial</span>
            <span className="text-sm font-black text-white">{currentIndex + 1}/{totalTrials}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Size</span>
            <span className="text-sm font-black text-white">Letter</span>
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
            <span>Select the letter</span>
          </div>
        </div>
        <AIBotBubble botState={botState} isEyeUncovered={false} coverEye={undefined} isListening={isListening} transcript={transcript} />
      </div>

      {/* ─── RIGHT: Test Content ─── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        
        {/* Feedback Overlay */}
        {feedback && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] rounded-[2rem] animate-in fade-in duration-200 pointer-events-none">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in duration-300 ${feedback === 'correct' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
              {feedback === 'correct' ? '✅' : '❌'}
            </div>
          </div>
        )}

        {/* Header Bar */}
        <div className="shrink-0 px-3 md:px-6 py-2 md:py-3">
          <h3 className="text-base md:text-2xl font-black text-white uppercase tracking-tight leading-none">{t.visual_acuity}</h3>
          <p className="text-[10px] md:text-xs text-cyan-400 font-bold uppercase tracking-widest mt-0.5">
            Trial {currentIndex + 1}/{totalTrials} · {currentTrial.label}
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
            {/* Letter Display */}
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
          </div>
        </div>

        {/* Answer Buttons */}
        <div className="shrink-0 p-2 md:p-4 pt-0">
          {/* Letter choice grid */}
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

          <div className="text-center mt-3">
            <button
              onClick={() => handleSelect('?')}
              className="px-6 py-2 glass border border-white/5 rounded-full text-xs text-slate-500 font-black uppercase tracking-[0.3em] hover:text-white transition-colors"
            >
              Can't See
            </button>
          </div>
          <div className="text-center mt-2 text-xs text-slate-500 uppercase tracking-widest opacity-60 flex items-center justify-center gap-2">
            <span>Voice: Say the letter or "can't see"</span>
            {isListening && <span className="text-emerald-400 font-bold animate-pulse">🎤 Listening</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcuityTest;
