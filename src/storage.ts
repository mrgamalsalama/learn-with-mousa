import { UserProfile, Activity, StudentSubmission, StoryBankItem, BookItem, ChildBadge, ChildPhonicsRecord } from './types';
import { INITIAL_BOOKS } from './booksData';
import { supabase } from './supabaseClient';

const USERS_KEY = 'lwm_users';
const ACTIVITIES_KEY = 'lwm_activities';
const SUBMISSIONS_KEY = 'lwm_submissions';
const CURRENT_USER_KEY = 'lwm_current_user';
const BOOKS_KEY = 'lwm_books_repository';
const BADGES_KEY = 'lwm_student_badges';
const PHONICS_RECORDS_KEY = 'lwm_student_phonics';

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr_admin',
    name: 'المشرف العام',
    username: 'admin',
    password: '123',
    role: 'super_admin',
    loginCount: 5,
  },
  {
    id: 'usr_hod',
    name: 'د. أحمد المنصوري (رئيس القسم)',
    username: 'hod',
    password: '123',
    role: 'hod',
    allowedStages: ['primary'],
    allowedGrades: ['grade-1', 'grade-2', 'grade-3', 'grade-4'],
    allowedTracks: ['arabic-a', 'arabic-b'],
    loginCount: 8,
  },
  {
    id: 'usr_teacher',
    name: 'الأستاذة فاطمة الزهراء',
    username: 'teacher',
    password: '123',
    role: 'teacher',
    allowedStages: ['primary'],
    allowedGrades: ['grade-1', 'grade-2'],
    allowedTracks: ['arabic-a', 'arabic-b'],
    loginCount: 12,
  },
  {
    id: 'usr_student_mousa',
    name: 'موسى البطل 🌟',
    username: 'student',
    password: '123',
    role: 'student',
    stage: 'primary',
    grade: 'grade-1',
    track: 'arabic-a',
    teacherId: 'usr_teacher',
    loginCount: 15,
  },
  {
    id: 'usr_parent',
    name: 'الأستاذ عمر (ولي أمر موسى)',
    username: 'parent',
    password: '123',
    role: 'parent',
    studentId: 'usr_student_mousa',
    loginCount: 6,
  }
];

// ================= المستخدمين (Users Cloud & Local Sync) =================

export const syncUsersFromCloud = async (): Promise<UserProfile[]> => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
      console.error("Supabase Sync Error Details:", error.message, error.details, error.hint);
      return getUsers();
    }
    if (Array.isArray(data)) {
      // إعادة تحويل Snake_Case إلى CamelCase
      const cloudUsers: UserProfile[] = data.map((u: any) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        password: u.password,
        role: u.role,
        stage: u.stage || undefined,
        grade: u.grade || undefined,
        track: u.track || undefined,
        studentId: u.student_id || undefined,
        allowedGrades: Array.isArray(u.allowed_grades) ? u.allowed_grades : [],
        allowedStages: Array.isArray(u.allowed_stages) ? u.allowed_stages : (u.stage ? [u.stage] : ['primary']),
        allowedTracks: Array.isArray(u.allowed_tracks) ? u.allowed_tracks : ['arabic-a'],
        loginCount: u.login_count || 0,
        lastLogin: u.last_login || undefined
      }));

      // الحفاظ على الحسابات الافتراضية التجريبية
      const mergedMap = new Map<string, UserProfile>();
      for (const initUser of INITIAL_USERS) {
        mergedMap.set(initUser.username.toLowerCase(), initUser);
      }
      for (const cu of cloudUsers) {
        mergedMap.set(cu.username.toLowerCase(), cu);
      }

      const merged = Array.from(mergedMap.values());
      localStorage.setItem(USERS_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err: any) {
    console.error("Supabase Sync Exception:", err);
  }
  return getUsers();
};

export const getUsers = (): UserProfile[] => {
  const data = localStorage.getItem(USERS_KEY);
  if (!data) {
    localStorage.setItem(USERS_KEY, JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  const currentList: UserProfile[] = JSON.parse(data);
  let changed = false;
  for (const initUser of INITIAL_USERS) {
    if (!currentList.some(u => u.username.toLowerCase() === initUser.username.toLowerCase())) {
      currentList.push(initUser);
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem(USERS_KEY, JSON.stringify(currentList));
  }
  return currentList;
};

export const saveUser = async (user: UserProfile): Promise<{ user: UserProfile; error?: any }> => {
  // 1. الحفظ الفوري في التخزين المحلي كنسخة احتياطية سريعة ومضمونة
  const users = getUsers();
  const existingIdx = users.findIndex(u => u.id === user.id);
  if (existingIdx >= 0) {
    users[existingIdx] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // 2. التأكد من تطابق الـ payload تماماً مع أعمدة جدول users في Supabase
  const payload: any = {
    id: user.id,
    name: user.name,
    username: user.username,
    password: user.password,
    role: user.role,
    login_count: user.loginCount || 0,
    last_login: user.lastLogin || null,
    stage: user.stage || null,
    grade: user.grade || null,
    track: user.track || null,
    student_id: user.studentId || null,
    allowed_grades: user.allowedGrades || [],
    allowed_stages: user.allowedStages || [],
    allowed_tracks: user.allowedTracks || []
  };

  // 3. فحص كائن الخطأ الصادر من Supabase بدقة
  try {
    let { data, error } = await supabase.from('users').upsert([payload]);

    // مرونة: إذا كان الخطأ بسبب عدم وجود عمود allowed_stages في جدول users بسحابة العميل
    if (error && error.message && error.message.includes('allowed_stages')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.allowed_stages;
      const retryRes = await supabase.from('users').upsert([fallbackPayload]);
      error = retryRes.error;
      data = retryRes.data;
    }

    if (error) {
      console.error("Supabase Save Error Details:", error.message, error.details, error.hint);
      // تنبيه المشرف بالخطأ بدلاً من كتمه
      alert("تعذر الحفظ السحابي: " + error.message);
      return { user, error };
    }

    console.log('تم حفظ المستخدم في Supabase بنجاح:', user.username);
    return { user };
  } catch (err: any) {
    console.error("Supabase Save Exception:", err);
    alert("تعذر الاتصال بـ Supabase: " + (err?.message || 'خطأ في الشبكة'));
    return { user, error: err };
  }
};

export const deleteUser = async (id: string): Promise<void> => {
  const users = getUsers().filter(u => u.id !== id);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  try {
    await supabase.from('users').delete().eq('id', id);
  } catch (e) {
    console.error('فشل حذف المستخدم سحابياً:', e);
  }
};

export const recordUserLogin = (user: UserProfile): UserProfile => {
  const updatedUser: UserProfile = {
    ...user,
    loginCount: (user.loginCount || 0) + 1,
    lastLogin: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  };
  saveUser(updatedUser);
  setCurrentUser(updatedUser);
  return updatedUser;
};

export const getCurrentUser = (): UserProfile | null => {
  const data = localStorage.getItem(CURRENT_USER_KEY);
  return data ? JSON.parse(data) : null;
};

export const setCurrentUser = (user: UserProfile | null) => {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
};

// ================= الأنشطة (Activities Cloud & Local Sync) =================

export const syncActivitiesFromCloud = async (): Promise<Activity[]> => {
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const formatted: Activity[] = data.map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description || undefined,
        passage: a.passage || undefined,
        teacherId: a.teacher_id,
        teacherName: a.teacher_name,
        stage: a.stage,
        grade: a.grade,
        track: a.track,
        questions: Array.isArray(a.questions)
          ? a.questions
          : (typeof a.questions === 'string' ? JSON.parse(a.questions) : []),
        createdAt: a.created_at || new Date().toISOString()
      }));
      localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(formatted));
      return formatted;
    }
  } catch (err) {
    console.warn('تعذر جلب الأنشطة سحابياً:', err);
  }
  return getActivities();
};

export const getActivities = (): Activity[] => {
  const data = localStorage.getItem(ACTIVITIES_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveActivity = async (activity: Activity): Promise<void> => {
  const activities = getActivities();
  const existingIdx = activities.findIndex(a => a.id === activity.id);
  if (existingIdx >= 0) {
    activities[existingIdx] = activity;
  } else {
    activities.unshift(activity);
  }
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));

  try {
    const { error } = await supabase.from('activities').upsert({
      id: activity.id,
      title: activity.title,
      description: activity.description || null,
      passage: activity.passage || null,
      teacher_id: activity.teacherId,
      teacher_name: activity.teacherName,
      stage: activity.stage,
      grade: activity.grade,
      track: activity.track,
      questions: activity.questions,
      created_at: activity.createdAt || new Date().toISOString()
    });
    if (error) {
      console.warn('ملاحظة في حفظ النشاط سحابياً:', error.message);
    }
  } catch (e) {
    console.error('فشل رفع النشاط سحابياً:', e);
  }
};

export const deleteActivity = async (id: string): Promise<void> => {
  const activities = getActivities().filter(a => a.id !== id);
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
  try {
    await supabase.from('activities').delete().eq('id', id);
  } catch (e) {
    console.error('فشل حذف النشاط سحابياً:', e);
  }
};

// ================= تسليمات ودرجات الطلاب (Submissions Cloud & Local Sync) =================

export const syncSubmissionsFromCloud = async (): Promise<StudentSubmission[]> => {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const formatted: StudentSubmission[] = data.map((s: any) => ({
        id: s.id,
        activityId: s.activity_id,
        activityTitle: s.activity_title,
        studentId: s.student_id,
        studentName: s.student_name,
        grade: s.grade || undefined,
        track: s.track || undefined,
        score: s.score,
        totalPoints: s.total_points,
        submittedAt: s.submitted_at,
        answers: typeof s.answers === 'object' && s.answers !== null ? s.answers : {}
      }));
      localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(formatted));
      return formatted;
    }
  } catch (err) {
    console.warn('تعذر جلب تسليمات الطلاب سحابياً:', err);
  }
  return getSubmissions();
};

export const getSubmissions = (): StudentSubmission[] => {
  const data = localStorage.getItem(SUBMISSIONS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveSubmission = async (submission: StudentSubmission): Promise<void> => {
  const subs = getSubmissions();
  const existingIdx = subs.findIndex(s => s.id === submission.id);
  if (existingIdx >= 0) {
    subs[existingIdx] = submission;
  } else {
    subs.unshift(submission);
  }
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(subs));

  try {
    const { error } = await supabase.from('submissions').upsert({
      id: submission.id,
      activity_id: submission.activityId,
      activity_title: submission.activityTitle,
      student_id: submission.studentId,
      student_name: submission.studentName,
      grade: submission.grade || null,
      track: submission.track || null,
      score: submission.score,
      total_points: submission.totalPoints,
      submitted_at: submission.submittedAt,
      answers: submission.answers
    });
    if (error) {
      console.warn('ملاحظة في رفع التسليم سحابياً:', error.message);
    }
  } catch (e) {
    console.error('فشل رفع التسليم سحابياً:', e);
  }
};

// ================= بنك القصص ومستودع الكتب =================

export const getStoryBank = (): StoryBankItem[] => {
  return [
    {
      id: 'sb_1',
      title: 'أمانة الصادق الأمين',
      moralTopic: 'خلق الأمانة والصدق',
      passage: 'كان النبي محمد ﷺ يُعرف في مكة بالصادق الأمين، حيث كان أهل مكة يودعون عنده أموالهم ونفائسهم لثقتهم التامة بأمانته.',
      stage: 'primary',
      grade: 'grade-1',
      track: 'arabic-a',
      questions: [
        {
          id: 'q_sb_1',
          text: 'بِمَ كان يُعرف النبي ﷺ بين أهل مكة؟',
          type: 'multiple_choice',
          options: ['الكريم الجواد', 'الصادق الأمين', 'القوي الشجاع', 'الحكيم العادل'],
          correctAnswer: 'الصادق الأمين',
          points: 5
        }
      ]
    }
  ];
};

const BOOKS_VERSION_KEY = 'lwm_books_version';
const CURRENT_BOOKS_VERSION = 'v2.1';

export const getBooksRepository = (): BookItem[] => {
  const savedVersion = localStorage.getItem(BOOKS_VERSION_KEY);
  const localData = localStorage.getItem(BOOKS_KEY);

  if (savedVersion !== CURRENT_BOOKS_VERSION || !localData) {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(INITIAL_BOOKS));
    localStorage.setItem(BOOKS_VERSION_KEY, CURRENT_BOOKS_VERSION);
    return INITIAL_BOOKS;
  }

  try {
    return JSON.parse(localData);
  } catch {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(INITIAL_BOOKS));
    localStorage.setItem(BOOKS_VERSION_KEY, CURRENT_BOOKS_VERSION);
    return INITIAL_BOOKS;
  }
};

export const updateBookAssignment = (
  bookId: string,
  assignedGrades: any[],
  assignedTracks: any[],
  teacherId: string
) => {
  const books = getBooksRepository();
  const bookIndex = books.findIndex(b => b.id === bookId);
  if (bookIndex >= 0) {
    books[bookIndex].assignedGrades = assignedGrades;
    books[bookIndex].assignedTracks = assignedTracks;
    books[bookIndex].assignedByTeacherId = teacherId;
    localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
  }
};

// ================= أوسمة وإنجازات الطالب (Badge Isolation & Cloud Sync) =================

// أوسمة تجريبية مخصصة حصراً لحساب الديمو الخاص بموسى البطل (usr_student_mousa)
const MOUSA_DEMO_BADGES: ChildBadge[] = [
  {
    id: 'badge_welcome',
    studentId: 'usr_student_mousa',
    title: 'نجم الحروف الصاعد 🌟',
    description: 'الانضمام لمنصة تعلّم مع موسى واستكشاف الحروف',
    icon: '🌟',
    earnedAt: '2026-09-18',
    category: 'phonics',
  },
  {
    id: 'badge_story_1',
    studentId: 'usr_student_mousa',
    title: 'حكواتي حرف الباء 📖',
    description: 'إكمال قصة تفاعلية مشكولة واتخاذ قرارات ذكية',
    icon: '🏆',
    earnedAt: '2026-09-18',
    category: 'story',
  },
  {
    id: 'badge_art_1',
    studentId: 'usr_student_mousa',
    title: 'فنان الكلمات والرسومات 🎨',
    description: 'رسم عنصر يمثل حرف الباء والتعرف عليه بالذكاء الاصطناعي',
    icon: '🎨',
    earnedAt: '2026-09-18',
    category: 'drawing',
  }
];

/**
 * جلب الأوسمة المكتسبة الخاصة بالطالب حصراً بحسب معرفه studentId.
 * قواعد العزل التام (Badge Isolation):
 * - إذا كان الطالب حديث التسجيل (مثل "هارون") ولم يحصل على أوسمة بعد، تُرجع الدالة مصفوفة فارغة [] ولا تعرض أي وسام وهمي.
 * - أوسمة الديمو تظهر فقط لحساب الطالب الافتراضي "usr_student_mousa".
 */
export const getStudentBadges = (studentId: string): ChildBadge[] => {
  if (!studentId) return [];
  const cacheKey = `${BADGES_KEY}_${studentId}`;
  const data = localStorage.getItem(cacheKey);

  if (data !== null) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // التحقق من عزل الأوسمة وتطابقها مع معرف الطالب
        return parsed.filter((b: ChildBadge) => !b.studentId || b.studentId === studentId);
      }
    } catch {
      return [];
    }
  }

  // حساب موسى التجريبي فقط يملك أوسمة أولية
  if (studentId === 'usr_student_mousa') {
    localStorage.setItem(cacheKey, JSON.stringify(MOUSA_DEMO_BADGES));
    return MOUSA_DEMO_BADGES;
  }

  // أي طالب مسجل حديثاً (مثل "هارون"): إرجاع مصفوفة فارغة تماماً []
  localStorage.setItem(cacheKey, JSON.stringify([]));
  return [];
};

/**
 * مزامنة سحابية حقيقية للأوسمة من جدول badges في Supabase
 */
export const syncStudentBadgesFromCloud = async (studentId: string): Promise<ChildBadge[]> => {
  if (!studentId) return [];
  const cacheKey = `${BADGES_KEY}_${studentId}`;

  try {
    const { data, error } = await supabase
      .from('badges')
      .select('*')
      .eq('student_id', studentId)
      .order('earned_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const cloudBadges: ChildBadge[] = data.map((b: any) => ({
        id: b.id,
        studentId: b.student_id,
        title: b.title,
        description: b.description,
        icon: b.icon,
        earnedAt: b.earned_at || b.created_at || new Date().toLocaleDateString('ar-EG'),
        category: b.category || 'story'
      }));

      // حفظ الأوسمة المسترجعة في الكاش (حتى لو كانت [] لطالب جديد، لتثبيت الفراغ)
      localStorage.setItem(cacheKey, JSON.stringify(cloudBadges));
      return cloudBadges;
    }
  } catch (err) {
    console.warn('تعذر جلب الأوسمة سحابياً، سيتم استخدام التخزين المعزول للطالب:', err);
  }

  // في حال تعذر السحابة نعتمد التخزين المحلي المعزول الخاص بالطالب
  return getStudentBadges(studentId);
};

/**
 * حفظ وسام جديد للطالب مع رفعه سحابياً لـ Supabase فوراً
 */
export const saveStudentBadge = (studentId: string, badge: ChildBadge): ChildBadge[] => {
  if (!studentId) return [];
  const cacheKey = `${BADGES_KEY}_${studentId}`;
  const currentBadges = getStudentBadges(studentId);
  const badgeWithStudent: ChildBadge = { ...badge, studentId };

  let updatedBadges = currentBadges;
  if (!currentBadges.some(b => b.id === badge.id || b.title === badge.title)) {
    updatedBadges = [badgeWithStudent, ...currentBadges];
    localStorage.setItem(cacheKey, JSON.stringify(updatedBadges));
  }

  // مزامنة فورية غير متزامنة مع Supabase لجدول badges
  (async () => {
    try {
      const { error } = await supabase.from('badges').upsert({
        id: badge.id,
        student_id: studentId,
        title: badge.title,
        description: badge.description,
        icon: badge.icon,
        category: badge.category,
        earned_at: badge.earnedAt || new Date().toLocaleDateString('ar-EG')
      });
      if (error) {
        console.warn('ملاحظة في حفظ الوسام سحابياً:', error.message);
      }
    } catch (err) {
      console.warn('فشل رفع الوسام سحابياً:', err);
    }
  })();

  return updatedBadges;
};

// ================= سجل التحديات الصوتية والرسم للتحليل التشخيصي =================

const MOUSA_DEMO_PHONICS: ChildPhonicsRecord[] = [
  { letter: 'أ', word: 'أَرْنَبٌ', isCorrect: true, type: 'voice', timestamp: 'اليوم 09:30 ص' },
  { letter: 'ب', word: 'بَطَّةٌ', isCorrect: true, type: 'voice', timestamp: 'اليوم 09:35 ص' },
  { letter: 'م', word: 'مَسْجِدٌ', isCorrect: true, type: 'voice', timestamp: 'اليوم 09:42 ص' },
  { letter: 'س', word: 'سَمَكَةٌ', isCorrect: true, type: 'voice', timestamp: 'اليوم 09:50 ص' },
  { letter: 'د', word: 'دَرَاجَةٌ', isCorrect: true, type: 'voice', timestamp: 'اليوم 10:05 ص' },
  { letter: 'ص', word: 'سَقْرٌ', isCorrect: false, type: 'voice', timestamp: 'اليوم 10:15 ص' },
  { letter: 'ض', word: 'دِفْدَعٌ', isCorrect: false, type: 'voice', timestamp: 'اليوم 10:20 ص' },
  { letter: 'ب', word: 'بيت', isCorrect: true, type: 'drawing', timestamp: 'اليوم 10:30 ص' },
];

export const getStudentPhonicsRecords = (studentId: string): ChildPhonicsRecord[] => {
  if (!studentId) return [];
  const cacheKey = `${PHONICS_RECORDS_KEY}_${studentId}`;
  const data = localStorage.getItem(cacheKey);

  if (data !== null) {
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  if (studentId === 'usr_student_mousa') {
    localStorage.setItem(cacheKey, JSON.stringify(MOUSA_DEMO_PHONICS));
    return MOUSA_DEMO_PHONICS;
  }

  // الطالب الجديد يبدأ بسجل فارغ
  localStorage.setItem(cacheKey, JSON.stringify([]));
  return [];
};

export const saveStudentPhonicsRecord = (studentId: string, record: ChildPhonicsRecord): ChildPhonicsRecord[] => {
  if (!studentId) return [];
  const records = getStudentPhonicsRecords(studentId);
  records.unshift(record);
  localStorage.setItem(`${PHONICS_RECORDS_KEY}_${studentId}`, JSON.stringify(records));
  return records;
};

// ================= الاشتراك اللحظي في التغييرات السحابية (Supabase Realtime) =================

export const subscribeToCloudChanges = (callbacks: {
  onUsersChange?: () => void;
  onActivitiesChange?: () => void;
  onSubmissionsChange?: () => void;
  onBadgesChange?: () => void;
}) => {
  try {
    const channel = supabase
      .channel('lwm-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        callbacks.onUsersChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => {
        callbacks.onActivitiesChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        callbacks.onSubmissionsChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'badges' }, () => {
        callbacks.onBadgesChange?.();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Realtime subscription error:', err);
    return () => {};
  }
};
