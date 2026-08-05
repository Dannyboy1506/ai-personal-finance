import React, { useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/FinanceContext';
import { DatePickerModal } from '@/components/DatePickerModal';
import { CURRENCY_SYMBOL, formatCurrencyAbs } from '@/utils/currency';

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function AddGoalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { goals, addGoal, updateGoal, deleteGoal } = useFinance();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const isEditing = !!id;
  const existing = id ? goals.find((g) => g.id === id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [targetAmount, setTargetAmount] = useState(existing ? String(existing.targetAmount) : '');
  const [targetDate, setTargetDate] = useState(existing?.targetDate ?? '');
  const [currentAmount, setCurrentAmount] = useState(existing ? String(existing.currentAmount) : '');
  const [isLocked, setIsLocked] = useState(existing?.isLocked ?? false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState('');
  const [addFundsAmount, setAddFundsAmount] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // Opened with an id that no longer exists (deleted elsewhere, stale
  // link) — show a clear dead end instead of a half-broken form.
  if (isEditing && !existing) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.handle, { paddingTop: topPad + 8 }]}>
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
        </View>
        <View style={styles.notFound}>
          <Feather name="alert-circle" size={28} color={colors.mutedForeground} />
          <Text style={[styles.notFoundText, { color: colors.foreground }]}>This goal no longer exists.</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
          >
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleAddFunds = async () => {
    if (!existing) return;
    const add = parseFloat(addFundsAmount);
    if (!add || add <= 0) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newAmount = existing.currentAmount + add;
    updateGoal(existing.id, { currentAmount: newAmount });
    setCurrentAmount(String(newAmount));
    setAddFundsAmount('');
  };

  const handleSave = async () => {
    const target = parseFloat(targetAmount);
    const current = parseFloat(currentAmount) || 0;

    if (!name.trim()) { setError('Please enter a goal name'); return; }
    if (!target || target <= 0) { setError('Please enter a valid target amount'); return; }
    if (!targetDate) { setError('Please pick a target date'); return; }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isEditing && existing) {
      updateGoal(existing.id, {
        name: name.trim(),
        targetAmount: target,
        currentAmount: current,
        targetDate,
        isLocked,
      });
    } else {
      addGoal({
        name: name.trim(),
        targetAmount: target,
        currentAmount: current,
        targetDate,
        isLocked,
      });
    }

    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert(
      'Delete this goal?',
      `"${existing.name}" will be removed. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            deleteGoal(existing.id);
            router.back();
          },
        },
      ],
    );
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
          <Text style={[styles.title, { color: colors.foreground }]}>{isEditing ? 'Edit Goal' : 'New Goal'}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Quick add funds — edit mode only. This is the fast path for
            "I saved more toward this goal" without having to touch the
            full edit form below. */}
        {isEditing && existing && (
          <View style={[styles.addFundsCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '40' }]}>
            <Text style={[styles.addFundsTitle, { color: colors.primary }]}>Add funds to this goal</Text>
            <Text style={[styles.addFundsSubtitle, { color: colors.mutedForeground }]}>
              Currently saved: {formatCurrencyAbs(existing.currentAmount)} of {formatCurrencyAbs(existing.targetAmount)}
            </Text>
            <View style={styles.addFundsRow}>
              <View style={[styles.amountRow, styles.addFundsInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.currency, { color: colors.mutedForeground }]}>{CURRENCY_SYMBOL}</Text>
                <TextInput
                  value={addFundsAmount}
                  onChangeText={setAddFundsAmount}
                  placeholder="Amount"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  style={[styles.amountInput, styles.addFundsInput, { color: colors.credit }]}
                />
              </View>
              <TouchableOpacity
                onPress={handleAddFunds}
                disabled={!addFundsAmount.trim()}
                style={[styles.addFundsBtn, { backgroundColor: addFundsAmount.trim() ? colors.primary : colors.muted }]}
              >
                <Feather name="plus" size={16} color={colors.primaryForeground} />
                <Text style={[styles.addFundsBtnText, { color: colors.primaryForeground }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Name */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Goal Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder='e.g. "Emergency Fund" or "Lagos Trip"'
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
          />
        </View>

        {/* Target Amount */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Target Amount</Text>
          <View style={[styles.amountRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.currency, { color: colors.mutedForeground }]}>{CURRENCY_SYMBOL}</Text>
            <TextInput
              value={targetAmount}
              onChangeText={setTargetAmount}
              placeholder="500,000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[styles.amountInput, { color: colors.credit }]}
            />
          </View>
        </View>

        {/* Current Amount */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            {isEditing ? 'Current Amount (edit to correct a mistake)' : 'Current Amount (optional)'}
          </Text>
          <View style={[styles.amountRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.currency, { color: colors.mutedForeground }]}>{CURRENCY_SYMBOL}</Text>
            <TextInput
              value={currentAmount}
              onChangeText={setCurrentAmount}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[styles.amountInput, { color: colors.foreground }]}
            />
          </View>
        </View>

        {/* Target Date — a calendar picker, not free text */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Target Date</Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={[styles.input, styles.dateRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={{ color: targetDate ? colors.foreground : colors.mutedForeground, fontSize: 15, fontFamily: 'Inter_400Regular' }}>
              {targetDate ? formatDateLabel(targetDate) : 'Select a date'}
            </Text>
            <Feather name="calendar" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Locked savings toggle */}
        <View style={[styles.lockCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.lockRow}>
            <View style={styles.lockTextGroup}>
              <Text style={[styles.lockTitle, { color: colors.foreground }]}>Lock this savings</Text>
              <Text style={[styles.lockSubtitle, { color: colors.mutedForeground }]}>
                Money set aside here won't count toward your available balance on the dashboard — only your total balance, if you choose to view it.
              </Text>
            </View>
            <Switch
              value={isLocked}
              onValueChange={setIsLocked}
              trackColor={{ false: colors.border, true: colors.warning + '80' }}
              thumbColor={isLocked ? colors.warning : colors.mutedForeground}
            />
          </View>
        </View>

        {error ? (
          <View style={[styles.errorRow, { backgroundColor: colors.debit + '15', borderColor: colors.debit + '40' }]}>
            <Feather name="alert-circle" size={14} color={colors.debit} />
            <Text style={[styles.errorText, { color: colors.debit }]}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name={isEditing ? 'check' : 'target'} size={18} color={colors.primaryForeground} />
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
            {isEditing ? 'Save Changes' : 'Create Goal'}
          </Text>
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity onPress={handleDelete} style={[styles.deleteBtn, { borderColor: colors.debit + '50' }]}>
            <Feather name="trash-2" size={16} color={colors.debit} />
            <Text style={[styles.deleteBtnText, { color: colors.debit }]}>Delete Goal</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <DatePickerModal
        visible={showDatePicker}
        value={targetDate || undefined}
        minDate={new Date()}
        onSelect={setTargetDate}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  handle: { alignItems: 'center', paddingBottom: 8 },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  scroll: { padding: 18, gap: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  notFoundText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  addFundsCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  addFundsTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  addFundsSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  addFundsRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  addFundsInputWrap: { flex: 1 },
  addFundsInput: { fontSize: 18, paddingVertical: 10 },
  addFundsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center' },
  addFundsBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  currency: { fontSize: 20, fontFamily: 'Inter_600SemiBold', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 24, fontFamily: 'Inter_700Bold', paddingVertical: 12 },
  lockCard: { borderRadius: 14, borderWidth: 1, padding: 16 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  lockTextGroup: { flex: 1, gap: 4 },
  lockTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  lockSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
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
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  deleteBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
});
