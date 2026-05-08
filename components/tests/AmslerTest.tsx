import React, { useState, useEffect, useRef } from 'react';
import { TestResult } from '../../types';

import { useAIBot } from '../../hooks/useAIBot';
import AIBotBubble from '../AIBotBubble';

interface Props {
  t: any;
  stream?: MediaStream | null;
  onFinish: (result: TestResult) => void;
}

type GridVariant = 'standard' | 'red' | 'threshold' | 'blue' | 'fine';
type Quadrant = 'TL' | 'TR' | 'BL' | 'BR';

const GRID_VARIANTS: { key: GridVariant; label: string; bg: string; lineColor: string; dotColor: string; cellCount: number }[] = [
  { key: 'standard', label: 'Standard Grid', bg: '#ffffff', lineColor: 'rgba(0,0,0,0.25)', dotColor: '#000', cellCount: 400 },
  { key: 'red', label: 'Red-on-Black', bg: '#111111', lineColor: 'rgba(220,38,38,0.4)', dotColor: '#ef4444', cellCount: 400 },
  { key: 'threshold', label: 'Threshold Grid', bg: '#f5f5f5', lineColor: 'rgba(0,0,0,0.10)', dotColor: '#333', cellCount: 400 },
  { key: 'blue', label: 'Blue Field', bg: '#0a1628', lineColor: 'rgba(59,130,246,0.35)', dotColor: '#3b82f6', cellCount: 400 },
  { key: 'fine', label: 'Fine Mesh', bg: '#ffffff', lineColor: 'rgba(0,0,0,0.15)', dotColor: '#000', cellCount: 625 },
];

const TOTAL_TRIALS = 5;

type Phase = 'intro' | 'testing' | 'done';

const AmslerTest: React.FC<Props> = ({ t, stream, onFinish }) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [trialIdx, setTrialIdx] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [results, setResults] = useState<{ variant: GridVariant; hasIssues: boolean; quadrants: Quadrant[] }[]>([]);
  const [selectedQuadrants, setSelectedQuadrants] = useState<Quadrant[]>([]);
  const [showQuadrant, setShowQuadrant] = useState(false);

  const isTesting = phase === 'testing';

  const { botState, botStart, botRecordTrial, botFinish } = useAIBot();
  const currentVariant = GRID_VARIANTS[trialIdx % GRID_VARIANTS.length];

  // Countdown
  useEffect(() => {
    if (phase !== 'intro') return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setPhase('testing');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // AI Bot lifecycle
  useEffect(() => {
    if (phase === 'testing') botStart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleChoice = (hasIssues: boolean, skipQuadrantSelect = false) => {
    if (hasIssues && !showQuadrant && !skipQuadrantSelect) {
      setShowQuadrant(true);
      return;
    }

    const entry = { variant: currentVariant.key, hasIssues, quadrants: hasIssues ? selectedQuadrants : [] };
    const newResults = [...results, entry];
    setResults(newResults);
    botRecordTrial(!hasIssues, trialIdx, TOTAL_TRIALS);
    setSelectedQuadrants([]);
    setShowQuadrant(false);

    if (trialIdx < TOTAL_TRIALS - 1) {
      setTrialIdx(prev => prev + 1);
    } else {
      finishTest(newResults);
    }
  };

  const finishTest = (allResults: typeof results) => {
    setPhase('done');
    const totalIssues = allResults.filter(r => r.hasIssues).length;
    const total = allResults.length;
    const affectedQuadrants = [...new Set(allResults.flatMap(r => r.quadrants))];

    let findings: string;
    if (totalIssues >= 4) {
      findings = `Significant central vision distortion — ${totalIssues}/${TOTAL_TRIALS} grids showed issues. Affected: ${affectedQuadrants.join(', ') || 'N/A'}. Macular evaluation strongly recommended.`;
    } else if (totalIssues >= 2) {
      findings = `Mild central vision concerns — ${totalIssues}/${TOTAL_TRIALS} grids showed issues. Monitoring recommended.`;
    } else {
      findings = `No central vision distortions detected — ${totalIssues}/${TOTAL_TRIALS} grids showed issues. Vision appears normal.`;
    }

    botFinish(total - totalIssues, total);

    onFinish({
      testName: 'Amsler Grid',
      score: total - totalIssues,
      total,
      confidence: 1.0,
      findings,
      difficulty: totalIssues >= 8 ? 'hard' : 'easy',
      perSampleScores: allResults.map((r, i) => ({ sample: i + 1, correct: !r.hasIssues, timeMs: 0 })),
      rawResponseTimes: [],
    });
  };

  const toggleQuadrant = (q: Quadrant) => {
    setSelectedQuadrants(prev => prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q]);
  };



  const progressPct = isTesting ? ((trialIdx + 1) / TOTAL_TRIALS) * 100 : 0;
  const gridCols = currentVariant.cellCount === 625 ? 25 : 20;

  // ─── Intro Screen ───
  if (phase === 'intro') {
    return (
      <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-700">
        <div className="flex flex-col items-center gap-6 text-center p-8 max-w-lg">
          <div className="text-6xl animate-pulse">⬛</div>
          <h2 className="text-2xl md:text-3xl font-black text-white">Amsler Grid Test</h2>
          <div className="max-w-md w-full p-4 glass border-2 border-cyan-500/40 rounded-2xl space-y-3">
            <div className="flex items-center gap-3 text-cyan-400">
              <span className="text-2xl">👁️</span>
              <span className="text-lg font-bold">Focus on the center dot</span>
            </div>
            <p className="text-slate-300 text-sm">You'll see 5 different grids. Tell us if the lines appear straight or wavy.</p>
          </div>
          <div className="w-20 h-20 rounded-full border-4 border-cyan-400 flex items-center justify-center bg-cyan-500/10 shadow-[0_0_40px_rgba(6,182,212,0.4)] animate-pulse">
            <span className="text-4xl font-black text-cyan-400">{countdown}</span>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-5xl">✅</div>
          <h2 className="text-2xl font-black text-white">Amsler Grid Complete</h2>
          <p className="text-slate-400 text-sm">Processing results…</p>
        </div>
      </div>
    );
  }

  // ─── Quadrant Selection ───
  if (showQuadrant) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-between p-6 animate-in fade-in duration-300">
        <div className="shrink-0">
          <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter text-center">Where is the distortion?</h3>
          <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider mt-1 text-center">Tap affected quadrants</p>
        </div>
        <div className="flex-1 flex items-center justify-center my-4">
          <div className="grid grid-cols-2 gap-3" style={{ width: 'min(70vw, 300px)' }}>
            {(['TL', 'TR', 'BL', 'BR'] as Quadrant[]).map(q => (
              <button key={q} onClick={() => toggleQuadrant(q)}
                className={`aspect-square rounded-[1.5rem] font-black text-lg uppercase flex items-center justify-center transition-all ${selectedQuadrants.includes(q)
                  ? 'bg-red-500/30 border-2 border-red-400 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                  : 'bg-slate-800 border border-white/10 text-slate-500 hover:border-cyan-400'}`}>
                {q === 'TL' ? '↖ Top-Left' : q === 'TR' ? '↗ Top-Right' : q === 'BL' ? '↙ Bottom-Left' : '↘ Bottom-Right'}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => handleChoice(true)}
          className="shrink-0 w-full max-w-2xl py-5 bg-white text-slate-950 rounded-[2rem] font-black text-lg uppercase tracking-[0.3em] hover:bg-cyan-400 transition-all">
          Confirm ({selectedQuadrants.length})
        </button>
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
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{currentVariant.label}</div>
          </div>
          <div className="h-px bg-white/5"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Grid</span>
            <span className="text-sm font-black text-white">{trialIdx + 1}/{TOTAL_TRIALS}</span>
          </div>
          <div className="flex items-center justify-center pt-1">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              BOTH EYES
            </span>
          </div>
        </div>
        <div className="text-center px-2">
          <div className="text-[10px] font-bold text-cyan-400/80 flex items-center gap-1 justify-center">
            <span>Tap "Perfect" or "Wavy" below</span>
          </div>
        </div>
        <AIBotBubble botState={botState} isEyeUncovered={false} coverEye={undefined} />
      </div>

      {/* ─── RIGHT: Test Content ─── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        <div className="shrink-0 px-6 py-3">
          <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight leading-none">{t.amsler_grid}</h3>
          <p className="text-xs text-cyan-400 font-bold uppercase tracking-widest mt-0.5">
            {t.amsler_desc}
          </p>
        </div>

        <div className="shrink-0 px-6 pt-2">
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Grid Display */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <div className="p-4 md:p-6 rounded-[2.5rem] border-4 border-white/10 shadow-2xl overflow-hidden aspect-square h-[min(80vw,48vh)]"
            style={{ background: currentVariant.bg }}>
            <div className="w-full h-full border relative"
              style={{
                borderColor: currentVariant.lineColor,
                display: 'grid',
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                gridTemplateRows: `repeat(${gridCols}, 1fr)`,
              }}>
              {Array.from({ length: currentVariant.cellCount }).map((_, i) => (
                <div key={i} className="border-[0.5px]" style={{ borderColor: currentVariant.lineColor }} />
              ))}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-4 h-4 md:w-6 md:h-6 rounded-full shadow-2xl animate-pulse"
                  style={{ background: currentVariant.dotColor }} />
              </div>
            </div>
          </div>
        </div>

        {/* Smart Answer Buttons */}
        <div className="shrink-0 p-4 pt-0 space-y-2">
          <p className="text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Focus on center dot — how does the grid look?</p>
          <div className="grid grid-cols-2 gap-2 max-w-2xl mx-auto">
            <button onClick={() => handleChoice(false)}
              className="py-4 bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 rounded-2xl font-black uppercase text-sm tracking-wider hover:bg-emerald-500/20 transition-all active:scale-95">
              <span className="text-2xl block mb-1">✅</span>
              All Lines Straight
              <span className="block text-[9px] text-emerald-400/60 normal-case tracking-normal mt-0.5">Grid looks perfectly even</span>
            </button>
            <button onClick={() => handleChoice(true)}
              className="py-4 bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 rounded-2xl font-black uppercase text-sm tracking-wider hover:bg-amber-500/20 transition-all active:scale-95">
              <span className="text-2xl block mb-1">⚠️</span>
              Lines Are Wavy
              <span className="block text-[9px] text-amber-400/60 normal-case tracking-normal mt-0.5">Some lines appear bent or curved</span>
            </button>
            <button onClick={() => { setSelectedQuadrants(['TL', 'TR', 'BL', 'BR']); handleChoice(true, true); }}
              className="py-4 bg-orange-500/10 border-2 border-orange-500/30 text-orange-400 rounded-2xl font-black uppercase text-sm tracking-wider hover:bg-orange-500/20 transition-all active:scale-95">
              <span className="text-2xl block mb-1">🖤</span>
              Missing Areas
              <span className="block text-[9px] text-orange-400/60 normal-case tracking-normal mt-0.5">Dark spots or blank areas visible</span>
            </button>
            <button onClick={() => { setSelectedQuadrants(['TL', 'TR', 'BL', 'BR']); handleChoice(true, true); }}
              className="py-4 bg-red-500/10 border-2 border-red-500/30 text-red-400 rounded-2xl font-black uppercase text-sm tracking-wider hover:bg-red-500/20 transition-all active:scale-95">
              <span className="text-2xl block mb-1">❌</span>
              Can't See Center
              <span className="block text-[9px] text-red-400/60 normal-case tracking-normal mt-0.5">Center dot or area is missing</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmslerTest;
