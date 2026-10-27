import { Image, Pressable, View, type ImageSourcePropType } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { colors } from '@/theme/tokens';
import { AppText } from './Text';

const tabs: Record<string, { label: string; icon: ImageSourcePropType }> = {
  home: { label: '홈', icon: require('../../../assets/gacha/tab-home.png') },
  calendar: {
    label: '캘린더',
    icon: require('../../../assets/gacha/tab-calendar.png'),
  },
  search: {
    label: '감정 검색',
    icon: require('../../../assets/gacha/tab-search.png'),
  },
  gacha: {
    label: '뽑기',
    icon: require('../../../assets/gacha/tab-gacha-jar.png'),
  },
};

// Figma "Mozzi / Tab bar" (05 · P-01 instance): 4 equal columns, active tab in primary.
export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 20),
        paddingHorizontal: 20,
      }}
    >
      {state.routes.map((route, index) => {
        const tab = tabs[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const color = focused ? colors.primary : colors.muted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              if (!focused) navigateToTab(route.key);
            }}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <Image
              accessible={false}
              source={tab.icon}
              resizeMode="contain"
              style={{ width: 24, height: 24, tintColor: color }}
            />
            <AppText variant="caption" style={{ color }}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
