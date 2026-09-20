import { ChallengeQuiz, ChallengeShape } from '../types';

export const SHAPE_CONFIG: Record<ChallengeShape, {
  shape: ChallengeShape;
  symbol: string;
  name: string;
  colorName: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  hoverClass: string;
  activeClass: string;
  lightBgClass: string;
}> = {
  triangle: {
    shape: 'triangle',
    symbol: '🔺',
    name: 'مثلث',
    colorName: 'أحمر',
    bgClass: 'bg-rose-600',
    borderClass: 'border-rose-700',
    textClass: 'text-white',
    hoverClass: 'hover:bg-rose-700 active:bg-rose-800',
    activeClass: 'ring-4 ring-rose-300 scale-98',
    lightBgClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  diamond: {
    shape: 'diamond',
    symbol: '🔷',
    name: 'معين',
    colorName: 'أزرق',
    bgClass: 'bg-blue-600',
    borderClass: 'border-blue-700',
    textClass: 'text-white',
    hoverClass: 'hover:bg-blue-700 active:bg-blue-800',
    activeClass: 'ring-4 ring-blue-300 scale-98',
    lightBgClass: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  circle: {
    shape: 'circle',
    symbol: '🟡',
    name: 'دائرة',
    colorName: 'أصفر',
    bgClass: 'bg-amber-500',
    borderClass: 'border-amber-600',
    textClass: 'text-slate-900',
    hoverClass: 'hover:bg-amber-600 active:bg-amber-700',
    activeClass: 'ring-4 ring-amber-300 scale-98',
    lightBgClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  square: {
    shape: 'square',
    symbol: '🟩',
    name: 'مربع',
    colorName: 'أخضر',
    bgClass: 'bg-emerald-600',
    borderClass: 'border-emerald-700',
    textClass: 'text-white',
    hoverClass: 'hover:bg-emerald-700 active:bg-emerald-800',
    activeClass: 'ring-4 ring-emerald-300 scale-98',
    lightBgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  }
};

export const DEFAULT_SHAPES: ChallengeShape[] = ['triangle', 'diamond', 'circle', 'square'];

export const INITIAL_CHALLENGE_QUIZZES: ChallengeQuiz[] = [
  {
    id: 'quiz_demo_nahw_1',
    title: 'تَحَدِّي الأَبْطَالِ فِي المُبْتَدَأِ وَالخَبَرِ 🏆',
    description: 'مسابقة حماسية للتعرف على ركني الجملة الاسمية وعلامات الرفع الأصلية والفرعية.',
    teacher_id: 'usr_teacher',
    teacher_name: 'الأستاذة فاطمة الزهراء',
    target_grade: 'grade-4',
    target_track: 'arabic-a',
    topic: 'المبتدأ والخبر',
    created_at: new Date().toISOString(),
    questions: [
      {
        id: 'q_nahw_1',
        text: 'مَا هُمَا الرُّكْنَانِ الأَسَاسِيَّانِ فِي الجُمْلَةِ الاسْمِيَّةِ؟',
        timeLimitSeconds: 20,
        explanation: 'تَتَكَوَّنُ الجُمْلَةُ الاسْمِيَّةُ مِنْ رُكْنَيْنِ هُمَا: المُبْتَدَأُ وَالخَبَرُ، مِثْلَ: العِلْمُ نُورٌ.',
        correctIndex: 0,
        options: [
          { id: '0', text: 'المُبْتَدَأُ وَالخَبَرُ 🌟', shape: 'triangle' },
          { id: '1', text: 'الفِعْلُ وَالفَاعِلُ', shape: 'diamond' },
          { id: '2', text: 'الفِعْلُ وَالمَفْعُولُ بِهِ', shape: 'circle' },
          { id: '3', text: 'الحَرْفُ وَالاسْمُ المَجْرُورُ', shape: 'square' },
        ]
      },
      {
        id: 'q_nahw_2',
        text: 'فِي جُمْلَةِ: (المُعَلِّمُونَ مُخْلِصُونَ)، مَا عَلَامَةُ رَفْعِ المُبْتَدَأِ؟',
        timeLimitSeconds: 20,
        explanation: 'المُعَلِّمُونَ: جَمْعُ مُذَكَّرٍ سَالِمٍ، وَعَلَامَةُ رَفْعِهِ هِيَ الوَاوُ.',
        correctIndex: 1,
        options: [
          { id: '0', text: 'الضَّمَّةُ الظَّاهِرَةُ', shape: 'triangle' },
          { id: '1', text: 'الوَاوُ لِأَنَّهُ جَمْعُ مُذَكَّرٍ سَالِمٌ ✨', shape: 'diamond' },
          { id: '2', text: 'الأَلِفُ لِأَنَّهُ مُثَنًّى', shape: 'circle' },
          { id: '3', text: 'ثُبُوتُ النُّونِ', shape: 'square' },
        ]
      },
      {
        id: 'q_nahw_3',
        text: 'حَدِّدِ الخَبَرَ فِي جُمْلَةِ: (الصِّدْقُ خُلُقٌ عَظِيمٌ):',
        timeLimitSeconds: 15,
        explanation: 'الخَبَرُ هُوَ كَلِمَةُ (خُلُقٌ) لِأَنَّهَا تُتَمِّمُ مَعْنَى الجُمْلَةِ مَعَ المُبْتَدَأِ.',
        correctIndex: 2,
        options: [
          { id: '0', text: 'الصِّدْقُ', shape: 'triangle' },
          { id: '1', text: 'عَظِيمٌ (نَعْتٌ)', shape: 'diamond' },
          { id: '2', text: 'خُلُقٌ (خَبَرٌ مَرْفُوعٌ) 🎯', shape: 'circle' },
          { id: '3', text: 'ضَمِيرٌ مُسْتَتِرٌ', shape: 'square' },
        ]
      },
      {
        id: 'q_nahw_4',
        text: 'كَيْفَ يَكُونُ حُكْمُ إِعْرَابِ المُبْتَدَأِ وَالخَبَرِ دَائِمًا؟',
        timeLimitSeconds: 15,
        explanation: 'المُبْتَدَأُ وَالخَبَرُ مَرْفُوعَانِ دَائِمًا إِلَّا إِذَا دَخَلَتْ عَلَيْهِمَا النَّوَاسِخُ.',
        correctIndex: 3,
        options: [
          { id: '0', text: 'مَنْصُوبَانِ دَائِمًا', shape: 'triangle' },
          { id: '1', text: 'مَجْرُورَانِ دَائِمًا', shape: 'diamond' },
          { id: '2', text: 'مَجْزُومَانِ دَائِمًا', shape: 'circle' },
          { id: '3', text: 'مَرْفُوعَانِ دَائِمًا 🏅', shape: 'square' },
        ]
      }
    ]
  },
  {
    id: 'quiz_demo_hamza_2',
    title: 'سِبَاقُ الهَمَزَاتِ وَالإِمْلَاءِ الذَّكِيِّ ⚡',
    description: 'تحدي كشف همزتي الوصل والقطع ورسم الهمزة المتوسطة والمتطرفة.',
    teacher_id: 'usr_teacher',
    teacher_name: 'الأستاذة فاطمة الزهراء',
    target_grade: 'grade-3',
    target_track: 'arabic-a',
    topic: 'الهمزات والإملاء',
    created_at: new Date().toISOString(),
    questions: [
      {
        id: 'q_hmz_1',
        text: 'أَيُّ الكَلِمَاتِ التَّالِيَةِ تَبْدَأُ بِـ (هَمْزَةِ قَطْعٍ)؟',
        timeLimitSeconds: 20,
        explanation: 'هَمْزَةُ القَطْعِ تَظْهَرُ فِي النُّطْقِ وَالكِتَابَةِ مِثْلَ: أَحْمَد، أَخَذَ، إِبْرَاهِيم.',
        correctIndex: 0,
        options: [
          { id: '0', text: 'أَكْرَمَ (هَمْزَةُ قَطْعٍ) 🎯', shape: 'triangle' },
          { id: '1', text: 'انْتَصَرَ', shape: 'diamond' },
          { id: '2', text: 'اسْتِغْفَار', shape: 'circle' },
          { id: '3', text: 'المَدْرَسَة', shape: 'square' },
        ]
      },
      {
        id: 'q_hmz_2',
        text: 'كَيْفَ تُكْتَبُ الهَمْزَةُ فِي كَلِمَةِ: (سُـ...ـالٌ)؟',
        timeLimitSeconds: 20,
        explanation: 'تُكْتَبُ عَلَى الوَاوِ (سُؤَالٌ) لِأَنَّ مَا قَبْلَهَا مَضْمُومٌ وَهِيَ مَفْتُوحَةٌ، وَالضَّمَّةُ أَقْوَى مِنَ الفَتْحَةِ.',
        correctIndex: 1,
        options: [
          { id: '0', text: 'عَلَى نَبْرَةٍ (سِئَال)', shape: 'triangle' },
          { id: '1', text: 'عَلَى الوَاوِ (سُؤَالٌ) 🪶', shape: 'diamond' },
          { id: '2', text: 'عَلَى الأَلِفِ (سَأَال)', shape: 'circle' },
          { id: '3', text: 'عَلَى السَّطْرِ (سءال)', shape: 'square' },
        ]
      },
      {
        id: 'q_hmz_3',
        text: 'فِي كَلِمَةِ (شَاطِـئ)، لِمَاذَا كُتِبَتِ الهَمْزَةُ عَلَى اليَاءِ؟',
        timeLimitSeconds: 15,
        explanation: 'كُتِبَتْ عَلَى اليَاءِ (شَاطِئ) لِأَنَّ الحَرْفَ الَّذِي قَبْلَهَا مَكْسُورٌ (الطَّاء).',
        correctIndex: 2,
        options: [
          { id: '0', text: 'لِأَنَّهَا سَاكِنَةٌ', shape: 'triangle' },
          { id: '1', text: 'لِأَنَّ مَا قَبْلَهَا مَفْتُوحٌ', shape: 'diamond' },
          { id: '2', text: 'لِأَنَّ الحَرْفَ السَّابِقَ لَهَا مَكْسُورٌ 🌊', shape: 'circle' },
          { id: '3', text: 'لِأَنَّهَا فِي أَوَّلِ الكَلِمَةِ', shape: 'square' },
        ]
      }
    ]
  },
  {
    id: 'quiz_demo_kg_letters',
    title: 'تَحَدِّي الحُرُوفِ وَالأَصْوَاتِ المَرَحَةِ 🎈',
    description: 'تحدي مناسب للصفوف الأولية ورياض الأطفال في تمييز الحركات والحروف.',
    teacher_id: 'usr_teacher',
    teacher_name: 'الأستاذة فاطمة الزهراء',
    target_grade: 'grade-1',
    target_track: 'arabic-a',
    topic: 'الحروف والأصوات',
    created_at: new Date().toISOString(),
    questions: [
      {
        id: 'q_kg_1',
        text: 'مَا الصَّوْتُ الأَوَّلُ لِكَلِمَةِ: (بَطَّةٌ)؟',
        timeLimitSeconds: 15,
        explanation: 'تَبْدَأُ كَلِمَةُ (بَطَّةٌ) بِحَرْفِ البَاءِ مَعَ الفَتْحَةِ: بَـ.',
        correctIndex: 0,
        options: [
          { id: '0', text: 'بَـ (بَطَّةٌ) 🦆', shape: 'triangle' },
          { id: '1', text: 'تَـ (تُفَّاحَةٌ)', shape: 'diamond' },
          { id: '2', text: 'ثَـ (ثَعْلَبٌ)', shape: 'circle' },
          { id: '3', text: 'جَـ (جَمَلٌ)', shape: 'square' },
        ]
      },
      {
        id: 'q_kg_2',
        text: 'أَيُّ الكَلِمَاتِ التَّالِيَةِ تَحْتَوِي عَلَى (مَدٍّ بِالأَلِفِ)؟',
        timeLimitSeconds: 15,
        explanation: 'كَلِمَةُ (بَابٌ) فِيهَا مَدٌّ بِالأَلِفِ يَفْتَحُ الفَمَ مَعَ حَرْفِ البَاءِ.',
        correctIndex: 1,
        options: [
          { id: '0', text: 'فِيلٌ', shape: 'triangle' },
          { id: '1', text: 'بَابٌ 🚪', shape: 'diamond' },
          { id: '2', text: 'نُورٌ', shape: 'circle' },
          { id: '3', text: 'شَمْسٌ', shape: 'square' },
        ]
      },
      {
        id: 'q_kg_3',
        text: 'مَا هِيَ الحَرَكَةُ الَّتِي تَجْعَلُنَا نَضُمُّ شِفَاهَنَا عِنْدَ النُّطْقِ؟',
        timeLimitSeconds: 15,
        explanation: 'الضَّمَّةُ هِيَ الحَرَكَةُ الَّتِي نَضُمُّ بِهَا الشَّفَتَيْنِ مِثْلَ: بُـ.',
        correctIndex: 2,
        options: [
          { id: '0', text: 'الفَتْحَةُ', shape: 'triangle' },
          { id: '1', text: 'الكَسْرَةُ', shape: 'diamond' },
          { id: '2', text: 'الضَّمَّةُ ُ ⭕', shape: 'circle' },
          { id: '3', text: 'السُّكُونُ', shape: 'square' },
        ]
      }
    ]
  }
];
