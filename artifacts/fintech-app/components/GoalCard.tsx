import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import type { Goal, GoalPacing } from '@/context/FinanceContext';
import { formatCurrencyAbs } from '@/utils/currency';

interface GoalCardProps {
  goal: Goal;
  pacing: GoalPacing;
}

const PACING_CONFIG = {
  'on-track': { label: 'On track', icon: 'check-circle' as const, colorKey: 'onTrack' as const },
  'behind': { label: 'Behind pace', icon: 'clock' as const, colorKey: 'behindPace' as const },
  'at-risk': { label: 'At risk', icon: 'alert-circle' as const, colorKey: 'atRisk' as const },
};

function daysRemaining(targetDate: string): number {
  const diff = new Date(targetDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function GoalCard({ goal, pacing }: GoalCardProps) {
  const colors = useColors();
  const config = PACING_CONFIG[pacing];
  const pacingColor = colors[config.colorKey];
  const progress = Math.min(goal.currentAmount / goal.targetAmount, 1);
  const progressAnim = useSharedValue(0);
  const days = daysRemaining(goal.targetDate);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    progressAnim.value = withTiming(progress, { duration: 900 });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: pacingColor + '40',
          borderWidth: 1,
        },
      ]}
    >
      {/* Name + pacing */}
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {goal.name}
        </Text>
        <View style={[styles.pacingBadge, { backgroundColor: pacingColor + '20' }]}>
          <Feather name={config.icon} size={11} color={pacingColor} />
          <Text style={[styles.pacingLabel, { color: pacingColor }]}>{config.label}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.track, { backgroundColor: colors.muted }]}>
        <Animated.View
          style={[styles.fill, barStyle, { backgroundColor: pacingColor }]}
        />
      </View>

      {/* Amounts + days */}
      <View style={styles.footer}>
        <Text style={[styles.amounts, { color: colors.foreground }]}>
          <Text style={{ color: pacingColor }}>{formatCurrencyAbs(goal.currentAmount)}</Text>
          <Text style={{ color: colors.mutedForeground }}>
            {' / '}{formatCurrencyAbs(goal.targetAmount)}
          </Text>
        </Text>
        <Text style={[styles.days, { color: colors.mutedForeground }]}>
          {days > 0 ? `${days}d left` : 'Deadline passed'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginRight: 12,
  },
  header: {
    gap: 6,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  pacingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pacingLabel: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amounts: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  days: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
});
