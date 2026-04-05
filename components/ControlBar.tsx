import { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, sizing, timing } from '../constants/theme';

interface ControlBarProps {
  visible: boolean;
  onWindowsPress: () => void;
  onKeyboardPress: () => void;
}

function ControlButton({
  iconName,
  onPress,
}: {
  iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
}) {
  const borderColor = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: borderColor.value === 1 ? colors.primary : colors.controlBorder,
  }));

  const handlePress = useCallback(() => {
    borderColor.value = withSequence(
      withTiming(1, { duration: 0 }),
      withDelay(timing.buttonFlash, withTiming(0, { duration: 0 })),
    );
    onPress();
  }, [onPress, borderColor]);

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.button, animatedStyle]}>
        <MaterialCommunityIcons
          name={iconName}
          size={sizing.iconSize}
          color={colors.status}
        />
      </Animated.View>
    </Pressable>
  );
}

export function ControlBar({ visible, onWindowsPress, onKeyboardPress }: ControlBarProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: timing.opacityFade }),
  }));

  return (
    <>
      <Animated.View style={[styles.leftButton, animatedStyle]}>
        <ControlButton iconName="view-grid-outline" onPress={onWindowsPress} />
      </Animated.View>
      <Animated.View style={[styles.rightButton, animatedStyle]}>
        <ControlButton iconName="keyboard-outline" onPress={onKeyboardPress} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  leftButton: {
    position: 'absolute',
    bottom: 12,
    left: 12,
  },
  rightButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  button: {
    width: sizing.controlButton,
    height: sizing.controlButton,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
