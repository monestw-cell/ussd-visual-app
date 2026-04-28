import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
  Switch, useColorScheme, Platform
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { useSettings } from '@/context/SettingsContext';
import { HistoryDb } from '@/database/historyDb';
import { UssdBridge } from '@/services/ussdBridge';
import * as LocalAuthentication from 'expo-local-authentication';

const SIM_LABELS = ['افتراضي', 'شريحة 1', 'شريحة 2'];

function Section({ title, children, palette }: { title: string; children: React.ReactNode; palette: typeof colors.light }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  label, value, onPress, rightEl, isLast, destructive, palette
}: {
  label: string; value?: string; onPress?: () => void;
  rightEl?: React.ReactNode; isLast?: boolean;
  destructive?: boolean; palette: typeof colors.light
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: palette.border },
        pressed && onPress && { backgroundColor: palette.muted },
      ]}
    >
      {rightEl ?? (value ? <Text style={[styles.rowValue, { color: palette.mutedForeground }]}>{value}</Text> : null)}
      <Text style={[styles.rowLabel, { color: destructive ? palette.destructive : palette.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? colors.dark : colors.light;
  const { settings, updateSettings, clearAll, clearPin, isBiometricAvailable } = useSettings();

  const [overlayOk, setOverlayOk] = useState<boolean | null>(null);
  const [accessibilityOk, setAccessibilityOk] = useState<boolean | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useFocusEffect(useCallback(() => {
    if (UssdBridge.isAvailable) {
      UssdBridge.checkOverlayPermission().then(setOverlayOk);
      UssdBridge.checkAccessibilityEnabled().then(setAccessibilityOk);
    }
    isBiometricAvailable().then(setBiometricAvailable);
  }, []));

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'تحقق من هويتك لتفعيل الحماية البيومترية',
        cancelLabel: 'إلغاء',
      });
      if (!result.success) return;
    }
    await updateSettings({ biometricsEnabled: value });
    Haptics.selectionAsync();
  };

  const simOptions = (service: 'palestine' | 'jawwal') => {
    const current = service === 'palestine' ? settings.palestineSimSlot : settings.jawwalSimSlot;
    Alert.alert('اختيار الشريحة', 'اختر شريحة SIM لهذه الخدمة', [
      { text: SIM_LABELS[0], onPress: () => updateSettings({ [`${service}SimSlot`]: -1 }) },
      { text: SIM_LABELS[1], onPress: () => updateSettings({ [`${service}SimSlot`]: 0 }) },
      { text: SIM_LABELS[2], onPress: () => updateSettings({ [`${service}SimSlot`]: 1 }) },
    ]);
  };

  const confirmClearAll = () => {
    Alert.alert('إعادة ضبط', 'سيتم مسح جميع الإعدادات والسجل والـ PIN. هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إعادة الضبط', style: 'destructive', onPress: () => { clearAll(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
    ]);
  };

  const confirmClearHistory = () => {
    Alert.alert('مسح السجل', 'سيتم مسح جميع سجلات العمليات.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'مسح', style: 'destructive', onPress: () => HistoryDb.clear() },
    ]);
  };

  const statusIcon = (ok: boolean | null) =>
    ok === true ? <Feather name="check-circle" size={18} color={palette.success} />
    : ok === false ? <Feather name="x-circle" size={18} color={palette.destructive} />
    : <Feather name="minus-circle" size={18} color={palette.mutedForeground} />;

  const slotLabel = (slot: number) => SIM_LABELS[slot + 1] ?? SIM_LABELS[0];

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
        <Text style={[styles.title, { color: palette.foreground }]}>الإعدادات</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 90) + 20 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="حالة النظام" palette={palette}>
          <Row
            label="صلاحية العرض فوق التطبيقات"
            rightEl={<View style={styles.statusRow}>{statusIcon(overlayOk)}<Text style={[styles.statusTxt, { color: overlayOk ? palette.success : palette.destructive }]}>{overlayOk ? 'مفعّل' : overlayOk === false ? 'غير مفعّل' : '—'}</Text></View>}
            onPress={!overlayOk ? () => UssdBridge.requestOverlayPermission() : undefined}
            palette={palette}
          />
          <Row
            label="خدمة إمكانية الوصول"
            isLast
            rightEl={<View style={styles.statusRow}>{statusIcon(accessibilityOk)}<Text style={[styles.statusTxt, { color: accessibilityOk ? palette.success : palette.destructive }]}>{accessibilityOk ? 'مفعّلة' : accessibilityOk === false ? 'غير مفعّلة' : '—'}</Text></View>}
            onPress={!accessibilityOk ? () => UssdBridge.openAccessibilitySettings() : undefined}
            palette={palette}
          />
        </Section>

        {biometricAvailable && (
          <Section title="الأمان" palette={palette}>
            <Row
              label="حماية الرقم السري بالبصمة"
              isLast
              rightEl={
                <Switch
                  value={settings.biometricsEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor="#fff"
                />
              }
              palette={palette}
            />
          </Section>
        )}

        <Section title="بنك فلسطين (*267#)" palette={palette}>
          <Row
            label="شريحة SIM"
            value={slotLabel(settings.palestineSimSlot)}
            onPress={() => simOptions('palestine')}
            palette={palette}
          />
          <Row
            label="إعادة تعيين PIN المحفوظ"
            onPress={() => { clearPin('palestine'); Haptics.selectionAsync(); Alert.alert('تم', 'تم مسح الـ PIN المحفوظ لبنك فلسطين'); }}
            isLast
            palette={palette}
          />
        </Section>

        <Section title="جوال باي (*110#)" palette={palette}>
          <Row
            label="شريحة SIM"
            value={slotLabel(settings.jawwalSimSlot)}
            onPress={() => simOptions('jawwal')}
            palette={palette}
          />
          <Row
            label="إعادة تعيين PIN المحفوظ"
            onPress={() => { clearPin('jawwal'); Haptics.selectionAsync(); Alert.alert('تم', 'تم مسح الـ PIN المحفوظ لجوال باي'); }}
            isLast
            palette={palette}
          />
        </Section>

        <Section title="البيانات" palette={palette}>
          <Row
            label="مسح سجل العمليات"
            onPress={confirmClearHistory}
            palette={palette}
          />
          <Row
            label="إعادة الضبط الكامل"
            onPress={confirmClearAll}
            isLast
            destructive
            palette={palette}
          />
        </Section>

        <View style={[styles.versionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Feather name="info" size={16} color={palette.mutedForeground} />
          <Text style={[styles.versionTxt, { color: palette.mutedForeground }]}>
            USSD بواجهة مرئية — الإصدار 1.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  scroll: { padding: 16, gap: 4 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
    marginBottom: 8,
    paddingHorizontal: 4,
    writingDirection: 'rtl',
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', flex: 1, textAlign: 'right', writingDirection: 'rtl' },
  rowValue: { fontSize: 13, fontFamily: 'Inter_400Regular', marginLeft: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusTxt: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  versionCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    marginTop: 8,
  },
  versionTxt: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
