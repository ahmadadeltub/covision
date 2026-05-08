import { useState, useEffect, useCallback, useRef } from 'react';
import { AppStep } from '../types';

export type DistanceStatus = 'ok' | 'too_close' | 'too_far' | 'no_face' | 'initializing';

export interface GlobalBotMessage {
  text: string;
  emoji: string;
  color: string;
  id: number;
}

export interface GlobalBotState {
  message: GlobalBotMessage | null;
  mood: 'happy' | 'neutral' | 'guide' | 'celebrate' | 'alert';
  step: AppStep;
  tipIndex: number;
  totalTips: number;
  /** Live distance data for the UI bar */
  distanceM: number;
  distanceStatus: DistanceStatus;
  isDistanceActive: boolean;
}

export interface DistanceInput {
  distanceM: number;
  status: DistanceStatus;
  isStable: boolean;
  targetM: number;
  toleranceM: number;
}

// ─── Distance coaching message banks ───
const DISTANCE_TOO_CLOSE: Omit<GlobalBotMessage, 'id'>[] = [
  { text: "Whoa, you're too close! Take a step back so I can measure accurately. 🚶‍♂️", emoji: '⬅️', color: '#ef4444' },
  { text: "Move back a little — you're closer than I need you. The test won't be accurate here.", emoji: '🔙', color: '#ef4444' },
  { text: "Too close! Step back until my distance bar turns green.", emoji: '📏', color: '#ef4444' },
];

const DISTANCE_TOO_FAR: Omit<GlobalBotMessage, 'id'>[] = [
  { text: "Come a bit closer! You're too far away for accurate measurements.", emoji: '➡️', color: '#f59e0b' },
  { text: "Step forward — I can barely see you. Move closer until my bar turns green.", emoji: '🚶', color: '#f59e0b' },
  { text: "You're too far! I need you a bit closer for the test to work properly.", emoji: '📏', color: '#f59e0b' },
];

const DISTANCE_NO_FACE: Omit<GlobalBotMessage, 'id'>[] = [
  { text: "I can't see your face! Make sure you're facing the camera directly.", emoji: '👤', color: '#94a3b8' },
  { text: "Where'd you go? Face the camera so I can track your distance.", emoji: '📸', color: '#94a3b8' },
];

const DISTANCE_OK: Omit<GlobalBotMessage, 'id'>[] = [
  { text: "Perfect distance! Stay right there — you're in the sweet spot. ✨", emoji: '✅', color: '#10b981' },
  { text: "Great positioning! Keep steady at this distance.", emoji: '🎯', color: '#10b981' },
  { text: "You're right where I need you! Let's keep testing. 💪", emoji: '👌', color: '#10b981' },
];

const DISTANCE_STABLE: Omit<GlobalBotMessage, 'id'>[] = [
  { text: "Rock solid! You're holding perfectly still — great job.", emoji: '🪨', color: '#06b6d4' },
  { text: "Outstanding stability! This gives us the most accurate results.", emoji: '🏆', color: '#10b981' },
];

// ─── Page-specific guidance banks ───
const PAGE_MESSAGES: Record<AppStep, { intro: GlobalBotMessage; tips: Omit<GlobalBotMessage, 'id'>[] }> = {
  [AppStep.Welcome]: {
    intro: { text: "Hi there! 👋 I'm your AI vision assistant. I'll guide you through every step of the screening.", emoji: '🤖', color: '#06b6d4', id: 0 },
    tips: [
      { text: "This screening takes about 5-10 minutes. Make sure you're in a well-lit room!", emoji: '💡', color: '#f59e0b' },
      { text: "Have your glasses or contacts ready if you normally wear them.", emoji: '👓', color: '#8b5cf6' },
      { text: "Tap 'Begin Screening' when you're ready to start!", emoji: '🚀', color: '#10b981' },
      { text: "All results stay on your device — your privacy is protected.", emoji: '🔒', color: '#06b6d4' },
    ],
  },
  [AppStep.TestSelection]: {
    intro: { text: "Choose your vision tests! I recommend keeping all tests selected for a complete screening.", emoji: '📋', color: '#8b5cf6', id: 0 },
    tips: [
      { text: "Each test checks a different aspect of your vision — acuity, color, contrast, and more.", emoji: '🔬', color: '#06b6d4' },
      { text: "The Snellen & Acuity tests measure how sharp your distance vision is.", emoji: '👁️', color: '#10b981' },
      { text: "Color vision and contrast tests can detect early signs of eye conditions.", emoji: '🎨', color: '#f59e0b' },
      { text: "The Amsler Grid helps detect macular problems affecting central vision.", emoji: '📐', color: '#8b5cf6' },
    ],
  },
  [AppStep.BiometricScan]: {
    intro: { text: "Hold steady! I'm scanning your face to set up accurate measurements.", emoji: '📸', color: '#06b6d4', id: 0 },
    tips: [
      { text: "Face the camera directly — I need to see both your eyes clearly.", emoji: '👀', color: '#10b981' },
      { text: "Keep your face well-lit from the front, avoid backlighting.", emoji: '💡', color: '#f59e0b' },
      { text: "Remove glasses temporarily for the face scan if possible.", emoji: '👓', color: '#8b5cf6' },
    ],
  },
  [AppStep.Profile]: {
    intro: { text: "Let me get to know you! Your profile helps me personalize the screening.", emoji: '📝', color: '#10b981', id: 0 },
    tips: [
      { text: "Your age helps calibrate the expected vision ranges.", emoji: '🎂', color: '#06b6d4' },
      { text: "Accurate information leads to more reliable screening results.", emoji: '✅', color: '#10b981' },
    ],
  },
  [AppStep.ScreenCalibration]: {
    intro: { text: "Let's calibrate your screen! This ensures the test symbols appear at the correct size.", emoji: '📏', color: '#f59e0b', id: 0 },
    tips: [
      { text: "Use a standard credit card or ID card for best calibration accuracy.", emoji: '💳', color: '#06b6d4' },
      { text: "Screen size calibration is crucial — it affects all measurement accuracy.", emoji: '🎯', color: '#10b981' },
      { text: "Make sure your card is flat against the screen during calibration.", emoji: '📐', color: '#8b5cf6' },
    ],
  },
  [AppStep.Calibration]: {
    intro: { text: "Position yourself at the correct distance from the screen. I'll help you stay in range!", emoji: '📐', color: '#06b6d4', id: 0 },
    tips: [
      { text: "Stand about 2 meters (6 feet) away from your screen.", emoji: '📏', color: '#f59e0b' },
      { text: "Keep your head level with the center of the screen.", emoji: '🎯', color: '#10b981' },
      { text: "I'll show a green indicator when you're at the perfect distance.", emoji: '✅', color: '#06b6d4' },
    ],
  },
  [AppStep.CoverEye]: {
    intro: { text: "We test each eye separately. Cover one eye gently with your palm — don't press!", emoji: '🤚', color: '#f59e0b', id: 0 },
    tips: [
      { text: "Cover your eye gently — pressing on the eyelid can temporarily blur your vision.", emoji: '⚠️', color: '#ef4444' },
      { text: "Use your palm, not your fingers, for a better seal without pressure.", emoji: '✋', color: '#06b6d4' },
      { text: "I'll be watching to make sure your eye stays properly covered!", emoji: '👁️', color: '#10b981' },
    ],
  },
  [AppStep.ColorIntro]: {
    intro: { text: "Color vision test coming up! Make sure your screen brightness is at maximum.", emoji: '🌈', color: '#8b5cf6', id: 0 },
    tips: [
      { text: "Screen brightness affects color perception — set it to 100%.", emoji: '☀️', color: '#f59e0b' },
      { text: "You'll see colored dot patterns — try to identify the hidden numbers.", emoji: '🔢', color: '#06b6d4' },
      { text: "Don't worry if some plates are hard — that's part of the test design!", emoji: '💪', color: '#10b981' },
    ],
  },
  [AppStep.ColorTest]: {
    intro: { text: "Look for hidden numbers in the dot patterns. Take your time — there's no rush!", emoji: '🎨', color: '#8b5cf6', id: 0 },
    tips: [
      { text: "Trust your first impression — don't overthink what you see.", emoji: '⚡', color: '#f59e0b' },
      { text: "If you can't see a number, that's okay — select 'Can't See'.", emoji: '🤷', color: '#06b6d4' },
      { text: "Some plates are designed to be tricky — it helps differentiate different types of color vision.", emoji: '🔬', color: '#10b981' },
    ],
  },
  [AppStep.Testing]: {
    intro: { text: "Testing time! Focus on the symbols and respond as accurately as you can.", emoji: '🎯', color: '#10b981', id: 0 },
    tips: [
      { text: "I'm tracking your accuracy in real-time — check my feedback panel!", emoji: '📊', color: '#06b6d4' },
      { text: "Take your time — accuracy matters more than speed.", emoji: '🧠', color: '#f59e0b' },
      { text: "If you can't see clearly, that's important data too — don't guess randomly.", emoji: '👁️', color: '#8b5cf6' },
      { text: "Keep your distance steady — I'll alert you if you move too close or far.", emoji: '📏', color: '#10b981' },
    ],
  },
  [AppStep.Results]: {
    intro: { text: "Your results are in! Let me walk you through what they mean.", emoji: '📊', color: '#06b6d4', id: 0 },
    tips: [
      { text: "Green indicators mean your vision is in the normal range for that test.", emoji: '✅', color: '#10b981' },
      { text: "Yellow means borderline — worth monitoring or discussing with a doctor.", emoji: '⚠️', color: '#f59e0b' },
      { text: "Remember, this is a screening — not a diagnosis. See a professional for any concerns.", emoji: '👨‍⚕️', color: '#8b5cf6' },
    ],
  },
  [AppStep.Report]: {
    intro: { text: "Your medical report is ready! You can print it or share it with your eye care provider.", emoji: '📄', color: '#10b981', id: 0 },
    tips: [
      { text: "Print the report to bring to your next eye doctor appointment.", emoji: '🖨️', color: '#06b6d4' },
      { text: "The QR code links to your digital report for easy sharing.", emoji: '📱', color: '#8b5cf6' },
      { text: "Schedule regular eye exams — this screening is a great starting point!", emoji: '📅', color: '#f59e0b' },
      { text: "Thanks for using CoVision! Take care of your eyes. 💙", emoji: '😊', color: '#10b981' },
    ],
  },
};

/**
 * Global AI Bot hook — provides page-contextual guidance messages
 * across the entire app journey, PLUS real-time distance coaching.
 */
export function useGlobalBot(currentStep: AppStep, distanceInput?: DistanceInput) {
  const msgIdRef = useRef(1);
  const [state, setState] = useState<GlobalBotState>({
    message: null,
    mood: 'neutral',
    step: currentStep,
    tipIndex: -1,
    totalTips: 0,
    distanceM: 0,
    distanceStatus: 'initializing',
    isDistanceActive: false,
  });
  const tipTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStepRef = useRef<AppStep | null>(null);
  const prevDistStatusRef = useRef<DistanceStatus>('initializing');
  const distanceMsgCooldownRef = useRef(0);
  const stableCelebrated = useRef(false);
  const liveDistanceRef = useRef({ distanceM: 0, distanceStatus: 'initializing' as DistanceStatus, isDistanceActive: false });

  const pushMessage = useCallback((msg: Omit<GlobalBotMessage, 'id'>) => {
    const id = ++msgIdRef.current;
    setState(prev => ({
      ...prev,
      message: { ...msg, id },
    }));
  }, []);

  // ─── Distance-reactive coaching ───
  // Steps where distance matters
  const distanceActiveSteps = [AppStep.Calibration, AppStep.CoverEye, AppStep.Testing];
  const isDistanceActive = distanceActiveSteps.includes(currentStep) && !!distanceInput;

  useEffect(() => {
    if (!isDistanceActive || !distanceInput) {
      liveDistanceRef.current = { distanceM: 0, distanceStatus: 'initializing', isDistanceActive: false };
      setState(prev => {
        if (!prev.isDistanceActive && prev.distanceM === 0) return prev;
        return {
          ...prev,
          distanceM: 0,
          distanceStatus: 'initializing',
          isDistanceActive: false,
        };
      });
      prevDistStatusRef.current = 'initializing';
      stableCelebrated.current = false;
      return;
    }

    const { status, isStable } = distanceInput;
    const now = Date.now();

    // Update the ref for live distance reads (no re-render)
    liveDistanceRef.current = {
      distanceM: distanceInput.distanceM,
      distanceStatus: status,
      isDistanceActive: true,
    };

    // Only update state when status actually changes to avoid render storms
    setState(prev => {
      if (prev.distanceStatus === status && prev.isDistanceActive) return prev;
      return {
        ...prev,
        distanceM: distanceInput.distanceM,
        distanceStatus: status,
        isDistanceActive: true,
      };
    });

    // Cooldown: don't spam messages — wait 4 seconds between distance messages
    if (now < distanceMsgCooldownRef.current) return;

    // Status changed → push coaching message
    if (status !== prevDistStatusRef.current) {
      prevDistStatusRef.current = status;
      stableCelebrated.current = false;

      const pick = (arr: Omit<GlobalBotMessage, 'id'>[]) => arr[Math.floor(Math.random() * arr.length)];

      if (status === 'too_close') {
        pushMessage(pick(DISTANCE_TOO_CLOSE));
        setState(prev => ({ ...prev, mood: 'alert' }));
        distanceMsgCooldownRef.current = now + 4000;
      } else if (status === 'too_far') {
        pushMessage(pick(DISTANCE_TOO_FAR));
        setState(prev => ({ ...prev, mood: 'alert' }));
        distanceMsgCooldownRef.current = now + 4000;
      } else if (status === 'no_face') {
        pushMessage(pick(DISTANCE_NO_FACE));
        setState(prev => ({ ...prev, mood: 'alert' }));
        distanceMsgCooldownRef.current = now + 5000;
      } else if (status === 'ok') {
        pushMessage(pick(DISTANCE_OK));
        setState(prev => ({ ...prev, mood: 'happy' }));
        distanceMsgCooldownRef.current = now + 6000;
      }
    }

    // Celebrate stability (once per ok stint)
    if (status === 'ok' && isStable && !stableCelebrated.current) {
      stableCelebrated.current = true;
      const pick = (arr: Omit<GlobalBotMessage, 'id'>[]) => arr[Math.floor(Math.random() * arr.length)];
      setTimeout(() => {
        pushMessage(pick(DISTANCE_STABLE));
        setState(prev => ({ ...prev, mood: 'happy' }));
      }, 2000);
    }
  }, [isDistanceActive, distanceInput?.status, distanceInput?.isStable, pushMessage]);

  // When step changes → show intro message + start cycling tips
  useEffect(() => {
    if (prevStepRef.current === currentStep) return;
    prevStepRef.current = currentStep;

    // Clear any existing tip timer
    if (tipTimerRef.current) {
      clearInterval(tipTimerRef.current);
      tipTimerRef.current = null;
    }

    const pageData = PAGE_MESSAGES[currentStep];
    if (!pageData) return;

    // Determine mood based on step
    const mood: GlobalBotState['mood'] =
      currentStep === AppStep.Welcome ? 'happy' :
      currentStep === AppStep.Results || currentStep === AppStep.Report ? 'celebrate' :
      currentStep === AppStep.Testing ? 'neutral' :
      'guide';

    // Show intro message immediately
    const introId = ++msgIdRef.current;
    setState(prev => ({
      ...prev,
      message: { ...pageData.intro, id: introId },
      mood,
      step: currentStep,
      tipIndex: -1,
      totalTips: pageData.tips.length,
    }));

    // After 8 seconds, start cycling through tips every 12 seconds
    const startDelay = setTimeout(() => {
      let idx = 0;
      const showTip = () => {
        if (idx < pageData.tips.length) {
          const tip = pageData.tips[idx];
          pushMessage(tip);
          setState(prev => ({ ...prev, tipIndex: idx, mood }));
          idx++;
        } else {
          // Loop back
          idx = 0;
        }
      };
      showTip();
      tipTimerRef.current = setInterval(showTip, 12000);
    }, 8000);

    return () => {
      clearTimeout(startDelay);
      if (tipTimerRef.current) {
        clearInterval(tipTimerRef.current);
        tipTimerRef.current = null;
      }
    };
  }, [currentStep, pushMessage]);

  return { globalBotState: state };
}
