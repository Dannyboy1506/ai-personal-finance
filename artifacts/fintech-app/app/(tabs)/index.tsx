import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/FinanceContext';
import { TransactionCard } from '@/components/TransactionCard';
import { GoalCard } from '@/components/GoalCard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { runGeminiAudit } from '@/services/tier3Service';
import { formatCurrencyAbs } from '@/utils/currency';

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    isLoading,
    isOffline,
    syncQueue,
    getTotalBalance,
    getSpendableBalance,
    getLockedSavingsTotal,
    getMonthlyStats,
    getRecentTransactions,
    getCategoryById,
    categories,
    goals,
    getGoalPacing,
    confirmTransaction,
    accounts,
    drainSyncQueue,
    persistError,
    dismissPersistError,
    getPeriodSummary,
  } = useFinance();

  const [refreshing, setRefreshing] = useState(false);
  const [auditText, setAuditText] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const [showTotalBalance, setShowTotalBalance] = useState(false);
  const spendable = getSpendableBalance();
  const total = getTotalBalance();
  const locked = getLockedSavingsTotal();
  const balance = showTotalBalance ? total : spendable;
  const { income, expenses } = getMonthlyStats();
  const recentTxs = getRecentTransactions(7);
  const activeGoals = goals.filter((g) => !g.isDeleted);
  const pendingQueue = syncQueue.filter((s) => s.status === 'PENDING');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
  }, []);

  const handleGeminiAudit = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAuditLoading(true);
    setAuditText(null);
    try {
      const result = await runGeminiAudit(getPeriodSummary('WEEKLY'));
      setAuditText(result);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleAddTransaction = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add-transaction');
  };

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {isOffline && <OfflineBanner queuedCount={pendingQueue.length} onRetry={drainSyncQueue} />}

      {persistError && (
        <View style={[styles.persistBanner, { backgroundColor: colors.debit + '20', borderColor: colors.debit + '50' }]}>
          <Feather name="alert-circle" size={13} color={colors.debit} />
          <Text style={[styles.persistText, { color: colors.debit }]}>{persistError}</Text>
          <Pressable onPress={dismissPersistError} accessibilityRole="button" accessibilityLabel="Dismiss">
            <Feather name="x" size={16} color={colors.debit} />
          </Pressable>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding + 8, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              Good {getGreeting()}
            </Text>
            <Text style={[styles.appName, { color: colors.foreground }]}>
              My Wallet
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="settings" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <LinearGradient
          colors={['#0F2419', '#0D1117']}
          style={[styles.balanceCard, { borderColor: colors.primary + '30' }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
            {showTotalBalance ? 'TOTAL BALANCE (INCL. LOCKED)' : 'AVAILABLE BALANCE'}
          </Text>
          <Text style={[styles.balanceAmount, { color: colors.foreground }]}>
            {formatCurrencyAbs(balance)}
          </Text>
          {locked > 0 && (
            <TouchableOpacity
              onPress={() => setShowTotalBalance((v) => !v)}
              style={styles.lockedRow}
              hitSlop={6}
            >
              <Feather name="lock" size={11} color={colors.warning} />
              <Text style={[styles.lockedText, { color: colors.warning }]}>
                {formatCurrencyAbs(locked)} locked in savings — tap to {showTotalBalance ? 'hide' : 'show'} total
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.inOutRow}>
            <View style={[styles.inOutCard, { backgroundColor: colors.credit + '15', borderColor: colors.credit + '30' }]}>
              <Feather name="arrow-down-circle" size={16} color={colors.credit} />
              <View>
                <Text style={[styles.inOutLabel, { color: colors.mutedForeground }]}>Month In</Text>
                <Text style={[styles.inOutAmount, { color: colors.credit }]}>
                  +{formatCurrencyAbs(income)}
                </Text>
              </View>
            </View>
            <View style={[styles.inOutCard, { backgroundColor: colors.debit + '15', borderColor: colors.debit + '30' }]}>
              <Feather name="arrow-up-circle" size={16} color={colors.debit} />
              <View>
                <Text style={[styles.inOutLabel, { color: colors.mutedForeground }]}>Month Out</Text>
                <Text style={[styles.inOutAmount, { color: colors.debit }]}>
                  -{formatCurrencyAbs(expenses)}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Accounts chip row */}
        {accounts.filter((a) => !a.isDeleted).length === 0 && (
          <TouchableOpacity
            onPress={() => router.push('/add-account')}
            style={[styles.addAccountChip, { borderColor: colors.primary + '60', backgroundColor: colors.primary + '10' }]}
          >
            <Feather name="plus-circle" size={14} color={colors.primary} />
            <Text style={[styles.addAccountText, { color: colors.primary }]}>Add your first account</Text>
          </TouchableOpacity>
        )}

        {/* Gemini Audit */}
        {(auditText || auditLoading) && (
          <View style={[styles.auditCard, { backgroundColor: colors.card, borderColor: colors.primary + '30' }]}>
            <View style={styles.auditHeader}>
              <Feather name="cpu" size={14} color={colors.primary} />
              <Text style={[styles.auditTitle, { color: colors.primary }]}>AI Financial Audit</Text>
            </View>
            {auditLoading ? (
              <View style={styles.auditLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.auditLoadingText, { color: colors.mutedForeground }]}>
                  Analyzing your finances...
                </Text>
              </View>
            ) : (
              <Text style={[styles.auditBody, { color: colors.foreground }]}>{auditText}</Text>
            )}
          </View>
        )}

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active Goals</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/goals')}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.goalsScroll}
            >
              {activeGoals.map((g) => (
                <GoalCard key={g.id} goal={g} pacing={getGoalPacing(g)} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>

          {recentTxs.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: colors.border }]}>
              <Feather name="inbox" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No transactions yet</Text>
              <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                Tap the + button to log your first transaction
              </Text>
            </View>
          ) : (
            recentTxs.map((tx) => (
              <TransactionCard
                key={tx.id}
                transaction={tx}
                category={getCategoryById(tx.categoryId)}
                categories={categories}
                onConfirm={confirmTransaction}
                onPress={() => {}}
              />
            ))
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={handleGeminiAudit}
            disabled={auditLoading}
            style={[styles.auditBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
          >
            <Feather name="cpu" size={16} color={colors.primary} />
            <Text style={[styles.auditBtnText, { color: colors.primary }]}>
              {auditLoading ? 'Analyzing...' : 'Gemini Deep Audit'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={handleAddTransaction}
        style={[styles.fab, { backgroundColor: colors.primary, bottom: Platform.OS === 'web' ? 100 : insets.bottom + 80 }]}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color={colors.primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  persistBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  persistText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  root: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 18, gap: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  appName: { fontSize: 22, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  balanceCard: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    gap: 12,
  },
  balanceLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  balanceAmount: {
    fontSize: 38,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    letterSpacing: -1,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  lockedText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  inOutRow: { flexDirection: 'row', gap: 10 },
  inOutCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  inOutLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  inOutAmount: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  addAccountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  addAccountText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  seeAll: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  goalsScroll: { paddingVertical: 2 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  emptyBody: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 24 },
  actionRow: { gap: 10, paddingBottom: 8 },
  auditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  auditBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  auditCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  auditHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  auditTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  auditBody: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  auditLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  auditLoadingText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  fab: {
    position: 'absolute',
    right: 22,
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});
