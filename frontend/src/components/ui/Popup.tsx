import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { cozyColors as colors } from '@/theme/cozy';
import { useReducedMotion } from './Motion';

// 화면 가운데에 뜨는 팝업. 바깥을 누르거나 뒤로 가기로 닫는다.
// 안에서 스크롤하지 않는 내용만 담는다(크기는 부르는 쪽이 화면에 맞춘다).
export function Popup({
  visible,
  onClose,
  children,
  label,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  // 화면 읽기 프로그램에 알릴 팝업 이름.
  label: string;
}) {
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!visible) {
      shown.setValue(0);
      return;
    }
    Animated.timing(shown, {
      toValue: 1,
      duration: reduced ? 0 : 220,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, reduced, shown]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="팝업 닫기"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={label}
          style={[
            styles.card,
            {
              opacity: shown,
              transform: [
                {
                  scale: shown.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#342E2A73',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.paper,
    borderRadius: 28,
    padding: 18,
    gap: 14,
    boxShadow: '0 12px 32px rgba(74, 57, 55, 0.22)',
  },
});
