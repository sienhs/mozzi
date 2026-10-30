import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme/tokens';
import { cozyColors } from '@/theme/cozy';
import { Icon, type IconName } from './Icon';
import { AppText } from './Text';

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}
export function ScreenHeader({
  title = '',
  titleContent,
  back,
  onBack = goBack,
  action,
  onTitleLongPress,
  appearance,
}: {
  title?: string;
  titleContent?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  action?: { icon: IconName; label: string; onPress: () => void };
  onTitleLongPress?: () => void;
  appearance?: 'cozy';
}) {
  return (
    <View style={styles.header}>
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={onBack}
          style={styles.leading}
        >
          <Icon name="back" />
        </Pressable>
      )}
      <Pressable
        disabled={!onTitleLongPress}
        onLongPress={onTitleLongPress}
        style={{ flex: 1 }}
      >
        {titleContent ?? (
          <AppText
            variant="heading"
            style={appearance === 'cozy' && { color: cozyColors.ink }}
          >
            {title}
          </AppText>
        )}
      </Pressable>
      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={styles.trailing}
        >
          <Icon name={action.icon} />
        </Pressable>
      )}
    </View>
  );
}
export function Screen({
  children,
  title,
  titleContent,
  back,
  onBack,
  action,
  footer,
  header = true,
  contentStyle,
  onTitleLongPress,
  tabbed = false,
  scrollable = true,
  appearance,
}: {
  children: ReactNode;
  footer?: ReactNode;
  header?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  // Inside the tab navigator the tab bar already owns the bottom inset.
  tabbed?: boolean;
  // A virtualized list must own its scroll area instead of nesting in ScrollView.
  scrollable?: boolean;
} & Parameters<typeof ScreenHeader>[0]) {
  const insets = useSafeAreaInsets();
  const bottomInset = tabbed ? 0 : insets.bottom;
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[
        styles.safe,
        appearance === 'cozy' && { backgroundColor: cozyColors.bg },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.frame}
      >
        {header && (
          <ScreenHeader
            title={title}
            titleContent={titleContent}
            back={back}
            onBack={onBack}
            action={action}
            onTitleLongPress={onTitleLongPress}
            appearance={appearance}
          />
        )}
        {scrollable ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.content,
              !footer && { paddingBottom: Math.max(bottomInset, 24) },
              contentStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
        )}
        {footer && (
          <View
            style={[
              styles.footer,
              appearance === 'cozy' && {
                backgroundColor: cozyColors.bg,
                borderTopColor: cozyColors.line,
              },
              {
                paddingBottom: tabbed
                  ? 16
                  : Platform.OS === 'web'
                    ? 34
                    : Math.max(insets.bottom, 16),
              },
            ]}
          >
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Heading({
  title,
  titleStyle,
  description,
  eyebrow,
  display,
}: {
  title: string;
  titleStyle?: StyleProp<TextStyle>;
  description?: string;
  eyebrow?: string;
  display?: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      {eyebrow && (
        <AppText variant="caption" style={{ color: colors.primary }}>
          {eyebrow}
        </AppText>
      )}
      <AppText
        variant={display ? 'display' : 'title'}
        style={titleStyle}
        accessibilityRole="header"
      >
        {title}
      </AppText>
      {description && (
        <AppText style={{ color: colors.muted }}>{description}</AppText>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingTop: Platform.OS === 'web' ? 44 : 0,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: spacing.page,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  leading: { width: 48, height: 48, justifyContent: 'center' },
  trailing: {
    width: 48,
    height: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    paddingBottom: spacing.page,
    gap: spacing.section,
  },
  footer: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
});
