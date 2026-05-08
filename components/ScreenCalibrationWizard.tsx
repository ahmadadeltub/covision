
import React, { useState, useRef } from 'react';
import { Language, ScreenCalibrationData } from '../types';
import { translations } from '../translations';

interface Props {
    lang: Language;
    onComplete: (data: ScreenCalibrationData) => void;
}

// Device presets: diagonal inches
const PRESETS = [
    { label: 'Tablet 11"', diagonal: 11.0 },
    { label: 'Tablet 12.9"', diagonal: 12.9 },
    { label: 'Laptop 13"', diagonal: 13.3 },
    { label: 'Laptop 14"', diagonal: 14.0 },
    { label: 'Laptop 15.6"', diagonal: 15.6 },
    { label: 'Laptop 16"', diagonal: 16.0 },
    { label: 'Monitor 23"', diagonal: 23.0 },
    { label: 'Monitor 24"', diagonal: 24.0 },
    { label: 'Monitor 27"', diagonal: 27.0 },
    { label: 'Monitor 32"', diagonal: 32.0 },
    { label: 'Monitor 34"', diagonal: 34.0 },
    { label: 'TV 40"', diagonal: 40.0 },
    { label: 'TV 43"', diagonal: 43.0 },
    { label: 'TV 50"', diagonal: 50.0 },
    { label: 'TV 55"', diagonal: 55.0 },
    { label: 'TV 60"', diagonal: 60.0 },
    { label: 'TV 65"', diagonal: 65.0 },
    { label: 'TV 70"', diagonal: 70.0 },
    { label: 'TV 75"', diagonal: 75.0 },
    { label: 'TV 80"', diagonal: 80.0 },
    { label: 'TV 85"', diagonal: 85.0 },
    { label: 'TV 90"', diagonal: 90.0 },
    { label: 'TV 98"', diagonal: 98.0 },
    { label: 'Screen 100"', diagonal: 100.0 },
    { label: 'Screen 110"', diagonal: 110.0 },
];

const IPD_PRESETS = [
    { key: 'adult', ipdMm: 63, label: 'Adult (63 mm)' },
    { key: 'teen', ipdMm: 60, label: 'Teen (60 mm)' },
    { key: 'child', ipdMm: 55, label: 'Child (55 mm)' },
];

const CREDIT_CARD_WIDTH_MM = 85.6;

const ScreenCalibrationWizard: React.FC<Props> = ({ lang, onComplete }) => {
    const t = translations[lang];
    const [step, setStep] = useState<'device' | 'ipd' | 'card'>('device');
    const [selectedDiagonal, setSelectedDiagonal] = useState<number | null>(null);
    const [selectedIPD, setSelectedIPD] = useState<string>('adult');
    const [method, setMethod] = useState<'device-select' | 'credit-card'>('device-select');

    // Credit card calibration
    const [cardWidthPx, setCardWidthPx] = useState(323); // ~85.6mm at ~96ppi
    const cardRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    const dragStart = useRef(0);

    const computePPI = (diagonal: number) => {
        // Use window.screen dimensions for estimation
        // Note: window.screen.width/height are in CSS pixels (logical)
        // We multiply by devicePixelRatio to get approximation of physical pixels if OS scaling matches
        // However, usually browsers report screen.width in CSS px.
        // Screen diagonal matches physical size related to physical pixels.
        // A better heuristic for "Standard" displays is just using screen.width/height directly if they are high numbers (e.g. 1920x1080)
        // or multiplying if they seem low (e.g. 1366 logical but 2x ratio).
        // Let's use a robust heuristic:
        const w = window.screen.width * (window.devicePixelRatio || 1);
        const h = window.screen.height * (window.devicePixelRatio || 1);
        const diagPx = Math.sqrt(w * w + h * h);
        return diagPx / diagonal;
    };

    const computePxPerMm = (): number => {
        if (method === 'credit-card') {
            return cardWidthPx / CREDIT_CARD_WIDTH_MM;
        }
        if (selectedDiagonal) {
            const ppi = computePPI(selectedDiagonal);
            return ppi / 25.4;
        }
        return 4.0; // fallback
    };

    const handleFinish = () => {
        const ipd = IPD_PRESETS.find(p => p.key === selectedIPD)!;
        onComplete({
            pxPerMm: computePxPerMm(),
            screenSizeInches: selectedDiagonal || 15,
            method,
            ipdMm: ipd.ipdMm,
        });
    };

    // Touch/mouse handlers for card drag
    const handlePointerDown = (e: React.PointerEvent) => {
        dragging.current = true;
        dragStart.current = e.clientX;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragging.current) return;
        const dx = e.clientX - dragStart.current;
        setCardWidthPx(prev => Math.max(100, Math.min(800, prev + dx)));
        dragStart.current = e.clientX;
    };

    const handlePointerUp = () => {
        dragging.current = false;
    };

    // ─── Device Selection Step ───
    if (step === 'device') {
        return (
            <div className="w-full h-full flex items-center justify-center p-2 md:p-4 overflow-hidden">
                <div className="glass w-full max-w-6xl h-full max-h-[90vh] rounded-[3rem] shadow-[0_0_150px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col items-center justify-between relative overflow-hidden bg-slate-900/60 p-6 md:p-12 animate-in fade-in zoom-in-95 duration-700">
                    {/* Background Rings */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-cyan-500 rounded-full animate-[ping_15s_infinite]"></div>
                    </div>

                    {/* Header */}
                    <div className="relative z-10 text-center shrink-0">
                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">{t.screen_cal_title}</h2>
                        <p className="text-sm md:text-xl text-cyan-400 font-bold uppercase tracking-[0.3em] mt-2">{t.screen_cal_subtitle}</p>
                    </div>

                    {/* Device Grid */}
                    <div className="relative z-10 flex-1 w-full max-w-5xl mx-auto my-4 min-h-0 overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 content-start">
                            {PRESETS.map((d, i) => (
                                <button
                                    key={i}
                                    onClick={() => { setSelectedDiagonal(d.diagonal); setMethod('device-select'); }}
                                    className={`p-4 md:p-6 glass rounded-[1.5rem] md:rounded-[2rem] border-2 transition-all text-center flex flex-col items-center justify-center gap-2 ${selectedDiagonal === d.diagonal
                                        ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_40px_rgba(0,243,255,0.3)]'
                                        : 'border-white/5 hover:border-cyan-400/50'
                                        }`}
                                >
                                    <span className="text-3xl md:text-4xl">{d.label.includes('Laptop') ? '💻' : d.label.includes('TV') ? '📺' : d.label.includes('Monitor') ? '🖥️' : '📱'}</span>
                                    <span className="text-sm md:text-base font-black text-white uppercase tracking-wider">
                                        {d.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Credit Card Option */}
                    <div className="relative z-10 w-full max-w-4xl mx-auto mb-4 shrink-0">
                        <button
                            onClick={() => { setMethod('credit-card'); setStep('card'); }}
                            className="w-full py-4 glass border border-white/10 rounded-[1.5rem] text-slate-400 font-bold uppercase tracking-wider text-sm hover:border-cyan-400/50 hover:text-cyan-400 transition-all"
                        >
                            💳 {t.credit_card_cal} (More Accurate)
                        </button>
                    </div>

                    {/* Continue */}
                    <div className="relative z-10 w-full max-w-3xl shrink-0">
                        <button
                            onClick={() => selectedDiagonal && setStep('ipd')}
                            disabled={!selectedDiagonal}
                            className={`group w-full py-6 md:py-8 rounded-[2.5rem] font-black text-xl md:text-3xl uppercase tracking-[0.3em] transition-all transform hover:scale-[1.02] active:scale-95 relative overflow-hidden shadow-2xl ${selectedDiagonal
                                ? 'bg-white text-slate-950 hover:bg-cyan-400 hover:shadow-[0_0_80px_rgba(0,243,255,0.5)]'
                                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                }`}
                        >
                            <span className="relative z-10">{t.next}</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Credit Card Calibration Step ───
    if (step === 'card') {
        return (
            <div className="w-full h-full flex items-center justify-center p-2 md:p-4 overflow-hidden">
                <div className="glass w-full max-w-5xl h-full max-h-[90vh] rounded-[3rem] shadow-[0_0_150px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col items-center justify-between relative overflow-hidden bg-slate-900/60 p-6 md:p-12 animate-in fade-in zoom-in-95 duration-700">
                    <div className="relative z-10 text-center">
                        <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">💳 {t.credit_card_cal}</h2>
                        <p className="text-base md:text-xl text-cyan-400 font-bold mt-2">{t.credit_card_desc}</p>
                    </div>

                    {/* Draggable Card Rectangle */}
                    <div className="relative z-10 flex-1 w-full flex items-center justify-center">
                        <div
                            ref={cardRef}
                            className="border-4 border-dashed border-cyan-400 rounded-[1rem] flex items-center justify-center cursor-ew-resize select-none touch-none"
                            style={{ width: cardWidthPx, height: cardWidthPx * 0.631, transition: dragging.current ? 'none' : 'width 0.2s' }}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                        >
                            <div className="text-center">
                                <p className="text-white font-black text-xl uppercase tracking-wider">↔ DRAG TO FIT</p>
                                <p className="text-cyan-400 text-sm font-bold mt-1">{(cardWidthPx / computePxPerMm()).toFixed(1)} mm</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 w-full max-w-3xl flex gap-4">
                        <button
                            onClick={() => setStep('device')}
                            className="flex-1 py-4 glass border border-white/10 rounded-[2rem] text-slate-400 font-black text-lg uppercase tracking-wider hover:border-cyan-400 transition-all"
                        >
                            ← {t.back}
                        </button>
                        <button
                            onClick={() => { setMethod('credit-card'); setStep('ipd'); }}
                            className="flex-[2] py-4 bg-white text-slate-950 rounded-[2rem] font-black text-lg uppercase tracking-[0.2em] hover:bg-cyan-400 transition-all"
                        >
                            {t.next}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── IPD Selection Step ───
    return (
        <div className="w-full h-full flex items-center justify-center p-2 md:p-4 overflow-hidden">
            <div className="glass w-full max-w-5xl h-full max-h-[90vh] rounded-[3rem] shadow-[0_0_150px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col items-center justify-between relative overflow-hidden bg-slate-900/60 p-6 md:p-12 animate-in fade-in zoom-in-95 duration-700">
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-cyan-500 rounded-full animate-[ping_20s_infinite]"></div>
                </div>

                <div className="relative z-10 text-center">
                    <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">{t.ipd_profile}</h2>
                    <p className="text-sm md:text-xl text-cyan-400 font-bold uppercase tracking-[0.3em] mt-2">
                        Select Your Age Group
                    </p>
                </div>

                {/* Eye Distance Illustration */}
                <div className="relative z-10 my-6">
                    <div className="text-[6rem] md:text-[8rem] text-center leading-none">👀</div>
                </div>

                {/* IPD Options */}
                <div className="relative z-10 w-full max-w-3xl flex flex-col gap-4 my-4">
                    {IPD_PRESETS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setSelectedIPD(p.key)}
                            className={`p-5 md:p-8 glass rounded-[2rem] border-2 transition-all text-center flex items-center justify-between ${selectedIPD === p.key
                                ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_40px_rgba(0,243,255,0.3)]'
                                : 'border-white/5 hover:border-cyan-400/50'
                                }`}
                        >
                            <span className="text-lg md:text-2xl font-black text-white uppercase tracking-wider">
                                {p.label}
                            </span>
                            <span className={`text-3xl ${selectedIPD === p.key ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                        </button>
                    ))}
                </div>

                {/* Finish Buttons */}
                <div className="relative z-10 w-full max-w-3xl flex gap-4">
                    <button
                        onClick={() => setStep(method === 'credit-card' ? 'card' : 'device')}
                        className="flex-1 py-4 glass border border-white/10 rounded-[2rem] text-slate-400 font-black text-lg uppercase tracking-wider hover:border-cyan-400 transition-all"
                    >
                        ← {t.back}
                    </button>
                    <button
                        onClick={handleFinish}
                        className="flex-[2] group py-6 bg-white text-slate-950 rounded-[2.5rem] font-black text-xl md:text-3xl uppercase tracking-[0.3em] hover:bg-cyan-400 hover:shadow-[0_0_80px_rgba(0,243,255,0.5)] transition-all relative overflow-hidden shadow-2xl"
                    >
                        <span className="relative z-10">{t.confirm_calibration}</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScreenCalibrationWizard;
