import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkServerHealth } from '../../shared/api/health';

type ConnectionState = 'idle' | 'checking' | 'connected' | 'error';

export function HomeScreen() {
  const [connection, setConnection] = useState<ConnectionState>('idle');
  const [message, setMessage] = useState(
    '서버를 실행한 뒤 연결을 확인해 보세요.',
  );
  const checking = useRef(false);

  async function handleCheckConnection() {
    if (checking.current) {
      return;
    }
    checking.current = true;
    setConnection('checking');
    setMessage('서버에 연결하고 있어요.');
    try {
      await checkServerHealth();
      setConnection('connected');
      setMessage('서버에 정상적으로 연결됐어요.');
    } catch (error) {
      setConnection('error');
      setMessage(
        error instanceof Error ? error.message : '서버 연결을 확인해 주세요.',
      );
    } finally {
      checking.current = false;
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Mozzi</Text>
        <Text style={styles.subtitle}>나의 하루를 기록하는 공간</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>개발 환경 확인</Text>
          <Text accessibilityLiveRegion="polite" style={styles.message}>
            {message}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: connection === 'checking' }}
            disabled={connection === 'checking'}
            onPress={handleCheckConnection}
            style={[
              styles.button,
              connection === 'checking' && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.buttonText}>
              {connection === 'checking' ? '확인 중…' : '서버 연결 확인'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#faf8f4' },
  content: { flex: 1, justifyContent: 'center', padding: 28, gap: 12 },
  title: { fontSize: 36, fontWeight: '700', color: '#2c3932' },
  subtitle: { fontSize: 16, color: '#626c65', marginBottom: 24 },
  card: { padding: 24, borderRadius: 20, backgroundColor: '#ffffff', gap: 16 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#2c3932' },
  message: { fontSize: 15, lineHeight: 23, color: '#626c65' },
  button: {
    minHeight: 48,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3d6b55',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
