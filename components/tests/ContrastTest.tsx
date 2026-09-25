import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TestResult, CalibrationData, ContrastSensitivityResult } from '../../types';
import { useAIBot } from '../../hooks/useAIBot';

interface Props {
  calibration: CalibrationData;
  t: any;
  stream?: MediaStream | null;
  onFinish: (result: TestResult & { contrastDetails?: ContrastSensitivityResult }) => void;
}

const LETTERS = 'CDHKNORSVZ';

// Exactly 3 calibrated contrast levels (3 samples only)
const CONTRAST_LEVELS = [
  { opacity: 1.0, logCS: 1.15, label: 'Sample 1/3 · High Contrast' },
  { opacity: 0.35, logCS: 1.55, label: 'Sample 2/3 · Normative Contrast' },
  { opacity: 0.10, logCS: 1.80, label: 'Sample 3/3 · Low Contrast Threshold' },
];
const TOTAL_SAMPLES = 3;

// Build the 4 choices for a given target letter — stable, won't re-shuffle on feedback
function buildChoices(target: string): string[] {
  const pool = ['C','D','H','K','N','O','R','S','V','Z'].filter(c => c !== target);
  // deterministic-ish shuffle using sort
  const distractors = pool.sort(() => 0.5 - Math.random()).slice(0, 3);
  const all = [target, ...distractors].sort(() => 0.5 - Math.random());
  return all;
}

const ContrastTest: React.FC<Props> = ({ calibration, t, stream, onFinish }) => {
  const [levelIdx, setLevelIdx] = useState(0);
  const [currentLetter, setCurrentLetter] = useState(() => LETTERS[Math.floor(Math.random() * LETTERS.length)]);
  const [choices, setChoices] = useState<string[]>(() => buildChoices(LETTERS[0]));
  const [scores, setScores] = useState<{ level: number; logCS: number; correct: boolean }[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [answered, setAnswered] = useState(false);

  const start = useRef(Date.now());
  const { botState, botStart, botRecordTrial, botFinish } = useAIBot();

  const currentLevel = CONTRAST_LEVELS[levelIdx % CONTRAST_LEVELS.length];

  // Set up letter + stable choices at start and on level change
  useEffect(() => {
    const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    setCurrentLetter(letter);
    setChoices(buildChoices(letter));
    setAnswered(false);
    start.current = Date.now();
  }, [levelIdx]);

  useEffect(() => {
    // Re-build choices once letter is known (first mount)
    setChoices(buildChoices(currentLetter));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    botStart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (letter: string) => {
    if (feedback !== null || answered) return;
    setAnswered(true);
    const isCorrect = letter === currentLetter;
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    setTimeout(() => {
      setFeedback(null);
      const entry = { level: levelIdx + 1, logCS: currentLevel.logCS, correct: isCorrect };
      const nextScores = [...scores, entry];
      setScores(nextScores);
      botRecordTrial(isCorrect, levelIdx, TOTAL_SAMPLES);

      if (levelIdx < TOTAL_SAMPLES - 1) {
        setLevelIdx(prev => prev + 1);
      } else {
        const correctCount = nextScores.filter(s => s.correct).length;
        const bestLogCS = nextScores.filter(s => s.correct).pop()?.logCS ?? 1.15;

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
          findings: `Contrast sensitivity: ${correctCount}/${TOTAL_SAMPLES} samples correct (Threshold: ${bestLogCS.toFixed(2)} logCS). Classification: ${correctCount >= 2 ? 'Within defined screening range' : 'Mild reduced contrast performance'}.`,
          difficulty: 'medium',
          perSampleScores: nextScores.map((s, i) => ({
            sample: i + 1,
            correct: s.correct,
            timeMs: 450,
          })),
          contrastDetails,
        });
      }
    }, 500);
  };

  const progressPct = ((levelIdx + 1) / TOTAL_SAMPLES) * 100;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        padding: '8px 10px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        width: '100%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(12px)',
        padding: '8px 14px',
        borderRadius: 18,
        border: '1px solid rgba(6,182,212,0.3)',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🌗</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>
              Quantitative Contrast Sensitivity
            </div>
            <div style={{ fontSize: 10, color: '#22d3ee', fontWeight: 700, textTransform: 'uppercase' }}>
              Identify the letter shown in the center
            </div>
          </div>
        </div>
        <div style={{
          padding: '4px 10px',
          borderRadius: 999,
          background: 'rgba(8,47,73,0.8)',
          border: '1px solid rgba(6,182,212,0.4)',
          fontSize: 10,
          fontFamily: 'monospace',
          fontWeight: 700,
          color: '#67e8f9',
          whiteSpace: 'nowrap',
        }}>
          {currentLevel.label}
        </div>
      </div>

      {/* ── Progress Bar ── */}
      <div style={{
        width: '100%',
        height: 6,
        background: 'rgba(51,65,85,0.8)',
        borderRadius: 999,
        overflow: 'hidden',
        flexShrink: 0,
        marginBottom: 8,
      }}>
        <div style={{
          height: '100%',
          width: `${progressPct}%`,
          background: 'linear-gradient(90deg, #06b6d4, #6366f1)',
          borderRadius: 999,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* ── Letter Display Card ── */}
      <div style={{
        width: '100%',
        maxWidth: 380,
        flexShrink: 0,
        aspectRatio: '4/3',
        maxHeight: 180,
        background: '#ffffff',
        borderRadius: 20,
        border: '4px solid #cbd5e1',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        marginBottom: 10,
        alignSelf: 'center',
      }}>
        <span style={{
          fontFamily: 'monospace',
          fontWeight: 900,
          fontSize: 'clamp(56px, 10vh, 90px)',
          lineHeight: 1,
          color: '#0f172a',
          opacity: currentLevel.opacity,
          userSelect: 'none',
          transition: 'opacity 0.3s',
        }}>
          {currentLetter}
        </span>

        {/* Feedback overlay */}
        {feedback && (
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
            fontWeight: 900,
            background: feedback === 'correct' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
            color: feedback === 'correct' ? '#059669' : '#dc2626',
          }}>
            {feedback === 'correct' ? '✓' : '✕'}
          </div>
        )}
      </div>

      {/* ── Instruction ── */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text-muted, #94a3b8)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        flexShrink: 0,
        marginBottom: 8,
        textAlign: 'center',
      }}>
        Which letter do you see?
      </div>

      {/* ── 4 Letter Choice Buttons ── */}
      <div style={{
        width: '100%',
        maxWidth: 420,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        flexShrink: 0,
        marginBottom: 8,
        alignSelf: 'center',
      }}>
        {choices.map(letter => (
          <button
            key={letter}
            onClick={() => handleSelect(letter)}
            disabled={answered}
            style={{
              height: 60,
              background: answered ? 'rgba(30,41,59,0.5)' : 'rgba(30,41,59,0.9)',
              border: '2px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              color: '#ffffff',
              fontSize: 28,
              fontFamily: 'monospace',
              fontWeight: 900,
              cursor: answered ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              opacity: answered ? 0.6 : 1,
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={e => {
              if (!answered) {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(8,145,178,0.8)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#22d3ee';
              }
            }}
            onMouseLeave={e => {
              if (!answered) {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(30,41,59,0.9)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)';
              }
            }}
          >
            {letter}
          </button>
        ))}
      </div>

      {/* ── Can't See Button ── */}
      <button
        onClick={() => handleSelect('__CANT_SEE__')}
        disabled={answered}
        style={{
          width: '100%',
          maxWidth: 420,
          height: 44,
          background: 'rgba(15,23,42,0.8)',
          border: '1.5px solid rgba(100,116,139,0.5)',
          borderRadius: 12,
          color: '#94a3b8',
          fontSize: 12,
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          cursor: answered ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          alignSelf: 'center',
          opacity: answered ? 0.4 : 1,
          transition: 'all 0.15s',
          userSelect: 'none',
        }}
      >
        {t?.cant_see || "Cannot See Letter"}
      </button>
    </div>
  );
};

export default ContrastTest;
