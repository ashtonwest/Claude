import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography } from '../constants/theme';
import { ConnectionInput } from '../components/ConnectionInput';
import { ConnectButton } from '../components/ConnectButton';
import { ConnectionStatus } from '../types';

export default function ConnectionScreen() {
  const router = useRouter();
  const [ipAddress, setIpAddress] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const handleConnect = useCallback(() => {
    const trimmed = ipAddress.trim();
    if (!trimmed) {
      setErrorMessage('ENTER AN IP ADDRESS');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setErrorMessage(null);

    const ws = new WebSocket(`ws://${trimmed}:8080`);
    wsRef.current = ws;

    const timeout = setTimeout(() => {
      ws.close();
      setStatus('error');
      setErrorMessage('CONNECTION TIMEOUT');
    }, 5000);

    ws.onopen = () => {
      clearTimeout(timeout);
      ws.close();
      setStatus('connected');
      router.push({ pathname: '/stream', params: { ip: trimmed } });
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      setStatus('error');
      setErrorMessage('CONNECTION FAILED');
    };
  }, [ipAddress, router]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>SNOOPSCREEN</Text>
        <View style={styles.rule} />
        <ConnectionInput
          value={ipAddress}
          onChangeText={setIpAddress}
          editable={status !== 'connecting'}
        />
        <View style={styles.statusRow}>
          <Text style={[
            styles.statusText,
            status === 'error' && styles.statusError,
          ]}>
            {errorMessage ?? 'READY'}
          </Text>
        </View>
        <ConnectButton
          onPress={handleConnect}
          isConnecting={status === 'connecting'}
          disabled={status === 'connecting'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  brand: {
    fontFamily: typography.brandTitle.fontFamily,
    fontSize: typography.brandTitle.fontSize,
    textTransform: typography.brandTitle.textTransform,
    letterSpacing: typography.brandTitle.letterSpacing,
    color: typography.brandTitle.color,
  },
  rule: {
    width: '100%',
    height: 1,
    backgroundColor: colors.rule,
    marginVertical: 24,
  },
  statusRow: {
    width: '100%',
    paddingVertical: 12,
  },
  statusText: {
    fontFamily: typography.status.fontFamily,
    fontSize: typography.status.fontSize,
    color: typography.status.color,
  },
  statusError: {
    color: colors.error,
  },
});
