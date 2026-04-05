import { Pressable, Text, View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, typography, timing } from '../constants/theme';

interface DisconnectDialogProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DisconnectDialog({ visible, onConfirm, onCancel }: DisconnectDialogProps) {
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: timing.opacityFade }),
    pointerEvents: visible ? 'auto' as const : 'none' as const,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: timing.opacityFade }),
  }));

  return (
    <Animated.View style={[styles.backdrop, backdropStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <Animated.View style={[styles.card, cardStyle]}>
        <Text style={styles.title}>DISCONNECT?</Text>
        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={onCancel}
          >
            <Text style={styles.cancelText}>CANCEL</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={onConfirm}
          >
            <Text style={styles.disconnectText}>DISCONNECT</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 0,
    padding: 24,
    minWidth: 240,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.windowTitle.fontFamily,
    fontSize: 13,
    color: colors.windowTitle,
    textTransform: 'uppercase',
    letterSpacing: 5.2,
    marginBottom: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  cancelText: {
    fontFamily: typography.status.fontFamily,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 4,
    color: colors.status,
  },
  disconnectText: {
    fontFamily: typography.status.fontFamily,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 4,
    color: colors.error,
  },
});
