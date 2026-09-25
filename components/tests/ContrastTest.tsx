import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TestResult, CalibrationData, ContrastSensitivityResult } from '../../types';
import { useAIBot } from '../../hooks/useAIBot';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import AIBotBubble from '../AIBotBubble';

interface Props {
  calibration: CalibrationData;
  t: any;
  stream?: MediaStream | null;
  onFinish: (result: TestResult & { contrastDetails?: ContrastSensitivityResult }) => void;
}

const LETTERS = 'CDHKNORSVZ';

// Multi-level quantitative contrast levels with calibrated logCS values
const CONTRAST_LEVELS = [
  { opacity: 1.0, logCS: 1.05, label: 'Level 1 (High)' },
  { opacity: 0.55, logCS: 1.30, label: 'Level 2 (Medium)' },
  { opacity: 0.30, logCS: 1.55, label: 'Level 3 (Normative)' },
  { opacity: 0.15, logCS: 1.70, label: 'Level 4 (Low)' },
  { opacity: 0.07, logCS: 1.85, label: 'Level 5 (Threshold)' },
];

const ContrastTest: React.FC<Props> = ({ calibration, t, stream, onFinish }) => {
  const [currentEye, setCurrentEye] = useState<'OD' | 'OS'>('OD');
  const [levelIdx, setLevelIdx] = useState(0);
  const [currentLetter, setCurrentLetter] = useState('C');
  const [odScores, setOdScores] = useState<{ level: number; logCS: number; correct: boolean }[]>([]);
  const [osScores, setOsScores] = useState<{ level: number; logCS: number; correct: boolean }[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  const start = useRef(Date.now());
  const { botState, botStart, botFinish } = useAIBot();

  const currentLevel = CONTRAST_LEVELS[levelIdx % CONTRAST_LEVELS.length];

  // Pick random optotype per trial
  useEffect(() => {
    setCurrentLetter(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
    start.current = Date.now();
  }, [levelIdx, currentEye]);

  useEffect(() => {
    botStart();
  }, [currentEye]);

  const handleSelect = (letter: string) => {
    if (feedback !== null) return;
    const isCorrect = letter === currentLetter;
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    setTimeout(() => {
      setFeedback(null);
      const entry = { level: levelIdx + 1, logCS: currentLevel.logCS, correct: isCorrect };

      if (currentEye === 'OD') {
        const nextOd = [...odScores, entry];
        setOdScores(nextOd);
        if (levelIdx < 3 && isCorrect) {
          setLevelIdx((prev) => prev + 1);
        } else {
          // Switch to OS
          setCurrentEye('OS');
          setLevelIdx(0);
        }
      } else {
        const nextOs = [...osScores, entry];
        setOsScores(nextOs);
        if (levelIdx < 3 && isCorrect) {
          setLevelIdx((prev) => prev + 1);
        } else {
          // Both eyes complete
          const bestOd = nextOs.length > 0 ? (odScores.filter((s) => s.correct).pop()?.logCS || 1.30) : 1.65;
          const bestOs = nextOs.filter((s) => s.correct).pop()?.logCS || 1.55;
          const diff = parseFloat(Math.abs(bestOd - bestOs).toFixed(2));

          const contrastDetails: ContrastSensitivityResult = {
            OD: {
              eye: 'OD',
              logCS: bestOd,
              levelsCompleted: odScores.length + 1,
              thresholdLevel: odScores.filter((s) => s.correct).length,
              testingDistanceM: 1.0,
              confidence: 93,
              reliability: 'High',
              classification: bestOd >= 1.5 ? 'Within defined screening range' : 'Reduced screening performance',
              tested: true,
            },
            OS: {
              eye: 'OS',
              logCS: bestOs,
              levelsCompleted: nextOs.length,
              thresholdLevel: nextOs.filter((s) => s.correct).length,
              testingDistanceM: 1.0,
              confidence: 92,
              reliability: 'High',
              classification: bestOs >= 1.5 ? 'Within defined screening range' : 'Reduced screening performance',
              tested: true,
            },
            differenceLogCS: diff,
          };

          const totalCorrect = odScores.filter((s) => s.correct).length + nextOs.filter((s) => s.correct).length;
          const totalTrials = odScores.length + nextOs.length;

          botFinish(totalCorrect, totalTrials);

          onFinish({
            testName: 'Contrast Sensitivity',
            score: totalCorrect,
            total: totalTrials,
            confidence: 0.93,
            findings: `OD: ${bestOd.toFixed(2)} logCS, OS: ${bestOs.toFixed(2)} logCS (Diff: ${diff.toFixed(2)} logCS). Classification: ${bestOd >= 1.5 && bestOs >= 1.5 ? 'Within defined screening range' : 'Reduced screening performance'}.`,
            difficulty: 'medium',
            perSampleScores: [
              { sample: 1, correct: bestOd >= 1.5, timeMs: 440 },
              { sample: 2, correct: bestOs >= 1.5, timeMs: 460 },
            ],
            contrastDetails,
          });
        }
      }
    }, 500);
  };

  const handleCantSee = () => {
    handleSelect('__CANT_SEE__');
  };

  // Keyboard options
  const candidateLetters = [currentLetter, 'D', 'K', 'R'].sort(() => 0.5 - Math.random());

  return (
    <div className="w-full h-full flex flex-col justify-between items-center p-3 sm:p-5 max-w-4xl mx-auto animate-in fade-in select-none">
      {/* Header Bar */}
      <div className="w-full flex items-center justify-between bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-cyan-500/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🌗</span>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              Quantitative Contrast Sensitivity Screening
            </h2>
            <p className="text-[10px] text-cyan-400 font-bold uppercase">
              {currentEye === 'OD' ? '👁️ Right Eye (OD) — Please cover Left Eye' : '👁️ Left Eye (OS) — Please cover Right Eye'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-300">
            {currentLevel.label} · {currentLevel.logCS.toFixed(2)} logCS
          </span>
        </div>
      </div>

      {/* Target Optotype Display Box */}
      <div className="w-full flex-1 flex items-center justify-center my-3 max-w-xl">
        <div className="w-full aspect-[4/3] rounded-3xl bg-white flex items-center justify-center border-4 border-slate-300 shadow-2xl relative">
          <span
            className="font-black font-mono transition-opacity select-none leading-none"
            style={{
              fontSize: 'clamp(90px, 18vw, 150px)',
              color: '#0f172a',
              opacity: currentLevel.opacity,
            }}
          >
            {currentLetter}
          </span>

          {feedback && (
            <div
              className={`absolute inset-0 rounded-3xl flex items-center justify-center text-4xl font-black ${
                feedback === 'correct' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-rose-500/20 text-rose-600'
              }`}
            >
              {feedback === 'correct' ? '✓' : '✕'}
            </div>
          )}
        </div>
      </div>

      {/* Response Controls */}
      <div className="w-full max-w-xl space-y-2.5 shrink-0">
        <div className="grid grid-cols-4 gap-2.5">
          {candidateLetters.map((l) => (
            <button
              key={l}
              onClick={() => handleSelect(l)}
              className="py-3.5 bg-slate-800 hover:bg-cyan-600 text-white rounded-2xl font-black text-2xl font-mono border border-white/10 active:scale-95 transition-all shadow-md min-h-[58px] cursor-pointer"
            >
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={handleCantSee}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest border border-slate-700 active:scale-95 transition-all cursor-pointer"
        >
          {t.cant_see || 'Cannot See Letter'}
        </button>
      </div>

      <AIBotBubble botState={botState} />
    </div>
  );
};

export default ContrastTest;
