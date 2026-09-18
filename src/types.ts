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

// بيانات المستخدم وتتبع نشاطه
export interface UserProfile {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  password?: string;
  
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

// رصد درجات الطلاب
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
