import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { useFinance, type RecurringRule } from '@/context/FinanceContext';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatNextRun(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function RuleRow({
  rule,
  categoryName,
  categoryColor,
  accountName,
  onToggle,
  onDelete,
}: {
  rule: RecurringRule;
  categoryName: string;
  categoryColor: string;
  accountName: string;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const isCredit = rule.type === 'CREDIT';

  return (
    <View style={[styles.ruleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.ruleTop}>
        <View style={styles.ruleInfo}>
          <Text style={[styles.ruleDesc, { color: colors.foreground }]} numberOfLines={1}>
            {rule.description}
          </Text>
          <Text style={[styles.ruleMeta, { color: colors.mutedForeground }]}>
            {categoryName} • {accountName} • {rule.frequency === 'WEEKLY' ? 'Weekly' : 'Monthly'}
          </Text>
        </View>
        <Text style={[styles.ruleAmount, { color: isCredit ? colors.credit : colors.debit }]}>
          {isCredit ? '+' : '-'}${rule.amount.toFixed(2)}
        </Text>
      </View>

      <View style={[styles.ruleBottom, { borderTopColor: colors.border }]}>
        <Text style={[styles.nextRun, { color: colors.mutedForeground }]}>
          Next: {rule.isActive ? formatNextRun(rule.nextRunDate) : 'Paused'}
        </Text>
        <View style={styles.ruleActions}>
          <Switch
            value={rule.isActive}
            onValueChange={onToggle}
            trackColor={{ false: colors.border, true: categoryColor + '80' }}
            thumbColor={rule.isActive ? categoryColor : colors.mutedForeground}
          />
          <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete recurring rule">
            <Feather name="trash-2" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function RecurringScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    recurringRules,
    categories,
    accounts,
    addRecurringRule,
    deleteRecurringRule,
    toggleRecurringRule,
    getCategoryById,
    getAccountById,
  } = useFinance();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const activeAccounts = accounts.filter((a) => !a.isDeleted);

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'CREDIT' | 'DEBIT'>('DEBIT');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('cat_general');
  const [accountId, setAccountId] = useState(activeAccounts[0]?.id ?? '');
  const [frequency, setFrequency] = useState<'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [dayOfWeek, setDayOfWeek] = useState(1);

  const relevantCategories = categories.filter((c) => (type === 'CREDIT' ? c.type === 'INCOME' : c.type === 'EXPENSE'));

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategoryId('cat_general');
    setFrequency('MONTHLY');
    setDayOfMonth('1');
    setDayOfWeek(1);
  };

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !description.trim() || !accountId) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    addRecurringRule({
      description: description.trim(),
      amount: amt,
      type,
      categoryId,
      accountId,
      frequency,
      ...(frequency === 'MONTHLY'
        ? { dayOfMonth: Math.min(Math.max(parseInt(dayOfMonth, 10) || 1, 1), 28) }
        : { dayOfWeek }),
    });

    resetForm();
    setShowForm(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.handle, { paddingTop: topPad + 8 }]}>
        <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Recurring</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {recurringRules.length === 0 && !showForm && (
          <View style={[styles.emptyState, { borderColor: colors.border }]}>
            <Feather name="repeat" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No recurring transactions yet. Add salary, subscriptions, or rent so they log automatically.
            </Text>
          </View>
        )}

        {recurringRules.map((rule) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            categoryName={getCategoryById(rule.categoryId)?.name ?? 'Unknown'}
            categoryColor={getCategoryById(rule.categoryId)?.color ?? colors.primary}
            accountName={getAccountById(rule.accountId)?.name ?? 'Unknown'}
            onToggle={() => toggleRecurringRule(rule.id)}
            onDelete={() => deleteRecurringRule(rule.id)}
          />
        ))}

        {!showForm ? (
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={[styles.addBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
          >
            <Feather name="plus-circle" size={16} color={colors.primary} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>Add recurring transaction</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Type toggle */}
            <View style={styles.typeToggle}>
              {(['DEBIT', 'CREDIT'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[
                    styles.typeBtn,
                    {
                      backgroundColor: type === t ? (t === 'CREDIT' ? colors.credit : colors.debit) + '20' : 'transparent',
                      borderColor: type === t ? (t === 'CREDIT' ? colors.credit : colors.debit) : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.typeBtnText, { color: type === t ? (t === 'CREDIT' ? colors.credit : colors.debit) : colors.mutedForeground }]}>
                    {t === 'CREDIT' ? 'Income' : 'Expense'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={type === 'CREDIT' ? 'Salary' : 'Netflix subscription'}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Amount</Text>
              <View style={[styles.amountRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.currency, { color: colors.mutedForeground }]}>$</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: colors.foreground }]}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
              <View style={styles.chips}>
                {relevantCategories.map((c) => {
                  const active = categoryId === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setCategoryId(c.id)}
                      style={[
                        styles.chip,
                        { backgroundColor: active ? c.color + '25' : colors.background, borderColor: active ? c.color : colors.border },
                      ]}
                    >
                      <Feather name={c.icon as keyof typeof Feather.glyphMap} size={12} color={active ? c.color : colors.mutedForeground} />
                      <Text style={[styles.chipText, { color: active ? c.color : colors.mutedForeground }]}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {activeAccounts.length > 1 && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Account</Text>
                <View style={styles.chips}>
                  {activeAccounts.map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() => setAccountId(a.id)}
                      style={[
                        styles.chip,
                        { backgroundColor: accountId === a.id ? colors.primary + '25' : colors.background, borderColor: accountId === a.id ? colors.primary : colors.border },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: accountId === a.id ? colors.primary : colors.mutedForeground }]}>{a.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Repeats</Text>
              <View style={styles.typeToggle}>
                {(['WEEKLY', 'MONTHLY'] as const).map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setFrequency(f)}
                    style={[
                      styles.typeBtn,
                      { backgroundColor: frequency === f ? colors.primary + '20' : 'transparent', borderColor: frequency === f ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={[styles.typeBtnText, { color: frequency === f ? colors.primary : colors.mutedForeground }]}>
                      {f === 'WEEKLY' ? 'Weekly' : 'Monthly'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {frequency === 'MONTHLY' ? (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Day of month</Text>
                <TextInput
                  value={dayOfMonth}
                  onChangeText={setDayOfMonth}
                  placeholder="1"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, width: 80 }]}
                />
                <Text style={[styles.hint, { color: colors.mutedForeground }]}>1–28, to keep every month valid</Text>
              </View>
            ) : (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Day of week</Text>
                <View style={styles.chips}>
                  {WEEKDAYS.map((d, i) => (
                    <Pressable
                      key={d}
                      onPress={() => setDayOfWeek(i)}
                      style={[
                        styles.chip,
                        { backgroundColor: dayOfWeek === i ? colors.primary + '25' : colors.background, borderColor: dayOfWeek === i ? colors.primary : colors.border },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: dayOfWeek === i ? colors.primary : colors.mutedForeground }]}>{d}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.formButtons}>
              <TouchableOpacity
                onPress={() => {
                  resetForm();
                  setShowForm(false);
                }}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAdd} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                <Feather name="check" size={16} color={colors.primaryForeground} />
                <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save rule</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  handle: { alignItems: 'center', paddingBottom: 8 },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  scroll: { padding: 18, gap: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  emptyState: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed' },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  ruleCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  ruleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 10 },
  ruleInfo: { flex: 1, gap: 3 },
  ruleDesc: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  ruleMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  ruleAmount: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  ruleBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  nextRun: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  ruleActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  addBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  formCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 14 },
  typeToggle: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  typeBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  input: { fontSize: 15, fontFamily: 'Inter_500Medium', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  amountRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  currency: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 20, fontFamily: 'Inter_700Bold', paddingVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  formButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', fontWeight: '700' },
});
