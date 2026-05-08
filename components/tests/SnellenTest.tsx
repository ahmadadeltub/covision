import React, { useState, useRef, useEffect } from 'react';
import { TestResult, CalibrationData } from '../../types';

import { useAIBot } from '../../hooks/useAIBot';
import AIBotBubble from '../AIBotBubble';

const OPTOTYPES = 'CDHKNORSVZ'.split('');

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

const TOTAL_SAMPLES = 15;

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
  const [levelIdx, setLevelIdx] = useState(0);
  const [targetLetter, setTargetLetter] = useState('E');
  const [choiceLetters, setChoiceLetters] = useState<string[]>([]);
  const [results, setResults] = useState<{ level: number; correct: boolean; time: number }[]>([]);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const startTime = useRef(Date.now());

  const { botState, botStart, botRecordTrial, botFinish } = useAIBot();
  const currentLevel = SNELLEN_LEVELS[levelIdx] || SNELLEN_LEVELS[0];

  // Generate new target + shuffled choices
  useEffect(() => {
    if (phase === 'testing') {
      const letter = OPTOTYPES[Math.floor(Math.random() * OPTOTYPES.length)];
      setTargetLetter(letter);
      const others = OPTOTYPES.filter(l => l !== letter);
      const picks = shuffle(others).slice(0, 5);
      setChoiceLetters(shuffle([letter, ...picks]));
      startTime.current = Date.now();
    }
  }, [levelIdx, phase]);

  // AI Bot lifecycle
  useEffect(() => {
    if (phase === 'testing') botStart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleSelect = (letter: string) => {
    if (phase !== 'testing') return;
    setActiveButton(letter);
    setTimeout(() => setActiveButton(null), 250);

    const time = Date.now() - startTime.current;
    const isCorrect = letter === targetLetter;
    botRecordTrial(isCorrect, levelIdx, TOTAL_SAMPLES);
    const entry = { level: levelIdx, correct: isCorrect, time };

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
  const difficultyLabel = levelIdx < 5 ? 'EASY' : levelIdx < 10 ? 'MEDIUM' : 'HARD';
  const difficultyColor = levelIdx < 5 ? '#10b981' : levelIdx < 10 ? '#f59e0b' : '#ef4444';

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
    <div className="w-full h-full flex flex-row gap-4 animate-in fade-in duration-500 overflow-x-hidden overflow-y-auto relative">

      {/* ─── LEFT: Info Panel ─── */}
      <div className="shrink-0 flex flex-col gap-3 items-center" style={{ width: 300 }}>
        <div className="w-full glass rounded-2xl border border-white/5 p-3 space-y-2">
          <div className="text-center">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Snellen</div>
            <div className="text-lg font-black text-white">{currentLevel.label}</div>
          </div>
          <div className="h-px bg-white/5"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Level</span>
            <span className="text-sm font-black text-white">{levelIdx + 1}/{TOTAL_SAMPLES}</span>
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
            <span>Select the letter below</span>
          </div>
        </div>
        <AIBotBubble botState={botState} isEyeUncovered={false} coverEye={undefined} />
      </div>

      {/* ─── RIGHT: Test Content ─── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        <div className="shrink-0 px-6 py-3">
          <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight leading-none">Snellen Visual Acuity</h3>
          <p className="text-xs text-cyan-400 font-bold uppercase tracking-widest mt-0.5">
            {currentLevel.label} — BOTH EYES
          </p>
        </div>

        <div className="shrink-0 px-6 pt-2">
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Letter Display */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] md:rounded-[3rem] flex items-center justify-center shadow-2xl border-4 border-white/10 px-8 md:px-16"
            style={{ minWidth: `${currentLevel.sizePx + 80}px`, minHeight: `${currentLevel.sizePx + 60}px`, maxWidth: '90%', maxHeight: '100%' }}>
            <span
              key={`both-${levelIdx}`}
              className="font-black text-black select-none leading-none"
              style={{ fontSize: `${currentLevel.sizePx}px`, fontFamily: "'Courier New', Courier, monospace" }}>
              {targetLetter}
            </span>
          </div>
        </div>

        {/* Choice Buttons */}
        <div className="shrink-0 p-4 pt-0 space-y-2">
          <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
            {choiceLetters.map((letter, i) => (
              <button
                key={`${letter}-${i}`}
                onClick={() => handleSelect(letter)}
                className={`py-4 md:py-5 glass border-2 rounded-2xl md:rounded-3xl text-3xl md:text-4xl lg:text-5xl font-black transition-all active:scale-95
                  ${activeButton === letter
                    ? 'border-cyan-400 bg-cyan-500/40 shadow-[0_0_50px_rgba(0,243,255,0.6)] scale-105'
                    : 'border-white/10 hover:border-cyan-400 hover:bg-cyan-500/20'}`}
                style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                <span className="text-white drop-shadow-lg">{letter}</span>
              </button>
            ))}
          </div>
          <div className="max-w-2xl mx-auto mt-3">
            <button
              onClick={() => handleSelect('__CANT_SEE__')}
              className={`w-full py-3 glass border-2 rounded-2xl text-base font-black uppercase tracking-widest transition-all active:scale-95
                ${activeButton === '__CANT_SEE__'
                  ? 'border-red-400 bg-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-105'
                  : 'border-white/10 hover:border-red-400 hover:bg-red-500/20 text-slate-400 hover:text-red-300'}`}>
              <span className="flex items-center justify-center gap-2">
                <span>🚫</span>
                <span>Can&apos;t See</span>
              </span>
            </button>
          </div>
          <div className="text-center mt-2 text-xs text-slate-500 uppercase tracking-widest opacity-60">
            Voice: Say the letter or &quot;can&apos;t see&quot;
          </div>
        </div>
      </div>
    </div>
  );
};

export default SnellenTest;
