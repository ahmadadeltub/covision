# Scientific Research Report

## Project Title
**CoVision: An Edge-AI Cognitive Platform for Standardized Digital Vision Screening**

## Competition Category
**Cognitive Systems**

## Author
Eng. Ahmad Tubaishat

---

## 1. Abstract
Vision impairment remains a critical global health challenge, often exacerbated by a lack of accessible, standardized, and affordable early screening tools. Traditional visual acuity and color vision tests require physical clinic visits, specialized equipment, and trained examiners, limiting their reach in underserved or remote populations. **CoVision** is an innovative, web-based Edge-AI cognitive platform designed to democratize and standardize digital vision screening. 

By leveraging advanced, real-time artificial intelligence—specifically Google MediaPipe's FaceLandmarker, PoseLandmarker, and HandLandmarker neural networks—CoVision enforces rigorous clinical testing conditions (e.g., exact 2-meter physical distance compliance) entirely within the user's web browser. The system operates autonomously, using device-native hardware acceleration (WebAssembly/GPU) to ensure privacy, zero network latency, and continuous spatial tracking. CoVision successfully digitizes the globally recognized Snellen and Ishihara tests, augmented by an intelligent AI diagnostic backend that generates immediate, actionable medical reports.

## 2. Problem Statement
The current standard of care for primary vision screening relies heavily on analog tools (e.g., physical Snellen charts, printed Ishihara plates). This traditional paradigm suffers from several systemic flaws:
1. **Lack of Accessibility:** Populations in rural or developing areas often lack access to primary eye care facilities.
2. **Inconsistent Testing Conditions:** At-home digital vision tests frequently fail because users do not maintain the correct focal distance, rendering the visual angle calculations invalid.
3. **Delayed Diagnosis:** Without immediate, accessible screening, conditions like Amblyopia (lazy eye), Myopia (nearsightedness), and congenital Color Vision Deficiency (CVD) go undetected until they cause irreversible learning or occupational difficulties.

## 3. The CoVision Solution & Cognitive System Architecture
CoVision solves these problems by transforming any standard laptop or tablet into a medically calibrated diagnostic station. It fits perfectly into the **Cognitive Systems** category because it perceives its environment (via webcam), reasons about spatial geometry (distance calculation), and adapts its behavior (enforcing testing protocols) autonomously.

### 3.1 Edge-AI Spatial Tracking (The Cognitive Engine)
To guarantee clinical accuracy, the visual angle of the test optotypes (e.g., the Tumbling 'E') must be exact. This requires the patient to be exactly 2.0 meters from the screen. CoVision achieves this using a tri-modal AI spatial tracking engine:
*   **FaceLandmarker (478-Point Dense Mesh):** The system continuously detects the patient's face in 3D space. By referencing the camera's focal length and the patient's interpupillary distance (IPD), the algorithm calculates the absolute distance between the screen and the patient's cornea in real-time.
*   **PoseLandmarker (33-Point Biometric Skeleton):** The system tracks the patient's posture (shoulders, hips, extremities) to ensure they are standing squarely and facing the screen.
*   **HandLandmarker (21-Point Articulation):** Used during the "Cover Eye" phase to verify that the patient is correctly occluding one eye without pressing too hard, and later for robust gesture-based interaction.

Because these models run on **Edge-AI** (directly inside the browser via WebAssembly), no video data is ever sent to a server. This guarantees 100% patient privacy (HIPAA/GDPR compliance) and eliminates network latency.

### 3.2 Dynamic Visual Acuity (Tumbling E Engine)
CoVision digitizes the Snellen chart using the universally recognized "Tumbling E" optotype, making it suitable for illiterate patients or children. 
*   **Physical Screen Calibration:** The system prompts the user to calibrate their screen using a physical credit card. This establishes the exact pixels-per-millimeter (PPM) ratio of the display.
*   **Algorithmic Optotype Generation:** Based on the PPM and the dynamically enforced 2.0-meter tracking distance, the system renders the 'E' at the precise millimeter height required to test specific LogMAR and Snellen fractions (e.g., 20/20, 20/40, 20/200). 
*   **Cognitive Interaction:** The patient uses keyboard arrows or touchscreen gestures to indicate the direction of the 'E'. The system measures response time and accuracy.

### 3.3 Color Vision Deficiency (Ishihara Digitization)
The platform includes a digitized version of the Ishihara Plate test to screen for Protanopia, Deuteranopia, and Tritanopia. The system utilizes standardized, high-quality vector representations of the plates, ensuring that color profiles remain accurate across different monitors (supplemented by pre-test lighting warnings).

## 4. Methodology & Implementation
The platform was engineered using a modern, highly optimized technology stack:
*   **Frontend Framework:** React 18 with TypeScript and Vite for sub-millisecond component rendering.
*   **Styling & UI:** Tailwind CSS for a fully responsive, medical-grade aesthetic, ensuring functionality across tablets and laptops.
*   **Artificial Intelligence:** `@mediapipe/tasks-vision` (Google) for real-time computer vision.
*   **State Management & Analysis:** Custom React Hooks (`useFaceDistance.ts`) handle the complex trigonometry of focal length estimation and distance smoothing (Exponential Moving Averages).

### 4.1 The Distance Algorithm
The core distance formula utilizes the pinhole camera model:
`Distance (mm) = (Focal Length * Actual Face Width (mm)) / Apparent Face Width (pixels)`
The system applies a temporal smoothing filter to the output to prevent UI flickering, allowing the patient to stand stably at exactly 2.0 meters (with a ±0.15m tolerance threshold). If the patient moves out of bounds, the Cognitive System immediately pauses the visual acuity test and flashes a warning, ensuring no false data is recorded.

## 5. Results & Clinical Relevance
Initial testing of the CoVision platform demonstrates high reliability in enforcing testing distances compared to unmonitored digital tests. The Cognitive System successfully:
1.  Prevents patients from "cheating" by leaning closer to the screen.
2.  Provides an immediate, downloadable, and printable PDF report containing Snellen fractions, response times, and an AI classification of their Color Vision status.
3.  Acts as an effective triage tool, sorting patients into "Normal," "Monitor," or "Refer to Ophthalmologist" categories.

## 6. Future Work and Scalability
As an Edge-AI Cognitive System, CoVision is highly scalable. Future iterations aim to include:
*   **Contrast Sensitivity Testing (Pelli-Robson):** To detect early signs of glaucoma or cataracts.
*   **Amsler Grid Digitization:** For macular degeneration screening.
*   **Voice Recognition:** To allow hands-free responses to the Tumbling E and Ishihara tests, further enhancing the cognitive capabilities of the platform.

## 7. Conclusion
CoVision represents a significant leap forward in telehealth and digital diagnostics. By combining Edge-AI biometric tracking with standardized optometric mathematics, it transforms a standard personal computer into a Cognitive System capable of reliable, remote vision screening. It proves that complex spatial AI can be utilized to democratize healthcare, providing professional-grade diagnostic frameworks to anyone with an internet connection.
