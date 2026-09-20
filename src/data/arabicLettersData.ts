export type LetterPosition = 'initial' | 'medial' | 'final_connected' | 'final_separate';

export interface LetterPositionData {
  position: LetterPosition;
  label: string; // 'أول الكلمة', 'وسط الكلمة', 'آخر الكلمة متصل', 'آخر الكلمة منفصل'
  form: string;
  exampleWord: string;
  exampleIcon: string;
}

export interface ArabicLetterItem {
  letter: string;
  name: string;
  positions: Record<LetterPosition, LetterPositionData>;
}

export const ARABIC_ALPHABET: ArabicLetterItem[] = [
  {
    letter: 'أ',
    name: 'الألف',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'أ', exampleWord: 'أَرْنَب', exampleIcon: '🐰' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـأ', exampleWord: 'فَأْر', exampleIcon: '🐭' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـأ', exampleWord: 'مَلْجَأ', exampleIcon: '🏡' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'أ', exampleWord: 'قَرَأَ', exampleIcon: '📖' },
    }
  },
  {
    letter: 'ب',
    name: 'الباء',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'بـ', exampleWord: 'بَطَّة', exampleIcon: '🦆' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـبـ', exampleWord: 'جَبَل', exampleIcon: '⛰️' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـب', exampleWord: 'عِنَب', exampleIcon: '🍇' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ب', exampleWord: 'بَاب', exampleIcon: '🚪' },
    }
  },
  {
    letter: 'ت',
    name: 'التاء',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'تـ', exampleWord: 'تُفَّاحَة', exampleIcon: '🍎' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـتـ', exampleWord: 'كِتَاب', exampleIcon: '📚' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـت', exampleWord: 'بِنْت', exampleIcon: '👧' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ت', exampleWord: 'حُوت', exampleIcon: '🐋' },
    }
  },
  {
    letter: 'ث',
    name: 'الثاء',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'ثـ', exampleWord: 'ثَعْلَب', exampleIcon: '🦊' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـثـ', exampleWord: 'مُثَلَّث', exampleIcon: '🔺' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـث', exampleWord: 'لَيْث', exampleIcon: '🦁' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ث', exampleWord: 'أَثَاث', exampleIcon: '🛋️' },
    }
  },
  {
    letter: 'ج',
    name: 'الجيم',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'جـ', exampleWord: 'جَمَل', exampleIcon: '🐪' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـجـ', exampleWord: 'شَجَرَة', exampleIcon: '🌳' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـج', exampleWord: 'ثَلْج', exampleIcon: '❄️' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ج', exampleWord: 'تَاج', exampleIcon: '👑' },
    }
  },
  {
    letter: 'ح',
    name: 'الحاء',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'حـ', exampleWord: 'حِصَان', exampleIcon: '🐎' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـحـ', exampleWord: 'سُلَحْفَاة', exampleIcon: '🐢' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـح', exampleWord: 'تِمْسَاح', exampleIcon: '🐊' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ح', exampleWord: 'تُفَّاح', exampleIcon: '🍏' },
    }
  },
  {
    letter: 'خ',
    name: 'الخاء',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'خـ', exampleWord: 'خَرُوف', exampleIcon: '🐑' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـخـ', exampleWord: 'نَخْلَة', exampleIcon: '🌴' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـخ', exampleWord: 'بِطِّيخ', exampleIcon: '🍉' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'خ', exampleWord: 'كُوخ', exampleIcon: '🛖' },
    }
  },
  {
    letter: 'د',
    name: 'الدال',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'د', exampleWord: 'دُبّ', exampleIcon: '🐻' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـد', exampleWord: 'حَدِيقَة', exampleIcon: '🌺' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـد', exampleWord: 'يَد', exampleIcon: '✋' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'د', exampleWord: 'وَرْد', exampleIcon: '🌹' },
    }
  },
  {
    letter: 'ذ',
    name: 'الذال',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'ذ', exampleWord: 'ذُرَة', exampleIcon: '🌽' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـذ', exampleWord: 'مِذْيَاع', exampleIcon: '📻' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـذ', exampleWord: 'قُنْفُذ', exampleIcon: '🦔' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ذ', exampleWord: 'رَذَاذ', exampleIcon: '🌧️' },
    }
  },
  {
    letter: 'ر',
    name: 'الراء',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'ر', exampleWord: 'رِيشَة', exampleIcon: '🪶' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـر', exampleWord: 'فَرَاشَة', exampleIcon: '🦋' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـر', exampleWord: 'نَمِر', exampleIcon: '🐅' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ر', exampleWord: 'قَمَر', exampleIcon: '🌙' },
    }
  },
  {
    letter: 'ز',
    name: 'الزاي',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'ز', exampleWord: 'زَرَافَة', exampleIcon: '🦒' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـز', exampleWord: 'مَوْز', exampleIcon: '🍌' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـز', exampleWord: 'خُبْز', exampleIcon: '🍞' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ز', exampleWord: 'تِلْفَاز', exampleIcon: '📺' },
    }
  },
  {
    letter: 'س',
    name: 'السين',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'سـ', exampleWord: 'سَمَكَة', exampleIcon: '🐟' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـسـ', exampleWord: 'مِسْطَرَة', exampleIcon: '📐' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـس', exampleWord: 'شَمْس', exampleIcon: '☀️' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'س', exampleWord: 'جَرَس', exampleIcon: '🔔' },
    }
  },
  {
    letter: 'ش',
    name: 'الشين',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'شـ', exampleWord: 'شَمْس', exampleIcon: '☀️' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـشـ', exampleWord: 'عُشّ', exampleIcon: '🪺' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـش', exampleWord: 'رِيش', exampleIcon: '🪶' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ش', exampleWord: 'فَرَاش', exampleIcon: '🦋' },
    }
  },
  {
    letter: 'ص',
    name: 'الصاد',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'صـ', exampleWord: 'صَقْر', exampleIcon: '🦅' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـصـ', exampleWord: 'عُصْفُور', exampleIcon: '🐦' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـص', exampleWord: 'مِقَصّ', exampleIcon: '✂️' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ص', exampleWord: 'قَفَص', exampleIcon: '🛖' },
    }
  },
  {
    letter: 'ض',
    name: 'الضاد',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'ضـ', exampleWord: 'ضِفْدَع', exampleIcon: '🐸' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـضـ', exampleWord: 'خُضَار', exampleIcon: '🥦' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـض', exampleWord: 'بَيْض', exampleIcon: '🥚' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ض', exampleWord: 'حَوْض', exampleIcon: '🛁' },
    }
  },
  {
    letter: 'ط',
    name: 'الطاء',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'طـ', exampleWord: 'طَائِرَة', exampleIcon: '✈️' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـطـ', exampleWord: 'قِطَّة', exampleIcon: '🐱' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـط', exampleWord: 'بَطّ', exampleIcon: '🦆' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ط', exampleWord: 'أُخْطُبُوط', exampleIcon: '🐙' },
    }
  },
  {
    letter: 'ظ',
    name: 'الظاء',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'ظـ', exampleWord: 'ظَرْف', exampleIcon: '✉️' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـظـ', exampleWord: 'نَظَّارَة', exampleIcon: '👓' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـظ', exampleWord: 'حَظّ', exampleIcon: '🍀' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ظ', exampleWord: 'اسْتِيقَاظ', exampleIcon: '⏰' },
    }
  },
  {
    letter: 'ع',
    name: 'العين',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'عـ', exampleWord: 'عَصِير', exampleIcon: '🧃' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـعـ', exampleWord: 'ثَعْلَب', exampleIcon: '🦊' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـع', exampleWord: 'شِرَاع', exampleIcon: '⛵' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ع', exampleWord: 'ضِفْدَع', exampleIcon: '🐸' },
    }
  },
  {
    letter: 'غ',
    name: 'الغين',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'غـ', exampleWord: 'غَزَال', exampleIcon: '🦌' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـغـ', exampleWord: 'بَبَّغَاء', exampleIcon: '🦜' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـغ', exampleWord: 'صَمْغ', exampleIcon: '🧴' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'غ', exampleWord: 'دِمَاغ', exampleIcon: '🧠' },
    }
  },
  {
    letter: 'ف',
    name: 'الفاء',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'فـ', exampleWord: 'فَرَاشَة', exampleIcon: '🦋' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـفـ', exampleWord: 'سَفِينَة', exampleIcon: '🚢' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـف', exampleWord: 'هَاتِف', exampleIcon: '📱' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ف', exampleWord: 'صُوف', exampleIcon: '🧶' },
    }
  },
  {
    letter: 'ق',
    name: 'القاف',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'قـ', exampleWord: 'قَمَر', exampleIcon: '🌙' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـقـ', exampleWord: 'بَقَرَة', exampleIcon: '🐄' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـق', exampleWord: 'إِبْرِيق', exampleIcon: '🫖' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ق', exampleWord: 'طَوْق', exampleIcon: '⭕' },
    }
  },
  {
    letter: 'ك',
    name: 'الكاف',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'كـ', exampleWord: 'كَلْب', exampleIcon: '🐕' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـكـ', exampleWord: 'سَمَكَة', exampleIcon: '🐟' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـك', exampleWord: 'دِيك', exampleIcon: '🐓' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ك', exampleWord: 'شُبَّاك', exampleIcon: '🪟' },
    }
  },
  {
    letter: 'ل',
    name: 'اللام',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'لـ', exampleWord: 'لَيْمُون', exampleIcon: '🍋' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـلـ', exampleWord: 'قَلَم', exampleIcon: '✏️' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـل', exampleWord: 'نَحْل', exampleIcon: '🐝' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ل', exampleWord: 'غَزَال', exampleIcon: '🦌' },
    }
  },
  {
    letter: 'م',
    name: 'الميم',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'مـ', exampleWord: 'مَوْز', exampleIcon: '🍌' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـمـ', exampleWord: 'نَمِر', exampleIcon: '🐅' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـم', exampleWord: 'نَجْم', exampleIcon: '🌟' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'م', exampleWord: 'هَرَم', exampleIcon: '🔺' },
    }
  },
  {
    letter: 'ن',
    name: 'النون',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'نـ', exampleWord: 'نَحْلَة', exampleIcon: '🐝' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـنـ', exampleWord: 'عِنَب', exampleIcon: '🍇' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـن', exampleWord: 'جُبْن', exampleIcon: '🧀' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ن', exampleWord: 'رُمَّان', exampleIcon: '🍎' },
    }
  },
  {
    letter: 'هـ',
    name: 'الهاء',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'هـ', exampleWord: 'هِلَال', exampleIcon: '🌙' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـهـ', exampleWord: 'فَهْد', exampleIcon: '🐆' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـه', exampleWord: 'وَجْه', exampleIcon: '😊' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ه', exampleWord: 'مِيَاه', exampleIcon: '💧' },
    }
  },
  {
    letter: 'و',
    name: 'الواو',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'و', exampleWord: 'وَرْدَة', exampleIcon: '🌹' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـو', exampleWord: 'طَاوُوس', exampleIcon: '🦚' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـو', exampleWord: 'دَلْو', exampleIcon: '🪣' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'و', exampleWord: 'ضَوْء', exampleIcon: '💡' },
    }
  },
  {
    letter: 'ي',
    name: 'الياء',
    positions: {
      initial: { position: 'initial', label: 'أول الكلمة', form: 'يـ', exampleWord: 'يَد', exampleIcon: '✋' },
      medial: { position: 'medial', label: 'وسط الكلمة', form: 'ـيـ', exampleWord: 'بَيْت', exampleIcon: '🏠' },
      final_connected: { position: 'final_connected', label: 'آخر الكلمة متصل', form: 'ـي', exampleWord: 'كُرْسِيّ', exampleIcon: '🪑' },
      final_separate: { position: 'final_separate', label: 'آخر الكلمة منفصل', form: 'ي', exampleWord: 'جَدْي', exampleIcon: '🐐' },
    }
  }
];

export const POSITION_KEYS: LetterPosition[] = ['initial', 'medial', 'final_connected', 'final_separate'];
