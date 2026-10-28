import { Image } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { colors } from '@/theme/tokens';

const icons = {
  back: require('../../../assets/figma/back.png'),
  close: require('../../../assets/figma/close.png'),
  chevronRight: require('../../../assets/figma/chevron-right.png'),
  settings: require('../../../assets/figma/settings.png'),
  share: require('../../../assets/figma/share.png'),
  refresh: require('../../../assets/figma/refresh.png'),
  send: require('../../../assets/figma/send.png'),
  pencil: require('../../../assets/figma/pencil.png'),
  google: require('../../../assets/figma/google.png'),
};
export type IconName = keyof typeof icons | 'profile';
export function Icon({
  name,
  size = 24,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  if (name === 'profile') return <UserRound size={size} color={color} />;
  return (
    <Image
      accessible={false}
      source={icons[name]}
      resizeMode="contain"
      style={{
        width: size,
        height: size,
        ...(name === 'google' ? {} : { tintColor: color }),
      }}
    />
  );
}
