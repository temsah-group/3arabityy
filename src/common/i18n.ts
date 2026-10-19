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
  'auth.useGoogle': {
    ar: 'الحساب ده متسجل بجوجل، ادخل بزرار جوجل أو اعمل كلمة مرور من "نسيت كلمة المرور"',
    en: 'This account signs in with Google. Use the Google button, or set a password with "Forgot password"',
  },
  'auth.googleOff': {
    ar: 'تسجيل الدخول بجوجل مش متاح دلوقتي',
    en: 'Google sign-in is not available right now',
  },
  'auth.googleInvalid': {
    ar: 'تعذر التأكد من حساب جوجل، جرّب تاني',
    en: 'We could not confirm your Google account. Please try again',
  },
  'auth.phoneRequired': {
    ar: 'أضف رقم موبايلك عشان المشترين يتواصلوا معاك',
    en: 'Add your phone number so buyers can reach you',
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
  'parts.created': { ar: 'تم نشر القطعة', en: 'Your part is listed' },
  'parts.updated': { ar: 'تم حفظ التعديلات', en: 'Changes saved' },
  'parts.deleted': { ar: 'تم حذف الإعلان', en: 'Listing deleted' },
  'parts.markedSold': { ar: 'تم تعليم القطعة إنها اتباعت', en: 'Marked as sold' },
  'parts.backOnSale': { ar: 'القطعة رجعت للعرض', en: 'Back on sale' },
  'parts.renewed': { ar: 'تم تجديد الإعلان', en: 'Listing renewed' },
  'parts.notFound': { ar: 'القطعة دي مش موجودة', en: 'This part does not exist' },
  'parts.notOwner': {
    ar: 'مش مسموحلك تعدّل إعلان حد تاني',
    en: "You can't change someone else's listing",
  },
  'parts.tooManyPhotos': { ar: 'الحد الأقصى {0} صور', en: 'Up to {0} photos' },
  'parts.uploadNotOwned': {
    ar: 'صورة من الصور مش مرفوعة من حسابك',
    en: 'One of the photos was not uploaded from your account',
  },
  'parts.photoUploaded': { ar: 'تم رفع الصورة', en: 'Photo uploaded' },
  'users.tooManyCars': { ar: 'الحد الأقصى {0} عربيات', en: 'Up to {0} cars' },
  'users.carsSaved': { ar: 'تم حفظ عربياتك', en: 'Your cars are saved' },
  'validation.car': {
    ar: 'العربية أو سنة الموديل غير صحيحة',
    en: 'The car or its year is not valid',
  },
  'notifications.notFound': {
    ar: 'الإشعار ده مش موجود',
    en: 'This notification does not exist',
  },
  'notifications.settingsSaved': {
    ar: 'تم حفظ إعدادات الإشعارات',
    en: 'Notification settings saved',
  },
  'notifications.fitsTitle': {
    ar: 'قطعة جديدة تركب على عربيتك',
    en: 'A new part fits your car',
  },
  'notifications.fitsBody': {
    ar: '{0} بـ {1} جنيه في {2}',
    en: '{0} for EGP {1} in {2}',
  },
  'notifications.priceDropTitle': {
    ar: 'نزل سعر قطعة محفوظة',
    en: 'A saved part got cheaper',
  },
  'notifications.priceDropBody': {
    ar: '{0}: من {1} لـ {2} جنيه',
    en: '{0}: from EGP {1} to EGP {2}',
  },
  'shops.notFound': { ar: 'المحل ده مش موجود', en: 'This shop does not exist' },
  'shops.exists': { ar: 'عندك محل بالفعل', en: 'You already have a shop' },
  'shops.suspended': {
    ar: 'محلك موقوف، تواصل مع الدعم',
    en: 'Your shop is suspended. Contact support',
  },
  'shops.applied': {
    ar: 'وصلنا طلبك، هنراجعه ونبلغك',
    en: 'We got your application and will let you know',
  },
  'shops.saved': { ar: 'تم حفظ بيانات المحل', en: 'Shop details saved' },
  'validation.shopName': {
    ar: 'اسم المحل من 3 لـ 60 حرف',
    en: 'The shop name must be 3 to 60 characters',
  },
  'validation.address': {
    ar: 'اكتب عنوان المحل (من 5 لـ 200 حرف)',
    en: "Write the shop's address (5 to 200 characters)",
  },
  'validation.location': { ar: 'الموقع غير صحيح', en: 'The location is not valid' },
  'validation.deliveryAreas': {
    ar: 'اختار المحافظات اللي بتوصّل لها',
    en: 'Choose the governorates you deliver to',
  },
  'validation.deliveryFee': {
    ar: 'رسوم التوصيل غير صحيحة',
    en: 'The delivery fee is not valid',
  },
  'notifications.shopApprovedTitle': { ar: 'محلك اتقبل 🎉', en: 'Your shop is approved 🎉' },
  'notifications.shopApprovedBody': {
    ar: '"{0}" بقى ظاهر للمشترين، وكل قطعك بقت تحته.',
    en: '"{0}" is now shown to buyers, with all your parts under it.',
  },
  'notifications.shopRejectedTitle': {
    ar: 'طلب المحل محتاج تعديل',
    en: 'Your shop application needs changes',
  },
  'notifications.shopRejectedBody': {
    ar: '"{0}": {1}. عدّل البيانات وهنراجعه تاني.',
    en: '"{0}": {1}. Edit it and we will review it again.',
  },
  'notifications.shopSuspendedTitle': { ar: 'محلك اتوقف', en: 'Your shop was suspended' },
  'notifications.shopSuspendedBody': {
    ar: '"{0}" مش ظاهر للمشترين: {1}. تواصل مع الدعم لو عندك استفسار.',
    en: '"{0}" is hidden from buyers: {1}. Contact support with any questions.',
  },
  'notifications.shopRestoredTitle': { ar: 'محلك رجع يظهر', en: 'Your shop is back' },
  'notifications.shopRestoredBody': {
    ar: '"{0}" رجع يظهر للمشترين.',
    en: '"{0}" is shown to buyers again.',
  },
  'reviews.notFound': { ar: 'التقييم ده مش موجود', en: 'This review does not exist' },
  'reviews.notAllowed': {
    ar: 'كلّم البياع الأول (اتصال أو واتساب) عشان تقدر تقيّم',
    en: 'Call or message the seller first to leave a review',
  },
  'reviews.own': { ar: 'مينفعش تقيّم نفسك', en: "You can't review yourself" },
  'reviews.notSeller': {
    ar: 'الرد على التقييم للبياع بس',
    en: 'Only the seller can answer this review',
  },
  'reviews.saved': { ar: 'شكراً على تقييمك', en: 'Thanks for your review' },
  'reviews.deleted': { ar: 'تم حذف تقييمك', en: 'Your review was deleted' },
  'reviews.replied': { ar: 'تم نشر ردك', en: 'Your answer is posted' },
  'reviews.replyRemoved': { ar: 'تم حذف ردك', en: 'Your answer was removed' },
  'validation.rating': { ar: 'اختار من نجمة لـ 5 نجوم', en: 'Choose 1 to 5 stars' },
  'validation.reviewText': {
    ar: 'التقييم طويل جداً (500 حرف بالكتير)',
    en: 'The review is too long (500 characters at most)',
  },
  'notifications.newReviewTitle': {
    ar: 'تقييم جديد {0}★',
    en: 'New {0}★ review',
  },
  'notifications.newReviewBody': {
    ar: 'حد قيّم "{1}". افتح التقييم ورد عليه.',
    en: 'Someone reviewed "{1}". Open it to answer.',
  },
  'notifications.reviewReplyTitle': { ar: 'البياع رد على تقييمك', en: 'The seller answered you' },
  'notifications.reviewReplyBody': {
    ar: 'رد على تقييمك لـ "{1}".',
    en: 'They answered your review of "{1}".',
  },
  'sellers.notFound': { ar: 'البائع ده مش موجود', en: 'This seller does not exist' },
  'reports.sent': {
    ar: 'شكراً على البلاغ، هنراجعه',
    en: 'Thanks for the report. We will review it',
  },
  'reports.already': {
    ar: 'بلّغت عن ده قبل كدا',
    en: 'You already reported this',
  },
  'reports.self': {
    ar: 'مينفعش تبلّغ عن نفسك أو عن إعلانك',
    en: "You can't report yourself or your own listing",
  },
  'validation.reportReason': {
    ar: 'اختار سبب البلاغ',
    en: 'Choose a reason for the report',
  },
  'validation.reportDetails': {
    ar: 'اكتب السبب في كلمتين',
    en: 'Describe the reason in a few words',
  },
  'validation.category': { ar: 'اختار القسم', en: 'Choose a category' },
  'validation.condition': { ar: 'اختار الحالة', en: 'Choose a condition' },
  'validation.partName': {
    ar: 'اسم القطعة من 3 لـ 100 حرف',
    en: 'The part name must be 3 to 100 characters',
  },
  'validation.price': { ar: 'السعر غير صحيح', en: 'The price is not valid' },
  'validation.oldPrice': {
    ar: 'السعر قبل الخصم لازم يكون أكبر من السعر',
    en: 'The price before the discount must be higher',
  },
  'validation.city': { ar: 'اختار المحافظة', en: 'Choose a governorate' },
  'validation.photos': { ar: 'أضف صورة واحدة على الأقل', en: 'Add at least one photo' },
  'validation.fitments': {
    ar: 'حدد عربية واحدة على الأقل',
    en: 'Choose at least one car',
  },
  'validation.fitment': {
    ar: 'العربية أو سنين الموديل غير صحيحة',
    en: 'The car or its years are not valid',
  },
  'validation.description': {
    ar: 'الوصف طويل جداً',
    en: 'The description is too long',
  },
  'validation.query': { ar: 'بيانات البحث غير صحيحة', en: 'The search is not valid' },
  'users.photoTooLarge': {
    ar: 'الصورة أكبر من {0} ميجا',
    en: 'The photo is larger than {0} MB',
  },

  'notifications.listingHiddenTitle': {
    ar: 'إعلانك اتخفى',
    en: 'Your listing was hidden',
  },
  'notifications.listingHiddenBody': {
    ar: 'إعلان "{0}" مش ظاهر للمشترين لأنه مخالف لشروط النشر. تواصل مع الدعم لو عندك استفسار.',
    en: '"{0}" is no longer shown to buyers because it breaks the listing rules. Contact support with any questions.',
  },
  'notifications.listingRestoredTitle': {
    ar: 'إعلانك رجع يظهر',
    en: 'Your listing is back',
  },
  'notifications.listingRestoredBody': {
    ar: 'إعلان "{0}" رجع يظهر للمشترين.',
    en: '"{0}" is shown to buyers again.',
  },
  'notifications.listingRemovedTitle': {
    ar: 'إعلانك اتشال',
    en: 'Your listing was removed',
  },
  'notifications.listingRemovedBody': {
    ar: 'إعلان "{0}" اتشال لأنه مخالف لشروط النشر. تواصل مع الدعم لو عندك استفسار.',
    en: '"{0}" was removed because it breaks the listing rules. Contact support with any questions.',
  },

  'admin.roleRequired': {
    ar: 'الصلاحية دي للمالك بس',
    en: 'Only an owner can do this',
  },
  'admin.noteRequired': {
    ar: 'اكتب سبب الإجراء ده',
    en: 'Write the reason for this action',
  },
  'admin.userNotFound': { ar: 'المستخدم ده مش موجود', en: 'This user does not exist' },
  'admin.saved': { ar: 'تم الحفظ', en: 'Saved' },
  'admin.carsInUse': {
    ar: 'مينفعش تشيل {0}: فيه إعلانات أو عربيات مستخدمين متسجلة عليها',
    en: "You cannot remove {0}: listings or users' cars use it",
  },
  'admin.carsDuplicate': {
    ar: 'فيه ماركة أو موديل متكرر بنفس الكود',
    en: 'Two makes or models share a code',
  },
  'admin.announcementNotFound': {
    ar: 'الإعلان ده مش موجود',
    en: 'This announcement does not exist',
  },
  'admin.announcementSent': { ar: 'اتبعت الإعلان', en: 'Announcement sent' },

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
