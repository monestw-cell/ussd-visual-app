import React, { useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, useColorScheme, Platform
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { useSession, ServiceId } from '@/context/SessionContext';
import { useSettings } from '@/context/SettingsContext';
import UssdStep from '@/components/UssdStep';

const SERVICE_LABELS: Record<string, string> = {
  palestine: 'بنك فلسطين',
  jawwal: 'جوال باي',
};
const SERVICE_COLORS: Record<string, string> = {
  palestine: '#1B3B8A',
  jawwal: '#00A650',
};

export default function UssdSessionScreen() {
  const { service: serviceParam, code, demo } = useLocalSearchParams<{
    service: string;
    code: string;
    demo?: string;
  }>();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? colors.dark : colors.light;
  const session = useSession();
  const { settings } = useSettings();

  const serviceId = serviceParam as ServiceId;
  const serviceName = SERVICE_LABELS[serviceParam ?? ''] ?? 'خدمة USSD';
  const serviceColor = SERVICE_COLORS[serviceParam ?? ''] ?? palette.primary;
  const isDemo = demo === '1';

  const simSlot = serviceId === 'palestine'
    ? settings.palestineSimSlot
    : serviceId === 'jawwal'
    ? settings.jawwalSimSlot
    : -1;

  useEffect(() => {
    if (session.status === 'idle') {
      session.startSession(serviceId, code ?? '', simSlot, isDemo);
    }
    return () => {};
  }, []);

  const handleCancel = useCallback(() => {
    session.cancelSession();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [session]);

  const handleDone = useCallback(() => {
    session.resetSession();
    router.back();
  }, [session]);

  const handleReply = useCallback((text: string) => {
    session.sendReply(text);
  }, [session]);

  const isConnecting = session.status === 'connecting' || session.status === 'checking_permissions';
  const isEnded = session.status === 'ended';
  const hasScreen = !!session.currentScreen;

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={[
        styles.header,
        {
          backgroundColor: serviceColor,
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 16),
        }
      ]}>
        <View style={styles.headerRow}>
          {!isEnded ? (
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="x" size={20} color="#fff" />
              <Text style={styles.cancelTxt}>إلغاء</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleDone}
              style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="arrow-right" size={20} color="#fff" />
              <Text style={styles.cancelTxt}>رجوع</Text>
            </Pressable>
          )}

          <View style={styles.headerCenter}>
            <Text style={styles.serviceTitle}>{serviceName}</Text>
            {isDemo && <Text style={styles.demoTag}>وضع المعاينة</Text>}
          </View>

          <View style={[styles.stepBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.stepTxt}>{session.stepCount}</Text>
          </View>
        </View>

        {isConnecting && (
          <View style={styles.connectingRow}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.connectingTxt}>
              {session.stepCount === 0 ? 'جاري الاتصال...' : 'جاري الانتظار...'}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 20) + 16 }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {session.error ? (
          <View style={[styles.errorCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <Feather name="alert-circle" size={22} color={palette.destructive} />
            <Text style={[styles.errorTxt, { color: palette.destructive }]}>{session.error}</Text>
          </View>
        ) : null}

        {!hasScreen && !isConnecting && !session.error && (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={serviceColor} />
            <Text style={[styles.emptyTxt, { color: palette.mutedForeground }]}>
              جاري تحميل الخدمة...
            </Text>
          </View>
        )}

        {hasScreen && session.currentScreen && (
          <View style={[styles.screenCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <UssdStep
              screen={session.currentScreen}
              onReply={handleReply}
              isLoading={isConnecting}
            />
            {isConnecting && (
              <View style={styles.loadingBar}>
                <ActivityIndicator size="small" color={serviceColor} />
                <Text style={[styles.loadingTxt, { color: palette.mutedForeground }]}>جاري المعالجة...</Text>
              </View>
            )}
          </View>
        )}

        {isEnded && session.currentScreen?.type === 'result' && (
          <Pressable
            onPress={handleDone}
            style={({ pressed }) => [
              styles.doneBtn,
              { backgroundColor: serviceColor, opacity: pressed ? 0.85 : 1 }
            ]}
          >
            <Text style={styles.doneTxt}>العودة للرئيسية</Text>
            <Feather name="home" size={18} color="#fff" style={{ marginRight: 6 }} />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  cancelTxt: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium' },
  headerCenter: { alignItems: 'center', flex: 1 },
  serviceTitle: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  demoTag: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  stepBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxt: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  connectingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  connectingTxt: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  body: { flex: 1 },
  bodyContent: { padding: 18, gap: 16 },
  errorCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  errorTxt: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'right', writingDirection: 'rtl' },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 16,
  },
  emptyTxt: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  screenCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  loadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  loadingTxt: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  doneTxt: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
