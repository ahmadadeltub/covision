
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TestResult } from '../../types';
import { PLATES } from '../../utils/ishiharaPlates';

import { useAIBot } from '../../hooks/useAIBot';
import AIBotBubble from '../AIBotBubble';

interface Props {
  t: any;
  stream?: MediaStream | null;
  onFinish: (result: TestResult) => void;
}

/* Color Dictionary */
const ALL_COLORS: Record<string, string> = {
  Red: '#EF4444', Green: '#22C55E', Blue: '#3B82F6', Yellow: '#FACC15',
  Orange: '#F97316', Purple: '#A855F7', Pink: '#EC4899', Teal: '#14B8A6',
  Brown: '#92400E', Gray: '#9CA3AF', Maroon: '#7F1D1D', Gold: '#CA8A04',
  Silver: '#D1D5DB', Lime: '#84CC16', Magenta: '#D946EF', White: '#F9FAFB',
};

/* 10 Colors with plausible confusers */
const COLOR_SAMPLES: { name: string; confusers: string[] }[] = [
  { name: 'Red',    confusers: ['Orange', 'Brown', 'Pink'] },
  { name: 'Green',  confusers: ['Teal', 'Lime', 'Yellow'] },
  { name: 'Blue',   confusers: ['Purple', 'Teal', 'Gray'] },
  { name: 'Yellow', confusers: ['Orange', 'Gold', 'Lime'] },
  { name: 'Orange', confusers: ['Red', 'Yellow', 'Brown'] },
  { name: 'Purple', confusers: ['Blue', 'Pink', 'Magenta'] },
  { name: 'Pink',   confusers: ['Red', 'Purple', 'Magenta'] },
  { name: 'Teal',   confusers: ['Green', 'Blue', 'Gray'] },
  { name: 'Brown',  confusers: ['Red', 'Orange', 'Maroon'] },
  { name: 'Gray',   confusers: ['Silver', 'Blue', 'White'] },
];

const TOTAL_SAMPLES = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = 'testing' | 'ishihara-intro' | 'ishihara-testing' | 'done';

const ColorTest: React.FC<Props> = ({ t, stream, onFinish }) => {
  const [phase, setPhase] = useState<Phase>('testing');
  const [sampleIdx, setSampleIdx] = useState(0);
  const [results, setResults] = useState<{ color: string; chosen: string; correct: boolean; timeMs: number }[]>([]);
  const startTime = useRef(Date.now());

  // Ishihara Plates State
  const ishiharaPlates = useMemo(() => {
    const shuffled = [...PLATES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(11, shuffled.length));
  }, []);
  const [ishiharaIdx, setIshiharaIdx] = useState(0);
  const [ishiharaResults, setIshiharaResults] = useState<{ plateId: number; correct: boolean; timeMs: number }[]>([]);
  const ishiharaStartTime = useRef(Date.now());

  const currentIshiharaPlate = ishiharaPlates[ishiharaIdx];
  const ishiharaOptions = useMemo(() => {
    if (!currentIshiharaPlate) return [];
    const correct = currentIshiharaPlate.correctAnswer;
    const allNumbers = ['2', '3', '5', '6', '7', '8', '9', '12', '15', '16', '25', '29', '35', '42', '45', '74', '96', '97'];
    const distractors = allNumbers.filter(n => n !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
    return [...distractors, correct].sort(() => Math.random() - 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIshiharaPlate, ishiharaIdx]);

  const isTesting = phase === 'testing' || phase === 'ishihara-testing';

  const { botState, botStart, botRecordTrial, botFinish } = useAIBot();

  const [sequence] = useState(() => shuffle([...COLOR_SAMPLES]));
  const currentSample = sequence[sampleIdx];

  const [shuffledChoices, setShuffledChoices] = useState<string[]>([]);
  useEffect(() => {
    if (phase === 'testing' && currentSample) {
      setShuffledChoices(shuffle([currentSample.name, ...currentSample.confusers]));
      startTime.current = Date.now();
    }
  }, [sampleIdx, phase]);

  // AI Bot lifecycle
  useEffect(() => {
    if (phase === 'testing') botStart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Selection */
  const handleSelect = (chosen: string) => {
    const timeMs = Date.now() - startTime.current;
    const correct = chosen === currentSample.name;
    botRecordTrial(correct, sampleIdx, TOTAL_SAMPLES);
    const entry = { color: currentSample.name, chosen, correct, timeMs };
    const newResults = [...results, entry];
    setResults(newResults);

    if (sampleIdx < TOTAL_SAMPLES - 1) {
      setSampleIdx(prev => prev + 1);
    } else {
      // Move to Ishihara phase
      setPhase('ishihara-intro');
    }
  };

  /* Ishihara answer handler */
  const handleIshiharaAnswer = (answer: string) => {
    if (phase !== 'ishihara-testing' || !currentIshiharaPlate) return;
    const timeMs = Date.now() - ishiharaStartTime.current;
    const correct = answer === currentIshiharaPlate.correctAnswer;
    botRecordTrial(correct, ishiharaIdx + TOTAL_SAMPLES, TOTAL_SAMPLES + ishiharaPlates.length);
    const entry = { plateId: currentIshiharaPlate.id, correct, timeMs };
    const newIshiharaResults = [...ishiharaResults, entry];
    setIshiharaResults(newIshiharaResults);

    if (ishiharaIdx < ishiharaPlates.length - 1) {
      setIshiharaIdx(prev => prev + 1);
      ishiharaStartTime.current = Date.now();
    } else {
      finishTestWithIshihara(results, newIshiharaResults);
    }
  };

  const finishTestWithIshihara = (colorResults: typeof results, ishResults: typeof ishiharaResults) => {
    setPhase('done');
    const colorOk = colorResults.filter(r => r.correct).length;
    const ishiharaOk = ishResults.filter(r => r.correct).length;
    const totalOk = colorOk + ishiharaOk;
    const total = colorResults.length + ishResults.length;
    const ishiharaPct = ishResults.length > 0 ? ishiharaOk / ishResults.length : 1;

    let findings: string, confidence: number;
    if (colorOk >= 9 && ishiharaPct >= 0.9) {
      findings = `Excellent color vision \u2014 Arrangement: ${colorOk}/${TOTAL_SAMPLES} (both eyes). Ishihara: ${ishiharaOk}/${ishResults.length}. Normal color discrimination.`;
      confidence = 0.98;
    } else if (colorOk >= 7 && ishiharaPct >= 0.7) {
      findings = `Mild color concern \u2014 Arrangement: ${colorOk}/${TOTAL_SAMPLES} (both eyes). Ishihara: ${ishiharaOk}/${ishResults.length}. Some difficulty with similar hues.`;
      confidence = 0.90;
    } else if (colorOk >= 4 || ishiharaPct >= 0.4) {
      findings = `Moderate color deficiency \u2014 Arrangement: ${colorOk}/${TOTAL_SAMPLES} (both eyes). Ishihara: ${ishiharaOk}/${ishResults.length}. Difficulty distinguishing several color pairs.`;
      confidence = 0.92;
    } else {
      findings = `Significant color deficiency \u2014 Arrangement: ${colorOk}/${TOTAL_SAMPLES} (both eyes). Ishihara: ${ishiharaOk}/${ishResults.length}. Comprehensive examination strongly recommended.`;
      confidence = 0.95;
    }

    const allTimes = [...colorResults.map(r => r.timeMs), ...ishResults.map(r => r.timeMs)];
    botFinish(totalOk, total);

    onFinish({
      testName: 'Color Arrangement',
      score: totalOk,
      total,
      confidence,
      findings,
      perSampleScores: [
        ...colorResults.map((r, i) => ({ sample: i + 1, correct: r.correct, timeMs: r.timeMs })),
        ...ishResults.map((r, i) => ({ sample: colorResults.length + i + 1, correct: r.correct, timeMs: r.timeMs })),
      ],
      rawResponseTimes: allTimes,
    });
  };

  const progressPct = phase === 'testing' ? ((sampleIdx + 1) / TOTAL_SAMPLES) * 100 : 0;

  /* Ishihara Intro */
  if (phase === 'ishihara-intro') {
    return (
      <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-700">
        <div className="flex flex-col items-center gap-6 text-center p-8 max-w-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-black text-black">&#x2713;</div>
            <div className="w-16 h-0.5 bg-emerald-500"></div>
            <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-sm font-black text-black">2</div>
          </div>
          <div className="px-4 py-2 glass rounded-xl border border-emerald-500/30 text-sm">
            <span className="text-slate-400">Color arrangement completed &mdash; </span>
            <span className="text-emerald-400 font-black">{results.filter(r => r.correct).length}/{results.length} correct</span>
          </div>
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.3)]">
            <img src="/plates/ishihara12.png" alt="Ishihara preview" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white">Ishihara Plate Test</h2>
          <p className="text-slate-300 max-w-md text-sm">
            Now you'll be shown {ishiharaPlates.length} Ishihara color plates. Identify the hidden number in each plate using both eyes.
          </p>
          <div className="max-w-md w-full p-4 glass border-2 border-cyan-500/30 rounded-2xl space-y-2">
            <div className="flex items-center gap-3 text-cyan-400">
              <span className="text-xl">&#x1F441;&#xFE0F;</span>
              <span className="text-sm font-bold">Use both eyes &mdash; no covering needed</span>
            </div>
            <p className="text-slate-400 text-xs">Look at each plate and select the number you see, or &quot;Can&apos;t See&quot; if you see nothing.</p>
          </div>
          <button
            onClick={() => { setIshiharaIdx(0); ishiharaStartTime.current = Date.now(); setPhase('ishihara-testing'); }}
            className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-full text-lg transition-transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.5)]"
          >
            Start Ishihara Test
          </button>
        </div>
      </div>
    );
  }

  /* Ishihara Testing Phase */
  if (phase === 'ishihara-testing' && currentIshiharaPlate) {
    const ishiharaProgress = ((ishiharaIdx + 1) / ishiharaPlates.length) * 100;
    return (
      <div className="w-full h-full flex flex-col md:flex-row gap-2 md:gap-4 animate-in fade-in duration-500 overflow-x-hidden overflow-y-auto relative">
        {/* LEFT: Info Panel (hidden on mobile) */}
        <div className="hidden md:flex shrink-0 flex-col gap-3 items-center" style={{ width: 220 }}>
          <div className="w-full glass rounded-2xl border border-white/5 p-3 space-y-2">
            <div className="text-center">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ishihara Plates</div>
              <div className="text-lg font-black text-white">Plate {ishiharaIdx + 1} of {ishiharaPlates.length}</div>
            </div>
            <div className="h-px bg-white/5"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Correct</span>
              <span className="text-sm font-black text-emerald-400">{ishiharaResults.filter(r => r.correct).length}/{ishiharaResults.length}</span>
            </div>
            <div className="flex items-center justify-center pt-1">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                BOTH EYES
              </span>
            </div>
          </div>
          <div className="text-center px-2">
            <div className="text-[10px] font-bold text-cyan-400/80 flex items-center gap-1 justify-center">
              <span>What number do you see?</span>
            </div>
          </div>
          <AIBotBubble botState={botState} isEyeUncovered={false} coverEye={undefined} />
        </div>

        {/* RIGHT: Ishihara Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="shrink-0 px-6 py-3">
            <h3 className="text-base md:text-2xl font-black text-white uppercase tracking-tight leading-none">Ishihara Color Plates</h3>
            <p className="text-[10px] md:text-xs text-cyan-400 font-bold uppercase tracking-widest mt-0.5">
              Plate {ishiharaIdx + 1} — BOTH EYES
            </p>
          </div>

          {/* Progress */}
          <div className="shrink-0 px-6 pt-2">
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${ishiharaProgress}%` }} />
            </div>
          </div>

          {/* Ishihara Plate Image */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            <div className="w-48 h-48 md:w-72 md:h-72 rounded-full overflow-hidden shadow-2xl bg-[#f5f0e0] border-4 border-white/10 mx-auto">
              <img
                src={currentIshiharaPlate.imageSrc}
                alt={`Ishihara Plate ${ishiharaIdx + 1}`}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Answer Buttons */}
          <div className="shrink-0 p-4 pt-0 space-y-2">
            <p className="text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">What number do you see?</p>
            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
              {ishiharaOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleIshiharaAnswer(opt)}
                  className="py-4 glass border-2 border-white/10 rounded-2xl font-black text-3xl text-white hover:border-cyan-400 hover:bg-cyan-500/20 transition-all active:scale-90"
                >
                  {opt}
                </button>
              ))}
            </div>
            <button
              onClick={() => handleIshiharaAnswer('none')}
              className="w-full py-3 glass border border-white/5 rounded-full text-xs text-slate-500 font-black uppercase tracking-[0.3em] hover:text-white transition-colors"
            >
              Can&apos;t See
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* Done */
  if (phase === 'done') {
    return (
      <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-5xl">&#x2705;</div>
          <h2 className="text-2xl font-black text-white">Color Test Complete</h2>
          <p className="text-slate-400 text-sm">Processing results&hellip;</p>
        </div>
      </div>
    );
  }

  /* Testing Phase */
  const colorHex = ALL_COLORS[currentSample.name] || '#ffffff';

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-2 md:gap-4 animate-in fade-in duration-500 overflow-x-hidden overflow-y-auto relative">

      {/* LEFT: Info Panel (hidden on mobile) */}
      <div className="hidden md:flex shrink-0 flex-col gap-3 items-center" style={{ width: 220 }}>
        <div className="w-full glass rounded-2xl border border-white/5 p-3 space-y-2">
          <div className="text-center">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Color Arrangement</div>
          </div>
          <div className="h-px bg-white/5" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Sample</span>
            <span className="text-sm font-black text-white">{sampleIdx + 1}/{TOTAL_SAMPLES}</span>
          </div>
          <div className="flex items-center justify-center pt-1">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              BOTH EYES
            </span>
          </div>
        </div>
        <div className="text-center px-2">
          <div className="text-[10px] font-bold text-cyan-400/80 flex items-center gap-1 justify-center">
            <span>Select the color below</span>
          </div>
        </div>
        <AIBotBubble botState={botState} isEyeUncovered={false} coverEye={undefined} />
      </div>

      {/* RIGHT: Test Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <div className="shrink-0 px-6 py-3">
          <h3 className="text-base md:text-2xl font-black text-white uppercase tracking-tight leading-none">Color Arrangement</h3>
          <p className="text-[10px] md:text-xs text-cyan-400 font-bold uppercase tracking-widest mt-0.5">
            Sample {sampleIdx + 1}/{TOTAL_SAMPLES} — BOTH EYES
          </p>
        </div>

        {/* Progress */}
        <div className="shrink-0 px-6 pt-2">
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Color Circle */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <div className="relative">
            {/* Outer glow */}
            <div className="absolute inset-0 rounded-full blur-3xl opacity-40 animate-pulse"
              style={{ background: colorHex, transform: 'scale(1.4)' }} />
            {/* Main circle */}
            <div
              className="relative w-36 h-36 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-full border-4 border-white/20 shadow-2xl transition-colors duration-500"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${colorHex}ee, ${colorHex}cc, ${colorHex})`,
                boxShadow: `0 0 60px ${colorHex}50, 0 0 120px ${colorHex}25, inset 0 -8px 25px rgba(0,0,0,0.25), inset 0 8px 25px rgba(255,255,255,0.12)`,
              }}
            >
              {/* Shine */}
              <div className="absolute top-5 left-8 w-14 h-7 md:w-20 md:h-10 bg-white/25 rounded-full blur-md rotate-[-30deg]" />
              {/* Question mark */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-5xl md:text-6xl font-black text-white/30 select-none drop-shadow-lg">?</span>
              </div>
            </div>
          </div>
        </div>

        {/* Answer Buttons */}
        <div className="shrink-0 p-4 pt-0 space-y-2">
          <p className="text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">What color is this circle?</p>
          <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
            {shuffledChoices.map(colorName => {
              const hex = ALL_COLORS[colorName] || '#888';
              return (
                <button
                  key={colorName}
                  onClick={() => handleSelect(colorName)}
                  className="group py-4 px-5 glass border-2 border-white/10 rounded-2xl font-black uppercase text-sm tracking-wider hover:border-cyan-400 hover:bg-cyan-500/10 transition-all active:scale-95 flex items-center gap-4 justify-center"
                >
                  <div
                    className="w-9 h-9 rounded-full border-2 border-white/25 shrink-0 shadow-lg group-hover:scale-110 transition-transform"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${hex}dd, ${hex})`,
                      boxShadow: `0 0 14px ${hex}40, inset 0 2px 6px rgba(255,255,255,0.15)`,
                    }}
                  />
                  <span className="text-white text-base">{colorName}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorTest;
