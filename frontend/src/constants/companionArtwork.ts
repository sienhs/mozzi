import type { ImageStyle } from 'react-native';
import type { CompanionId } from '@/types/companion';

// Visible alpha bounds of the bundled artwork, fitted to a shared 88% frame.
const fit: Record<CompanionId, [number, number, number]> = {
  apple: [1.049, -0.521, 0.26],
  blueberry: [1.063, -0.651, -0.781],
  cherry: [1.037, 2.995, 2.083],
  grape: [0.952, -1.042, -0.13],
  default: [0.943, -0.124, -3.358],
  mango: [1.09, -4.948, -2.214],
  peach: [0.931, 0.391, 0],
  'strawberry-crown': [0.937, -0.098, 0.195],
  watermelon: [0.974, -2.604, 0.911],
};
export function companionArtworkStyle(id: CompanionId): ImageStyle {
  const [scale, x, y] = fit[id];
  return { transform: [{ scale }], left: `${x}%`, top: `${y}%` };
}
