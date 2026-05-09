
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

type TestStep = 'intro' | 'testing' | 'finished';

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

    // Deck
    const plates = useMemo(() => generateDeck(5), []);

    // Answers
    const [answers, setAnswers] = useState<ColorPlateAnswer[]>([]);
    const lastInteractionTimeRef = useRef<number | null>(null);

    const [isPaused, setIsPaused] = useState(false);

    // ─── AI Eye Cover Detection State ───
    // ── DISABLED ── Set to false to re-enable eye cover enforcement.
    const EYE_COVER_DISABLED = false;
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
    const currentDeck = step === 'testing' ? plates : [];
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
        // Disabled completely
        setIsEyeUncovered(false);
    }, [step, eyeCoverStatus, coverConfidence]);
    const handleAnswer = useCallback((answerStr: string) => {
        if (step !== 'testing' || isPaused) return;

        const isCorrect = answerStr === plate.correctAnswer;
        const newAnswer: ColorPlateAnswer = { plateIndex: currentPlateIndex, correctAnswer: plate.correctAnswer, userAnswer: answerStr, correct: isCorrect };

        lastInteractionTimeRef.current = Date.now();

        setAnswers(prev => {
            const updated = [...prev, newAnswer];
            if (currentPlateIndex >= 4) {
                setTimeout(() => finishTest(updated), 0);
            }
            return updated;
        });

        if (currentPlateIndex < 4) {
            setCurrentPlateIndex(prev => prev + 1);
        }
    }, [step, isPaused, plate, currentPlateIndex]);

    const finishTest = (finalAnswers: ColorPlateAnswer[]) => {
        setStep('finished');
        const correct = finalAnswers.filter(a => a.correct).length;
        const totalPlates = finalAnswers.length;

        let classification: ColorVisionResult['classification'];
        let classificationLabel: string;

        if (correct >= 4) {
            classification = 'normal';
            classificationLabel = t.normal_vision;
        } else if (correct >= 2) {
            classification = 'possible_rg_deficiency';
            classificationLabel = t.possible_rg;
        } else {
            classification = 'possible_total_deficiency';
            classificationLabel = t.possible_total;
        }

        onComplete({
            testName: 'Ishihara Color Vision',
            totalPlates,
            scoreRight: correct,
            scoreLeft: correct,
            totalRight: 5,
            totalLeft: 5,
            classification,
            classificationLabel,
        });
    };

    // Calculate progress for current step
    const progress = ((currentPlateIndex + 1) / 5) * 100;

    // Voice commands mapping
    const isTesting = step === 'testing';

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
        isActive: isTesting,
    });

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
                                <span className="text-sm font-black text-white">{currentPlateIndex + 1}/5</span>
                            </div>
                            <div className="flex items-center justify-center pt-1">
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                                    BOTH EYES
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
                            <button onClick={() => setStep('testing')} className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-full text-lg transition-transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.5)]">
                                Start Test
                            </button>
                        </div>
                    )}

                    {step === 'testing' && plate && (
                        <>

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
