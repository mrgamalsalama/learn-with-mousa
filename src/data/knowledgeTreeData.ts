import { KnowledgeNode, KnowledgeDomainId, NodeMasteryState, NodeMasteryStatus } from '../types';
import { getNodeQuestions } from './knowledgeQuestionsBank';

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

// شجرة الكفايات الشاملة المتسلسلة (17 عقدة معرفية مترابطة، كل عقدة بها 50 سؤالاً مراجعاً)
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
    questions: getNodeQuestions('node_single_sounds'),
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
    questions: getNodeQuestions('node_short_vowels'),
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
    questions: getNodeQuestions('node_sukun_segments'),
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
    prerequisites: ['node_sukun_segments'],
    targetGrades: ['grade-1', 'grade-2'],
    cefrLevel: 'A1',
    questions: getNodeQuestions('node_long_vowels'),
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
    questions: getNodeQuestions('node_tanween'),
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
    prerequisites: ['node_tanween'],
    targetGrades: ['grade-2', 'grade-3'],
    cefrLevel: 'A2',
    questions: getNodeQuestions('node_shaddah'),
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
    questions: getNodeQuestions('node_shams_qamar'),
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
    questions: getNodeQuestions('node_taa_types'),
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
    questions: getNodeQuestions('node_word_parts'),
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
    questions: getNodeQuestions('node_sentence_structures'),
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
    questions: getNodeQuestions('node_subject_verb_agreement'),
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
    prerequisites: ['node_subject_verb_agreement'],
    targetGrades: ['grade-2', 'grade-3', 'grade-4'],
    cefrLevel: 'A2',
    questions: getNodeQuestions('node_literal_comprehension'),
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
    questions: getNodeQuestions('node_inferential_reading'),
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
    questions: getNodeQuestions('node_vocab_in_context'),
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
    questions: getNodeQuestions('node_sentence_combining'),
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
    questions: getNodeQuestions('node_figurative_language'),
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
    questions: getNodeQuestions('node_critical_appreciation'),
  },
];

// ================= خوارزمية التكرار المتباعد والتلاشي المعرفي (Spaced Repetition Decay) =================
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
