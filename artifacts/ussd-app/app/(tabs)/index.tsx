import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Modal,
  Pressable, ActivityIndicator, Platform, useColorScheme
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import ServiceCard, { Service } from '@/components/ServiceCard';
import { UssdBridge } from '@/services/ussdBridge';

const SERVICES: Service[] = [
  {
    id: 'palestine',
    name: 'بنك فلسطين',
    subtitle: 'الخدمات المصرفية الإلكترونية',
    code: '*267#',
    activeColor: '#1B3B8A',
    iconName: 'credit-card',
    active: true,
  },
  {
    id: 'jawwal',
    name: 'جوال باي',
    subtitle: 'المحفظة الإلكترونية',
    code: '*110#',
    activeColor: '#00A650',
    iconName: 'smartphone',
    active: true,
  },
  {
    id: 'palPay',
    name: 'بال بي',
    subtitle: 'الخدمة متوقفة حالياً',
    code: '',
    activeColor: '#94a3b8',
    iconName: 'dollar-sign',
    active: false,
  },
];

type PermStep = 'overlay' | 'accessibility' | null;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? colors.dark : colors.light;

  const [permModal, setPermModal] = useState<PermStep>(null);
  const [checking, setChecking] = useState(false);
  const [pendingService, setPendingService] = useState<Service | null>(null);

  const handleServicePress = async (service: Service) => {
    if (!service.active) {
      Alert.alert('خدمة متوقفة', 'هذه الخدمة متوقفة حالياً');
      return;
    }

    if (!UssdBridge.isAvailable) {
      router.push({ pathname: '/ussd-session', params: { service: service.id, code: service.code, demo: '1' } });
      return;
    }

    setPendingService(service);
    setChecking(true);
    try {
      const hasOverlay = await UssdBridge.checkOverlayPermission();
      if (!hasOverlay) {
        setChecking(false);
        setPermModal('overlay');
        return;
      }
      const hasAccessibility = await UssdBridge.checkAccessibilityEnabled();
      if (!hasAccessibility) {
        setChecking(false);
        setPermModal('accessibility');
        return;
      }
    } catch {}
    setChecking(false);
    router.push({ pathname: '/ussd-session', params: { service: service.id, code: service.code } });
  };

  const handleGrantOverlay = async () => {
    setPermModal(null);
    await UssdBridge.requestOverlayPermission();
  };

  const handleGrantAccessibility = async () => {
    setPermModal(null);
    await UssdBridge.openAccessibilitySettings();
  };

  const proceedDemoMode = () => {
    setPermModal(null);
    if (pendingService) {
      router.push({ pathname: '/ussd-session', params: { service: pendingService.id, code: pendingService.code, demo: '1' } });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) + 16,
            paddingBottom: insets.bottom + 90,
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.appTitle, { color: palette.foreground }]}>خدمات USSD</Text>
          <Text style={[styles.appSubtitle, { color: palette.mutedForeground }]}>
            اختر خدمة للبدء
          </Text>
        </View>

        {!UssdBridge.isAvailable && (
          <View style={[styles.demoBanner, { backgroundColor: palette.accent, borderColor: palette.primary }]}>
            <Feather name="info" size={16} color={palette.primary} />
            <Text style={[styles.demoText, { color: palette.primary }]}>
              وضع المعاينة — يتطلب هاتف أندرويد حقيقي للعمل الكامل
            </Text>
          </View>
        )}

        <View style={styles.services}>
          {SERVICES.map(service => (
            <ServiceCard
              key={service.id}
              service={service}
              onPress={handleServicePress}
            />
          ))}
        </View>

        <View style={[styles.infoCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Feather name="shield" size={18} color={palette.mutedForeground} />
          <Text style={[styles.infoText, { color: palette.mutedForeground }]}>
            التطبيق لا يتصل بالإنترنت. جميع العمليات تتم عبر شبكة الجوال فقط.
          </Text>
        </View>
      </ScrollView>

      {checking && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.loadingText, { color: palette.foreground }]}>جاري التحقق من الصلاحيات...</Text>
        </View>
      )}

      <PermissionModal
        visible={permModal === 'overlay'}
        title="صلاحية العرض فوق التطبيقات"
        description="يحتاج التطبيق صلاحية الرسم فوق التطبيقات لإخفاء نافذة USSD النظامية وعرض واجهتنا بدلاً منها."
        icon="layers"
        palette={palette}
        onGrant={handleGrantOverlay}
        onDemo={proceedDemoMode}
      />
      <PermissionModal
        visible={permModal === 'accessibility'}
        title="خدمة إمكانية الوصول"
        description={
          'يحتاج التطبيق تفعيل خدمة إمكانية الوصول الخاصة به حتى يتمكن من:\n' +
          '• قراءة نص شاشات USSD تلقائياً\n' +
          '• إرسال ردودك إلى الشبكة\n\n' +
          'لن يتم قراءة أي بيانات أخرى من هاتفك.'
        }
        icon="sliders"
        palette={palette}
        onGrant={handleGrantAccessibility}
        onDemo={proceedDemoMode}
      />
    </View>
  );
}

interface PermModalProps {
  visible: boolean;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  palette: typeof colors.light;
  onGrant: () => void;
  onDemo: () => void;
}

function PermissionModal({ visible, title, description, icon, palette, onGrant, onDemo }: PermModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: palette.card }]}>
          <View style={[styles.modalIcon, { backgroundColor: palette.accent }]}>
            <Feather name={icon} size={32} color={palette.primary} />
          </View>
          <Text style={[styles.modalTitle, { color: palette.foreground }]}>{title}</Text>
          <Text style={[styles.modalDesc, { color: palette.mutedForeground }]}>{description}</Text>
          <Pressable
            onPress={onGrant}
            style={[styles.modalBtn, { backgroundColor: palette.primary }]}
          >
            <Text style={styles.modalBtnTxt}>الذهاب إلى الإعدادات</Text>
          </Pressable>
          <Pressable onPress={onDemo} style={styles.modalLater}>
            <Text style={[styles.modalLaterTxt, { color: palette.mutedForeground }]}>جرّب وضع المعاينة</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 18 },
  header: { marginBottom: 22, alignItems: 'flex-end' },
  appTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  appSubtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', marginTop: 4, textAlign: 'right' },
  demoBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  demoText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1, textAlign: 'right', writingDirection: 'rtl' },
  services: { gap: 2 },
  infoCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 16,
    gap: 10,
  },
  infoText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1, textAlign: 'right', writingDirection: 'rtl' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  modalIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 10 },
  modalDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 24, writingDirection: 'rtl' },
  modalBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 10 },
  modalBtnTxt: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  modalLater: { padding: 8 },
  modalLaterTxt: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
