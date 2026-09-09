// Keep phones (including landscape phones) out of the 3D build for now.
export function supportsForest({width, screenWidth, screenHeight, coarse=false}) {
  return width >= 768 && (!coarse || Math.min(screenWidth, screenHeight) >= 600);
}
