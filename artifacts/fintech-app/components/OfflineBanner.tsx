import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface OfflineBannerProps {
  queuedCount: number;
  onRetry?: () => Promise<void>;
}

export function OfflineBanner({ queuedCount, onRetry }: OfflineBannerProps) {
  const colors = useColors();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={[styles.banner, { backgroundColor: colors.warning + '20', borderColor: colors.warning + '50' }]}>
      <Feather name="wifi-off" size={13} color={colors.warning} />
      <Text style={[styles.text, { color: colors.warning }]}>
        Offline — {queuedCount > 0 ? `${queuedCount} transaction${queuedCount > 1 ? 's' : ''} queued` : 'reconnecting...'}
      </Text>
      {onRetry && queuedCount > 0 && (
        <Pressable
          onPress={handleRetry}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel="Retry queued transactions now"
          style={({ pressed }) => [styles.retryButton, { opacity: pressed || retrying ? 0.6 : 1 }]}
        >
          {retrying ? (
            <ActivityIndicator size="small" color={colors.warning} />
          ) : (
            <Text style={[styles.retryText, { color: colors.warning }]}>Retry now</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  retryText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textDecorationLine: 'underline',
  },
});
