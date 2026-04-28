export type ScreenType = 'menu' | 'input' | 'confirm' | 'result' | 'loading' | 'unknown';
export type InputType = 'pin' | 'phone' | 'amount' | 'account' | 'text';

export interface MenuItem {
  key: string;
  label: string;
}

export interface ParsedScreen {
  type: ScreenType;
  rawText: string;
  title?: string;
  message?: string;
  items?: MenuItem[];
  inputType?: InputType;
  quickAmounts?: number[];
  isSuccess?: boolean;
  resultMessage?: string;
}

const SUCCESS_KEYWORDS = [
  'تمت العملية', 'تم التحويل', 'نجحت', 'تمت بنجاح', 'تم الدفع',
  'تم الشحن', 'تمت بصورة', 'عملية ناجحة', 'تمت عملية'
];
const FAIL_KEYWORDS = [
  'خطأ', 'فشل', 'غير صحيح', 'رصيد غير كافٍ', 'رصيد غير كاف',
  'غير كاف', 'لا يوجد', 'رقم غير', 'غير مسجل', 'انتهت الجلسة'
];
const PIN_KEYWORDS = ['كلمة السر', 'الرقم السري', 'رقم السر', 'كلمتك السرية', 'PIN', 'أدخل رمز'];
const PHONE_KEYWORDS = ['رقم الجوال', 'رقم الهاتف', 'رقم المستلم', 'رقم المحفظة', 'أدخل رقم الجوال'];
const AMOUNT_KEYWORDS = ['أدخل المبلغ', 'المبلغ المطلوب', 'قيمة التحويل', 'مبلغ'];
const ACCOUNT_KEYWORDS = ['اختر الحساب', 'من أي حساب', 'الحساب المصدر'];

export function parseUssdText(raw: string): ParsedScreen {
  const text = raw.trim();
  if (!text) return { type: 'loading', rawText: '' };

  for (const kw of SUCCESS_KEYWORDS) {
    if (text.includes(kw)) {
      return { type: 'result', rawText: text, isSuccess: true, resultMessage: text };
    }
  }
  for (const kw of FAIL_KEYWORDS) {
    if (text.includes(kw)) {
      return { type: 'result', rawText: text, isSuccess: false, resultMessage: text };
    }
  }

  const menuRegex = /^([0-9]+|#|\*)\.?\s+(.+)$/gm;
  const items: MenuItem[] = [];
  let match: RegExpExecArray | null;
  const textCopy = text;
  const re = new RegExp(menuRegex.source, menuRegex.flags);
  while ((match = re.exec(textCopy)) !== null) {
    items.push({ key: match[1], label: match[2].trim() });
  }

  if (items.length >= 2) {
    const isConfirm =
      items.length === 2 &&
      (items[0].label.includes('تأكيد') || items[0].label.includes('نعم') || items[0].key === '1') &&
      (items[1].label.includes('إلغاء') || items[1].label.includes('لا') || items[1].key === '2');
    if (isConfirm) {
      const lines = text.split('\n');
      const nonMenu = lines.filter(l => !l.match(/^([0-9]+|#|\*)\.?\s+/)).join('\n').trim();
      return { type: 'confirm', rawText: text, message: nonMenu || text, items };
    }
    const lines = text.split('\n');
    const nonMenu = lines.filter(l => !l.match(/^([0-9]+|#|\*)\.?\s+/)).join('\n').trim();
    return { type: 'menu', rawText: text, title: nonMenu, items };
  }

  for (const kw of PIN_KEYWORDS) {
    if (text.includes(kw)) {
      return { type: 'input', rawText: text, message: text, inputType: 'pin' };
    }
  }
  for (const kw of PHONE_KEYWORDS) {
    if (text.includes(kw)) {
      return { type: 'input', rawText: text, message: text, inputType: 'phone' };
    }
  }
  for (const kw of AMOUNT_KEYWORDS) {
    if (text.includes(kw)) {
      return {
        type: 'input',
        rawText: text,
        message: text,
        inputType: 'amount',
        quickAmounts: [10, 20, 50, 100, 200],
      };
    }
  }
  for (const kw of ACCOUNT_KEYWORDS) {
    if (text.includes(kw) && items.length >= 1) {
      return { type: 'menu', rawText: text, message: text, items };
    }
  }

  if (text.includes('أدخل') || text.includes('اكتب') || text.includes('أرسل')) {
    return { type: 'input', rawText: text, message: text, inputType: 'text' };
  }

  if (items.length === 1) {
    return { type: 'menu', rawText: text, items };
  }

  return { type: 'unknown', rawText: text, message: text };
}

export function getMenuItemIcon(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('كشف') || l.includes('حركات')) return 'file-text';
  if (l.includes('رصيد') || l.includes('الأرصدة')) return 'credit-card';
  if (l.includes('تحويل')) return 'send';
  if (l.includes('دفع') || l.includes('سداد')) return 'dollar-sign';
  if (l.includes('شحن') || l.includes('رصيد الجوال')) return 'smartphone';
  if (l.includes('تأكيد') || l.includes('نعم')) return 'check-circle';
  if (l.includes('إلغاء') || l.includes('لا') || l.includes('إلغ')) return 'x-circle';
  if (l.includes('مزيد') || l.includes('المزيد')) return 'more-horizontal';
  if (l.includes('رجوع') || l.includes('الرئيسية') || l.includes('0')) return 'arrow-left';
  if (l.includes('اشتراك') || l.includes('خدمات')) return 'grid';
  if (l.includes('حساب')) return 'briefcase';
  if (l.includes('قرض')) return 'trending-up';
  if (l.includes('فاتورة')) return 'file';
  return 'circle';
}
