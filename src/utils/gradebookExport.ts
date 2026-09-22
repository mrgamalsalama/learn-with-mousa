import * as XLSX from 'xlsx';
import { UserProfile, StudentSubmission, GradeLevel, STAGES_CONFIG } from '../types';

export interface StudentGradebookEntry {
  student: UserProfile;
  academicId: string;
  name: string;
  gradeLabel: string;
  gradeId: string;
  trackLabel: string;
  trackId: string;
  challengesScore: number;
  readingScore: number;
  spellingPhonicsScore: number;
  grammarTasksScore: number;
  totalEarnedScore: number;
  totalPossibleScore: number;
  percentage: number;
  lastActivityDate: string;
  submissionsCount: number;
}

// دالة مساعدة لتحويل معرف الصف إلى المسمى العربي الرسمي
export const getGradeLabel = (gId: GradeLevel | string | undefined): string => {
  if (!gId) return 'غير محدد';
  for (const st of Object.values(STAGES_CONFIG)) {
    const found = st.grades.find((g) => g.id === gId);
    if (found) return found.labelAr;
  }
  if (gId === 'kg') return 'مرحلة رياض الأطفال';
  if (gId === 'grade-1') return 'الصف الأول الابتدائي';
  if (gId === 'grade-2') return 'الصف الثاني الابتدائي';
  if (gId === 'grade-3') return 'الصف الثالث الابتدائي';
  if (gId === 'grade-4') return 'الصف الرابع الابتدائي';
  if (gId === 'grade-5') return 'الصف الخامس الابتدائي';
  if (gId === 'grade-6') return 'الصف السادس الابتدائي';
  return gId;
};

// دالة مساعدة لمطابقة نص الصف المدخل في الإكسيل مع المعرّف النظامي
export const mapTextToGradeId = (text: string | undefined): GradeLevel => {
  if (!text) return 'grade-1';
  const t = text.trim().toLowerCase();
  if (t.includes('رياض') || t.includes('روضة') || t === 'kg') return 'kg';
  if (t.includes('أول') || t.includes('اول') || t === '1' || t === 'grade-1') return 'grade-1';
  if (t.includes('ثاني') || t === '2' || t === 'grade-2') return 'grade-2';
  if (t.includes('ثالث') || t === '3' || t === 'grade-3') return 'grade-3';
  if (t.includes('رابع') || t === '4' || t === 'grade-4') return 'grade-4';
  if (t.includes('خامس') || t === '5' || t === 'grade-5') return 'grade-5';
  if (t.includes('سادس') || t === '6' || t === 'grade-6') return 'grade-6';
  if (t.includes('سابع') || t === '7' || t === 'grade-7') return 'grade-7';
  if (t.includes('ثامن') || t === '8' || t === 'grade-8') return 'grade-8';
  if (t.includes('تاسع') || t === '9' || t === 'grade-9') return 'grade-9';
  if (t.includes('عاشر') || t === '10' || t === 'grade-10') return 'grade-10';
  if (t.includes('حادي') || t === '11' || t === 'grade-11') return 'grade-11';
  if (t.includes('ثاني عشر') || t === '12' || t === 'grade-12') return 'grade-12';
  return 'grade-1';
};

// دالة مساعدة لمطابقة نص المسار المدخل مع المسار النظامي
export const mapTextToTrack = (text: string | undefined): 'arabic-a' | 'arabic-b' => {
  if (!text) return 'arabic-a';
  const t = text.trim().toLowerCase();
  if (t.includes('غير') || t.includes('b') || t.includes('ب') || t.includes('ناطقين بغيرها')) {
    return 'arabic-b';
  }
  return 'arabic-a';
};

// حساب درجات ومحاور الطالب التراكمية
export const computeStudentGradebookEntry = (
  student: UserProfile,
  submissions: StudentSubmission[]
): StudentGradebookEntry => {
  const studentSubs = submissions.filter(
    (s) => s.studentId === student.id || s.studentName === student.name
  );

  let challengesScore = 0;
  let readingScore = 0;
  let spellingPhonicsScore = 0;
  let grammarTasksScore = 0;
  let totalEarnedScore = 0;
  let totalPossibleScore = 0;
  let lastDate = 'لم يسجل نشاطاً بعد';

  // فرز التسليمات بحسب التوقيت لأخذ آخر تاريخ
  const sortedSubs = [...studentSubs].sort((a, b) => {
    return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
  });

  if (sortedSubs.length > 0 && sortedSubs[0].submittedAt) {
    lastDate = sortedSubs[0].submittedAt;
  }

  for (const s of studentSubs) {
    totalEarnedScore += s.score || 0;
    totalPossibleScore += s.totalPoints || 0;

    const titleAndSkill = (
      (s.activityTitle || '') + ' ' + (s.targetSkill || '') + ' ' + (s.gameType || '')
    ).toLowerCase();

    // 1. تحديات موسى الحية
    if (s.gameType === 'challenge' || titleAndSkill.includes('تحدي') || titleAndSkill.includes('تحديات')) {
      challengesScore += s.score || 0;
    }
    // 2. الفهم القرائي والمكتبة
    else if (
      s.gameType === 'story_quest' ||
      titleAndSkill.includes('قراءة') ||
      titleAndSkill.includes('فهم') ||
      titleAndSkill.includes('قصة') ||
      titleAndSkill.includes('نص') ||
      titleAndSkill.includes('استيعاب') ||
      titleAndSkill.includes('مكتبة')
    ) {
      readingScore += s.score || 0;
    }
    // 3. الإملاء والوعي الصوتي
    else if (
      s.gameType === 'phonics_treasure' ||
      s.gameType === 'category_sorter' ||
      titleAndSkill.includes('إملاء') ||
      titleAndSkill.includes('املاء') ||
      titleAndSkill.includes('صوت') ||
      titleAndSkill.includes('حرك') ||
      titleAndSkill.includes('مد') ||
      titleAndSkill.includes('تنوين') ||
      titleAndSkill.includes('همز') ||
      titleAndSkill.includes('شمس') ||
      titleAndSkill.includes('قمر')
    ) {
      spellingPhonicsScore += s.score || 0;
    }
    // 4. النحو والأنشطة التطبيقية
    else {
      grammarTasksScore += s.score || 0;
    }
  }

  const percentage = totalPossibleScore > 0 
    ? Math.round((totalEarnedScore / totalPossibleScore) * 100) 
    : (studentSubs.length > 0 ? 80 : 0);

  // استخراج كود/رقم أكاديمي أنيق
  const academicId = student.id.startsWith('usr_') 
    ? student.id.replace('usr_student_', 'STU-').replace('usr_', 'STU-').toUpperCase()
    : student.id;

  return {
    student,
    academicId,
    name: student.name,
    gradeLabel: getGradeLabel(student.grade),
    gradeId: student.grade || 'grade-1',
    trackLabel: student.track === 'arabic-b' ? 'عرب B (الناطقين بغيرها)' : 'عرب A (الناطقين بها)',
    trackId: student.track || 'arabic-a',
    challengesScore,
    readingScore,
    spellingPhonicsScore,
    grammarTasksScore,
    totalEarnedScore,
    totalPossibleScore,
    percentage,
    lastActivityDate: lastDate,
    submissionsCount: studentSubs.length,
  };
};

/**
 * تجهيز مصفوفة الصفوف المجدولة للأعمدة العشرة المعتمدة
 */
export const buildGradebookExportRows = (
  students: UserProfile[],
  submissions: StudentSubmission[],
  selectedGradeFilter?: string
) => {
  let targetStudents = students.filter((u) => u.role === 'student');

  if (selectedGradeFilter && selectedGradeFilter !== 'all') {
    targetStudents = targetStudents.filter((s) => s.grade === selectedGradeFilter);
  }

  return targetStudents.map((st) => {
    const entry = computeStudentGradebookEntry(st, submissions);
    return {
      'الرقم الأكاديمي (Student ID)': entry.academicId,
      'اسم الطالب (Student Name)': entry.name,
      'الصف الدراسي (Grade)': entry.gradeLabel,
      'المسار التعليمي (Track)': entry.trackLabel,
      'تحديات موسى الحية (Mousa Challenges)': entry.challengesScore,
      'الفهم القرائي والمكتبة (Reading)': entry.readingScore,
      'الإملاء والوعي الصوتي (Phonics & Spelling)': entry.spellingPhonicsScore,
      'النحو والأنشطة التطبيقية (Grammar)': entry.grammarTasksScore,
      'المجموع الكلي ومعدل التحصيل (Total XP / %)': `${entry.totalEarnedScore} نقطة (${entry.percentage}%)`,
      'تاريخ آخر نشاط مكتمل (Last Activity)': entry.lastActivityDate,
    };
  });
};

/**
 * 1. تصدير كشف الدرجات بصيغة Microsoft Excel (.xlsx) مع دعم التنسيق واتجاه RTL
 */
export const exportGradebookToExcel = (
  students: UserProfile[],
  submissions: StudentSubmission[],
  gradeFilterName?: string
) => {
  const rows = buildGradebookExportRows(students, submissions, gradeFilterName);
  const filterText = gradeFilterName && gradeFilterName !== 'all' ? getGradeLabel(gradeFilterName) : 'جميع الصفوف';
  const currentDate = new Date().toISOString().split('T')[0];

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // ضبط عرض الأعمدة بدقة
  worksheet['!cols'] = [
    { wch: 18 }, // الرقم الأكاديمي
    { wch: 26 }, // اسم الطالب
    { wch: 20 }, // الصف الدراسي
    { wch: 22 }, // المسار
    { wch: 16 }, // تحديات موسى
    { wch: 18 }, // الفهم القرائي
    { wch: 20 }, // الإملاء والوعي الصوتي
    { wch: 20 }, // النحو والأنشطة
    { wch: 22 }, // المجموع الكلي
    { wch: 22 }, // تاريخ آخر نشاط
  ];

  // تفعيل اتجاه اليمين إلى اليسار (Right-to-Left) للغة العربية
  worksheet['!views'] = [{ rightToLeft: true }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل الدرجات المعتمد');

  const fileName = `سجل_درجات_الطلاب_${filterText.replace(/\s+/g, '_')}_${currentDate}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

/**
 * 2. تصدير كشف الدرجات بصيغة CSV مع دعم UTF-8 BOM للظهور السليم في Excel
 */
export const exportGradebookToCSV = (
  students: UserProfile[],
  submissions: StudentSubmission[],
  gradeFilterName?: string
) => {
  const rows = buildGradebookExportRows(students, submissions, gradeFilterName);
  const filterText = gradeFilterName && gradeFilterName !== 'all' ? getGradeLabel(gradeFilterName) : 'جميع الصفوف';
  const currentDate = new Date().toISOString().split('T')[0];

  if (rows.length === 0) {
    alert('لا يوجد طلاب مطابقون للتصدير في هذا الصف.');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const val = (row as any)[header] ?? '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ];

  // إضافة UTF-8 BOM (\uFEFF) في البداية لضمان قراءة اللغة العربية بوضوح تام في Excel
  const bom = '\uFEFF';
  const csvBlob = new Blob([bom + csvLines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(csvBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `سجل_درجات_الطلاب_${filterText.replace(/\s+/g, '_')}_${currentDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 3. تحميل قالب الإكسيل الفارغ المعتمد للاستيراد الجماعي للطلاب
 */
export const downloadStudentImportTemplate = (type: 'xlsx' | 'csv' = 'xlsx') => {
  const templateRows = [
    {
      'اسم الطالب': 'سلطان بن فهد الهاشمي',
      'الرقم الأكاديمي': 'STU-1001',
      'الصف الدراسي': 'الصف الأول الابتدائي',
      'المسار التعليمي': 'عرب A',
      'البريد الإلكتروني': 'sultan@school.edu',
    },
    {
      'اسم الطالب': 'سارة بنت محمد الكندي',
      'الرقم الأكاديمي': 'STU-1002',
      'الصف الدراسي': 'الصف الأول الابتدائي',
      'المسار التعليمي': 'عرب A',
      'البريد الإلكتروني': 'sara@school.edu',
    },
    {
      'اسم الطالب': 'ديفيد سميث',
      'الرقم الأكاديمي': 'STU-1003',
      'الصف الدراسي': 'الصف الأول الابتدائي',
      'المسار التعليمي': 'عرب B',
      'البريد الإلكتروني': 'david@school.edu',
    },
  ];

  if (type === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(templateRows);
    ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 25 }];
    ws['!views'] = [{ rightToLeft: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب استيراد الطلاب');
    XLSX.writeFile(wb, 'قالب_استيراد_الطلاب_المعتمد.xlsx');
  } else {
    const headers = Object.keys(templateRows[0]);
    const csvContent = [
      headers.map((h) => `"${h}"`).join(','),
      ...templateRows.map((r) =>
        headers.map((h) => `"${(r as any)[h] || ''}"`).join(',')
      ),
    ].join('\r\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'قالب_استيراد_الطلاب_المعتمد.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

/**
 * 4. قراءة ومعالجة ملف الطلاب المرفوع (.xlsx أو .csv) بمرونة وذكاء
 */
export interface ParsedStudentRow {
  index: number;
  name: string;
  academicId: string;
  grade: GradeLevel;
  gradeLabel: string;
  track: 'arabic-a' | 'arabic-b';
  trackLabel: string;
  email?: string;
  isValid: boolean;
  validationError?: string;
}

export const parseStudentsFile = async (file: File): Promise<{
  rows: ParsedStudentRow[];
  totalCount: number;
  validCount: number;
  error?: string;
}> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return { rows: [], totalCount: 0, validCount: 0, error: 'الملف المرفوع فارغ ولا يحتوي على أي أوراق عمل.' };
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      return { rows: [], totalCount: 0, validCount: 0, error: 'لم يتم العثور على أي صفوف بيانات داخل الملف.' };
    }

    const seenIds = new Set<string>();
    const parsedRows: ParsedStudentRow[] = [];

    rawData.forEach((row, idx) => {
      // استخراج الحقول بدعم مختلف التسميات الشائعة في الإكسيل
      const rawName = (
        row['اسم الطالب'] ||
        row['اسم الطالب الثلاثي / الرباعي'] ||
        row['الاسم'] ||
        row['Student Name'] ||
        row['name'] ||
        row['Name'] ||
        ''
      ).toString().trim();

      const rawCode = (
        row['الرقم الأكاديمي'] ||
        row['الرقم الأكاديمي (Student ID)'] ||
        row['كود الطالب'] ||
        row['رقم الطالب'] ||
        row['Student ID'] ||
        row['Code'] ||
        row['code'] ||
        row['id'] ||
        ''
      ).toString().trim();

      const rawGrade = (
        row['الصف الدراسي'] ||
        row['الصف'] ||
        row['Grade'] ||
        row['grade'] ||
        ''
      ).toString().trim();

      const rawTrack = (
        row['المسار التعليمي'] ||
        row['المسار'] ||
        row['Track'] ||
        row['track'] ||
        ''
      ).toString().trim();

      const rawEmail = (
        row['البريد الإلكتروني'] ||
        row['البريد'] ||
        row['Email'] ||
        row['email'] ||
        ''
      ).toString().trim();

      // تخطي الصفوف الفارغة بالكامل
      if (!rawName && !rawCode && !rawGrade) {
        return;
      }

      let isValid = true;
      let validationError: string | undefined;

      if (!rawName || rawName.length < 3) {
        isValid = false;
        validationError = 'اسم الطالب غير مكتمل أو مفقود';
      }

      const academicId = rawCode || `STU-${1000 + idx + 1}`;

      if (seenIds.has(academicId.toLowerCase())) {
        isValid = false;
        validationError = `الرقم الأكاديمي (${academicId}) مكرر في الملف`;
      } else {
        seenIds.add(academicId.toLowerCase());
      }

      const gradeId = mapTextToGradeId(rawGrade);
      const trackId = mapTextToTrack(rawTrack);

      parsedRows.push({
        index: idx + 1,
        name: rawName || 'طالب جديد',
        academicId,
        grade: gradeId,
        gradeLabel: getGradeLabel(gradeId),
        track: trackId,
        trackLabel: trackId === 'arabic-b' ? 'عرب B' : 'عرب A',
        email: rawEmail || undefined,
        isValid,
        validationError,
      });
    });

    const validCount = parsedRows.filter((r) => r.isValid).length;

    return {
      rows: parsedRows,
      totalCount: parsedRows.length,
      validCount,
    };
  } catch (err: any) {
    console.error('Excel Parse Error:', err);
    return {
      rows: [],
      totalCount: 0,
      validCount: 0,
      error: `حدث خطأ أثناء قراءة الملف: ${err.message || 'صيغة الملف غير مدعومة'}`,
    };
  }
};
