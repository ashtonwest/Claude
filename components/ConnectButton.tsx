import { useEffect, useState } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, typography, timing } from '../constants/theme';

interface ConnectButtonProps {
  onPress: () => void;
  isConnecting: boolean;
  disabled?: boolean;
}

export function ConnectButton({ onPress, isConnecting, disabled }: ConnectButtonProps) {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    if (!isConnecting) {
      setDots('.');
      return;
    }
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '.' : prev + '.'));
    }, timing.dotCycle);
    return () => clearInterval(interval);
  }, [isConnecting]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || isConnecting}
    >
      <Text style={styles.text}>
        {isConnecting ? dots : 'CONNECT'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primaryDim,
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  text: {
    fontFamily: typography.connectButton.fontFamily,
    fontSize: typography.connectButton.fontSize,
    textTransform: typography.connectButton.textTransform,
    letterSpacing: typography.connectButton.letterSpacing,
    color: colors.primary,
  },
});
