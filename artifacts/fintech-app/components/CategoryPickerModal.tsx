import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Category } from '@/context/FinanceContext';

interface CategoryPickerModalProps {
  visible: boolean;
  categories: Category[];
  currentCategoryId?: string;
  transactionType: 'CREDIT' | 'DEBIT';
  onSelect: (categoryId: string) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet category picker. Used to actually complete the "tap to confirm
 * category" flow on low-confidence transactions — the badge existed before,
 * but nothing opened when you tapped it. This is what opens now.
 */
export function CategoryPickerModal({
  visible,
  categories,
  currentCategoryId,
  transactionType,
  onSelect,
  onClose,
}: CategoryPickerModalProps) {
  const colors = useColors();
  const relevant = categories.filter((c) =>
    transactionType === 'CREDIT' ? c.type === 'INCOME' : c.type === 'EXPENSE',
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={() => {}}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Confirm category</Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close category picker"
              accessibilityRole="button"
              style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            The AI wasn't fully sure about this one — pick the right category and it'll learn for next time.
          </Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {relevant.map((c) => {
              const active = c.id === currentCategoryId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => onSelect(c.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Set category to ${c.name}`}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: active ? c.color + '20' : colors.card,
                      borderColor: active ? c.color : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={[styles.iconCircle, { backgroundColor: c.color + '25' }]}>
                    <Feather name={c.icon as keyof typeof Feather.glyphMap} size={16} color={c.color} />
                  </View>
                  <Text style={[styles.rowText, { color: colors.foreground }]}>{c.name}</Text>
                  {c.isRisk && <Feather name="alert-triangle" size={14} color={colors.warning} />}
                  {active && <Feather name="check" size={18} color={c.color} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '75%',
  },
  handleRow: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  closeButton: { padding: 4 },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
    lineHeight: 18,
  },
  list: { marginBottom: 4 },
  listContent: { gap: 8, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
});
