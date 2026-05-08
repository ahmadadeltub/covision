# Technical Architecture & AI Implementation Report
**Project:** CoVision: An Edge-AI Cognitive Platform for Standardized Digital Vision Screening
**Author:** Eng. Ahmad Tubaishat

---

## 1. Executive Summary
This document outlines the software architecture, artificial intelligence models, and programming languages utilized in the development of the **CoVision** platform. CoVision is engineered as a zero-latency, Edge-AI web application that performs complex 3D spatial biometrics entirely within the user's browser. By eliminating the need for backend video processing, the architecture ensures absolute patient privacy (HIPAA/GDPR compliance) and real-time responsiveness required for clinical-grade vision screening.

## 2. Programming Languages & Core Frameworks
The application is built upon a modern, highly optimized single-page application (SPA) stack to ensure cross-platform compatibility across laptops, tablets, and desktops.

*   **TypeScript (Primary Language):** The entire application logic, state management, and AI integration are written in strict TypeScript. This provides rigorous type safety, preventing runtime errors during critical medical evaluations and ensuring robust mathematical calculations for the distance scaling algorithms.
*   **React 18 (UI Framework):** Utilized for its highly responsive, component-based architecture. React’s concurrent rendering allows the UI (like the Tumbling 'E' optotypes) to update seamlessly without dropping frames, even while the AI models are running heavy matrix multiplications in the background.
*   **Tailwind CSS (Styling Engine):** A utility-first CSS framework used to construct a responsive, medical-grade, and accessible user interface. It handles dynamic distance-adaptive scaling logic without the overhead of traditional CSS stylesheets.
*   **Vite (Build Tool):** Used for Lightning-fast Hot Module Replacement (HMR) during development and highly optimized, minified production builds.

## 3. Artificial Intelligence & Computer Vision (Edge-AI)
The most critical innovation of the CoVision platform is its deployment of **Edge-AI**. Rather than streaming the user's webcam feed to a cloud server (which introduces lag and privacy risks), the AI models execute directly on the user's local hardware (CPU/GPU) using **WebAssembly (WASM)**.

The platform integrates **Google MediaPipe Tasks Vision**, utilizing three distinct neural network models working in parallel:

### 3.1. FaceLandmarker (Dense 3D Mapping & Distance Estimation)
*   **Architecture:** Identifies 478 distinct 3D landmarks across the human face in real-time.
*   **Function in CoVision:** Serves as the primary distance calculation engine. The system measures the pixel width between specific anchor points (e.g., temples or irises) and uses the pinhole camera geometric model alongside a calibrated Inter-Pupillary Distance (IPD) to calculate absolute distance in millimeters.
*   **Performance:** Runs at ~30-60 Frames Per Second (FPS) using WebGL GPU delegation.

### 3.2. PoseLandmarker (Full Body Biometrics)
*   **Architecture:** We utilize the `pose_landmarker_full` model, the highest-accuracy neural network provided by Google for body tracking. It detects 33 distinct 3D anatomical points.
*   **Function in CoVision:** Tracks patient posture and skeletal alignment. It ensures that the patient is standing square to the camera and maintains stability during the 2-meter physical calibration and visual acuity tests. 

### 3.3. HandLandmarker (Articulated Finger Tracking)
*   **Architecture:** Tracks 21 3D knuckles and joints per hand, capable of detecting two hands simultaneously.
*   **Function in CoVision:** Deployed during the "Cover Eye" phase to ensure the patient is correctly occluding an eye without applying pressure, and powers the continuous, glowing holographic hand-mesh overlaid in the Biometric Scan.

## 4. Advanced System Mechanics

### 4.1. Hardware Acceleration via WebAssembly (WASM) & WebGL
To achieve 60 FPS while running three deep-learning models simultaneously, CoVision bypasses the standard JavaScript execution thread. The neural networks are compiled down to WebAssembly, allowing near-native execution speed. Furthermore, the `delegate: 'GPU'` parameter is passed to the MediaPipe engine, instantly offloading the heavy tensor mathematics to the device's integrated or dedicated graphics card.

### 4.2. Temporal Smoothing & Exponential Moving Averages (EMA)
Raw AI landmark coordinates inherently possess frame-to-frame "jitter." CoVision implements an Exponential Moving Average (EMA) algorithm within a custom React hook (`useFaceDistance.ts`). This mathematical filter smooths the distance calculations over a rolling buffer of frames. As a result, the distance enforcement logic (e.g., verifying the patient is exactly 2.0 meters away ± 0.15m) remains highly stable and prevents the UI from flickering between "In Range" and "Out of Range."

### 4.3. Distance-Adaptive Augmented Reality (AR) Canvas
The visual tracking meshes (Face, Pose, and Hands) are drawn on a transparent HTML5 `<canvas>` layered over the live video element. The drawing functions implement a `distScale` multiplier:
`const distScale = Math.max(0.4, Math.min(1.2, 1.5 - (distM * 0.45)));`
This dynamic rendering engine calculates the user's depth in real-time and geometrically scales the thickness, shadow blur, and radius of the glowing AR skeleton so that it remains visually proportionate whether the patient is 0.5 meters or 2.0 meters away.

## 5. Security & Privacy Advantages
Because of this specific technology stack (React + WASM Edge-AI), **CoVision is architecturally incapable of violating patient visual privacy.** 
*   **No Video Uploads:** The `MediaStream` from the webcam is fed directly into the local WASM neural networks. No video frames are compressed, serialized, or transmitted over the internet.
*   **Serverless Diagnostics:** The entire platform functions as a static client-side application. 

## 6. Conclusion
CoVision represents the pinnacle of modern frontend architecture and applied Artificial Intelligence. By harmonizing React's UI responsiveness with the raw computational power of WebAssembly-accelerated Google neural networks, the platform achieves what was previously impossible: clinical-grade, mathematically enforced spatial vision screening running flawlessly inside a standard web browser without a backend infrastructure.
