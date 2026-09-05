export type Vector3Value = { x: number; y: number; z: number };

export interface TitleOptions {
  /** Follow the foreground rim, or use the manual container position. */
  anchor?: 'ring' | 'container';
  /** Positive values tuck the settled text below the rim, in CSS pixels. */
  overlapPx?: number;
  /** Fraction of container width; 0.5 is centered. */
  x?: number;
  /** Fraction of container height measured down from the top. */
  y?: number;
  scale?: number;
  /** Radians, positive counterclockwise. */
  rotation?: number;
  waveStrength?: number;
  transitionSpeed?: number;
}

export const DEFAULT_TITLE = { anchor: 'ring' as 'ring' | 'container', overlapPx: 15, x: 0.5, y: 0.09, scale: 1.57, rotation: 0, waveStrength: 1, transitionSpeed: 1 };
export const DEFAULT_AXIS: Vector3Value = { x: 0, y: -1, z: 0 };
export const DEFAULT_SELECTION_OFFSET: Vector3Value = { x: 0, y: -9, z: -5 };
