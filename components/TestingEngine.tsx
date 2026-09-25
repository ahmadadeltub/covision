
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TestType, TestResult, CalibrationData, Language } from '../types';
import AcuityTest from './tests/AcuityTest';
import ColorTest from './tests/ColorTest';
import SnellenTest from './tests/SnellenTest';
import ContrastTest from './tests/ContrastTest';
import AstigmatismTest from './tests/AstigmatismTest';
import AmslerTest from './tests/AmslerTest';
import NearVisualAcuityTest from './tests/NearVisualAcuityTest';
import VisualFieldTest from './tests/VisualFieldTest';
import OcularMotilityTest from './tests/OcularMotilityTest';
import DistanceBar from './DistanceBar';
import FaceMeshCanvas from './FaceMeshCanvas';

interface Props {
  lang: Language;
  t: any;
  tests: TestType[];
  calibration: CalibrationData;
  stream?: MediaStream | null;
  faceLandmarksRef?: React.RefObject<any[] | null>;
  distanceM?: number;
  distanceStatus?: 'ok' | 'too_close' | 'too_far' | 'no_face';
  onComplete: (results: TestResult[]) => void;
}

const TestingEngine: React.FC<Props> = ({
  lang,
  t,
  tests,
  calibration,
  stream,
  faceLandmarksRef,
  distanceM: propDistanceM = 0,
  distanceStatus: propDistanceStatus = 'no_face',
  onComplete
}) => {
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [results, setResults] = useState<TestResult[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const currentType = tests[currentTestIndex];

  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach camera stream to this global video viewer
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stream, currentType]);

  const handleTestFinish = (result: TestResult) => {
    const newResults = [...results, result];
    if (currentTestIndex < tests.length - 1) {
      setResults(newResults);
      setCurrentTestIndex(prev => prev + 1);
    } else {
      onComplete(newResults);
    }
  };

  const handleDistanceStatus = useCallback((status: 'ok' | 'too_close' | 'too_far' | 'no_face') => {
    setIsPaused(status === 'too_close');
  }, []);

  const progress = ((currentTestIndex + 1) / tests.length) * 100;

  return (
    <div className="w-full h-full flex flex-col max-w-7xl mx-auto overflow-hidden">
      {/* Distance Enforcement Bar */}
      {stream && (
        <div className="shrink-0 px-3 md:px-6 pt-1 sm:pt-2">
          <DistanceBar
            distanceM={propDistanceM}
            status={propDistanceStatus}
            targetM={new URLSearchParams(window.location.search).get('dev') === 'true' ? 0.5 : 1.0}
            toleranceM={new URLSearchParams(window.location.search).get('dev') === 'true' ? 0.3 : 0.15}
            onStatusChange={handleDistanceStatus}
            showPauseOverlay={true}
          />
        </div>
      )}

      {/* Global Mini Camera View (Top Right) */}
      {stream && (
        <div className="absolute top-2 right-2 md:top-3 md:right-4 z-50 w-20 h-28 sm:w-24 sm:h-32 md:w-32 md:h-44 rounded-2xl overflow-hidden border-2 border-[#1c96c5]/40 shadow-[0_0_20px_rgba(28,150,197,0.3)] bg-black/60 backdrop-blur-md pointer-events-none transition-all duration-300">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <FaceMeshCanvas
            videoRef={videoRef}
            landmarksRef={faceLandmarksRef}
            color="#1c96c5"
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/75 border border-[#1c96c5]/40 text-[8px] md:text-[9px] text-[#1c96c5] font-black tracking-widest uppercase shadow-sm flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-[#1c96c5] animate-ping inline-block" />
            Live
          </div>
        </div>
      )}

      {/* Progress Header */}
      <div className="shrink-0 pt-1 pb-1 px-3 md:px-6 space-y-1">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <div className="text-xs md:text-sm font-black text-cyan-500 uppercase tracking-[0.15em] md:tracking-[0.3em]">Phase {currentTestIndex + 1} / {tests.length}</div>
          </div>
          <div className="text-xs md:text-sm font-black text-slate-500 uppercase tracking-widest">{Math.round(progress)}%</div>
        </div>

        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-white/5 relative">
          <div
            className="bg-gradient-to-r from-cyan-500 to-indigo-600 h-full transition-all duration-700 shadow-[0_0_15px_rgba(0,243,255,0.6)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Test Area — blurred & locked when too close */}
      <div className={`flex-1 min-h-0 relative p-1 sm:p-2 md:p-3 overflow-hidden flex flex-col transition-all duration-300 ${isPaused ? 'opacity-30 pointer-events-none blur-sm' : ''}`}>
        {currentType === TestType.Acuity && (
          <AcuityTest calibration={calibration} t={t} stream={stream} onFinish={handleTestFinish} />
        )}
        {currentType === TestType.NearAcuity && (
          <NearVisualAcuityTest
            lang={lang}
            t={t}
            stream={stream}
            faceLandmarksRef={faceLandmarksRef}
            distanceM={propDistanceM}
            onFinish={(res) => {
              const score = res.OD.correctResponses;
              const total = res.OD.totalPresented || 3;
              handleTestFinish({
                testName: 'Near Visual Acuity (40cm)',
                score,
                total: 3,
                confidence: 0.95,
                findings: `Near Acuity: ${res.OD.snellenEquivalent} (${res.OD.nearNotation}) — ${score}/3 samples identified`,
                nearAcuityData: res,
              });
            }}
          />
        )}
        {currentType === TestType.Color && (
          <ColorTest t={t} stream={stream} onFinish={handleTestFinish} />
        )}
        {currentType === TestType.Snellen && (
          <SnellenTest calibration={calibration} t={t} stream={stream} onFinish={handleTestFinish} />
        )}
        {currentType === TestType.Contrast && (
          <ContrastTest calibration={calibration} t={t} stream={stream} onFinish={handleTestFinish} />
        )}
        {currentType === TestType.Astigmatism && (
          <AstigmatismTest t={t} stream={stream} onFinish={handleTestFinish} />
        )}
        {currentType === TestType.Amsler && (
          <AmslerTest t={t} stream={stream} onFinish={handleTestFinish} />
        )}
        {currentType === TestType.VisualField && (
          <VisualFieldTest
            lang={lang}
            t={t}
            stream={stream}
            onFinish={(res) => {
              const score = res.OD.detected;
              const total = res.OD.stimuliPresented || 3;
              const odRate = (score / total) * 100;
              handleTestFinish({
                testName: 'Central Visual Field (3 Samples)',
                score,
                total: 3,
                confidence: 0.94,
                findings: `Field Sensitivity: ${odRate.toFixed(0)}% (${score}/3 peripheral flashes detected)`,
                visualFieldData: res,
              });
            }}
          />
        )}
        {currentType === TestType.Motility && (
          <OcularMotilityTest
            lang={lang}
            t={t}
            stream={stream}
            faceLandmarksRef={faceLandmarksRef}
            onFinish={(res) => {
              const score = res.gazePositionsCompleted || 3;
              handleTestFinish({
                testName: 'Ocular Motility (3 Cardinal Gazes)',
                score,
                total: 3,
                confidence: res.trackingConfidence || 0.94,
                findings: `Completed: ${score}/3 cardinal gazes, Alignment: ${res.movementSymmetry}`,
                motilityData: res,
              });
            }}
          />
        )}
      </div>

      {/* PAUSED Overlay — shown when user is too close */}
      {isPaused && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none" style={{ top: '40%' }}>
          <div className="px-8 py-4 bg-red-600/95 rounded-2xl border-2 border-red-400 shadow-[0_0_60px_rgba(239,68,68,0.6)] animate-pulse flex flex-col items-center gap-2">
            <span className="text-white font-black text-xl md:text-2xl uppercase tracking-[0.3em]">⚠️ TEST PAUSED</span>
            <span className="text-red-200 font-bold text-sm md:text-base uppercase tracking-widest">Step back to 1 meter distance</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}
      </style>
    </div>
  );
};

export default TestingEngine;
