import { Pressable, Text, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { colors, typography, sizing, timing } from '../constants/theme';
import { WindowInfo } from '../types';
import { WindowRow } from './WindowRow';

interface WindowSwitcherProps {
  visible: boolean;
  windows: WindowInfo[];
  onSelectWindow: (id: string) => void;
  onClose: () => void;
}

export function WindowSwitcher({ visible, windows, onSelectWindow, onClose }: WindowSwitcherProps) {
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

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.panel, { height: panelHeight }, panelStyle]}>
        <Text style={styles.header}>WINDOWS</Text>
        <FlatList
          data={windows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <WindowRow
              window={item}
              onPress={() => onSelectWindow(item.id)}
            />
          )}
        />
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
});
