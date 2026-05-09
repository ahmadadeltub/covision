
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Language, ColorPlateAnswer, ColorVisionResult, DistanceStatus } from '../types';
import { translations } from '../translations';
import { PLATES } from '../utils/ishiharaPlates';

import DistanceBar from './DistanceBar';
import { useVoiceCommand } from '../hooks/useVoiceCommand';

interface Props {
    lang: Language;
    stream?: MediaStream | null;
    onComplete: (result: ColorVisionResult) => void;
}

type TestStep = 'intro' | 'instruction_right' | 'testing_right' | 'instruction_left' | 'testing_left' | 'finished';

// Helper to generate a random deck of 15 plates
function generateDeck(count: number) {
    const deck = [];
    for (let i = 0; i < count; i++) {
        // Randomly pick from available PLATES (sampling with replacement to reach 15)
        const randomPlate = PLATES[Math.floor(Math.random() * PLATES.length)];
        deck.push(randomPlate);
    }
    return deck;
}

const ColorVisionTest: React.FC<Props> = ({ lang, stream, onComplete }) => {
    const t = translations[lang];
    const [step, setStep] = useState<TestStep>('intro');
    const [currentPlateIndex, setCurrentPlateIndex] = useState(0);
    const [coverCountdown, setCoverCountdown] = useState<number | null>(null);

    // Decks
    const platesRight = useMemo(() => generateDeck(3), []);
    const platesLeft = useMemo(() => generateDeck(3), []);

    // Answers
    const [answersRight, setAnswersRight] = useState<ColorPlateAnswer[]>([]);
    const [answersLeft, setAnswersLeft] = useState<ColorPlateAnswer[]>([]);

    const [isPaused, setIsPaused] = useState(false);

    // ─── AI Eye Cover Detection State ───
    // ── DISABLED ── Set to false to re-enable eye cover enforcement.
    const EYE_COVER_DISABLED = true;
    type EyeCoverStatus = 'right_covered' | 'left_covered' | 'both_covered' | 'none_covered' | 'no_detection';
    const [eyeCoverStatus, setEyeCoverStatus] = useState<EyeCoverStatus>('no_detection');
    const [isEyeUncovered, setIsEyeUncovered] = useState(false);
    const [coverConfidence, setCoverConfidence] = useState(0);
    const coverHistoryRef = useRef<EyeCoverStatus[]>([]);
    const coverCanvasRef = useRef<HTMLCanvasElement>(null);

    const handleDistanceStatusChange = useCallback((status: DistanceStatus) => {
        setIsPaused(status !== 'ok');
    }, []);

    // Camera refs
    const cameraRef = useRef<HTMLVideoElement>(null);

    // Current active plate based on step
    const currentDeck = step === 'testing_right' ? platesRight : step === 'testing_left' ? platesLeft : [];
    const plate = currentDeck[currentPlateIndex];

    const options = useMemo(() => {
        if (!plate) return [];
        const correct = plate.correctAnswer;
        const allNumbers = ['2', '3', '5', '6', '7', '8', '9', '12', '15', '16', '25', '29', '35', '42', '45', '74', '96', '97'];
        const distractors = allNumbers.filter(n => n !== correct);
        const shuffled = distractors.sort(() => Math.random() - 0.5).slice(0, 3);
        const combined = [...shuffled, correct].sort(() => Math.random() - 0.5);
        return combined;
    }, [plate]);

    // ─── Camera Setup ───
    useEffect(() => {
        const vid = cameraRef.current;
        if (!vid || !stream) return;
        if (vid.srcObject !== stream) vid.srcObject = stream;
        vid.play().catch(() => { });
    }, [stream]);

    // ─── EAR-based Eye Cover Detection (reads shared face landmarks) ───
    const EAR_THRESHOLD = 0.16;

    const computeEAR = useCallback((landmarks: any[], eyeIndices: number[]) => {
        const [p1, p2, p3, p4, p5, p6] = eyeIndices.map(i => landmarks[i]);
        if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.3;
        const d = (a: any, b: any) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + ((a.z || 0) - (b.z || 0)) ** 2);
        return d(p1, p4) > 0 ? (d(p2, p6) + d(p3, p5)) / (2 * d(p1, p4)) : 0.3;
    }, []);

    const updateCoverStatus = useCallback((status: EyeCoverStatus) => {
        const history = coverHistoryRef.current;
        history.push(status);
        if (history.length > 8) history.shift();
        const counts: Record<string, number> = {};
        history.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
        let maxCount = 0;
        let dominant: EyeCoverStatus = 'no_detection';
        for (const [s, c] of Object.entries(counts)) {
            if (c > maxCount) { maxCount = c; dominant = s as EyeCoverStatus; }
        }
        setEyeCoverStatus(dominant);
        setCoverConfidence(Math.round((maxCount / history.length) * 100));
    }, []);

    // ─── Polling loop for eye cover detection ───
    useEffect(() => {
        const isTesting = step === 'testing_right' || step === 'testing_left';
        if (!isTesting || !stream) return;
        let stopped = false;
        const detect = () => {
            if (stopped) return;
            const faceLandmarks = (window as any).__sharedFaceLandmarks as any[] | null;
            if (faceLandmarks && faceLandmarks.length >= 468) {
                const LEFT_EYE = [33, 160, 158, 133, 153, 144];
                const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
                const leftEAR = computeEAR(faceLandmarks, LEFT_EYE);
                const rightEAR = computeEAR(faceLandmarks, RIGHT_EYE);
                let status: EyeCoverStatus = 'none_covered';
                if (leftEAR < EAR_THRESHOLD && rightEAR < EAR_THRESHOLD) status = 'both_covered';
                else if (rightEAR < EAR_THRESHOLD) status = 'right_covered';
                else if (leftEAR < EAR_THRESHOLD) status = 'left_covered';
                updateCoverStatus(status);
            } else {
                updateCoverStatus('no_detection');
            }
            setTimeout(() => { if (!stopped) detect(); }, 200);
        };
        detect();
        return () => { stopped = true; };
    }, [step, stream, computeEAR, updateCoverStatus]);

    // ─── Check eye cover compliance during testing ───
    useEffect(() => {
        // ── DISABLED: eye cover enforcement paused ──
        if (EYE_COVER_DISABLED) {
            setIsEyeUncovered(false);
            return;
        }

        const isTesting = step === 'testing_right' || step === 'testing_left';
        if (!isTesting) {
            setIsEyeUncovered(false);
            return;
        }

        if (step === 'testing_right') {
            // Need LEFT eye covered (so user sees with RIGHT eye)
            // left_covered or both_covered is OK
            const ok = eyeCoverStatus === 'left_covered' || eyeCoverStatus === 'both_covered' || eyeCoverStatus === 'no_detection';
            setIsEyeUncovered(!ok && coverConfidence > 60);
        } else if (step === 'testing_left') {
            // Need RIGHT eye covered (so user sees with LEFT eye)
            const ok = eyeCoverStatus === 'right_covered' || eyeCoverStatus === 'both_covered' || eyeCoverStatus === 'no_detection';
            setIsEyeUncovered(!ok && coverConfidence > 60);
        }
    }, [eyeCoverStatus, step, coverConfidence, EYE_COVER_DISABLED]);

    const handleAnswer = useCallback((answer: string) => {
        const isRight = step === 'testing_right';
        const isLeft = step === 'testing_left';

        if (!isRight && !isLeft) return;

        const deck = isRight ? platesRight : platesLeft;
        const plate = deck[currentPlateIndex];

        if (!plate) return;

        const newAnswer: ColorPlateAnswer = {
            plateIndex: currentPlateIndex,
            correctAnswer: plate.correctAnswer,
            userAnswer: answer,
            correct: answer === plate.correctAnswer,
        };

        if (isRight) {
            setAnswersRight(prev => [...prev, newAnswer]);
            if (currentPlateIndex < 2) {
                setCurrentPlateIndex(prev => prev + 1);
            } else {
                setStep('instruction_left');
            }
        } else {
            setAnswersLeft(prev => {
                const updated = [...prev, newAnswer];
                if (currentPlateIndex >= 2) {
                    // Finished left eye
                    setTimeout(() => finishTest(answersRight, updated), 0);
                }
                return updated;
            });
            if (currentPlateIndex < 2) {
                setCurrentPlateIndex(prev => prev + 1);
            }
        }
    }, [step, currentPlateIndex, platesRight, platesLeft, answersRight]);

    const finishTest = (rightResults: ColorPlateAnswer[], leftResults: ColorPlateAnswer[]) => {
        const correctRight = rightResults.filter(a => a.correct).length;
        const correctLeft = leftResults.filter(a => a.correct).length;
        const totalCorrect = correctRight + correctLeft;
        const totalPlates = rightResults.length + leftResults.length;
        const allAnswers = [...rightResults, ...leftResults];

        let classification: ColorVisionResult['classification'];
        let classificationLabel: string;

        if (totalCorrect >= 5) {
            classification = 'normal';
            classificationLabel = t.normal_vision;
        } else if (totalCorrect >= 3) {
            classification = 'possible_rg_deficiency';
            classificationLabel = t.possible_rg;
        } else {
            classification = 'possible_total_deficiency';
            classificationLabel = t.possible_total;
        }

        onComplete({
            answers: allAnswers,
            totalCorrect,
            totalPlates,
            scoreRight: correctRight,
            scoreLeft: correctLeft,
            totalRight: 3,
            totalLeft: 3,
            classification,
            classificationLabel,
        });
    };

    // Calculate progress for current step
    const progress = ((currentPlateIndex + 1) / 3) * 100;

    // Voice commands mapping
    const isTesting = step === 'testing_right' || step === 'testing_left';

    const voiceCommands = useMemo(() => {
        const map: Record<string, string> = {
            "can't see": "none", "cant see": "none", "nothing": "none", "لا أرى": "none", "لا اعرف": "none", "مش شايف": "none"
        };
        const allNumbers = ['2', '3', '5', '6', '7', '8', '9', '12', '15', '16', '25', '29', '35', '42', '45', '74', '96', '97'];
        allNumbers.forEach(n => {
            map[n] = n;
        });
        const arabicNums: Record<string, string> = {
            'اثنان': '2', 'اتنين': '2', 'ثلاثة': '3', 'تلاتة': '3', 'خمسة': '5', 'ستة': '6', 'سبعة': '7', 'ثمانية': '8', 'تمانية': '8', 'تسعة': '9',
            'اثنا عشر': '12', 'اتناشر': '12', 'خمسة عشر': '15', 'خمستاشر': '15', 'ستة عشر': '16', 'ستاشر': '16',
            'خمسة وعشرون': '25', 'خمسة وعشرين': '25', 'تسعة وعشرون': '29', 'تسعة وعشرين': '29',
            'خمسة وثلاثون': '35', 'خمسة وتلاتين': '35', 'اثنان وأربعون': '42', 'اتنين واربعين': '42',
            'خمسة وأربعون': '45', 'خمسة واربعين': '45', 'أربعة وسبعون': '74', 'اربعة وسبعين': '74',
            'ستة وتسعون': '96', 'ستة وتسعين': '96', 'سبعة وتسعون': '97', 'سبعة وتسعين': '97'
        };
        Object.assign(map, arabicNums);
        return map;
    }, []);

    const { isListening } = useVoiceCommand({
        commands: voiceCommands,
        onCommand: (cmd) => handleAnswer(cmd),
        isActive: step === 'testing_right' || step === 'testing_left',
    });



    const startRight = () => {
        setStep('instruction_right');
    };

    const beginCoverCountdown = (forEye: 'right' | 'left') => {
        setCoverCountdown(5);
        const interval = setInterval(() => {
            setCoverCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(interval);
                    setCoverCountdown(null);
                    if (forEye === 'right') {
                        startTestingRight();
                    } else {
                        startTestingLeft();
                    }
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const startTestingRight = () => {
        setCurrentPlateIndex(0);
        setStep('testing_right');
    };

    const startTestingLeft = () => {
        setCurrentPlateIndex(0);
        setStep('testing_left');
    };

    return (
        <div className="w-full h-full flex flex-row gap-4 animate-in fade-in duration-500 overflow-hidden">

            {/* ─── LEFT: Camera Feed Panel ─── */}
            <div className="shrink-0 flex flex-col gap-3 items-center" style={{ width: 220 }}>
                <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-black border-2 border-cyan-500/20 shadow-[0_0_30px_rgba(0,200,255,0.1)] relative">
                    <video ref={cameraRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1] brightness-110" />
                    {/* AI detection canvas overlay */}
                    <canvas ref={coverCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                    <div className="absolute top-2 left-2 glass px-2 py-0.5 rounded-full border border-cyan-500/30 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
                        <span className="text-[8px] font-bold text-cyan-400 uppercase tracking-widest">LIVE</span>
                    </div>
                    {/* Eye cover status badge */}
                    {isTesting && (
                        <div className={`absolute bottom-2 left-2 right-2 px-2 py-1 rounded-lg text-center text-[9px] font-black uppercase tracking-wider ${
                            isEyeUncovered
                                ? 'bg-red-500/80 text-white border border-red-400'
                                : 'bg-emerald-500/80 text-white border border-emerald-400'
                        }`}>
                            {isEyeUncovered
                                ? `⚠️ Cover your ${step === 'testing_right' ? 'LEFT' : 'RIGHT'} eye!`
                                : `✅ Eye covered (${coverConfidence}%)`
                            }
                        </div>
                    )}
                </div>

                {/* Test Info */}
                <div className="w-full glass rounded-2xl border border-white/5 p-3 space-y-2">
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ishihara</div>
                        {isTesting && <div className="text-lg font-black text-white">Plate {currentPlateIndex + 1}</div>}
                        {!isTesting && <div className="text-sm font-black text-white uppercase">{step === 'intro' ? 'Intro' : 'Instruction'}</div>}
                    </div>
                    {isTesting && (
                        <>
                            <div className="h-px bg-white/5"></div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Progress</span>
                                <span className="text-sm font-black text-white">{currentPlateIndex + 1}/3</span>
                            </div>
                            <div className="flex items-center justify-center pt-1">
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                                    {step === 'testing_right' ? 'RIGHT EYE' : 'LEFT EYE'}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ─── RIGHT: Test Content ─── */}
            <div className="flex-1 flex flex-col glass rounded-[2rem] border border-white/10 bg-slate-900/40 overflow-hidden min-w-0 relative">

                {/* Distance Bar - Enforcing 60-70cm */}
                {stream && (
                    <div className="shrink-0 px-6 pt-4 pb-0 z-20">
                        <DistanceBar
                            stream={stream}
                            targetM={0.65}
                            toleranceM={0.05}
                            onStatusChange={handleDistanceStatusChange}
                            showPauseOverlay={true}
                        />
                    </div>
                )}

                <div className={`flex-1 flex flex-col min-h-0 transition-opacity duration-300 ${(isPaused || isEyeUncovered) ? 'opacity-30 pointer-events-none blur-sm' : ''}`}>

                    {/* Header */}
                    <div className="shrink-0 px-6 py-3 border-b border-white/5 flex items-center justify-between">
                        <div>
                            <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight leading-none">{t.color_intro_title}</h3>
                            <p className="text-xs text-cyan-400 font-bold uppercase tracking-widest mt-0.5">Ishihara Color Plates</p>
                        </div>
                    </div>

                    {/* Content Logic */}
                    {step === 'intro' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                            <h2 className="text-3xl font-black text-white">Bilateral Vision Test</h2>
                            <p className="text-slate-300 max-w-lg">
                                We will test each eye separately. You will need to cover one eye at a time with your hand or an eye patch.
                            </p>
                            <button onClick={startRight} className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-full text-lg transition-transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.5)]">
                                Start Test
                            </button>
                        </div>
                    )}

                    {step === 'instruction_right' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-5 animate-in fade-in duration-700">
                            {/* Step indicator */}
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-sm font-black text-black">1</div>
                                <div className="w-16 h-0.5 bg-slate-700"></div>
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-500">2</div>
                            </div>

                            {/* Eye illustration */}
                            <div className="relative w-64 h-40">
                                {/* Face outline */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-48 h-36 rounded-[50%] border-2 border-slate-600 relative">
                                        {/* Right eye - open */}
                                        <div className="absolute top-[35%] left-[22%] w-10 h-6 rounded-full border-2 border-cyan-400 bg-cyan-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)] animate-pulse">
                                            <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                                        </div>
                                        {/* Left eye - covered with hand */}
                                        <div className="absolute top-[28%] right-[15%] w-14 h-10 rounded-xl bg-amber-700/80 border-2 border-amber-600 flex items-center justify-center shadow-[0_0_20px_rgba(217,119,6,0.3)]">
                                            <span className="text-lg">🤚</span>
                                        </div>
                                        {/* Nose hint */}
                                        <div className="absolute top-[50%] left-1/2 -translate-x-1/2 w-2 h-4 rounded-full bg-slate-600/30"></div>
                                    </div>
                                </div>
                            </div>

                            <h2 className="text-2xl md:text-3xl font-black text-white">Testing RIGHT Eye</h2>

                            {/* Instruction card */}
                            <div className="max-w-md w-full p-4 glass border-2 border-yellow-500/40 rounded-2xl space-y-3">
                                <div className="flex items-center gap-3 text-yellow-400">
                                    <span className="text-2xl">⚠️</span>
                                    <span className="text-lg font-bold">Cover your LEFT eye</span>
                                </div>
                                <div className="flex items-start gap-3 text-slate-300 text-sm">
                                    <span className="text-cyan-400 font-bold mt-0.5">1.</span>
                                    <span>Use your right hand to gently cover your <strong className="text-white">LEFT</strong> eye</span>
                                </div>
                                <div className="flex items-start gap-3 text-slate-300 text-sm">
                                    <span className="text-cyan-400 font-bold mt-0.5">2.</span>
                                    <span>Do <strong className="text-white">NOT</strong> press on the eyelid — just block the light</span>
                                </div>
                                <div className="flex items-start gap-3 text-slate-300 text-sm">
                                    <span className="text-cyan-400 font-bold mt-0.5">3.</span>
                                    <span>Keep both eyes relaxed and look at the screen</span>
                                </div>
                            </div>

                            {coverCountdown !== null ? (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-20 h-20 rounded-full border-4 border-cyan-400 flex items-center justify-center bg-cyan-500/10 shadow-[0_0_40px_rgba(6,182,212,0.4)] animate-pulse">
                                        <span className="text-4xl font-black text-cyan-400">{coverCountdown}</span>
                                    </div>
                                    <span className="text-sm text-slate-400 font-bold uppercase tracking-widest">Starting soon...</span>
                                </div>
                            ) : (
                                <button onClick={() => beginCoverCountdown('right')} className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-full text-lg transition-transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                                    ✋ I've Covered My Left Eye
                                </button>
                            )}
                        </div>
                    )}

                    {step === 'instruction_left' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-5 animate-in fade-in duration-700">
                            {/* Step indicator */}
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-black text-black">✓</div>
                                <div className="w-16 h-0.5 bg-cyan-500"></div>
                                <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-sm font-black text-black">2</div>
                            </div>

                            {/* Right eye score summary */}
                            <div className="px-4 py-2 glass rounded-xl border border-emerald-500/30 text-sm">
                                <span className="text-slate-400">Right eye completed — </span>
                                <span className="text-emerald-400 font-black">{answersRight.filter(a => a.correct).length}/3 correct</span>
                            </div>

                            {/* Eye illustration */}
                            <div className="relative w-64 h-40">
                                {/* Face outline */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-48 h-36 rounded-[50%] border-2 border-slate-600 relative">
                                        {/* Right eye - covered with hand */}
                                        <div className="absolute top-[28%] left-[15%] w-14 h-10 rounded-xl bg-amber-700/80 border-2 border-amber-600 flex items-center justify-center shadow-[0_0_20px_rgba(217,119,6,0.3)]">
                                            <span className="text-lg">🤚</span>
                                        </div>
                                        {/* Left eye - open */}
                                        <div className="absolute top-[35%] right-[22%] w-10 h-6 rounded-full border-2 border-cyan-400 bg-cyan-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)] animate-pulse">
                                            <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                                        </div>
                                        {/* Nose hint */}
                                        <div className="absolute top-[50%] left-1/2 -translate-x-1/2 w-2 h-4 rounded-full bg-slate-600/30"></div>
                                    </div>
                                </div>
                            </div>

                            <h2 className="text-2xl md:text-3xl font-black text-white">Now Testing LEFT Eye</h2>

                            {/* Instruction card */}
                            <div className="max-w-md w-full p-4 glass border-2 border-yellow-500/40 rounded-2xl space-y-3">
                                <div className="flex items-center gap-3 text-yellow-400">
                                    <span className="text-2xl">⚠️</span>
                                    <span className="text-lg font-bold">Switch — Cover your RIGHT eye</span>
                                </div>
                                <div className="flex items-start gap-3 text-slate-300 text-sm">
                                    <span className="text-cyan-400 font-bold mt-0.5">1.</span>
                                    <span>Use your left hand to gently cover your <strong className="text-white">RIGHT</strong> eye</span>
                                </div>
                                <div className="flex items-start gap-3 text-slate-300 text-sm">
                                    <span className="text-cyan-400 font-bold mt-0.5">2.</span>
                                    <span>Do <strong className="text-white">NOT</strong> press on the eyelid — just block the light</span>
                                </div>
                                <div className="flex items-start gap-3 text-slate-300 text-sm">
                                    <span className="text-cyan-400 font-bold mt-0.5">3.</span>
                                    <span>Keep both eyes relaxed and look at the screen</span>
                                </div>
                            </div>

                            {coverCountdown !== null ? (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-20 h-20 rounded-full border-4 border-cyan-400 flex items-center justify-center bg-cyan-500/10 shadow-[0_0_40px_rgba(6,182,212,0.4)] animate-pulse">
                                        <span className="text-4xl font-black text-cyan-400">{coverCountdown}</span>
                                    </div>
                                    <span className="text-sm text-slate-400 font-bold uppercase tracking-widest">Starting soon...</span>
                                </div>
                            ) : (
                                <button onClick={() => beginCoverCountdown('left')} className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-full text-lg transition-transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                                    ✋ I've Covered My Right Eye
                                </button>
                            )}
                        </div>
                    )}

                    {(step === 'testing_right' || step === 'testing_left') && (
                        <>
                            {/* Eye Uncovered Pause Overlay */}
                            {isEyeUncovered && (
                                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md rounded-[2rem]">
                                    <div className="flex flex-col items-center gap-5 p-8 text-center animate-in fade-in zoom-in-95 duration-300">
                                        <div className="w-24 h-24 rounded-full bg-red-500/20 border-4 border-red-500 flex items-center justify-center animate-pulse">
                                            <span className="text-5xl">⏸️</span>
                                        </div>
                                        <h3 className="text-2xl font-black text-white">Test Paused</h3>
                                        <p className="text-lg text-red-400 font-bold">
                                            Please cover your <span className="underline decoration-2 underline-offset-4">{step === 'testing_right' ? 'LEFT' : 'RIGHT'}</span> eye
                                        </p>
                                        <div className="flex items-center gap-3 px-5 py-3 glass rounded-2xl border border-white/10">
                                            <div className="relative w-16 h-10">
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    {step === 'testing_right' ? (
                                                        <>
                                                            <div className="w-5 h-3 rounded-full border-2 border-cyan-400 bg-cyan-500/20 mr-3"><div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mx-auto mt-0.5"></div></div>
                                                            <div className="w-7 h-5 rounded-lg bg-amber-700/80 border border-amber-600 flex items-center justify-center text-[10px]">🤚</div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="w-7 h-5 rounded-lg bg-amber-700/80 border border-amber-600 flex items-center justify-center text-[10px]">🤚</div>
                                                            <div className="w-5 h-3 rounded-full border-2 border-cyan-400 bg-cyan-500/20 ml-3"><div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mx-auto mt-0.5"></div></div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-sm text-slate-300 font-bold">AI is monitoring your eyes</span>
                                        </div>
                                        <p className="text-xs text-slate-500">The test will resume automatically once your eye is covered</p>
                                    </div>
                                </div>
                            )}

                            {/* Progress Bar */}
                            <div className="shrink-0 px-6 pt-2">
                                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all duration-500 rounded-full"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>

                            {/* Plate + question */}
                            <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 gap-3">
                                {/* Ishihara Plate Image */}
                                <div className="w-full max-w-sm aspect-square relative rounded-full overflow-hidden shadow-2xl bg-[#f5f0e0] border-4 border-white/5">
                                    <img
                                        src={plate?.imageSrc}
                                        alt={`Ishihara Plate`}
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <p className="text-lg font-bold text-white text-center">{t.what_number}</p>
                            </div>

                            {/* Answer buttons */}
                            <div className="shrink-0 p-4 pt-0 space-y-2">
                                <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                                    {options.map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => handleAnswer(opt)}
                                            className="py-4 glass border-2 border-white/10 rounded-2xl font-black text-3xl text-white hover:border-cyan-400 hover:bg-cyan-500/20 transition-all active:scale-90"
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => handleAnswer('none')}
                                    className="w-full py-3 glass border border-white/5 rounded-full text-xs md:text-sm text-slate-500 font-black uppercase tracking-[0.4em] hover:text-white transition-colors"
                                >
                                    {t.cant_see}
                                </button>
                                <div className="text-center mt-2 text-xs text-slate-500 uppercase tracking-widest opacity-60 flex items-center justify-center gap-2">
                                    <span>Voice: Say the number or "can't see"</span>
                                    {isListening && <span className="text-emerald-400 font-bold animate-pulse">🎤 Listening</span>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ColorVisionTest;
