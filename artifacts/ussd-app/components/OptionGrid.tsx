import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { MenuItem, getMenuItemIcon } from '@/utils/ussdParser';

interface Props {
  items: MenuItem[];
  onSelect: (key: string) => void;
  disabled?: boolean;
}

export default function OptionGrid({ items, onSelect, disabled = false }: Props) {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? colors.dark : colors.light;

  const handlePress = (key: string) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(key);
  };

  return (
    <View style={styles.grid}>
      {items.map(item => {
        const iconName = getMenuItemIcon(item.label) as keyof typeof Feather.glyphMap;
        const isBack = item.key === '0';
        const isCancel = item.label.includes('إلغاء') || item.label.includes('لا');
        const isConfirm = item.label.includes('تأكيد') || item.label.includes('نعم');

        let cardBg = palette.card;
        let cardBorder = palette.border;
        let textColor = palette.foreground;
        let iconColor = palette.primary;

        if (isBack) { cardBg = palette.muted; iconColor = palette.mutedForeground; textColor = palette.mutedForeground; }
        if (isCancel) { cardBg = '#FEF2F2'; cardBorder = '#FECACA'; iconColor = palette.destructive; textColor = palette.destructive; }
        if (isConfirm) { cardBg = '#F0FFF4'; cardBorder = '#BBF7D0'; iconColor = palette.success; textColor = palette.success; }
        if (scheme === 'dark' && isCancel) { cardBg = '#3B0A0A'; cardBorder = '#7F1D1D'; }
        if (scheme === 'dark' && isConfirm) { cardBg = '#052E16'; cardBorder = '#14532D'; }

        return (
          <Pressable
            key={item.key}
            onPress={() => handlePress(item.key)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
                opacity: pressed ? 0.7 : disabled ? 0.5 : 1,
              }
            ]}
          >
            <View style={[styles.iconBg, { backgroundColor: `${iconColor}18` }]}>
              <Feather name={iconName} size={24} color={iconColor} />
            </View>
            <Text style={[styles.label, { color: textColor }]} numberOfLines={2}>
              {item.label}
            </Text>
            <Text style={[styles.key, { color: palette.mutedForeground }]}>
              {item.key}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 8,
  },
  item: {
    width: '48%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  key: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
});
