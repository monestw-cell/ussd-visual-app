import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { UssdBridge } from '@/services/ussdBridge';
import { parseUssdText, ParsedScreen } from '@/utils/ussdParser';
import { HistoryDb } from '@/database/historyDb';

export type SessionStatus =
  | 'idle'
  | 'checking_permissions'
  | 'connecting'
  | 'active'
  | 'ended'
  | 'error';

export type ServiceId = 'palestine' | 'jawwal';

export interface SessionContextType {
  status: SessionStatus;
  service: ServiceId | null;
  serviceCode: string;
  currentScreen: ParsedScreen | null;
  stepCount: number;
  sessionLog: string[];
  error: string | null;
  demoMode: boolean;
  startSession: (service: ServiceId, code: string, simSlot?: number, forceDemo?: boolean) => Promise<void>;
  sendReply: (text: string) => Promise<void>;
  cancelSession: () => void;
  clearError: () => void;
  resetSession: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

const DEMO_FLOWS: Record<ServiceId, string[]> = {
  palestine: [
    'أهلاً بك في بنك فلسطين\nأدخل كلمة السر:',
    '1. كشف حساب\n2. الأرصدة\n3. التحويلات\n4. خدمات أخرى\n#. المزيد\n0. خروج',
    'التحويلات:\n1. تحويل لعميل بنك فلسطين\n2. تحويل لبنك آخر\n0. رجوع',
    'أدخل رقم جوال المستلم:',
    'اسم المستلم: محمد أحمد\n1. تأكيد\n2. إلغاء',
    'أدخل المبلغ:',
    'اختر الحساب:\n1. حساب رقم ****1234\n2. حساب رقم ****5678',
    'أدخل كلمة السر مرة أخرى:',
    'تمت عملية التحويل بنجاح!\nرقم العملية: 987654\nالمبلغ المحوّل: 50 شيكل\nإلى: محمد أحمد',
  ],
  jawwal: [
    'أهلاً بك في جوال باي\nأدخل الرقم السري:',
    '1. رصيدي\n2. تحويل رصيد\n3. شراء باقة\n4. دفع فاتورة\n5. تاريخ العمليات\n0. خروج',
    'أدخل رقم الجوال المراد الشحن إليه:',
    'الرقم: 059****78\nالاسم: علي محمود\n1. تأكيد\n2. إلغاء',
    'أدخل المبلغ:',
    'أدخل الرقم السري للتأكيد:',
    'تمت عملية الشحن بنجاح!\nرقم العملية: 123456\nالمبلغ: 20 شيكل\nإلى: علي محمود',
  ],
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [service, setService] = useState<ServiceId | null>(null);
  const [serviceCode, setServiceCode] = useState('');
  const [currentScreen, setCurrentScreen] = useState<ParsedScreen | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const demoStepRef = useRef(0);
  const subsRef = useRef<{ remove: () => void }[]>([]);
  const sessionServiceRef = useRef<ServiceId | null>(null);

  const addLog = (text: string) => {
    setSessionLog(prev => [...prev, text]);
  };

  const applyScreen = useCallback((rawText: string) => {
    const parsed = parseUssdText(rawText);
    setCurrentScreen(parsed);
    setStepCount(prev => prev + 1);
    addLog(rawText);
    if (parsed.type === 'result') {
      setStatus('ended');
      if (sessionServiceRef.current) {
        const extracted = extractResultFields(rawText);
        HistoryDb.save({
          service: sessionServiceRef.current,
          type: detectOperationType(sessionLog),
          status: parsed.isSuccess ? 'success' : 'failed',
          description: parsed.resultMessage?.substring(0, 100),
          amount: extracted.amount,
          recipientLast4: extracted.recipientLast4,
          refNumber: extracted.refNumber,
        }).catch(() => {});
      }
    } else {
      setStatus('active');
    }
  }, [sessionLog]);

  const clearSubs = () => {
    subsRef.current.forEach(s => s.remove());
    subsRef.current = [];
  };

  const startSession = async (svc: ServiceId, code: string, simSlot = -1, forceDemo = false) => {
    setService(svc);
    setServiceCode(code);
    setStepCount(0);
    setSessionLog([]);
    setCurrentScreen(null);
    setError(null);
    sessionServiceRef.current = svc;
    clearSubs();

    if (forceDemo || !UssdBridge.isAvailable) {
      setDemoMode(true);
      demoStepRef.current = 0;
      setStatus('connecting');
      setTimeout(() => {
        const firstStep = DEMO_FLOWS[svc][0];
        applyScreen(firstStep);
      }, 1000);
      return;
    }

    setDemoMode(false);
    setStatus('connecting');

    if (Platform.OS === 'android') {
      try {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CALL_PHONE,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        ]);
        const callOk = results[PermissionsAndroid.PERMISSIONS.CALL_PHONE] === PermissionsAndroid.RESULTS.GRANTED;
        const phoneStateOk = results[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] === PermissionsAndroid.RESULTS.GRANTED;
        if (!callOk || !phoneStateOk) {
          const missing = [
            !callOk && 'الاتصال',
            !phoneStateOk && 'قراءة حالة الهاتف',
          ].filter(Boolean).join(' و ');
          setError(`لم يتم منح إذن ${missing}. لا يمكن بدء جلسة USSD بدونه.`);
          setStatus('error');
          return;
        }
      } catch (e) {
        setError('فشل طلب أذونات الهاتف.');
        setStatus('error');
        return;
      }
    }

    const screenSub = UssdBridge.onScreen(rawText => applyScreen(rawText));
    const endSub = UssdBridge.onSessionEnd(data => {
      setStatus('ended');
      // user_cancelled is handled by cancelSession(); network/timeout ends
      // reach here and should be saved as 'failed' (not 'cancelled')
      if (data.reason !== 'user_cancelled') {
        HistoryDb.save({
          service: svc,
          type: detectOperationType(sessionLog),
          status: 'failed',
          description: `انتهت الجلسة: ${data.reason}`,
        }).catch(() => {});
      }
    });
    const errSub = UssdBridge.onError(err => {
      setError(err.message);
      setStatus('error');
    });

    subsRef.current = [screenSub, endSub, errSub];

    try {
      await UssdBridge.startUssd(code, simSlot);
    } catch (e: any) {
      const detail = e?.message || e?.code || String(e);
      setError(`فشل في بدء الجلسة: ${detail}`);
      setStatus('error');
    }
  };

  const sendReply = async (text: string) => {
    if (demoMode) {
      demoStepRef.current += 1;
      const flow = DEMO_FLOWS[service ?? 'palestine'];
      const nextStep = flow[demoStepRef.current];
      if (nextStep) {
        setStatus('connecting');
        setTimeout(() => applyScreen(nextStep), 800);
      }
      return;
    }
    try {
      await UssdBridge.sendReply(text);
      setStatus('connecting');
    } catch (e) {
      setError('فشل في إرسال الرد. يرجى المحاولة مجدداً.');
    }
  };

  const cancelSession = useCallback(() => {
    if (!demoMode) {
      UssdBridge.cancelSession().catch(() => {});
    }
    clearSubs();
    setStatus('ended');
    setCurrentScreen({ type: 'result', rawText: '', isSuccess: false, resultMessage: 'تم إلغاء الجلسة' });
    if (sessionServiceRef.current) {
      HistoryDb.save({ service: sessionServiceRef.current, type: 'cancelled', status: 'cancelled' }).catch(() => {});
    }
  }, [demoMode]);

  const clearError = () => setError(null);

  const resetSession = useCallback(() => {
    clearSubs();
    setStatus('idle');
    setService(null);
    setServiceCode('');
    setCurrentScreen(null);
    setStepCount(0);
    setSessionLog([]);
    setError(null);
    setDemoMode(false);
  }, []);

  useEffect(() => () => clearSubs(), []);

  return (
    <SessionContext.Provider value={{
      status, service, serviceCode, currentScreen, stepCount,
      sessionLog, error, demoMode, startSession, sendReply,
      cancelSession, clearError, resetSession
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

function detectOperationType(log: string[]): string {
  const combined = log.join(' ');
  if (combined.includes('تحويل')) return 'transfer';
  if (combined.includes('شحن') || combined.includes('رصيد الجوال')) return 'topup';
  if (combined.includes('دفع') || combined.includes('فاتورة')) return 'payment';
  if (combined.includes('كشف') || combined.includes('حركات')) return 'statement';
  if (combined.includes('رصيد')) return 'balance';
  return 'other';
}

interface ResultFields {
  amount?: string;
  recipientLast4?: string;
  refNumber?: string;
}

/**
 * Parse common Arabic USSD result text for structured fields.
 * Patterns handled:
 *   المبلغ: 50 شيكل / المبلغ المحوّل: 50 شيكل / المبلغ: 50
 *   إلى: ****1234 / الرقم: 059****78 → last 4 digits
 *   رقم العملية: 987654
 */
function extractResultFields(text: string): ResultFields {
  const result: ResultFields = {};

  // Amount — digits possibly followed by currency (شيكل, ₪, NIS, ILS, شيكل)
  const amountMatch = text.match(/المبلغ[^:\n]*[:：]\s*([\d.,]+)\s*(شيكل|₪|NIS|ILS)?/);
  if (amountMatch) {
    result.amount = amountMatch[2]
      ? `${amountMatch[1]} ${amountMatch[2]}`
      : amountMatch[1];
  }

  // Reference number (رقم العملية / رقم المرجع / ref)
  const refMatch = text.match(/رقم العملية[:：\s]*([\d\w]+)/);
  if (refMatch) result.refNumber = refMatch[1];

  // Recipient last-4: masked patterns like ****1234 or 059****78
  const recipientMatch = text.match(/\*{2,}(\d{4})/);
  if (recipientMatch) {
    result.recipientLast4 = recipientMatch[1];
  } else {
    // Full phone: 059XXXXXXXX — take last 4
    const phoneMatch = text.match(/05\d{8}/);
    if (phoneMatch) {
      result.recipientLast4 = phoneMatch[0].slice(-4);
    }
  }

  return result;
}
