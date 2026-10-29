import { Image, Pressable, View, type ImageSourcePropType } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { colors } from '@/theme/tokens';
import { AppText } from './Text';
import { Icon } from './Icon';

const tabs: Record<string, { label: string; icon?: ImageSourcePropType }> = {
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
  mypage: { label: '마이페이지' },
};

// Shared tab bar: equal columns, active tab in primary.
export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.paper,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 20),
        paddingHorizontal: 12,
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
              paddingVertical: 6,
              borderRadius: 18,
              backgroundColor: focused ? colors.peachPaper : 'transparent',
            }}
          >
            {tab.icon ? (
              <Image
                accessible={false}
                source={tab.icon}
                resizeMode="contain"
                style={{ width: 24, height: 24, tintColor: color }}
              />
            ) : (
              <Icon name="profile" size={24} color={color} />
            )}
            <AppText
              variant="caption"
              style={{
                color,
                textAlign: 'center',
                fontSize: 12,
                lineHeight: 18,
                maxWidth: '100%',
              }}
              numberOfLines={3}
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
