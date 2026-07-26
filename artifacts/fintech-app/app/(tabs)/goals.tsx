import React from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/FinanceContext';
import type { Goal } from '@/context/FinanceContext';

function daysRemaining(targetDate: string): number {
  return Math.max(0, Math.ceil((new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function GoalRow({ goal, pacing }: { goal: Goal; pacing: 'on-track' | 'behind' | 'at-risk' }) {
  const colors = useColors();
  const progress = Math.min(goal.currentAmount / goal.targetAmount, 1);
  const pct = Math.round(progress * 100);
  const days = daysRemaining(goal.targetDate);

  const pacingColors = {
    'on-track': colors.onTrack,
    'behind': colors.behindPace,
    'at-risk': colors.atRisk,
  };
  const pacingIcons = {
    'on-track': 'check-circle' as const,
    'behind': 'clock' as const,
    'at-risk': 'alert-circle' as const,
  };
  const pacingLabels = { 'on-track': 'On track', behind: 'Behind pace', 'at-risk': 'At risk' };
  const pc = pacingColors[pacing];

  return (
    <View style={[styles.goalRow, { backgroundColor: colors.card, borderColor: pc + '40' }]}>
      <View style={styles.goalHeader}>
        <Text style={[styles.goalName, { color: colors.foreground }]}>{goal.name}</Text>
        <View style={[styles.pacingBadge, { backgroundColor: pc + '20' }]}>
          <Feather name={pacingIcons[pacing]} size={12} color={pc} />
          <Text style={[styles.pacingText, { color: pc }]}>{pacingLabels[pacing]}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.track, { backgroundColor: colors.muted }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: pc }]} />
      </View>

      <View style={styles.goalFooter}>
        <Text style={[styles.amounts, { color: colors.foreground }]}>
          <Text style={{ color: pc }}>${goal.currentAmount.toLocaleString()}</Text>
          <Text style={{ color: colors.mutedForeground }}> / ${goal.targetAmount.toLocaleString()}</Text>
        </Text>
        <View style={styles.daysRow}>
          <Feather name="calendar" size={12} color={colors.mutedForeground} />
          <Text style={[styles.daysText, { color: colors.mutedForeground }]}>
            {days > 0 ? `${days} days left` : 'Deadline passed'}
          </Text>
        </View>
      </View>

      {/* Required daily rate */}
      {days > 0 && goal.currentAmount < goal.targetAmount && (
        <View style={[styles.rateRow, { backgroundColor: colors.muted }]}>
          <Feather name="trending-up" size={12} color={colors.mutedForeground} />
          <Text style={[styles.rateText, { color: colors.mutedForeground }]}>
            Need ${(((goal.targetAmount - goal.currentAmount) / days)).toFixed(2)}/day to reach goal
          </Text>
        </View>
      )}
    </View>
  );
}

export default function GoalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { goals, getGoalPacing, deleteGoal } = useFinance();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const activeGoals = goals.filter((g) => !g.isDeleted);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Goals</Text>
        <TouchableOpacity
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/add-goal');
          }}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeGoals}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <GoalRow goal={item} pacing={getGoalPacing(item)} />
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Feather name="target" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No savings goals yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Set a goal to track your progress and stay motivated
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/add-goal')}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Create First Goal</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad + 100, flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 18, paddingTop: 14, gap: 12 },
  goalRow: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', fontWeight: '600', flex: 1 },
  pacingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pacingText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amounts: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  daysText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  rateText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 10,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  emptyBody: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 24 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 6 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
});
