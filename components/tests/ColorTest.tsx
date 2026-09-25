
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TestResult } from '../../types';
import { PLATES } from '../../utils/ishiharaPlates';

import { useAIBot } from '../../hooks/useAIBot';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
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

const TOTAL_SAMPLES = 3;

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
    return shuffled.slice(0, Math.min(3, shuffled.length));
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

  // Voice commands mapping
  const voiceCommands = useMemo(() => {
    const map: Record<string, string> = {};
    const arabicColors: Record<string, string> = {
      'Red': 'احمر', 'Green': 'اخضر', 'Blue': 'ازرق', 'Yellow': 'اصفر',
      'Orange': 'برتقالي', 'Purple': 'بنفسجي', 'Pink': 'وردي', 'Teal': 'تركواز',
      'Brown': 'بني', 'Gray': 'رمادي', 'Maroon': 'عنابي', 'Gold': 'ذهبي',
      'Silver': 'فضي', 'Lime': 'ليموني', 'Magenta': 'ارجواني', 'White': 'ابيض'
    };

    if (phase === 'testing' && currentSample) {
        const colors = [currentSample.name, ...currentSample.confusers];
        colors.forEach(c => {
            map[c.toLowerCase()] = c;
            const arabic = arabicColors[c];
            if (arabic) {
                map[arabic] = c;
                if (arabic.startsWith('ا')) map['أ' + arabic.slice(1)] = c;
                // Add common variations
                if (c === 'Red') map['حمار'] = c;
                if (c === 'Green') map['خضار'] = c;
                if (c === 'Blue') map['زرق'] = c;
            }
        });
    } else if (phase === 'ishihara-testing') {
        const allNumbers = ['2', '3', '5', '6', '7', '8', '9', '12', '15', '16', '25', '29', '35', '42', '45', '74', '96', '97'];
        allNumbers.forEach(n => { map[n] = n; });
        map["can't see"] = "none"; map["cant see"] = "none"; map["nothing"] = "none"; map["لا أرى"] = "none"; map["لا اعرف"] = "none"; map["مش شايف"] = "none";
        
        const arabicNums: Record<string, string> = {
            'اثنان': '2', 'اتنين': '2', 'تنين': '2', 'ثلاثة': '3', 'تلاتة': '3', 'تلات': '3', 'خمسة': '5', 'خمس': '5', 'ستة': '6', 'ست': '6', 'سبعة': '7', 'سبع': '7', 'ثمانية': '8', 'تمانية': '8', 'تمان': '8', 'تسعة': '9', 'تسع': '9',
            'اثنا عشر': '12', 'اتناشر': '12', 'اطناشر': '12', 'خمسة عشر': '15', 'خمستاشر': '15', 'ستة عشر': '16', 'ستاشر': '16',
            'خمسة وعشرون': '25', 'خمسة وعشرين': '25', 'تسعة وعشرون': '29', 'تسعة وعشرين': '29',
            'خمسة وثلاثون': '35', 'خمسة وتلاتين': '35', 'اثنان وأربعون': '42', 'اتنين واربعين': '42',
            'خمسة وأربعون': '45', 'خمسة واربعين': '45', 'أربعة وسبعون': '74', 'اربعة وسبعين': '74',
            'ستة وتسعون': '96', 'ستة وتسعين': '96', 'سبعة وتسعون': '97', 'سبعة وتسعين': '97'
        };
        Object.assign(map, arabicNums);
    }
    return map;
  }, [phase, currentSample]);

  const { isListening } = useVoiceCommand({
    commands: voiceCommands,
    onCommand: (cmd) => {
        if (phase === 'testing') handleSelect(cmd);
        else if (phase === 'ishihara-testing') handleIshiharaAnswer(cmd);
    },
    isActive: phase === 'testing' || phase === 'ishihara-testing',
  });

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
      // Finish test directly — no Ishihara phase (handled by standalone ColorVisionTest)
      finishColorTest(newResults);
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
      // Finish with combined results
      setPhase('done');
      const colorOk = results.filter(r => r.correct).length;
      const ishiharaOk = newIshiharaResults.filter(r => r.correct).length;
      const totalCorrect = colorOk + ishiharaOk;
      const totalAttempted = results.length + newIshiharaResults.length;
      const allTimes = [...results.map(r => r.timeMs), ...newIshiharaResults.map(r => r.timeMs)];

      let findings: string, confidence: number;
      if (totalCorrect >= totalAttempted - 1) {
        findings = `Excellent color vision — Arrangement: ${colorOk}/${results.length}, Ishihara: ${ishiharaOk}/${newIshiharaResults.length} (both eyes).`;
        confidence = 0.98;
      } else if (totalCorrect >= totalAttempted * 0.6) {
        findings = `Mild color concern — Arrangement: ${colorOk}/${results.length}, Ishihara: ${ishiharaOk}/${newIshiharaResults.length} (both eyes).`;
        confidence = 0.90;
      } else {
        findings = `Significant color deficiency — Arrangement: ${colorOk}/${results.length}, Ishihara: ${ishiharaOk}/${newIshiharaResults.length} (both eyes). Professional exam recommended.`;
        confidence = 0.95;
      }

      botFinish(totalCorrect, totalAttempted);
      onFinish({
        testName: 'Color Arrangement + Ishihara',
        score: totalCorrect,
        total: totalAttempted,
        confidence,
        findings,
        perSampleScores: [
          ...results.map((r, i) => ({ sample: i + 1, correct: r.correct, timeMs: r.timeMs })),
          ...newIshiharaResults.map((r, i) => ({ sample: results.length + i + 1, correct: r.correct, timeMs: r.timeMs })),
        ],
        rawResponseTimes: allTimes,
      });
    }
  };

  const finishColorTest = (colorResults: typeof results) => {
    setPhase('done');
    const colorOk = colorResults.filter(r => r.correct).length;
    const total = colorResults.length;

    let findings: string, confidence: number;
    if (colorOk >= 3) {
      findings = `Excellent color vision — Arrangement: ${colorOk}/${TOTAL_SAMPLES} (both eyes). Normal color discrimination.`;
      confidence = 0.98;
    } else if (colorOk >= 2) {
      findings = `Mild color concern — Arrangement: ${colorOk}/${TOTAL_SAMPLES} (both eyes). Some difficulty with similar hues.`;
      confidence = 0.90;
    } else {
      findings = `Significant color deficiency — Arrangement: ${colorOk}/${TOTAL_SAMPLES} (both eyes). Comprehensive examination strongly recommended.`;
      confidence = 0.95;
    }

    const allTimes = colorResults.map(r => r.timeMs);
    botFinish(colorOk, total);

    onFinish({
      testName: 'Color Arrangement',
      score: colorOk,
      total,
      confidence,
      findings,
      perSampleScores: colorResults.map((r, i) => ({ sample: i + 1, correct: r.correct, timeMs: r.timeMs })),
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
      <div className="w-full h-full flex flex-col animate-in fade-in duration-500 overflow-hidden relative">

        {/* ═══ MOBILE: compact header + content ═══ */}
        <div className="md:hidden flex flex-col h-full overflow-hidden">
          <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-slate-900/60 backdrop-blur-md border-b border-white/5">
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wide leading-tight">Ishihara Color Plates</div>
              <div className="text-[10px] text-cyan-400 font-bold uppercase">Plate {ishiharaIdx + 1} of {ishiharaPlates.length} — BOTH EYES</div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">BOTH</span>
          </div>
          <div className="shrink-0 px-3 py-1.5">
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all duration-500 rounded-full" style={{ width: `${ishiharaProgress}%` }} />
            </div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center py-2">
            <div style={{ width: 'min(52vw, 160px)', height: 'min(52vw, 160px)' }} className="rounded-full overflow-hidden shadow-xl bg-[#f5f0e0] border-4 border-slate-200 dark:border-white/10">
              <img src={currentIshiharaPlate.imageSrc} alt={`Ishihara Plate ${ishiharaIdx + 1}`} className="w-full h-full object-contain" />
            </div>
          </div>
          <div className="shrink-0 px-3 pb-2 space-y-1.5">
            <p className="text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold">What number do you see?</p>
            <div className="grid grid-cols-4 gap-2">
              {ishiharaOptions.map((opt) => (
                <button key={opt} onClick={() => handleIshiharaAnswer(opt)}
                  className="glass border-2 border-slate-200 dark:border-white/10 rounded-xl font-black text-2xl text-slate-900 dark:text-white hover:border-cyan-400 hover:bg-cyan-500/20 transition-all active:scale-95 h-[52px] flex items-center justify-center cursor-pointer">
                  {opt}
                </button>
              ))}
            </div>
            <button onClick={() => handleIshiharaAnswer('none')}
              className="w-full glass border border-slate-200 dark:border-white/5 rounded-full text-xs text-slate-600 dark:text-slate-400 font-black uppercase tracking-[0.2em] hover:text-white transition-colors h-[40px] flex items-center justify-center cursor-pointer">
              Can&apos;t See
            </button>
          </div>
        </div>

        {/* ═══ DESKTOP: 2-column layout ═══ */}
        <div className="hidden md:flex flex-row h-full gap-4 overflow-hidden">
          {/* LEFT: Info Panel */}
          <div className="shrink-0 flex flex-col gap-3 items-center" style={{ width: 220 }}>
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
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">BOTH EYES</span>
              </div>
            </div>
            <div className="text-center px-2 py-1">
              <div className="text-xs font-black text-cyan-400 flex items-center gap-1.5 justify-center uppercase tracking-wide">
                <span>What number do you see?</span>
              </div>
            </div>
            <AIBotBubble botState={botState} isEyeUncovered={false} coverEye={undefined} />
          </div>

          {/* RIGHT: Ishihara Content */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="shrink-0 px-6 py-3">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Ishihara Color Plates</h3>
              <p className="text-xs text-sky-700 dark:text-cyan-400 font-bold uppercase tracking-widest mt-0.5">Plate {ishiharaIdx + 1} — BOTH EYES</p>
            </div>
            <div className="shrink-0 px-6 pt-2">
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all duration-500 rounded-full" style={{ width: `${ishiharaProgress}%` }} />
              </div>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center p-3">
              <div className="w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden shadow-xl bg-[#f5f0e0] border-4 border-slate-200 dark:border-white/10 mx-auto">
                <img src={currentIshiharaPlate.imageSrc} alt={`Ishihara Plate ${ishiharaIdx + 1}`} className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="shrink-0 p-3 pt-0 space-y-1.5">
              <p className="text-center text-xs text-slate-500 uppercase tracking-widest font-bold mb-0.5">What number do you see?</p>
              <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-xl mx-auto">
                {ishiharaOptions.map((opt) => (
                  <button key={opt} onClick={() => handleIshiharaAnswer(opt)}
                    className="py-2.5 sm:py-3 glass border-2 border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl font-black text-2xl sm:text-3xl text-slate-900 dark:text-white hover:border-cyan-400 hover:bg-cyan-500/20 transition-all active:scale-95 min-h-[56px] flex items-center justify-center cursor-pointer">
                    {opt}
                  </button>
                ))}
              </div>
              <button onClick={() => handleIshiharaAnswer('none')}
                className="w-full max-w-xl mx-auto block py-2 glass border border-slate-200 dark:border-white/5 rounded-full text-xs text-slate-600 dark:text-slate-400 font-black uppercase tracking-[0.2em] hover:text-slate-900 dark:hover:text-white transition-colors min-h-[42px] cursor-pointer">
                Can&apos;t See
              </button>
            </div>
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

  /* Testing Phase — Color Arrangement */
  const colorHex = ALL_COLORS[currentSample.name] || '#ffffff';

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-500 overflow-hidden relative">

      {/* ═══ MOBILE: compact header + content ═══ */}
      <div className="md:hidden flex flex-col h-full overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-slate-900/60 backdrop-blur-md border-b border-white/5">
          <div>
            <div className="text-xs font-black text-white uppercase tracking-wide leading-tight">Color Arrangement</div>
            <div className="text-[10px] text-cyan-400 font-bold uppercase">Sample {sampleIdx + 1}/{TOTAL_SAMPLES} — BOTH EYES</div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">BOTH</span>
        </div>
        <div className="shrink-0 px-3 py-1.5">
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-500 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        {/* Color circle */}
        <div className="flex-1 min-h-0 flex items-center justify-center py-1">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-2xl opacity-40 animate-pulse" style={{ background: colorHex, transform: 'scale(1.3)' }} />
            <div className="relative w-24 h-24 rounded-full border-4 border-slate-200 dark:border-white/20 shadow-xl"
              style={{ background: `radial-gradient(circle at 35% 35%, ${colorHex}ee, ${colorHex})`, boxShadow: `0 0 40px ${colorHex}50` }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-black text-slate-800/40 dark:text-white/30 select-none">?</span>
              </div>
            </div>
          </div>
        </div>
        {/* Color choice buttons */}
        <div className="shrink-0 px-3 pb-2 space-y-1.5">
          <p className="text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold">What color is this circle?</p>
          <div className="grid grid-cols-2 gap-2">
            {shuffledChoices.map(colorName => {
              const hex = ALL_COLORS[colorName] || '#888';
              return (
                <button key={colorName} onClick={() => handleSelect(colorName)}
                  className="group py-2 px-3 glass border-2 border-slate-200 dark:border-white/10 rounded-xl font-black uppercase tracking-wider hover:border-cyan-400 hover:bg-cyan-500/10 transition-all active:scale-95 flex items-center gap-2 justify-center h-[50px] cursor-pointer">
                  <div className="w-5 h-5 rounded-full border-2 border-white/25 shrink-0 shadow-md"
                    style={{ background: `radial-gradient(circle at 35% 35%, ${hex}dd, ${hex})` }} />
                  <span className="text-slate-900 dark:text-white text-xs font-black">{colorName}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ DESKTOP: 2-column layout ═══ */}
      <div className="hidden md:flex flex-row h-full gap-4 overflow-hidden">
        {/* LEFT: Info Panel */}
        <div className="shrink-0 flex flex-col gap-3 items-center" style={{ width: 220 }}>
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
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">BOTH EYES</span>
            </div>
          </div>
          <div className="text-center px-2 py-1">
            <div className="text-xs font-black text-cyan-400 flex items-center gap-1.5 justify-center uppercase tracking-wide">
              <span>Select the color below</span>
            </div>
          </div>
          <AIBotBubble botState={botState} isEyeUncovered={false} coverEye={undefined} />
        </div>

        {/* RIGHT: Test Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="shrink-0 px-6 py-3">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Color Arrangement</h3>
            <p className="text-xs text-sky-700 dark:text-cyan-400 font-bold uppercase tracking-widest mt-0.5">
              Sample {sampleIdx + 1}/{TOTAL_SAMPLES} — BOTH EYES
            </p>
          </div>
          <div className="shrink-0 px-6 pt-2">
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-500 rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-2xl opacity-40 animate-pulse" style={{ background: colorHex, transform: 'scale(1.3)' }} />
              <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full border-4 border-slate-200 dark:border-white/20 shadow-xl transition-colors duration-500"
                style={{ background: `radial-gradient(circle at 35% 35%, ${colorHex}ee, ${colorHex}cc, ${colorHex})`, boxShadow: `0 0 40px ${colorHex}50, inset 0 -6px 18px rgba(0,0,0,0.25)` }}>
                <div className="absolute top-2.5 left-4 w-10 h-5 bg-white/25 rounded-full blur-sm rotate-[-30deg]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-black text-slate-800/40 dark:text-white/30 select-none drop-shadow-md">?</span>
                </div>
              </div>
            </div>
          </div>
          <div className="shrink-0 p-3 pt-0 space-y-1.5">
            <p className="text-center text-xs text-slate-500 uppercase tracking-widest font-bold mb-0.5">What color is this circle?</p>
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5 max-w-xl mx-auto">
              {shuffledChoices.map(colorName => {
                const hex = ALL_COLORS[colorName] || '#888';
                return (
                  <button key={colorName} onClick={() => handleSelect(colorName)}
                    className="group py-2 sm:py-2.5 px-3 sm:px-4 glass border-2 border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl font-black uppercase tracking-wider hover:border-cyan-400 hover:bg-cyan-500/10 transition-all active:scale-95 flex items-center gap-2.5 sm:gap-3 justify-center min-h-[52px] cursor-pointer">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-white/25 shrink-0 shadow-md group-hover:scale-110 transition-transform"
                      style={{ background: `radial-gradient(circle at 35% 35%, ${hex}dd, ${hex})`, boxShadow: `0 0 10px ${hex}40` }} />
                    <span className="text-slate-900 dark:text-white text-sm md:text-base font-black">{colorName}</span>
                  </button>
                );
              })}
            </div>
            <div className="text-center mt-0.5 text-[10px] text-slate-500 uppercase tracking-widest opacity-60 flex items-center justify-center gap-2">
              <span>Voice: Say the color</span>
              {isListening && <span className="text-emerald-400 font-bold animate-pulse">🎤 Listening</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorTest;
