import { Department } from './catalog';
import { LinkKind } from './links';

export const DEPT_COLOR: Record<Department, string> = {
  pamela: '#8B5CF6',
  oracle: '#22D3EE',
  dolores: '#F59E0B',
  vala: '#22C55E',
  daisy: '#EC4899',
  core: '#E0CA3C',
};

export const KIND_STYLE: Record<LinkKind, { width: number; dash?: string; glyph: 'dot' | 'lock' | 'diamond' }> = {
  context: { width: 1.5, glyph: 'dot' },
  dependency: { width: 3, glyph: 'lock' },
  trigger: { width: 2, dash: '6 5', glyph: 'diamond' },
};

export const ERROR_COLOR = '#EF4444';
export const MONEY_GLYPH = 'coin';
export const MAX_ANIMATED = 20;
