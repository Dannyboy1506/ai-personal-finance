import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/FinanceContext';
import { parseLocally } from '@/services/tier1Engine';
import { parseWithOpenRouter } from '@/services/tier2Service';
import { isBackendConfigured } from '@/services/apiConfig';
import { formatCurrencyAbs } from '@/utils/currency';

type TxType = 'CREDIT' | 'DEBIT';

export default function AddTransactionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    categories,
    accounts,
    goals,
    budgets,
    addTransaction,
    addToSyncQueue,
    updateSyncItem,
    setOffline,
    learnKeyword,
    getBudgetSpent,
    getCategoryById,
  } = useFinance();

  const [fastText, setFastText] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TxType>('DEBIT');
  const [categoryId, setCategoryId] = useState('cat_general');
  const [accountId, setAccountId] = useState(accounts.find((a) => !a.isDeleted)?.id ?? '');
  const [linkedGoalId, setLinkedGoalId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiResult, setAiResult] = useState<{ tier: string; confidence: number } | null>(null);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [parsedTimestamp, setParsedTimestamp] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  // Tracks a sync-queue entry created by a failed Tier 2 call during fast-log,
  // so that if the user finishes this same transaction manually below, we can
  // mark that queue entry DONE instead of leaving it to be auto-drained later
  // into a duplicate transaction.
  const [pendingSyncId, setPendingSyncId] = useState<string | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const activeAccounts = accounts.filter((a) => !a.isDeleted);
  const activeGoals = goals.filter((g) => !g.isDeleted);
  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');
  const incomeCategories = categories.filter((c) => c.type === 'INCOME');

  const handleFastLog = async () => {
    if (!fastText.trim()) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessing(true);
    setParsedTimestamp(null);
    setParseNote(null);

    // Tier 1 — local, always runs first and never touches the network.
    const t1 = parseLocally(fastText, categories);

    if (!t1) {
      // No amount anywhere in the text — Tier 1 genuinely has nothing to
      // anchor a guess on, and without a number Tier 2 wouldn't either.
      // Ask for manual entry instead of pretending we parsed something.
      setDescription(fastText);
      setParseNote("Couldn't find an amount in that — enter the details below.");
      setShowManual(true);
      setProcessing(false);
      return;
    }

    // Always pre-fill with the Tier 1 result immediately. This is the
    // fix for "Parse with AI isn't working": the form now always ends up
    // with a real, editable draft — amount, direction, and a category
    // guess — rather than being left blank while waiting on a cloud call
    // that may have nowhere to go (no backend configured).
    if (t1.timestamp) setParsedTimestamp(t1.timestamp);
    setAmount(t1.amount.toString());
    setDescription(t1.description);
    setType(t1.type);
    setCategoryId(t1.categoryId);
    setAiResult({ tier: 'On-Device', confidence: t1.confidence });
    setShowManual(true);

    if (t1.confidence >= 0.7) {
      // Confident local match — done, no need to reach out to Tier 2.
      setProcessing(false);
      return;
    }

    // Low-confidence local guess (usually: no keyword matched a category).
    // The pre-filled draft above is already usable — Tier 2 is only tried
    // as a best-effort upgrade, and only if there's actually a backend to
    // call.
    if (!isBackendConfigured()) {
      setParseNote('Using an on-device guess — check the category below.');
      setProcessing(false);
      return;
    }

    try {
      const t2 = await parseWithOpenRouter(fastText, categories);
      if (t2) {
        setAmount(t2.amount.toString());
        setDescription(t2.description);
        setType(t2.type);
        setCategoryId(t2.categoryId);
        setAiResult({ tier: 'OpenRouter AI', confidence: t2.confidence });
        setParseNote(null);
        setOffline(false);
      } else {
        setOffline(true);
        const queued = addToSyncQueue({ rawInput: fastText, targetTier: 'TIER_2', status: 'PENDING', retryCount: 0 });
        setPendingSyncId(queued.id);
        setParseNote("Couldn't reach the cloud AI — using the on-device guess below. We'll retry that in the background.");
      }
    } catch {
      setOffline(true);
      const queued = addToSyncQueue({ rawInput: fastText, targetTier: 'TIER_2', status: 'PENDING', retryCount: 0 });
      setPendingSyncId(queued.id);
      setParseNote("Couldn't reach the cloud AI — using the on-device guess below. We'll retry that in the background.");
    }

    setProcessing(false);
  };

  const handleSave = async () => {
    if (saving) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !description.trim() || !accountId) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const confidence = aiResult?.confidence;
    const needsConfirmation = !!confidence && confidence < 0.7;
    const txTimestamp = parsedTimestamp ?? new Date().toISOString();
    const goalId = type === 'DEBIT' && linkedGoalId ? linkedGoalId : undefined;

    addTransaction({
      accountId,
      categoryId,
      amount: amt,
      type,
      description: description.trim(),
      timestamp: txTimestamp,
      processedBy: aiResult ? (aiResult.tier.startsWith('On-Device') ? 'ON_DEVICE' : 'OPENROUTER') : 'MANUAL',
      confidence,
      needsConfirmation,
      goalId,
    });

    // This exact input has now been saved by hand — close out its queue
    // entry (if any) so a later drain doesn't file it a second time.
    if (pendingSyncId) {
      updateSyncItem(pendingSyncId, { status: 'DONE' });
    }

    // Learn keyword for corrections
    if (fastText) {
      const words = fastText.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      words.forEach((w) => learnKeyword(w, categoryId));
    }

    // If this expense lands in an active budget or a linked goal, show a
    // brief confirmation with the updated numbers before closing — this is
    // what makes "logging a transaction updates the budget" visible in the
    // moment, instead of something that only shows up later on another
    // screen. Transactions with nothing to report close instantly, same as
    // before.
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const inCurrentMonth = txTimestamp >= monthStart;

    let banner: string | null = null;
    if (type === 'DEBIT' && inCurrentMonth) {
      const budget = budgets.find((b) => b.categoryId === categoryId);
      if (budget) {
        const spentAfter = getBudgetSpent(categoryId) + amt;
        const pct = budget.monthlyLimit > 0 ? Math.round((spentAfter / budget.monthlyLimit) * 100) : 0;
        const cat = getCategoryById(categoryId);
        banner = `Logged to ${cat?.name ?? 'your budget'} — ${formatCurrencyAbs(spentAfter)} of ${formatCurrencyAbs(budget.monthlyLimit)} used this month (${pct}%)`;
      }
    }
    if (goalId) {
      const goal = goals.find((g) => g.id === goalId);
      if (goal) {
        const newAmount = goal.currentAmount + amt;
        const goalLine = `${formatCurrencyAbs(newAmount)} of ${formatCurrencyAbs(goal.targetAmount)} saved toward "${goal.name}"`;
        banner = banner ? `${banner}\n${goalLine}` : goalLine;
      }
    }

    if (banner) {
      setSaving(true);
      setSuccessBanner(banner);
      setTimeout(() => router.back(), 1200);
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Handle bar */}
      <View style={[styles.handle, { paddingTop: topPad + 8 }]}>
        <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Log Transaction</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {successBanner && (
          <View style={[styles.successBanner, { backgroundColor: colors.credit + '15', borderColor: colors.credit + '40' }]}>
            <Feather name="check-circle" size={16} color={colors.credit} />
            <Text style={[styles.successBannerText, { color: colors.credit }]}>{successBanner}</Text>
          </View>
        )}

        {/* Fast Log */}
        <View style={[styles.fastLogCard, { backgroundColor: colors.card, borderColor: colors.primary + '40' }]}>
          <View style={styles.fastLogHeader}>
            <Feather name="zap" size={16} color={colors.primary} />
            <Text style={[styles.fastLogTitle, { color: colors.primary }]}>Fast Log</Text>
            <Text style={[styles.fastLogHint, { color: colors.mutedForeground }]}>
              — just describe the transaction
            </Text>
          </View>
          <TextInput
            value={fastText}
            onChangeText={setFastText}
            placeholder='e.g. "spent 15 on uber" or "salary received 1200"'
            placeholderTextColor={colors.mutedForeground}
            style={[styles.fastInput, { color: colors.foreground, borderColor: colors.border }]}
            returnKeyType="send"
            onSubmitEditing={handleFastLog}
            multiline={false}
          />
          <TouchableOpacity
            onPress={handleFastLog}
            disabled={!fastText.trim() || processing}
            style={[
              styles.parseBtn,
              {
                backgroundColor: fastText.trim() ? colors.primary : colors.muted,
                opacity: processing ? 0.7 : 1,
              },
            ]}
          >
            {processing ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="cpu" size={16} color={colors.primaryForeground} />
            )}
            <Text style={[styles.parseBtnText, { color: colors.primaryForeground }]}>
              {processing ? 'Analyzing...' : 'Parse with AI'}
            </Text>
          </TouchableOpacity>

          {aiResult && (
            <View style={[styles.aiResultRow, { backgroundColor: colors.elevated }]}>
              <Feather
                name={aiResult.confidence >= 0.7 ? 'check-circle' : 'alert-circle'}
                size={13}
                color={aiResult.confidence >= 0.7 ? colors.credit : colors.warning}
              />
              <Text style={[styles.aiResultText, { color: colors.mutedForeground }]}>
                {aiResult.tier} — {Math.round(aiResult.confidence * 100)}% confidence
              </Text>
            </View>
          )}

          {parseNote && (
            <View style={styles.parseNoteRow}>
              <Feather name="info" size={12} color={colors.mutedForeground} />
              <Text style={[styles.parseNoteText, { color: colors.mutedForeground }]}>{parseNote}</Text>
            </View>
          )}
        </View>

        {/* Or divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>manual entry</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Type toggle */}
        <View style={[styles.typeToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(['DEBIT', 'CREDIT'] as TxType[]).map((t) => {
            const active = type === t;
            const color = t === 'CREDIT' ? colors.credit : colors.debit;
            return (
              <Pressable
                key={t}
                onPress={() => {
                  setType(t);
                  setCategoryId(t === 'CREDIT' ? 'cat_income' : 'cat_general');
                }}
                style={[
                  styles.typeBtn,
                  active ? { backgroundColor: color + '25', borderColor: color } : { borderColor: 'transparent' },
                ]}
              >
                <Text style={[styles.typeBtnText, { color: active ? color : colors.mutedForeground }]}>
                  {t === 'CREDIT' ? 'Money In' : 'Expense'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Amount */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Amount</Text>
          <View style={[styles.amountRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.currency, { color: colors.mutedForeground }]}>₦</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[styles.amountInput, { color: type === 'CREDIT' ? colors.credit : colors.debit }]}
            />
          </View>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What was this for?"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textField, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
          />
        </View>

        {/* Account */}
        {activeAccounts.length > 1 && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {activeAccounts.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => setAccountId(a.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: accountId === a.id ? colors.primary + '25' : colors.card,
                      borderColor: accountId === a.id ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: accountId === a.id ? colors.primary : colors.mutedForeground }]}>
                    {a.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Category */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
          <View style={styles.categoryGrid}>
            {(type === 'CREDIT' ? incomeCategories : expenseCategories).map((c) => {
              const active = categoryId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: active ? c.color + '25' : colors.card,
                      borderColor: active ? c.color : colors.border,
                    },
                  ]}
                >
                  <Feather
                    name={c.icon as keyof typeof Feather.glyphMap}
                    size={13}
                    color={active ? c.color : colors.mutedForeground}
                  />
                  <Text style={[styles.catChipText, { color: active ? c.color : colors.mutedForeground }]}>
                    {c.name}
                  </Text>
                  {c.isRisk && (
                    <Feather name="alert-triangle" size={10} color={colors.warning} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Save toward a goal (optional, expenses only) */}
        {type === 'DEBIT' && activeGoals.length > 0 && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Save toward a goal (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Pressable
                onPress={() => setLinkedGoalId(null)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: linkedGoalId === null ? colors.primary + '25' : colors.card,
                    borderColor: linkedGoalId === null ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: linkedGoalId === null ? colors.primary : colors.mutedForeground }]}>
                  None
                </Text>
              </Pressable>
              {activeGoals.map((g) => {
                const active = linkedGoalId === g.id;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => setLinkedGoalId(g.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary + '25' : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Feather name="target" size={12} color={active ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                      {g.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
        >
          <Feather name={saving ? 'check' : 'check'} size={18} color={colors.primaryForeground} />
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
            {saving ? 'Saved' : 'Save Transaction'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  handle: { alignItems: 'center', paddingBottom: 8 },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  scroll: { padding: 18, gap: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  screenTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  successBannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  fastLogCard: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  fastLogHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fastLogTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  fastLogHint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  fastInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  parseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  parseBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  aiResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  aiResultText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  parseNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 2,
  },
  parseNoteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5 },
  typeToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 4,
    gap: 4,
  },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  typeBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium', fontWeight: '500' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  currency: { fontSize: 22, fontFamily: 'Inter_600SemiBold', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 28, fontFamily: 'Inter_700Bold', paddingVertical: 12 },
  textField: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  catChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', fontWeight: '700' },
});
