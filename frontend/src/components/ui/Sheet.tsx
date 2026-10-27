import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import { AppText } from './Text';
import { Button, TextButton } from './Button';

export function Sheet({
  visible,
  onClose,
  children,
  title,
  eyebrow,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title: string;
  eyebrow?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="모달 닫기"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}
        >
          <View style={styles.handle} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16 }}
          >
            {eyebrow && (
              <AppText variant="small" style={{ textAlign: 'center' }}>
                {eyebrow}
              </AppText>
            )}
            <AppText
              variant="heading"
              accessibilityRole="header"
              style={{ textAlign: 'center' }}
            >
              {title}
            </AppText>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <AppText style={{ textAlign: 'center', color: colors.muted }}>
        {description}
      </AppText>
      <Button label={confirmLabel} onPress={onConfirm} />
      <TextButton label="취소" onPress={onClose} />
    </Sheet>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#342E2A66',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    width: '100%',
    maxWidth: 600,
    maxHeight: '85%',
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 16,
  },
  handle: {
    height: 4,
    width: 40,
    borderRadius: 2,
    backgroundColor: colors.line,
    alignSelf: 'center',
  },
});
