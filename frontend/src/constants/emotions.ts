import type { ImageSourcePropType } from 'react-native';
import type { Emotion } from '@/types/diary';
import { colors } from '@/theme/tokens';

export const emotionOrder: Emotion[] = [
  'happy',
  'calm',
  'neutral',
  'sad',
  'angry',
];
// Keep these static require calls: Metro must discover every original PNG at build time.
export const emotions: Record<
  Emotion,
  {
    label: string;
    color: string;
    source: ImageSourcePropType;
    // Figma "Mozzi / Face 28": transparent face used at small sizes (calendar, rows).
    face: ImageSourcePropType;
  }
> = {
  happy: {
    label: '행복',
    color: colors.happy,
    source: require('../../assets/happy.png'),
    face: require('../../assets/figma/face-happy.png'),
  },
  calm: {
    label: '평온',
    color: colors.calm,
    source: require('../../assets/calm.png'),
    face: require('../../assets/figma/face-calm.png'),
  },
  neutral: {
    label: '보통',
    color: colors.neutral,
    source: require('../../assets/neutral.png'),
    face: require('../../assets/figma/face-neutral.png'),
  },
  sad: {
    label: '우울',
    color: colors.sad,
    source: require('../../assets/sad.png'),
    face: require('../../assets/figma/face-sad.png'),
  },
  angry: {
    label: '화남',
    color: colors.angry,
    source: require('../../assets/angry.png'),
    face: require('../../assets/figma/face-angry.png'),
  },
};
export const activities = [
  '공부',
  '업무',
  '운동',
  '휴식',
  '친구',
  '취미',
  '가족',
  '기타',
] as const;
