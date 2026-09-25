import React, { useState, useEffect } from 'react';
import { TestResult, AmslerDistortionCoord } from '../../types';
import { useAIBot } from '../../hooks/useAIBot';
import AIBotBubble from '../AIBotBubble';

interface Props {
  t: any;
  stream?: MediaStream | null;
  onFinish: (result: TestResult & { amslerDetails?: any }) => void;
}

type DistortionType = 'wavy' | 'missing' | 'blurred' | 'distortion' | 'dark';
type AmslerPhase = 'OD' | 'OS' | 'OU';

const AmslerTest: React.FC<Props> = ({ t, stream, onFinish }) => {
  const [currentPhase, setCurrentPhase] = useState<AmslerPhase>('OD');
  const [distortionMode, setDistortionMode] = useState<DistortionType>('wavy');
  const [markedPointsOD, setMarkedPointsOD] = useState<AmslerDistortionCoord[]>([]);
  const [markedPointsOS, setMarkedPointsOS] = useState<AmslerDistortionCoord[]>([]);
  const [markedPointsOU, setMarkedPointsOU] = useState<AmslerDistortionCoord[]>([]);
  const [reportedNormalOD, setReportedNormalOD] = useState<boolean | null>(null);
  const [reportedNormalOS, setReportedNormalOS] = useState<boolean | null>(null);
  const [reportedNormalOU, setReportedNormalOU] = useState<boolean | null>(null);

  const { botState, botStart, botRecordTrial, botFinish } = useAIBot();

  useEffect(() => {
    botStart();
  }, [currentPhase]);

  const activePoints = currentPhase === 'OD' ? markedPointsOD : currentPhase === 'OS' ? markedPointsOS : markedPointsOU;
  const setActivePoints = currentPhase === 'OD' ? setMarkedPointsOD : currentPhase === 'OS' ? setMarkedPointsOS : setMarkedPointsOU;

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
    if (currentPhase === 'OD') {
      setReportedNormalOD(isNormal);
      botRecordTrial(isNormal, 0, 3);
      setCurrentPhase('OS');
    } else if (currentPhase === 'OS') {
      setReportedNormalOS(isNormal);
      botRecordTrial(isNormal, 1, 3);
      setCurrentPhase('OU');
    } else {
      setReportedNormalOU(isNormal);
      botRecordTrial(isNormal, 2, 3);

      const hasIssuesOD = markedPointsOD.length > 0 || reportedNormalOD === false;
      const hasIssuesOS = markedPointsOS.length > 0 || reportedNormalOS === false;
      const hasIssuesOU = markedPointsOU.length > 0 || isNormal === false;

      const score = (hasIssuesOD ? 0 : 1) + (hasIssuesOS ? 0 : 1) + (hasIssuesOU ? 0 : 1);
      const findings = hasIssuesOD || hasIssuesOS || hasIssuesOU
        ? `Central visual distortion reported in screening (${hasIssuesOD ? 'OD ' : ''}${hasIssuesOS ? 'OS ' : ''}${hasIssuesOU ? 'OU' : ''}). Comprehensive examination recommended.`
        : 'Amsler macular grid uniform across all 3 evaluations (OD, OS, OU) — negative for central distortion or scotoma.';

      botFinish(score, 3);

      onFinish({
        testName: 'Amsler Macular Grid',
        score,
        total: 3,
        confidence: 0.96,
        findings,
        difficulty: hasIssuesOD || hasIssuesOS || hasIssuesOU ? 'hard' : 'easy',
        perSampleScores: [
          { sample: 1, correct: !hasIssuesOD, timeMs: 450 },
          { sample: 2, correct: !hasIssuesOS, timeMs: 460 },
          { sample: 3, correct: !hasIssuesOU, timeMs: 440 },
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
          OU: {
            eye: 'OU',
            distortionDetected: hasIssuesOU,
            missingAreaDetected: markedPointsOU.some((p) => p.type === 'missing'),
            centralAbnormalityDetected: hasIssuesOU,
            markedCoordinates: markedPointsOU,
            tested: true,
          },
        },
      });
    }
  };

  const phaseLabel =
    currentPhase === 'OD'
      ? 'Sample 1/3: 👁️ Right Eye (OD) — Please cover Left Eye'
      : currentPhase === 'OS'
      ? 'Sample 2/3: 👁️ Left Eye (OS) — Please cover Right Eye'
      : 'Sample 3/3: 👀 Both Eyes (OU) — Binocular Fixation';

  const phaseBadge =
    currentPhase === 'OD' ? 'Phase 1 of 3 (OD)' : currentPhase === 'OS' ? 'Phase 2 of 3 (OS)' : 'Phase 3 of 3 (OU)';

  return (
    <div className="w-full h-full flex flex-col justify-between items-center p-2 sm:p-4 max-w-4xl mx-auto animate-in fade-in select-none">
      {/* Header Bar */}
      <div className="w-full flex items-center justify-between bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-cyan-500/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⬛</span>
          <div>
            <h2 className="text-xs sm:text-sm md:text-base font-black text-white uppercase tracking-wider">
              Amsler Macular Grid Screening (3 Samples)
            </h2>
            <p className="text-[10px] text-cyan-400 font-bold uppercase">
              {phaseLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-300">
            {phaseBadge}
          </span>
        </div>
      </div>

      {/* Center Amsler Grid */}
      <div className="w-full flex-1 min-h-0 flex items-center justify-center my-1.5 max-w-sm">
        <div
          onClick={handleGridClick}
          className="relative w-full aspect-square max-h-[190px] sm:max-h-[220px] bg-black border-4 border-slate-600 rounded-2xl shadow-xl cursor-crosshair overflow-hidden select-none"
        >
          {/* Grid lines (20x20 squares) */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(255, 255, 255, 0.4) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.4) 1px, transparent 1px)
              `,
              backgroundSize: '5% 5%',
            }}
          />

          {/* Center fixation dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_12px_#fff] pointer-events-none" />

          {/* Marked points */}
          {activePoints.map((pt, idx) => (
            <div
              key={idx}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none animate-pulse"
              style={{
                left: `${pt.x}%`,
                top: `${pt.y}%`,
                width: 14,
                height: 14,
                background: pt.type === 'missing' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(245, 158, 11, 0.9)',
                border: '2px solid white',
              }}
            />
          ))}
        </div>
      </div>

      {/* Distortion Mode & Clear Buttons */}
      <div className="w-full max-w-lg flex items-center justify-between gap-2 shrink-0 py-0.5">
        <div className="flex gap-1.5 overflow-x-auto py-0.5">
          {(['wavy', 'missing', 'blurred'] as DistortionType[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setDistortionMode(mode)}
              className={`px-2.5 py-1 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                distortionMode === mode
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        {activePoints.length > 0 && (
          <button
            onClick={handleClearPoints}
            className="px-2 py-0.5 text-[10px] font-bold text-red-400 hover:text-red-300 underline cursor-pointer"
          >
            Clear ({activePoints.length})
          </button>
        )}
      </div>

      {/* Bottom Confirmation Controls — Guaranteed Visible */}
      <div className="w-full max-w-lg flex gap-2 shrink-0 pt-1 pb-1">
        <button
          onClick={() => handleEyeComplete(true)}
          className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-md active:scale-95 transition-all min-h-[44px] sm:min-h-[48px] cursor-pointer flex items-center justify-center text-center"
        >
          ✓ All Lines Straight
        </button>
        <button
          onClick={() => handleEyeComplete(false)}
          className="flex-1 py-2.5 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-md active:scale-95 transition-all min-h-[44px] sm:min-h-[48px] cursor-pointer flex items-center justify-center text-center"
        >
          ⚠️ Distortion Detected
        </button>
      </div>
    </div>
  );
};

export default AmslerTest;
