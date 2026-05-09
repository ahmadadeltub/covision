
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Language, AppStep, PatientInfo, UserProfile, TestType, CalibrationData, TestResult, AcuityResult, ColorVisionResult, DistanceCompliance } from './types';
import { translations } from './translations';
import { useFaceDistance } from './hooks/useFaceDistance';

// ─── Original Components (restored) ───
import BiometricScan from './components/BiometricScan';
import ProfileForm from './components/ProfileForm';
import TestSelector from './components/TestSelector';
import Calibration from './components/Calibration';
import TestingEngine from './components/TestingEngine';
import ResultsDashboard from './components/ResultsDashboard';
import FloatingBackground from './components/FloatingBackground';

// ─── New Improved Components ───
import WelcomeScreen from './components/WelcomeScreen';
import PatientForm from './components/PatientForm';
import TumblingETest from './components/TumblingETest';
import ColorVisionIntro from './components/ColorVisionIntro';
import ColorVisionTest from './components/ColorVisionTest';
import MedicalReport from './components/MedicalReport';

import GlobalAIBot from './components/GlobalAIBot';
import { useGlobalBot } from './hooks/useGlobalBot';
import { onMessageListener } from './firebase';

/**
 * Main Application — Full Flow
 * 
 * Combines the original app's pages with new improved components:
 * 
 * 1. Welcome — disclaimer + feature cards (new)
 * 2. TestSelection — pick which tests (original, moved early)
 * 3. BiometricScan — AI face scan with mesh (original)
 * 4. Profile — sync profile data (original)
 * 6. ColorIntro — lighting guidance (new)
 * 7. ColorTest — Ishihara plates (new)
 * 8. Calibration — 2m distance calibration (original, moved before acuity)
 * 9. Testing — Visual Acuity + other tests (original)
 * 10. Results — AI insights dashboard (original)
 * 12. Report — medical PDF report (new)
 */

// Dev mode: add ?dev=true to URL to bypass 2m distance requirement
const IS_DEV = new URLSearchParams(window.location.search).get('dev') === 'true';
const DEV_DISTANCE = 0.5;

const App: React.FC = () => {
  // ─── Global State ───
  const [lang] = useState<Language>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [step, setStep] = useState<AppStep>(AppStep.Welcome);

  // ─── Camera ───
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ─── Data from Original Components ───
  const [pendingBiometrics, setPendingBiometrics] = useState<Partial<UserProfile> | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedTests, setSelectedTests] = useState<TestType[]>([]);
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // ─── Data from New Components ───
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [acuityResult, setAcuityResult] = useState<AcuityResult | null>(null);
  const [colorResult, setColorResult] = useState<ColorVisionResult | null>(null);


  // ─── Face Distance ───
  const {
    videoRef,
    faceLandmarksRef,
    poseLandmarksRef,
    handLandmarksRef,
    status: distanceStatus,
    distanceM,
    isStable,
    complianceLog,
    debugInfo,
    startCamera,
    stopCamera,
    setDebugMode,
    debugMode
  } = useFaceDistance({
    stream: stream,
    targetDistanceM: step === AppStep.BiometricScan ? 0.55 : (IS_DEV ? DEV_DISTANCE : 2.0),
    toleranceM: step === AppStep.BiometricScan ? 0.35 : (IS_DEV ? 0.3 : 0.15),
  });

  const t = translations[lang];

  // ─── Global AI Bot (with distance awareness) ───
  const targetDistM = step === AppStep.BiometricScan ? 0.55 : (IS_DEV ? DEV_DISTANCE : 2.0);
  const tolerM = step === AppStep.BiometricScan ? 0.35 : (IS_DEV ? 0.3 : 0.15);
  const { globalBotState } = useGlobalBot(step, {
    distanceM,
    status: distanceStatus as 'ok' | 'too_close' | 'too_far' | 'no_face' | 'initializing',
    isStable,
    targetM: targetDistM,
    toleranceM: tolerM,
  });

  // ─── Theme & Mobile Detection ───
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    
    const checkMobile = () => {
      const isMob = window.innerWidth <= 768;
      document.body.classList.toggle('is-mobile', isMob);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [theme]);

  // ─── FCM Foreground Notification Listener ───
  useEffect(() => {
    onMessageListener()
      .then((payload: any) => {
        console.log("Foreground push notification received:", payload);
        if (payload?.notification) {
          // Minimalist alert for foreground messages
          alert(`🔔 ${payload.notification.title}\n\n${payload.notification.body}`);
        }
      })
      .catch((err) => console.log('FCM listen error: ', err));
  }, []);

  // ─── Direction & Deep Linking ───
  useEffect(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';

    // Intercept QR Code deep links
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get('share');
    if (sharedData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(sharedData)));
        if (decoded.p) setPatient(decoded.p);
        if (decoded.a) setAcuityResult(decoded.a);
        if (decoded.c) setColorResult(decoded.c);
        if (decoded.t) setTestResults(decoded.t);
        setStep(AppStep.Report);
      } catch (err) {
        console.error('Failed to parse shared report', err);
      }
      // Clean the URL bar so a page refresh doesn't trigger it again
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // ─── Camera Management ───
  const initCamera = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = s;
      setStream(s);
    } catch (err) {
      console.warn('Camera unavailable:', err);
    }
  }, []);

  useEffect(() => {
    if (step === AppStep.BiometricScan || step === AppStep.Calibration || step === AppStep.Testing || step === AppStep.ColorIntro || step === AppStep.ColorTest) {
      initCamera();
    }
    // Also start face distance camera for BiometricScan / Calibration / Testing
    if (step === AppStep.BiometricScan || step === AppStep.Calibration || step === AppStep.Testing) {
      startCamera();
    }
  }, [step, initCamera, startCamera]);

  // Gesture interaction handler


  // ─── Reset ───
  const handleReset = () => {
    stopCamera();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStream(null);
    }
    setStep(AppStep.Welcome);
    setPendingBiometrics(null);
    setProfile(null);
    setSelectedTests([]);
    setCalibration(null);
    setTestResults([]);
    setPatient(null);
    setAcuityResult(null);
    setColorResult(null);
  };

  // ─── Global Particle Background ───
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const particles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];
    const count = 60;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 0.5,
      });
    }
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x, dy = p.y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,200,255,${0.08 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,200,255,${0.25})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div className={`app-wrapper`}
      style={{ background: 'var(--bg-primary)', minHeight: '100vh', position: 'relative' }}
    >
      {/* ─── Global Particle Background ─── */}
      <canvas ref={bgCanvasRef} style={{
        position: 'fixed', inset: 0, width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none',
      }} />
      <FloatingBackground />
      {/* ─── Radial Glow Effects ─── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
          width: '140%', height: '60%',
          background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.08) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-10%',
          width: '50%', height: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-10%',
          width: '50%', height: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)',
        }} />
      </div>
      {/* ─── Gesture Overlay removed — camera now lives inside each test's panel ─── */}

      {/* ─── Header ─── */}
      <header className="app-header no-print" style={{ position: 'relative', zIndex: 200 }}>
        {/* Logo + Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Animated Eye Logo */}
          <div style={{
            width: 36, height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(56,189,248,0.4)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>👁️</span>
          </div>
          <div>
            <h1 style={{
              fontSize: 'clamp(13px, 2.5vw, 17px)',
              fontWeight: 800,
              margin: 0,
              lineHeight: 1.1,
              background: 'linear-gradient(90deg, var(--accent), #818cf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'Outfit, Inter, sans-serif',
              letterSpacing: '-0.01em',
            }}>
              {t.app_title}
            </h1>
            <p style={{
              fontSize: 'clamp(9px, 1.8vw, 11px)',
              fontWeight: 500,
              color: 'var(--text-muted)',
              margin: 0,
              letterSpacing: '0.04em',
            }}>
              {t.app_subtitle}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            style={{
              width: 34, height: 34,
              borderRadius: '50%',
              border: '1.5px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* ─── Distance Indicator (during coverage / testing) ─── */}
      {step === AppStep.Testing && (
        <div className="distance-indicator no-print" style={{
          background: distanceStatus === 'ok' ? 'var(--success-bg)' :
            distanceStatus === 'too_close' ? 'var(--danger-bg)' :
              distanceStatus === 'too_far' ? 'var(--warning-bg)' : 'var(--bg-secondary)',
          color: distanceStatus === 'ok' ? 'var(--success)' :
            distanceStatus === 'too_close' ? 'var(--danger)' :
              distanceStatus === 'too_far' ? 'var(--warning)' : 'var(--text-muted)',
          border: `1px solid ${distanceStatus === 'ok' ? 'var(--success)' :
            distanceStatus === 'too_close' ? 'var(--danger)' :
              distanceStatus === 'too_far' ? 'var(--warning)' : 'var(--border-color)'}`,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          {distanceStatus === 'ok' ? t.distance_ok :
            distanceStatus === 'too_close' ? t.too_close :
              distanceStatus === 'too_far' ? t.too_far : t.no_face}
        </div>
      )}

      {/* ─── Main Content ─── */}
      <main className="app-main" style={{ position: 'relative', zIndex: 1 }}>

        {/* Step 1: Welcome (NEW — improved) */}
        {step === AppStep.Welcome && (
          <WelcomeScreen
            lang={lang}
            onStart={() => setStep(AppStep.TestSelection)}
          />
        )}

        {/* Step 2: Test Selection — pick which tests (moved before calibration) */}
        {step === AppStep.TestSelection && (
          <TestSelector
            lang={lang}
            t={t}
            onComplete={(selected) => {
              setSelectedTests(selected);
              setStep(AppStep.BiometricScan);
            }}
          />
        )}

        {/* Step 3: Biometric Scan (ORIGINAL) */}
        {step === AppStep.BiometricScan && (
          <BiometricScan
            lang={lang}
            t={t}
            stream={stream}
            videoRef={videoRef}
            faceLandmarksRef={faceLandmarksRef}
            handLandmarksRef={handLandmarksRef}
            distanceM={distanceM}
            distanceStatus={distanceStatus}
            debugInfo={debugInfo}
            debugMode={debugMode}
            onDebugToggle={() => setDebugMode(!debugMode)}
            onComplete={(data) => {
              setPendingBiometrics(data);
              setStep(AppStep.Profile);
            }}
          />
        )}

        {/* Step 4: Profile Sync (ORIGINAL) */}
        {step === AppStep.Profile && (
          <ProfileForm
            lang={lang}
            t={t}
            initialData={pendingBiometrics || undefined}
            onComplete={(d) => {
              setProfile(d);
              // Auto-fill patient info from profile
              setPatient({
                fullName: '',
                age: d.age,
                gender: d.gender === 'other' ? 'male' : d.gender,
                dateTime: new Date().toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US'),
                deviceInfo: navigator.userAgent,
              });
              setStep(AppStep.ColorIntro);
            }}
          />
        )}




        {/* Step 7: Testing Engine — runs selected tests (ORIGINAL) */}
        {step === AppStep.Testing && calibration && (
          <TestingEngine
            lang={lang}
            t={t}
            tests={selectedTests}
            calibration={calibration}
            stream={stream}
            distanceM={distanceM}
            distanceStatus={distanceStatus as 'ok' | 'too_close' | 'too_far' | 'no_face'}
            onComplete={(results) => {
              setTestResults(results);
              // Increment tests_completed counter
              fetch('https://api.counterapi.dev/v1/covision_final_v2/tests_completed/up').catch(() => {});
              setStep(AppStep.Report);
            }}
          />
        )}

        {/* Step 8: Color Vision Intro — lighting guidance (NEW) */}
        {step === AppStep.ColorIntro && (
          <ColorVisionIntro
            lang={lang}
            onStart={() => setStep(AppStep.ColorTest)}
          />
        )}

        {/* Step 9: Color Vision Test — Ishihara plates (NEW) */}
        {step === AppStep.ColorTest && (
          <ColorVisionTest
            lang={lang}
            stream={stream}
            onComplete={(result) => {
              setColorResult(result);
              // Increment tests_completed counter for color vision test
              fetch('https://api.counterapi.dev/v1/covision_final_v2/tests_completed/up').catch(() => {});
              setStep(AppStep.Calibration);
            }}
          />
        )}

        {/* Step 10: Distance Calibration — 2m (moved before Visual Acuity) */}
        {step === AppStep.Calibration && (
          <Calibration
            lang={lang}
            t={t}
            stream={stream}
            videoRef={videoRef}
            faceLandmarksRef={faceLandmarksRef}
            poseLandmarksRef={poseLandmarksRef}
            handLandmarksRef={handLandmarksRef}
            distanceStatus={distanceStatus}
            distanceM={distanceM}
            isStable={isStable}
            onComplete={(data) => {
              setCalibration(data);
              setStep(AppStep.Testing);
            }}
          />
        )}

        {/* Step 10: Results Dashboard — AI insights (ORIGINAL) */}
        {step === AppStep.Results && (
          <ResultsDashboard
            lang={lang}
            t={t}
            results={testResults}
            onReset={() => setStep(AppStep.Report)}
          />
        )}

        {/* Step 11: Medical Report — PDF + QR + Research Mode (ENHANCED) */}
        {step === AppStep.Report && (
          <MedicalReport
            lang={lang}
            patient={patient || {
              fullName: profile?.name || 'Patient',
              age: profile?.age || 0,
              gender: (profile?.gender === 'other' ? 'male' : profile?.gender) || 'male',
              dateTime: new Date().toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US'),
              deviceInfo: navigator.userAgent,
            }}
            acuity={acuityResult || (() => {
              const acuityTest = testResults.find(r => r.testName.toLowerCase().includes('acuity'));
              const score = acuityTest?.score || 0;
              const total = acuityTest?.total || 1;
              const ratio = total > 0 ? score / total : 0.5;
              const logMAR = ratio > 0 ? Math.max(0, (1 - ratio) * 1.0) : 0.5;
              const snellen = ratio > 0.01 ? `6/${Math.round(6 / ratio)}` : '6/60';
              return {
                trials: [],
                finalLogMAR: logMAR,
                snellenNotation: snellen,
                totalCorrect: score,
                totalTrials: total,
                averageResponseMs: 0,
                distanceCompliancePercent: 80,
              };
            })()}
            colorVision={colorResult || (() => {
              const ct = testResults.find(r => r.testName.toLowerCase().includes('color'));
              const correct = ct?.score || 0;
              const total = ct?.total || 20;
              const pct = total > 0 ? correct / total : 1;
              return {
                answers: [],
                totalCorrect: correct,
                totalPlates: total,
                classification: (pct >= 0.8 ? 'normal' : pct >= 0.5 ? 'possible_rg_deficiency' : 'possible_total_deficiency') as 'normal' | 'possible_rg_deficiency' | 'possible_total_deficiency',
                classificationLabel: pct >= 0.8 ? 'Normal' : pct >= 0.5 ? 'Possible Deficiency' : 'Deficiency Detected',
              };
            })()}
            testResults={testResults}
            distanceCompliance={complianceLog.length > 0 ? {
              percentInRange: (complianceLog.filter(r => r.inRange).length / complianceLog.length) * 100,
              averageDistanceM: complianceLog.reduce((s, r) => s + r.distanceM, 0) / complianceLog.length,
              violations: complianceLog.filter(r => !r.inRange).length,
              readings: complianceLog,
            } : undefined}
            onReset={handleReset}
          />
        )}

      </main>

      {/* ─── Global AI Bot — appears on EVERY page including tests ─── */}
      <GlobalAIBot globalBotState={globalBotState} />
    </div>
  );
};

export default App;
