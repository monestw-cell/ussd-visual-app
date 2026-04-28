import React from 'react';
import { View, Text, StyleSheet, Pressable, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';

export interface Service {
  id: 'palestine' | 'jawwal' | 'palPay';
  name: string;
  subtitle: string;
  code: string;
  activeColor: string;
  iconName: keyof typeof Feather.glyphMap;
  active: boolean;
}

interface Props {
  service: Service;
  onPress: (service: Service) => void;
}

export default function ServiceCard({ service, onPress }: Props) {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? colors.dark : colors.light;

  const handlePress = () => {
    if (!service.active) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress(service);
  };

  const bgColor = service.active ? service.activeColor : palette.disabledBg;
  const textColor = service.active ? '#ffffff' : palette.mutedForeground;
  const iconColor = service.active ? '#ffffff' : palette.disabled;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: bgColor, opacity: pressed ? 0.85 : 1 },
        !service.active && styles.disabled,
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
        <Feather name={service.iconName} size={32} color={iconColor} />
      </View>
      <Text style={[styles.name, { color: textColor }]}>{service.name}</Text>
      <Text style={[styles.subtitle, { color: service.active ? 'rgba(255,255,255,0.75)' : palette.mutedForeground }]}>
        {service.subtitle}
      </Text>
      {!service.active && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>متوقف</Text>
        </View>
      )}
      {service.active && (
        <View style={styles.arrow}>
          <Feather name="chevron-left" size={18} color="rgba(255,255,255,0.6)" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    minHeight: 110,
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  disabled: {
    shadowOpacity: 0.05,
    elevation: 2,
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  name: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 3,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  arrow: {
    position: 'absolute',
    left: 16,
    top: '50%',
  },
});
