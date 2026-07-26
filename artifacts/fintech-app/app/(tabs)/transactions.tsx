import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
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
import { TransactionCard } from '@/components/TransactionCard';

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions, categories, getCategoryById, confirmTransaction, deleteTransaction } = useFinance();
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const activeTxs = useMemo(
    () => transactions.filter((t) => !t.isDeleted),
    [transactions],
  );

  const filtered = useMemo(() => {
    if (!selectedCatId) return activeTxs;
    return activeTxs.filter((t) => t.categoryId === selectedCatId);
  }, [activeTxs, selectedCatId]);

  const usedCatIds = useMemo(
    () => [...new Set(activeTxs.map((t) => t.categoryId))],
    [activeTxs],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Transactions</Text>
        <TouchableOpacity
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/add-transaction');
          }}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chips, { paddingHorizontal: 18 }]}
        style={{ maxHeight: 52 }}
      >
        <Pressable
          onPress={() => setSelectedCatId(null)}
          style={[
            styles.chip,
            {
              backgroundColor: selectedCatId === null ? colors.primary : colors.card,
              borderColor: selectedCatId === null ? colors.primary : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: selectedCatId === null ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            All
          </Text>
        </Pressable>
        {usedCatIds.map((catId) => {
          const cat = getCategoryById(catId);
          if (!cat) return null;
          const active = selectedCatId === catId;
          return (
            <Pressable
              key={catId}
              onPress={() => setSelectedCatId(active ? null : catId)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? cat.color + '25' : colors.card,
                  borderColor: active ? cat.color : colors.border,
                },
              ]}
            >
              <Feather
                name={cat.icon as keyof typeof Feather.glyphMap}
                size={12}
                color={active ? cat.color : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: active ? cat.color : colors.mutedForeground },
                ]}
              >
                {cat.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TransactionCard
            transaction={item}
            category={getCategoryById(item.categoryId)}
            categories={categories}
            onConfirm={confirmTransaction}
            onPress={() => {}}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Feather name="inbox" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No transactions</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              {selectedCatId ? 'None in this category yet' : 'Start logging your spending'}
            </Text>
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
  chips: { paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  list: { paddingHorizontal: 18, paddingTop: 10 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  emptyBody: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
