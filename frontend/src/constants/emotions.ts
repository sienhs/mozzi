import type { ImageSource } from 'expo-image';
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
    source: ImageSource | number;
    // 작은 자리(달력 칸·행, 44 이하)에 쓰는 128px 얼굴. 큰 원본을 작게 디코딩하지 않게 따로 둔다.
    face: ImageSource | number;
  }
> = {
  happy: {
    label: '행복',
    color: colors.happy,
    source: require('../../assets/happy.png'),
    face: require('../../assets/faces/happy.png'),
  },
  calm: {
    label: '평온',
    color: colors.calm,
    source: require('../../assets/calm.png'),
    face: require('../../assets/faces/calm.png'),
  },
  neutral: {
    label: '보통',
    color: colors.neutral,
    source: require('../../assets/neutral.png'),
    face: require('../../assets/faces/neutral.png'),
  },
  sad: {
    label: '우울',
    color: colors.sad,
    source: require('../../assets/sad.png'),
    face: require('../../assets/faces/sad.png'),
  },
  angry: {
    label: '화남',
    color: colors.angry,
    source: require('../../assets/angry.png'),
    face: require('../../assets/faces/angry.png'),
  },
};
