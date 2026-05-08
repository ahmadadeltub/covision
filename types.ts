
export type Language = 'ar' | 'en';

// ─────────── App Steps ───────────
export enum AppStep {
  Welcome = 'WELCOME',
  BiometricScan = 'BIOMETRIC_SCAN',
  Profile = 'PROFILE',
  TestSelection = 'TEST_SELECTION',
  ScreenCalibration = 'SCREEN_CALIBRATION',
  Calibration = 'CALIBRATION',
  CoverEye = 'COVER_EYE',
  Testing = 'TESTING',
  ColorIntro = 'COLOR_INTRO',
  ColorTest = 'COLOR_TEST',
  Results = 'RESULTS',
  Report = 'REPORT',
}

// ─────────── Test Types ───────────
export enum TestType {
  Acuity = 'acuity',
  Color = 'color',
  Snellen = 'snellen',
  Contrast = 'contrast',
  Astigmatism = 'astigmatism',
  Amsler = 'amsler',
  Arrangement = 'arrangement',
}

// ─────────── User Profile ───────────
export interface UserProfile {
  age: number;
  gender: 'male' | 'female' | 'other';
  deviceType?: 'mobile' | 'desktop';
  glassesUsage: 'none' | 'reading' | 'distance' | 'always';
  symptoms?: string[];
  familyHistory?: boolean;
  detectedDistanceCm?: number;
  mood?: string;
}

// ─────────── Screen Calibration (PPI + IPD) ───────────
export interface ScreenCalibrationData {
  pxPerMm: number;
  screenSizeInches: number;
  method: 'device-select' | 'credit-card';
  ipdMm: number; // 55 | 60 | 63
}

// ─────────── Calibration Data ───────────
export interface CalibrationData {
  pxPerMm: number;
  viewingDistanceCm: number;
}

// ─────────── Distance Readings & Compliance ───────────
export interface DistanceReading {
  timestamp: number;
  distanceM: number;
  inRange: boolean;
}

export interface DistanceCompliance {
  readings: DistanceReading[];
  percentInRange: number;
  averageDistanceM: number;
  violations: number;
  drift: number;
}

// ─────────── Test Result ───────────
export interface TestResult {
  testName: string;
  score: number;
  total: number;
  confidence: number;
  findings: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  timestamps?: number[];
  perSampleScores?: { sample: number; correct: boolean; timeMs: number }[];
  rawResponseTimes?: number[];
}

// ─────────── Patient Info ───────────
export interface PatientInfo {
  fullName: string;
  age: number;
  gender: 'male' | 'female';
  dateTime: string;
  deviceInfo: string;
}

// ─────────── Acuity ───────────
export interface AcuityTrial {
  trialNumber: number;
  logMAR: number;
  direction: 'up' | 'down' | 'left' | 'right';
  userAnswer: 'up' | 'down' | 'left' | 'right' | 'timeout';
  correct: boolean;
  responseTimeMs: number;
}

export interface AcuityResult {
  trials: AcuityTrial[];
  finalLogMAR: number;
  snellenNotation: string;
  totalCorrect: number;
  totalTrials: number;
  averageResponseMs: number;
  distanceCompliancePercent: number;
}

// ─────────── Color Vision ───────────
export interface ColorPlateAnswer {
  plateIndex: number;
  correctAnswer: string;
  userAnswer: string;
  correct: boolean;
}

export interface ColorVisionResult {
  answers: ColorPlateAnswer[];
  totalCorrect: number;
  totalPlates: number;
  scoreRight?: number;
  scoreLeft?: number;
  totalRight?: number;
  totalLeft?: number;
  classification: 'normal' | 'possible_rg_deficiency' | 'possible_total_deficiency';
  classificationLabel: string;
}

// ─────────── Distance ───────────
export type DistanceStatus = 'ok' | 'too_close' | 'too_far' | 'no_face';

// ─────────── Full Screening Results ───────────
export interface ScreeningResults {
  patient: PatientInfo;
  acuity: AcuityResult;
  colorVision: ColorVisionResult;
  distanceCompliance?: DistanceCompliance;
  screeningDate: string;
  disclaimer: string;
}
