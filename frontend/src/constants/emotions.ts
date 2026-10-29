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
export function isEmotion(value: unknown): value is Emotion {
  return typeof value === 'string' && emotionOrder.includes(value as Emotion);
}
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
    face: require('../../assets/happy.png'),
  },
  calm: {
    label: '평온',
    color: colors.calm,
    source: require('../../assets/calm.png'),
    face: require('../../assets/calm.png'),
  },
  neutral: {
    label: '보통',
    color: colors.neutral,
    source: require('../../assets/neutral.png'),
    face: require('../../assets/neutral.png'),
  },
  sad: {
    label: '우울',
    color: colors.sad,
    source: require('../../assets/sad.png'),
    face: require('../../assets/sad.png'),
  },
  angry: {
    label: '화남',
    color: colors.angry,
    source: require('../../assets/angry.png'),
    face: require('../../assets/angry.png'),
  },
};
