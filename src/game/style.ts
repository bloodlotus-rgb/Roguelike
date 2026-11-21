/**
 * The look of the dungeon, chosen in the pause screen and kept between sessions:
 *
 * - `sepia`: pen and ink on old paper under a warm flame (the original).
 * - `engraving`: the same hatching in greys, as an engraving: cold paper, no orange.
 * - `gothic`: no drawing; dark stone, real light and deep shadow.
 */
export type VisualStyle = 'sepia' | 'engraving' | 'gothic';
export const VISUAL_STYLES: readonly VisualStyle[] = ['sepia', 'engraving', 'gothic'];

const KEY = 'estirpe.style';
let current: VisualStyle = (() => {
  try {
    const stored = localStorage.getItem(KEY) as VisualStyle | null;
    return stored && VISUAL_STYLES.includes(stored) ? stored : 'sepia';
  } catch {
    return 'sepia';
  }
})();

export function visualStyle(): VisualStyle {
  return current;
}

export function setVisualStyle(style: VisualStyle): void {
  current = style;
  try {
    localStorage.setItem(KEY, style);
  } catch {
    // Without storage the choice lasts this session.
  }
}

/** The style as a shader number: 0 sepia, 1 engraving, 2 gothic. */
export function styleIndex(style: VisualStyle = current): number {
  return VISUAL_STYLES.indexOf(style);
}
