import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import type { Budget, Category } from '@/context/FinanceContext';
import { formatCurrencyAbs } from '@/utils/currency';

interface BudgetCardProps {
  budget: Budget;
  category?: Category;
  spent: number;
}

export function BudgetCard({ budget, category, spent }: BudgetCardProps) {
  const colors = useColors();
  const ratio = budget.monthlyLimit > 0 ? Math.min(spent / budget.monthlyLimit, 1) : 0;
  const pct = Math.round(ratio * 100);

  const progressAnim = useSharedValue(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    progressAnim.value = withTiming(ratio, { duration: 800 });
  }, [ratio]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  const barColor =
    pct >= 90
      ? colors.debit
      : pct >= 70
      ? colors.warning
      : category?.color ?? colors.primary;

  const iconName = (category?.icon ?? 'circle') as keyof typeof Feather.glyphMap;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: (category?.color ?? colors.muted) + '22' },
          ]}
        >
          <Feather
            name={iconName}
            size={16}
            color={category?.color ?? colors.mutedForeground}
          />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.foreground }]}>
            {category?.name ?? 'Unknown'}
          </Text>
          <Text style={[styles.limit, { color: colors.mutedForeground }]}>
            {formatCurrencyAbs(spent)} / {formatCurrencyAbs(budget.monthlyLimit)}
          </Text>
        </View>
        <Text style={[styles.pct, { color: barColor }]}>{pct}%</Text>
      </View>

      {/* Bar */}
      <View style={[styles.track, { backgroundColor: colors.muted }]}>
        <Animated.View style={[styles.fill, barStyle, { backgroundColor: barColor }]} />
      </View>

      {pct >= 90 && (
        <View style={[styles.alertRow, { backgroundColor: colors.debit + '15' }]}>
          <Feather name="alert-circle" size={12} color={colors.debit} />
          <Text style={[styles.alertText, { color: colors.debit }]}>
            {pct >= 100 ? 'Budget exceeded' : 'Almost at limit'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  limit: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  pct: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  track: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  alertText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
});
