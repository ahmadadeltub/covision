export type Language = 'ar' | 'en';

// ─────────── App Steps ───────────
export enum AppStep {
  Welcome = 'WELCOME',
  BiometricScan = 'BIOMETRIC_SCAN',
  Profile = 'PROFILE',
  TestSelection = 'TEST_SELECTION',
  Calibration = 'CALIBRATION',
  Testing = 'TESTING',
  ColorIntro = 'COLOR_INTRO',
  ColorTest = 'COLOR_TEST',
  Results = 'RESULTS',
  Report = 'REPORT',
}

// ─────────── Test Types ───────────
export enum TestType {
  Acuity = 'acuity',
  NearAcuity = 'near_acuity',
  Color = 'color',
  Snellen = 'snellen',
  Contrast = 'contrast',
  Astigmatism = 'astigmatism',
  Amsler = 'amsler',
  VisualField = 'visual_field',
  Motility = 'motility',
  Arrangement = 'arrangement',
}

// ─────────── Eye Testing Identifiers ───────────
export type EyeTested = 'OD' | 'OS' | 'OU';

// ─────────── Correction Status ───────────
export type CorrectionStatus = 'Uncorrected' | 'Habitual Glasses' | 'Contact Lenses' | 'Other';

// ─────────── User Profile ───────────
export interface UserProfile {
  name?: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  deviceType?: 'mobile' | 'desktop';
  glassesUsage: 'none' | 'reading' | 'distance' | 'always';
  symptoms?: string[];
  familyHistory?: boolean;
  detectedDistanceCm?: number;
  mood?: string;
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

// ─────────── Test Result (Original & General) ───────────
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
  eye?: EyeTested;
  nearAcuityData?: NearVisualAcuityResult;
  visualFieldData?: VisualFieldScreeningResult;
  motilityData?: OcularMotilityData;
  amslerData?: AmslerGridResult;
  contrastData?: ContrastSensitivityResult;
}

// ─────────── Patient Info (Expanded) ───────────
export interface PatientInfo {
  fullName: string;
  age: number;
  gender: 'male' | 'female';
  dateTime: string;
  deviceInfo: string;
  patientId?: string;
  correctionStatus?: CorrectionStatus;
  glassesDuringTest?: boolean;
  contactsDuringTest?: boolean;
  testingLocation?: string;
  operatorName?: string;
  deviceId?: string;
  softwareVersion?: string;
}

// ─────────── Acuity (Distance Visual Acuity) ───────────
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
  correctionStatus?: CorrectionStatus;
}

// ── Per-Eye Distance Visual Acuity ──
export interface DistanceVisualAcuityEye {
  eye: EyeTested;
  snellen: string;
  logMAR: number;
  optotypesPresented: number;
  correct: number;
  incorrect: number;
  testingDistanceM: number;
  correctionStatus: CorrectionStatus;
  confidence: number;
  reliability: 'High' | 'Good' | 'Moderate' | 'Low';
  tested: boolean;
}

export interface DistanceVisualAcuityResult {
  OD: DistanceVisualAcuityEye;
  OS: DistanceVisualAcuityEye;
  OU?: DistanceVisualAcuityEye;
}

// ── Near Visual Acuity ──
export interface NearVisualAcuityEye {
  eye: EyeTested;
  nearNotation: string; // e.g. 'N5', 'N6', 'J1'
  snellenEquivalent: string; // e.g. '20/20'
  readingDistanceCm: number; // 40 cm
  correctionStatus: CorrectionStatus;
  correctResponses: number;
  totalPresented: number;
  confidence: number;
  reliability: 'High' | 'Good' | 'Moderate' | 'Low';
  status: 'Within Screening Range' | 'Borderline' | 'Reduced Performance';
  tested: boolean;
}

export interface NearVisualAcuityResult {
  OD: NearVisualAcuityEye;
  OS: NearVisualAcuityEye;
  OU?: NearVisualAcuityEye;
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

// ── Per-Eye Detailed Color Vision ──
export type ColorScreeningClassification = 
  | 'WITHIN SCREENING RANGE'
  | 'RED-GREEN DISCRIMINATION VARIANCE DETECTED'
  | 'REPEAT TEST'
  | 'PROFESSIONAL EVALUATION RECOMMENDED';

export interface ColorVisionEye {
  eye: EyeTested;
  platesCorrect: number;
  platesTotal: number;
  percentage: number;
  classification: ColorScreeningClassification;
  confidence: number;
  tested: boolean;
}

export interface ColorVisionScreeningResult {
  OD: ColorVisionEye;
  OS: ColorVisionEye;
  OU?: ColorVisionEye;
  displayCalibrationStatus: string;
  ambientLightStatus: string;
  methodology: 'Digital Pseudoisochromatic Color-Vision Screening';
}

// ─────────── Contrast Sensitivity (Quantitative) ───────────
export interface ContrastSensitivityEye {
  eye: EyeTested;
  logCS: number; // e.g. 1.65 logCS
  levelsCompleted: number;
  thresholdLevel: number;
  testingDistanceM: number;
  confidence: number;
  reliability: 'High' | 'Good' | 'Moderate' | 'Low';
  classification: 'Within defined screening range' | 'Reduced screening performance';
  tested: boolean;
}

export interface ContrastSensitivityResult {
  OD: ContrastSensitivityEye;
  OS: ContrastSensitivityEye;
  differenceLogCS: number;
}

// ─────────── Amsler Grid with Distortion Map ───────────
export interface AmslerDistortionCoord {
  x: number;
  y: number;
  type: 'wavy' | 'missing' | 'blurred' | 'distortion' | 'dark';
}

export interface AmslerEyeResult {
  eye: EyeTested;
  distortionDetected: boolean;
  missingAreaDetected: boolean;
  centralAbnormalityDetected: boolean;
  markedCoordinates: AmslerDistortionCoord[];
  quadrantsAffected: string[];
  tested: boolean;
}

export interface AmslerGridResult {
  OD: AmslerEyeResult;
  OS: AmslerEyeResult;
}

// ─────────── Digital Central Visual Field Screening ───────────
export interface VisualFieldPoint {
  id: number;
  x: number;
  y: number;
  detected: boolean;
  intensity: number;
  responseTimeMs?: number;
}

export interface VisualFieldEyeResult {
  eye: EyeTested;
  stimuliPresented: number;
  detected: number;
  missed: number;
  fixationLosses: number;
  averageLatencyMs: number;
  falsePositiveRate: number;
  reliability: 'Excellent' | 'Good' | 'Fair' | 'Low';
  gridPoints: VisualFieldPoint[];
  status: 'Within Screening Range' | 'Locations Missed — Evaluation Recommended';
  tested: boolean;
}

export interface VisualFieldScreeningResult {
  OD: VisualFieldEyeResult;
  OS: VisualFieldEyeResult;
  methodology: 'Digital Central Visual Field Screening';
}

// ─────────── Astigmatism Screening ───────────
export interface AstigmatismEyeResult {
  eye: EyeTested;
  meridianDegrees?: number;
  distortionDetected: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'significant';
  confidence: number;
  tested: boolean;
}

export interface AstigmatismResult {
  OD: AstigmatismEyeResult;
  OS: AstigmatismEyeResult;
}

// ─────────── Ocular Motility — 9 Gaze Test ───────────
export interface GazePositionData {
  position: 'TL' | 'TC' | 'TR' | 'ML' | 'C' | 'MR' | 'BL' | 'BC' | 'BR';
  label: string;
  completed: boolean;
  tracked: boolean;
  leftEyeDeviationPx: number;
  rightEyeDeviationPx: number;
}

export interface OcularMotilityData {
  gazePositionsCompleted: number; // e.g. 9
  trackingCompletenessPct: number; // e.g. 95%
  movementSymmetry: 'Not Detected' | 'Detected'; // Gross movement asymmetry
  fixationLosses: number;
  trackingConfidence: number;
  reliability: 'High' | 'Moderate' | 'Low';
  gazeGrid: GazePositionData[];
  tested: boolean;
}

// ─────────── AI Ocular Alignment Screening (Experimental) ───────────
export interface OcularAlignmentData {
  alignmentSymmetryScorePct: number; // e.g. 96
  horizontalAsymmetryMm: number; // e.g. 0.4
  verticalAsymmetryMm: number; // e.g. 0.2
  trackingConfidence: number;
  classification: 'No significant asymmetry detected during screening' | 'Ocular alignment asymmetry detected — professional evaluation recommended';
  headPose: { yaw: number; pitch: number; roll: number };
  experimentalBadge: 'Experimental AI Screening Metric';
  tested: boolean;
}

// ─────────── AI Pupillary Analysis (Experimental) ───────────
export interface PupillaryAnalysisData {
  odPupilDiameterMm: number; // e.g. 3.8
  osPupilDiameterMm: number; // e.g. 3.7
  differenceMm: number; // e.g. 0.1
  baselinePupilSizeMm: number;
  lightResponseDetected: boolean;
  responseLatencyMs: number;
  trackingConfidence: number;
  experimentalBadge: 'Experimental Camera-Derived Measurement';
  tested: boolean;
}

// ─────────── Blink & Ocular Behavior Analysis ───────────
export interface BlinkAnalysisData {
  observationDurationSec: number;
  blinkCount: number;
  blinkRatePerMin: number;
  averageBlinkDurationMs: number;
  interBlinkIntervalSec: number;
  incompleteBlinkEstimatePct: number;
  trackingConfidence: number;
  researchMetricBadge: 'Research Metric — Not Diagnostic';
  tested: boolean;
}

// ─────────── Test Quality & Environment ───────────
export interface TestQualityEnvironment {
  viewingDistanceM: number;
  targetDistanceM: number;
  distanceCompliancePct: number;
  cameraToFaceDistanceM: number;
  ambientIllumination: 'Adequate' | 'Suboptimal' | 'Unmeasured';
  screenResolution: string;
  viewportSize: string;
  devicePixelRatio: number;
  displayCalibrationStatus: 'PASSED' | 'UNCALIBRATED';
  colorCalibrationStatus: 'Standard sRGB' | 'Uncalibrated';
  headPoseStabilityPct: number;
  eyeVisibilityPct: number;
  occlusionCompliancePct: number;
  fixationCompliancePct: number;
  responseConsistencyPct: number;
  testInterruptions: number;
}

// ─────────── Screening Reliability Index (Technical Quality) ───────────
export interface ScreeningReliabilityIndex {
  score: number; // 0–100
  level: 'HIGH' | 'GOOD' | 'MODERATE' | 'LOW';
  warning?: string;
  components: {
    factor: string;
    score: number;
    weight: number;
  }[];
}

// ─────────── Explainable AI Screening Interpretation ───────────
export type ScreeningOverallFlag = 
  | 'WITHIN DEFINED SCREENING LIMITS'
  | 'ROUTINE PROFESSIONAL REVIEW SUGGESTED'
  | 'PROMPT PROFESSIONAL EVALUATION RECOMMENDED';

export interface ExplainableScreeningInterpretation {
  overallFlag: ScreeningOverallFlag;
  factorsContributing: string[];
  normalFindings: string[];
  followUpTimeline: {
    when: string;
    action: string;
    color: string;
  };
}

// ─────────── Examiner & Clinician Verification ───────────
export interface ExaminerInfo {
  name: string;
  role: string;
  facility: string;
  dateTime: string;
}

export interface ClinicianReview {
  isReviewed: boolean;
  reviewedBy?: string;
  professionalRole?: string;
  licenseNumber?: string;
  reviewDate?: string;
  digitalSignature?: string;
  clinicalNotes?: string;
  statusText: 'NOT CLINICIAN VERIFIED' | 'CLINICIAN VERIFIED';
}

// ─────────── Report Authentication ───────────
export interface ReportAuthentication {
  reportId: string;
  reportUUID: string;
  softwareVersion: string;
  screeningProtocolVersion: string;
  generationTimestamp: string;
  sha256Hash: string;
  verificationUrl: string;
}

// ─────────── Comprehensive Clinical Screening Record (Database) ───────────
export interface ClinicalScreeningRecord {
  reportId: string;
  patient: PatientInfo;
  session: {
    date: string;
    durationSec?: number;
    device: string;
  };
  environment: TestQualityEnvironment;
  tests: {
    distanceVisualAcuity: DistanceVisualAcuityResult;
    nearVisualAcuity: NearVisualAcuityResult;
    colorVision: ColorVisionScreeningResult;
    contrastSensitivity: ContrastSensitivityResult;
    amsler: AmslerGridResult;
    visualField: VisualFieldScreeningResult;
    astigmatism: AstigmatismResult;
    ocularMotility: OcularMotilityData;
    ocularAlignment: OcularAlignmentData;
    pupillaryAnalysis: PupillaryAnalysisData;
    blinkAnalysis: BlinkAnalysisData;
  };
  reliability: ScreeningReliabilityIndex;
  interpretation: ExplainableScreeningInterpretation;
  recommendations: string[];
  examiner: ExaminerInfo;
  clinicianReview: ClinicianReview;
  authentication: ReportAuthentication;
  // Backward compatibility fields for legacy records
  acuity?: AcuityResult;
  colorVisionLegacy?: ColorVisionResult;
  testResultsLegacy?: TestResult[];
  distanceComplianceLegacy?: DistanceCompliance;
}

// ─────────── Clinical Validation & Test-Retest (Research Mode) ───────────
export interface ClinicalValidationEntry {
  id: string;
  patientId: string;
  screeningDate: string;
  covisionOutcome: 'normal' | 'abnormal';
  referenceStandardOutcome: 'normal' | 'abnormal';
  covisionLogMAR?: number;
  referenceLogMAR?: number;
  covisionLogCS?: number;
  referenceLogCS?: number;
  conditionCategory: 'Acuity' | 'Color' | 'Contrast' | 'Macular' | 'Field';
  referenceStandard?: string;
  eye?: EyeTested;
  notes?: string;
}

export interface TestRetestEntry {
  id: string;
  patientId: string;
  date: string;
  testName: string;
  eye: EyeTested;
  test1Value: number;
  test2Value: number;
  difference: number;
  metricUnit: string;
}

export interface ValidationStatistics {
  sampleSize: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  sensitivity: number | null;
  specificity: number | null;
  ppv: number | null;
  npv: number | null;
  falsePositiveRate: number | null;
  falseNegativeRate: number | null;
  overallAgreement: number | null;
  cohensKappa: number | null;
  ci95Sensitivity?: [number, number] | null;
  ci95Specificity?: [number, number] | null;
  meanDifference?: number | null;
  mae?: number | null;
  rmse?: number | null;
  icc?: number | null;
}

// ─────────── Distance Status ───────────
export type DistanceStatus = 'ok' | 'too_close' | 'too_far' | 'no_face';

// ─────────── Full Screening Results (Legacy compatibility) ───────────
export interface ScreeningResults {
  patient: PatientInfo;
  acuity: AcuityResult;
  colorVision: ColorVisionResult;
  distanceCompliance?: DistanceCompliance;
  screeningDate: string;
  disclaimer: string;
}
