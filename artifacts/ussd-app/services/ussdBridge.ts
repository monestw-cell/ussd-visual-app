import { NativeModules, NativeEventEmitter, Platform, EmitterSubscription } from 'react-native';

export const USSD_EVENT_SCREEN = 'USSD_SCREEN_TEXT';
export const USSD_EVENT_SESSION_END = 'USSD_SESSION_ENDED';
export const USSD_EVENT_ERROR = 'USSD_ERROR';
export const USSD_EVENT_FOREGROUND = 'USSD_BRING_FOREGROUND';

const { UssdNativeModule } = NativeModules;

const isNativeAvailable = Platform.OS === 'android' && !!UssdNativeModule;

let emitter: NativeEventEmitter | null = null;
if (isNativeAvailable) {
  try {
    emitter = new NativeEventEmitter(UssdNativeModule);
  } catch (_e) {}
}

function noopSub(): EmitterSubscription {
  return { remove: () => {} } as EmitterSubscription;
}

export const UssdBridge = {
  isAvailable: isNativeAvailable,

  async startUssd(code: string, simSlot = -1): Promise<boolean> {
    if (!isNativeAvailable) return false;
    return UssdNativeModule.startUssd(code, simSlot);
  },

  async sendReply(text: string): Promise<boolean> {
    if (!isNativeAvailable) return false;
    return UssdNativeModule.sendUssdReply(text);
  },

  async cancelSession(): Promise<void> {
    if (!isNativeAvailable) return;
    return UssdNativeModule.cancelSession();
  },

  async checkOverlayPermission(): Promise<boolean> {
    if (!isNativeAvailable) return false;
    return UssdNativeModule.checkOverlayPermission();
  },

  async checkAccessibilityEnabled(): Promise<boolean> {
    if (!isNativeAvailable) return false;
    return UssdNativeModule.checkAccessibilityEnabled();
  },

  async requestOverlayPermission(): Promise<void> {
    if (!isNativeAvailable) return;
    return UssdNativeModule.requestOverlayPermission();
  },

  async openAccessibilitySettings(): Promise<void> {
    if (!isNativeAvailable) return;
    return UssdNativeModule.openAccessibilitySettings();
  },

  onScreen(callback: (text: string) => void): EmitterSubscription {
    if (!emitter) return noopSub();
    return emitter.addListener(USSD_EVENT_SCREEN, callback);
  },

  onSessionEnd(callback: (data: { reason: string }) => void): EmitterSubscription {
    if (!emitter) return noopSub();
    return emitter.addListener(USSD_EVENT_SESSION_END, callback);
  },

  onError(callback: (error: { message: string }) => void): EmitterSubscription {
    if (!emitter) return noopSub();
    return emitter.addListener(USSD_EVENT_ERROR, callback);
  },

  onBringForeground(callback: () => void): EmitterSubscription {
    if (!emitter) return noopSub();
    return emitter.addListener(USSD_EVENT_FOREGROUND, callback);
  },
};
