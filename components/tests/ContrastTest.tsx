import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TestResult, CalibrationData } from '../../types';

import { useAIBot } from '../../hooks/useAIBot';
import { useEyeCoverDetection } from '../../hooks/useEyeCoverDetection';
import AIBotBubble from '../AIBotBubble';

interface Props {
  calibration: CalibrationData;
  t: any;
  stream?: MediaStream | null;
  onFinish: (result: TestResult) => void;
}

const LETTERS = "CDHKNORSVZ";

// 15 Contrast Levels per eye (Logarithmic gradient from 100% to ~1%)
const CONTRAST_LEVELS = [
  1.0, 0.82, 0.67, 0.55, 0.45, 0.37, 0.30, 0.24,
  0.19, 0.15, 0.11, 0.08, 0.05, 0.03, 0.01
];

const SAMPLES_PER_EYE = 15;

type Phase = 'cover-right' | 'testing-right' | 'switch-eye' | 'testing-left' | 'done';

const ContrastTest: React.FC<Props> = ({ calibration, t, stream, onFinish }) => {
  const [phase, setPhase] = useState<Phase>('cover-right');
  const [level, setLevel] = useState(0);
  const [currentLetter, setCurrentLetter] = useState('');
  const [countdown, setCountdown] = useState(5);

  const [rightResults, setRightResults] = useState<{ correct: boolean; timeMs: number; level: number }[]>([]);
  const [leftResults, setLeftResults] = useState<{ correct: boolean; timeMs: number; level: number }[]>([]);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const start = useRef(Date.now());
  const cameraRef = useRef<HTMLVideoElement>(null);
  const coverCanvasRef = useRef<HTMLCanvasElement>(null);

  const isTesting = phase === 'testing-right' || phase === 'testing-left';

  const { isEyeUncovered } = useEyeCoverDetection({ phase, isTesting, cameraRef, coverCanvasRef, stream });
  const { botState, botStart, botSwitchEye, botRecordTrial, botFinish } = useAIBot();

  // Generate a random letter for each level
  useEffect(() => {
    if (isTesting) {
      setCurrentLetter(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
      start.current = Date.now();
    }
  }, [level, phase, isTesting]);

  // Camera setup — depend on isTesting so stream attaches when video mounts
  useEffect(() => {
    const vid = cameraRef.current;
    if (!vid || !stream) return;
    if (vid.srcObject !== stream) vid.srcObject = stream;
    vid.play().catch(() => { });
  }, [stream, isTesting]);

  // Countdown for cover and switch phases
  useEffect(() => {
    if (phase !== 'cover-right' && phase !== 'switch-eye') return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          if (phase === 'cover-right') setPhase('testing-right');
          else setPhase('testing-left');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Reset level when switching to left eye
  useEffect(() => {
    if (phase === 'testing-left') {
      setLevel(0);
      start.current = Date.now();
    }
  }, [phase]);

  // AI Bot lifecycle
  useEffect(() => {
    if (phase === 'testing-right') botStart();
    if (phase === 'switch-eye') {
      const rightOk = rightResults.filter(r => r.correct).length;
      botSwitchEye(rightOk, rightResults.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleSelect = useCallback((letter: string) => {
    if (!isTesting || isEyeUncovered) return;
    setActiveButton(letter);
    setTimeout(() => setActiveButton(null), 250);

    const timeMs = Date.now() - start.current;
    const isCorrect = letter === currentLetter;
    botRecordTrial(isCorrect, level, SAMPLES_PER_EYE);
    const entry = { correct: isCorrect, timeMs, level };

    if (phase === 'testing-right') {
      const updated = [...rightResults, entry];
      setRightResults(updated);
      if (!isCorrect || level >= SAMPLES_PER_EYE - 1) {
        setPhase('switch-eye');
        return;
      }
    } else {
      const updated = [...leftResults, entry];
      setLeftResults(updated);
      if (!isCorrect || level >= SAMPLES_PER_EYE - 1) {
        finishTest(rightResults, updated);
        return;
      }
    }
    setLevel(l => l + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentLetter, level, rightResults, leftResults, isTesting]);

  const handleCantSee = useCallback(() => {
    if (!isTesting || isEyeUncovered) return;
    const timeMs = Date.now() - start.current;
    botRecordTrial(false, level, SAMPLES_PER_EYE);
    const entry = { correct: false, timeMs, level };

    if (phase === 'testing-right') {
      setRightResults(prev => [...prev, entry]);
      setPhase('switch-eye');
    } else {
      const updated = [...leftResults, entry];
      setLeftResults(updated);
      finishTest(rightResults, updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, level, rightResults, leftResults, isTesting]);

  const finishTest = (rRes: typeof rightResults, lRes: typeof leftResults) => {
    setPhase('done');
    const rightLevel = rRes.filter(r => r.correct).length;
    const leftLevel = lRes.filter(r => r.correct).length;
    const bestLevel = Math.max(rightLevel, leftLevel);
    const totalCorrect = rightLevel + leftLevel;
    const totalAttempted = rRes.length + lRes.length;
    const allTimes = [...rRes.map(r => r.timeMs), ...lRes.map(r => r.timeMs)];

    const rightCS = rightLevel > 0 ? -Math.log10(CONTRAST_LEVELS[rightLevel - 1]) : 0;
    const leftCS = leftLevel > 0 ? -Math.log10(CONTRAST_LEVELS[leftLevel - 1]) : 0;
    const difficulty = bestLevel >= 10 ? 'hard' : bestLevel >= 5 ? 'medium' : 'easy';

    let findings: string;
    if (bestLevel >= 12) {
      findings = `Excellent contrast sensitivity — Right eye: level ${rightLevel}/${SAMPLES_PER_EYE} (logCS ${rightCS.toFixed(2)}), Left eye: level ${leftLevel}/${SAMPLES_PER_EYE} (logCS ${leftCS.toFixed(2)}). Superior contrast discrimination.`;
    } else if (bestLevel >= 8) {
      findings = `Good contrast sensitivity — Right eye: level ${rightLevel}/${SAMPLES_PER_EYE}, Left eye: level ${leftLevel}/${SAMPLES_PER_EYE}. Normal range.`;
    } else if (bestLevel >= 4) {
      findings = `Reduced contrast sensitivity — Right eye: level ${rightLevel}/${SAMPLES_PER_EYE}, Left eye: level ${leftLevel}/${SAMPLES_PER_EYE}. Monitoring recommended.`;
    } else {
      findings = `Low contrast sensitivity — Right eye: level ${rightLevel}/${SAMPLES_PER_EYE}, Left eye: level ${leftLevel}/${SAMPLES_PER_EYE}. Professional evaluation recommended.`;
    }

    botFinish(totalCorrect, totalAttempted);

    onFinish({
      testName: 'Contrast Sensitivity',
      score: totalCorrect,
      total: totalAttempted,
      confidence: 0.9,
      findings,
      difficulty: difficulty as 'easy' | 'medium' | 'hard',
      timestamps: allTimes,
      perSampleScores: [...rRes, ...lRes].map((r, i) => ({ sample: i + 1, correct: r.correct, timeMs: r.timeMs })),
      rawResponseTimes: allTimes,
    });
  };



  const currentEyeLabel = phase === 'testing-right' || phase === 'cover-right' ? 'RIGHT EYE' : 'LEFT EYE';
  const progressPct = isTesting ? ((level + 1) / SAMPLES_PER_EYE) * 100 : 0;
  const difficultyLabel = level < 5 ? 'EASY' : level < 10 ? 'MEDIUM' : 'HARD';
  const difficultyColor = level < 5 ? '#10b981' : level < 10 ? '#f59e0b' : '#ef4444';

  // ─── Cover Eye Screen ───
  if (phase === 'cover-right') {
    return (
      <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-700">
        <div className="flex flex-col items-center gap-6 text-center p-8 max-w-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-sm font-black text-black">1</div>
            <div className="w-16 h-0.5 bg-slate-700"></div>
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-500">2</div>
          </div>
          <div className="text-6xl animate-pulse">🫣</div>
          <h2 className="text-2xl md:text-3xl font-black text-white">Contrast Sensitivity Test</h2>
          <div className="max-w-md w-full p-4 glass border-2 border-yellow-500/40 rounded-2xl space-y-3">
            <div className="flex items-center gap-3 text-yellow-400">
              <span className="text-2xl">⚠️</span>
              <span className="text-lg font-bold">Cover your LEFT eye</span>
            </div>
            <p className="text-slate-300 text-sm">Testing RIGHT eye first. Letters will fade progressively.</p>
          </div>
          <div className="w-20 h-20 rounded-full border-4 border-cyan-400 flex items-center justify-center bg-cyan-500/10 shadow-[0_0_40px_rgba(6,182,212,0.4)] animate-pulse">
            <span className="text-4xl font-black text-cyan-400">{countdown}</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Switch Eye Screen ───
  if (phase === 'switch-eye') {
    return (
      <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-700">
        <div className="flex flex-col items-center gap-6 text-center p-8 max-w-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-black text-black">✓</div>
            <div className="w-16 h-0.5 bg-cyan-500"></div>
            <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-sm font-black text-black">2</div>
          </div>
          <div className="px-4 py-2 glass rounded-xl border border-emerald-500/30 text-sm">
            <span className="text-slate-400">Right eye — </span>
            <span className="text-emerald-400 font-black">{rightResults.filter(r => r.correct).length}/{rightResults.length} levels passed</span>
          </div>
          <div className="text-6xl animate-pulse">🔄</div>
          <h2 className="text-2xl md:text-3xl font-black text-white">Now Testing LEFT Eye</h2>
          <div className="max-w-md w-full p-4 glass border-2 border-yellow-500/40 rounded-2xl space-y-3">
            <div className="flex items-center gap-3 text-yellow-400">
              <span className="text-2xl">⚠️</span>
              <span className="text-lg font-bold">Cover your RIGHT eye</span>
            </div>
          </div>
          <div className="w-20 h-20 rounded-full border-4 border-cyan-400 flex items-center justify-center bg-cyan-500/10 shadow-[0_0_40px_rgba(6,182,212,0.4)] animate-pulse">
            <span className="text-4xl font-black text-cyan-400">{countdown}</span>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') return null;

  // ─── Testing Phase UI ───
  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-2 md:gap-4 animate-in fade-in duration-500 overflow-x-hidden overflow-y-auto relative">

      {/* ═══ Pause Overlay — Eye Not Covered ═══ */}
      {isEyeUncovered && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-3xl">
          <div className="glass p-8 rounded-3xl border-2 border-red-500/50 text-center max-w-sm animate-in fade-in duration-300">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-2xl font-black text-red-400 mb-2">Eye Not Covered!</h3>
            <p className="text-slate-300 text-sm">
              Please keep your <span className="font-black text-white">{phase === 'testing-right' ? 'LEFT' : 'RIGHT'}</span> eye covered to continue the test.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>
              <span className="text-xs text-red-400 font-bold uppercase tracking-widest">Test Paused</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── LEFT: Camera Feed Panel (hidden on mobile) ─── */}
      <div className="hidden md:flex shrink-0 flex-col gap-3 items-center" style={{ width: 260 }}>
        <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-black border-2 border-cyan-500/20 shadow-[0_0_30px_rgba(0,200,255,0.1)] relative">
          <video ref={cameraRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1] brightness-110" />
          <canvas ref={coverCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <div className="absolute top-2 left-2 glass px-2 py-0.5 rounded-full border border-cyan-500/30 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
            <span className="text-[8px] font-bold text-cyan-400 uppercase tracking-widest">LIVE</span>
          </div>
          <div className="absolute bottom-2 left-2 right-2 glass px-2 py-1 rounded-full border border-white/10 flex items-center justify-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isEyeUncovered ? 'bg-red-400' : 'bg-emerald-400'} animate-pulse`}></div>
            <span className={`text-[7px] font-bold uppercase tracking-widest ${isEyeUncovered ? 'text-red-400' : 'text-emerald-400'}`}>
              {isEyeUncovered ? 'COVER EYE' : '🤖 AI MONITORING'}
            </span>
          </div>
          <div className="absolute inset-0 pointer-events-none p-3">
            <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 rounded-tl-md border-cyan-400/50"></div>
            <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 rounded-tr-md border-cyan-400/50"></div>
            <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 rounded-bl-md border-cyan-400/50"></div>
            <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 rounded-br-md border-cyan-400/50"></div>
          </div>
        </div>

        {/* Test Info */}
        <div className="w-full glass rounded-2xl border border-white/5 p-3 space-y-2">
          <div className="text-center">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contrast</div>
            <div className="text-lg font-black text-white">{(CONTRAST_LEVELS[level] * 100).toFixed(1)}%</div>
          </div>
          <div className="h-px bg-white/5"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Level</span>
            <span className="text-sm font-black text-white">{level + 1}/{SAMPLES_PER_EYE}</span>
          </div>
          <div className="flex items-center justify-center pt-1 gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              {currentEyeLabel}
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
        <AIBotBubble botState={botState} isEyeUncovered={isEyeUncovered} coverEye={phase === 'testing-right' ? 'left' : 'right'} />
      </div>

      {/* ─── RIGHT: Test Content ─── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header Bar */}
        <div className="shrink-0 px-3 md:px-6 py-2 md:py-3">
          <h3 className="text-base md:text-2xl font-black text-white uppercase tracking-tight leading-none">{t.contrast_sensitivity}</h3>
          <p className="text-[10px] md:text-xs text-cyan-400 font-bold uppercase tracking-widest mt-0.5">
            Level {level + 1}/{SAMPLES_PER_EYE} · {currentEyeLabel}
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

        {/* Target Letter on white background */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <div className="w-full h-full flex items-center justify-center bg-white rounded-3xl border-4 border-white/20 relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-white shadow-inner"></div>
            <div
              className="font-black select-none transition-all duration-300 relative z-10 leading-none"
              style={{ opacity: CONTRAST_LEVELS[level], color: '#000', fontSize: 'clamp(5rem, 20vw, 18rem)' }}
            >
              {currentLetter}
            </div>
          </div>
        </div>

        {/* Letter Grid + Can't See */}
        <div className="shrink-0 p-2 md:p-4 pt-0 space-y-2">
          <div className="grid grid-cols-5 gap-1 md:gap-2 max-w-3xl mx-auto">
            {LETTERS.split('').map(l => (
              <button
                key={l}
                onClick={() => handleSelect(l)}
                className={`py-2 md:py-4 glass border-2 rounded-xl md:rounded-2xl font-black text-xl md:text-3xl text-white transition-all active:scale-90
                  ${activeButton === l
                    ? 'border-cyan-400 bg-cyan-500/40 shadow-[0_0_50px_rgba(0,243,255,0.6)]'
                    : 'border-white/10 hover:border-cyan-400 hover:bg-cyan-500/20'}
                `}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            onClick={handleCantSee}
            className="w-full py-2.5 glass border border-white/5 rounded-full text-[10px] md:text-xs text-slate-500 font-black uppercase tracking-[0.4em] hover:text-white transition-colors"
          >
            I cannot see any letter ✗
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContrastTest;
