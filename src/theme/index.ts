import { useMemo } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';

/**
 * Pause design tokens. One calm teal system, tuned for both light and dark and for both a phone
 * and a big tablet. Import `useAppTheme()` for colours and `useResponsive()` for layout metrics.
 */

export const palette = {
  teal: '#0E7C7B',
  tealDeep: '#06403F',
  tealBright: '#12A3A1',
  mist: '#BFE3E2',
  sand: '#F6F4EF',
  coral: '#E8836B',
  amber: '#E0A458',
} as const;

export type AppColors = {
  scheme: 'light' | 'dark';
  bg: string;
  bgElevated: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  onPrimarySoft: string;
  accent: string;
  danger: string;
  success: string;
  overlayTop: string;
  overlayBottom: string;
  /** Foreground on the teal gradient overlays — same in both themes. */
  onOverlay: string;
  onOverlayDim: string;
  onOverlayFaint: string;
  /** Modal backdrop. */
  scrim: string;
  /** Switch "on" track — dark mode needs a saturated teal, mist swallows the white thumb. */
  switchOn: string;
};

const light: AppColors = {
  scheme: 'light',
  bg: '#F6F4EF',
  bgElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#EFECE4',
  border: '#E4E0D6',
  text: '#14201F',
  textDim: '#566462',
  textFaint: '#6C7977', // ≥4.5:1 on card white — it carries real information at 12px
  primary: palette.teal,
  onPrimary: '#FFFFFF',
  primarySoft: '#D7EEED',
  onPrimarySoft: palette.tealDeep,
  accent: palette.coral,
  danger: '#C4553C',
  success: palette.teal,
  overlayTop: palette.tealDeep,
  overlayBottom: palette.teal,
  onOverlay: '#FFFFFF',
  onOverlayDim: '#DDF1F0',
  onOverlayFaint: palette.mist,
  scrim: '#00000099',
  switchOn: palette.teal,
};

const dark: AppColors = {
  scheme: 'dark',
  bg: '#0C1211',
  bgElevated: '#141B1A',
  card: '#161F1E',
  cardAlt: '#1F2A28',
  border: '#26302E',
  text: '#EAF2F1',
  textDim: '#9DACAA',
  textFaint: '#8A9895', // ≥4.5:1 on the dark card
  primary: palette.mist,
  onPrimary: palette.tealDeep,
  primarySoft: '#14322F',
  onPrimarySoft: palette.mist,
  accent: palette.coral,
  danger: '#E4795F',
  success: palette.mist,
  overlayTop: '#04302F',
  overlayBottom: palette.teal,
  onOverlay: '#FFFFFF',
  onOverlayDim: '#DDF1F0',
  onOverlayFaint: palette.mist,
  scrim: '#00000099',
  switchOn: palette.tealBright,
};

export function useAppTheme(): AppColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export type Responsive = {
  width: number;
  isTablet: boolean;
  isLarge: boolean;
  contentWidth: number;
  columns: number;
  gutter: number;
  scale: number;
};

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  return useMemo(() => {
    const isTablet = width >= 600;
    const isLarge = width >= 900;
    return {
      width,
      isTablet,
      isLarge,
      contentWidth: Math.min(width, isLarge ? 840 : isTablet ? 680 : width),
      columns: isLarge ? 3 : isTablet ? 2 : 1,
      gutter: isTablet ? spacing.lg : spacing.md,
      scale: isTablet ? 1.08 : 1,
    };
  }, [width]);
}
