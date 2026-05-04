type GestureType = "smile" | "serious" | "eureca";

import type { Results } from "@mediapipe/holistic";
export const gestureToImage: Record<GestureType, string> = {
  smile: "/images/smile.png",
  serious: "/images/xd.png",
  eureca: "/images/eureca.png",
};

const SMILENORMAL = 0.4;
const SMILEHARD = 0.6;

function calculateDistance(
  point1: { x: number; y: number },
  point2: { x: number; y: number },
): number {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2),
  );
}

function detectSmile(results: Results, smile: "normal" | "hard"): boolean {
  if (!results.faceLandmarks) return false;

  const face = results.faceLandmarks;

  const leftCorner = face[291];
  const rightCorner = face[61];
  const upperLip = face[13];
  const lowerLip = face[14];

  const mouthWidth = calculateDistance(leftCorner, rightCorner);
  const mouthHeight = calculateDistance(upperLip, lowerLip);

  if (mouthWidth === 0) return false;

  const mouthAspectRatio = mouthHeight / mouthWidth;

  return mouthAspectRatio > (smile === "normal" ? SMILENORMAL : SMILEHARD);
}

function detectHandsUp(results: Results): boolean {
  if (!results.poseLandmarks) return false;

  const landmarks = results.poseLandmarks;

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  const handsUp =
    leftWrist.y < leftShoulder.y || rightWrist.y < rightShoulder.y;

  return detectSmile(results, "normal") && handsUp;
}

export function classifyGesture(results: Results): GestureType | null {
  if (detectHandsUp(results)) {
    return "eureca";
  }

  if (detectSmile(results, "hard")) {
    return "smile";
  }

  return "serious";
}
