import React, { useState, useRef, useEffect, useMemo } from 'react';
import { TestResult, CalibrationData } from '../../types';

import { useAIBot } from '../../hooks/useAIBot';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import AIBotBubble from '../AIBotBubble';

const OPTOTYPES = ['E', 'F', 'P', 'T', 'O', 'Z', 'L', 'D', 'C'];

// 15 Snellen levels (size + label) — from large to tiny
const SNELLEN_LEVELS = [
  { label: '20/200', denom: 200, sizePx: 300 },
  { label: '20/160', denom: 160, sizePx: 250 },
  { label: '20/125', denom: 125, sizePx: 200 },
  { label: '20/100', denom: 100, sizePx: 165 },
  { label: '20/80',  denom: 80,  sizePx: 135 },
  { label: '20/70',  denom: 70,  sizePx: 115 },
  { label: '20/60',  denom: 60,  sizePx: 96 },
  { label: '20/50',  denom: 50,  sizePx: 80 },
  { label: '20/40',  denom: 40,  sizePx: 64 },
  { label: '20/30',  denom: 30,  sizePx: 48 },
  { label: '20/25',  denom: 25,  sizePx: 36 },
  { label: '20/20',  denom: 20,  sizePx: 28 },
  { label: '20/15',  denom: 15,  sizePx: 22 },
  { label: '20/13',  denom: 13,  sizePx: 18 },
  { label: '20/10',  denom: 10,  sizePx: 14 },
];

const TOTAL_SAMPLES = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = 'testing' | 'done';

interface Props {
  calibration: CalibrationData;
  t: any;
  stream?: MediaStream | null;
  onFinish: (result: TestResult) => void;
}

const SnellenTest: React.FC<Props> = ({ calibration, t, stream, onFinish }) => {
  const [phase, setPhase] = useState<Phase>('testing');
  
  // Generate a random sequence of 3 different levels
  const trialSequence = useMemo(() => {
    // Pick 3 levels across the spectrum (large, medium, small)
    const indices = [0, 5, 8]; // 20/200, 20/70, 20/20
    return shuffle(indices.map(idx => ({ ...SNELLEN_LEVELS[idx], originalIdx: idx })));
  }, []);

  const [levelIdx, setLevelIdx] = useState(0);
  const [targetLetter, setTargetLetter] = useState('E');
  const [choiceLetters, setChoiceLetters] = useState<string[]>([]);
  const [results, setResults] = useState<{ level: number; correct: boolean; time: number }[]>([]);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const startTime = useRef(Date.now());

  const { botState, botStart, botRecordTrial, botFinish } = useAIBot();
  const currentTrial = trialSequence[levelIdx];

  // Generate new target + shuffled choices
  useEffect(() => {
    if (phase === 'testing' && currentTrial) {
      const letter = OPTOTYPES[Math.floor(Math.random() * OPTOTYPES.length)];
      setTargetLetter(letter);
      const others = OPTOTYPES.filter(l => l !== letter);
      const picks = shuffle(others).slice(0, 5);
      setChoiceLetters(shuffle([letter, ...picks]));
      startTime.current = Date.now();
    }
  }, [levelIdx, phase, currentTrial]);

  // AI Bot lifecycle
  useEffect(() => {
    if (phase === 'testing') botStart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Voice commands mapping
  const voiceCommands = useMemo(() => {
    const map: Record<string, string> = {
      "can't see": "__CANT_SEE__", "cant see": "__CANT_SEE__", "i don't know": "__CANT_SEE__", "لا أرى": "__CANT_SEE__", "لا اعرف": "__CANT_SEE__", "مش شايف": "__CANT_SEE__"
    };
    OPTOTYPES.forEach(l => {
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

  const handleSelect = (letter: string) => {
    if (phase !== 'testing') return;
    setActiveButton(letter);
    setTimeout(() => setActiveButton(null), 250);

    const time = Date.now() - startTime.current;
    const isCorrect = letter === targetLetter;
    botRecordTrial(isCorrect, levelIdx, TOTAL_SAMPLES);
    const entry = { level: currentTrial.originalIdx, correct: isCorrect, time };

    const updated = [...results, entry];
    setResults(updated);
    if (levelIdx >= TOTAL_SAMPLES - 1) {
      finishTest(updated);
      return;
    }
    setLevelIdx(prev => prev + 1);
  };

  const finishTest = (allResults: typeof results) => {
    setPhase('done');
    const getAcuity = (res: typeof results) => {
      let lastCorrectLevel = 0;
      for (const r of res) {
        if (r.correct) lastCorrectLevel = r.level;
      }
      return SNELLEN_LEVELS[lastCorrectLevel];
    };

    const acuity = getAcuity(allResults);
    const allTimes = allResults.map(r => r.time);
    const totalCorrect = allResults.filter(r => r.correct).length;
    const totalAttempted = allResults.length;

    let findings: string;
    let confidence: number;

    if (acuity.denom <= 20) {
      findings = `Excellent visual acuity — ${acuity.label}. Normal or better than normal vision.`;
      confidence = 0.96;
    } else if (acuity.denom <= 40) {
      findings = `Adequate visual acuity — ${acuity.label}. Meets standard driving requirements.`;
      confidence = 0.92;
    } else if (acuity.denom <= 70) {
      findings = `Reduced visual acuity — ${acuity.label}. Corrective lenses recommended.`;
      confidence = 0.90;
    } else {
      findings = `Significantly reduced visual acuity — ${acuity.label}. Professional examination strongly recommended.`;
      confidence = 0.93;
    }

    botFinish(totalCorrect, totalAttempted);

    onFinish({
      testName: 'Snellen Visual Acuity',
      score: totalCorrect,
      total: totalAttempted,
      confidence,
      findings,
      rawResponseTimes: allTimes,
      perSampleScores: allResults.map((r, i) => ({ sample: i + 1, correct: r.correct, timeMs: r.time })),
    });
  };

  const progressPct = phase === 'testing' ? ((levelIdx + 1) / TOTAL_SAMPLES) * 100 : 0;
  const difficultyLabel = currentTrial?.originalIdx < 5 ? 'EASY' : currentTrial?.originalIdx < 10 ? 'MEDIUM' : 'HARD';
  const difficultyColor = currentTrial?.originalIdx < 5 ? '#10b981' : currentTrial?.originalIdx < 10 ? '#f59e0b' : '#ef4444';

  if (phase === 'done') {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="text-5xl">✅</div>
          <p className="text-xl font-black text-white">Snellen Test Complete</p>
          <p className="text-sm text-slate-400">Loading next test...</p>
        </div>
      </div>
    );
  }

  // ─── Testing Phase UI ───
  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-3 md:gap-4 animate-in fade-in duration-500 overflow-x-hidden overflow-y-auto relative">

      {/* ─── LEFT: Info Panel ─── */}
      <div className="w-full md:w-[260px] lg:w-[300px] shrink-0 flex flex-col gap-2 md:gap-3 items-center">
        <div className="w-full glass rounded-2xl border border-white/5 p-3 space-y-2">
          <div className="text-center">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Snellen</div>
            <div className="text-lg font-black text-slate-900 dark:text-white">{currentTrial?.label}</div>
          </div>
          <div className="h-px bg-slate-200 dark:bg-white/5"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Level</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">{levelIdx + 1}/{TOTAL_SAMPLES}</span>
          </div>
          <div className="flex items-center justify-center pt-1 gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-700 dark:bg-cyan-500/20 dark:text-cyan-400 border border-sky-300 dark:border-cyan-500/40">
              BOTH EYES
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
              style={{ background: difficultyColor + '20', color: difficultyColor, border: `1px solid ${difficultyColor}40` }}>
              {difficultyLabel}
            </span>
          </div>
        </div>
        <div className="text-center px-2 py-1">
          <div className="text-xs sm:text-sm font-black text-sky-700 dark:text-cyan-400 flex items-center gap-1.5 justify-center uppercase tracking-wide">
            <span>Select the letter below</span>
          </div>
        </div>
        <div className="hidden md:block w-full">
          <AIBotBubble botState={botState} isEyeUncovered={false} coverEye={undefined} isListening={isListening} transcript={transcript} />
        </div>
      </div>

      {/* ─── RIGHT: Test Content ─── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        <div className="shrink-0 px-3 md:px-6 py-2 md:py-3">
          <h3 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Snellen Visual Acuity</h3>
          <p className="text-xs text-sky-700 dark:text-cyan-400 font-bold uppercase tracking-widest mt-0.5">
            {currentTrial?.label} — BOTH EYES
          </p>
        </div>

        <div className="shrink-0 px-3 md:px-6 pt-1 md:pt-2">
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Letter Display */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-3 md:p-4">
          <div className="bg-white rounded-2xl md:rounded-[3rem] flex items-center justify-center shadow-2xl border-4 border-white/10 px-6 md:px-16"
            style={{ minWidth: `${(currentTrial?.sizePx || 0) + 80}px`, minHeight: `${(currentTrial?.sizePx || 0) + 60}px`, maxWidth: '90%', maxHeight: '100%' }}>
            <span
              key={`both-${levelIdx}`}
              className="font-black text-black select-none leading-none"
              style={{ fontSize: `${currentTrial?.sizePx}px`, fontFamily: "'Courier New', Courier, monospace" }}>
              {targetLetter}
            </span>
          </div>
        </div>

        {/* Choice Buttons — Significantly Enlarged */}
        <div className="shrink-0 p-2 md:p-3 pt-0 space-y-2">
          <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-2xl mx-auto">
            {choiceLetters.map((letter, i) => (
              <button
                key={`${letter}-${i}`}
                onClick={() => handleSelect(letter)}
                className={`py-4 sm:py-5 md:py-6 glass border-2 rounded-2xl md:rounded-3xl text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black transition-all active:scale-95 min-h-[64px] sm:min-h-[80px] flex items-center justify-center
                  ${activeButton === letter
                    ? 'border-cyan-400 bg-cyan-500/40 shadow-[0_0_50px_rgba(0,243,255,0.6)] scale-105'
                    : 'border-white/10 hover:border-cyan-400 hover:bg-cyan-500/20'}`}
                style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                <span className="text-slate-900 dark:text-white">{letter}</span>
              </button>
            ))}
          </div>
          <div className="max-w-2xl mx-auto mt-2">
            <button
              onClick={() => handleSelect('__CANT_SEE__')}
              className={`w-full py-3.5 sm:py-4 min-h-[52px] sm:min-h-[58px] glass border-2 rounded-xl md:rounded-2xl text-sm md:text-base font-black uppercase tracking-wider md:tracking-widest transition-all active:scale-95 flex items-center justify-center
                ${activeButton === '__CANT_SEE__'
                  ? 'border-red-400 bg-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-105 text-red-700 dark:text-red-300'
                  : 'border-slate-200 dark:border-white/10 hover:border-red-400 hover:bg-red-500/10 text-slate-700 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-300'}`}>
              <span className="flex items-center justify-center gap-2">
                <span className="text-lg">🚫</span>
                <span>Can&apos;t See</span>
              </span>
            </button>
          </div>
          <div className="text-center mt-1 text-[10px] md:text-xs text-slate-500 uppercase tracking-widest opacity-60 flex items-center justify-center gap-2">
            <span>Voice: Say the letter or &quot;can&apos;t see&quot;</span>
            {isListening && <span className="text-emerald-400 font-bold animate-pulse">🎤 Listening</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SnellenTest;
