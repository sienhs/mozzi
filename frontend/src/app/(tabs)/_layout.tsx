import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '@/components/ui/TabBar';
import { colors } from '@/theme/tokens';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={props => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="gacha" />
    </Tabs>
  );
}
