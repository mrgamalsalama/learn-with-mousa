import { UserProfile } from '../types';

export interface AvatarPreset {
  id: string;
  name: string;
  emoji: string;
  badge: string;
  bgGradient: string;
  description: string;
}

export interface TimezoneOption {
  value: string;
  label: string;
  country: string;
  offset: string;
  flag: string;
}

// أفاتارات كرتونية آمنة للطلاب بشخصية موسى وأصدقائه الأبطال
export const STUDENT_AVATARS: AvatarPreset[] = [
  {
    id: 'mousa_hero',
    name: 'مُوسَى البَطَل',
    emoji: '🦁',
    badge: 'شجاع ومقدام',
    bgGradient: 'from-amber-400 to-orange-500',
    description: 'شخصية موسى البطل الشجاع المحب للغة والتعلم'
  },
  {
    id: 'mousa_scholar',
    name: 'مُوسَى العَبْقَرِيّ',
    emoji: '🎓',
    badge: 'متفوق ذكي',
    bgGradient: 'from-emerald-400 to-teal-600',
    description: 'موسى الطالب المجتهد المحب للقرائة والمطالعة'
  },
  {
    id: 'mousa_space',
    name: 'مُوسَى المُسْتَكْشِف',
    emoji: '🚀',
    badge: 'مستكشف الفضاء',
    bgGradient: 'from-indigo-500 to-purple-600',
    description: 'موسى المغامر المحب لاستكشاف الكلمات والعلوم'
  },
  {
    id: 'fox_clever',
    name: 'ثَعْلُوب الذَّكِيّ',
    emoji: '🦊',
    badge: 'سريع البديهة',
    bgGradient: 'from-orange-400 to-rose-500',
    description: 'صديق موسى سريع الحل وحاد الذكاء'
  },
  {
    id: 'owl_wise',
    name: 'حَكِيمُ البُومَة',
    emoji: '🦉',
    badge: 'حكيم وهادئ',
    bgGradient: 'from-amber-600 to-stone-700',
    description: 'المفكر الصغير الذي يتأنى في كل إجابة'
  },
  {
    id: 'dolphin_ocean',
    name: 'دُلْفِين المَعْرِفَة',
    emoji: '🐬',
    badge: 'مرح وودود',
    bgGradient: 'from-cyan-400 to-blue-600',
    description: 'الدلفين السباح في بحار الكلمات والقراءة'
  },
  {
    id: 'artist_brush',
    name: 'الفَنَّان الصَّغِير',
    emoji: '🎨',
    badge: 'مبدع وفنان',
    bgGradient: 'from-pink-400 to-purple-500',
    description: 'المحب للتلوين والخط العربي الجميل'
  },
  {
    id: 'star_champion',
    name: 'النَّجْم السَّاطِع',
    emoji: '🌟',
    badge: 'نجم التحدي',
    bgGradient: 'from-yellow-300 to-amber-500',
    description: 'نجم الصف الفائز في المسابقات السريعة'
  },
  {
    id: 'panda_gentle',
    name: 'البَانْدَا اللَّطِيف',
    emoji: '🐼',
    badge: 'صبور ولطيف',
    bgGradient: 'from-slate-500 to-slate-800',
    description: 'الباندا الهادئ الذي يعشق الدروس الممتعة'
  },
  {
    id: 'pony_legend',
    name: 'المَهْر الأُسْطُورِيّ',
    emoji: '🦄',
    badge: 'خيال واسع',
    bgGradient: 'from-fuchsia-400 to-pink-600',
    description: 'المهر السحري المليء بالطاقة الإيجابية'
  },
  {
    id: 'crown_prince',
    name: 'التَّاج الذَّهَبِيّ',
    emoji: '👑',
    badge: 'فارس الحروف',
    bgGradient: 'from-yellow-400 to-yellow-600',
    description: 'وسام التميز لمن يتصدر منصات القراءة والتفوق'
  },
  {
    id: 'book_worm',
    name: 'القَارِئ الصَّغِير',
    emoji: '📚',
    badge: 'عاشق الكتب',
    bgGradient: 'from-teal-400 to-emerald-600',
    description: 'قارئ القصص الماهر الذي لا يفارق الكتاب'
  }
];

// شارات وأفاتارات أكاديمية للمعلمين والإدارة وأولياء الأمور
export const ACADEMIC_AVATARS: AvatarPreset[] = [
  {
    id: 'acad_educator',
    name: 'المُعَلِّم الأَكَادِيمِيّ',
    emoji: '🎓',
    badge: 'تربوي قدير',
    bgGradient: 'from-blue-600 to-indigo-800',
    description: 'رمز الرقي والتعليم الأكاديمي الرصين'
  },
  {
    id: 'acad_dean',
    name: 'عَمِيد المَعْرِفَة',
    emoji: '🏛️',
    badge: 'قيادة أكاديمية',
    bgGradient: 'from-emerald-600 to-teal-800',
    description: 'رمز القيادة التربوية ورئاسة الأقسام'
  },
  {
    id: 'acad_scholar',
    name: 'بَاحِث لُغَوِيّ',
    emoji: '📜',
    badge: 'لغة عربية وبلاغة',
    bgGradient: 'from-amber-600 to-yellow-800',
    description: 'خبير علوم الضاد والمعاجم اللغوية'
  },
  {
    id: 'acad_consultant',
    name: 'المُسْتَشَار التَّرْبَوِيّ',
    emoji: '💡',
    badge: 'توجيه وإرشاد',
    bgGradient: 'from-amber-500 to-orange-700',
    description: 'تقديم الرأي السديد ودعم الطلاب والأسرة'
  },
  {
    id: 'acad_supervisor',
    name: 'المُشْرِف القِيَادِيّ',
    emoji: '🛡️',
    badge: 'إشراف وحوكمة',
    bgGradient: 'from-slate-700 to-slate-900',
    description: 'المتابعة الدقيقة وضمان الجودة المدرسية'
  },
  {
    id: 'acad_mentor',
    name: 'المُرَبِّي الفَاضِل',
    emoji: '🏆',
    badge: 'عطاء متميز',
    bgGradient: 'from-rose-600 to-red-800',
    description: 'رمز التفاني في رعاية وتربية النشء'
  },
  {
    id: 'acad_writer',
    name: 'الكَاتِب وَالأَدِيب',
    emoji: '✍️',
    badge: 'فنون الكتابة',
    bgGradient: 'from-purple-600 to-violet-800',
    description: 'شغف القلم وتدريب الطلاب على التعبير الإبداعي'
  },
  {
    id: 'acad_thinker',
    name: 'المُفَكِّر المُبْتَكِر',
    emoji: '🔬',
    badge: 'ابتكار وتطوير',
    bgGradient: 'from-teal-600 to-cyan-800',
    description: 'توظيف الذكاء الاصطناعي في التعليم الحديث'
  },
  {
    id: 'acad_parent_star',
    name: 'وَلِيّ الأَمْر الدَّاعِم',
    emoji: '🤝',
    badge: 'شراكة أسرية',
    bgGradient: 'from-cyan-600 to-blue-800',
    description: 'المتابعة الحثيثة والتعاون الوثيق مع المدرسة'
  },
  {
    id: 'acad_honor',
    name: 'وِسَام الشَّرَف التَّرْبَوِيّ',
    emoji: '🎖️',
    badge: 'تميز مؤسسي',
    bgGradient: 'from-yellow-500 to-amber-700',
    description: 'تقدير سنوات العطاء والإخلاص في المنظومة'
  }
];

// قائمة أهم المناطق الزمنية العربية والعالمية
export const ARABIC_TIMEZONES: TimezoneOption[] = [
  { value: 'Africa/Cairo', label: 'القاهرة - جمهورية مصر العربية', country: 'مصر', offset: 'GMT+2', flag: '🇪🇬' },
  { value: 'Asia/Riyadh', label: 'مكة المكرمة والرياض - المملكة العربية السعودية', country: 'السعودية', offset: 'GMT+3', flag: '🇸🇦' },
  { value: 'Asia/Dubai', label: 'دبي وأبوظبي - الإمارات العربية المتحدة', country: 'الإمارات', offset: 'GMT+4', flag: '🇦🇪' },
  { value: 'Asia/Amman', label: 'عمان - المملكة الأردنية الهاشمية', country: 'الأردن', offset: 'GMT+3', flag: '🇯🇴' },
  { value: 'Asia/Kuwait', label: 'مدينة الكويت - دولة الكويت', country: 'الكويت', offset: 'GMT+3', flag: '🇰🇼' },
  { value: 'Asia/Qatar', label: 'الدوحة - دولة قطر', country: 'قطر', offset: 'GMT+3', flag: '🇶🇦' },
  { value: 'Asia/Bahrain', label: 'المنامة - مملكة البحرين', country: 'البحرين', offset: 'GMT+3', flag: '🇧🇭' },
  { value: 'Asia/Muscat', label: 'مسقط - سلطنة عمان', country: 'عمان', offset: 'GMT+4', flag: '🇴🇲' },
  { value: 'Asia/Baghdad', label: 'بغداد - جمهورية العراق', country: 'العراق', offset: 'GMT+3', flag: '🇮🇶' },
  { value: 'Asia/Jerusalem', label: 'القدس الشريف - دولة فلسطين', country: 'فلسطين', offset: 'GMT+2', flag: '🇵🇸' },
  { value: 'Asia/Beirut', label: 'بيروت - الجمهورية اللبنانية', country: 'لبنان', offset: 'GMT+2', flag: '🇱🇧' },
  { value: 'Asia/Damascus', label: 'دمشق - الجمهورية العربية السورية', country: 'سوريا', offset: 'GMT+3', flag: '🇸🇾' },
  { value: 'Africa/Casablanca', label: 'الدار البيضاء والرباط - المملكة المغربية', country: 'المغرب', offset: 'GMT+1', flag: '🇲🇦' },
  { value: 'Africa/Algiers', label: 'الجزائر - الجمهورية الجزائرية', country: 'الجزائر', offset: 'GMT+1', flag: '🇩🇿' },
  { value: 'Africa/Tunis', label: 'تونس - الجمهورية التونسية', country: 'تونس', offset: 'GMT+1', flag: '🇹🇳' },
  { value: 'Africa/Tripoli', label: 'طرابلس - دولة ليبيا', country: 'ليبيا', offset: 'GMT+2', flag: '🇱🇾' },
  { value: 'Africa/Khartoum', label: 'الخرطوم - جمهورية السودان', country: 'السودان', offset: 'GMT+2', flag: '🇸🇩' },
  { value: 'Asia/Aden', label: 'صنعاء وعدن - الجمهورية اليمنية', country: 'اليمن', offset: 'GMT+3', flag: '🇾🇪' },
  { value: 'Europe/London', label: 'لندن - المملكة المتحدة (غرينتش)', country: 'بريطانيا', offset: 'GMT+0', flag: '🇬🇧' },
  { value: 'Europe/Paris', label: 'باريس - فرنسا / أوروبا الغربية', country: 'فرنسا', offset: 'GMT+1', flag: '🇫🇷' },
  { value: 'Europe/Istanbul', label: 'إسطنبول - جمهورية تركيا', country: 'تركيا', offset: 'GMT+3', flag: '🇹🇷' },
  { value: 'America/New_York', label: 'نيويورك - الولايات المتحدة (توقيت الساحل الشرقي)', country: 'أمريكا الشرقية', offset: 'GMT-4', flag: '🇺🇸' },
  { value: 'America/Los_Angeles', label: 'كاليفورنيا - الولايات المتحدة (توقيت الساحل الغربي)', country: 'أمريكا الغربية', offset: 'GMT-7', flag: '🇺🇸' },
  { value: 'UTC', label: 'التوقيت العالمي المنسق (UTC)', country: 'عالمي', offset: 'GMT+0', flag: '🌐' }
];

/**
 * دالة الحصول على كائن الأفاتار المختار أو المناسب للمستخدم
 */
export function getAvatarInfo(user?: UserProfile | null): {
  isCustomUrl: boolean;
  isPreset: boolean;
  value: string;
  emoji: string;
  name: string;
  bgGradient: string;
} {
  if (!user) {
    return {
      isCustomUrl: false,
      isPreset: true,
      value: 'mousa_hero',
      emoji: '🦁',
      name: 'موسى',
      bgGradient: 'from-amber-400 to-orange-500'
    };
  }

  const raw = user.avatar;

  // في حال كانت صورة مخصصة مرفوعة برابط أو Data URL
  if (raw && (raw.startsWith('data:image') || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/'))) {
    return {
      isCustomUrl: true,
      isPreset: false,
      value: raw,
      emoji: '🖼️',
      name: user.name,
      bgGradient: 'from-slate-100 to-slate-200'
    };
  }

  // البحث في الأفاتارات الجاهزة للطلاب
  const studentFound = STUDENT_AVATARS.find(a => a.id === raw);
  if (studentFound) {
    return {
      isCustomUrl: false,
      isPreset: true,
      value: studentFound.id,
      emoji: studentFound.emoji,
      name: studentFound.name,
      bgGradient: studentFound.bgGradient
    };
  }

  // البحث في الشارات الأكاديمية للمعلمين والإدارة
  const acadFound = ACADEMIC_AVATARS.find(a => a.id === raw);
  if (acadFound) {
    return {
      isCustomUrl: false,
      isPreset: true,
      value: acadFound.id,
      emoji: acadFound.emoji,
      name: acadFound.name,
      bgGradient: acadFound.bgGradient
    };
  }

  // في حال عدم التعيين، اختيار الافتراضي حسب الدور
  if (user.role === 'student') {
    return {
      isCustomUrl: false,
      isPreset: true,
      value: 'mousa_hero',
      emoji: '🦁',
      name: 'موسى البطل',
      bgGradient: 'from-amber-400 to-orange-500'
    };
  } else if (user.role === 'teacher') {
    return {
      isCustomUrl: false,
      isPreset: true,
      value: 'acad_educator',
      emoji: '🎓',
      name: 'المعلم الأكاديمي',
      bgGradient: 'from-blue-600 to-indigo-800'
    };
  } else if (user.role === 'hod') {
    return {
      isCustomUrl: false,
      isPreset: true,
      value: 'acad_dean',
      emoji: '🏛️',
      name: 'رئيس القسم',
      bgGradient: 'from-emerald-600 to-teal-800'
    };
  } else if (user.role === 'super_admin') {
    return {
      isCustomUrl: false,
      isPreset: true,
      value: 'acad_supervisor',
      emoji: '🛡️',
      name: 'المشرف العام',
      bgGradient: 'from-slate-700 to-slate-900'
    };
  } else {
    return {
      isCustomUrl: false,
      isPreset: true,
      value: 'acad_parent_star',
      emoji: '👨‍👩‍👧',
      name: 'ولي الأمر',
      bgGradient: 'from-cyan-600 to-blue-800'
    };
  }
}

/**
 * الحصول على المنطقة الزمنية المكتشفة تلقائياً من المتصفح
 */
export function getDetectedBrowserTimezone(): string {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) return tz;
    }
  } catch (e) {
    console.warn('تعذر كشف المنطقة الزمنية تلقائياً:', e);
  }
  return 'Africa/Cairo';
}
