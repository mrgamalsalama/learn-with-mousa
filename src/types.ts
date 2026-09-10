// أنواع المستخدمين
export type UserRole = 'super_admin' | 'teacher' | 'student';

// مسارات اللغة العربية
export type ArabicTrack = 'arabic-a' | 'arabic-b'; // A: ناطقين، B: غير ناطقين

// المراحل التعليمية
export type SchoolStage = 'kg' | 'primary' | 'middle' | 'high';

// قائمة الصفوف كاملة
export type GradeLevel =
  | 'kg'
  | 'grade-1' | 'grade-2' | 'grade-3' | 'grade-4' | 'grade-5'
  | 'grade-6' | 'grade-7' | 'grade-8'
  | 'grade-9' | 'grade-10' | 'grade-11' | 'grade-12';

// بيانات المستخدم الأساسية
export interface UserProfile {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  password?: string;
  // بيانات خاصة بالمعلم
  allowedStages?: SchoolStage[];
  allowedGrades?: GradeLevel[];
  allowedTracks?: ArabicTrack[];
  // بيانات خاصة بالطالب
  stage?: SchoolStage;
  grade?: GradeLevel;
  track?: ArabicTrack;
  teacherId?: string;
}

// ثوابت المسميات بالعربية
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
