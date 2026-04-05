import { useState } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { colors, typography, sizing } from '../constants/theme';

interface ConnectionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
}

export function ConnectionInput({ value, onChangeText, editable = true }: ConnectionInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      style={[
        styles.input,
        focused && styles.inputFocused,
      ]}
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder="0.0.0.0"
      placeholderTextColor={colors.status}
      keyboardType="numeric"
      cursorColor={colors.primary}
      selectionColor={colors.primary}
      autoCorrect={false}
      autoCapitalize="none"
      editable={editable}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: sizing.inputBorderRadius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: typography.ipInput.fontFamily,
    fontSize: typography.ipInput.fontSize,
    color: colors.status,
  },
  inputFocused: {
    color: colors.primary,
    borderColor: colors.primary,
  },
});
