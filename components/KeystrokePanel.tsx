import { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { colors, typography, sizing, timing } from '../constants/theme';

interface KeystrokePanelProps {
  visible: boolean;
  onSend: (key: string) => void;
  onClose: () => void;
}

export function KeystrokePanel({ visible, onSend, onClose }: KeystrokePanelProps) {
  const [text, setText] = useState('');
  const { height: screenHeight } = useWindowDimensions();
  const panelHeight = screenHeight * sizing.panelHeightPercent;

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: withTiming(visible ? 0 : panelHeight, {
        duration: timing.panelSlide,
        easing: Easing.out(Easing.ease),
      }),
    }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: timing.opacityFade }),
    pointerEvents: visible ? 'auto' as const : 'none' as const,
  }));

  const handleSend = () => {
    if (text.length === 0) return;
    onSend(text);
    setText('');
  };

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.panel, { height: panelHeight }, panelStyle]}>
        <Text style={styles.header}>KEYSTROKES</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="TYPE HERE"
            placeholderTextColor={colors.status}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={({ pressed }) => [styles.sendButton, pressed && styles.sendPressed]}
            onPress={handleSend}
          >
            <Text style={styles.sendText}>SEND</Text>
          </Pressable>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.panelBg,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  header: {
    fontFamily: typography.panelHeader.fontFamily,
    fontSize: typography.panelHeader.fontSize,
    textTransform: typography.panelHeader.textTransform,
    letterSpacing: typography.panelHeader.letterSpacing,
    color: typography.panelHeader.color,
    padding: 16,
  },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: sizing.inputBorderRadius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: typography.ipInput.fontFamily,
    fontSize: 14,
    color: colors.primary,
  },
  sendButton: {
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primaryDim,
    borderRadius: 0,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendPressed: {
    opacity: 0.8,
  },
  sendText: {
    fontFamily: typography.connectButton.fontFamily,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 3,
    color: colors.primary,
  },
});
