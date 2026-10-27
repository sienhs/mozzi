import { StyleSheet } from 'react-native';

// Figma 00 · 디자인 시스템 (Noto Sans KR / 390 × 844).
export const colors = {
  bg: '#FAF7F2',
  primary: '#A65E46',
  pressed: '#874532',
  sage: '#7D8F76',
  sageSoft: '#E6EBDD',
  ink: '#342E2A',
  muted: '#756B63',
  white: '#FFFFFF',
  line: '#E4DDD3',
  border: '#9B8E83',
  soft: '#F4D8C5',
  error: '#B2364C',
  happy: '#F3D889',
  calm: '#B8CBA8',
  neutral: '#D9CFC1',
  sad: '#B8C5DD',
  angry: '#E6B2A6',
} as const;
export const fonts = {
  regular: 'NotoSansKR_400Regular',
  medium: 'NotoSansKR_500Medium',
  bold: 'NotoSansKR_700Bold',
} as const;
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  page: 20,
  xl: 24,
  section: 28,
  xxl: 32,
} as const;
export const radii = {
  small: 8,
  input: 12,
  button: 16,
  card: 20,
  sheet: 24,
} as const;
export const typography = StyleSheet.create({
  display: {
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 40,
    color: colors.ink,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 32,
    color: colors.ink,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
});
