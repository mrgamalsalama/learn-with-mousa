import { UserProfile, Activity, ActivityType, GameData, StudentSubmission, StoryBankItem, BookItem, ChildBadge, ChildPhonicsRecord, AIGovernanceRules, Exam, ExamSession, ExamQuestion } from './types';
import { INITIAL_BOOKS } from './booksData';
import { supabase, upsertUserInSupabase } from './supabaseClient';
import { 
  cacheMultipleGamesOffline, 
  enqueueOfflineSubmission, 
  syncOfflineSubmissionsQueue, 
  getOfflineQueue as getIndexedDBOfflineQueue 
} from './db/offlineCache';

const USERS_KEY = 'lwm_users';
const ACTIVITIES_KEY = 'lwm_activities';
const SUBMISSIONS_KEY = 'lwm_submissions';
const CURRENT_USER_KEY = 'lwm_current_user';
const BOOKS_KEY = 'lwm_books_repository';
const BADGES_KEY = 'lwm_student_badges';
const PHONICS_RECORDS_KEY = 'lwm_student_phonics';
const AI_GOVERNANCE_KEY = 'lwm_ai_governance_rules';
const EXAMS_KEY = 'lwm_exams';
const EXAM_SESSIONS_KEY = 'lwm_exam_sessions';
export const AI_GOVERNANCE_SYNC_ID = 'ai_governance_rules_sync';

export const INITIAL_EXAMS: Exam[] = [
  {
    id: 'exam_demo_grade1',
    title: 'تَقْيِيمُ مُنْتَصَفِ الفَصْلِ: مَهَارَاتُ اللُّغَةِ العَرَبِيَّةِ وَالقِرَاءَةِ 📝',
    teacher_id: 'usr_teacher',
    teacher_name: 'الأستاذة فاطمة الزهراء',
    target_grade: 'grade-1',
    target_track: 'arabic-a',
    duration_minutes: 15,
    show_results_immediately: true,
    is_active: true,
    description: 'اختبار تشخيصي لقياس مهارات الوعي الصوتي والحركات والمدود والإملاء المشكول للصف الأول.',
    created_at: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        text: 'مَا الصَّوْتُ الأَوَّلُ فِي كَلِمَةِ: (أَسَدٌ)؟',
        type: 'multiple_choice',
        options: ['أَ (حَرْفُ الأَلِفِ المَفْتُوحُ)', 'بَ (حَرْفُ البَاءِ)', 'سَ (حَرْفُ السِّينِ)', 'مَ (حَرْفُ المِيمِ)'],
        correctAnswer: 'أَ (حَرْفُ الأَلِفِ المَفْتُوحُ)',
        points: 5,
        explanation: 'كَلِمَةُ (أَسَدٌ) تَبْدَأُ بِحَرْفِ الأَلِفِ مَعَ حَرَكَةِ الفَتْحِ (أَ).'
      },
      {
        id: 'q2',
        text: 'كَلِمَةُ (القَمَرُ) تَحْتَوِي عَلَى لَامٍ قَمَرِيَّةٍ تُكْتَبُ وَتُنْطَقُ.',
        type: 'true_false',
        options: ['صَحِيحٌ ✅', 'خَطَأٌ ❌'],
        correctAnswer: 'صَحِيحٌ ✅',
        points: 5,
        explanation: 'اللَّامُ القَمَرِيَّةُ سَاكِنَةٌ وَتُنْطَقُ بِوُضُوحٍ كَمَا فِي (القَمَرُ).'
      },
      {
        id: 'q3',
        text: 'اكْتُبِ الكَلِمَةَ التَّالِيَةَ مَضْبُوطَةً بِالشَّكْلِ التَّامِّ: (قَلَمٌ)',
        type: 'spelling_dictation',
        correctAnswer: 'قَلَمٌ',
        points: 5,
        explanation: 'فَتْحَةٌ فَوْقَ القَافِ، وَفَتْحَةٌ فَوْقَ اللَّامِ، وَتَنْوِينُ ضَمٍّ فَوْقَ المِيمِ.',
        audioPromptText: 'قَلَمٌ'
      },
      {
        id: 'q4',
        text: 'أَيٌّ مِنَ الكَلِمَاتِ التَّالِيَةِ تَشْتَمِلُ عَلَى مَدٍّ بِاليَاءِ؟',
        type: 'multiple_choice',
        options: ['فِيلٌ', 'بَابٌ', 'نُورٌ', 'بَيْتٌ'],
        correctAnswer: 'فِيلٌ',
        points: 5,
        explanation: 'المَدُّ بِاليَاءِ يَأْتِي مَسْبُوقاً بِحَرْفٍ مَكْسُورٍ مِثْلَ: فِـيـلٌ.'
      }
    ]
  },
  {
    id: 'exam_demo_grade2',
    title: 'اخْتِبَارُ الظَّوَاهِرِ اللُّغَوِيَّةِ وَالتَّنْوِينِ التَّفَاعُلِيُّ 🌟',
    teacher_id: 'usr_teacher',
    teacher_name: 'الأستاذة فاطمة الزهراء',
    target_grade: 'grade-2',
    target_track: 'arabic-a',
    duration_minutes: 20,
    show_results_immediately: false,
    is_active: true,
    description: 'اختبار دقيق في التمييز بين التاء المربوطة والمفتوحة واللامات وأنواع التنوين.',
    created_at: new Date().toISOString(),
    questions: [
      {
        id: 'q2_1',
        text: 'تُنْطَقُ التَّاءُ المَفْتُوحَةُ (ت) تَاءً فِي الوَقْفِ وَالوَصْلِ.',
        type: 'true_false',
        options: ['صَحِيحٌ ✅', 'خَطَأٌ ❌'],
        correctAnswer: 'صَحِيحٌ ✅',
        points: 5,
        explanation: 'التَّاءُ المَفْتُوحَةُ فِي مِثْلِ (بَيْتٌ / بَيْتْ) تَبْقَى تَاءً فِي الحَالَتَيْنِ.'
      },
      {
        id: 'q2_2',
        text: 'مَا الإِعْرَابُ أَوْ الشَّكْلُ الصَّحِيحُ لِكَلِمَةِ (مَدْرَسَة) عِنْدَ إِضَافَةِ تَنْوِينِ الفَتْحِ؟',
        type: 'multiple_choice',
        options: ['مَدْرَسَةً (بِدُونِ أَلِفٍ زَائِدَةٍ)', 'مَدْرَسَتًا', 'مَدْرَسَةٍ', 'مَدْرَسَةُ'],
        correctAnswer: 'مَدْرَسَةً (بِدُونِ أَلِفٍ زَائِدَةٍ)',
        points: 5,
        explanation: 'التَّاءُ المَرْبُوطَةُ لَا تَلْحَقُهَا أَلِفُ التَّنْوِينِ، بَلْ يُوضَعُ التَّنْوِينُ فَوْقَهَا مُبَاشَرَةً.'
      },
      {
        id: 'q2_3',
        text: 'اكْتُبِ الكَلِمَةَ التَّالِيَةَ كِتَابَةً إِمْلَائِيَّةً صَحِيحَةً: (الشَّجَرَةُ)',
        type: 'spelling_dictation',
        correctAnswer: 'الشَّجَرَةُ',
        points: 5,
        explanation: 'انْتَبِهْ لِلَّامِ الشَّمْسِيَّةِ مَعَ الشَّدَّةِ فَوْقَ الشِّينِ وَالتَّاءِ المَرْبُوطَةِ فِي الآخِرِ.',
        audioPromptText: 'الشَّجَرَةُ'
      }
    ]
  }
];

export const DEFAULT_AI_GOVERNANCE_RULES: AIGovernanceRules = {
  master_ai_killswitch: false, // يعمل الذكاء الاصطناعي بشكل طبيعي
  student_ai_enabled: true,   // شخصية موسى، المحادثات، التحديات للطلاب
  teacher_ai_enabled: true,   // توليد الألعاب والقصص والتشخيص للمعلمين
  parent_ai_enabled: true,    // التقارير الذكية التوليدية لأولياء الأمور
  updated_at: new Date().toISOString(),
  updated_by: 'super_admin'
};

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
        ai_access_status: (u.ai_access_status === 'allowed' || u.ai_access_status === 'blocked') ? u.ai_access_status : 'inherit',
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

  // 2. الحفظ السحابي عبر upsertUserInSupabase مع مطابقة دقيقة للأعمدة
  try {
    const { data, error } = await upsertUserInSupabase(user);

    if (error) {
      console.error("Supabase Save Error Details:", error.message, error.details, error.hint);
      return { user, error };
    }

    return { user, error: null };
  } catch (err: any) {
    console.error("Supabase Save Exception:", err);
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
      // استخراج ومزامنة إعدادات حوكمة الذكاء الاصطناعي إذا كانت موجودة في السجلات السحابية
      const govRecord = data.find((a: any) => a.id === AI_GOVERNANCE_SYNC_ID || a.title === 'AI_GOVERNANCE_RULES');
      if (govRecord && govRecord.passage) {
        try {
          const parsedGov = JSON.parse(govRecord.passage);
          if (typeof parsedGov.master_ai_killswitch === 'boolean') {
            localStorage.setItem(AI_GOVERNANCE_KEY, JSON.stringify(parsedGov));
          }
        } catch (e) {}
      }

      const formatted: Activity[] = data
        .filter((a: any) => a.id !== AI_GOVERNANCE_SYNC_ID && a.title !== 'AI_GOVERNANCE_RULES')
        .map((a: any) => {
        let actType: ActivityType = (a.activity_type as ActivityType) || 'worksheet';
        let gData: GameData | undefined = a.game_data;

        // استخراج بيانات اللعبة إذا كانت مخزنة في passage أو questions كـ fallback توافقي
        if (!gData && typeof a.passage === 'string' && a.passage.startsWith('__GAME__:')) {
          try {
            const parsed = JSON.parse(a.passage.replace('__GAME__:', ''));
            actType = 'game';
            gData = parsed.gameData || parsed;
          } catch (e) {}
        }
        const questionsList = Array.isArray(a.questions)
          ? a.questions
          : (typeof a.questions === 'string' ? JSON.parse(a.questions) : []);

        if (!gData && questionsList.length > 0 && questionsList[0]?.gameData) {
          actType = 'game';
          gData = questionsList[0].gameData;
        }

        return {
          id: a.id,
          title: a.title,
          activityType: actType,
          gameData: gData,
          description: a.description || undefined,
          passage: a.passage || undefined,
          teacherId: a.teacher_id,
          teacherName: a.teacher_name,
          stage: a.stage,
          grade: a.grade,
          track: a.track,
          questions: questionsList,
          createdAt: a.created_at || new Date().toISOString()
        };
      });
      localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(formatted));
      // حفظ كائنات الألعاب والتحديات في مخزن IndexedDB الدائم دون اتصال
      cacheMultipleGamesOffline(formatted);
      return formatted;
    }
  } catch (err) {
    console.warn('تعذر جلب الأنشطة سحابياً:', err);
  }
  const localActs = getActivities();
  cacheMultipleGamesOffline(localActs);
  return localActs;
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
    const payload: any = {
      id: activity.id,
      title: activity.title,
      description: activity.description || null,
      passage: activity.passage || (activity.gameData ? `__GAME__:${JSON.stringify({ activityType: 'game', gameData: activity.gameData })}` : null),
      teacher_id: activity.teacherId,
      teacher_name: activity.teacherName,
      stage: activity.stage,
      grade: activity.grade,
      track: activity.track,
      questions: activity.gameData
        ? [{ id: 'game_node', text: '__GAME__', type: 'multiple_choice', correctAnswer: '', points: 10, gameData: activity.gameData, activityType: 'game' }]
        : (activity.questions || []),
      created_at: activity.createdAt || new Date().toISOString()
    };

    if (activity.activityType) {
      payload.activity_type = activity.activityType;
    }
    if (activity.gameData) {
      payload.game_data = activity.gameData;
    }

    let { error } = await supabase.from('activities').upsert(payload);
    // إذا كان المخطط لا يدعم activity_type أو description أو game_data نعيد المحاولة بالصيغة التوافقية المضمونة
    if (error && error.message && (error.message.includes('activity_type') || error.message.includes('game_data') || error.message.includes('description'))) {
      delete payload.activity_type;
      delete payload.game_data;
      delete payload.description;
      const retry = await supabase.from('activities').upsert(payload);
      error = retry.error;
    }

    if (error) {
      console.warn('ملاحظة في حفظ النشاط سحابياً:', error.message);
    } else {
      console.log('تم حفظ النشاط/اللعبة سحابياً بنجاح:', activity.title);
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

  // إذا كان التطبيق دون اتصال بالإنترنت (Offline)، يتم فوراً إدراج التسليم في طابور الانتظار المحلي
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  if (isOffline) {
    await enqueueOfflineSubmission(submission);
    return;
  }

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
      console.warn('ملاحظة في رفع التسليم سحابياً، سيتم الحفظ في طابور عدم الاتصال:', error.message);
      await enqueueOfflineSubmission(submission);
    }
  } catch (e) {
    console.warn('فشل رفع التسليم سحابياً، سيتم حفظه في طابور عدم الاتصال:', e);
    await enqueueOfflineSubmission(submission);
  }
};

/**
 * تفريغ ومزامنة طابور التسليمات عند استعادة اتصال الشبكة
 */
export const drainOfflineQueue = async (): Promise<number> => {
  return await syncOfflineSubmissionsQueue(async (sub) => {
    const { error } = await supabase.from('submissions').upsert({
      id: sub.id,
      activity_id: sub.activityId,
      activity_title: sub.activityTitle,
      student_id: sub.studentId,
      student_name: sub.studentName,
      grade: sub.grade || null,
      track: sub.track || null,
      score: sub.score,
      total_points: sub.totalPoints,
      submitted_at: sub.submittedAt,
      answers: sub.answers
    });
    return !error;
  });
};

export const getOfflineSubmissionsQueue = getIndexedDBOfflineQueue;

// تفعيل الاستماع التلقائي لعودة الاتصال
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('🟢 تم رصد استعادة الاتصال بالشبكة، جاري مزامنة طابور التسليمات...');
    drainOfflineQueue();
  });
}

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
      const payload: any = {
        id: badge.id,
        student_id: studentId,
        title: badge.title,
        description: badge.description,
        icon: badge.icon,
        earned_at: badge.earnedAt || new Date().toLocaleDateString('ar-EG')
      };
      if (badge.category) {
        payload.category = badge.category;
      }
      let { error } = await supabase.from('badges').upsert(payload);
      if (error && error.message && error.message.includes('category')) {
        delete payload.category;
        const retry = await supabase.from('badges').upsert(payload);
        error = retry.error;
      }
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
  onGovernanceChange?: (rules: AIGovernanceRules) => void;
  onExamsChange?: () => void;
  onExamSessionsChange?: (payload?: any) => void;
}) => {
  try {
    const channel = supabase
      .channel('lwm-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        callbacks.onUsersChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, (payload: any) => {
        // فحص هل النشاط المعدل هو سجل حوكمة وسياسات الذكاء الاصطناعي
        if (payload?.new && (payload.new.id === AI_GOVERNANCE_SYNC_ID || payload.new.title === 'AI_GOVERNANCE_RULES')) {
          try {
            const rules = JSON.parse(payload.new.passage);
            localStorage.setItem(AI_GOVERNANCE_KEY, JSON.stringify(rules));
            callbacks.onGovernanceChange?.(rules);
          } catch (e) {}
        }
        callbacks.onActivitiesChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        callbacks.onSubmissionsChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'badges' }, () => {
        callbacks.onBadgesChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, () => {
        callbacks.onExamsChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_sessions' }, (payload: any) => {
        callbacks.onExamSessionsChange?.(payload);
      })
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
      } catch (unsubErr) {
        console.warn('Realtime channel.unsubscribe() warning:', unsubErr);
      }
      try {
        supabase.removeChannel(channel);
      } catch (removeErr) {
        console.warn('Realtime supabase.removeChannel() warning:', removeErr);
      }
    };
  } catch (err) {
    console.warn('Realtime subscription error:', err);
    return () => {};
  }
};

// ================= حوكمة وسياسات الذكاء الاصطناعي (Strict Role-Based AI Governance) =================

export const getAIGovernanceRules = (): AIGovernanceRules => {
  try {
    const raw = localStorage.getItem(AI_GOVERNANCE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        master_ai_killswitch: Boolean(parsed.master_ai_killswitch),
        student_ai_enabled: parsed.student_ai_enabled !== false,
        teacher_ai_enabled: parsed.teacher_ai_enabled !== false,
        parent_ai_enabled: parsed.parent_ai_enabled !== false,
        updated_at: parsed.updated_at || new Date().toISOString(),
        updated_by: parsed.updated_by || 'super_admin'
      };
    }
  } catch (e) {
    console.warn('Error reading AI governance rules:', e);
  }
  return { ...DEFAULT_AI_GOVERNANCE_RULES };
};

export const syncAIGovernanceRulesFromCloud = async (): Promise<AIGovernanceRules> => {
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('id', AI_GOVERNANCE_SYNC_ID)
      .maybeSingle();

    if (!error && data && data.passage) {
      const rules = JSON.parse(data.passage);
      if (typeof rules.master_ai_killswitch === 'boolean') {
        const cleaned: AIGovernanceRules = {
          master_ai_killswitch: Boolean(rules.master_ai_killswitch),
          student_ai_enabled: rules.student_ai_enabled !== false,
          teacher_ai_enabled: rules.teacher_ai_enabled !== false,
          parent_ai_enabled: rules.parent_ai_enabled !== false,
          updated_at: rules.updated_at || new Date().toISOString(),
          updated_by: rules.updated_by || 'super_admin'
        };
        localStorage.setItem(AI_GOVERNANCE_KEY, JSON.stringify(cleaned));
        return cleaned;
      }
    }
  } catch (e) {
    console.warn('تعذر استرجاع سياسات الذكاء الاصطناعي سحابياً:', e);
  }
  return getAIGovernanceRules();
};

export const saveAIGovernanceRules = async (rules: AIGovernanceRules, updatedBy: string = 'super_admin'): Promise<{ rules: AIGovernanceRules; error?: any }> => {
  const updatedRules: AIGovernanceRules = {
    ...rules,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy
  };

  // 1. الحفظ الفوري المحلي
  localStorage.setItem(AI_GOVERNANCE_KEY, JSON.stringify(updatedRules));

  // 2. المزامنة السحابية وبث التحديث عبر Supabase Realtime
  try {
    const { data, error } = await supabase.from('activities').upsert({
      id: AI_GOVERNANCE_SYNC_ID,
      title: 'AI_GOVERNANCE_RULES',
      passage: JSON.stringify(updatedRules),
      teacher_id: 'super_admin',
      teacher_name: 'Super Admin',
      stage: 'primary',
      grade: 'grade-1',
      track: 'arabic-a',
      questions: [],
      created_at: new Date().toISOString()
    }, { onConflict: 'id' }).select();

    if (error) {
      console.error('Supabase AI Governance rules upsert error:', error.message);
      return { rules: updatedRules, error };
    }

    console.log('تم حفظ سياسات الذكاء الاصطناعي سحابياً بنجاح:', updatedRules);
    return { rules: updatedRules };
  } catch (err: any) {
    console.error('Supabase AI Governance rules save exception:', err);
    return { rules: updatedRules, error: err };
  }
};

/**
 * فحص هل استخدام الذكاء الاصطناعي مسموح لفئة معينة
 */
export const isAIFeatureAllowed = (role: 'student' | 'teacher' | 'parent'): { allowed: boolean; reason?: string } => {
  const rules = getAIGovernanceRules();

  if (rules.master_ai_killswitch) {
    return {
      allowed: false,
      reason: 'جميع ميزات الذكاء الاصطناعي معطلة حالياً بقرار طارئ من المشرف العام على مستوى المنصة ككل.'
    };
  }

  if (role === 'student' && !rules.student_ai_enabled) {
    return {
      allowed: false,
      reason: 'ميزات التفاعل الصوتي الذكي وتوليد التحديات للطلاب معطلة حالياً بقرار من المشرف العام.'
    };
  }

  if (role === 'teacher' && !rules.teacher_ai_enabled) {
    return {
      allowed: false,
      reason: 'ميزات التوليد الذكي للألعاب والقصص والتشخيص التلقائي للمعلمين معطلة حالياً بقرار من المشرف العام.'
    };
  }

  if (role === 'parent' && !rules.parent_ai_enabled) {
    return {
      allowed: false,
      reason: 'ميزات التقارير الذكية التوليدية لأولياء الأمور معطلة حالياً بقرار من المشرف العام.'
    };
  }

  return { allowed: true };
};

/**
 * دالة مساعدة مركزية لفحص صلاحية استخدام الذكاء الاصطناعي لمستخدم معين مع دعم الاستثناءات الفردية:
 * 1. زر الطوارئ الشامل Master AI Killswitch يمنع الجميع بلا استثناء.
 * 2. إذا كان ai_access_status === 'blocked': يُمنع فوراً بغض النظر عن فئته.
 * 3. إذا كان ai_access_status === 'allowed': يُسمح له حتى لو كانت فئته معطلة.
 * 4. إذا كان 'inherit' أو غير محدد: يتبع الإعداد العام لفئته (student / teacher / parent).
 */
export const canUserUseAI = (
  user?: UserProfile | null,
  systemSettings?: AIGovernanceRules
): { allowed: boolean; reason?: string; overrideStatus: 'inherit' | 'allowed' | 'blocked' } => {
  const rules = systemSettings || getAIGovernanceRules();
  const overrideStatus = user?.ai_access_status || 'inherit';

  // 1. إذا كان زر الطوارئ الشامل مفعلًا: يتم منع الجميع دون استثناء
  if (rules.master_ai_killswitch) {
    return {
      allowed: false,
      reason: 'جميع ميزات الذكاء الاصطناعي معطلة حالياً بقرار طوارئ من المشرف العام على كامل المنصة.',
      overrideStatus
    };
  }

  // 2. إذا كان حظر فردي محدد
  if (overrideStatus === 'blocked') {
    return {
      allowed: false,
      reason: 'تم حظر ميزات الذكاء الاصطناعي عن حسابك بشكل خاص بقرار إداري من المشرف العام.',
      overrideStatus: 'blocked'
    };
  }

  // 3. إذا كان تفعيل استثنائي فردي
  if (overrideStatus === 'allowed') {
    return {
      allowed: true,
      reason: 'تم منحك صلاحية استثنائية فردية لاستخدام الذكاء الاصطناعي من الإدارة.',
      overrideStatus: 'allowed'
    };
  }

  // 4. 'inherit': يتبع القرار العام لفئته
  const role = user?.role;
  if (role === 'student') {
    if (!rules.student_ai_enabled) {
      return {
        allowed: false,
        reason: 'ميزات الذكاء الاصطناعي للطلاب معطلة حالياً في الإعدادات العامة للمنصة.',
        overrideStatus: 'inherit'
      };
    }
  } else if (role === 'teacher' || role === 'hod') {
    if (!rules.teacher_ai_enabled) {
      return {
        allowed: false,
        reason: 'ميزات الذكاء الاصطناعي للمعلمين معطلة حالياً في الإعدادات العامة للمنصة.',
        overrideStatus: 'inherit'
      };
    }
  } else if (role === 'parent') {
    if (!rules.parent_ai_enabled) {
      return {
        allowed: false,
        reason: 'ميزات التقارير الذكية لأولياء الأمور معطلة حالياً في الإعدادات العامة للمنصة.',
        overrideStatus: 'inherit'
      };
    }
  }

  return {
    allowed: true,
    overrideStatus: 'inherit'
  };
};

// ================= نظام إدارة الاختبارات والتقييمات التفاعلية (Exams Hub Storage & Cloud) =================

/**
 * استرجاع الاختبارات محلياً مع تزويد بالبيانات التأسيسية إن وُجد فراغ
 */
export const getExams = (): Exam[] => {
  try {
    const data = localStorage.getItem(EXAMS_KEY);
    if (!data) {
      localStorage.setItem(EXAMS_KEY, JSON.stringify(INITIAL_EXAMS));
      return INITIAL_EXAMS;
    }
    const current: Exam[] = JSON.parse(data);
    let updated = false;
    for (const initExam of INITIAL_EXAMS) {
      if (!current.some(e => e.id === initExam.id)) {
        current.push(initExam);
        updated = true;
      }
    }
    if (updated) {
      localStorage.setItem(EXAMS_KEY, JSON.stringify(current));
    }
    return current;
  } catch {
    return INITIAL_EXAMS;
  }
};

/**
 * مزامنة الاختبارات سحابياً مع Supabase
 */
export const syncExamsFromCloud = async (): Promise<Exam[]> => {
  try {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const cloudExams: Exam[] = data.map((e: any) => ({
        id: e.id,
        title: e.title,
        teacher_id: e.teacher_id,
        teacher_name: e.teacher_name || undefined,
        target_grade: e.target_grade,
        target_track: e.target_track || 'arabic-a',
        duration_minutes: Number(e.duration_minutes) || 0,
        show_results_immediately: e.show_results_immediately !== false,
        is_active: e.is_active !== false,
        questions: Array.isArray(e.questions)
          ? e.questions
          : (typeof e.questions === 'string' ? JSON.parse(e.questions) : []),
        description: e.description || undefined,
        created_at: e.created_at || new Date().toISOString()
      }));

      // دمج الاختبارات التأسيسية
      const map = new Map<string, Exam>();
      for (const init of INITIAL_EXAMS) map.set(init.id, init);
      for (const ce of cloudExams) map.set(ce.id, ce);

      const merged = Array.from(map.values());
      localStorage.setItem(EXAMS_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('تعذر جلب الاختبارات سحابياً، سيتم استخدام التخزين المحلي:', err);
  }
  return getExams();
};

/**
 * حفظ أو تحديث اختبار محلياً وسحابياً في Supabase
 */
export const saveExam = async (exam: Exam): Promise<{ exam: Exam; error?: any }> => {
  const current = getExams();
  const idx = current.findIndex(e => e.id === exam.id);
  if (idx >= 0) {
    current[idx] = exam;
  } else {
    current.unshift(exam);
  }
  localStorage.setItem(EXAMS_KEY, JSON.stringify(current));

  try {
    const { error } = await supabase.from('exams').upsert({
      id: exam.id,
      title: exam.title,
      teacher_id: exam.teacher_id,
      teacher_name: exam.teacher_name || null,
      target_grade: exam.target_grade,
      target_track: exam.target_track || 'arabic-a',
      duration_minutes: exam.duration_minutes || 0,
      show_results_immediately: exam.show_results_immediately,
      is_active: exam.is_active,
      questions: exam.questions || [],
      description: exam.description || null,
      created_at: exam.created_at || new Date().toISOString()
    });

    if (error) {
      console.warn('ملاحظة في حفظ الاختبار سحابياً:', error.message);
      return { exam, error };
    }
    return { exam };
  } catch (err) {
    console.warn('استثناء في حفظ الاختبار سحابياً:', err);
    return { exam, error: err };
  }
};

/**
 * حذف اختبار محلياً وسحابياً
 */
export const deleteExam = async (examId: string): Promise<void> => {
  const current = getExams().filter(e => e.id !== examId);
  localStorage.setItem(EXAMS_KEY, JSON.stringify(current));

  try {
    await supabase.from('exams').delete().eq('id', examId);
    // حذف الجلسات التابعة للاختبار
    await supabase.from('exam_sessions').delete().eq('exam_id', examId);
  } catch (err) {
    console.error('فشل حذف الاختبار سحابياً:', err);
  }
};

// ================= جلسات الاختبار والمراقبة الحية (Exam Sessions & Live Proctoring) =================

/**
 * استرجاع جلسات الاختبارات محلياً
 */
export const getExamSessions = (examId?: string): ExamSession[] => {
  try {
    const data = localStorage.getItem(EXAM_SESSIONS_KEY);
    const sessions: ExamSession[] = data ? JSON.parse(data) : [];
    if (examId) {
      return sessions.filter(s => s.exam_id === examId);
    }
    return sessions;
  } catch {
    return [];
  }
};

/**
 * مزامنة جلسات الاختبارات سحابياً مع Supabase
 */
export const syncExamSessionsFromCloud = async (examId?: string): Promise<ExamSession[]> => {
  try {
    let query = supabase.from('exam_sessions').select('*');
    if (examId) {
      query = query.eq('exam_id', examId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const cloudSessions: ExamSession[] = data.map((s: any) => ({
        id: s.id,
        exam_id: s.exam_id,
        student_id: s.student_id,
        student_name: s.student_name,
        status: s.status,
        start_time: s.start_time,
        end_time: s.end_time || null,
        score: Number(s.score) || 0,
        total_marks: Number(s.total_marks) || 0,
        answers: typeof s.answers === 'object' && s.answers !== null ? s.answers : {},
        tab_switch_count: Number(s.tab_switch_count) || 0,
        created_at: s.created_at || undefined
      }));

      // تحديث التخزين المحلي
      const allLocal = getExamSessions();
      const localMap = new Map<string, ExamSession>();
      allLocal.forEach(s => localMap.set(s.id, s));
      cloudSessions.forEach(s => localMap.set(s.id, s));

      const merged = Array.from(localMap.values());
      localStorage.setItem(EXAM_SESSIONS_KEY, JSON.stringify(merged));

      if (examId) {
        return merged.filter(s => s.exam_id === examId);
      }
      return merged;
    }
  } catch (err) {
    console.warn('تعذر جلب جلسات الاختبار سحابياً:', err);
  }
  return getExamSessions(examId);
};

/**
 * حفظ جلسة اختبار محلياً وسحابياً
 */
export const saveExamSession = async (session: ExamSession): Promise<{ session: ExamSession; error?: any }> => {
  const all = getExamSessions();
  const idx = all.findIndex(s => s.id === session.id);
  if (idx >= 0) {
    all[idx] = session;
  } else {
    all.unshift(session);
  }
  localStorage.setItem(EXAM_SESSIONS_KEY, JSON.stringify(all));

  try {
    const { error } = await supabase.from('exam_sessions').upsert({
      id: session.id,
      exam_id: session.exam_id,
      student_id: session.student_id,
      student_name: session.student_name,
      status: session.status,
      start_time: session.start_time,
      end_time: session.end_time || null,
      score: session.score,
      total_marks: session.total_marks,
      answers: session.answers,
      tab_switch_count: session.tab_switch_count
    });

    if (error) {
      console.warn('ملاحظة في حفظ جلسة الاختبار سحابياً:', error.message);
      return { session, error };
    }
    return { session };
  } catch (err) {
    console.warn('استثناء في رفع جلسة الاختبار سحابياً:', err);
    return { session, error: err };
  }
};

/**
 * تحديث حالة الجلسة أو بياناتها بشكل جزئي
 */
export const updateStudentExamSession = async (
  sessionId: string, 
  updates: Partial<ExamSession>
): Promise<ExamSession | null> => {
  const all = getExamSessions();
  const idx = all.findIndex(s => s.id === sessionId);
  if (idx === -1) return null;

  const updated: ExamSession = { ...all[idx], ...updates };
  all[idx] = updated;
  localStorage.setItem(EXAM_SESSIONS_KEY, JSON.stringify(all));

  try {
    await supabase.from('exam_sessions').update({
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.end_time !== undefined ? { end_time: updates.end_time } : {}),
      ...(updates.score !== undefined ? { score: updates.score } : {}),
      ...(updates.total_marks !== undefined ? { total_marks: updates.total_marks } : {}),
      ...(updates.answers !== undefined ? { answers: updates.answers } : {}),
      ...(updates.tab_switch_count !== undefined ? { tab_switch_count: updates.tab_switch_count } : {})
    }).eq('id', sessionId);
  } catch (e) {
    console.warn('خطأ في تحديث الجلسة سحابياً:', e);
  }

  return updated;
};

/**
 * إيقاف الاختبار فورياً عن الطالب من قبل المعلم (Force Stop Exam)
 */
export const forceStopStudentExam = async (sessionId: string): Promise<void> => {
  await updateStudentExamSession(sessionId, {
    status: 'force_stopped',
    end_time: new Date().toISOString()
  });
};

/**
 * تسجيل وتحديث عداد مغادرة التبويب (Tab-Switch Increment)
 */
export const incrementTabSwitchCount = async (sessionId: string): Promise<number> => {
  const all = getExamSessions();
  const session = all.find(s => s.id === sessionId);
  const currentCount = session ? (session.tab_switch_count || 0) : 0;
  const newCount = currentCount + 1;

  await updateStudentExamSession(sessionId, {
    tab_switch_count: newCount
  });

  return newCount;
};

