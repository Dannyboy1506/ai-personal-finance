import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface DatePickerModalProps {
  visible: boolean;
  value?: string; // ISO date string, or undefined for "today"
  minDate?: Date; // dates before this are disabled — pass to disallow past dates
  onSelect: (isoDate: string) => void;
  onClose: () => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * A calendar picker with zero native dependencies — pure View/Pressable.
 * Deliberately avoids @react-native-community/datetimepicker, which has an
 * open, unresolved rendering bug on Expo SDK 54 as of early 2026.
 */
export function DatePickerModal({ visible, value, minDate, onSelect, onClose }: DatePickerModalProps) {
  const colors = useColors();
  const initial = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const selected = value ? new Date(value) : null;
  const today = new Date();

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const handlePick = (day: number) => {
    const picked = new Date(viewYear, viewMonth, day, 12, 0, 0); // noon avoids any DST/timezone edge rolling to the previous day
    if (minDate && picked < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return;
    onSelect(picked.toISOString());
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={() => {}}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.header}>
            <Pressable onPress={goToPrevMonth} hitSlop={10} style={styles.navBtn}>
              <Feather name="chevron-left" size={20} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.monthLabel, { color: colors.foreground }]}>
              {MONTH_LABELS[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={goToNextMonth} hitSlop={10} style={styles.navBtn}>
              <Feather name="chevron-right" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((d, i) => (
              <Text key={i} style={[styles.weekdayLabel, { color: colors.mutedForeground }]}>{d}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={i} style={styles.cell} />;
              const cellDate = new Date(viewYear, viewMonth, day);
              const isSelected = selected && isSameDay(cellDate, selected);
              const isToday = isSameDay(cellDate, today);
              const isDisabled = !!minDate && cellDate < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());

              return (
                <Pressable
                  key={i}
                  onPress={() => handlePick(day)}
                  disabled={isDisabled}
                  style={[
                    styles.cell,
                    styles.dayCell,
                    isSelected && { backgroundColor: colors.primary },
                    !isSelected && isToday && { borderWidth: 1, borderColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: isSelected
                          ? colors.primaryForeground
                          : isDisabled
                            ? colors.mutedForeground + '60'
                            : colors.foreground,
                      },
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  handleRow: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { padding: 6 },
  monthLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontFamily: 'Inter_500Medium' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCell: { borderRadius: 100 },
  dayText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
