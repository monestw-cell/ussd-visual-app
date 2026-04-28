import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, useColorScheme,
  Alert, Platform
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import { HistoryDb, OperationRecord } from '@/database/historyDb';

const SERVICE_LABELS: Record<string, string> = { palestine: 'بنك فلسطين', jawwal: 'جوال باي' };
const TYPE_LABELS: Record<string, string> = {
  transfer: 'تحويل', topup: 'شحن رصيد', payment: 'دفع',
  balance: 'استعلام رصيد', statement: 'كشف حساب',
  cancelled: 'ملغاة', other: 'عملية', unknown: 'عملية',
};
const TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  transfer: 'send', topup: 'smartphone', payment: 'dollar-sign',
  balance: 'bar-chart-2', statement: 'file-text', cancelled: 'x',
  other: 'circle', unknown: 'circle',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-SA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? colors.dark : colors.light;
  const [operations, setOperations] = useState<OperationRecord[]>([]);

  useFocusEffect(useCallback(() => {
    HistoryDb.getAll().then(setOperations);
  }, []));

  const handleClearAll = () => {
    Alert.alert(
      'مسح السجل',
      'هل تريد مسح جميع سجلات العمليات؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'مسح الكل',
          style: 'destructive',
          onPress: async () => {
            await HistoryDb.clear();
            setOperations([]);
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: OperationRecord }) => {
    const statusColor = item.status === 'success' ? palette.success : item.status === 'cancelled' ? palette.mutedForeground : palette.destructive;
    const statusLabel = item.status === 'success' ? 'ناجحة' : item.status === 'cancelled' ? 'ملغاة' : 'فاشلة';
    const icon = TYPE_ICONS[item.type] ?? 'circle';
    const typeLabel = TYPE_LABELS[item.type] ?? 'عملية';
    const serviceLabel = SERVICE_LABELS[item.service] ?? item.service;

    return (
      <View style={[styles.item, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={[styles.itemIcon, { backgroundColor: `${statusColor}18` }]}>
          <Feather name={icon} size={22} color={statusColor} />
        </View>
        <View style={styles.itemInfo}>
          <View style={styles.itemRow}>
            <Text style={[styles.statusDot, { color: statusColor }]}>● {statusLabel}</Text>
            <Text style={[styles.itemType, { color: palette.foreground }]}>{typeLabel}</Text>
          </View>
          <Text style={[styles.itemService, { color: palette.mutedForeground }]}>{serviceLabel}</Text>
          {item.amount && (
            <Text style={[styles.itemAmount, { color: palette.foreground }]}>{item.amount} ₪</Text>
          )}
          {item.recipientLast4 && (
            <Text style={[styles.itemRecipient, { color: palette.mutedForeground }]}>
              المستلم: ****{item.recipientLast4}
            </Text>
          )}
          {item.refNumber && (
            <Text style={[styles.itemRef, { color: palette.mutedForeground }]}>
              رقم العملية: {item.refNumber}
            </Text>
          )}
          <Text style={[styles.itemDate, { color: palette.mutedForeground }]}>{formatDate(item.date)}</Text>
          {item.description && (
            <Text style={[styles.itemDesc, { color: palette.mutedForeground }]} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={[
        styles.headerBar,
        {
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16),
          backgroundColor: palette.card,
          borderBottomColor: palette.border,
        }
      ]}>
        <Text style={[styles.title, { color: palette.foreground }]}>سجل العمليات</Text>
        {operations.length > 0 && (
          <Pressable onPress={handleClearAll}>
            <Feather name="trash-2" size={20} color={palette.destructive} />
          </Pressable>
        )}
      </View>

      {operations.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="clock" size={48} color={palette.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: palette.foreground }]}>لا توجد عمليات</Text>
          <Text style={[styles.emptySubtitle, { color: palette.mutedForeground }]}>
            ستظهر هنا عملياتك بعد أول استخدام
          </Text>
        </View>
      ) : (
        <FlatList
          data={operations}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 90) }
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!operations.length}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  listContent: { padding: 16, gap: 10 },
  item: {
    flexDirection: 'row-reverse',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemInfo: { flex: 1, alignItems: 'flex-end' },
  itemRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 2 },
  itemType: { fontSize: 15, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  statusDot: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  itemService: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'right', marginBottom: 4 },
  itemAmount: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'right', marginBottom: 2 },
  itemRecipient: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  itemRef: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'right', marginTop: 2 },
  itemDate: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4, textAlign: 'right' },
  itemDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 80,
  },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 12 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 40 },
});
