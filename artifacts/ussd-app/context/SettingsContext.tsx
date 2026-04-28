import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { HistoryDb } from '@/database/historyDb';

const SETTINGS_KEY = '@ussd_settings_v1';

interface Settings {
  palestineSimSlot: number;
  jawwalSimSlot: number;
  biometricsEnabled: boolean;
  savePinEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
}

const defaultSettings: Settings = {
  palestineSimSlot: -1,
  jawwalSimSlot: -1,
  biometricsEnabled: false,
  savePinEnabled: false,
  theme: 'system',
};

interface SettingsContextType {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  clearAll: () => Promise<void>;
  savePin: (service: 'palestine' | 'jawwal', pin: string) => Promise<void>;
  getPin: (service: 'palestine' | 'jawwal') => Promise<string | null>;
  getPinWithBiometric: (service: 'palestine' | 'jawwal') => Promise<string | null>;
  clearPin: (service: 'palestine' | 'jawwal') => Promise<void>;
  isBiometricAvailable: () => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const PIN_SECURE_KEY = (s: string) => `ussd_pin_${s}`;

const isWeb = Platform.OS === 'web';

async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(`@secure_${key}`, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function secureGet(key: string): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem(`@secure_${key}`);
  }
  return SecureStore.getItemAsync(key);
}

async function secureDelete(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(`@secure_${key}`);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (raw) {
        try {
          setSettings({ ...defaultSettings, ...JSON.parse(raw) });
        } catch {}
      }
    });
  }, []);

  const updateSettings = async (partial: Partial<Settings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const clearAll = async () => {
    setSettings(defaultSettings);
    await AsyncStorage.multiRemove([SETTINGS_KEY, '@ussd_history_v2', '@ussd_history_v1']);
    await secureDelete(PIN_SECURE_KEY('palestine'));
    await secureDelete(PIN_SECURE_KEY('jawwal'));
    await HistoryDb.clear();
  };

  const savePin = async (service: 'palestine' | 'jawwal', pin: string) => {
    await secureSet(PIN_SECURE_KEY(service), pin);
  };

  const getPin = async (service: 'palestine' | 'jawwal'): Promise<string | null> => {
    return secureGet(PIN_SECURE_KEY(service));
  };

  const getPinWithBiometric = async (service: 'palestine' | 'jawwal'): Promise<string | null> => {
    if (isWeb) return secureGet(PIN_SECURE_KEY(service));
    const settingsRef = await AsyncStorage.getItem(SETTINGS_KEY);
    let biometricsEnabled = false;
    try { biometricsEnabled = settingsRef ? JSON.parse(settingsRef).biometricsEnabled : false; } catch {}
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!compatible || !enrolled || !biometricsEnabled) {
      return secureGet(PIN_SECURE_KEY(service));
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'تحقق من هويتك لاستخدام الرقم السري المحفوظ',
      cancelLabel: 'إلغاء',
      disableDeviceFallback: false,
    });
    if (!result.success) return null;
    return secureGet(PIN_SECURE_KEY(service));
  };

  const clearPin = async (service: 'palestine' | 'jawwal') => {
    await secureDelete(PIN_SECURE_KEY(service));
  };

  const isBiometricAvailable = async (): Promise<boolean> => {
    if (isWeb) return false;
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  };

  return (
    <SettingsContext.Provider value={{
      settings, updateSettings, clearAll,
      savePin, getPin, getPinWithBiometric, clearPin, isBiometricAvailable
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
