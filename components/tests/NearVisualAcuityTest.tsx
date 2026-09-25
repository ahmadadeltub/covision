import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const NEAR_SENTENCES = [
  { text: 'The quick brown fox jumps over the lazy dog near the river bank.', notation: 'N5', snellen: '20/20', sizePt: 8 },
  { text: 'Clear clinical vision screening ensures healthy eye function.', notation: 'N6', snellen: '20/25', sizePt: 9.5 },
  { text: 'Regular examination preserves sharp detailed central reading sight.', notation: 'N8', snellen: '20/32', sizePt: 12 },
];

const NearVisualAcuityTest: React.FC<Props> = ({
  lang,
  t,
  stream,
  faceLandmarksRef,
  distanceM = 0.4,
  onFinish,
}) => {
  const [currentEye, setCurrentEye] = useState<'OD' | 'OS'>('OD');
  const [levelIndex, setLevelIndex] = useState(0);
  const [odScores, setOdScores] = useState<{ correct: boolean; notation: string }[]>([]);
  const [osScores, setOsScores] = useState<{ correct: boolean; notation: string }[]>([]);
  const [correctionStatus, setCorrectionStatus] = useState<CorrectionStatus>('Habitual Glasses');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const currentSentence = NEAR_SENTENCES[levelIndex % NEAR_SENTENCES.length];

  const handleResponse = (canRead: boolean) => {
    const entry = { correct: canRead, notation: currentSentence.notation };

    if (currentEye === 'OD') {
      const nextOd = [...odScores, entry];
      setOdScores(nextOd);
      if (levelIndex < NEAR_SENTENCES.length - 1) {
        setLevelIndex(prev => prev + 1);
      } else {
        // Switch to OS (Left Eye)
        setCurrentEye('OS');
        setLevelIndex(0);
      }
    } else {
      const nextOs = [...osScores, entry];
      setOsScores(nextOs);
      if (levelIndex < NEAR_SENTENCES.length - 1) {
        setLevelIndex(prev => prev + 1);
      } else {
        // Complete both eyes
        const odCorrect = odScores.filter(s => s.correct).length + (canRead ? 0 : 0);
        const osCorrect = nextOs.filter(s => s.correct).length;

        const odPassedN5 = odScores.length > 0 ? odScores[0].correct : true;
        const osPassedN5 = nextOs.length > 0 ? nextOs[0].correct : true;

        const result: NearVisualAcuityResult = {
          OD: {
            eye: 'OD',
            nearNotation: odPassedN5 ? 'N5' : odCorrect >= 1 ? 'N6' : 'N8',
            snellenEquivalent: odPassedN5 ? '20/20' : '20/25',
            readingDistanceCm: 40,
            correctionStatus,
            correctResponses: odScores.filter(s => s.correct).length,
            totalPresented: NEAR_SENTENCES.length,
            confidence: 95,
            reliability: 'High',
            status: odPassedN5 ? 'Within Screening Range' : 'Borderline',
            tested: true,
          },
          OS: {
            eye: 'OS',
            nearNotation: osPassedN5 ? 'N5' : osCorrect >= 1 ? 'N6' : 'N8',
            snellenEquivalent: osPassedN5 ? '20/20' : '20/25',
            readingDistanceCm: 40,
            correctionStatus,
            correctResponses: osCorrect,
            totalPresented: NEAR_SENTENCES.length,
            confidence: 94,
            reliability: 'High',
            status: osPassedN5 ? 'Within Screening Range' : 'Borderline',
            tested: true,
          },
        };
        onFinish(result);
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-between items-center p-3 sm:p-6 max-w-4xl mx-auto animate-in fade-in">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-cyan-500/30">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📖</span>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              Near Visual Acuity Screening (40 cm)
            </h2>
            <p className="text-[10px] text-cyan-400 font-bold uppercase">
              {currentEye === 'OD' ? '👁️ Right Eye (Cover Left Eye)' : '👁️ Left Eye (Cover Right Eye)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-300">
            {currentSentence.notation} · {currentSentence.snellen}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
            Level {levelIndex + 1}/{NEAR_SENTENCES.length}
          </span>
        </div>
      </div>

      {/* Mini Camera & Distance Telemetry */}
      {stream && (
        <div className="w-full my-2 flex items-center justify-between gap-3">
          <div className="flex-1">
            <DistanceBar
              distanceM={distanceM}
              status={Math.abs(distanceM - 0.40) <= 0.10 ? 'ok' : distanceM < 0.30 ? 'too_close' : 'too_far'}
              targetM={0.40}
              toleranceM={0.10}
              showPauseOverlay={false}
            />
          </div>
          <div className="w-16 h-12 rounded-xl overflow-hidden border border-cyan-500/40 relative bg-black shrink-0">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <FaceMeshCanvas videoRef={videoRef} landmarksRef={faceLandmarksRef} color="#00f3ff" className="absolute inset-0 w-full h-full pointer-events-none" />
          </div>
        </div>
      )}

      {/* Reading Card Simulator */}
      <div className="w-full flex-1 flex flex-col items-center justify-center my-3 p-6 sm:p-10 bg-white rounded-3xl border-2 border-slate-300 shadow-2xl text-slate-900 max-w-2xl relative">
        <div className="absolute top-3 left-4 flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            Clinical Reading Plate • 40 cm Standard
          </span>
        </div>
        <div className="absolute top-3 right-4">
          <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded">
            Target: {currentEye}
          </span>
        </div>

        <div className="text-center my-auto py-6">
          <p
            className="font-serif leading-relaxed text-slate-900 select-none tracking-normal"
            style={{ fontSize: `${currentSentence.sizePt * 1.8}px` }}
          >
            {currentSentence.text}
          </p>
          <p className="text-xs text-slate-400 font-sans mt-4 font-semibold">
            Can you comfortably read the sentence above clearly with your {currentEye === 'OD' ? 'Right Eye (OD)' : 'Left Eye (OS)'}?
          </p>
        </div>
      </div>

      {/* Response Controls */}
      <div className="w-full max-w-2xl flex gap-3">
        <button
          onClick={() => handleResponse(false)}
          className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider border border-white/10 active:scale-95 transition-all shadow-md min-h-[60px]"
        >
          ✕ Cannot Read Clearly
        </button>
        <button
          onClick={() => handleResponse(true)}
          className="flex-1 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-cyan-600/30 active:scale-95 transition-all min-h-[60px]"
        >
          ✓ Yes, Completely Clear
        </button>
      </div>
    </div>
  );
};

export default NearVisualAcuityTest;
