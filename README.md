## Overview

MonkeyFacer is a web application built with React + TypeScript + Vite that captures webcam frames, extracts face / hand / pose landmarks using the pre‑trained MediaPipe Holistic model, classifies a small set of gestures using project functions (heuristics over landmarks), and displays a representative image for the current gesture.

The application does not include a custom training pipeline—MediaPipe Holistic is the ML component used to provide landmarks. Gesture classification is performed with deterministic code that inspects the landmark coordinates.

---

## Repository layout (relevant files)

- `src/ml/HolisticDetectors.tsx` — MediaPipe Holistic integration, camera loop, draw on canvas, call classification.  
  https://github.com/Raulmora22/MonkeyFacer/blob/master/src/ml/HolisticDetectors.tsx
- `src/func/gestures.ts` — gesture classification logic and mapping from gesture → image.  
  https://github.com/Raulmora22/MonkeyFacer/blob/master/src/func/gestures.ts
- `src/stores/GestureStore.ts` — Zustand store maintaining the current gesture.  
  https://github.com/Raulmora22/MonkeyFacer/blob/master/src/stores/GestureStore.ts
- `src/components/ImageDisplay.tsx` — component that renders the image corresponding to the detected gesture.  
  https://github.com/Raulmora22/MonkeyFacer/blob/master/src/components/ImageDisplay.tsx
- `src/App.tsx` — application root that mounts HolisticDetectors and ImageDisplay.  
  https://github.com/Raulmora22/MonkeyFacer/blob/master/src/App.tsx
- `public/images/` — images referenced by the app (smile, eureca, etc.)

---

## Runtime flow

1. App mounting
   - `src/App.tsx` renders two main UI parts side by side: `HolisticDetectors` and `ImageDisplay`.

2. Camera and Holistic model
   - `HolisticDetectors`:
     - Creates a hidden `<video>` element (videoRef) used as the camera source.
     - Creates a `<canvas>` element (canvasRef) used to draw the camera frame and landmark visualizations.
     - Instantiates MediaPipe `Holistic` and configures `locateFile` to load model files from CDN.
     - Uses `Camera` from `@mediapipe/camera_utils` to stream frames from the webcam.
     - On every frame, it sends the video frame to the Holistic instance (`HandsMesh.send({ image: video })`).

3. Receiving results
   - The Holistic instance calls `onResults(results)` with a `Results` object that contains:
     - `results.image` — the input image/frame,
     - `results.faceLandmarks` — array of face landmark points,
     - `results.leftHandLandmarks` and `results.rightHandLandmarks`,
     - `results.poseLandmarks` — pose landmarks (shoulders, wrists, etc.),
     - other fields as provided by MediaPipe Holistic.

4. Drawing
   - In `onResults`, the code:
     - Clears the canvas and draws `results.image` scaled to the canvas size.
     - Uses `drawConnectors` and `drawLandmarks` to render face mesh, eyes, brows, irises, face oval, lips, and hand connections using MediaPipe drawing utilities.
     - Visual styles (colors, line widths) are applied when drawing connectors/landmarks.

5. Gesture classification
   - After drawing, the code calls `classifyGesture(results)` (defined in `src/func/gestures.ts`).
   - `classifyGesture` inspects `results` (face / pose landmarks) and returns a gesture label: `"eureca"`, `"smile"`, or `"serious"`.
   - The returned gesture is stored in a global store via `setGesture(detectedGesture)` (Zustand).

6. UI update
   - `ImageDisplay` reads `currentGesture` from `useGestureStore`.
   - Based on the gesture, it loads and displays the corresponding image from `/images/...`.

---

## MediaPipe Holistic configuration (as used)

- Holistic instance created with:
  - `locateFile: file => "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/" + file`
- Options set on the Holistic instance:
  - `modelComplexity: 2`
  - `smoothLandmarks: false` (value used in the code)
  - `minDetectionConfidence: 0.5`
  - `minTrackingConfidence: 0.5`
- The camera is started with width 640 and height 480.

These options control model complexity and detection/tracking confidence thresholds and determine the landmark output used by the gesture classification logic.

---

## Gesture detection logic

Gestures and how they are detected are defined in `src/func/gestures.ts`. The project defines three gesture types:

Type declaration:

```ts
type GestureType = "smile" | "serious" | "eureca";
```

1. "eureca" — hands up

- Uses `results.poseLandmarks`.
- Landmark indices used:
  - left shoulder: `poseLandmarks[11]`
  - right shoulder: `poseLandmarks[12]`
  - left wrist: `poseLandmarks[15]`
  - right wrist: `poseLandmarks[16]`
- Detection rule:
  - If `leftWrist.y < leftShoulder.y` OR `rightWrist.y < rightShoulder.y`, the function returns `"eureca"`.

2. "smile" — smile detection (mouth aspect ratio)

- Uses `results.faceLandmarks`.
- Face landmark indices used:
  - left mouth corner: `face[291]`
  - right mouth corner: `face[61]`
  - upper lip: `face[13]`
  - lower lip: `face[14]`
- Detection steps:
  - Compute mouth width = distance(left corner, right corner)
  - Compute mouth height = distance(upper lip, lower lip)
  - Compute mouthAspectRatio = mouthHeight / mouthWidth
  - If `mouthAspectRatio > SMILE_THRESHOLD (0.35)`, returns `"smile"`.

3. "serious" — neutral / fallback

- If neither hands-up nor smile conditions match, `classifyGesture` returns `"serious"`.

Classification function (summary):

```ts
export function classifyGesture(results: Results): GestureType | null {
  if (detectHandsUp(results)) return "eureca";
  if (detectSmile(results)) return "smile";
  return "serious";
}
```

Gesture → image mapping (from `gestureToImage`):

```ts
{
  smile: "/images/smile.png",
  serious: "/images/xd.png",
  eureca: "/images/eureca.png",
}
```

---

## State management

- A Zustand store in `src/stores/GestureStore.ts` holds the current gesture:
  - `currentGesture: GestureType | null`
  - `setGesture: (gesture: GestureType | null) => void`
- Components subscribe to this store to get live updates (e.g., `ImageDisplay` reads `currentGesture` to display the image).

---

## UI components and rendering

- Video element:
  - A `<video>` element is created and kept hidden; it serves as the direct camera source for MediaPipe.
- Canvas:
  - A `<canvas>` displays the drawn frame and all landmarks/connections.
  - The canvas is rendered with a horizontal flip (CSS class `scale-x-[-1]`), so the drawn output is mirrored relative to the incoming camera image.
- ImageDisplay:
  - Shows a static image that corresponds to the currently detected gesture.
  - The displayed image is taken from `/images/...` paths.

---

## Example code excerpts (exact behavior)

- Gesture store (Zustand):

```ts
import { create } from "zustand";

type GestureType = "smile" | "serious" | "eureca";

type GestureStore = {
  currentGesture: GestureType | null;
  setGesture: (gesture: GestureType | null) => void;
};

export const useGestureStore = create<GestureStore>((set) => ({
  currentGesture: null,
  setGesture: (gesture) => set({ currentGesture: gesture }),
}));
```

- ImageDisplay (reads store and shows mapped image):

```tsx
import { useGestureStore } from "../stores/GestureStore";
import { gestureToImage } from "../func/gestures";

export default function ImageDisplay() {
  const currentGesture = useGestureStore((state) => state.currentGesture);

  const imageSrc = currentGesture
    ? gestureToImage[currentGesture]
    : "/images/ahhh.png";
  return (
    <div className="w-[640px] h-[480px] shrink-0">
      <img
        src={imageSrc}
        alt="Gesture Representation"
        className="w-full h-full object-cover rounded-md"
      />
    </div>
  );
}
```

- Holistic integration (key steps):
  - Create Holistic, set options, register `onResults`.
  - Create `Camera(videoRef.current, { onFrame: () => HandsMesh.send({ image: videoRef.current }) })` and `camera.start()`.
  - On `onResults`, draw image and landmarks, call `classifyGesture`, and call `setGesture`.

---

## How to run the project locally

1. Clone the repository:

```bash
git clone https://github.com/raulmoracode/MonkeyFacer.git
cd MonkeyFacer
```

2. Install dependencies (project uses pnpm in package.json, but npm or yarn can be used depending on environment):

```bash
pnpm install
```

3. Start development server:

```bash
pnpm run dev
```

4. Open the app in your browser (default Vite dev URL, e.g. http://localhost:5173).

When the app runs it will request access to your webcam. The Holistic model will process frames and the UI will update with the detected gesture image.
