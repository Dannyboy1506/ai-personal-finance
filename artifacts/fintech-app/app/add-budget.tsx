import React, { useState } from 'react';
import {
  Alert,
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
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/FinanceContext';

export default function AddBudgetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addBudget, updateBudget, deleteBudget, categories, budgets } = useFinance();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const isEditing = !!id;
  const existing = id ? budgets.find((b) => b.id === id) : undefined;

  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? 'cat_general');
  const [limit, setLimit] = useState(existing ? String(existing.monthlyLimit) : '');
  const [error, setError] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');

  // Categories that already have a budget elsewhere — used to flag chips
  // and to stop a second budget being created on the same category. There
  // used to be no way to edit or delete a budget at all, so picking the
  // wrong category (or wanting to change it) meant being stuck; this both
  // prevents new duplicates and points at the existing one to edit instead.
  const budgetedCategoryIds = new Set(
    budgets.filter((b) => b.id !== existing?.id).map((b) => b.categoryId),
  );

  if (isEditing && !existing) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.handle, { paddingTop: topPad + 8 }]}>
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
        </View>
        <View style={styles.notFound}>
          <Feather name="alert-circle" size={28} color={colors.mutedForeground} />
          <Text style={[styles.notFoundText, { color: colors.foreground }]}>This budget no longer exists.</Text>
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

  const conflictingBudget = !isEditing ? budgets.find((b) => b.categoryId === categoryId) : undefined;

  const handleSave = async () => {
    const lim = parseFloat(limit);
    if (!lim || lim <= 0) {
      setError('Please enter a valid monthly limit');
      return;
    }
    if (conflictingBudget) {
      setError('You already have a budget for this category — edit that one instead.');
      return;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (isEditing && existing) {
      updateBudget(existing.id, { categoryId, monthlyLimit: lim });
    } else {
      addBudget({ categoryId, monthlyLimit: lim, period: 'MONTHLY', rolloverEnabled: false });
    }
    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    const cat = categories.find((c) => c.id === existing.categoryId);
    Alert.alert(
      'Delete this budget?',
      `The ${cat?.name ?? 'category'} budget will be removed. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            deleteBudget(existing.id);
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
          <Text style={[styles.title, { color: colors.foreground }]}>{isEditing ? 'Edit Budget' : 'Set Budget'}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
          <View style={styles.catGrid}>
            {expenseCategories.map((c) => {
              const active = categoryId === c.id;
              const alreadyBudgeted = budgetedCategoryIds.has(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => { setCategoryId(c.id); setError(''); }}
                  style={[
                    styles.catChip,
                    { backgroundColor: active ? c.color + '25' : colors.card, borderColor: active ? c.color : colors.border },
                  ]}
                >
                  <Feather name={c.icon as keyof typeof Feather.glyphMap} size={13} color={active ? c.color : colors.mutedForeground} />
                  <Text style={[styles.catText, { color: active ? c.color : colors.mutedForeground }]}>{c.name}</Text>
                  {alreadyBudgeted && <Feather name="check-circle" size={11} color={colors.mutedForeground} />}
                </Pressable>
              );
            })}
          </View>
          {!isEditing && budgetedCategoryIds.size > 0 && (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              The checkmark shows a category that already has a budget.
            </Text>
          )}
        </View>

        {conflictingBudget && (
          <View style={[styles.conflictRow, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' }]}>
            <Feather name="alert-circle" size={14} color={colors.warning} />
            <Text style={[styles.conflictText, { color: colors.warning }]}>You already have a budget for this category.</Text>
            <TouchableOpacity onPress={() => router.push(`/add-budget?id=${conflictingBudget.id}`)}>
              <Text style={[styles.editLink, { color: colors.primary }]}>Edit it</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Monthly Limit</Text>
          <View style={[styles.amountRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.currency, { color: colors.mutedForeground }]}>₦</Text>
            <TextInput
              value={limit}
              onChangeText={(v) => { setLimit(v); setError(''); }}
              placeholder="500"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[styles.amountInput, { color: colors.foreground }]}
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
          <Feather name="check" size={18} color={colors.primaryForeground} />
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
            {isEditing ? 'Save Changes' : 'Set Budget'}
          </Text>
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity onPress={handleDelete} style={[styles.deleteBtn, { borderColor: colors.debit + '50' }]}>
            <Feather name="trash-2" size={16} color={colors.debit} />
            <Text style={[styles.deleteBtnText, { color: colors.debit }]}>Delete Budget</Text>
          </TouchableOpacity>
        )}
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
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  notFoundText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  catText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  conflictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  conflictText: { fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1 },
  editLink: { fontSize: 12, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  amountRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  currency: { fontSize: 20, fontFamily: 'Inter_600SemiBold', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 26, fontFamily: 'Inter_700Bold', paddingVertical: 12 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, marginTop: 4 },
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
