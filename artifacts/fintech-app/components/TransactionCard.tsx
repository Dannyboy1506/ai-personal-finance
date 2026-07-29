import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Transaction, Category } from '@/context/FinanceContext';
import { CategoryPickerModal } from '@/components/CategoryPickerModal';
import { formatCurrencyAbs } from '@/utils/currency';

interface TransactionCardProps {
  transaction: Transaction;
  category?: Category;
  onConfirm?: (txId: string, categoryId: string) => void;
  onPress?: () => void;
  showConfirmChip?: boolean;
  categories?: Category[];
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function TransactionCard({
  transaction,
  category,
  onPress,
  onConfirm,
  showConfirmChip = true,
  categories,
}: TransactionCardProps) {
  const colors = useColors();
  const [pickerOpen, setPickerOpen] = useState(false);

  const isCredit = transaction.type === 'CREDIT';
  const isRisk = category?.isRisk ?? false;

  const amountColor = isCredit
    ? colors.credit
    : isRisk
    ? colors.riskDebit
    : colors.debit;

  const dotColor = amountColor;
  const iconName = (category?.icon ?? 'circle') as keyof typeof Feather.glyphMap;

  // The confirm badge only actually does something if the caller gave us both
  // onConfirm and the category list to pick from. Without those it still
  // renders (so a low-confidence transaction is never silently unmarked) but
  // isn't tappable, since there'd be nothing to open.
  const canConfirm = showConfirmChip && !!onConfirm && !!categories && categories.length > 0;

  const handleConfirmPress = (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    if (canConfirm) setPickerOpen(true);
  };

  const handleSelect = (categoryId: string) => {
    onConfirm?.(transaction.id, categoryId);
    setPickerOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        style={[
          styles.row,
          {
            backgroundColor: colors.card,
            borderColor: transaction.needsConfirmation ? colors.warning + '60' : colors.border,
            borderWidth: transaction.needsConfirmation ? 1.5 : 1,
          },
        ]}
      >
        {/* Icon bubble */}
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: (category?.color ?? colors.muted) + '22' },
          ]}
        >
          <Feather
            name={iconName}
            size={18}
            color={category?.color ?? colors.mutedForeground}
          />
        </View>

        {/* Middle */}
        <View style={styles.middle}>
          <Text
            style={[styles.description, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {transaction.description}
          </Text>
          <View style={styles.meta}>
            {isRisk && (
              <Feather
                name="alert-triangle"
                size={11}
                color={colors.warning}
                style={styles.riskIcon}
              />
            )}
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {category?.name ?? 'Unknown'} • {formatTime(transaction.timestamp)}
            </Text>
          </View>
          {transaction.needsConfirmation && (
            <TouchableOpacity
              onPress={handleConfirmPress}
              disabled={!canConfirm}
              accessibilityRole="button"
              accessibilityLabel="Tap to confirm category"
              style={[
                styles.confirmBadge,
                { backgroundColor: colors.warning + '20', borderColor: colors.warning + '60' },
              ]}
            >
              <Feather name="help-circle" size={10} color={colors.warning} />
              <Text style={[styles.confirmText, { color: colors.warning }]}>
                Tap to confirm category
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Amount + dot */}
        <View style={styles.right}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={[styles.amount, { color: amountColor }]}>
            {isCredit ? '+' : '-'}{formatCurrencyAbs(transaction.amount)}
          </Text>
        </View>
      </TouchableOpacity>

      {canConfirm && (
        <CategoryPickerModal
          visible={pickerOpen}
          categories={categories!}
          currentCategoryId={transaction.categoryId}
          transactionType={transaction.type}
          onSelect={handleSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    gap: 3,
  },
  description: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  riskIcon: {
    marginRight: 2,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  confirmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  confirmText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  amount: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
