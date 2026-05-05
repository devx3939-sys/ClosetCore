// Reference seasonal color palettes. Used as defaults when a user picks a season.
import type { ColorSeason } from './types';

export const SEASON_PALETTES: Record<
  ColorSeason,
  {
    label: string;
    description: string;
    primary: string[];
    secondary: string[];
    accent: string[];
    neutral: string[];
    avoid: string[];
  }
> = {
  spring: {
    label: 'Spring',
    description: 'Warm, light, clear — peachy and golden undertones.',
    primary: ['#FFB6A3', '#FFD27D', '#A8E6A1', '#FFE5A8'],
    secondary: ['#F4A261', '#E9C46A', '#B5E48C', '#FAD2E1'],
    accent: ['#FF6B6B', '#FF9F43', '#FFC94B'],
    neutral: ['#F4E1C1', '#E6D5B8', '#FFFAF0'],
    avoid: ['#000000', '#2F2F2F', '#4B0082'],
  },
  summer: {
    label: 'Summer',
    description: 'Cool, soft, muted — pastel and dusty hues.',
    primary: ['#A4C2D7', '#D6B5D6', '#B8D8D8', '#C6B7DB'],
    secondary: ['#7FA4B8', '#9D8AAA', '#A6C4C4'],
    accent: ['#E0B0C5', '#7390A6', '#B89DC9'],
    neutral: ['#E5E4E2', '#C0C0C0', '#F5F5F5'],
    avoid: ['#FF6600', '#FFD700', '#8B4513'],
  },
  autumn: {
    label: 'Autumn',
    description: 'Warm, deep, muted — rich earthy tones.',
    primary: ['#A0522D', '#8B4513', '#556B2F', '#B8860B'],
    secondary: ['#CD853F', '#D2691E', '#6B8E23', '#8B7355'],
    accent: ['#B22222', '#DAA520', '#5F9EA0'],
    neutral: ['#704214', '#3E2C1C', '#FFFDD0'],
    avoid: ['#FF1493', '#00FFFF', '#9400D3'],
  },
  winter: {
    label: 'Winter',
    description: 'Cool, deep, clear — high contrast and saturated.',
    primary: ['#000080', '#8B0000', '#2F4F4F', '#4B0082'],
    secondary: ['#FF1493', '#00CED1', '#191970', '#800080'],
    accent: ['#DC143C', '#1E90FF', '#FFFFFF'],
    neutral: ['#000000', '#FFFFFF', '#36454F'],
    avoid: ['#F5DEB3', '#FFDAB9', '#D2B48C'],
  },
};

export function defaultPaletteFor(season: ColorSeason) {
  const p = SEASON_PALETTES[season];
  return {
    season,
    primary_colors: p.primary,
    secondary_colors: p.secondary,
    accent_colors: p.accent,
    neutral_colors: p.neutral,
    avoid_colors: p.avoid,
  };
}
