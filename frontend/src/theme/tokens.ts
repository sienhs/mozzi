import { StyleSheet } from 'react-native';

// Figma 00 · 디자인 시스템 (온글잎 박다현체 / 390 × 844).
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
  paper: '#FFFCF7',
  peachPaper: '#F6E6D7',
  paperEdge: '#E8D8C5',
  mossInk: '#4E634B',
  border: '#9B8E83',
  soft: '#F4D8C5',
  error: '#B2364C',
  happy: '#F3D889',
  calm: '#B8CBA8',
  neutral: '#D9CFC1',
  sad: '#B8C5DD',
  angry: '#E6B2A6',
  // Figma 05 · 모찌 뽑기.
  gachaCream: '#F3EADC',
  gachaNavy: '#303645',
  // 개봉 영상 가장자리 색. 영상이 화면을 다 채우지 못하는 곳에 깐다.
  gachaCocoa: '#442A1D',
  gachaNavySoft: '#41495A',
  gachaGold: '#EBD5AA',
  gachaGoldInk: '#82602C',
  gachaRose: '#AA5265',
  gachaRoseSoft: '#F6E9EC',
  gachaViolet: '#78618C',
  gachaVioletSoft: '#F0ECF4',
  gachaBlue: '#526C91',
  gachaBlueSoft: '#EAF0F7',
  gachaSageInk: '#52644A',
} as const;
export const fonts = {
  // The supplied font has one weight; all variants use the same face.
  regular: 'OwnglyphParkDahyun',
  medium: 'OwnglyphParkDahyun',
  bold: 'OwnglyphParkDahyun',
  pen: 'OwnglyphParkDahyun',
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
    fontSize: 34,
    lineHeight: 46,
    color: colors.ink,
    letterSpacing: -0.8,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 38,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 34,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 20,
    lineHeight: 30,
    color: colors.ink,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 20,
    lineHeight: 30,
    color: colors.ink,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 26,
    color: colors.muted,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
  },
});
