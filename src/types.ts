// أدوار المستخدمين في المنظومة
export type UserRole = 'super_admin' | 'hod' | 'teacher' | 'student' | 'parent';

// مسارات اللغة العربية
export type ArabicTrack = 'arabic-a' | 'arabic-b'; // A: ناطقين، B: غير ناطقين

// المراحل التعليمية
export type SchoolStage = 'kg' | 'primary' | 'middle' | 'high';

// قائمة الصفوف الدراسية كاملة
export type GradeLevel =
  | 'kg'
  | 'grade-1' | 'grade-2' | 'grade-3' | 'grade-4' | 'grade-5'
  | 'grade-6' | 'grade-7' | 'grade-8'
  | 'grade-9' | 'grade-10' | 'grade-11' | 'grade-12';

// حالات الاستثناء والتحكم الفردي في الذكاء الاصطناعي لكل مستخدم
export type AIAccessStatus = 'inherit' | 'allowed' | 'blocked';

// نظام تفويض صلاحيات الإدارة العليا (Admin Delegation System)
export interface DelegatedAdminPermissions {
  can_manage_teacher_grades: boolean; // تعديل صفوف ومسارات المعلمين
  can_manage_teacher_tasks: boolean;  // إضافة وحذف مهام المعلمين
  can_control_ai_governance: boolean; // التحكم في أزرار وقواعد الذكاء الاصطناعي
  can_create_hod: boolean;            // تعيين وترقية رؤساء أقسام
}

export const DEFAULT_DELEGATED_PERMISSIONS: DelegatedAdminPermissions = {
  can_manage_teacher_grades: false,
  can_manage_teacher_tasks: false,
  can_control_ai_governance: false,
  can_create_hod: false,
};

// مهام وتكليفات المعلمين الرسمية (Teacher Tasks & Assignments)
export interface TeacherTask {
  id: string;
  teacherId: string;
  teacherName?: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  completedAt?: string;
  assignedBy: string;      // اسم المشرف أو رئيس القسم الذي أسند المهمة
  assignedByRole: 'super_admin' | 'hod';
  createdAt: string;
}

// تفضيلات تجربة التعلم والخصوصية
export interface UserPreferences {
  soundEffects?: boolean;
  voiceSpeed?: number; // 0.8, 1.0, 1.2
  anonymousInLeaderboard?: boolean;
  bio?: string;
}

// بيانات المستخدم وتتبع نشاطه
export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email?: string;
  role: UserRole;
  password?: string;
  avatar?: string;
  timezone?: string;
  preferences?: UserPreferences;
  
  // التحكم الفردي الدقيق في صلاحيات الذكاء الاصطناعي للمستخدم
  ai_access_status?: AIAccessStatus;

  // الصلاحيات المفوضة من الإدارة العليا (Admin Delegation)
  delegated_admin_permissions?: DelegatedAdminPermissions;

  // تتبع النشاط والزيارات
  loginCount?: number;
  lastLogin?: string;

  // صلاحيات رئيس القسم والمعلم
  allowedStages?: SchoolStage[];
  allowedGrades?: GradeLevel[];
  allowedTracks?: ArabicTrack[];

  // بيانات الطالب
  stage?: SchoolStage;
  grade?: GradeLevel;
  track?: ArabicTrack;
  teacherId?: string;

  // بيانات ولي الأمر
  studentId?: string;
}

// أنواع الأسئلة
export type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  correctAnswer: string;
  points: number;
}

// ===================== نظام الاختبارات والتقييمات التفاعلية (Interactive Exams System) =====================

export type ExamQuestionType = 'multiple_choice' | 'true_false' | 'spelling_dictation';

export interface ExamQuestion {
  id: string;
  text: string;                   // نص السؤال مشكول
  type: ExamQuestionType;
  options?: string[];             // خيارات الإجابة
  correctAnswer: string;          // الإجابة الصحيحة النموذجية
  points: number;                 // درجة السؤال
  explanation?: string;           // توجيه أو شرح تعليمي
  audioPromptText?: string;       // نص إملائي للاستماع
}

export interface Exam {
  id: string;
  title: string;
  teacher_id: string;
  teacher_name?: string;
  target_grade: GradeLevel;
  target_track?: ArabicTrack;
  duration_minutes: number;       // مدة الاختبار بالدقائق (0 = مفتوح)
  show_results_immediately: boolean; // إظهار النتيجة فوراً للطالب
  is_active: boolean;             // حالة الاختبار: متاح / مغلق
  questions: ExamQuestion[];      // قائمة الأسئلة
  created_at: string;
  description?: string;

  // حقول جدولة الاختبار والنوافذ الزمنية (Scheduled Exam Windows)
  is_scheduled?: boolean;         // افتراضي false، إذا كان true يتقيد بالنوافذ الزمنية
  scheduled_start?: string | null;// تاريخ وساعة بدء إتاحة الاختبار (ISO / TIMESTAMP)
  scheduled_end?: string | null;  // تاريخ وساعة إغلاق الاختبار (ISO / TIMESTAMP)
}

export type ExamSessionStatus = 'not_started' | 'in_progress' | 'submitted' | 'force_stopped';

export interface ExamSession {
  id: string;
  exam_id: string;
  student_id: string;
  student_name: string;
  status: ExamSessionStatus;
  start_time: string;
  end_time?: string | null;
  score: number;
  total_marks: number;
  answers: Record<string, string>;
  tab_switch_count: number;       // عداد مغادرة صفحة الاختبار
  created_at?: string;
}

// عنصر بنك القصص والأسئلة التأسيسي
export interface StoryBankItem {
  id: string;
  title: string;
  moralTopic: string;
  stage: SchoolStage;
  grade: GradeLevel;
  track: ArabicTrack;
  passage: string;
  questions: Question[];
}

// عنصر المكتبة الرقمية وقارئ القصص التفاعلي
export interface BookItem {
  id: string;
  title: string;
  author?: string;
  coverUrl: string;
  readUrl: string;
  category?: string;
  targetAge?: string;
  section?: string; // قسم أو اسم المكتبة (مثل: "مكتبة بوك تايم", "مكتبة هنداوي", إلخ)
  pages?: string[]; // روابط صور الصفحات المصورة للقارئ التفاعلي المدمج
  assignedGrades: GradeLevel[];
  assignedTracks: ArabicTrack[];
  assignedByTeacherId?: string;
}

// أنواع الأنشطة والمهام
export type ActivityType = 'worksheet' | 'story' | 'game';

// حزمة الألعاب التعليمية التفاعلية المولدة بالذكاء الاصطناعي
export type AIGameType = 
  | 'phonics_treasure' 
  | 'sentence_builder' 
  | 'story_quest'
  | 'vowel_train'        // قطار الحركات والمدود
  | 'letter_blending'    // معمل دمج الحروف وتكوين الكلمات
  | 'vocab_detective'    // محقق المفردات (الترادف والتضاد)
  | 'category_sorter';   // فرز الظواهر اللغوية (شمسية/قمرية، تاء/هاء)

export interface GameLevel {
  id: number;
  prompt: string;
  correctAnswers: string[];
  options: string[];
  feedbackSuccess: string;
  feedbackHint: string;
  // حقول إضافية ذكية للألعاب التفاعلية المتقدمة
  segments?: string[];                  // مقاطع صوتية أو حروف للدمج في letter_blending
  categories?: string[];                // أسماء فئات الفرز في category_sorter (مثل: ["اللام الشمسية ☀️", "اللام القمرية 🌙"])
  categoryMap?: Record<string, string>; // تصنيف الكلمات الصحيح { "الشَّمْسُ": "اللام الشمسية ☀️" }
  vowelType?: string;                   // نوع الحركة أو المد في vowel_train
  wordPuzzle?: string;                  // الكلمة المستهدفة في vocab_detective
}

export interface GameData {
  gameType: AIGameType;
  targetSkill: string;
  instructions: string;
  levels: GameLevel[];
}

// النشاط التفاعلي
export interface Activity {
  id: string;
  title: string;
  activityType?: ActivityType;
  gameData?: GameData;
  description?: string;
  passage?: string;
  teacherId: string;
  teacherName: string;
  stage: SchoolStage;
  grade: GradeLevel;
  track: ArabicTrack;
  questions: Question[];
  createdAt: string;
}

// رصد درجات وتسليمات الطلاب مع بيانات التشخيص والتعلم التكيفي
export interface StudentSubmission {
  id: string;
  activityId: string;
  activityTitle: string;
  studentId: string;
  studentName: string;
  grade?: GradeLevel;
  track?: ArabicTrack;
  score: number;
  totalPoints: number;
  submittedAt: string;
  answers: Record<string, string>;
  // حقول إضافية ذكية للتحليل التشخيصي والألعاب التفاعلية
  gameType?: AIGameType | string;
  targetSkill?: string;
  accuracyRate?: number;
  repeatedErrors?: string[];
}

// ثوابت المراحل والصفوف
export const STAGES_CONFIG: Record<SchoolStage, { nameAr: string; grades: { id: GradeLevel; labelAr: string }[] }> = {
  kg: {
    nameAr: 'مرحلة رياض الأطفال',
    grades: [{ id: 'kg', labelAr: 'روضة الأطفال' }],
  },
  primary: {
    nameAr: 'المرحلة الابتدائية',
    grades: [
      { id: 'grade-1', labelAr: 'الصف الأول' },
      { id: 'grade-2', labelAr: 'الصف الثاني' },
      { id: 'grade-3', labelAr: 'الصف الثالث' },
      { id: 'grade-4', labelAr: 'الصف الرابع' },
      { id: 'grade-5', labelAr: 'الصف الخامس' },
    ],
  },
  middle: {
    nameAr: 'المرحلة المتوسطة',
    grades: [
      { id: 'grade-6', labelAr: 'الصف السادس' },
      { id: 'grade-7', labelAr: 'الصف السابع' },
      { id: 'grade-8', labelAr: 'الصف الثامن' },
    ],
  },
  high: {
    nameAr: 'المرحلة العليا',
    grades: [
      { id: 'grade-9', labelAr: 'الصف التاسع' },
      { id: 'grade-10', labelAr: 'الصف العاشر' },
      { id: 'grade-11', labelAr: 'الصف الحادي عشر' },
      { id: 'grade-12', labelAr: 'الصف الثاني عشر' },
    ],
  },
};

// ===================== نماذج الذكاء الاصطناعي (Gemini AI Engine) =====================

export interface MusaChatMessage {
  id: string;
  sender: 'musa' | 'child';
  text: string;
  timestamp: string;
  hasAudio?: boolean;
}

export interface AdaptiveStoryNode {
  step: number;
  sceneTitle: string;
  passage: string; // نص مشكول بالكامل
  targetLetter: string;
  question: string;
  optionA: string;
  optionB: string;
  badgeEarned?: string;
  isEnding: boolean;
}

export interface PhonicsVerificationResult {
  isValid: boolean;
  startsCorrectly: boolean;
  formedWord: string;
  meaningSimple: string;
  encouragement: string;
  badgeName?: string;
  scoreAwarded: number;
}

export interface DrawingAnalysisResult {
  recognizedObject: string;
  startsWithTargetLetter: boolean;
  targetLetter: string;
  confidenceScore: number;
  feedback: string;
  badgeEarned?: string;
  starsCount: number;
}

export interface DiagnosticReport {
  studentName: string;
  masteredLetters: string[];
  needsPracticeLetters: string[];
  engagementRate: number;
  overallAccuracy: number;
  teacherPedagogicalNotes: string;
  recommendedNextSteps: string[];
  strengths: string[];
  growthAreas: string[];
  generatedAt: string;
}

export interface ChildBadge {
  id: string;
  studentId?: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
  category: 'story' | 'phonics' | 'drawing' | 'quiz' | 'game';
}

export interface ChildPhonicsRecord {
  letter: string;
  word: string;
  isCorrect: boolean;
  type: 'voice' | 'drawing' | 'quiz';
  timestamp: string;
}

export interface ClassDiagnosticSummary {
  activityTitle?: string;
  totalSubmissions: number;
  overallMasteryRate: number;
  averageScore: number;
  totalPoints: number;
  strugglingConcepts: string[];
  difficultQuestions: {
    questionText: string;
    mistakeRate: number;
    note: string;
  }[];
  studentsNeedingRemediation: {
    studentName: string;
    score: number;
    totalPoints: number;
    percentage: number;
    remedialFocus: string;
  }[];
  actionableRecommendations: string[];
  generatedAt: string;
}

// نتيجة التقرير التشخيصي الفوري بنقرة واحدة (1-Click AI Diagnostic)
export interface QuickAIDiagnosticResult {
  studentName: string;
  reportText: string;               // نص التحليل التربوي الموجز الدافئ المشكول (2-3 أسطر)
  strengths: string;                // نقاط القوة والإتقان المكتسبة
  challenge: string;                // التحدي الصوتي أو الإملائي
  recommendation: {
    gameType: AIGameType | string;  // نوع اللعبة الموصى بها
    gameTitleAr: string;            // اسم اللعبة بالعربية
    suggestedDuration: string;      // مدة الجولة المقترحة (مثل: 3 دقائق)
    rationale: string;              // سبب التوصية التربوي
  };
  analyzedSubmissionsCount: number;
  generatedAt: string;
}

// حالة مؤشر التفاعل الصوتي البصري الموحد
export type AudioInteractionState = 'idle' | 'speaking' | 'listening';

// طابور التسليمات والمزامنة دون إنترنت (Offline Sync Queue)
export interface OfflineQueueItem {
  id: string;
  submission: StudentSubmission;
  queuedAt: string;
  retryCount: number;
}

// نظام حوكمة وسياسات الذكاء الاصطناعي (Strict Role-Based AI Governance)
export interface AIGovernanceRules {
  master_ai_killswitch: boolean; // زر الطوارئ الرئيسي لتعطيل الـ AI كلياً عن كامل المنصة
  student_ai_enabled: boolean;   // المحادثة الصوتية، توليد التحديات، التلميحات للطلاب
  teacher_ai_enabled: boolean;   // توليد الألعاب والقصص التكيفية، والتشخيص التلقائي للمعلمين
  parent_ai_enabled: boolean;    // توليد التقارير الذكية التوليدية لأولياء الأمور
  updated_at?: string;
  updated_by?: string;
}

export type AIGovernanceTarget = 'student' | 'teacher' | 'parent';

// ================= نظام الجدار التعاوني التفاعلي (Interactive Padlet-like Wall) =================

export type PadletTheme = 'corkboard' | 'chalkboard' | 'playful' | 'notebook' | 'sky';
export type PadletCardColor = 'yellow' | 'pink' | 'mint' | 'blue' | 'purple';
export type PadletContentType = 'text' | 'audio' | 'image' | 'drawing' | 'mixed';

export interface PadletComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  text: string;
  createdAt: string;
}

export interface PadletBoard {
  id: string;
  title: string;
  description?: string;
  teacher_id: string;
  teacher_name?: string;
  grade: GradeLevel | string;
  target_grade?: GradeLevel | string;
  color?: string;
  track?: ArabicTrack;
  theme: PadletTheme;
  allow_comments: boolean;
  require_approval: boolean;
  is_locked: boolean;
  created_at: string;
}

export interface PadletPost {
  id: string;
  board_id: string;
  author_id: string;
  author_name: string;
  author_role: UserRole;
  content: string;
  color?: PadletCardColor;
  audio_url?: string;
  image_url?: string;
  content_type?: PadletContentType;
  status: 'approved' | 'pending';
  likes_count: number;
  liked_by: string[];
  comments: PadletComment[];
  created_at: string;
  pinned?: boolean;
}

// ================= نظام تحدي موسى التنافسي الحي (Mousa Live Quiz Challenge) =================

export type ChallengeShape = 'triangle' | 'diamond' | 'circle' | 'square';
// 🔺 أحمر (مثلث)
// 🔷 أزرق (معين)
// 🟡 أصفر (دائرة)
// 🟩 أخضر (مربع)

export type ChallengeQuestionType =
  | 'classic'       // نمط Quiz الكلاسيكي القائم (أ، ب، ج، د)
  | 'true_false'    // صَحٌّ أَمْ خَطَأ (🔷 صواب / 🔺 خطأ)
  | 'puzzle'        // سِبَاقُ التَّرْتِيب (Sequence - ترتيب 4 بطاقات)
  | 'type_answer'   // سِحْرُ الإِمْلَاء وَالكِتَابَة (Type Answer - إدخال نصي ومطابقة مرنة)
  | 'word_cloud'    // سَحَابَةُ الكَلِمَاتِ التَّفَاعُلِيَّة (Word Cloud - عصف ذهني)
  | 'poll';         // اسْتِطْلَاعُ الرَّأْي (Poll - بدون صواب وخطأ)

export interface ChallengeOption {
  id: string; // '0', '1', '2', '3'
  text: string;
  shape: ChallengeShape;
}

export interface ChallengeQuestion {
  id: string;
  text: string; // نص السؤال مشكول
  type?: ChallengeQuestionType; // النمط التفاعلي (افتراضياً classic)
  options: ChallengeOption[];
  correctIndex: number; // 0, 1, 2, or 3 (للخيارات أو صح/خطأ)
  correctOrder?: number[]; // لسؤال الترتيب [0, 1, 2, 3] يمثل الترتيب الصحيح
  correctAnswerText?: string; // لسؤال الكتابة والإملاء
  acceptableAnswers?: string[]; // إجابات بديلة مقبولة للكتابة
  timeLimitSeconds: number; // 10, 20, 30 ثانية
  explanation?: string; // توضيح تربوي سريع بصوت موسى
}

export interface ChallengeQuiz {
  id: string;
  title: string;
  description?: string;
  teacher_id: string;
  teacher_name?: string;
  target_grade: GradeLevel;
  target_track?: ArabicTrack;
  questions: ChallengeQuestion[];
  is_ai_generated?: boolean;
  topic?: string;
  created_at: string;
}

export type ChallengeRoomStatus = 
  | 'lobby'           // شاشة انتظار الطلاب
  | 'question_active' // السؤال معروض والعداد شغال
  | 'in_progress'     // مسابقة جارية متوافقة مع قواعد البيانات
  | 'question_revealed' // كشف الإجابة الصحيحة وشرح موسى
  | 'leaderboard'     // عرض ترتيب النقاط بعد السؤال
  | 'finished';       // نهاية المسابقة والتتويج (منصة التتويج Podium)

export interface ChallengePlayerAnswer {
  questionId: string;
  selectedIndex: number;
  questionIndex?: number;
  isCorrect: boolean;
  timeTakenMs: number; // الزمن بالمللي ثانية لاحتساب سرعة النقر
  pointsEarned: number;
  answeredAt: number;
  // حقول إضافية للأنماط الجديدة
  textAnswer?: string; // لسؤال الكتابة وسحابة الكلمات
  orderAnswer?: number[]; // لسؤال الترتيب
  questionType?: ChallengeQuestionType;
}

export interface ChallengePlayer {
  id: string; // student user id or guest id
  name: string;
  avatar?: string;
  score: number;
  streak: number;
  lastAnswer?: ChallengePlayerAnswer;
  isOnline: boolean;
  joinedAt: number;
}

export interface ChallengeRoom {
  id: string; // room id
  pin: string; // 6-digit PIN code (e.g. '829410')
  quiz_id: string;
  quiz_title: string;
  host_id: string; // teacher id
  host_name: string;
  target_grade: GradeLevel;
  status: ChallengeRoomStatus;
  current_question_index: number;
  questions: ChallengeQuestion[];
  players: Record<string, ChallengePlayer>; // keyed by player id
  answers_received?: any[];
  question_start_time?: number; // timestamp when current question started
  settings?: any;
  created_at: string;
  updated_at?: string;
}

// ===================== فصل موسى المباشر (Live Classroom System) =====================
export interface LiveClassPermissions {
  allowChat: boolean;
  allowScreenShare: boolean;
}

export interface LiveClassSession {
  id: string;
  roomName: string;
  grade: GradeLevel | string;
  track?: ArabicTrack | string;
  teacherId: string;
  teacherName: string;
  title: string;
  isActive: boolean;
  startedAt: string;
  endedAt?: string;
  participantsCount?: number;
  serverDomain?: string;
  permissions?: LiveClassPermissions;
}

