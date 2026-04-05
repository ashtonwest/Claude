import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, typography, sizing } from '../constants/theme';
import { WindowInfo } from '../types';

interface WindowRowProps {
  window: WindowInfo;
  onPress: () => void;
}

export function WindowRow({ window, onPress }: WindowRowProps) {
  return (
    <Pressable
      style={[styles.row, window.isActive && styles.rowActive]}
      onPress={onPress}
    >
      <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
        {window.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: sizing.windowRowHeight,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowBorder,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowActive: {
    borderLeftWidth: sizing.activeBorderWidth,
    borderLeftColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  title: {
    flex: 1,
    fontFamily: typography.windowTitle.fontFamily,
    fontSize: typography.windowTitle.fontSize,
    color: typography.windowTitle.color,
  },
});
