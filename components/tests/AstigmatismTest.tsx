import React, { useState, useEffect, useRef } from 'react';
import { TestResult } from '../../types';

import { useAIBot } from '../../hooks/useAIBot';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import AIBotBubble from '../AIBotBubble';

interface Props {
  t: any;
  stream?: MediaStream | null;
  onFinish: (result: TestResult) => void;
}

type Pattern = 'clock' | 'starburst' | 'cross' | 'radial' | 'parallel';

const PATTERNS: { key: Pattern; label: string; icon: string }[] = [
  { key: 'clock', label: 'Clock Dial', icon: '\u{1F550}' },
  { key: 'starburst', label: 'Starburst', icon: '\u{2726}' },
  { key: 'cross', label: 'Cross-Cylinder', icon: '\u{271A}' },
  { key: 'radial', label: 'Radial Lines', icon: '\u{2600}' },
  { key: 'parallel', label: 'Parallel Lines', icon: '\u{2261}' },
];

const TOTAL_TRIALS = 3;

type Phase = 'testing' | 'done';

const AstigmatismTest: React.FC<Props> = ({ t, stream, onFinish }) => {
  const [phase, setPhase] = useState<Phase>('testing');
  const [trialIdx, setTrialIdx] = useState(0);
  const [results, setResults] = useState<{ pattern: Pattern; hasIssues: boolean; blurPositions: number[] }[]>([]);
  const [showBlurSelect, setShowBlurSelect] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<number[]>([]);

  const { botState, botStart, botRecordTrial, botFinish } = useAIBot();
  const currentPattern = PATTERNS[trialIdx % PATTERNS.length];

  // AI Bot lifecycle
  useEffect(() => {
    if (phase === 'testing') botStart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voiceCommands = React.useMemo(() => {
    return {
      'clear': 'clear',
      'sharp': 'clear',
      'واضح': 'clear',
      'blur': 'blur',
      'blurry': 'blur',
      'مشوش': 'blur'
    };
  }, []);

  const { isListening, transcript } = useVoiceCommand({
    commands: voiceCommands,
    onCommand: (cmd) => {
      if (showBlurSelect) return;
      if (cmd === 'clear') handleChoice(false);
      else if (cmd === 'blur') handleChoice(true);
    },
    isActive: phase === 'testing' && !showBlurSelect,
  });

  const handleChoice = (hasIssues: boolean, skipPositionSelect = false) => {
    if (hasIssues && !showBlurSelect && !skipPositionSelect) {
      setShowBlurSelect(true);
      return;
    }

    const entry = {
      pattern: currentPattern.key,
      hasIssues,
      blurPositions: hasIssues ? selectedPositions : [],
    };

    const newResults = [...results, entry];
    setResults(newResults);
    botRecordTrial(!hasIssues, trialIdx, TOTAL_TRIALS);
    setShowBlurSelect(false);
    setSelectedPositions([]);

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

    let findings: string;
    if (totalIssues >= 2) {
      findings = `Significant astigmatism indicators \u2014 ${totalIssues}/${TOTAL_TRIALS} blur reports (both eyes). Meridional evaluation strongly recommended.`;
    } else if (totalIssues >= 1) {
      findings = `Mild astigmatism indicators \u2014 ${totalIssues}/${TOTAL_TRIALS} blur reports (both eyes). Monitoring recommended.`;
    } else {
      findings = `Normal focus patterns \u2014 ${totalIssues}/${TOTAL_TRIALS} blur reports (both eyes). No significant astigmatism detected.`;
    }

    botFinish(total - totalIssues, total);

    onFinish({
      testName: 'Astigmatism Dial',
      score: total - totalIssues,
      total,
      confidence: 0.95,
      findings,
      difficulty: totalIssues >= 2 ? 'hard' : 'easy',
      perSampleScores: allResults.map((r, i) => ({ sample: i + 1, correct: !r.hasIssues, timeMs: 0 })),
      rawResponseTimes: [],
    });
  };

  const togglePosition = (pos: number) => {
    setSelectedPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]);
  };

  const progressPct = ((trialIdx + 1) / TOTAL_TRIALS) * 100;

  if (phase === 'done') {
    return (
      <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-5xl">\u2705</div>
          <h2 className="text-2xl font-black text-white">Astigmatism Test Complete</h2>
          <p className="text-slate-400 text-sm">Processing results\u2026</p>
        </div>
      </div>
    );
  }

  // Blur Position Selector
  if (showBlurSelect) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-between p-3 sm:p-5 animate-in fade-in duration-300 overflow-hidden">
        <div className="shrink-0 text-center">
          <h3 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tight">Where is the distortion?</h3>
          <p className="text-[10px] sm:text-xs text-cyan-400 font-bold uppercase tracking-wider mt-0.5">Tap the blurred clock positions</p>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center my-2">
          <div className="relative" style={{ width: 'min(50vw, 220px)', height: 'min(50vw, 220px)' }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = ((i * 30) - 90) * (Math.PI / 180);
              const r = 44;
              const x = 50 + r * Math.cos(angle);
              const y = 50 + r * Math.sin(angle);
              const isSelected = selectedPositions.includes(i + 1);
              return (
                <button key={i} onClick={() => togglePosition(i + 1)}
                  className={`absolute w-8 h-8 rounded-full font-black text-xs transition-all cursor-pointer ${isSelected
                    ? 'bg-red-500/30 border-2 border-red-400 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                    : 'bg-slate-800 text-slate-400 border border-white/10 hover:border-cyan-400'}`}
                  style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
                  {i === 0 ? 12 : i}
                </button>
              );
            })}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
            </div>
          </div>
        </div>
        <button onClick={() => handleChoice(true)}
          className="shrink-0 w-full max-w-md py-3 bg-white text-slate-950 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-cyan-400 transition-all cursor-pointer shadow-lg active:scale-95 min-h-[44px]">
          Confirm ({selectedPositions.length})
        </button>
      </div>
    );
  }

  // Testing Phase UI
  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-500 overflow-hidden relative">

      {/* ═══════════════════ MOBILE LAYOUT (< md) ═══════════════════ */}
      <div className="md:hidden flex flex-col h-full overflow-hidden">
        {/* Compact header */}
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-slate-900/60 backdrop-blur-md border-b border-white/5">
          <div>
            <div className="text-xs font-black text-white uppercase tracking-wide leading-tight">{t.astigmatism_test}</div>
            <div className="text-[10px] text-cyan-400 font-bold uppercase">{currentPattern.icon} {currentPattern.label} · Trial {trialIdx + 1}/{TOTAL_TRIALS}</div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">BOTH EYES</span>
        </div>
        {/* Progress bar */}
        <div className="shrink-0 px-3 py-1.5">
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-500 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        {/* Pattern display */}
        <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-1">
          <div style={{ width: 'min(55vw, 180px)', height: 'min(55vw, 180px)' }} className="bg-white rounded-2xl p-2.5 border-4 border-white/10 shadow-xl">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {currentPattern.key === 'clock' && (
                <>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const angle = (i * 30 * Math.PI) / 180;
                    const x2 = 50 + 38 * Math.cos(angle - Math.PI / 2);
                    const y2 = 50 + 38 * Math.sin(angle - Math.PI / 2);
                    const labelX = 50 + 44 * Math.cos(angle - Math.PI / 2);
                    const labelY = 50 + 44 * Math.sin(angle - Math.PI / 2);
                    return (<g key={i}>
                      <line x1="50" y1="50" x2={x2} y2={y2} stroke="#000" strokeWidth="1" strokeLinecap="round" />
                      <text x={labelX} y={labelY} dominantBaseline="middle" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#333">{i === 0 ? 12 : i}</text>
                    </g>);
                  })}
                  <circle cx="50" cy="50" r="2" fill="#000" />
                </>
              )}
              {currentPattern.key === 'starburst' && (
                <>
                  {Array.from({ length: 36 }).map((_, i) => {
                    const angle = (i * 10 * Math.PI) / 180;
                    return <line key={i} x1="50" y1="50" x2={50 + 42 * Math.cos(angle)} y2={50 + 42 * Math.sin(angle)} stroke="#000" strokeWidth={i % 3 === 0 ? '1.2' : '0.5'} />;
                  })}
                  <circle cx="50" cy="50" r="1" fill="#000" />
                </>
              )}
              {currentPattern.key === 'cross' && (
                <>
                  <line x1="10" y1="50" x2="90" y2="50" stroke="#000" strokeWidth="1.5" />
                  <line x1="50" y1="10" x2="50" y2="90" stroke="#000" strokeWidth="1.5" />
                  <line x1="18" y1="18" x2="82" y2="82" stroke="#000" strokeWidth="1" />
                  <line x1="82" y1="18" x2="18" y2="82" stroke="#000" strokeWidth="1" />
                  {[15, 25, 35].map(r => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#000" strokeWidth="0.4" />)}
                  <circle cx="50" cy="50" r="1.5" fill="#000" />
                </>
              )}
              {currentPattern.key === 'radial' && (
                <>
                  {Array.from({ length: 24 }).map((_, i) => {
                    const angle = (i * 15 * Math.PI) / 180;
                    return <line key={i} x1={50 + 8 * Math.cos(angle)} y1={50 + 8 * Math.sin(angle)} x2={50 + 44 * Math.cos(angle)} y2={50 + 44 * Math.sin(angle)} stroke="#000" strokeWidth={i % 2 === 0 ? '1.5' : '0.6'} />;
                  })}
                  <circle cx="50" cy="50" r="2" fill="#000" />
                </>
              )}
              {currentPattern.key === 'parallel' && (
                <>
                  {Array.from({ length: 8 }).map((_, i) => {
                    const y = 15 + i * 10;
                    return <line key={`h${i}`} x1="10" y1={y} x2="90" y2={y} stroke="#000" strokeWidth="1" />;
                  })}
                  {Array.from({ length: 8 }).map((_, i) => {
                    const x = 15 + i * 10;
                    return <line key={`v${i}`} x1={x} y1="10" x2={x} y2="90" stroke="#000" strokeWidth="0.6" strokeDasharray="2,2" />;
                  })}
                  <circle cx="50" cy="50" r="2" fill="#000" />
                </>
              )}
            </svg>
          </div>
        </div>
        {/* Buttons */}
        <div className="shrink-0 px-3 pb-2 space-y-1.5">
          <p className="text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold">How do all the lines appear?</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleChoice(false)}
              className="py-2 px-2 h-[54px] bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer">
              <span className="text-xl shrink-0">✅</span>
              <div className="text-left">
                <span className="font-black uppercase text-xs block leading-tight">All Sharp</span>
                <span className="block text-[9px] text-emerald-400/80 leading-tight">Equal clarity</span>
              </div>
            </button>
            <button onClick={() => handleChoice(true)}
              className="py-2 px-2 h-[54px] bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 rounded-xl hover:bg-amber-500/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer">
              <span className="text-xl shrink-0">⚠️</span>
              <div className="text-left">
                <span className="font-black uppercase text-xs block leading-tight">Some Blurred</span>
                <span className="block text-[9px] text-amber-400/80 leading-tight">Lines lighter</span>
              </div>
            </button>
            <button onClick={() => { setSelectedPositions([1,2,3,4,5,6]); handleChoice(true, true); }}
              className="py-2 px-2 h-[54px] bg-orange-500/10 border-2 border-orange-500/30 text-orange-400 rounded-xl hover:bg-orange-500/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer">
              <span className="text-xl shrink-0">🌀</span>
              <div className="text-left">
                <span className="font-black uppercase text-xs block leading-tight">Wavy Lines</span>
                <span className="block text-[9px] text-orange-400/80 leading-tight">Lines bend</span>
              </div>
            </button>
            <button onClick={() => { setSelectedPositions([1,2,3,4,5,6,7,8,9,10,11,12]); handleChoice(true, true); }}
              className="py-2 px-2 h-[54px] bg-red-500/10 border-2 border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer">
              <span className="text-xl shrink-0">❌</span>
              <div className="text-left">
                <span className="font-black uppercase text-xs block leading-tight">Distorted</span>
                <span className="block text-[9px] text-red-400/80 leading-tight">Can't see clearly</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════ DESKTOP LAYOUT (≥ md) ═══════════════════ */}
      <div className="hidden md:flex flex-row h-full gap-4 overflow-hidden">
        {/* LEFT: Info Panel */}
        <div className="w-[260px] lg:w-[300px] shrink-0 flex flex-col gap-3 items-center">
          <div className="w-full glass rounded-2xl border border-slate-200 dark:border-white/5 p-3 space-y-2">
            <div className="text-center">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{currentPattern.icon} {currentPattern.label}</div>
            </div>
            <div className="h-px bg-slate-200 dark:bg-white/5"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Trial</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">{trialIdx + 1}/{TOTAL_TRIALS}</span>
            </div>
            <div className="flex items-center justify-center pt-1">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-700 dark:bg-cyan-500/20 dark:text-cyan-400 border border-sky-300 dark:border-cyan-500/40">BOTH EYES</span>
            </div>
          </div>
          <div className="text-center px-2 py-1">
            <div className="text-xs font-black text-sky-700 dark:text-cyan-400 flex items-center gap-1.5 justify-center uppercase tracking-wide">
              <span>Tap &quot;Sharp&quot; or &quot;Blurred&quot; below</span>
            </div>
          </div>
          <div className="w-full">
            <AIBotBubble botState={botState} isEyeUncovered={false} coverEye={undefined} isListening={isListening} transcript={transcript} />
          </div>
        </div>

        {/* RIGHT: Test Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="shrink-0 px-6 py-3">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">{t.astigmatism_test}</h3>
            <p className="text-xs text-sky-700 dark:text-cyan-400 font-bold uppercase tracking-widest mt-0.5">
              {t.astigmatism_desc} &mdash; BOTH EYES
            </p>
          </div>
          <div className="shrink-0 px-6 pt-2">
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-500 rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-3">
            <div className="w-[min(48vw,20vh)] h-[min(48vw,20vh)] max-h-[180px] bg-white rounded-2xl p-2.5 border-4 border-white/10 shadow-xl">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {currentPattern.key === 'clock' && (
                  <>
                    {Array.from({ length: 12 }).map((_, i) => {
                      const angle = (i * 30 * Math.PI) / 180;
                      const x2 = 50 + 38 * Math.cos(angle - Math.PI / 2);
                      const y2 = 50 + 38 * Math.sin(angle - Math.PI / 2);
                      const labelX = 50 + 44 * Math.cos(angle - Math.PI / 2);
                      const labelY = 50 + 44 * Math.sin(angle - Math.PI / 2);
                      return (<g key={i}>
                        <line x1="50" y1="50" x2={x2} y2={y2} stroke="#000" strokeWidth="1" strokeLinecap="round" />
                        <text x={labelX} y={labelY} dominantBaseline="middle" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#333">{i === 0 ? 12 : i}</text>
                      </g>);
                    })}
                    <circle cx="50" cy="50" r="2" fill="#000" />
                  </>
                )}
                {currentPattern.key === 'starburst' && (
                  <>
                    {Array.from({ length: 36 }).map((_, i) => {
                      const angle = (i * 10 * Math.PI) / 180;
                      return <line key={i} x1="50" y1="50" x2={50 + 42 * Math.cos(angle)} y2={50 + 42 * Math.sin(angle)} stroke="#000" strokeWidth={i % 3 === 0 ? '1.2' : '0.5'} />;
                    })}
                    <circle cx="50" cy="50" r="1" fill="#000" />
                  </>
                )}
                {currentPattern.key === 'cross' && (
                  <>
                    <line x1="10" y1="50" x2="90" y2="50" stroke="#000" strokeWidth="1.5" />
                    <line x1="50" y1="10" x2="50" y2="90" stroke="#000" strokeWidth="1.5" />
                    <line x1="18" y1="18" x2="82" y2="82" stroke="#000" strokeWidth="1" />
                    <line x1="82" y1="18" x2="18" y2="82" stroke="#000" strokeWidth="1" />
                    {[15, 25, 35].map(r => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#000" strokeWidth="0.4" />)}
                    <circle cx="50" cy="50" r="1.5" fill="#000" />
                  </>
                )}
                {currentPattern.key === 'radial' && (
                  <>
                    {Array.from({ length: 24 }).map((_, i) => {
                      const angle = (i * 15 * Math.PI) / 180;
                      return <line key={i} x1={50 + 8 * Math.cos(angle)} y1={50 + 8 * Math.sin(angle)} x2={50 + 44 * Math.cos(angle)} y2={50 + 44 * Math.sin(angle)} stroke="#000" strokeWidth={i % 2 === 0 ? '1.5' : '0.6'} />;
                    })}
                    <circle cx="50" cy="50" r="2" fill="#000" />
                  </>
                )}
                {currentPattern.key === 'parallel' && (
                  <>
                    {Array.from({ length: 8 }).map((_, i) => {
                      const y = 15 + i * 10;
                      return <line key={`h${i}`} x1="10" y1={y} x2="90" y2={y} stroke="#000" strokeWidth="1" />;
                    })}
                    {Array.from({ length: 8 }).map((_, i) => {
                      const x = 15 + i * 10;
                      return <line key={`v${i}`} x1={x} y1="10" x2={x} y2="90" stroke="#000" strokeWidth="0.6" strokeDasharray="2,2" />;
                    })}
                    <circle cx="50" cy="50" r="2" fill="#000" />
                  </>
                )}
              </svg>
            </div>
          </div>
          <div className="shrink-0 p-3 pt-0 space-y-1.5">
            <p className="text-center text-xs text-slate-500 uppercase tracking-widest font-bold mb-0.5">How do all the lines appear to you?</p>
            <div className="grid grid-cols-2 gap-2 max-w-xl mx-auto">
              <button onClick={() => handleChoice(false)}
                className="py-2 px-2.5 min-h-[50px] bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 rounded-2xl hover:bg-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 justify-start cursor-pointer">
                <span className="text-2xl shrink-0">✅</span>
                <div className="text-left min-w-0">
                  <span className="font-black uppercase text-sm tracking-wide block leading-tight truncate">All Lines Sharp</span>
                  <span className="block text-[10px] text-emerald-400/80 normal-case tracking-normal leading-tight truncate">Equal clarity</span>
                </div>
              </button>
              <button onClick={() => handleChoice(true)}
                className="py-2 px-2.5 min-h-[50px] bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 rounded-2xl hover:bg-amber-500/20 transition-all active:scale-95 flex items-center gap-2 justify-start cursor-pointer">
                <span className="text-2xl shrink-0">⚠️</span>
                <div className="text-left min-w-0">
                  <span className="font-black uppercase text-sm tracking-wide block leading-tight truncate">Some Blurred</span>
                  <span className="block text-[10px] text-amber-400/80 normal-case tracking-normal leading-tight truncate">Certain lines lighter</span>
                </div>
              </button>
              <button onClick={() => { setSelectedPositions([1,2,3,4,5,6]); handleChoice(true, true); }}
                className="py-2 px-2.5 min-h-[50px] bg-orange-500/10 border-2 border-orange-500/30 text-orange-400 rounded-2xl hover:bg-orange-500/20 transition-all active:scale-95 flex items-center gap-2 justify-start cursor-pointer">
                <span className="text-2xl shrink-0">🌀</span>
                <div className="text-left min-w-0">
                  <span className="font-black uppercase text-sm tracking-wide block leading-tight truncate">Lines Are Wavy</span>
                  <span className="block text-[10px] text-orange-400/80 normal-case tracking-normal leading-tight truncate">Lines bend/curve</span>
                </div>
              </button>
              <button onClick={() => { setSelectedPositions([1,2,3,4,5,6,7,8,9,10,11,12]); handleChoice(true, true); }}
                className="py-2 px-2.5 min-h-[50px] bg-red-500/10 border-2 border-red-500/30 text-red-400 rounded-2xl hover:bg-red-500/20 transition-all active:scale-95 flex items-center gap-2 justify-start cursor-pointer">
                <span className="text-2xl shrink-0">❌</span>
                <div className="text-left min-w-0">
                  <span className="font-black uppercase text-sm tracking-wide block leading-tight truncate">Very Distorted</span>
                  <span className="block text-[10px] text-red-400/80 normal-case tracking-normal leading-tight truncate">Can't see clearly</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AstigmatismTest;
