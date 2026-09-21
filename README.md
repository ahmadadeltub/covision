# 👁️ CoVision — AI-Powered Clinical Vision Screening Platform

<div align="center">

![CoVision Banner](https://img.shields.io/badge/CoVision-AI%20Vision%20Screening-06b6d4?style=for-the-badge&logo=eye&logoColor=white)
![Version](https://img.shields.io/badge/version-1.4.0-brightgreen?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=for-the-badge&logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-Hosting-FFCA28?style=for-the-badge&logo=firebase)
![Gemini AI](https://img.shields.io/badge/Gemini-2.0%20Flash-4285F4?style=for-the-badge&logo=google)

**A comprehensive, browser-based clinical vision screening suite powered by Google Gemini AI, MediaPipe, and Web Speech API.**

🌐 **Live Demo:** [https://covision-41ab1.web.app](https://covision-41ab1.web.app)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Screening Tests](#-screening-tests)
- [Application Flow](#-application-flow)
- [AI Tools & Technologies](#-ai-tools--technologies)
- [Architecture & Code Structure](#-architecture--code-structure)
- [Key Components](#-key-components)
- [Custom Hooks](#-custom-hooks)
- [Voice Command System](#-voice-command-system)
- [Medical Report Generation](#-medical-report-generation)
- [Setup & Development](#-setup--development)
- [Deployment](#-deployment)
- [Disclaimer](#-disclaimer)

---

## 🔭 Overview

CoVision is a **clinical-grade, edge-AI vision screening platform** that runs entirely in the browser — no app installation, no backend server, no data uploads. It performs a comprehensive suite of 8 vision assessments using real-time computer vision, AI voice guidance, and intelligent result analysis.

### Key Capabilities

| Feature | Description |
|--------|-------------|
| 🤖 **Edge AI Processing** | All camera analysis runs locally via MediaPipe — no video ever leaves the device |
| 🎙️ **Smart Voice Commands** | 3-tier AI voice recognition (phonetic → fuzzy → Gemini AI) |
| 📏 **Real-time Distance Enforcement** | AI monitors patient distance throughout every test |
| 👁️ **Bilateral Eye Testing** | Each test covers right eye, left eye, and binocular independently |
| 📊 **Clinical PDF Reports** | Professional A3 medical reports with QR codes, charts, and clinical advice |
| 🌍 **Bilingual (EN + AR)** | Full Arabic and English support across all tests and reports |
| 🔒 **Privacy-first** | All processing is on-device; no video/image data is transmitted |

---

## 🧪 Screening Tests

CoVision runs **8 vision assessments** across the diagnostic flow:

### 1. 👁️ Visual Acuity — Tumbling E / Landolt C

- **Standard:** ISO 8596 / LogMAR
- Presents progressively smaller optotypes (E-direction and C-gap orientation)
- Patient responds by voice (`up`, `down`, `left`, `right`) or button tap
- AI monitors eye occlusion — responses blocked when incorrect eye is uncovered
- **15 levels**, early termination on 2 consecutive errors per row
- Outputs: Snellen notation (e.g. 20/20), LogMAR score, avg response time

### 2. 🔤 Snellen Chart

- **Standard:** Snellen / 6-meter equivalent
- Classical letter chart digitally rendered at calibrated angular sizes
- Randomized letter order from the authentic Snellen set
- **15 progressive levels** (20/200 → 20/10)
- Voice-driven: say the letter aloud

### 3. 🎨 Color Arrangement (Ishihara-adapted)

- **Standard:** Ishihara-adapted digital plates
- Bilateral testing — right eye, left eye
- AI eye-cover detection enforces proper occlusion
- 10 color identification samples per eye using gradient circles with 4-choice response
- Classifies: Normal / Possible Red-Green Deficiency / Possible Total Deficiency

### 4. 🌗 Contrast Sensitivity

- **Standard:** Pelli-Robson / logCS
- 15 contrast levels (logCS 0.00–2.10)
- Progressive difficulty with 3-second automated countdown between rounds
- Identifies early cataracts, glaucoma, and optic neuropathy indicators

### 5. ✴️ Astigmatism Test

- **Standard:** Fan chart / cross-cylinder
- 5 unique pattern types: clock dial, starburst, cross-cylinder, radial, parallel lines
- Meridional blur detection with quadrant mapping
- Bilateral — 5 samples per eye

### 6. ⬛ Amsler Grid (Macular Screen)

- **Standard:** Amsler Chart / macular screening
- 5 grid variants: standard, red-on-black, threshold, blue-field, fine-mesh
- Detects scotoma (blind spots) and metamorphopsia (distorted vision)
- Interactive quadrant selection for precise lesion localization

### 7. 🔬 Biometric Scan (Pre-test AI Profiling)

- Captures facial landmarks, estimated IPD (inter-pupillary distance)
- Detects glasses, age estimation from facial geometry
- Builds the patient biometric profile before tests begin

### 8. 📏 Distance Calibration

- MediaPipe-powered real-time face distance measurement
- Guides patient to exactly **1.0m** from the screen
- Must maintain ±15cm tolerance for at least 3 seconds before proceeding

---

## 🗺️ Application Flow

```
Welcome Screen
     │
     ▼
Language Selection (EN / AR)
     │
     ▼
Patient Profile Form (age, gender, glasses usage)
     │
     ▼
Biometric Scan (AI face analysis, IPD estimation)
     │
     ▼
Distance Calibration (MediaPipe, 1.0m target)
     │
     ▼
Color Vision Test (Bilateral Ishihara)
     │
     ▼
Test Selector (choose 1–6 additional tests)
     │
     ▼
Testing Engine ──► [ Visual Acuity → Snellen → Contrast
                      → Astigmatism → Amsler → Color Arrangement ]
     │
     ▼
Results Dashboard (AI-generated insights per test)
     │
     ▼
Medical Report (PDF / WhatsApp / Email export)
```

---

## 🤖 AI Tools & Technologies

### 1. Google Gemini AI (`@google/genai`)

Used in **three different contexts** across the platform:

#### a) Voice Command Intelligence (`hooks/useVoiceCommand.ts`)

- **Model:** `gemini-2.0-flash-lite` (fastest, lowest latency)
- **Role:** Tier-3 fallback when local phonetic + fuzzy matching fails
- **Prompt design:** Maps speech transcripts to valid command outputs, accounting for accents, synonyms, and speech-recognition errors
- **Config:** `temperature: 0`, `maxOutputTokens: 10` for deterministic, instant responses

#### b) AI Bot Guide (`hooks/useAIBot.ts`, `hooks/useGlobalBot.ts`)

- **Model:** `gemini-2.0-flash`
- **Role:** Real-time clinical coaching during each test
- Generates contextual tips, encouragement, and warnings (e.g. "You're too close to the screen")
- Aware of current test phase, trial index, and distance compliance status

#### c) Results Interpretation (`components/MedicalReport.tsx`)

- **Model:** `gemini-2.0-flash`
- **Role:** Generates per-test clinical interpretations and patient advice
- Produces actionable medical language from raw test scores
- Flags urgency levels: routine / soon / urgent

---

### 2. MediaPipe (Google) — On-Device Computer Vision

Loaded directly from CDN at runtime (`@mediapipe/tasks-vision`):

#### Face Landmarker

- **468 facial landmarks** tracked at 30fps
- Powers:
  - Real-time distance estimation (interpupillary distance method)
  - Eye aspect ratio (EAR) for blink and eye-cover detection
  - Age/glasses estimation in BiometricScan

#### Pose Landmarker

- Full body pose detection for patient positioning
- Ensures patient is seated upright and centered

#### Hand Landmarker

- Detects hand covering the eye during bilateral tests
- Confirms proper occlusion before accepting answers

**Distance Algorithm:**

```
IPD (pixels) = distance between left_eye_outer ↔ right_eye_outer landmarks
IPD (mm) = IPD(px) / (screen_PPI / 25.4)
Distance (m) = (assumed_IPD_mm × focal_length) / IPD(pixels)
```

Multi-method fallback: FaceMesh → FaceDetection → Pixel-size estimation

---

### 3. Web Speech API — Voice Recognition

Browser-native speech recognition with 3-tier processing:

```
Spoken word
     │
     ▼  Tier 1: Phonetic Normalization Table (< 1ms)
     │   80+ predefined variants: "write"→right, "sea"→C, "tree"→3
     │
     ▼  Tier 2: Levenshtein Fuzzy Matching (< 5ms)
     │   Edit distance ≤35% of word length
     │   Handles accents: "lef"→left, "rite"→right
     │
     ▼  Tier 3: Multi-Alternative Processing
     │   maxAlternatives: 3 — tries all speech hypotheses
     │
     ▼  Tier 4: Gemini 2.0 Flash Lite AI (fallback, ~200ms)
         Context-aware, accent-tolerant NLP classification
```

---

### 4. HTML2Canvas + jsPDF — Report Generation

- Renders the live React DOM to a high-DPI canvas (scale: 3×)
- Exports as A3 portrait PDF with dark theme preserved
- Multi-page support with automatic page breaks

### 5. QR Code Generator (`qrcode-generator`)

- Generates a mobile QR code linking to the patient's report
- Embedded directly in the PDF for easy mobile access

### 6. Firebase

- **Hosting:** Global CDN delivery via Firebase Hosting
- **Analytics counters:** Anonymous usage metrics (tests completed, reports sent) via CounterAPI

---

## 🏗️ Architecture & Code Structure

```
covision/
├── App.tsx                    # Root orchestrator — manages global state & step flow
├── index.tsx                  # React 19 entry point
├── index.css                  # Global design system (CSS variables, dark theme)
├── types.ts                   # Shared TypeScript types & enums
├── translations.ts            # EN/AR string translations
├── firebase.ts                # Firebase initialization
│
├── components/
│   ├── WelcomeScreen.tsx      # Landing page with stats and feature overview
│   ├── BiometricScan.tsx      # AI face analysis & patient profiling (42KB)
│   ├── Calibration.tsx        # Distance calibration with live MediaPipe overlay
│   ├── ColorVisionTest.tsx    # Bilateral Ishihara-adapted color vision test
│   ├── TumblingETest.tsx      # Visual acuity — Tumbling E / Landolt C
│   ├── TestSelector.tsx       # Test menu — choose which assessments to run
│   ├── TestingEngine.tsx      # Orchestrates the test sequence with distance guard
│   ├── MedicalReport.tsx      # Full clinical report with PDF/WhatsApp/Email export (87KB)
│   ├── ResultsDashboard.tsx   # Post-test AI insights & score visualization
│   ├── ProfileForm.tsx        # Patient demographic input
│   ├── PatientForm.tsx        # Patient name & contact form
│   ├── AIBotBubble.tsx        # Floating AI guide bubble component
│   ├── GlobalAIBot.tsx        # Global AI bot wrapper with distance awareness
│   ├── DistanceBar.tsx        # Real-time distance compliance bar
│   ├── FloatingBackground.tsx # Animated particle background
│   ├── ColorVisionIntro.tsx   # Lighting guidance page (optional)
│   │
│   └── tests/
│       ├── AcuityTest.tsx     # Visual acuity (LogMAR, Snellen)
│       ├── SnellenTest.tsx    # Snellen letter chart
│       ├── ColorTest.tsx      # Color arrangement (bilateral)
│       ├── ContrastTest.tsx   # Pelli-Robson contrast sensitivity
│       ├── AstigmatismTest.tsx# Fan chart astigmatism detection
│       └── AmslerTest.tsx     # Amsler grid macular screening
│
├── hooks/
│   ├── useFaceDistance.ts     # MediaPipe face tracking & distance measurement (609 lines)
│   ├── useEyeCoverDetection.ts# MediaPipe EAR-based eye occlusion detection
│   ├── useVoiceCommand.ts     # 3-tier intelligent voice command processing
│   ├── useAIBot.ts            # Per-test AI coaching bot (Gemini)
│   └── useGlobalBot.ts        # Global AI guide with step awareness
│
└── utils/
    └── (utility functions)
```

---

## 🔧 Key Components

### `App.tsx` — Application Orchestrator

Manages the complete state machine across **12 application steps**:

```typescript
enum AppStep {
  Welcome, Profile, Patient, BiometricScan,
  Calibration, ColorTest, TestSelector, Testing,
  Results, Report, ColorIntro
}
```

Holds global state: `stream`, `distanceM`, `distanceStatus`, `isStable`, `colorResult`, `testResults`, `acuityData`, `calibration`, `userProfile`, `patientInfo`

---

### `BiometricScan.tsx` — AI Patient Profiling

The most complex single component (42KB). Uses MediaPipe to:

- Detect and track 468 face landmarks in real-time
- Estimate IPD from landmark geometry
- Detect glasses from facial reflection patterns
- Classify age range from facial proportions
- Provide live camera overlay with landmark visualization

---

### `MedicalReport.tsx` — Clinical Report Engine (87KB)

The largest component. Features:

- Full clinical report with letterhead, patient info, risk assessment
- Per-test results table with clinical interpretation per test
- Automated urgency classification (routine / soon / urgent)
- Patient-specific advice based on all test results
- **PDF export** via html2canvas + jsPDF (A3, 3× DPI, dark theme)
- **WhatsApp sharing** via Web Share API with PDF attachment
- **Email sharing** with mailto fallback
- **CSV / JSON export** for research data
- Embedded QR code for mobile report access

---

### `TestingEngine.tsx` — Test Sequencer

Wraps the test sequence with:

- Real-time distance enforcement (pauses test if patient moves too close)
- Global mini camera view (top-right PIP during tests)
- Progress bar across test sequence
- Passes `distanceM` and `stream` to all child test components

---

## 🪝 Custom Hooks

### `useFaceDistance.ts`

```typescript
const {
  videoRef, faceLandmarksRef, distanceM, status,
  isStable, complianceLog, debugInfo, startCamera, stopCamera
} = useFaceDistance({ targetDistanceM: 1.0, toleranceM: 0.15 });
```

- Multi-method distance estimation with automatic fallback
- Compliance logging (records distance every 500ms during tests)
- Stability detection — requires 3s of stable distance before proceeding

### `useEyeCoverDetection.ts`

```typescript
const { eyeCoverStatus, coverConfidence } = useEyeCoverDetection({
  canvasRef, faceLandmarksRef, targetEye: 'right'
});
```

- Eye Aspect Ratio (EAR) calculation from MediaPipe landmarks
- Majority-vote smoothing over 8-frame history
- Distinguishes: `left_covered` / `right_covered` / `both_covered` / `uncovered` / `no_detection`

### `useVoiceCommand.ts`

```typescript
const { isListening, transcript } = useVoiceCommand({
  commands: { 'up': 'up', 'فوق': 'up', 'down': 'down' ... },
  onCommand: handleAnswer,
  isActive: phase === 'testing',
  language: 'en-US'
});
```

4-tier smart matching: phonetic → Levenshtein fuzzy → multi-alternative → Gemini AI

### `useAIBot.ts`

```typescript
const { botState, botStart, botRecordTrial, botFinish } = useAIBot();
```

- Generates test-specific tips using Gemini
- Records trial results and adjusts coaching dynamically
- Celebrates correct answers, encourages on wrong answers

### `useGlobalBot.ts`

```typescript
const { botState, updateDistance } = useGlobalBot({ step, lang });
```

- Context-aware global AI guide aware of the current app step
- Monitors distance compliance and alerts the patient in real-time
- Cycles through step-specific tip pools

---

## 🎙️ Voice Command System

Every test accepts voice input in **both English and Arabic**. Supported commands per test:

| Test | Voice Commands |
|------|---------------|
| Visual Acuity | `up / down / left / right` + `فوق / تحت / يسار / يمين` |
| Snellen | Letters: `A, B, C, D...` + `"can't see"` → skip |
| Color Vision | Color names + numbers + `"skip"` |
| Contrast | Letters + `"can't see"` |
| Astigmatism | `"clear / blurry / same"` + Arabic equivalents |
| Amsler | `"normal / distorted / missing"` + Arabic equivalents |

**Debounce:** 600ms between accepted commands to prevent double-firing.

---

## 🚀 Setup & Development

### Prerequisites

- Node.js 18+
- A Google Gemini API key

### Installation

```bash
git clone <repo-url>
cd covision
npm install
```

### Environment Variables

Create `.env.local`:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### Run locally

```bash
npm run dev
# Open http://localhost:5173
```

> **Note:** Camera and speech recognition require `https://` or `localhost`. Use Chrome or Edge for best MediaPipe and Web Speech API support.

### Build for production

```bash
npm run build
```

---

## 🚢 Deployment

CoVision is deployed on **Firebase Hosting**:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Deploy
firebase deploy --only hosting
```

**Live URL:** [https://covision-41ab1.web.app](https://covision-41ab1.web.app)

---

## 🛠️ Tech Stack Summary

| Category | Technology |
|----------|-----------|
| Frontend Framework | React 19 + TypeScript 5.8 |
| Build Tool | Vite 6 |
| AI / LLM | Google Gemini 2.0 Flash & Flash Lite |
| Computer Vision | MediaPipe FaceLandmarker, PoseLandmarker, HandLandmarker |
| Voice Recognition | Web Speech API (browser-native) |
| PDF Generation | html2canvas + jsPDF |
| QR Codes | qrcode-generator |
| Sharing | Web Share API (native) + mailto fallback |
| Hosting | Firebase Hosting (CDN) |
| Styling | Vanilla CSS + CSS custom properties (dark theme) |
| Language | Bilingual EN / AR (RTL support) |

---

## 👥 Team

- **Designed by:** Yousef Al-Qahtani, Fahad Rashid
- **Supervised by:** Eng. Ahmad Tubaishat

---

## ⚠️ Disclaimer

> CoVision is a **screening tool only** and does **not** constitute a medical diagnosis. It does not replace a visit to a qualified ophthalmologist or optometrist. Results should be interpreted by a licensed eye care professional. Do not make clinical decisions based solely on CoVision screening results.

---

<div align="center">

**CoVision v1.4.0** — Powered by Google Gemini AI & MediaPipe

Made with ❤️ for accessible clinical vision screening

</div>
