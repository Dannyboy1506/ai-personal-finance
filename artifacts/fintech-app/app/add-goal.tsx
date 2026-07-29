import React, { useState } from 'react';
import {
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
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/FinanceContext';
import { DatePickerModal } from '@/components/DatePickerModal';
import { CURRENCY_SYMBOL } from '@/utils/currency';

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function AddGoalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addGoal } = useFinance();

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState(''); // ISO string once picked
  const [currentAmount, setCurrentAmount] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleSave = async () => {
    const target = parseFloat(targetAmount);
    const current = parseFloat(currentAmount) || 0;

    if (!name.trim()) { setError('Please enter a goal name'); return; }
    if (!target || target <= 0) { setError('Please enter a valid target amount'); return; }
    if (!targetDate) { setError('Please pick a target date'); return; }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    addGoal({
      name: name.trim(),
      targetAmount: target,
      currentAmount: current,
      targetDate,
      isLocked,
    });

    router.back();
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
          <Text style={[styles.title, { color: colors.foreground }]}>New Goal</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

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
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Current Amount (optional)</Text>
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

        {/* Target Date — now a calendar picker, not free text */}
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
          <Feather name="target" size={18} color={colors.primaryForeground} />
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Create Goal</Text>
        </TouchableOpacity>
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
});
