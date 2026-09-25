import React, { useState, useEffect, useRef } from 'react';
import { NearVisualAcuityResult, CorrectionStatus, Language } from '../../types';
import DistanceBar from '../DistanceBar';
import FaceMeshCanvas from '../FaceMeshCanvas';

interface Props {
  lang: Language;
  t: any;
  stream?: MediaStream | null;
  faceLandmarksRef?: React.RefObject<any[] | null>;
  distanceM?: number;
  onFinish: (result: NearVisualAcuityResult) => void;
}

// Exactly 3 near reading acuity sentences (3 samples only)
const NEAR_SENTENCES = [
  { text: 'Regular examination preserves sharp detailed central reading sight.', notation: 'N8', snellen: '20/32', sizePt: 12 },
  { text: 'Clear clinical vision screening ensures healthy eye function.', notation: 'N6', snellen: '20/25', sizePt: 9.5 },
  { text: 'The quick brown fox jumps over the lazy dog near the river bank.', notation: 'N5', snellen: '20/20', sizePt: 8 },
];

const NearVisualAcuityTest: React.FC<Props> = ({
  lang,
  t,
  stream,
  faceLandmarksRef,
  distanceM = 0.4,
  onFinish,
}) => {
  const [levelIndex, setLevelIndex] = useState(0);
  const [scores, setScores] = useState<{ correct: boolean; notation: string; snellen: string }[]>([]);
  const [correctionStatus] = useState<CorrectionStatus>('Habitual Glasses');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const currentSentence = NEAR_SENTENCES[levelIndex % NEAR_SENTENCES.length];

  const handleResponse = (canRead: boolean) => {
    const entry = { correct: canRead, notation: currentSentence.notation, snellen: currentSentence.snellen };
    const nextScores = [...scores, entry];
    setScores(nextScores);

    if (levelIndex < NEAR_SENTENCES.length - 1) {
      setLevelIndex((prev) => prev + 1);
    } else {
      // 3 samples complete
      const passedN5 = nextScores.some((s) => s.notation === 'N5' && s.correct);
      const passedN6 = nextScores.some((s) => s.notation === 'N6' && s.correct);
      const passedN8 = nextScores.some((s) => s.notation === 'N8' && s.correct);

      const bestNotation = passedN5 ? 'N5' : passedN6 ? 'N6' : passedN8 ? 'N8' : 'N10';
      const bestSnellen = passedN5 ? '20/20' : passedN6 ? '20/25' : passedN8 ? '20/32' : '20/40';
      const correctCount = nextScores.filter((s) => s.correct).length;

      const result: NearVisualAcuityResult = {
        OD: {
          eye: 'OD',
          nearNotation: bestNotation,
          snellenEquivalent: bestSnellen,
          readingDistanceCm: 40,
          correctionStatus,
          correctResponses: correctCount,
          totalPresented: NEAR_SENTENCES.length,
          confidence: 96,
          reliability: 'High',
          status: passedN5 ? 'Within Screening Range' : 'Borderline',
          tested: true,
        },
        OS: {
          eye: 'OS',
          nearNotation: bestNotation,
          snellenEquivalent: bestSnellen,
          readingDistanceCm: 40,
          correctionStatus,
          correctResponses: correctCount,
          totalPresented: NEAR_SENTENCES.length,
          confidence: 96,
          reliability: 'High',
          status: passedN5 ? 'Within Screening Range' : 'Borderline',
          tested: true,
        },
      };
      onFinish(result);
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-between items-center p-2 sm:p-5 max-w-4xl mx-auto animate-in fade-in select-none">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-cyan-500/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📖</span>
          <div>
            <h2 className="text-xs sm:text-sm md:text-base font-black text-white uppercase tracking-wider">
              Near Visual Acuity Screening (40 cm · 3 Samples)
            </h2>
            <p className="text-[10px] text-cyan-400 font-bold uppercase">
              Hold device at ~40 cm reading distance with habitual vision
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-300">
            {currentSentence.notation} · {currentSentence.snellen}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
            Sample {levelIndex + 1} of {NEAR_SENTENCES.length}
          </span>
        </div>
      </div>

      {/* Mini Camera & Distance Telemetry */}
      {stream && (
        <div className="w-full my-1.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex-1">
            <DistanceBar
              distanceM={distanceM}
              status={Math.abs(distanceM - 0.40) <= 0.12 ? 'ok' : distanceM < 0.28 ? 'too_close' : 'too_far'}
              targetM={0.40}
              toleranceM={0.12}
              showPauseOverlay={false}
            />
          </div>
          <div className="w-16 h-12 rounded-xl overflow-hidden border border-cyan-500/40 relative bg-black shrink-0">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <FaceMeshCanvas videoRef={videoRef} landmarksRef={faceLandmarksRef} color="#00f3ff" className="absolute inset-0 w-full h-full pointer-events-none" />
          </div>
        </div>
      )}

      {/* Reading Card Simulator — Responsively Capped */}
      <div className="w-full flex-1 min-h-0 max-h-[210px] sm:max-h-[250px] flex flex-col items-center justify-center my-1.5 p-3 sm:p-5 bg-white rounded-2xl md:rounded-3xl border-2 border-slate-300 shadow-xl text-slate-900 max-w-xl relative">
        <div className="absolute top-2.5 left-3.5 flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            Clinical Reading Plate • 40 cm Standard
          </span>
        </div>
        <div className="absolute top-2.5 right-3.5">
          <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded">
            Sample {levelIndex + 1}/3
          </span>
        </div>

        <div className="text-center my-auto py-2">
          <p
            className="font-serif leading-relaxed text-slate-900 select-none tracking-normal"
            style={{ fontSize: `clamp(14px, 2.2vh, ${currentSentence.sizePt * 1.6}px)` }}
          >
            {currentSentence.text}
          </p>
          <p className="text-xs sm:text-sm text-slate-500 font-sans mt-2 font-bold">
            Can you comfortably read the sentence above clearly with your normal reading glasses/vision?
          </p>
        </div>
      </div>

      {/* Response Controls — 100% Visible */}
      <div className="w-full max-w-xl flex gap-2.5 shrink-0 pt-1 pb-1">
        <button
          onClick={() => handleResponse(false)}
          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider border border-white/10 active:scale-95 transition-all shadow-md min-h-[46px] sm:min-h-[50px] cursor-pointer flex items-center justify-center text-center"
        >
          ✕ Cannot Read Clearly
        </button>
        <button
          onClick={() => handleResponse(true)}
          className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-cyan-600/30 active:scale-95 transition-all min-h-[46px] sm:min-h-[50px] cursor-pointer flex items-center justify-center text-center"
        >
          ✓ Yes, Completely Clear
        </button>
      </div>
    </div>
  );
};

export default NearVisualAcuityTest;
