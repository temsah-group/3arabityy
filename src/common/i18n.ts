/** Languages the API answers in, picked from the request's Accept-Language. */
export type Lang = 'ar' | 'en';

export function resolveLang(header: string | undefined): Lang {
  // The app sends a bare code ("ar" / "en"); browsers send a weighted list.
  const first = header?.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'ar';
}

const messages = {
  ok: { ar: 'تمت العملية بنجاح', en: 'Done' },
  'error.unexpected': {
    ar: 'حدث خطأ غير متوقع، حاول مرة أخرى',
    en: 'Something went wrong, please try again',
  },
  'error.notFound': { ar: 'المسار غير موجود', en: 'Route not found' },
  'error.validation': { ar: 'البيانات المرسلة غير صحيحة', en: 'The request is not valid' },
  'error.bodyTooLarge': { ar: 'حجم الطلب كبير جداً', en: 'The request is too large' },
  'error.invalidJson': { ar: 'صيغة الطلب غير صحيحة', en: 'The request body is not valid JSON' },
  'error.rateLimited': {
    ar: 'تم تجاوز عدد المحاولات المسموح بها، يرجى الانتظار قليلاً',
    en: 'Too many attempts, please wait a moment',
  },

  'validation.required': { ar: 'هذا الحقل مطلوب', en: 'This field is required' },
  'validation.email': {
    ar: 'يرجى إدخال بريد إلكتروني صحيح',
    en: 'Please enter a valid email address',
  },
  'validation.phone': {
    ar: 'يرجى إدخال رقم هاتف صحيح',
    en: 'Please enter a valid phone number',
  },
  'validation.fullName': {
    ar: 'يرجى إدخال الاسم كاملاً (3 أحرف على الأقل)',
    en: 'Please enter your full name (at least 3 characters)',
  },
  'validation.passwordShort': {
    ar: 'كلمة المرور يجب أن لا تقل عن 8 خانات',
    en: 'The password must be at least 8 characters',
  },
  'validation.passwordLong': {
    ar: 'كلمة المرور طويلة جداً',
    en: 'The password is too long',
  },
  'validation.passwordMismatch': {
    ar: 'كلمتا المرور غير متطابقتين',
    en: 'The passwords do not match',
  },
  'validation.otp': {
    ar: 'رمز التحقق يتكون من 6 أرقام',
    en: 'The verification code has 6 digits',
  },
  'validation.purpose': { ar: 'نوع الرمز غير صحيح', en: 'Unknown code purpose' },
  'validation.unknownField': { ar: 'حقل غير مسموح به', en: 'Field not allowed' },

  'auth.registered': {
    ar: 'تم إنشاء الحساب، أرسلنا رمز التحقق إلى بريدك الإلكتروني',
    en: 'Account created. We sent a verification code to your email',
  },
  'auth.emailTaken': {
    ar: 'هذا البريد الإلكتروني مسجل بالفعل، سجل دخولك',
    en: 'This email is already registered. Please sign in',
  },
  'auth.invalidCredentials': {
    ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    en: 'The email or password is incorrect',
  },
  'auth.accountLocked': {
    ar: 'تم إيقاف تسجيل الدخول مؤقتاً بسبب محاولات خاطئة متكررة، حاول بعد {0} دقيقة',
    en: 'Sign-in is paused after repeated wrong attempts. Try again in {0} minutes',
  },
  'auth.notVerified': {
    ar: 'لم يتم تأكيد بريدك الإلكتروني بعد، أرسلنا لك رمز التحقق',
    en: 'Your email is not confirmed yet. We sent you a verification code',
  },
  'auth.suspended': {
    ar: 'تم إيقاف هذا الحساب، تواصل مع الدعم',
    en: 'This account is suspended. Please contact support',
  },
  'auth.loggedIn': { ar: 'تم تسجيل الدخول بنجاح', en: 'Signed in' },
  'auth.loggedOut': { ar: 'تم تسجيل الخروج بنجاح', en: 'Signed out' },
  'auth.refreshed': { ar: 'تم تجديد الجلسة', en: 'Session renewed' },
  'auth.signInAgain': { ar: 'يرجى تسجيل الدخول مرة أخرى', en: 'Please sign in again' },
  'auth.sessionExpired': { ar: 'انتهت صلاحية الجلسة', en: 'Your session has ended' },
  'auth.unauthorized': { ar: 'يرجى تسجيل الدخول', en: 'Please sign in' },
  'auth.otpSent': { ar: 'تم إرسال رمز التحقق بنجاح', en: 'Verification code sent' },
  'auth.resetCodeSent': {
    ar: 'لو البريد مسجل عندنا هيوصلك رمز التحقق خلال لحظات',
    en: 'If this email is registered, a verification code is on its way',
  },
  'auth.emailVerified': {
    ar: 'تم تأكيد بريدك الإلكتروني، يمكنك الآن تسجيل الدخول',
    en: 'Your email is confirmed. You can sign in now',
  },
  'auth.otpVerified': {
    ar: 'تم تأكيد الرمز، يمكنك الآن تعيين كلمة مرور جديدة',
    en: 'Code confirmed. You can set a new password now',
  },
  'auth.passwordReset': {
    ar: 'تم تحديث كلمة المرور بنجاح، يمكنك الآن تسجيل الدخول',
    en: 'Password updated. You can sign in now',
  },
  'auth.resetTokenInvalid': {
    ar: 'انتهت صلاحية جلسة إعادة التعيين، يرجى طلب رمز جديد',
    en: 'The reset session has expired. Please request a new code',
  },
  'otp.notRequested': {
    ar: 'لم يتم إرسال رمز تحقق، يرجى طلب رمز جديد',
    en: 'No code was requested. Please request a new one',
  },
  'otp.expired': {
    ar: 'انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد',
    en: 'The code has expired. Please request a new one',
  },
  'otp.attemptsExceeded': {
    ar: 'تم تجاوز عدد المحاولات المسموح بها، يرجى طلب رمز جديد',
    en: 'Too many wrong attempts. Please request a new code',
  },
  'otp.invalid': { ar: 'رمز التحقق غير صحيح', en: 'The verification code is incorrect' },
  'otp.resendTooSoon': {
    ar: 'يرجى الانتظار {0} ثانية قبل إعادة الإرسال',
    en: 'Please wait {0} seconds before resending',
  },
  'otp.alreadyVerified': {
    ar: 'تم تأكيد هذا الحساب بالفعل، سجل دخولك',
    en: 'This account is already confirmed. Please sign in',
  },

  'users.profileUpdated': { ar: 'تم تحديث بياناتك', en: 'Your details were updated' },
  'users.notFound': { ar: 'المستخدم غير موجود', en: 'User not found' },
  'users.wrongPassword': {
    ar: 'كلمة المرور الحالية غير صحيحة',
    en: 'The current password is incorrect',
  },
  'users.samePassword': {
    ar: 'كلمة المرور الجديدة لازم تكون مختلفة عن الحالية',
    en: 'The new password must differ from the current one',
  },
  'users.passwordChanged': {
    ar: 'تم تغيير كلمة المرور، وتم تسجيل الخروج من الأجهزة الأخرى',
    en: 'Password changed. Other devices were signed out',
  },
  'users.accountDeleted': {
    ar: 'تم حذف حسابك نهائياً',
    en: 'Your account was deleted for good',
  },
  'users.photoUpdated': { ar: 'تم تحديث الصورة الشخصية', en: 'Profile photo updated' },
  'users.photoRemoved': { ar: 'تم حذف الصورة الشخصية', en: 'Profile photo removed' },
  'users.photoRequired': { ar: 'اختار صورة الأول', en: 'Choose a photo first' },
  'users.photoInvalid': {
    ar: 'الصورة لازم تكون JPEG أو PNG أو WebP',
    en: 'The photo must be a JPEG, PNG or WebP image',
  },
  'users.photoTooLarge': {
    ar: 'الصورة أكبر من {0} ميجا',
    en: 'The photo is larger than {0} MB',
  },

  'mail.otpSubject.register': {
    ar: 'رمز تأكيد حسابك في عربيتي',
    en: 'Your 3arabity confirmation code',
  },
  'mail.otpSubject.password_reset': {
    ar: 'رمز إعادة تعيين كلمة المرور في عربيتي',
    en: 'Your 3arabity password reset code',
  },
  'mail.otpBody': {
    ar: 'رمز التحقق الخاص بك هو {0}\nالرمز صالح لمدة {1} دقائق. لو مش انت اللي طلبته تجاهل الرسالة دي.',
    en: 'Your verification code is {0}\nIt is valid for {1} minutes. If you did not ask for it, ignore this email.',
  },
} as const satisfies Record<string, Record<Lang, string>>;

export type MessageKey = keyof typeof messages;

export function isMessageKey(value: string): value is MessageKey {
  return Object.hasOwn(messages, value);
}

/** The message in [lang], with `{0}`, `{1}` … replaced by [params]. */
export function t(lang: Lang, key: MessageKey, params: readonly unknown[] = []): string {
  return messages[key][lang].replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = params[Number(index)];
    return value === undefined ? match : String(value);
  });
}
