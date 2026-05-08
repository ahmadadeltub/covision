
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language, AcuityTrial, AcuityResult, DistanceStatus } from '../types';
import { translations } from '../translations';


/**
 * Adaptive Tumbling E Visual Acuity Test
 * 
 * Algorithm (Staircase Procedure):
 * - Uses logMAR scale: 1.0 (6/60) down to 0.0 (6/6)
 * - Starts at logMAR 0.7 (approximately 6/30)
 * - Correct → decrease logMAR by 0.1 (smaller E)
 * - Wrong → increase logMAR by 0.2 (larger E, 2-up/1-down for reliability)
 * - 15 total trials
 * - Each trial has a 8-second timeout
 * - Final score = logMAR at last reversal average
 * 
 * Snellen mapping (metric):
 *   logMAR 1.0 = 6/60    logMAR 0.5 = 6/18
 *   logMAR 0.9 = 6/48    logMAR 0.4 = 6/15
 *   logMAR 0.8 = 6/38    logMAR 0.3 = 6/12
 *   logMAR 0.7 = 6/30    logMAR 0.2 = 6/9
 *   logMAR 0.6 = 6/24    logMAR 0.1 = 6/7.5
 *                         logMAR 0.0 = 6/6
 */

interface Props {
    lang: Language;
    distanceStatus: DistanceStatus;
    distanceComplianceLog: boolean[];
    onComplete: (result: AcuityResult) => void;
}

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
type Direction = typeof DIRECTIONS[number];

// logMAR levels and their Snellen equivalents
const LOGMAR_LEVELS = [
    { logMAR: 1.0, snellen: '6/60', sizePx: 180 },
    { logMAR: 0.9, snellen: '6/48', sizePx: 150 },
    { logMAR: 0.8, snellen: '6/38', sizePx: 125 },
    { logMAR: 0.7, snellen: '6/30', sizePx: 105 },
    { logMAR: 0.6, snellen: '6/24', sizePx: 85 },
    { logMAR: 0.5, snellen: '6/18', sizePx: 70 },
    { logMAR: 0.4, snellen: '6/15', sizePx: 55 },
    { logMAR: 0.3, snellen: '6/12', sizePx: 44 },
    { logMAR: 0.2, snellen: '6/9', sizePx: 34 },
    { logMAR: 0.1, snellen: '6/7.5', sizePx: 26 },
    { logMAR: 0.0, snellen: '6/6', sizePx: 20 },
];

const TOTAL_TRIALS = 15;
const TIMEOUT_SECONDS = 8;
const START_LEVEL = 3; // logMAR 0.7 = 6/30

const TumblingETest: React.FC<Props> = ({ lang, distanceStatus, distanceComplianceLog, onComplete }) => {
    const t = translations[lang];

    const [currentTrial, setCurrentTrial] = useState(0);
    const [levelIndex, setLevelIndex] = useState(START_LEVEL);
    const [direction, setDirection] = useState<Direction>('right');
    const [trials, setTrials] = useState<AcuityTrial[]>([]);
    const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECONDS);
    const [isPaused, setIsPaused] = useState(false);
    const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);

    const trialStartRef = useRef(Date.now());
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const reversalsRef = useRef<number[]>([]);
    const lastDirectionRef = useRef<'up_level' | 'down_level' | null>(null);

    // Generate random direction for new trial
    const newDirection = useCallback((): Direction => {
        return DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    }, []);

    // Initialize first trial
    useEffect(() => {
        setDirection(newDirection());
        trialStartRef.current = Date.now();
    }, []);

    // Timer countdown
    useEffect(() => {
        if (isPaused || currentTrial >= TOTAL_TRIALS) return;

        setTimeLeft(TIMEOUT_SECONDS);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // Timeout — treat as wrong
                    handleAnswer('timeout');
                    return TIMEOUT_SECONDS;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [currentTrial, isPaused]);

    // Pause when too close
    useEffect(() => {
        setIsPaused(distanceStatus === 'too_close');
    }, [distanceStatus]);

    const handleAnswer = useCallback((answer: Direction | 'timeout') => {
        if (timerRef.current) clearInterval(timerRef.current);

        const responseTime = Date.now() - trialStartRef.current;
        const isCorrect = answer === direction && answer !== 'timeout';

        const trial: AcuityTrial = {
            trialNumber: currentTrial + 1,
            logMAR: LOGMAR_LEVELS[levelIndex].logMAR,
            direction,
            userAnswer: answer,
            correct: isCorrect,
            responseTimeMs: responseTime,
        };

        const newTrials = [...trials, trial];
        setTrials(newTrials);

        // Show feedback briefly
        setShowFeedback(isCorrect ? 'correct' : 'wrong');
        setTimeout(() => setShowFeedback(null), 400);

        // Adaptive staircase logic
        let newLevel = levelIndex;
        if (isCorrect) {
            // Correct → smaller E (higher index)
            newLevel = Math.min(levelIndex + 1, LOGMAR_LEVELS.length - 1);
            // Track reversal
            if (lastDirectionRef.current === 'up_level') {
                reversalsRef.current.push(levelIndex);
            }
            lastDirectionRef.current = 'down_level';
        } else {
            // Wrong → larger E (lower index), step up by 2 for reliability
            newLevel = Math.max(levelIndex - 2, 0);
            if (lastDirectionRef.current === 'down_level') {
                reversalsRef.current.push(levelIndex);
            }
            lastDirectionRef.current = 'up_level';
        }

        const nextTrial = currentTrial + 1;

        if (nextTrial >= TOTAL_TRIALS) {
            // Calculate final result
            finishTest(newTrials);
        } else {
            setLevelIndex(newLevel);
            setDirection(newDirection());
            setCurrentTrial(nextTrial);
            trialStartRef.current = Date.now();
        }
    }, [currentTrial, direction, levelIndex, trials, newDirection]);

    const finishTest = (allTrials: AcuityTrial[]) => {
        // Final logMAR = average of reversal levels, or last tested level
        const reversals = reversalsRef.current;
        let finalLogMAR: number;

        if (reversals.length >= 2) {
            const lastReversals = reversals.slice(-4);
            const avgIndex = lastReversals.reduce((a, b) => a + b, 0) / lastReversals.length;
            const clampedIndex = Math.round(Math.min(Math.max(avgIndex, 0), LOGMAR_LEVELS.length - 1));
            finalLogMAR = LOGMAR_LEVELS[clampedIndex].logMAR;
        } else {
            // Use the last correct trial's logMAR
            const lastCorrect = [...allTrials].reverse().find(t => t.correct);
            finalLogMAR = lastCorrect ? lastCorrect.logMAR : LOGMAR_LEVELS[0].logMAR;
        }

        const snellenEntry = LOGMAR_LEVELS.find(l => l.logMAR === finalLogMAR) || LOGMAR_LEVELS[0];
        const totalCorrect = allTrials.filter(t => t.correct).length;
        const avgResponse = allTrials.reduce((sum, t) => sum + t.responseTimeMs, 0) / allTrials.length;

        // Distance compliance
        const compliantSamples = distanceComplianceLog.filter(Boolean).length;
        const compliancePercent = distanceComplianceLog.length > 0
            ? Math.round((compliantSamples / distanceComplianceLog.length) * 100)
            : 100;

        onComplete({
            trials: allTrials,
            finalLogMAR,
            snellenNotation: snellenEntry.snellen,
            totalCorrect,
            totalTrials: TOTAL_TRIALS,
            averageResponseMs: Math.round(avgResponse),
            distanceCompliancePercent: compliancePercent,
        });
    };



    if (currentTrial >= TOTAL_TRIALS) return null;

    const currentLevel = LOGMAR_LEVELS[levelIndex];
    const eFontSize = currentLevel.sizePx;
    const rotation = direction === 'up' ? 270 : direction === 'down' ? 90 : direction === 'left' ? 180 : 0;
    const progress = ((currentTrial + 1) / TOTAL_TRIALS) * 100;

    return (
        <div className="animate-in" style={{ maxWidth: 700, width: '100%' }}>
            {/* Paused overlay */}
            {isPaused && (
                <div className="warning-overlay">
                    <div style={{ fontSize: 64 }}>⏸️</div>
                    <h2 style={{ fontSize: 28, fontWeight: 900 }}>{t.test_paused}</h2>
                    <p style={{ fontSize: 18, fontWeight: 600, opacity: 0.9 }}>{t.move_back}</p>
                </div>
            )}

            <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                {/* Header */}
                <div style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            {t.acuity_title}
                        </h3>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, margin: 0 }}>
                            {t.acuity_desc}
                        </p>
                    </div>
                    <div style={{ textAlign: lang === 'ar' ? 'left' : 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>
                            {t.trial} {currentTrial + 1} {t.trial_of} {TOTAL_TRIALS}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                            {currentLevel.snellen}
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div style={{
                    width: '100%', height: 6,
                    background: 'var(--bg-secondary)',
                    borderRadius: 999,
                    overflow: 'hidden',
                }}>
                    <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'var(--accent)',
                        borderRadius: 999,
                        transition: 'width 0.3s',
                    }} />
                </div>

                {/* Timer */}
                <div style={{
                    fontSize: 14, fontWeight: 700,
                    color: timeLeft <= 3 ? 'var(--danger)' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    ⏱ {timeLeft} {t.seconds}
                </div>



                {/* Tumbling E Display */}
                <div style={{
                    width: '100%',
                    minHeight: 220,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'white',
                    borderRadius: 'var(--radius)',
                    border: '2px solid var(--border-color)',
                    position: 'relative',
                }}>
                    {showFeedback && (
                        <div style={{
                            position: 'absolute',
                            top: 8,
                            [lang === 'ar' ? 'left' : 'right']: 12,
                            fontSize: 28,
                        }}>
                            {showFeedback === 'correct' ? '✅' : '❌'}
                        </div>
                    )}
                    <svg
                        viewBox="0 0 100 100"
                        style={{
                            width: eFontSize,
                            height: eFontSize,
                            transform: `rotate(${rotation}deg)`,
                            transition: 'all 0.3s',
                        }}
                    >
                        {/* Tumbling E shape: opening faces right by default */}
                        <rect x="15" y="10" width="15" height="80" fill="#000" />
                        <rect x="15" y="10" width="70" height="15" fill="#000" />
                        <rect x="15" y="42" width="55" height="15" fill="#000" />
                        <rect x="15" y="75" width="70" height="15" fill="#000" />
                    </svg>
                </div>

                {/* Direction Buttons */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    width: '100%',
                }}>
                    {DIRECTIONS.map(dir => (
                        <button
                            key={dir}
                            className="dir-btn"
                            onClick={() => handleAnswer(dir)}
                            disabled={isPaused}
                            style={{ opacity: isPaused ? 0.4 : 1 }}
                        >
                            <span style={{ fontSize: 36 }}>
                                {dir === 'up' ? '⬆️' : dir === 'down' ? '⬇️' : dir === 'left' ? '⬅️' : '➡️'}
                            </span>
                            <span style={{ fontSize: 16, marginTop: 4 }}>
                                {t[dir]}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TumblingETest;
