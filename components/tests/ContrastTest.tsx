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

// 5 Contrast Levels
const CONTRAST_LEVELS = [
  1.0, 0.8, 0.6, 0.4, 0.2
];

const SAMPLES_PER_EYE = 5;

type Phase = 'intro' | 'testing' | 'done';

const ContrastTest: React.FC<Props> = ({ calibration, t, stream, onFinish }) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [level, setLevel] = useState(0);
  const [currentLetter, setCurrentLetter] = useState('');
  const [countdown, setCountdown] = useState(5);

  const [results, setResults] = useState<{ correct: boolean; timeMs: number; level: number }[]>([]);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const start = useRef(Date.now());
  const cameraRef = useRef<HTMLVideoElement>(null);
  const coverCanvasRef = useRef<HTMLCanvasElement>(null);

  const isTesting = phase === 'testing';

  const { botState, botStart, botRecordTrial, botFinish } = useAIBot();

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

  // AI Bot lifecycle
  useEffect(() => {
    if (phase === 'testing') botStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleSelect = useCallback((letter: string) => {
    if (!isTesting || feedback !== null) return;
    setActiveButton(letter);
    setTimeout(() => setActiveButton(null), 250);

    const timeMs = Date.now() - start.current;
    const isCorrect = letter === currentLetter;
    
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    setTimeout(() => {
        setFeedback(null);
        botRecordTrial(isCorrect, level, SAMPLES_PER_EYE);
        const entry = { correct: isCorrect, timeMs, level };

        const updated = [...results, entry];
        setResults(updated);
        if (!isCorrect || level >= SAMPLES_PER_EYE - 1) {
            finishTest(updated);
            return;
        }
        setLevel(l => l + 1);
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentLetter, level, results, isTesting, feedback]);

  const handleCantSee = useCallback(() => {
    if (!isTesting || feedback !== null) return;
    const timeMs = Date.now() - start.current;
    setFeedback('incorrect');

    setTimeout(() => {
        setFeedback(null);
        botRecordTrial(false, level, SAMPLES_PER_EYE);
        const entry = { correct: false, timeMs, level };

        const updated = [...results, entry];
        setResults(updated);
        finishTest(updated);
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, level, results, isTesting, feedback]);

  const finishTest = (finalResults: typeof results) => {
    setPhase('done');
    const correctCount = finalResults.filter(r => r.correct).length;
    const totalAttempted = finalResults.length;
    const allTimes = finalResults.map(r => r.timeMs);

    const cs = correctCount > 0 ? -Math.log10(CONTRAST_LEVELS[correctCount - 1]) : 0;
    const difficulty = correctCount >= 3 ? 'hard' : correctCount >= 2 ? 'medium' : 'easy';

    let findings: string;
    if (correctCount >= 3) {
      findings = `Excellent contrast sensitivity — level ${correctCount}/${SAMPLES_PER_EYE} (logCS ${cs.toFixed(2)}) (both eyes). Superior contrast discrimination.`;
    } else if (correctCount >= 2) {
      findings = `Good contrast sensitivity — level ${correctCount}/${SAMPLES_PER_EYE} (both eyes). Normal range.`;
    } else if (correctCount >= 1) {
      findings = `Reduced contrast sensitivity — level ${correctCount}/${SAMPLES_PER_EYE} (both eyes). Monitoring recommended.`;
    } else {
      findings = `Low contrast sensitivity — level ${correctCount}/${SAMPLES_PER_EYE} (both eyes). Professional evaluation recommended.`;
    }

    botFinish(correctCount, totalAttempted);

    onFinish({
      testName: 'Contrast Sensitivity',
      score: correctCount,
      total: totalAttempted,
      confidence: 0.9,
      findings,
      difficulty: difficulty as 'easy' | 'medium' | 'hard',
      timestamps: allTimes,
      perSampleScores: finalResults.map((r, i) => ({ sample: i + 1, correct: r.correct, timeMs: r.timeMs })),
      rawResponseTimes: allTimes,
    });
  };



  const currentEyeLabel = phase === 'testing-right' || phase === 'cover-right' ? 'RIGHT EYE' : 'LEFT EYE';
  const progressPct = isTesting ? ((level + 1) / SAMPLES_PER_EYE) * 100 : 0;
  const difficultyLabel = level < 1 ? 'EASY' : level < 2 ? 'MEDIUM' : 'HARD';
  const difficultyColor = level < 1 ? '#10b981' : level < 2 ? '#f59e0b' : '#ef4444';

  // ─── Cover Eye Screen ───
  if (phase === 'intro') {
    return (
      <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-700">
        <div className="flex flex-col items-center gap-6 text-center p-8 max-w-lg">
          <div className="text-6xl animate-pulse">👁️</div>
          <h2 className="text-2xl md:text-3xl font-black text-white">Contrast Sensitivity Test</h2>
          <div className="max-w-md w-full p-4 glass border-2 border-cyan-500/40 rounded-2xl space-y-3">
            <p className="text-slate-300 text-sm">Testing both eyes together. Letters will fade progressively.</p>
          </div>
          <button
              onClick={() => { setPhase('testing'); start.current = Date.now(); }}
              className="w-full max-w-md py-4 bg-white text-slate-950 rounded-2xl font-black text-xl hover:bg-cyan-400 transition-colors uppercase tracking-widest mt-4">
              Start Test
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done') return null;

  // ─── Testing Phase UI ───
  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-2 md:gap-4 animate-in fade-in duration-500 overflow-x-hidden overflow-y-auto relative">

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
            <div className={`w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse`}></div>
            <span className={`text-[7px] font-bold uppercase tracking-widest text-emerald-400`}>
              🤖 AI MONITORING
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
      <div className="flex-1 flex flex-col glass rounded-[2rem] border border-white/10 bg-slate-900/40 overflow-hidden relative">
        
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
          <h3 className="text-base md:text-2xl font-black text-white uppercase tracking-tight leading-none">{t.contrast_sensitivity}</h3>
          <p className="text-[10px] md:text-xs text-cyan-400 font-bold uppercase tracking-widest mt-0.5">
            Level {level + 1}/{SAMPLES_PER_EYE} · BOTH EYES
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
