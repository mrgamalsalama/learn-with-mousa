import { GradeLevel, ORFPassage, ORFBenchmarkLevel, ORFErrorCategory } from '../types';

export interface ORFGradeBenchmark {
  grade: GradeLevel;
  gradeLabel: string;
  fallTargetWCPM: number;
  winterTargetWCPM: number;
  springTargetWCPM: number;
  benchmarks: {
    belowBasicMax: number;
    basicMax: number;
    proficientMax: number;
    advancedMin: number;
  };
}

// المعايير المعيارية لسرعة القراءة الشفهية باللغة العربية (WCPM) وفق الدراسات الأكاديمية المقارنة
export const ORF_GRADE_BENCHMARKS: Record<GradeLevel, ORFGradeBenchmark> = {
  'kg': {
    grade: 'kg',
    gradeLabel: 'رياض الأطفال',
    fallTargetWCPM: 15,
    winterTargetWCPM: 25,
    springTargetWCPM: 35,
    benchmarks: {
      belowBasicMax: 15,
      basicMax: 25,
      proficientMax: 40,
      advancedMin: 41,
    },
  },
  'grade-1': {
    grade: 'grade-1',
    gradeLabel: 'الصف الأول الابتدائي',
    fallTargetWCPM: 25,
    winterTargetWCPM: 45,
    springTargetWCPM: 60,
    benchmarks: {
      belowBasicMax: 30,
      basicMax: 50,
      proficientMax: 70,
      advancedMin: 71,
    },
  },
  'grade-2': {
    grade: 'grade-2',
    gradeLabel: 'الصف الثاني الابتدائي',
    fallTargetWCPM: 55,
    winterTargetWCPM: 75,
    springTargetWCPM: 90,
    benchmarks: {
      belowBasicMax: 50,
      basicMax: 70,
      proficientMax: 95,
      advancedMin: 96,
    },
  },
  'grade-3': {
    grade: 'grade-3',
    gradeLabel: 'الصف الثالث الابتدائي',
    fallTargetWCPM: 75,
    winterTargetWCPM: 95,
    springTargetWCPM: 110,
    benchmarks: {
      belowBasicMax: 70,
      basicMax: 90,
      proficientMax: 115,
      advancedMin: 116,
    },
  },
  'grade-4': {
    grade: 'grade-4',
    gradeLabel: 'الصف الرابع الابتدائي',
    fallTargetWCPM: 90,
    winterTargetWCPM: 110,
    springTargetWCPM: 125,
    benchmarks: {
      belowBasicMax: 85,
      basicMax: 105,
      proficientMax: 130,
      advancedMin: 131,
    },
  },
  'grade-5': {
    grade: 'grade-5',
    gradeLabel: 'الصف الخامس الابتدائي',
    fallTargetWCPM: 105,
    winterTargetWCPM: 125,
    springTargetWCPM: 140,
    benchmarks: {
      belowBasicMax: 100,
      basicMax: 120,
      proficientMax: 145,
      advancedMin: 146,
    },
  },
  'grade-6': {
    grade: 'grade-6',
    gradeLabel: 'الصف السادس الابتدائي',
    fallTargetWCPM: 115,
    winterTargetWCPM: 135,
    springTargetWCPM: 150,
    benchmarks: {
      belowBasicMax: 110,
      basicMax: 130,
      proficientMax: 155,
      advancedMin: 156,
    },
  },
  'grade-7': {
    grade: 'grade-7',
    gradeLabel: 'الصف السابع',
    fallTargetWCPM: 120,
    winterTargetWCPM: 140,
    springTargetWCPM: 155,
    benchmarks: { belowBasicMax: 115, basicMax: 135, proficientMax: 160, advancedMin: 161 },
  },
  'grade-8': {
    grade: 'grade-8',
    gradeLabel: 'الصف الثامن',
    fallTargetWCPM: 125,
    winterTargetWCPM: 145,
    springTargetWCPM: 160,
    benchmarks: { belowBasicMax: 120, basicMax: 140, proficientMax: 165, advancedMin: 166 },
  },
  'grade-9': {
    grade: 'grade-9',
    gradeLabel: 'الصف التاسع',
    fallTargetWCPM: 130,
    winterTargetWCPM: 150,
    springTargetWCPM: 165,
    benchmarks: { belowBasicMax: 125, basicMax: 145, proficientMax: 170, advancedMin: 171 },
  },
  'grade-10': {
    grade: 'grade-10',
    gradeLabel: 'الصف العاشر',
    fallTargetWCPM: 135,
    winterTargetWCPM: 155,
    springTargetWCPM: 170,
    benchmarks: { belowBasicMax: 130, basicMax: 150, proficientMax: 175, advancedMin: 176 },
  },
  'grade-11': {
    grade: 'grade-11',
    gradeLabel: 'الصف الحادي عشر',
    fallTargetWCPM: 140,
    winterTargetWCPM: 160,
    springTargetWCPM: 175,
    benchmarks: { belowBasicMax: 135, basicMax: 155, proficientMax: 180, advancedMin: 181 },
  },
  'grade-12': {
    grade: 'grade-12',
    gradeLabel: 'الصف الثاني عشر',
    fallTargetWCPM: 145,
    winterTargetWCPM: 165,
    springTargetWCPM: 180,
    benchmarks: { belowBasicMax: 140, basicMax: 160, proficientMax: 185, advancedMin: 186 },
  },
};

// نصوص القراءة الشفهية المعيارية المشكولة بالكامل
export const ORF_STANDARD_PASSAGES: ORFPassage[] = [
  {
    id: 'orf_g1_01',
    title: 'صَبَاحُ الأَرْنَبِ الصَّغِيرِ (الصف الأول)',
    targetGrade: ['kg', 'grade-1'],
    genre: 'narrative',
    wordCount: 42,
    difficultyLexile: '250L',
    text: `اسْتَيْقَظَ الأَرْنَبُ الصَّغِيرُ بَاسِمٌ مَعَ شُرُوقِ الشَّمْسِ الذَّهَبِيَّةِ. قَفَزَ بَيْنَ الأَزْهَارِ الحَمْرَاءِ فِي البُسْتَانِ البَدِيعِ، وَقَطَفَ جَزَرَةً صَفْرَاءَ لَذِيذَةً. قَالَ بَاسِمٌ فِي فَرَحٍ: «مَا أَجْمَلَ هَذَا الصَّبَاحَ المُنِيرَ! سَأَذْهَبُ لأَلْعَبَ مَعَ أَصْدِقَائِي فَوْقَ العُشْبِ الأَخْضَرِ!»`,
  },
  {
    id: 'orf_g2_01',
    title: 'رِحْلَةُ النَّمْلَةِ النَّشِيطَةِ (الصف الثاني)',
    targetGrade: ['grade-2'],
    genre: 'narrative',
    wordCount: 65,
    difficultyLexile: '420L',
    text: `خَرَجَتِ النَّمْلَةُ الصَّغِيرَةُ نَدَى تَبْحَثُ عَنْ حَبَّةِ قَمْحٍ لِتُخَزِّنَهَا لِفَصْلِ الشِّتَاءِ البَارِدِ. وَجَدَتْ حَبَّةً كَبِيرَةً فَحَاوَلَتْ حَمْلَهَا وَحْدَهَا فَلَمْ تَقْدِرْ. نَادَتْ أُخْتَهَا نُورَ، فَتَعَاوَنَتِ النَّمْلَتَانِ مَعًا بِجِدٍّ وَصَبْرٍ حَتَّى وَصَلَتَا إِلَى بَيْتِهِمَا الدَّافِئِ بِسَلامٍ. فَرِحَتْ نَدَى وَقَالَتْ: «إِنَّ التَّعَاوُنَ سِرُّ النَّجَاحِ دَائِمًا!»`,
  },
  {
    id: 'orf_g3_01',
    title: 'سَفِينَةُ الصَّحْرَاءِ وَأَسْرَارُهَا (الصف الثالث)',
    targetGrade: ['grade-3'],
    genre: 'informative',
    wordCount: 88,
    difficultyLexile: '580L',
    text: `يُعَدُّ الجَمَلُ مِنْ أَعْجَبِ المَخْلُوقَاتِ الَّتِي خَلَقَهَا اللهُ تَعَالَى؛ إِذْ يَتَحَمَّلُ العَطَشَ وَالجُوعَ لِأَيَّامٍ طَوِيلَةٍ فِي الصَّحْرَاءِ القَاحِلَةِ. وَقَدْ جَعَلَ اللهُ لَهُ خُفًّا عَرِيضًا يَمْنَعُ غَوْصَ قَدَمَيْهِ فِي الرِّمَالِ النَّاعِمَةِ، كَمَا يَحْمِي عَيْنَيْهِ بِرُمُوشٍ كَثِيفَةٍ تَقِيهِ مِنْ عَوَاصِفِ الغُبَارِ. كَانَ العَرَبُ قَدِيمًا يَعْتَمِدُونَ عَلَيْهِ فِي أَسْفَارِهِمْ وَتِجَارَتِهِمْ، وَيُلَقِّبُونَهُ بِـ «سَفِينَةِ الصَّحْرَاءِ» لِقُوَّةِ تَحَمُّلِهِ وَعَظِيمِ مَنَافِعِهِ لِلإِنْسَانِ.`,
  },
  {
    id: 'orf_g4_01',
    title: 'بَيْتُ الحِكْمَةِ وَنُورُ المَعْرِفَةِ (الصف الرابع إلى السادس)',
    targetGrade: ['grade-4', 'grade-5', 'grade-6'],
    genre: 'heritage',
    wordCount: 110,
    difficultyLexile: '750L',
    text: `أَنْشَأَ الخَلِيفَةُ هَارُونُ الرَّشِيدُ فِي بَغْدَادَ صَرْحًا عِلْمِيًّا فَرِيدًا سُمِّيَ «بَيْتَ الحِكْمَةِ»، وَازْدَهَرَ ازْدِهَارًا بَاهِرًا فِي عَهْدِ ابْنِهِ المَأْمُونِ. كَانَ هَذَا المَرْكَزُ مَنَارَةً لِلتَّرْجَمَةِ وَالتَّأْلِيفِ، حَيْثُ تَوَافَدَ إِلَيْهِ العُلَمَاءُ وَالبَاحِثُونَ مِنْ شَتَّى بِقَاعِ الأَرْضِ، فَتَرْجَمُوا أُمَّهَاتِ الكُتُبِ فِي الطِّبِّ، وَالفَلَكِ، وَالرِّيَاضِيَّاتِ، وَالفَلْسَفَةِ إِلَى اللُّغَةِ العَرَبِيَّةِ الفَصِيحَةِ. وَهَكَذَا صَارَتِ العَرَبِيَّةُ لُغَةَ العِلْمِ وَالحَضَارَةِ العَالَمِيَّةِ لِقُرُونٍ عَدِيدَةٍ، حَامِلَةً مَشَاعِلَ النُّورِ وَالتَّنْوِيرِ لِلإِنْسَانِيَّةِ جَمْعَاءَ.`,
  },
];

// دالة تقييم مستوى الطلاقة القرائية بمقارنة الـ WCPM بالمعيار العمري
export const evaluateORFPerformance = (
  wcpm: number,
  grade: GradeLevel
): {
  level: ORFBenchmarkLevel;
  labelAr: string;
  badgeColor: string;
  comparisonText: string;
  percentileApprox: number;
} => {
  const benchmark = ORF_GRADE_BENCHMARKS[grade] || ORF_GRADE_BENCHMARKS['grade-2'];
  const b = benchmark.benchmarks;

  if (wcpm >= b.advancedMin) {
    return {
      level: 'advanced',
      labelAr: 'مستوى طلاقة متفوق (Advanced Fluency) 🌟',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      comparisonText: `يتجاوز المعيار العمري المستهدف للصف بمعدل ممتاز (+${wcpm - benchmark.springTargetWCPM} كلمة/د).`,
      percentileApprox: 90,
    };
  }

  if (wcpm >= b.basicMax + 1) {
    return {
      level: 'proficient',
      labelAr: 'مستوى طلاقة متمكن ومعياري (Proficient) ✅',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      comparisonText: `يحقق المعدل المعياري المطلوب لصفه الدراسي بنجاح (${benchmark.springTargetWCPM} كلمة/د).`,
      percentileApprox: 75,
    };
  }

  if (wcpm >= b.belowBasicMax + 1) {
    return {
      level: 'basic',
      labelAr: 'مستوى طلاقة أساسي يحتاج تعزيزاً (Basic) ⚠️',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      comparisonText: `أقل قليلاً من المتوسط العمري للصف؛ يحتاج تدريباً على سرعة القراءة والوصل.`,
      percentileApprox: 45,
    };
  }

  return {
    level: 'below_basic',
    labelAr: 'دون المستوى المعياري يحتاج تدخلاً (Below Basic) 🚨',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    comparisonText: `فجوة في الطلاقة القرائية (${wcpm} مقابل المعيار ${benchmark.springTargetWCPM} كلمة/د).`,
    percentileApprox: 20,
  };
};

// دالة تصنيف نوع الخطأ الصوتي تلقائياً عند مقارنة الكلمة المنطوقة بالأصلية
export const detectArabicPhoneticError = (
  original: string,
  spoken: string
): ORFErrorCategory => {
  if (!spoken || spoken.trim() === '') return 'omission';

  // تجريد الحركات للمقارنة الهيكلية
  const stripHarakat = (t: string) => t.replace(/[\u064B-\u065F\u0670]/g, '');
  const origBare = stripHarakat(original);
  const spokenBare = stripHarakat(spoken);

  if (origBare === spokenBare) {
    // خطأ في التشكيل والحركات فقط
    return 'short_vowels';
  }

  // خطأ في المدود (أ، و، ي)
  if (
    (origBare.includes('ا') && !spokenBare.includes('ا')) ||
    (origBare.includes('و') && !spokenBare.includes('و')) ||
    (origBare.includes('ي') && !spokenBare.includes('ي'))
  ) {
    return 'long_vowels';
  }

  // خطأ في همزات الوصل والقطع
  if (
    (origBare.startsWith('ا') && !spokenBare.startsWith('ا')) ||
    (origBare.startsWith('إ') && spokenBare.startsWith('ا')) ||
    (origBare.startsWith('أ') && spokenBare.startsWith('ا'))
  ) {
    return 'hamzat';
  }

  // خطأ في اللام الشمسية أو القمرية
  if (origBare.startsWith('ال') && !spokenBare.startsWith('ال')) {
    return 'shams_qamar';
  }

  return 'hesitation';
};
