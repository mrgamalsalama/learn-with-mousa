import { UILanguage, CEFRLevel, CEFRCompetencyDomain } from '../types';

export interface TranslationDictionary {
  appName: string;
  tagline: string;
  languageName: string;
  // Nav
  oralFluencyLab: string;
  knowledgeTree: string;
  languagePassport: string;
  gradebook: string;
  liveClass: string;
  // ORF
  orfTitle: string;
  orfSubtitle: string;
  recordVoice: string;
  stopRecording: string;
  evaluatingReading: string;
  wordsCorrectPerMinute: string;
  accuracyRate: string;
  readingSpeedBenchmark: string;
  oralReadingCertificate: string;
  printCertificate: string;
  // Knowledge Tree
  treeTitle: string;
  treeSubtitle: string;
  goldenMastery: string;
  needsPolish: string;
  practiceNode: string;
  crownsEarned: string;
  // CEFR Passport
  passportTitle: string;
  passportSubtitle: string;
  passportNumber: string;
  verifiedHours: string;
  targetArabic: string;
  nativeLanguage: string;
  printPassport: string;
  cefrFrameworkInfo: string;
  // Statuses
  belowBasic: string;
  basic: string;
  proficient: string;
  advanced: string;
  close: string;
}

export const I18N_DICTIONARIES: Record<UILanguage, TranslationDictionary> = {
  ar: {
    appName: 'تعلَّم مع مُوسَى',
    tagline: 'صُممت للضاد وليست معرّبة • المنظومة الأكاديمية العالمية',
    languageName: 'العربية (Arabic)',
    oralFluencyLab: 'مختبر الطلاقة القرائية (ORF) 🎙️',
    knowledgeTree: 'شجرة كفايات الضاد التكيفية 🌳',
    languagePassport: 'جواز السفر اللغوي الدولي (CEFR) 🛂',
    gradebook: 'سجل الدرجات والتحصيل 📊',
    liveClass: 'فصل موسى المباشر 🎥',
    orfTitle: 'القياس المعياري للطلاقة القرائية (Oral Reading Fluency)',
    orfSubtitle: 'المعيار الأكاديمي الدولي لاحتساب الكلمات الصحيحة في الدقيقة (WCPM) ومخارج الحروف',
    recordVoice: 'ابدأ قراءة النص بصوتك 🎙️',
    stopRecording: 'إيقاف واحتساب النتيجة ⏹️',
    evaluatingReading: 'جاري احتساب الطلاقة ومواضع التعثر الصوتي...',
    wordsCorrectPerMinute: 'الكلمات الصحيحة / دقيقة (WCPM)',
    accuracyRate: 'نسبة الدقة والضبط',
    readingSpeedBenchmark: 'المعيار العمري للصف',
    oralReadingCertificate: 'شهادة مقياس الطلاقة القرائية الرسمية',
    printCertificate: 'طباعة الشهادة الأكاديمية 🖨️',
    treeTitle: 'شجرة التعلّم التكيفي والتكرار المتباعد',
    treeSubtitle: 'خارطة الكفايات اللغوية الشاملة من الحرف المفرد حتى التعبير البلاغي',
    goldenMastery: 'إتقان تام (تاج ذهبي) 🏆',
    needsPolish: 'يحتاج إلى صقل وممارسة 🔄',
    practiceNode: 'جلسة صقل وممارسة سريعة ⚡',
    crownsEarned: 'تيجان الإتقان المكتسبة',
    passportTitle: 'جواز السفر اللغوي الدولي للغة العربية (CEFR)',
    passportSubtitle: 'الوثيقة المرجعية المعتمدة لتوثيق الكفايات والساعات التدريبية لمسار الناطقين بغيرها',
    passportNumber: 'رقم وثيقة الجواز اللغوي',
    verifiedHours: 'الساعات التدريبية المعتمدة',
    targetArabic: 'اللغة المستهدفة: العربية الفصحى (Modern Standard Arabic)',
    nativeLanguage: 'اللغة الأم للطالب',
    printPassport: 'طباعة جواز السفر اللغوي 🖨️',
    cefrFrameworkInfo: 'مبني وفق معايير الإطار الأوروبي المرجعي المشترك للغات (CEFR A1-B2)',
    belowBasic: 'دون المستوى المعياري 🚨',
    basic: 'مستوى أساسي ⚠️',
    proficient: 'مستوى متمكن ومعياري ✅',
    advanced: 'مستوى متفوق واستثنائي 🌟',
    close: 'إغلاق',
  },
  en: {
    appName: 'Learn with Mousa',
    tagline: 'Designed for Arabic, not Arabized • Global EdTech Suite',
    languageName: 'English',
    oralFluencyLab: 'Reading Fluency Lab (ORF) 🎙️',
    knowledgeTree: 'Adaptive Knowledge Tree 🌳',
    languagePassport: 'International Language Passport (CEFR) 🛂',
    gradebook: 'Gradebook & Analytics 📊',
    liveClass: 'Live Arabic Classroom 🎥',
    orfTitle: 'Standardized Oral Reading Fluency (ORF)',
    orfSubtitle: 'International benchmark for Words Correct Per Minute (WCPM) & Arabic Phonetics',
    recordVoice: 'Start Reading Aloud 🎙️',
    stopRecording: 'Stop & Calculate Score ⏹️',
    evaluatingReading: 'Analyzing fluency & phonetic accuracy...',
    wordsCorrectPerMinute: 'Words Correct Per Minute (WCPM)',
    accuracyRate: 'Phonetic Accuracy Rate',
    readingSpeedBenchmark: 'Grade-Level Target Benchmark',
    oralReadingCertificate: 'Official Oral Reading Fluency Certificate',
    printCertificate: 'Print Official Certificate 🖨️',
    treeTitle: 'Adaptive Competency Graph & Spaced Repetition',
    treeSubtitle: 'Mastery roadmap from foundational sounds to advanced eloquence',
    goldenMastery: 'Mastered Golden Crown 🏆',
    needsPolish: 'Needs Polish (Spaced Decay) 🔄',
    practiceNode: 'Quick Skill Polish Session ⚡',
    crownsEarned: 'Mastery Crowns Earned',
    passportTitle: 'International Arabic Language Passport (CEFR)',
    passportSubtitle: 'Accredited credential documenting certified Arabic proficiencies and hours',
    passportNumber: 'Passport Credential ID',
    verifiedHours: 'Certified Learning Hours',
    targetArabic: 'Target Language: Modern Standard Arabic (الفصحى)',
    nativeLanguage: 'Learner Native Language',
    printPassport: 'Print Language Passport 🖨️',
    cefrFrameworkInfo: 'Aligned with the Common European Framework of Reference (CEFR A1-B2)',
    belowBasic: 'Below Basic 🚨',
    basic: 'Basic ⚠️',
    proficient: 'Proficient ✅',
    advanced: 'Advanced 🌟',
    close: 'Close',
  },
  fr: {
    appName: 'Apprendre avec Mousa',
    tagline: 'Conçu pour la langue arabe • Suite EdTech Mondiale',
    languageName: 'Français (French)',
    oralFluencyLab: 'Laboratoire de Fluidité (ORF) 🎙️',
    knowledgeTree: 'Arbre des Compétences Adaptatif 🌳',
    languagePassport: 'Passeport Linguistique International (CECR) 🛂',
    gradebook: 'Carnet de Notes & Analyses 📊',
    liveClass: 'Classe en Direct 🎥',
    orfTitle: 'Évaluation Standardisée de la Fluidité de Lecture (ORF)',
    orfSubtitle: 'Norme internationale pour les mots corrects par minute (WCPM) en arabe',
    recordVoice: 'Commencer la lecture à voix haute 🎙️',
    stopRecording: 'Arrêter et calculer ⏹️',
    evaluatingReading: 'Analyse phonétique et calcul de fluidité...',
    wordsCorrectPerMinute: 'Mots Corrects Par Minute (WCPM)',
    accuracyRate: 'Taux de Précision Phonétique',
    readingSpeedBenchmark: 'Objectif de niveau scolaire',
    oralReadingCertificate: 'Certificat Officiel de Fluidité Orale',
    printCertificate: 'Imprimer le Certificat 🖨️',
    treeTitle: 'Arbre de Compétences Adaptatif & Répétition Espacée',
    treeSubtitle: 'Parcours d’apprentissage des sons fondamentaux à l’éloquence',
    goldenMastery: 'Couronne Dorée Maîtrisée 🏆',
    needsPolish: 'Nécessite un rafraîchissement 🔄',
    practiceNode: 'Session de Pratique Rapide ⚡',
    crownsEarned: 'Couronnes de Maîtrise Gagnées',
    passportTitle: 'Passeport Europass de Langue Arabe (CECR)',
    passportSubtitle: 'Document officiel certifiant les niveaux acquis en langue arabe',
    passportNumber: 'Identifiant du Passeport',
    verifiedHours: 'Heures d’apprentissage certifiées',
    targetArabic: 'Langue cible : Arabe Standard Moderne',
    nativeLanguage: 'Langue maternelle de l’élève',
    printPassport: 'Imprimer le Passeport 🖨️',
    cefrFrameworkInfo: 'Conforme au Cadre européen commun de référence pour les langues (CECR)',
    belowBasic: 'En dessous du niveau de base 🚨',
    basic: 'Élémentaire ⚠️',
    proficient: 'Intermédiaire Maîtrisé ✅',
    advanced: 'Avancé 🌟',
    close: 'Fermer',
  },
  ur: {
    appName: 'موسیٰ کے ساتھ سیکھیں',
    tagline: 'خالص عربی زبان کے لیے ڈیزائن کیا گیا بین الاقوامی تعلیمی نظام',
    languageName: 'اردو (Urdu)',
    oralFluencyLab: 'روانی قرات لیب (ORF) 🎙️',
    knowledgeTree: 'مطابقت پذیر مہارتوں کا درخت 🌳',
    languagePassport: 'بین الاقوامی عربی زبان پاسپورٹ (CEFR) 🛂',
    gradebook: 'نتائج اور درجات کا ریکارڈ 📊',
    liveClass: 'براہ راست کلاس روم 🎥',
    orfTitle: 'عربی روانی قرات کی معیاری جانچ (ORF)',
    orfSubtitle: 'فی منٹ درست الفاظ (WCPM) اور تلفظ کی بین الاقوامی جانچ',
    recordVoice: 'آواز میں پڑھنا شروع کریں 🎙️',
    stopRecording: 'روکیں اور نتیجہ حاصل کریں ⏹️',
    evaluatingReading: 'تلفظ اور روانی کی جانچ جاری ہے...',
    wordsCorrectPerMinute: 'درست الفاظ فی منٹ (WCPM)',
    accuracyRate: 'تلفظ کی درستگی کا تناسب',
    readingSpeedBenchmark: 'کلاس کا مطلوبہ معیار',
    oralReadingCertificate: 'روانی قرات کی سرکاری سند',
    printCertificate: 'سرکاری سند پرنٹ کریں 🖨️',
    treeTitle: 'مہارتوں کا درخت اور وقفہ جاتی دہرائی',
    treeSubtitle: 'بنیادی حروف سے لے کر اعلیٰ بلاغت تک کا تعلیمی راستہ',
    goldenMastery: 'مکمل مہارت (سنہرا تاج) 🏆',
    needsPolish: 'تجدید اور مشق کی ضرورت ہے 🔄',
    practiceNode: 'فوری مشق کا سیشن ⚡',
    crownsEarned: 'حاصل کردہ سنہرے تاج',
    passportTitle: 'بین الاقوامی عربی لینگویج پاسپورٹ (CEFR)',
    passportSubtitle: 'غیر ملکی طلباء کے لیے عربی زبان کی مہارتوں اور گھنٹوں کی تصدیق',
    passportNumber: 'پاسپورٹ نمبر',
    verifiedHours: 'تصدیق شدہ تدریسی گھنٹے',
    targetArabic: 'ہدف زبان: فصیح عربی زبان (فصحى)',
    nativeLanguage: 'طالب علم کی مادری زبان',
    printPassport: 'لینگویج پاسپورٹ پرنٹ کریں 🖨️',
    cefrFrameworkInfo: 'مشترکہ یورپی فریم ورک (CEFR A1-B2) کے مطابق تیار کردہ',
    belowBasic: 'بنیادی معیار سے کم 🚨',
    basic: 'بنیادی ⚠️',
    proficient: 'ماہر ✅',
    advanced: 'بہترین 🌟',
    close: 'بند کریں',
  },
};

export const CEFR_LEVEL_DESCRIPTORS: Record<CEFRLevel, {
  nameAr: string;
  nameEn: string;
  badgeColor: string;
  listeningDesc: string;
  readingDesc: string;
  spokenDesc: string;
  writingDesc: string;
}> = {
  'A1.1': {
    nameAr: 'المستوى التمهيدي الاستكشافي (A1.1 - Breakthrough Starter)',
    nameEn: 'A1.1 Breakthrough Starter',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    listeningDesc: 'التعرف على أصوات الحروف العربية والكلمات المألوفة المنطوقة ببطء ووضوح.',
    readingDesc: 'قراءة الحروف المشكولة والكلمات القصيرة البسيطة في اللوحات والإشارات.',
    spokenDesc: 'إلقاء التحية، وتقديم النفس بجملة بسيطة، والإجابة عن الأسئلة المباشرة جداً.',
    writingDesc: 'كتابة الحروف الهجائية، والأرقام، والاسم الشخصي بخط واضح.',
  },
  'A1.2': {
    nameAr: 'المستوى التأسيسي المستقل (A1.2 - Breakthrough Complete)',
    nameEn: 'A1.2 Breakthrough Complete',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    listeningDesc: 'فهم العبارات اليومية المكررة في الفصل والأسرة والمحيط القريب.',
    readingDesc: 'قراءة جمل قصيرة مشكولة والقصص المصورة التأسيسية (2-3 أسطر).',
    spokenDesc: 'طرح أسئلة بسيطة حول الملكية والمكان والتعبير عن الاحتياجات الأساسية.',
    writingDesc: 'كتابة جملة اسمية أو فعلية بسيطة والتعبير عن صورة بكلمات مضبوطة.',
  },
  'A2.1': {
    nameAr: 'المستوى الأولي المستقل (A2.1 - Waystage Core)',
    nameEn: 'A2.1 Waystage Core',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    listeningDesc: 'فهم الجمل المرتبطة بالتسوق، والبيئة المدرسية، والأوامر الصفية المتتابعة.',
    readingDesc: 'فهم النصوص البسيطة والإعلانات والجداول والقوائم وتحديد المعلومات الصريحة.',
    spokenDesc: 'وصف اليوم الدراسي والروتين اليومي في جمل متتابعة مع النطق السليم.',
    writingDesc: 'كتابة فقرة وصفية قصيرة (30-40 كلمة) حول الهوايات أو الأنشطة المدرسية.',
  },
  'A2.2': {
    nameAr: 'المستوى التواصلي الأولي (A2.2 - Waystage Plus)',
    nameEn: 'A2.2 Waystage Plus',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    listeningDesc: 'متابعة حوارات قصيرة بين المتحدثين الأصليين حول مواضيع مألوفة وشيقة.',
    readingDesc: 'قراءة قصص أطفال متوسطة الطول واستخراج الفكرة الرئيسة وأسماء الشخصيات.',
    spokenDesc: 'المشاركة في حوار قصير وتبادل الآراء البسيطة والاتفاق أو الاختلاف اللطيف.',
    writingDesc: 'كتابة رسالة شكر أو رسالة إلكترونية قصيرة لزميل أو معلم.',
  },
  'B1.1': {
    nameAr: 'المستوى المتوسط العتبة (B1.1 - Threshold)',
    nameEn: 'B1.1 Threshold',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    listeningDesc: 'فهم النقاط الأساسية في النصوص الإذاعية والتعليمية الفصيحة ذات السرعة الطبيعية.',
    readingDesc: 'استيعاب نصوص سردية ومعلوماتية واستنتاج المعاني غير المصرح بها مباشرة.',
    spokenDesc: 'سرد قصة أو تلخيص كتاب أو التعبير عن الطموحات والآراء بجمل مركبة سليمة.',
    writingDesc: 'كتابة مقال قصير مترابط (70-100 كلمة) يصف تجربة أو يقدم رأياً مدللاً.',
  },
  'B1.2': {
    nameAr: 'المستوى المتوسط المتقدم (B1.2 - Threshold Plus)',
    nameEn: 'B1.2 Threshold Plus',
    badgeColor: 'bg-violet-100 text-violet-800 border-violet-300',
    listeningDesc: 'استيعاب معظم المحاضرات والقصص المعقدة مع تمييز الفروق الدلالية الدقيقة.',
    readingDesc: 'قراءة كتب ومقالات أصيلة في التراث والتاريخ والعلوم باللغة العربية الفصحى.',
    spokenDesc: 'إجراء مناظرة صفية وتقديم عرض شفوي متكامل باستخدام علامات الوقف والنبر.',
    writingDesc: 'كتابة قصة قصيرة متكاملة الحبكة أو تقرير بحثي منظم مستخدماً أدوات الربط البليغة.',
  },
  'B2': {
    nameAr: 'مستوى الطلاقة والاستقلالية التامة (B2 - Vantage Mastery)',
    nameEn: 'B2 Vantage Mastery',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    listeningDesc: 'الفهم الكامل لكافة أشكال الخطاب الفصيح، والخطب، والأفلام الوثائقية العربية.',
    readingDesc: 'قراءة الأدب العربي الكلاسيكي والحديث والمقالات الفكرية بطلاقة تامة.',
    spokenDesc: 'التحدث بطلاقة وتلقائية دون بحث عن الكلمات، مع توظيف الأمثال والاستعارات.',
    writingDesc: 'كتابة نصوص أكاديمية وإبداعية متقنة وفق قواعد النحو والصرف والبلاغة العربية.',
  },
};
