import { KnowledgeNode, KnowledgeDomainId, NodeMasteryState, NodeMasteryStatus } from '../types';

export interface KnowledgeDomainMeta {
  id: KnowledgeDomainId;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  colorBg: string;
  colorBorder: string;
  colorText: string;
  icon: string;
}

export const KNOWLEDGE_DOMAINS: Record<KnowledgeDomainId, KnowledgeDomainMeta> = {
  phonological_awareness: {
    id: 'phonological_awareness',
    titleAr: 'الوعي الصوتي والفونيمي',
    titleEn: 'Phonological Awareness',
    descriptionAr: 'تمييز الأصوات المفردة، تقطيع المقاطع، ومخارج الحروف العربية الفصيحة.',
    colorBg: 'bg-emerald-50',
    colorBorder: 'border-emerald-300',
    colorText: 'text-emerald-800',
    icon: '🔊',
  },
  phonics_decoding: {
    id: 'phonics_decoding',
    titleAr: 'فك الترميز والمدود والتشكيل',
    titleEn: 'Phonics & Decoding',
    descriptionAr: 'الربط بين الصوت والرمز المكتوب، المدود، التنوين، والشدة.',
    colorBg: 'bg-teal-50',
    colorBorder: 'border-teal-300',
    colorText: 'text-teal-800',
    icon: '🔤',
  },
  morphology_grammar: {
    id: 'morphology_grammar',
    titleAr: 'الصرف وبنية الكلمة والنحو',
    titleEn: 'Morphology & Grammar',
    descriptionAr: 'أقسام الكلمة، الجملة الاسمية والفعلية، وضبط أواخر الكلمات إعرابياً.',
    colorBg: 'bg-blue-50',
    colorBorder: 'border-blue-300',
    colorText: 'text-blue-800',
    icon: '📐',
  },
  reading_comprehension: {
    id: 'reading_comprehension',
    titleAr: 'الفهم القرائي والاستيعاب',
    titleEn: 'Reading Comprehension',
    descriptionAr: 'استخلاص الأفكار، القراءة الاستنتاجية، والربط الدلالي في النصوص.',
    colorBg: 'bg-indigo-50',
    colorBorder: 'border-indigo-300',
    colorText: 'text-indigo-800',
    icon: '📖',
  },
  rhetoric_expression: {
    id: 'rhetoric_expression',
    titleAr: 'التعبير والبلاغة والجماليات',
    titleEn: 'Rhetoric & Expression',
    descriptionAr: 'الكتابة الإبداعية، التشبيهات البلاغية، والأساليب الفنية الرفيعة.',
    colorBg: 'bg-purple-50',
    colorBorder: 'border-purple-300',
    colorText: 'text-purple-800',
    icon: '✨',
  },
};

// شجرة الكفايات الشاملة المتسلسلة (18 عقدة معرفية مترابطة)
export const KNOWLEDGE_TREE_NODES: KnowledgeNode[] = [
  // المستوى 1: التأسيس الصوتي الأولي
  {
    id: 'node_single_sounds',
    domain: 'phonological_awareness',
    level: 1,
    tierIndex: 1,
    titleAr: 'أصوات الحروف المفردة',
    titleEn: 'Single Letter Sounds',
    descriptionAr: 'التمييز بين أصوات الحروف الهجائية الثمانية والعشرين ومخارجها الصحيحة.',
    icon: '🗣️',
    prerequisites: [],
    targetGrades: ['kg', 'grade-1'],
    cefrLevel: 'A1',
    questions: [
      {
        id: 'q_snd_1',
        prompt: 'مَا الصَّوْتُ الأَوَّلُ الَّذِي نَسْمَعُهُ فِي كَلِمَةِ (بَطَّةٌ)؟',
        options: ['صَوْتُ البَاءِ (بَ)', 'صَوْتُ التَّاءِ (تَ)', 'صَوْتُ النُّونِ (نَ)', 'صَوْتُ اللَّامِ (لَ)'],
        correctAnswer: 'صَوْتُ البَاءِ (بَ)',
        explanation: 'كَلِمَةُ (بَطَّة) تَبْدَأُ بِحَرْفِ البَاءِ مَفْتُوحاً (بَ).'
      },
      {
        id: 'q_snd_2',
        prompt: 'أَيٌّ مِنَ الكَلِمَاتِ التَّالِيَةِ تَبْدَأُ بِحَرْفِ (المِيمِ)؟',
        options: ['مَسْجِدٌ', 'كِتَابٌ', 'شَجَرَةٌ', 'بَيْتٌ'],
        correctAnswer: 'مَسْجِدٌ',
        explanation: 'كَلِمَةُ (مَسْجِد) تَبْدَأُ بِصَوْتِ المِيمِ.'
      }
    ]
  },
  {
    id: 'node_short_vowels',
    domain: 'phonological_awareness',
    level: 1,
    tierIndex: 2,
    titleAr: 'الحركات الثلاث (فَ، فُ، فِ)',
    titleEn: 'Short Vowels (Harakat)',
    descriptionAr: 'نطق وتمييز الفتحة والضمة والكسرة مع الحروف المختلفة.',
    icon: '🌱',
    prerequisites: ['node_single_sounds'],
    targetGrades: ['kg', 'grade-1'],
    cefrLevel: 'A1',
    questions: [
      {
        id: 'q_vow_1',
        prompt: 'مَا الحَرَكَةُ الَّتِي تُرْسَمُ فَوْقَ الحَرْفِ وَتَفْتَحُ الفَمَ عِنْدَ نُطْقِهَا؟',
        options: ['الفَتْحَةُ ( َ )', 'الكَسْرَةُ ( ِ )', 'الضَّمَّةُ ( ُ )', 'السُّكُونُ ( ْ )'],
        correctAnswer: 'الفَتْحَةُ ( َ )',
        explanation: 'الفَتْحَةُ خَطٌّ صَغِيرٌ فَوْقَ الحَرْفِ يُفْتَحُ مَعَهُ الفَمُ.'
      },
      {
        id: 'q_vow_2',
        prompt: 'فِي كَلِمَةِ (كُـتُـبٌ)، مَا حَرَكَةُ حَرْفَيِ الكَافِ وَالتَّاءِ؟',
        options: ['الضَّمَّةُ', 'الفَتْحَةُ', 'الكَسْرَةُ', 'السُّكُونُ'],
        correctAnswer: 'الضَّمَّةُ',
        explanation: 'الحَرْفَانِ مَضْمُومَانِ: كُـ تُـ.'
      }
    ]
  },
  {
    id: 'node_sukun_segments',
    domain: 'phonological_awareness',
    level: 1,
    tierIndex: 3,
    titleAr: 'السكون والمقطع الساكن',
    titleEn: 'Sukun & Closed Syllables',
    descriptionAr: 'نطق الحرف الساكن متصلاً بما قبله وقراءة المقاطع الساكنة.',
    icon: '⭕',
    prerequisites: ['node_short_vowels'],
    targetGrades: ['grade-1', 'grade-2'],
    cefrLevel: 'A1',
    questions: [
      {
        id: 'q_suk_1',
        prompt: 'كَيْفَ يُنْطَقُ المَقْطَعُ السَّاكِنُ فِي كَلِمَةِ (مَدْرَسَة)؟',
        options: ['(مَدْ) دَفْعَةً وَاحِدَةً', '(مَ) ثُمَّ (دَ) مُنْفَصِلَيْنِ', '(دْ) وَحْدَهَا', '(رَسَ) مَعاً'],
        correctAnswer: '(مَدْ) دَفْعَةً وَاحِدَةً',
        explanation: 'الحَرْفُ السَّاكِنُ لَا يُنْطَقُ وَحْدَهُ، بَلْ مَعَ الحَرْفِ المُتَحَرِّكِ قَبْلَهُ.'
      }
    ]
  },

  // المستوى 2: فك الترميز والظواهر الإملائية
  {
    id: 'node_long_vowels',
    domain: 'phonics_decoding',
    level: 2,
    tierIndex: 4,
    titleAr: 'المدود الثلاثة (الألف، الواو، الياء)',
    titleEn: 'Long Vowels (Madd)',
    descriptionAr: 'التمييز بين الحركات القصيرة والمدود الطويلة ومطابقتها.',
    icon: '〰️',
    prerequisites: ['node_short_vowels'],
    targetGrades: ['grade-1', 'grade-2'],
    cefrLevel: 'A1',
    questions: [
      {
        id: 'q_madd_1',
        prompt: 'أَيٌّ مِنَ الكَلِمَاتِ التَّالِيَةِ تَحْتَوِي عَلَى مَدٍّ بِالوَاوِ؟',
        options: ['نُورٌ', 'وَلَدٌ', 'وَرْدَةٌ', 'وَقَفَ'],
        correctAnswer: 'نُورٌ',
        explanation: 'حَرْفُ الوَاوِ فِي (نُور) مَدٌّ سَاكِنٌ قَبْلَهُ ضَمَّةٌ، أَمَّا الأُخْرَى فَهِيَ حُرُوفٌ مُتَحَرِّكَةٌ.'
      }
    ]
  },
  {
    id: 'node_tanween',
    domain: 'phonics_decoding',
    level: 2,
    tierIndex: 5,
    titleAr: 'التنوين (ضم، فتح، كسر)',
    titleEn: 'Tanween (Nunation)',
    descriptionAr: 'نون ساكنة تنطق ولا تكتب في آخر الأسماء المعربة.',
    icon: '🔔',
    prerequisites: ['node_long_vowels'],
    targetGrades: ['grade-1', 'grade-2', 'grade-3'],
    cefrLevel: 'A1',
    questions: [
      {
        id: 'q_tan_1',
        prompt: 'مَا الكِتَابَةُ الصَّحِيحَةُ لِكَلِمَةِ (شُكْرًا)؟',
        options: ['شُكْرًا (تَنْوِينُ فَتْحٍ مَعَ أَلِفٍ)', 'شُكْرَنْ (بِالنُّونِ الصَّرِيحَةِ)', 'شُكْرَ (دُونَ تَنْوِينٍ)', 'شُكْرُنْ'],
        correctAnswer: 'شُكْرًا (تَنْوِينُ فَتْحٍ مَعَ أَلِفٍ)',
        explanation: 'التَّنْوِينُ نُونٌ تُلْفَظُ وَلَا تُكْتَبُ، وَيُلْحَقُ بِتَنْوِينِ الفَتْحِ أَلِفٌ عِوَضِيَّةٌ.'
      }
    ]
  },
  {
    id: 'node_shaddah',
    domain: 'phonics_decoding',
    level: 2,
    tierIndex: 6,
    titleAr: 'الشدة والحرف المضعف',
    titleEn: 'Shaddah & Gemination',
    descriptionAr: 'حرفان متماثلان أولهما ساكن وثانيهما متحرك أدغما معاً.',
    icon: '⚡',
    prerequisites: ['node_sukun_segments'],
    targetGrades: ['grade-2', 'grade-3'],
    cefrLevel: 'A2',
    questions: [
      {
        id: 'q_shd_1',
        prompt: 'فِي كَلِمَةِ (مُعَلِّمٌ)، مَا الحَرْفُ المُشَدَّدُ؟',
        options: ['اللَّامُ (لّـ)', 'المِيمُ (مُ)', 'العَيْنُ (عَ)', 'التَّنْوِينُ'],
        correctAnswer: 'اللَّامُ (لّـ)',
        explanation: 'اللَّامُ مُضَعَّفَةٌ مَكْسُورَةٌ: مُعَلْـلِم.'
      }
    ]
  },
  {
    id: 'node_shams_qamar',
    domain: 'phonics_decoding',
    level: 2,
    tierIndex: 7,
    titleAr: 'اللام الشمسية واللام القمرية',
    titleEn: 'Solar & Lunar Lam',
    descriptionAr: 'التمييز بين اللام المظهرة الساكنة واللام المدغمة في الحرف الشمسي.',
    icon: '☀️🌙',
    prerequisites: ['node_shaddah'],
    targetGrades: ['grade-1', 'grade-2', 'grade-3'],
    cefrLevel: 'A2',
    questions: [
      {
        id: 'q_lam_1',
        prompt: 'كَلِمَةُ (الشَّمْسُ) تَحْتَوِي عَلَى:',
        options: ['لَامٍ شَمْسِيَّةٍ تُكْتَبُ وَلَا تُنْطَقُ', 'لَامٍ قَمَرِيَّةٍ تُنْطَقُ بِوُضُوحٍ', 'لَامٍ أَصْلِيَّةٍ', 'لَا تُوجَدُ لَامٌ'],
        correctAnswer: 'لَامٍ شَمْسِيَّةٍ تُكْتَبُ وَلَا تُنْطَقُ',
        explanation: 'حَرْفُ الشِّينِ شَمْسِيٌّ؛ تُدْغَمُ فِيهِ اللَّامُ فَيُصْبِحُ مُشَدَّداً.'
      }
    ]
  },
  {
    id: 'node_taa_types',
    domain: 'phonics_decoding',
    level: 2,
    tierIndex: 8,
    titleAr: 'التاء المربوطة والمفتوحة والهاء',
    titleEn: 'Taa Marbuta & Maftuha',
    descriptionAr: 'التمييز بين التاء التي تنطق هاءً عند الوقف وتلك التي تبقى تاءً.',
    icon: '🎀',
    prerequisites: ['node_shams_qamar'],
    targetGrades: ['grade-2', 'grade-3', 'grade-4'],
    cefrLevel: 'A2',
    questions: [
      {
        id: 'q_taa_1',
        prompt: 'كَلِمَةُ (مَدْرَسَة) عِنْدَ الوَقْفِ عَلَيْهَا بِالسُّكُونِ تُنْطَقُ:',
        options: ['هَاءً (مَدْرَسَهْ)', 'تَاءً صَرِيحَةً', 'وَاوًا', 'أَلِفاً'],
        correctAnswer: 'هَاءً (مَدْرَسَهْ)',
        explanation: 'التَّاءُ المَرْبُوطَةُ تُنْطَقُ هَاءً عِنْدَ الوَقْفِ وَتَاءً عِنْدَ الوَصْلِ.'
      }
    ]
  },

  // المستوى 3: الصرف وبنية الكلمة والنحو
  {
    id: 'node_word_parts',
    domain: 'morphology_grammar',
    level: 3,
    tierIndex: 9,
    titleAr: 'أقسام الكلمة (اسم، فعل، حرف)',
    titleEn: 'Parts of Speech',
    descriptionAr: 'تصنيف الكلمات العربية إلى أسماء وأفعال وحروف بحسب علاماتها.',
    icon: '🧱',
    prerequisites: ['node_taa_types'],
    targetGrades: ['grade-3', 'grade-4'],
    cefrLevel: 'A2',
    questions: [
      {
        id: 'q_pos_1',
        prompt: 'كَلِمَةُ (يَقْرَأُ) تُصَنَّفُ عَلَى أَنَّهَا:',
        options: ['فِعْلٌ مُضَارِعٌ', 'اسْمٌ ظَاهِرٌ', 'حَرْفُ جَرٍّ', 'ظَرْفُ زَمَانٍ'],
        correctAnswer: 'فِعْلٌ مُضَارِعٌ',
        explanation: 'تَدُلُّ عَلَى حَدَثٍ يَقَعُ فِي الزَّمَنِ الحَاضِرِ.'
      }
    ]
  },
  {
    id: 'node_sentence_structures',
    domain: 'morphology_grammar',
    level: 3,
    tierIndex: 10,
    titleAr: 'الجملة الاسمية والجملة الفعلية',
    titleEn: 'Nominal & Verbal Sentences',
    descriptionAr: 'تحديد أركان الجملة وتمييز المبتدأ والخبر من الفعل والفاعل.',
    icon: '⚖️',
    prerequisites: ['node_word_parts'],
    targetGrades: ['grade-3', 'grade-4', 'grade-5'],
    cefrLevel: 'B1',
    questions: [
      {
        id: 'q_sen_1',
        prompt: '«العِلْمُ نُورٌ» هَذِهِ الجُمْلَةُ:',
        options: ['جُمْلَةٌ اسْمِيَّةٌ تَبْدَأُ بِاسْمٍ', 'جُمْلَةٌ فِعْلِيَّةٌ', 'شِبْهُ جُمْلَةٍ', 'جُمْلَةٌ اسْتِفْهَامِيَّةٌ'],
        correctAnswer: 'جُمْلَةٌ اسْمِيَّةٌ تَبْدَأُ بِاسْمٍ',
        explanation: 'بَدَأَتْ بِاسْمٍ مَرْفُوعٍ (العِلْمُ) فَهُوَ مُبْتَدَأٌ.'
      }
    ]
  },
  {
    id: 'node_subject_verb_agreement',
    domain: 'morphology_grammar',
    level: 3,
    tierIndex: 11,
    titleAr: 'الفاعل والمفعول به والتطابق',
    titleEn: 'Subject, Object & Agreement',
    descriptionAr: 'ضبط حركة الفاعل (الرفع) والمفعول به (النصب) وتطابق التذكير والتأنيث.',
    icon: '🎯',
    prerequisites: ['node_sentence_structures'],
    targetGrades: ['grade-4', 'grade-5', 'grade-6'],
    cefrLevel: 'B1',
    questions: [
      {
        id: 'q_sub_1',
        prompt: '«كَتَبَ الطَّالِبُ الدَّرْسَ»، مَا إِعْرَابُ كَلِمَةِ (الطَّالِبُ)؟',
        options: ['فَاعِلٌ مَرْفُوعٌ بِالضَّمَّةِ', 'مَفْعُولٌ بِهِ مَنْصُوبٌ', 'مُبْتَدَأٌ مُؤَخَّرٌ', 'مَجْرُورٌ بِالكَسْرَةِ'],
        correctAnswer: 'فَاعِلٌ مَرْفُوعٌ بِالضَّمَّةِ',
        explanation: 'هُوَ الَّذِي قَامَ بِفِعْلِ الكِتَابَةِ.'
      }
    ]
  },

  // المستوى 4: الفهم القرائي والاستيعاب
  {
    id: 'node_literal_comprehension',
    domain: 'reading_comprehension',
    level: 4,
    tierIndex: 12,
    titleAr: 'الفهم المباشر واسترجاع التفاصيل',
    titleEn: 'Literal Comprehension',
    descriptionAr: 'استخراج الشخصيات، الزمان، المكان، والأحداث الصريحة من النص المقروء.',
    icon: '🔍',
    prerequisites: ['node_sentence_structures'],
    targetGrades: ['grade-2', 'grade-3', 'grade-4'],
    cefrLevel: 'A2',
    questions: [
      {
        id: 'q_lit_1',
        prompt: 'إِذَا ذَكَرَ النَّصُّ: «وَصَلَ القِطَارُ عِنْدَ الغُرُوبِ»، مَتَى وَصَلَ القِطَارُ؟',
        options: ['عِنْدَ وَقْتِ الغُرُوبِ', 'فِي مُنْتَصَفِ اللَّيْلِ', 'فِي الصَّبَاحِ البَاكِرِ', 'عِنْدَ الظَّهِيرَةِ'],
        correctAnswer: 'عِنْدَ وَقْتِ الغُرُوبِ',
        explanation: 'إِجَابَةٌ مَذْكُورَةٌ صَرَاحَةً فِي النَّصِّ.'
      }
    ]
  },
  {
    id: 'node_inferential_reading',
    domain: 'reading_comprehension',
    level: 4,
    tierIndex: 13,
    titleAr: 'القراءة الاستنتاجية والمغزى الضمني',
    titleEn: 'Inferential Comprehension',
    descriptionAr: 'قراءة ما بين السطور واستنتاج مشاعر الشخصيات والدروس المستفادة.',
    icon: '💡',
    prerequisites: ['node_literal_comprehension'],
    targetGrades: ['grade-3', 'grade-4', 'grade-5', 'grade-6'],
    cefrLevel: 'B1',
    questions: [
      {
        id: 'q_inf_1',
        prompt: '«تَنَفَّسَ الصَّعَدَاءَ وَابْتَسَمَ بَعْدَ إِعْلَانِ النَّتَائِجِ»، هَذَا يَدُلُّ عَلَى أَنَّهُ:',
        options: ['شَعَرَ بِالارْتِيَاحِ وَالسَّعَادَةِ', 'غَضِبَ غَضَباً شَدِيداً', 'شَعَرَ بِالخَوْفِ وَالحَيْرَةِ', 'أَرَادَ النَّوْمَ'],
        correctAnswer: 'شَعَرَ بِالارْتِيَاحِ وَالسَّعَادَةِ',
        explanation: 'تَنَفُّسُ الصَّعَدَاءِ مَعَ الابتسامة دَلِيلٌ عَلَى زَوَالِ القَلَقِ وَحُلُولِ الرَّاحَةِ.'
      }
    ]
  },
  {
    id: 'node_vocab_in_context',
    domain: 'reading_comprehension',
    level: 4,
    tierIndex: 14,
    titleAr: 'المفردات والسياق (الترادف والتضاد)',
    titleEn: 'Vocabulary in Context',
    descriptionAr: 'تحديد دلالة الكلمة بحسب موقعها في الجملة واكتشاف المشتركات اللفظية.',
    icon: '📚',
    prerequisites: ['node_inferential_reading'],
    targetGrades: ['grade-4', 'grade-5', 'grade-6'],
    cefrLevel: 'B1',
    questions: [
      {
        id: 'q_voc_1',
        prompt: 'مَا مُرَادِفُ كَلِمَةِ (شَاهِقٌ) فِي قَوْلِنَا: «جَبَلٌ شَاهِقٌ»؟',
        options: ['مُرْتَفِعٌ وَعَالٍ جِدًّا', 'مُنْخَفِضٌ', 'صَغِيرٌ', 'مُتَسِعٌ'],
        correctAnswer: 'مُرْتَفِعٌ وَعَالٍ جِدًّا',
        explanation: 'الشَّاهِقُ هُوَ العَالِي شَدِيدُ الارْتِفَاعِ.'
      }
    ]
  },

  // المستوى 5: التعبير والبلاغة والجماليات
  {
    id: 'node_sentence_combining',
    domain: 'rhetoric_expression',
    level: 5,
    tierIndex: 15,
    titleAr: 'الربط وأدوات العطف وبناء الفقرة',
    titleEn: 'Cohesion & Paragraph Building',
    descriptionAr: 'استخدام حروف العطف وأدوات الربط لبناء فقرات متماسكة المعنى.',
    icon: '🔗',
    prerequisites: ['node_vocab_in_context'],
    targetGrades: ['grade-4', 'grade-5', 'grade-6'],
    cefrLevel: 'B1',
    questions: [
      {
        id: 'q_coh_1',
        prompt: 'مَا أَدَاةُ الرَّبْطِ المُنَاسِبَةُ: «اجْتَهَدَ فِي دِرَاسَتِهِ، (.....) حَقَّقَ التَّفَوُّقَ»؟',
        options: ['لِذَلِكَ', 'لَكِنَّهُ', 'بَيْنَمَا', 'رَغْمَ أَنَّ'],
        correctAnswer: 'لِذَلِكَ',
        explanation: 'تُفِيدُ النَّتِيجَةَ المُرَتَّبَةَ عَلَى السَّبَبِ.'
      }
    ]
  },
  {
    id: 'node_figurative_language',
    domain: 'rhetoric_expression',
    level: 5,
    tierIndex: 16,
    titleAr: 'الصور البيانية والتشبيه البليغ',
    titleEn: 'Figurative Language & Similes',
    descriptionAr: 'تذوق أركان التشبيه والصور البلاغية التي تزيد المعنى جمالاً.',
    icon: '🎨',
    prerequisites: ['node_sentence_combining'],
    targetGrades: ['grade-5', 'grade-6', 'grade-7'],
    cefrLevel: 'B2',
    questions: [
      {
        id: 'q_fig_1',
        prompt: '«المُعَلِّمُ كَالشَّمْسِ فِي نَشْرِ النُّورِ»، مَا المُشَبَّهُ بِهِ فِي هَذِهِ الجُمْلَةِ؟',
        options: ['الشَّمْسُ', 'المُعَلِّمُ', 'النُّورُ', 'الكَافُ'],
        correctAnswer: 'الشَّمْسُ',
        explanation: 'المُعَلِّمُ مُشَبَّهٌ، وَالشَّمْسُ هِيَ المُشَبَّهُ بِهِ.'
      }
    ]
  },
  {
    id: 'node_critical_appreciation',
    domain: 'rhetoric_expression',
    level: 5,
    tierIndex: 17,
    titleAr: 'التذوق الأدبي والنقد اللغوي',
    titleEn: 'Literary Appreciation & Critical Thinking',
    descriptionAr: 'تحليل الأساليب الإنشائية والخبرية وإبداء الرأي النقدي المدلل.',
    icon: '👑',
    prerequisites: ['node_figurative_language'],
    targetGrades: ['grade-6', 'grade-7', 'grade-8'],
    cefrLevel: 'B2',
    questions: [
      {
        id: 'q_crt_1',
        prompt: 'أَيٌّ مِنَ الأَسَالِيبِ التَّالِيَةِ يُعَدُّ أُسْلُوبَ اسْتِفْهَامٍ بَلِيغاً؟',
        options: ['«هَلْ جَزَاءُ الإِحْسَانِ إِلَّا الإِحْسَانُ؟»', 'كَتَبْتُ وَاجِبِي مَسَاءً', 'يَا لَهُ مِنْ مَنْظَرٍ بَدِيعٍ!', 'احْرِصْ عَلَى وَقْتِكَ.'],
        correctAnswer: '«هَلْ جَزَاءُ الإِحْسَانِ إِلَّا الإِحْسَانُ؟»',
        explanation: 'اسْتِفْهَامٌ تَقْرِيرِيٌّ بَلِيغٌ يُؤَكِّدُ المَعْنَى.'
      }
    ]
  },
];

// ================= خوارزمية التكرار المتباعد والتلاشي المعرفي (Spaced Repetition Decay) =================
// يتم احتساب مستوى التلاشي استناداً إلى نصف العمر التخزيني للمعلومة (Half-Life Memory Decay):
// كلما طالت فترة عدم الممارسة، ينخفض مقياس الاحتفاظ حتى يحتاج التاج الذهبي إلى "صقل 🔄"
export const calculateSpacedRepetitionState = (
  lastPracticedDateStr: string | undefined,
  baseMasteryScore: number = 100,
  retentionStrengthDays: number = 14
): {
  decayPercentage: number;
  daysSincePractice: number;
  effectiveScore: number;
  status: NodeMasteryStatus;
} => {
  if (!lastPracticedDateStr) {
    return {
      decayPercentage: 100,
      daysSincePractice: 999,
      effectiveScore: 0,
      status: 'unlocked',
    };
  }

  const lastDate = new Date(lastPracticedDateStr).getTime();
  const now = Date.now();
  const daysDiff = Math.max(0, Math.floor((now - lastDate) / (1000 * 60 * 60 * 24)));

  // خوارزمية هيرمان إبنجهاوس للنسيان: R = e^(-t/S)
  const retention = Math.exp(-daysDiff / (retentionStrengthDays * 1.5));
  const effectiveScore = Math.max(10, Math.min(100, Math.round(baseMasteryScore * retention)));
  const decayPercentage = 100 - effectiveScore;

  let status: NodeMasteryStatus = 'mastered_gold';

  if (baseMasteryScore < 60) {
    status = 'practicing';
  } else if (daysDiff > 14 || decayPercentage > 25) {
    // يحتاج إلى صقل لإعادة التاج الذهبي
    status = 'needs_polish';
  } else {
    status = 'mastered_gold';
  }

  return {
    decayPercentage,
    daysSincePractice: daysDiff,
    effectiveScore,
    status,
  };
};
