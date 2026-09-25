import React, { useState, useEffect, useRef } from 'react';
import { TestResult, AmslerDistortionCoord } from '../../types';
import { useAIBot } from '../../hooks/useAIBot';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import AIBotBubble from '../AIBotBubble';

interface Props {
  t: any;
  stream?: MediaStream | null;
  onFinish: (result: TestResult & { amslerDetails?: any }) => void;
}

type DistortionType = 'wavy' | 'missing' | 'blurred' | 'distortion' | 'dark';

const AmslerTest: React.FC<Props> = ({ t, stream, onFinish }) => {
  const [currentEye, setCurrentEye] = useState<'OD' | 'OS'>('OD');
  const [distortionMode, setDistortionMode] = useState<DistortionType>('wavy');
  const [markedPointsOD, setMarkedPointsOD] = useState<AmslerDistortionCoord[]>([]);
  const [markedPointsOS, setMarkedPointsOS] = useState<AmslerDistortionCoord[]>([]);
  const [reportedNormalOD, setReportedNormalOD] = useState<boolean | null>(null);
  const [reportedNormalOS, setReportedNormalOS] = useState<boolean | null>(null);

  const { botState, botStart, botFinish } = useAIBot();

  useEffect(() => {
    botStart();
  }, [currentEye]);

  const activePoints = currentEye === 'OD' ? markedPointsOD : markedPointsOS;
  const setActivePoints = currentEye === 'OD' ? setMarkedPointsOD : setMarkedPointsOS;

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    const newCoord: AmslerDistortionCoord = { x, y, type: distortionMode };
    setActivePoints((prev) => [...prev, newCoord]);
  };

  const handleClearPoints = () => {
    setActivePoints([]);
  };

  const handleEyeComplete = (isNormal: boolean) => {
    if (currentEye === 'OD') {
      setReportedNormalOD(isNormal);
      setCurrentEye('OS');
    } else {
      setReportedNormalOS(isNormal);

      const hasIssuesOD = markedPointsOD.length > 0 || isNormal === false;
      const hasIssuesOS = markedPointsOS.length > 0 || isNormal === false;

      const score = (hasIssuesOD ? 0 : 1) + (hasIssuesOS ? 0 : 1);
      const findings = hasIssuesOD || hasIssuesOS
        ? `Possible central visual distortion reported during screening (${hasIssuesOD ? 'OD ' : ''}${hasIssuesOS ? 'OS' : ''}). Professional ophthalmic evaluation recommended.`
        : 'Amsler macular grid uniform in both eyes — negative for reported distortion or central scotoma.';

      botFinish(score, 2);

      onFinish({
        testName: 'Amsler Macular Grid',
        score,
        total: 2,
        confidence: 0.95,
        findings,
        difficulty: hasIssuesOD || hasIssuesOS ? 'hard' : 'easy',
        perSampleScores: [
          { sample: 1, correct: !hasIssuesOD, timeMs: 450 },
          { sample: 2, correct: !hasIssuesOS, timeMs: 460 },
        ],
        amslerDetails: {
          OD: {
            eye: 'OD',
            distortionDetected: hasIssuesOD,
            missingAreaDetected: markedPointsOD.some((p) => p.type === 'missing'),
            centralAbnormalityDetected: hasIssuesOD,
            markedCoordinates: markedPointsOD,
            tested: true,
          },
          OS: {
            eye: 'OS',
            distortionDetected: hasIssuesOS,
            missingAreaDetected: markedPointsOS.some((p) => p.type === 'missing'),
            centralAbnormalityDetected: hasIssuesOS,
            markedCoordinates: markedPointsOS,
            tested: true,
          },
        },
      });
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-between items-center p-3 sm:p-5 max-w-4xl mx-auto animate-in fade-in select-none">
      {/* Header Bar */}
      <div className="w-full flex items-center justify-between bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-cyan-500/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⬛</span>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              Amsler Macular Grid Screening
            </h2>
            <p className="text-[10px] text-cyan-400 font-bold uppercase">
              {currentEye === 'OD' ? '👁️ Right Eye (OD) — Please cover your Left Eye' : '👁️ Left Eye (OS) — Please cover your Right Eye'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-300">
            Eye: {currentEye === 'OD' ? 'Right (OD)' : 'Left (OS)'}
          </span>
        </div>
      </div>

      {/* Tool Selector Bar */}
      <div className="w-full flex flex-wrap items-center justify-center gap-2 py-1 shrink-0">
        <span className="text-[10px] font-black uppercase text-slate-400 mr-2">If you see distortion, tap tool:</span>
        {(['wavy', 'missing', 'blurred', 'dark'] as DistortionType[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setDistortionMode(mode)}
            className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              distortionMode === mode
                ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {mode === 'wavy' && '〰️ Wavy Lines'}
            {mode === 'missing' && '⬜ Missing Area'}
            {mode === 'blurred' && '🌫️ Blurred Spot'}
            {mode === 'dark' && '⬛ Dark / Scotoma'}
          </button>
        ))}
        {activePoints.length > 0 && (
          <button
            onClick={handleClearPoints}
            className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-400 border border-rose-500/30 hover:bg-rose-950/40 cursor-pointer"
          >
            Clear Marks ({activePoints.length})
          </button>
        )}
      </div>

      {/* Interactive Amsler Grid */}
      <div className="w-full flex-1 flex items-center justify-center my-1 relative">
        <div
          onClick={handleGridClick}
          className="aspect-square w-full max-w-[360px] sm:max-w-[420px] bg-slate-950 rounded-2xl border-4 border-slate-700 shadow-2xl relative cursor-crosshair overflow-hidden"
        >
          {/* 20x20 Grid Lines */}
          <div className="absolute inset-0 grid grid-cols-20 grid-rows-20 pointer-events-none">
            {Array.from({ length: 400 }).map((_, i) => (
              <div key={i} className="border-r border-b border-white/20" />
            ))}
          </div>

          {/* Central Red Fixation Dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-rose-500 border-2 border-white shadow-[0_0_15px_#f43f5e] z-20 pointer-events-none" />

          {/* User Marked Distortions */}
          {activePoints.map((pt, idx) => (
            <div
              key={idx}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-amber-300 bg-amber-400/35 flex items-center justify-center text-[9px] font-black text-amber-200 pointer-events-none animate-in zoom-in"
              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
            >
              •
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Confirmation Controls */}
      <div className="w-full max-w-xl flex gap-3 shrink-0 pt-1">
        <button
          onClick={() => handleEyeComplete(true)}
          className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-emerald-600/25 active:scale-95 transition-all min-h-[56px] cursor-pointer"
        >
          ✓ All Lines Are Straight & Clear
        </button>
        <button
          onClick={() => handleEyeComplete(false)}
          className="flex-1 py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-amber-600/25 active:scale-95 transition-all min-h-[56px] cursor-pointer"
        >
          ⚠️ Wavy / Missing Areas Detected
        </button>
      </div>

      <AIBotBubble botState={botState} />
    </div>
  );
};

export default AmslerTest;
