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
import type { Account } from '@/context/FinanceContext';

type AccountType = Account['type'];

const ACCOUNT_TYPES: Array<{ type: AccountType; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { type: 'BANK', label: 'Bank Account', icon: 'credit-card' },
  { type: 'CASH', label: 'Cash Wallet', icon: 'dollar-sign' },
  { type: 'CREDIT_CARD', label: 'Credit Card', icon: 'credit-card' },
];

export default function AddAccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addAccount } = useFinance();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('BANK');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('USD');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleSave = async () => {
    if (!name.trim()) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addAccount({
      name: name.trim(),
      type,
      currency: currency.toUpperCase(),
      balance: parseFloat(balance) || 0,
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
          <Text style={[styles.title, { color: colors.foreground }]}>Add Account</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Account type */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Account Type</Text>
          <View style={styles.typeRow}>
            {ACCOUNT_TYPES.map((at) => {
              const active = type === at.type;
              return (
                <Pressable
                  key={at.type}
                  onPress={() => setType(at.type)}
                  style={[
                    styles.typeCard,
                    {
                      backgroundColor: active ? colors.primary + '20' : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather
                    name={at.icon}
                    size={18}
                    color={active ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[styles.typeLabel, { color: active ? colors.primary : colors.mutedForeground }]}>
                    {at.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Name */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Account Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder='e.g. "GTBank" or "Wallet"'
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
          />
        </View>

        {/* Opening balance */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Opening Balance</Text>
          <View style={[styles.amountRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.currency, { color: colors.mutedForeground }]}>{currency}</Text>
            <TextInput
              value={balance}
              onChangeText={setBalance}
              placeholder="0.00"
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
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Add Account</Text>
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
  typeRow: { gap: 8 },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  currency: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 24, fontFamily: 'Inter_700Bold', paddingVertical: 12 },
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
