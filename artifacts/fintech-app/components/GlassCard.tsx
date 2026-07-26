import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  accentColor?: string;
  noPadding?: boolean;
}

/**
 * Glassmorphic surface card — the core building block for the dark obsidian UI.
 * Uses a translucent fill over the elevated background to simulate glass.
 */
export function GlassCard({ children, style, onPress, accentColor, noPadding }: GlassCardProps) {
  const colors = useColors();

  const cardStyle: ViewStyle[] = [
    styles.card,
    {
      backgroundColor: colors.card,
      borderColor: accentColor ? `${accentColor}40` : colors.border,
      borderRadius: 14,
    },
    noPadding ? {} : styles.padding,
    style ?? {},
  ];

  if (accentColor) {
    (cardStyle as ViewStyle[]).push({
      borderWidth: 1,
      shadowColor: accentColor,
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    } as ViewStyle);
  }

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={cardStyle}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  padding: {
    padding: 16,
  },
});
