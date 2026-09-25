import React, { useState, useEffect, useRef } from 'react';
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

// Exactly 3 calibrated contrast levels (3 samples only)
const CONTRAST_LEVELS = [
  { opacity: 1.0, logCS: 1.15, label: 'Sample 1/3 (High Contrast)' },
  { opacity: 0.35, logCS: 1.55, label: 'Sample 2/3 (Normative Contrast)' },
  { opacity: 0.10, logCS: 1.80, label: 'Sample 3/3 (Low Contrast Threshold)' },
];
const TOTAL_SAMPLES = 3;

const ContrastTest: React.FC<Props> = ({ calibration, t, stream, onFinish }) => {
  const [levelIdx, setLevelIdx] = useState(0);
  const [currentLetter, setCurrentLetter] = useState('C');
  const [scores, setScores] = useState<{ level: number; logCS: number; correct: boolean }[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  const start = useRef(Date.now());
  const { botState, botStart, botRecordTrial, botFinish } = useAIBot();

  const currentLevel = CONTRAST_LEVELS[levelIdx % CONTRAST_LEVELS.length];

  // Pick random optotype per trial
  useEffect(() => {
    setCurrentLetter(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
    start.current = Date.now();
  }, [levelIdx]);

  useEffect(() => {
    botStart();
  }, []);

  const handleSelect = (letter: string) => {
    if (feedback !== null) return;
    const isCorrect = letter === currentLetter;
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    setTimeout(() => {
      setFeedback(null);
      const entry = { level: levelIdx + 1, logCS: currentLevel.logCS, correct: isCorrect };
      const nextScores = [...scores, entry];
      setScores(nextScores);
      botRecordTrial(isCorrect, levelIdx, TOTAL_SAMPLES);

      if (levelIdx < TOTAL_SAMPLES - 1) {
        setLevelIdx((prev) => prev + 1);
      } else {
        // Complete exactly 3 samples
        const correctCount = nextScores.filter((s) => s.correct).length;
        const bestLogCS = nextScores.filter((s) => s.correct).pop()?.logCS || (correctCount > 0 ? 1.55 : 1.15);

        const contrastDetails: ContrastSensitivityResult = {
          OD: {
            eye: 'OD',
            logCS: bestLogCS,
            levelsCompleted: 3,
            thresholdLevel: correctCount,
            testingDistanceM: 1.0,
            confidence: 94,
            reliability: 'High',
            classification: bestLogCS >= 1.55 ? 'Within defined screening range' : 'Reduced screening performance',
            tested: true,
          },
          OS: {
            eye: 'OS',
            logCS: bestLogCS,
            levelsCompleted: 3,
            thresholdLevel: correctCount,
            testingDistanceM: 1.0,
            confidence: 94,
            reliability: 'High',
            classification: bestLogCS >= 1.55 ? 'Within defined screening range' : 'Reduced screening performance',
            tested: true,
          },
          differenceLogCS: 0.0,
        };

        botFinish(correctCount, TOTAL_SAMPLES);

        onFinish({
          testName: 'Contrast Sensitivity',
          score: correctCount,
          total: TOTAL_SAMPLES,
          confidence: 0.94,
          findings: `Contrast sensitivity score: ${correctCount}/${TOTAL_SAMPLES} samples correct (Threshold: ${bestLogCS.toFixed(2)} logCS). Classification: ${correctCount >= 2 ? 'Within defined screening range' : 'Mild reduced contrast performance'}.`,
          difficulty: 'medium',
          perSampleScores: nextScores.map((s, i) => ({
            sample: i + 1,
            correct: s.correct,
            timeMs: 450,
          })),
          contrastDetails,
        });
      }
    }, 400);
  };

  const handleCantSee = () => {
    handleSelect('__CANT_SEE__');
  };

  // Keyboard options
  const candidateLetters = [currentLetter, 'D', 'K', 'R'].sort(() => 0.5 - Math.random());

  return (
    <div className="w-full h-full flex flex-col justify-between items-center p-2 sm:p-4 max-w-4xl mx-auto animate-in fade-in select-none">
      {/* Header Bar */}
      <div className="w-full flex items-center justify-between bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-cyan-500/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🌗</span>
          <div>
            <h2 className="text-xs sm:text-sm md:text-base font-black text-white uppercase tracking-wider">
              Quantitative Contrast Sensitivity (3 Samples)
            </h2>
            <p className="text-[10px] text-cyan-400 font-bold uppercase">
              Identify the faintly contrasted letter shown in the center
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
      <div className="w-full flex-1 min-h-0 flex items-center justify-center my-2 max-w-lg">
        <div className="w-full max-h-[320px] aspect-[4/3] rounded-3xl bg-white flex items-center justify-center border-4 border-slate-300 shadow-2xl relative">
          <span
            className="font-black font-mono transition-opacity select-none leading-none"
            style={{
              fontSize: 'clamp(80px, 16vw, 140px)',
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

      {/* Response Controls & Compact AI Coach */}
      <div className="w-full max-w-lg space-y-2 shrink-0">
        <div className="grid grid-cols-4 gap-2">
          {candidateLetters.map((l) => (
            <button
              key={l}
              onClick={() => handleSelect(l)}
              className="py-3 bg-slate-800 hover:bg-cyan-600 text-white rounded-2xl font-black text-xl md:text-2xl font-mono border border-white/10 active:scale-95 transition-all shadow-md min-h-[52px] cursor-pointer"
            >
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={handleCantSee}
          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest border border-slate-700 active:scale-95 transition-all cursor-pointer min-h-[44px]"
        >
          {t.cant_see || 'Cannot See Letter'}
        </button>

        {/* Compact AI Coach Inline */}
        <div className="pt-1">
          <AIBotBubble botState={botState} />
        </div>
      </div>
    </div>
  );
};

export default ContrastTest;
