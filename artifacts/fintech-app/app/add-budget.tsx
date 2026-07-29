import React, { useState } from 'react';
import {
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

export default function AddBudgetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addBudget, categories } = useFinance();

  const [categoryId, setCategoryId] = useState('cat_general');
  const [limit, setLimit] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');

  const handleSave = async () => {
    const lim = parseFloat(limit);
    if (!lim || lim <= 0) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addBudget({ categoryId, monthlyLimit: lim, period: 'MONTHLY', rolloverEnabled: false });
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
          <Text style={[styles.title, { color: colors.foreground }]}>Set Budget</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
          <View style={styles.catGrid}>
            {expenseCategories.map((c) => {
              const active = categoryId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={[
                    styles.catChip,
                    { backgroundColor: active ? c.color + '25' : colors.card, borderColor: active ? c.color : colors.border },
                  ]}
                >
                  <Feather name={c.icon as keyof typeof Feather.glyphMap} size={13} color={active ? c.color : colors.mutedForeground} />
                  <Text style={[styles.catText, { color: active ? c.color : colors.mutedForeground }]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Monthly Limit</Text>
          <View style={[styles.amountRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.currency, { color: colors.mutedForeground }]}>₦</Text>
            <TextInput
              value={limit}
              onChangeText={setLimit}
              placeholder="500"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              style={[styles.amountInput, { color: colors.foreground }]}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="check" size={18} color={colors.primaryForeground} />
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Set Budget</Text>
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
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  catText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  amountRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  currency: { fontSize: 20, fontFamily: 'Inter_600SemiBold', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 26, fontFamily: 'Inter_700Bold', paddingVertical: 12 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, marginTop: 4 },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', fontWeight: '700' },
});
