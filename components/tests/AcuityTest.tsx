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

type Direction = 'up' | 'down' | 'left' | 'right';
const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

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

// ─── 3 Letter sizes from large to small ───
const LETTER_LEVELS = [
  { sizePx: 300, opacity: 1.00, rowMap: 0 },  // 20/200 — large
  { sizePx: 160, opacity: 1.00, rowMap: 4 },  // 20/40 — medium
  { sizePx: 70,  opacity: 1.00, rowMap: 7 },  // 20/20 — small
];

interface Trial {
  type: 'E' | 'C';
  direction: Direction;
  sizePx: number;
  rowIndex: number;
  label?: string;
  denom?: number;
  opacity?: number;
}

function buildTrialSequence(): Trial[] {
  // Create trials for each size level
  const trials = LETTER_LEVELS.map((level) => {
    const type: 'E' | 'C' = Math.random() > 0.5 ? 'E' : 'C';
    const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    
    return {
      type,
      direction,
      sizePx: level.sizePx,
      rowIndex: level.rowMap,
      opacity: level.opacity,
      label: ROW_TO_SNELLEN[level.rowMap]?.label,
      denom: ROW_TO_SNELLEN[level.rowMap]?.denom,
    };
  });

  // Shuffle the trials so they appear in a random order of sizes
  return trials.sort(() => Math.random() - 0.5);
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



  // AI Bot lifecycle — start immediately
  useEffect(() => {
    if (phase === 'testing') botStart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Voice commands mapping — directions
  const voiceCommands = useMemo(() => {
    const map: Record<string, string> = {
      "can't see": "?", "cant see": "?", "i don't know": "?", "لا أرى": "?", "لا اعرف": "?", "مش شايف": "?"
    };
    map['up'] = 'up'; map['فوق'] = 'up';
    map['down'] = 'down'; map['تحت'] = 'down';
    map['left'] = 'left'; map['يسار'] = 'left'; map['شمال'] = 'left';
    map['right'] = 'right'; map['يمين'] = 'right';
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
    const isCorrect = answer === currentTrial.direction;

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

  const rotation = currentTrial.direction === 'right' ? 0 : currentTrial.direction === 'down' ? 90 : currentTrial.direction === 'left' ? 180 : 270;

  if (phase === 'done') return null;

  // ─── Testing Phase UI ───
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: window.innerWidth <= 768 ? 'column' : 'row', gap: 16,
      animation: 'fadeIn 0.5s ease-out', position: 'relative', overflow: 'hidden'
    }}>

      {/* ─── LEFT: Test Info Panel (hidden on mobile) ─── */}
      <div className="hidden md:flex" style={{
        display: window.innerWidth <= 768 ? 'none' : 'flex',
        flexDirection: 'column', gap: 12, alignItems: 'center', width: 300, flexShrink: 0
      }}>
        {/* Test Info Panel */}
        <div style={{
          width: '100%', background: 'var(--bg-card)', backdropFilter: 'blur(12px)',
          borderRadius: 24, border: '1px solid var(--border-color)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{currentTrial.type} Chart</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>
              {currentTrial.label} · {currentTrial.sizePx}px
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--border-color)' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Trial</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' }}>{currentIndex + 1}/{totalTrials}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Type</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' }}>{currentTrial.type === 'E' ? 'Tumbling E' : 'Landolt C'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 4, gap: 8 }}>
            <span style={{
              padding: '4px 12px', borderRadius: 999, fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
              background: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.4)'
            }}>
              BOTH EYES
            </span>
            <span style={{
              padding: '4px 12px', borderRadius: 999, fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
              background: difficultyColor + '20', color: difficultyColor, border: `1px solid ${difficultyColor}40`
            }}>
              {difficultyLabel}
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '0 8px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            <span>Select the direction</span>
          </div>
        </div>
        <AIBotBubble botState={botState} isEyeUncovered={false} coverEye={undefined} isListening={isListening} transcript={transcript} />
      </div>

      {/* ─── RIGHT: Test Content ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative' }}>
        
        {/* Feedback Overlay */}
        {feedback && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)', borderRadius: 32, pointerEvents: 'none'
          }}>
            <div style={{
              width: 128, height: 128, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 60, boxShadow: '0 0 50px rgba(0,0,0,0.5)',
              background: feedback === 'correct' ? '#10b981' : '#ef4444', color: '#fff'
            }}>
              {feedback === 'correct' ? '✅' : '❌'}
            </div>
          </div>
        )}

        {/* Header Bar */}
        <div style={{ flexShrink: 0, padding: '6px 16px' }}>
          <h3 style={{ fontSize: 'clamp(14px, 3vw, 20px)', fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', margin: 0 }}>{t.visual_acuity}</h3>
          <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
            Trial {currentIndex + 1}/{totalTrials} · {currentTrial.label}
          </p>
        </div>

        {/* Progress Bar */}
        <div style={{ flexShrink: 0, padding: '2px 16px' }}>
          <div style={{ width: '100%', background: 'var(--progress-bg)', height: 5, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              background: 'linear-gradient(90deg, #0284c7, #6366f1)', height: '100%',
              transition: 'all 0.5s ease-out', borderRadius: 999, width: `${progressPct}%`
            }} />
          </div>
        </div>

        {/* Optotype Display — High-Contrast Clinical Card */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 12px', overflow: 'hidden' }}>
          <div className="rounded-2xl md:rounded-3xl flex items-center justify-center shadow-xl border-2"
            style={{
              background: '#ffffff',
              borderColor: 'rgba(0,0,0,0.08)',
              padding: 'clamp(8px, 1.5vh, 18px)',
              width: 'min(92%, 360px)',
              height: 'min(92%, 260px)',
              maxHeight: '100%',
            }}>
            <div style={{
              width: 'min(100%, ' + Math.min(currentTrial.sizePx, 200) + 'px)',
              height: 'min(100%, ' + Math.min(currentTrial.sizePx, 200) + 'px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s'
            }}>
              {/* Rotated Optotype — Always Clinical High-Contrast Black */}
              {currentTrial.type === 'E' ? (
                <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', color: '#000000', fill: '#000000', transform: `rotate(${rotation}deg)` }}>
                  <rect x="0" y="0" width="100" height="20" />
                  <rect x="0" y="40" width="100" height="20" />
                  <rect x="0" y="80" width="100" height="20" />
                  <rect x="0" y="0" width="20" height="100" />
                </svg>
              ) : (
                <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: `rotate(${rotation}deg)` }}>
                  <circle cx="50" cy="50" r="50" fill="#000000" />
                  <circle cx="50" cy="50" r="30" fill="#ffffff" />
                  <rect x="50" y="40" width="55" height="20" fill="#ffffff" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Answer Buttons */}
        <div style={{ flexShrink: 0, padding: '6px 16px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxWidth: 360, margin: '0 auto'
          }}>
            {DIRECTIONS.map(dir => (
              <button
                key={dir}
                onClick={() => handleSelect(dir)}
                style={{
                  padding: '6px 0', background: 'var(--bg-card)', backdropFilter: 'blur(10px)',
                  border: `2px solid ${activeButton === dir ? 'var(--accent)' : 'var(--border-color)'}`,
                  borderRadius: 16, fontSize: 22, transition: 'all 0.2s', cursor: 'pointer',
                  boxShadow: activeButton === dir ? '0 0 20px rgba(2, 132, 199, 0.35)' : 'none',
                  transform: activeButton === dir ? 'scale(1.05)' : 'scale(1)'
                }}
              >
                <span style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
                  {dir === 'up' && '⬆️'}
                  {dir === 'down' && '⬇️'}
                  {dir === 'left' && '⬅️'}
                  {dir === 'right' && '➡️'}
                </span>
              </button>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <button
              onClick={() => handleSelect('?')}
              style={{
                padding: '5px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 999, fontSize: 9, color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase',
                letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              Can't See
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 3, fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span>Voice: Say "Up", "Down", "Left", "Right" or "can't see"</span>
            {isListening && <span style={{ color: '#10b981', fontWeight: 'bold' }}>🎤 Listening</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcuityTest;
