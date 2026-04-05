import { Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { typography, timing } from '../constants/theme';

interface StreamOverlayProps {
  visible: boolean;
  fps: number;
  hostIp: string;
}

export function StreamOverlay({ visible, fps, hostIp }: StreamOverlayProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: timing.opacityFade }),
  }));

  return (
    <>
      <Animated.View style={[styles.fpsContainer, animatedStyle]} pointerEvents="none">
        <Text style={styles.fpsText}>{fps} FPS</Text>
      </Animated.View>
      <Animated.View style={[styles.hostContainer, animatedStyle]} pointerEvents="none">
        <Text style={styles.hostText}>{hostIp}</Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fpsContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  fpsText: {
    fontFamily: typography.fpsOverlay.fontFamily,
    fontSize: typography.fpsOverlay.fontSize,
    color: typography.fpsOverlay.color,
  },
  hostContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  hostText: {
    fontFamily: typography.hostOverlay.fontFamily,
    fontSize: typography.hostOverlay.fontSize,
    color: typography.hostOverlay.color,
  },
});
