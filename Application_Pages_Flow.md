# CoVision: Application Page Flow & Descriptions

This document outlines the sequential user journey through the CoVision clinical vision screening platform. Below is the list of all application pages, in the exact order a patient experiences them, along with a brief description of each page's function.

## 1. Welcome Screen (`WelcomeScreen.tsx`)
**Description:** The starting point of the application. It introduces the "Edge-AI Cognitive Platform," displays the clinical medical disclaimer (emphasizing it is a screening tool, not a diagnosis), and contains the primary "Begin Screening" button to launch the experience.

## 2. Test Selection (`TestSelector.tsx`)
**Description:** A configuration dashboard where the examiner or patient chooses which specific vision tests to run. Options include Visual Acuity (Snellen/Tumbling E), Color Vision (Ishihara), Contrast Sensitivity, Astigmatism, and Amsler Grid tests, allowing for a customized diagnostic session.

## 3. AI Biometric Scan (`BiometricScan.tsx`)
**Description:** A futuristic, augmented-reality initiation screen. The system activates the webcam and overlays a dense, glowing 3D mesh over the patient's face, body skeleton, and hands. It acts as a system check to ensure the room lighting is adequate and the AI tracking algorithms are functioning correctly.

## 4. Patient Profile (`ProfileForm.tsx`)
**Description:** A standard medical intake form. The patient inputs their core demographics (Full Name, Age, Gender) which are synchronized into the final medical report. The form includes validations to ensure data integrity.

## 5. Screen Calibration Wizard (`ScreenCalibrationWizard.tsx`)
**Description:** A physical hardware calibration step. Because screen sizes vary wildly (from 11-inch tablets to 27-inch monitors), the user is prompted to hold a standard credit card up to the screen and adjust an on-screen box to match it. This calculates the precise Pixels-Per-Millimeter (PPM) ratio, ensuring the optical tests are mathematically exact.

## 6. Cover Eye & Preparation (`CoverEyeScreen.tsx`)
**Description:** An instructional buffer screen before the rigorous testing begins. The system instructs the user to physically step exactly 2.0 meters back from the screen and cover one eye. It uses the live AI distance tracker to monitor their position, only allowing them to proceed once they are perfectly positioned and stable.

## 7. Color Vision Intro (`ColorVisionIntro.tsx`)
**Description:** A brief guideline page specifically for the Ishihara Color Test. It instructs the user to turn up their screen brightness, disable night-mode/blue-light filters, and ensure they are in natural daylight to prevent false color blindness readings.

## 8. Color Vision Test (`ColorVisionTest.tsx`)
**Description:** The digitized Ishihara test. The screen presents a sequential series of highly calibrated color plates containing hidden numbers. The user selects the number they see, allowing the system to detect and classify specific types of Color Vision Deficiency (e.g., Red-Green color blindness).

## 9. Distance Calibration Tracker (`Calibration.tsx`)
**Description:** The primary spatial enforcement screen. Before the Visual Acuity test begins, the AI displays a live, full-body skeleton overlay and a real-time distance gauge. This strictly enforces the 2.0-meter clinical testing distance, locking the "Next" button until the patient is exactly in position.

## 10. Core Testing Engine (`TestingEngine.tsx` / `TumblingETest.tsx`)
**Description:** The main diagnostic environment for visual acuity (Snellen test). The system displays a "Tumbling E" symbol at mathematically exact sizes based on the hardware calibration and the 2.0-meter tracking distance. The user inputs the direction of the "E" using keyboard or gesture controls. If the patient leans closer to cheat, the AI halts the test automatically.

## 11. Results Dashboard (`ResultsDashboard.tsx`)
**Description:** A high-level, patient-friendly summary of the screening session. It immediately visually categorizes the results (e.g., Normal Vision vs. Potential Deficiency) and provides a "Reliability Score" based on how well the patient maintained the 2-meter distance during testing.

## 12. Medical Report Generator (`Report.tsx`)
**Description:** The final destination. This page generates a highly detailed, professional medical document summarizing the entire session. It includes raw data like LogMAR acuity scores, Ishihara plates passed/failed, and an AI-generated clinical interpretation. The patient or examiner can print this direct-to-PDF to take to a registered ophthalmologist.
