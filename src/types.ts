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

// عنصر المكتبة الرقمية الشاملة (كتب بوك تايم والمستودع القرائي)
export interface BookItem {
  id: string;
  title: string;
  author?: string;
  coverUrl: string;
  readUrl: string; // رابط قراءة الكتاب المباشر
  category?: string; // كتب مصورة، قصص قصيرة، مبتدئ
  targetAge?: string; // مثلاً: 4-6، 7-9
  assignedGrades: GradeLevel[]; // الصفوف التي اعتمدها المعلم لهذا الكتاب
  assignedTracks: ArabicTrack[]; // المسارات المسموح لها بالقراءة
  assignedByTeacherId?: string;
}

// النشاط التفاعلي
export interface Activity {
  id: string;
  title: string;
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
