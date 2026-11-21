/**
 * Building pieces: the things a level is furnished with, beyond floor and wall. Some are
 * solid (they take the whole tile: nothing walks through, but light and sight pass over
 * them); braziers are the dungeon's own lights. Arches only dress an entrance.
 *
 * Pure data: the generator places them (dungeon.ts), the renderer draws them.
 */

export type PieceKind = 'brazier' | 'chains' | 'altar' | 'sarcophagus' | 'shelf' | 'barrel' | 'rubblePile' | 'brokenColumn' | 'arch';
export const PIECE_KINDS: readonly PieceKind[] = ['brazier', 'chains', 'altar', 'sarcophagus', 'shelf', 'barrel', 'rubblePile', 'brokenColumn', 'arch'];

export interface PieceDef {
  /** Takes the tile: nothing walks through it. */
  solid: boolean;
  /** A light of the dungeon: how far it reaches, in tiles. */
  light?: number;
  /** Stands against a wall (and faces away from it). */
  againstWall?: boolean;
}

export const PIECES: Record<PieceKind, PieceDef> = {
  brazier: { solid: true, light: 5, againstWall: true },
  chains: { solid: false },
  altar: { solid: true, againstWall: true },
  sarcophagus: { solid: true },
  shelf: { solid: true, againstWall: true },
  barrel: { solid: true, againstWall: true },
  rubblePile: { solid: true },
  brokenColumn: { solid: true },
  arch: { solid: false },
};

export interface Piece {
  kind: PieceKind;
  x: number;
  y: number;
  /** For pieces against a wall: the way they face (away from the wall), as dx, dy. */
  face?: { x: number; y: number };
}

/** The letter each piece has in the plans of locations (see locations.ts). */
export const PIECE_CHARS: Record<string, PieceKind> = {
  x: 'brazier',
  c: 'chains',
  a: 'altar',
  s: 'sarcophagus',
  h: 'shelf',
  b: 'barrel',
  u: 'rubblePile',
  p: 'brokenColumn',
};
