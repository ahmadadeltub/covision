
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TestType, TestResult, CalibrationData, Language } from '../types';
import AcuityTest from './tests/AcuityTest';
import ColorTest from './tests/ColorTest';
import SnellenTest from './tests/SnellenTest';
import ContrastTest from './tests/ContrastTest';
import AstigmatismTest from './tests/AstigmatismTest';
import AmslerTest from './tests/AmslerTest';
import DistanceBar from './DistanceBar';

interface Props {
  lang: Language;
  t: any;
  tests: TestType[];
  calibration: CalibrationData;
  stream?: MediaStream | null;
  distanceM?: number;
  distanceStatus?: 'ok' | 'too_close' | 'too_far' | 'no_face';
  onComplete: (results: TestResult[]) => void;
}

const TestingEngine: React.FC<Props> = ({ lang, t, tests, calibration, stream, distanceM: propDistanceM = 0, distanceStatus: propDistanceStatus = 'no_face', onComplete }) => {
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
        <div className="shrink-0 px-4 md:px-8 pt-4">
          <DistanceBar
            distanceM={propDistanceM}
            status={propDistanceStatus}
            targetM={new URLSearchParams(window.location.search).get('dev') === 'true' ? 0.5 : 2.0}
            toleranceM={new URLSearchParams(window.location.search).get('dev') === 'true' ? 0.3 : 0.15}
            onStatusChange={handleDistanceStatus}
            showPauseOverlay={true}
          />
        </div>
      )}

      {/* Global Mini Camera View (Top Right) */}
      {stream && (
        <div className="absolute top-4 right-4 z-50 w-24 h-32 md:w-32 md:h-40 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black/50 backdrop-blur-sm pointer-events-none">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-[8px] md:text-[10px] text-white font-bold tracking-wider uppercase">
            Live
          </div>
        </div>
      )}

      {/* Progress Header */}
      <div className="shrink-0 pt-4 pb-2 px-8 space-y-4">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <div className="text-xl font-black text-cyan-500 uppercase tracking-[0.4em]">Screening Phase {currentTestIndex + 1} / {tests.length}</div>
          </div>
          <div className="text-xl font-black text-slate-500 uppercase tracking-widest">{Math.round(progress)}%</div>
        </div>

        <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-white/5 relative">
          <div
            className="bg-gradient-to-r from-cyan-500 to-indigo-600 h-full transition-all duration-700 shadow-[0_0_20px_rgba(0,243,255,0.6)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Test Area */}
      <div className="flex-1 min-h-0 relative p-4 md:p-6 lg:p-8 transition-opacity duration-300">
        {currentType === TestType.Acuity && (
          <AcuityTest calibration={calibration} t={t} stream={stream} onFinish={handleTestFinish} />
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
      </div>

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
