import { supabase } from '../supabaseClient';
import { InteractiveWorksheet, WorksheetSubmission, WorksheetElement } from '../types';

const WORKSHEETS_KEY = 'mousa_interactive_worksheets_v1';
const SUBMISSIONS_KEY = 'mousa_worksheet_submissions_v1';

// دالة تنقية وتطبيع الإجابات العربية لمقارنة عادلة وذكية تتسامح مع اختلافات التشكيل والهمزات
export function normalizeArabicText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toString()
    .trim()
    // إزالة التشكيل والحركات تماماً
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // توحيد الهمزات (أ، إ، آ -> ا)
    .replace(/[أإآ]/g, 'ا')
    // توحيد التاء المربوطة والهاء (ة -> ه)
    .replace(/ة/g, 'ه')
    // توحيد الياء والألف المقصورة (ى -> ي)
    .replace(/ى/g, 'ي')
    // إزالة الكشيدة والتطويل (ـ)
    .replace(/ـ/g, '')
    // توحيد المسافات
    .replace(/\s+/g, ' ');
}

// قوالب أوراق عمل تفاعلية جاهزة ومزينة كخلفيات SVG عالية الدقة
export const SAMPLE_WORKSHEET_SVG_1 = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1100" width="800" height="1100" style="background:#ffffff; font-family:'Tajawal', 'Cairo', sans-serif;">
  <rect width="800" height="1100" fill="#f8fafc" />
  <rect x="25" y="25" width="750" height="1050" rx="20" fill="#ffffff" stroke="#cbd5e1" stroke-width="3" />
  <rect x="35" y="35" width="730" height="110" rx="15" fill="#f0fdf4" stroke="#86efac" stroke-width="2" />
  
  <text x="400" y="85" text-anchor="middle" font-size="28" font-weight="bold" fill="#166534">مَنَصَّةُ تَعَلَّمْ مَعَ مُوسَى التَّعْلِيمِيَّة</text>
  <text x="400" y="125" text-anchor="middle" font-size="20" font-weight="600" fill="#15803d">وَرَقَةُ عَمَلٍ تَفَاعُلِيَّة: الَّلامُ الشَّمْسِيَّةُ وَالَّلامُ القَمَرِيَّة ☀️🌙</text>
  
  <text x="730" y="185" text-anchor="end" font-size="16" fill="#475569">الاسم: .......................................</text>
  <text x="250" y="185" text-anchor="end" font-size="16" fill="#475569">الصف: ...................</text>
  <text x="100" y="185" text-anchor="end" font-size="16" fill="#15803d" font-weight="bold">الدرجة: ٢٠</text>
  
  <!-- السؤال الأول -->
  <rect x="45" y="215" width="710" height="360" rx="12" fill="#eff6ff" stroke="#bfdbfe" stroke-width="2" />
  <text x="735" y="255" text-anchor="end" font-size="18" font-weight="bold" fill="#1e40af">السُّؤَالُ الأَوَّل: اكْتُبْ نَوْعَ اللاَّمِ فِي الفَرَاغِ (شَمْسِيَّة أو قَمَرِيَّة):</text>
  
  <g transform="translate(60, 280)">
    <rect x="370" y="0" width="300" height="60" rx="8" fill="#ffffff" stroke="#cbd5e1" />
    <text x="650" y="38" text-anchor="end" font-size="20" font-weight="bold" fill="#0f172a">١. الشَّمْسُ</text>
    
    <rect x="370" y="80" width="300" height="60" rx="8" fill="#ffffff" stroke="#cbd5e1" />
    <text x="650" y="118" text-anchor="end" font-size="20" font-weight="bold" fill="#0f172a">٢. القَمَرُ</text>

    <rect x="370" y="160" width="300" height="60" rx="8" fill="#ffffff" stroke="#cbd5e1" />
    <text x="650" y="198" text-anchor="end" font-size="20" font-weight="bold" fill="#0f172a">٣. التُّفَّاحُ</text>

    <rect x="370" y="240" width="300" height="60" rx="8" fill="#ffffff" stroke="#cbd5e1" />
    <text x="650" y="278" text-anchor="end" font-size="20" font-weight="bold" fill="#0f172a">٤. الكِتَابُ</text>
  </g>

  <!-- السؤال الثاني -->
  <rect x="45" y="605" width="710" height="420" rx="12" fill="#fdf4ff" stroke="#f0abfc" stroke-width="2" />
  <text x="735" y="645" text-anchor="end" font-size="18" font-weight="bold" fill="#86198f">السُّؤَالُ الثَّانِي: اخْتَرِ الكَلِمَةَ الَّتِي تَحْوِي لاَمًا شَمْسِيَّةً فَقَطْ:</text>

  <g transform="translate(60, 675)">
    <rect x="0" y="0" width="670" height="95" rx="10" fill="#ffffff" stroke="#e2e8f0" />
    <text x="645" y="40" text-anchor="end" font-size="17" font-weight="bold" fill="#334155">أَيُّ هَذِهِ الكَلِمَاتِ يُنْطَقُ حَرْفُ اللاَّمِ فِيهَا بِوُضُوحٍ (لاَمٌ قَمَرِيَّة)؟</text>
    <text x="645" y="75" text-anchor="end" font-size="16" fill="#64748b">(انقر على المربع الصحيح)</text>

    <rect x="0" y="115" width="670" height="190" rx="10" fill="#ffffff" stroke="#e2e8f0" />
    <text x="645" y="155" text-anchor="end" font-size="17" font-weight="bold" fill="#334155">حَدِّدِ الجُمَلَ الَّتِي تَحْوِي كَلِمَةً شَمْسِيَّةً (ضَعْ عَلاَمَةَ صَحّ):</text>
    <text x="600" y="200" text-anchor="end" font-size="16" fill="#1e293b">أَشْرَقَتِ [الشَّمْسُ] فِي الصَّبَاحِ.</text>
    <text x="600" y="260" text-anchor="end" font-size="16" fill="#1e293b">قَرَأْتُ فِي [القُرْآنِ] الكَرِيمِ.</text>
  </g>
</svg>
`)}`;

export const INITIAL_DEFAULT_WORKSHEETS: InteractiveWorksheet[] = [
  {
    id: 'ws_demo_shams_qamar',
    school_id: '00000000-0000-0000-0000-000000000001',
    teacher_id: 'usr_teacher_demo_1',
    teacher_name: 'أستاذ موسى جمال',
    class_id: 'cls_demo_1',
    target_class_id: 'cls_demo_1',
    title: 'اللام الشمسية واللام القمرية ☀️🌙',
    description: 'ورقة عمل تفاعلية لتطبيق مهارة التمييز بين اللام الشمسية والقمرية للصفوف الأول والثاني.',
    grade_level: 'grade-1',
    subject: 'اللغة العربية',
    image_url: SAMPLE_WORKSHEET_SVG_1,
    background_url: SAMPLE_WORKSHEET_SVG_1,
    total_points: 20,
    is_public: true,
    is_public_link_enabled: true,
    created_at: new Date().toISOString(),
    elements: [
      // فراغات السؤال الأول
      {
        id: 'el_q1_1',
        type: 'text',
        x: 15,
        y: 26.5,
        width: 32,
        height: 4.5,
        correctAnswers: ['شمسية', 'شمسيه', 'لام شمسية', 'شمس'],
        points: 4,
        label: 'نوع لام الشمس'
      },
      {
        id: 'el_q1_2',
        type: 'text',
        x: 15,
        y: 33.8,
        width: 32,
        height: 4.5,
        correctAnswers: ['قمرية', 'قمريه', 'لام قمرية', 'قمر'],
        points: 4,
        label: 'نوع لام القمر'
      },
      {
        id: 'el_q1_3',
        type: 'text',
        x: 15,
        y: 41,
        width: 32,
        height: 4.5,
        correctAnswers: ['شمسية', 'شمسيه', 'لام شمسية', 'شمس'],
        points: 4,
        label: 'نوع لام التفاح'
      },
      {
        id: 'el_q1_4',
        type: 'text',
        x: 15,
        y: 48.3,
        width: 32,
        height: 4.5,
        correctAnswers: ['قمرية', 'قمريه', 'لام قمرية', 'قمر'],
        points: 4,
        label: 'نوع لام الكتاب'
      },
      // خيارات السؤال الثاني
      {
        id: 'el_q2_opt1',
        type: 'choice',
        x: 62,
        y: 66,
        width: 18,
        height: 3.5,
        groupName: 'q2_group',
        isCorrect: false,
        points: 2,
        label: 'الرَّجُلُ'
      },
      {
        id: 'el_q2_opt2',
        type: 'choice',
        x: 38,
        y: 66,
        width: 18,
        height: 3.5,
        groupName: 'q2_group',
        isCorrect: true,
        points: 2,
        label: 'البَابُ'
      },
      // مربعات الاختيار Checkboxes
      {
        id: 'el_chk_1',
        type: 'checkbox',
        x: 77,
        y: 78.5,
        width: 4.5,
        height: 3.2,
        isCorrect: true,
        points: 1,
        label: 'جملة الشمس'
      },
      {
        id: 'el_chk_2',
        type: 'checkbox',
        x: 77,
        y: 84,
        width: 4.5,
        height: 3.2,
        isCorrect: false,
        points: 1,
        label: 'جملة القرآن'
      }
    ]
  }
];

// جلب جميع أوراق العمل
export const SAMPLE_WORKSHEET_SVG_2 = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1100" width="800" height="1100" style="background:#ffffff; font-family:sans-serif;"><rect width="800" height="1100" fill="#f0fdf4" /><rect x="25" y="25" width="750" height="1050" rx="20" fill="#ffffff" stroke="#86efac" stroke-width="3" /><text x="400" y="85" text-anchor="middle" font-size="28" font-weight="bold" fill="#065f46">منصة تعلم مع موسى التعليمية</text><text x="400" y="125" text-anchor="middle" font-size="20" font-weight="600" fill="#047857">ورقة عمل: حروف المد وأقسام الكلمة</text></svg>`);

export async function fetchWorksheets(filter?: { schoolId?: string; teacherId?: string; classId?: string }): Promise<InteractiveWorksheet[]> {
  const localList = getStoredWorksheets(filter);
  try {
    let query = supabase.from("interactive_worksheets").select("*").order("created_at", { ascending: false });
    if (filter?.schoolId) {
      query = query.eq("school_id", filter.schoolId);
    }
    if (filter?.teacherId) {
      query = query.eq("teacher_id", filter.teacherId);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      const cloudMapped: InteractiveWorksheet[] = data.map(item => ({
        id: item.id,
        school_id: item.school_id,
        teacher_id: item.teacher_id,
        class_id: item.target_class_id || item.class_id,
        target_class_id: item.target_class_id || item.class_id,
        title: item.title,
        description: item.description,
        grade_level: item.grade_level,
        subject: item.subject || "اللغة العربية",
        image_url: item.image_url || item.background_url,
        background_url: item.image_url || item.background_url,
        pages: Array.isArray(item.pages) && item.pages.length > 0 ? item.pages : [item.image_url || item.background_url],
        elements: Array.isArray(item.elements) && item.elements.length > 0 ? item.elements : (Array.isArray(item.elements_schema) ? item.elements_schema : []),
        elements_schema: Array.isArray(item.elements_schema) ? item.elements_schema : [],
        total_points: Number(item.total_points) || 20,
        is_public: item.is_public ?? item.is_public_link_enabled ?? true,
        is_public_link_enabled: item.is_public ?? item.is_public_link_enabled ?? true,
        due_date: item.due_date,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));
      return cloudMapped;
    }
  } catch (err) {
    console.warn("[Supabase fetchWorksheets notice]:", err);
  }
  return localList;
}

export function getStoredWorksheets(filter?: { schoolId?: string; teacherId?: string; classId?: string }): InteractiveWorksheet[] {
  try {
    const raw = localStorage.getItem(WORKSHEETS_KEY);
    let list: InteractiveWorksheet[] = raw ? JSON.parse(raw) : INITIAL_DEFAULT_WORKSHEETS;
    if (!raw) {
      localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(INITIAL_DEFAULT_WORKSHEETS));
    }

    if (filter) {
      if (filter.schoolId) {
        list = list.filter(w => !w.school_id || w.school_id === filter.schoolId);
      }
      if (filter.teacherId) {
        list = list.filter(w => w.teacher_id === filter.teacherId);
      }
      if (filter.classId) {
        list = list.filter(w => !w.target_class_id || w.target_class_id === filter.classId || w.class_id === filter.classId);
      }
    }
    return list;
  } catch {
    return INITIAL_DEFAULT_WORKSHEETS;
  }
}

// جلب ورقة عمل محددة بالمعرف
export async function fetchWorksheetById(worksheetId: string): Promise<InteractiveWorksheet | null> {
  const localList = getStoredWorksheets();
  const foundLocal = localList.find(w => w.id === worksheetId);

  // محاولة الجلب المتزامن من Supabase إن توفرت الشبكة
  try {
    const { data, error } = await supabase
      .from('interactive_worksheets')
      .select('*')
      .eq('id', worksheetId)
      .maybeSingle();

    if (!error && data) {
      const mapped: InteractiveWorksheet = {
        id: data.id,
        school_id: data.school_id,
        teacher_id: data.teacher_id,
        class_id: data.class_id,
        target_class_id: data.class_id,
        title: data.title,
        description: data.description,
        grade_level: data.grade_level,
        subject: data.subject || 'اللغة العربية',
        image_url: data.background_url,
        background_url: data.background_url,
        elements: Array.isArray(data.elements_schema) ? data.elements_schema : [],
        elements_schema: Array.isArray(data.elements_schema) ? data.elements_schema : [],
        total_points: Number(data.total_points) || 100,
        is_public: data.is_public_link_enabled ?? true,
        is_public_link_enabled: data.is_public_link_enabled ?? true,
        due_date: data.due_date,
        created_at: data.created_at,
        updated_at: data.updated_at
      };

      // تحديث الكاش المحلي
      saveWorksheetLocally(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn('[Supabase Worksheet Fetch notice]', err);
  }

  return foundLocal || null;
}

// حفظ ورقة العمل في الكاش المحلي
export function saveWorksheetLocally(worksheet: InteractiveWorksheet): InteractiveWorksheet[] {
  const all = getStoredWorksheets();
  const idx = all.findIndex(w => w.id === worksheet.id);
  let updated: InteractiveWorksheet[];
  if (idx >= 0) {
    updated = [...all];
    updated[idx] = worksheet;
  } else {
    updated = [worksheet, ...all];
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('LocalStorage save worksheet quota notice', e);
  }
  return updated;
}

// حفظ ورقة العمل سحابياً في Supabase + محلياً
export async function saveWorksheet(worksheet: InteractiveWorksheet): Promise<{ success: boolean; worksheet: InteractiveWorksheet; error?: any; status?: number }> {
  try {
    const imageUrl = worksheet.image_url || worksheet.background_url || SAMPLE_WORKSHEET_SVG_1;
    const worksheetElements = Array.isArray(worksheet.elements) ? worksheet.elements : [];
    const targetClassId = worksheet.target_class_id || worksheet.class_id || null;

    // تجهيز كائن البيانات وفقاً لمتطلبات وتصميم جدول interactive_worksheets في Supabase بدقة
    const supabasePayload = {
      id: worksheet.id,
      school_id: worksheet.school_id || 'school_demo_mousa',
      teacher_id: worksheet.teacher_id,
      title: worksheet.title,
      image_url: imageUrl,
      background_url: imageUrl,
      elements: worksheetElements,
      elements_schema: worksheetElements,
      target_class_id: targetClassId,
      class_id: targetClassId,
      is_public: worksheet.is_public ?? true,
      is_public_link_enabled: worksheet.is_public ?? true,
      description: worksheet.description || null,
      grade_level: worksheet.grade_level || null,
      subject: worksheet.subject || 'اللغة العربية',
      pages: Array.isArray(worksheet.pages) && worksheet.pages.length > 0 ? worksheet.pages : [imageUrl],
      total_points: worksheet.total_points || 20,
      due_date: worksheet.due_date || null,
      updated_at: new Date().toISOString()
    };

    const { data, error, status } = await supabase
      .from('interactive_worksheets')
      .upsert(supabasePayload, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error || (status !== 200 && status !== 201)) {
      console.error('[Supabase Worksheet Save error]:', error?.message || `HTTP Status: ${status}`, error);
      return { 
        success: false, 
        worksheet, 
        error: error || new Error(`فشلت استجابة خادم Supabase برمز: ${status}`),
        status 
      };
    }

    // تم التحقق بنجاح من استجابة Supabase بـ (200 أو 201)
    const savedWorksheet: InteractiveWorksheet = {
      ...worksheet,
      ...(data || {}),
      elements: (data?.elements as any) || worksheetElements,
      pages: (data?.pages as any) || supabasePayload.pages
    };

    // حفظ محلي في الكاش بعد استجابة Supabase الناجحة
    saveWorksheetLocally(savedWorksheet);

    return { success: true, worksheet: savedWorksheet, status };
  } catch (err: any) {
    console.error('[Supabase Worksheet Save Exception]:', err);
    return { success: false, worksheet, error: err };
  }
}

// حذف ورقة عمل
export async function deleteWorksheet(worksheetId: string): Promise<boolean> {
  const all = getStoredWorksheets();
  const filtered = all.filter(w => w.id !== worksheetId);
  try {
    localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(filtered));
  } catch {}

  try {
    await supabase.from('interactive_worksheets').delete().eq('id', worksheetId);
  } catch {}

  return true;
}

// ===================== تسليمات أوراق العمل (Submissions) =====================

export function getStoredSubmissions(worksheetId?: string, studentId?: string): WorksheetSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    let list: WorksheetSubmission[] = raw ? JSON.parse(raw) : [];
    if (worksheetId) {
      list = list.filter(s => s.worksheet_id === worksheetId);
    }
    if (studentId) {
      list = list.filter(s => s.student_id === studentId);
    }
    return list;
  } catch {
    return [];
  }
}

// حفظ تسليم ورقة العمل محلياً وسحابياً
export async function submitWorksheetAnswers(submission: WorksheetSubmission): Promise<{ success: boolean; submission: WorksheetSubmission }> {
  // 1. حفظ محلي
  const all = getStoredSubmissions();
  const updated = [submission, ...all.filter(s => s.id !== submission.id)];
  try {
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(updated));
  } catch {}

  // 2. مزامنة سحابية مع Supabase جدول worksheet_submissions
  try {
    const payload = {
      id: submission.id,
      worksheet_id: submission.worksheet_id,
      school_id: submission.school_id || '00000000-0000-0000-0000-000000000001',
      student_id: submission.student_id || null,
      guest_name: submission.guest_name || null,
      student_name: submission.student_name || submission.guest_name || 'طالب زائر',
      class_id: submission.class_id || null,
      answers: submission.answers,
      answers_data: {
        answers: submission.answers,
        results_breakdown: submission.results_breakdown,
        guest_name: submission.guest_name
      },
      score: submission.score,
      total_score: submission.total_score,
      max_score: submission.total_score,
      percentage: submission.percentage,
      status: 'graded',
      submitted_at: submission.submitted_at || new Date().toISOString()
    };

    const { error } = await supabase
      .from('worksheet_submissions')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase Submission Save notice]:', error.message);
    }
  } catch (e) {
    console.warn('[Supabase Submission Save Exception]:', e);
  }

  return { success: true, submission };
}

// جلب التسليمات مع المزامنة السحابية
export async function fetchWorksheetSubmissions(worksheetId?: string): Promise<WorksheetSubmission[]> {
  const local = getStoredSubmissions(worksheetId);

  try {
    let query = supabase.from('worksheet_submissions').select('*').order('submitted_at', { ascending: false });
    if (worksheetId) {
      query = query.eq('worksheet_id', worksheetId);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      const cloudMapped: WorksheetSubmission[] = data.map(item => {
        const answersData = item.answers_data || {};
        return {
          id: item.id,
          worksheet_id: item.worksheet_id,
          school_id: item.school_id,
          student_id: item.student_id,
          student_name: item.student_name,
          guest_name: answersData.guest_name,
          class_id: item.class_id,
          answers: answersData.answers || {},
          score: Number(item.score) || 0,
          total_score: Number(item.max_score) || 100,
          percentage: Number(item.percentage) || 0,
          status: item.status,
          submitted_at: item.submitted_at,
          results_breakdown: answersData.results_breakdown || {}
        };
      });

      // دمج وتحديث الكاش المحلي
      const mergedMap = new Map<string, WorksheetSubmission>();
      cloudMapped.forEach(s => mergedMap.set(s.id, s));
      local.forEach(s => {
        if (!mergedMap.has(s.id)) mergedMap.set(s.id, s);
      });

      const mergedList = Array.from(mergedMap.values());
      try {
        localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(mergedList));
      } catch {}

      return worksheetId ? mergedList.filter(s => s.worksheet_id === worksheetId) : mergedList;
    }
  } catch (err) {
    console.warn('[Submissions sync error]', err);
  }

  return local;
}

// ===================== خوارزمية التصحيح التلقائي الذكية =====================

export const gradeWorksheetSubmission = evaluateStudentWorksheet;

export function evaluateStudentWorksheet(
  worksheet: InteractiveWorksheet,
  answers: Record<string, any>
): {
  score: number;
  totalScore: number;
  percentage: number;
  breakdown: Record<string, { isCorrect: boolean; pointsEarned: number; expected: any; studentAnswer: any }>;
} {
  let score = 0;
  let totalScore = 0;
  const breakdown: Record<string, { isCorrect: boolean; pointsEarned: number; expected: any; studentAnswer: any }> = {};

  const elements = worksheet.elements || [];

  for (const el of elements) {
    const elPoints = Number(el.points) || 1;
    totalScore += elPoints;
    const studentAns = answers[el.id];

    let isCorrect = false;

    if (el.type === 'text') {
      const normalizedStudent = normalizeArabicText(studentAns || '');
      const validOptions = (el.correctAnswers || []).map(ans => normalizeArabicText(ans));
      isCorrect = normalizedStudent.length > 0 && validOptions.some(opt => opt === normalizedStudent);
      breakdown[el.id] = {
        isCorrect,
        pointsEarned: isCorrect ? elPoints : 0,
        expected: (el.correctAnswers || [])[0] || '',
        studentAnswer: studentAns || ''
      };
    } else if (el.type === 'essay') {
      // تصحيح السؤال المقالي بناء على الكلمات المفتاحية
      const rawEssay = (studentAns || '').toString().trim();
      const normalizedEssay = normalizeArabicText(rawEssay);
      const keywords = (el.keywords || []).map(k => normalizeArabicText(k)).filter(k => k.length > 0);
      const minRequired = el.minKeywordsRequired || (keywords.length > 0 ? Math.ceil(keywords.length / 2) : 1);
      
      let matchedKeywordsCount = 0;
      keywords.forEach(kw => {
        if (normalizedEssay.includes(kw)) matchedKeywordsCount++;
      });

      if (keywords.length > 0) {
        isCorrect = matchedKeywordsCount >= minRequired;
      } else {
        // إذا لم يحدد المعلم كلمات مفتاحية، احتساب الدرجة بمجرد كتابة الطالب لفقرة مجدية (> 10 حروف)
        isCorrect = rawEssay.length >= 10;
      }

      breakdown[el.id] = {
        isCorrect,
        pointsEarned: isCorrect ? elPoints : 0,
        expected: keywords.length > 0 ? ('الكلمات المطلوبة: ' + (el.keywords || []).join('، ')) : 'إجابة مقالية كاملة',
        studentAnswer: rawEssay
      };
    } else if (el.type === 'choice') {
      const isSelected = studentAns === true || studentAns === el.id;
      const expectedCorrect = el.isCorrect ?? false;
      isCorrect = (isSelected && expectedCorrect) || (!isSelected && !expectedCorrect);
      if (expectedCorrect) {
        isCorrect = isSelected;
      }
      breakdown[el.id] = {
        isCorrect,
        pointsEarned: isCorrect ? elPoints : 0,
        expected: expectedCorrect,
        studentAnswer: isSelected
      };
    } else if (el.type === 'checkbox') {
      const isChecked = Boolean(studentAns);
      const expectedCheck = el.isCorrect ?? false;
      isCorrect = isChecked === expectedCheck;
      breakdown[el.id] = {
        isCorrect,
        pointsEarned: isCorrect ? elPoints : 0,
        expected: expectedCheck,
        studentAnswer: isChecked
      };
    } else if (el.type === 'join_point') {
      // تصحيح أداة التوصيل بين الأعمدة
      if (el.joinRole === 'source') {
        const connectedTargetId = studentAns; // معرّف النقطة التي وصلها الطالب
        const expectedTargetId = el.targetPointId;
        isCorrect = Boolean(connectedTargetId && connectedTargetId === expectedTargetId);
        
        // إيجاد تسمية النقطة المقابلة لعرضها
        const targetElement = elements.find(item => item.id === expectedTargetId);
        breakdown[el.id] = {
          isCorrect,
          pointsEarned: isCorrect ? elPoints : 0,
          expected: targetElement?.label || expectedTargetId || 'النقطة الصحيحة المقابلة',
          studentAnswer: connectedTargetId || 'لم يتم التوصيل'
        };
      } else {
        // نقطة الوصول (target) لا تحتسب نقطة مستقلة لمنع مضاعفة الدرجة
        continue;
      }
    }

    if (isCorrect) {
      score += elPoints;
    }
  }

  const percentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 100;

  return {
    score,
    totalScore,
    percentage,
    breakdown
  };
}
