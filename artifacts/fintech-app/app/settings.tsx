import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useColors } from '@/hooks/useColors';
import { useFinance } from '@/context/FinanceContext';
import { getApiBaseUrl } from '@/services/apiConfig';
import { getCrashLog, clearCrashLog, formatCrashLogText } from '@/utils/crashLog';

function SettingRow({
  icon,
  label,
  value,
  iconColor,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  iconColor?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.row, { borderBottomColor: colors.border }]}
      {...(onPress ? { onPress, activeOpacity: 0.7 } : {})}
    >
      <View style={[styles.rowIcon, { backgroundColor: (iconColor ?? colors.primary) + '20' }]}>
        <Feather name={icon} size={16} color={iconColor ?? colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
      </View>
      {onPress && <Feather name="chevron-right" size={18} color={colors.mutedForeground} />}
    </Wrapper>
  );
}

type AiStatus = { tier2Configured: boolean; tier3Configured: boolean } | 'unreachable' | 'loading';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { accounts, transactions, goals, recurringRules, exportAllData, importAllData } = useFinance();

  const [aiStatus, setAiStatus] = useState<AiStatus>('loading');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [logCount, setLogCount] = useState<number | null>(null);
  const [sharingLog, setSharingLog] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const baseUrl = getApiBaseUrl();

  useEffect(() => {
    let cancelled = false;
    if (!baseUrl) {
      setAiStatus('unreachable');
      return;
    }
    fetch(`${baseUrl}/api/status`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setAiStatus(data);
      })
      .catch(() => {
        if (!cancelled) setAiStatus('unreachable');
      });
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  const tier2Label =
    aiStatus === 'loading' ? 'Checking…' : aiStatus === 'unreachable' ? 'Backend unreachable' : aiStatus.tier2Configured ? 'Connected' : 'Not configured on server';
  const tier3Label =
    aiStatus === 'loading' ? 'Checking…' : aiStatus === 'unreachable' ? 'Backend unreachable' : aiStatus.tier3Configured ? 'Connected' : 'Not configured on server';
  const tier2Ok = typeof aiStatus === 'object' && aiStatus.tier2Configured;
  const tier3Ok = typeof aiStatus === 'object' && aiStatus.tier3Configured;

  const handleExport = async () => {
    setExporting(true);
    try {
      const json = await exportAllData();
      const filename = `finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const fileUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Save your backup' });
      } else {
        Alert.alert('Export ready', `Saved to ${fileUri}, but sharing isn't available on this device.`);
      }
    } catch {
      Alert.alert('Export failed', 'Could not create the backup file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;

    Alert.alert(
      'Restore from backup?',
      'This replaces everything currently on this device — accounts, transactions, goals, budgets, and recurring rules. This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setImporting(true);
            try {
              const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
              const outcome = await importAllData(content);
              if (outcome.success) {
                Alert.alert('Restore complete', 'Your data has been restored.');
              } else {
                Alert.alert('Restore failed', outcome.error ?? 'Unknown error.');
              }
            } catch {
              Alert.alert('Restore failed', 'Could not read that file.');
            } finally {
              setImporting(false);
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    getCrashLog().then((entries) => setLogCount(entries.length));
  }, []);

  const handleShareLog = async () => {
    setSharingLog(true);
    try {
      const text = await formatCrashLogText();
      const fileUri = `${FileSystem.cacheDirectory}debug-log-${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(fileUri, text, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Share debug log' });
      } else {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
      }
    } catch {
      Alert.alert('Failed', 'Could not prepare the debug log.');
    } finally {
      setSharingLog(false);
    }
  };

  const handleClearLog = () => {
    Alert.alert('Clear debug log?', 'This removes the logged errors from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearCrashLog();
          setLogCount(0);
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.handle, { paddingTop: topPad + 8 }]}>
        <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* AI Engine Status */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>AI ENGINE STATUS</Text>

          <SettingRow
            icon="zap"
            label="Tier 1 — On-Device Engine"
            value="Active (always on, no network needed)"
            iconColor={colors.credit}
          />
          <SettingRow
            icon="server"
            label="Tier 2 — OpenRouter (Llama 3.3 70B)"
            value={tier2Label}
            iconColor={tier2Ok ? colors.credit : colors.warning}
          />
          <SettingRow
            icon="cpu"
            label="Tier 3 — Google Gemini 2.5 Flash"
            value={tier3Label}
            iconColor={tier3Ok ? colors.credit : colors.warning}
          />
        </View>

        {/* Data Summary */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>YOUR DATA</Text>

          <SettingRow
            icon="credit-card"
            label="Accounts"
            value={`${accounts.filter((a) => !a.isDeleted).length} account(s)`}
          />
          <SettingRow
            icon="list"
            label="Transactions"
            value={`${transactions.filter((t) => !t.isDeleted).length} recorded`}
          />
          <SettingRow
            icon="target"
            label="Goals"
            value={`${goals.filter((g) => !g.isDeleted).length} active`}
          />
          <SettingRow
            icon="repeat"
            label="Recurring"
            value={`${recurringRules.filter((r) => r.isActive).length} active rule(s)`}
            onPress={() => router.push('/recurring')}
          />
        </View>

        {/* Backup */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>BACKUP</Text>
          <Text style={[styles.backupHint, { color: colors.mutedForeground }]}>
            Everything lives only on this device. Export a backup before uninstalling, switching phones, or just for peace of mind.
          </Text>
          <View style={styles.backupButtons}>
            <TouchableOpacity
              onPress={handleExport}
              disabled={exporting}
              style={[styles.backupBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="upload" size={15} color={colors.primary} />
              )}
              <Text style={[styles.backupBtnText, { color: colors.primary }]}>Export data</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleImport}
              disabled={importing}
              style={[styles.backupBtn, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' }]}
            >
              {importing ? (
                <ActivityIndicator size="small" color={colors.warning} />
              ) : (
                <Feather name="download" size={15} color={colors.warning} />
              )}
              <Text style={[styles.backupBtnText, { color: colors.warning }]}>Restore backup</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Debug Log */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>DEBUG LOG</Text>
          <Text style={[styles.backupHint, { color: colors.mutedForeground }]}>
            {logCount === null
              ? 'Checking…'
              : logCount === 0
                ? 'No errors logged on this device.'
                : `${logCount} error${logCount > 1 ? 's' : ''} logged. Kept locally, capped at the most recent 20.`}
          </Text>
          <View style={styles.backupButtons}>
            <TouchableOpacity
              onPress={handleShareLog}
              disabled={sharingLog}
              style={[styles.backupBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
            >
              {sharingLog ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="share" size={15} color={colors.primary} />
              )}
              <Text style={[styles.backupBtnText, { color: colors.primary }]}>Share log</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClearLog}
              style={[styles.backupBtn, { backgroundColor: colors.debit + '15', borderColor: colors.debit + '40' }]}
            >
              <Feather name="trash-2" size={15} color={colors.debit} />
              <Text style={[styles.backupBtnText, { color: colors.debit }]}>Clear log</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* About */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ABOUT</Text>
          <SettingRow icon="smartphone" label="Local data" value="Stored only on this device (AsyncStorage)" />
          <SettingRow
            icon="cloud"
            label="AI processing"
            value="Tier 2/3 send transaction text to your own backend, which calls OpenRouter/Gemini"
          />
          <SettingRow icon="info" label="Version" value="1.0.0" />
        </View>

        {(!tier2Ok || !tier3Ok) && (
          <View style={[styles.apiNotice, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' }]}>
            <Feather name="alert-triangle" size={16} color={colors.warning} />
            <Text style={[styles.apiNoticeText, { color: colors.warning }]}>
              {aiStatus === 'unreachable'
                ? "Can't reach your backend. Set EXPO_PUBLIC_API_BASE_URL and make sure api-server is running."
                : !tier2Ok && !tier3Ok
                ? 'Neither AI tier is configured on the server. AI features are limited to on-device parsing only.'
                : !tier2Ok
                ? 'OpenRouter key missing on the server — Tier 2 AI fallback disabled.'
                : 'Gemini key missing on the server — Deep Audit disabled.'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.push('/add-account')}
          style={[styles.addAccountBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
        >
          <Feather name="plus-circle" size={16} color={colors.primary} />
          <Text style={[styles.addAccountText, { color: colors.primary }]}>Add Account</Text>
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
  section: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  rowValue: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  backupHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backupButtons: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  backupBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  apiNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  apiNoticeText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 20 },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  addAccountText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
});
