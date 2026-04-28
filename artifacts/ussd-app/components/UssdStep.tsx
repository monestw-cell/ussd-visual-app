import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, useColorScheme, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import colors from '@/constants/colors';
import { ParsedScreen } from '@/utils/ussdParser';
import OptionGrid from './OptionGrid';
import { useSettings } from '@/context/SettingsContext';
import { useSession } from '@/context/SessionContext';

interface Props {
  screen: ParsedScreen;
  onReply: (text: string) => void;
  isLoading?: boolean;
}

const QUICK_AMOUNTS = [10, 20, 50, 100, 200];

export default function UssdStep({ screen, onReply, isLoading = false }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [hasSavedPin, setHasSavedPin] = useState(false);
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? colors.dark : colors.light;
  const { getPin, getPinWithBiometric, savePin, isBiometricAvailable } = useSettings();
  const session = useSession();

  const isPin = screen.inputType === 'pin';
  const isAmount = screen.inputType === 'amount';
  const isPhone = screen.inputType === 'phone';

  useEffect(() => {
    if (isPin && session.service) {
      getPin(session.service).then(pin => setHasSavedPin(!!pin));
    }
  }, [isPin, session.service]);

  const handleSend = () => {
    const pin = inputValue.trim();
    if (!pin) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onReply(pin);
    setInputValue('');
    if (isPin && !hasSavedPin && session.service) {
      handleOfferSavePin(pin);
    }
  };

  const handleBiometricAutoFill = useCallback(async () => {
    if (!session.service) return;
    Haptics.selectionAsync();
    const pin = await getPinWithBiometric(session.service);
    if (pin) {
      setInputValue(pin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('تعذّر استرجاع الرقم السري', 'تأكد من تفعيل البصمة أو التعرف على الوجه في إعدادات الجهاز.');
    }
  }, [session.service, getPinWithBiometric]);

  const handleOfferSavePin = (pin: string) => {
    if (!session.service) return;
    Alert.alert(
      'حفظ الرقم السري',
      'هل تريد حفظ هذا الرقم السري لاستخدامه بالبصمة في المرة القادمة؟',
      [
        { text: 'لا', style: 'cancel' },
        {
          text: 'نعم، احفظه',
          onPress: async () => {
            await savePin(session.service!, pin);
            setHasSavedPin(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('تم الحفظ', 'سيتم طلب البصمة عند الاستخدام التالي.');
          }
        }
      ]
    );
  };

  if (screen.type === 'menu' || screen.type === 'confirm') {
    return (
      <View>
        {screen.title ? (
          <Text style={[styles.prompt, { color: palette.mutedForeground }]}>{screen.title}</Text>
        ) : null}
        {screen.message && !screen.title && (
          <Text style={[styles.prompt, { color: palette.mutedForeground }]}>{screen.message}</Text>
        )}
        <OptionGrid items={screen.items ?? []} onSelect={onReply} disabled={isLoading} />
      </View>
    );
  }

  if (screen.type === 'input') {
    return (
      <KeyboardAwareScrollViewCompat keyboardShouldPersistTaps="handled" bottomOffset={20}>
        <Text style={[styles.prompt, { color: palette.foreground }]}>{screen.message}</Text>

        {isAmount && (
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map(amt => (
              <Pressable
                key={amt}
                onPress={() => { Haptics.selectionAsync(); setInputValue(String(amt)); }}
                style={[styles.quickBtn, { backgroundColor: palette.accent, borderColor: palette.border }]}
              >
                <Text style={[styles.quickTxt, { color: palette.primary }]}>{amt}₪</Text>
              </Pressable>
            ))}
          </View>
        )}

        {isPin && hasSavedPin && (
          <Pressable
            onPress={handleBiometricAutoFill}
            style={[styles.biometricBtn, { backgroundColor: palette.accent, borderColor: palette.primary }]}
          >
            <Feather name="lock" size={18} color={palette.primary} />
            <Text style={[styles.biometricTxt, { color: palette.primary }]}>
              استخدام الرقم السري المحفوظ
            </Text>
          </Pressable>
        )}

        <View style={[styles.inputRow, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <TextInput
            style={[styles.input, { color: palette.foreground, textAlign: 'right' }]}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder={isPin ? '••••' : isPhone ? 'رقم الجوال' : isAmount ? '0.00' : 'اكتب هنا...'}
            placeholderTextColor={palette.mutedForeground}
            secureTextEntry={isPin && !showPin}
            keyboardType={isPin || isAmount ? 'numeric' : isPhone ? 'phone-pad' : 'default'}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            autoFocus
          />
          {isPin && (
            <Pressable onPress={() => setShowPin(v => !v)} style={styles.eyeBtn}>
              <Feather name={showPin ? 'eye-off' : 'eye'} size={20} color={palette.mutedForeground} />
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={handleSend}
          disabled={isLoading || !inputValue.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: palette.primary, opacity: (isLoading || !inputValue.trim()) ? 0.5 : pressed ? 0.85 : 1 }
          ]}
        >
          <Text style={styles.sendTxt}>إرسال</Text>
          <Feather name="send" size={18} color="#fff" style={{ marginRight: 6 }} />
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    );
  }

  if (screen.type === 'result') {
    const success = screen.isSuccess;
    const iconName: keyof typeof Feather.glyphMap = success ? 'check-circle' : 'x-circle';
    const iconColor = success ? palette.success : palette.destructive;
    return (
      <View style={styles.resultContainer}>
        <View style={[styles.resultIcon, { backgroundColor: `${iconColor}18` }]}>
          <Feather name={iconName} size={60} color={iconColor} />
        </View>
        <Text style={[styles.resultTitle, { color: iconColor }]}>
          {success ? 'تمت العملية بنجاح' : 'فشلت العملية'}
        </Text>
        <Text style={[styles.resultMsg, { color: palette.mutedForeground }]}>
          {screen.resultMessage}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.unknownContainer}>
      <Text style={[styles.prompt, { color: palette.foreground }]}>{screen.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    lineHeight: 24,
    marginBottom: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  quickBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  quickTxt: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  biometricBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 8,
    justifyContent: 'center',
  },
  biometricTxt: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    marginBottom: 16,
    minHeight: 56,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 14,
  },
  eyeBtn: {
    padding: 8,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  sendTxt: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  resultContainer: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 30,
  },
  resultIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
  },
  resultMsg: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    writingDirection: 'rtl',
  },
  unknownContainer: {
    paddingTop: 10,
  },
});
