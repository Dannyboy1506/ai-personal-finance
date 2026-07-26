import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useFinance, type AuditPeriod } from '@/context/FinanceContext';
import { BudgetCard } from '@/components/BudgetCard';
import { runGeminiAudit } from '@/services/tier3Service';
import { router } from 'expo-router';

const PERIODS: { key: AuditPeriod; label: string }[] = [
  { key: 'WEEKLY', label: 'Week' },
  { key: 'MONTHLY', label: 'Month' },
  { key: 'QUARTERLY', label: 'Quarter' },
  { key: 'HALF_YEARLY', label: 'Half-Year' },
  { key: 'YEARLY', label: 'Year' },
];

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    budgets,
    categories,
    getCategoryById,
    getBudgetSpent,
    getMonthlyStats,
    getPeriodSummary,
    transactions,
    addBudget,
  } = useFinance();

  const [period, setPeriod] = useState<AuditPeriod>('WEEKLY');
  const [auditText, setAuditText] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const { income, expenses } = getMonthlyStats();

  // Category spending breakdown
  const categorySpend = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const map: Record<string, number> = {};
    transactions
      .filter((t) => !t.isDeleted && t.type === 'DEBIT' && t.timestamp >= monthStart)
      .forEach((t) => {
        map[t.categoryId] = (map[t.categoryId] ?? 0) + t.amount;
      });
    return Object.entries(map)
      .map(([catId, amount]) => ({ catId, amount, cat: getCategoryById(catId) }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, getCategoryById]);

  const handleAudit = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAuditLoading(true);
    setAuditError(null);
    setAuditText(null);
    try {
      const result = await runGeminiAudit(getPeriodSummary(period));
      setAuditText(result);
    } catch {
      setAuditError('Failed to reach Gemini. Check your connection.');
    } finally {
      setAuditLoading(false);
    }
  };

  const handlePeriodChange = (next: AuditPeriod) => {
    if (next === period) return;
    setPeriod(next);
    setAuditText(null);
    setAuditError(null);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Insights</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Gemini Audit Section */}
        <View style={[styles.auditCard, { backgroundColor: colors.card, borderColor: colors.primary + '40' }]}>
          <View style={styles.auditHeader}>
            <View style={[styles.auditIcon, { backgroundColor: colors.primary + '20' }]}>
              <Feather name="cpu" size={20} color={colors.primary} />
            </View>
            <View style={styles.auditInfo}>
              <Text style={[styles.auditTitle, { color: colors.foreground }]}>Gemini Deep Audit</Text>
              <Text style={[styles.auditSub, { color: colors.mutedForeground }]}>
                {period === 'WEEKLY' ? 'Quick review · Gemini 2.5 Flash' : 'Deep review · Gemini 2.5 Pro'}
              </Text>
            </View>
          </View>

          <View style={styles.periodRow}>
            {PERIODS.map((p) => {
              const active = p.key === period;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => handlePeriodChange(p.key)}
                  style={[
                    styles.periodChip,
                    {
                      backgroundColor: active ? colors.primary + '20' : 'transparent',
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.periodChipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {auditLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                {period === 'WEEKLY' ? 'Analyzing spending patterns...' : 'Running a deeper analysis — this can take longer...'}
              </Text>
            </View>
          )}

          {auditText && !auditLoading && (
            <View style={[styles.auditResult, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
              <Text style={[styles.auditBody, { color: colors.foreground }]}>{auditText}</Text>
            </View>
          )}

          {auditError && !auditLoading && (
            <View style={[styles.auditError, { backgroundColor: colors.debit + '15', borderColor: colors.debit + '40' }]}>
              <Feather name="alert-circle" size={14} color={colors.debit} />
              <Text style={[styles.errorText, { color: colors.debit }]}>{auditError}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleAudit}
            disabled={auditLoading}
            style={[
              styles.auditBtn,
              {
                backgroundColor: auditLoading ? colors.muted : colors.primary,
                opacity: auditLoading ? 0.7 : 1,
              },
            ]}
          >
            <Feather
              name={auditLoading ? 'loader' : 'zap'}
              size={16}
              color={auditLoading ? colors.mutedForeground : colors.primaryForeground}
            />
            <Text
              style={[
                styles.auditBtnText,
                { color: auditLoading ? colors.mutedForeground : colors.primaryForeground },
              ]}
            >
              {auditLoading ? 'Analyzing...' : auditText ? 'Run Again' : 'Run Audit'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Monthly Overview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>This Month</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.credit + '40' }]}>
              <Feather name="arrow-down-circle" size={18} color={colors.credit} />
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Income</Text>
              <Text style={[styles.statValue, { color: colors.credit }]}>${income.toFixed(2)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.debit + '40' }]}>
              <Feather name="arrow-up-circle" size={18} color={colors.debit} />
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Expenses</Text>
              <Text style={[styles.statValue, { color: colors.debit }]}>${expenses.toFixed(2)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="bar-chart-2" size={18} color={colors.primary} />
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Net</Text>
              <Text style={[styles.statValue, { color: income - expenses >= 0 ? colors.credit : colors.debit }]}>
                {income - expenses >= 0 ? '+' : ''}${(income - expenses).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Spending by Category */}
        {categorySpend.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Spending Breakdown</Text>
            {categorySpend.slice(0, 6).map(({ catId, amount, cat }) => (
              <View
                key={catId}
                style={[styles.spendRow, { borderBottomColor: colors.border }]}
              >
                <View style={[styles.catDot, { backgroundColor: cat?.color ?? colors.muted }]} />
                <Text style={[styles.catName, { color: colors.foreground }]} numberOfLines={1}>
                  {cat?.name ?? 'Unknown'}
                </Text>
                {cat?.isRisk && (
                  <Feather name="alert-triangle" size={12} color={colors.warning} />
                )}
                <Text style={[styles.catAmount, { color: cat?.isRisk ? colors.riskDebit : colors.foreground }]}>
                  ${amount.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Budgets */}
        <View style={styles.section}>
          <View style={styles.budgetHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Budgets</Text>
            <TouchableOpacity
              onPress={() => router.push('/add-budget')}
              style={[styles.addChip, { borderColor: colors.primary + '50', backgroundColor: colors.primary + '10' }]}
            >
              <Feather name="plus" size={12} color={colors.primary} />
              <Text style={[styles.addChipText, { color: colors.primary }]}>Add</Text>
            </TouchableOpacity>
          </View>

          {budgets.length === 0 ? (
            <View style={[styles.emptyBudget, { borderColor: colors.border }]}>
              <Feather name="pie-chart" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No budgets set. Add one to track spending limits.
              </Text>
            </View>
          ) : (
            budgets.map((b) => (
              <BudgetCard
                key={b.id}
                budget={b}
                category={getCategoryById(b.categoryId)}
                spent={getBudgetSpent(b.categoryId)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  scroll: { padding: 18, gap: 20 },
  auditCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  auditHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  auditIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditInfo: { flex: 1 },
  auditTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  auditSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  periodChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  auditResult: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
  },
  auditBody: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  auditError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  auditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  auditBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 6,
    alignItems: 'center',
  },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 15, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  spendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  catAmount: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  addChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  emptyBudget: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 20 },
});
