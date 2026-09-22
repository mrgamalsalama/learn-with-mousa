import { UserProfile, Activity, ActivityType, GameData, StudentSubmission, StoryBankItem, BookItem, ChildBadge, ChildPhonicsRecord, AIGovernanceRules, Exam, ExamSession, ExamQuestion, DelegatedAdminPermissions, DEFAULT_DELEGATED_PERMISSIONS, TeacherTask, PadletBoard, PadletPost, PadletComment, PadletTheme, PadletCardColor, ChallengeQuiz, ChallengeRoom, ChallengeQuestion, ChallengePlayer, LiveClassSession } from './types';
import { INITIAL_BOOKS } from './booksData';
import { INITIAL_CHALLENGE_QUIZZES } from './data/challengeData';
import { supabase, upsertUserInSupabase } from './supabaseClient';
import { canManageTeacherTasks, sanitizeDelegatedPermissions } from './utils/permissions';
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
export const TEACHER_TASKS_KEY = 'lwm_teacher_tasks';
export const TEACHER_TASKS_SYNC_ID = 'teacher_tasks_sync';
export const DELEGATED_PERMISSIONS_SYNC_ID = 'delegated_permissions_sync';
export const PADLET_BOARDS_KEY = 'lwm_padlet_boards';
export const PADLET_POSTS_KEY = 'lwm_padlet_posts';
export const CHALLENGE_QUIZZES_KEY = 'lwm_challenge_quizzes';
export const CHALLENGE_ROOMS_KEY = 'lwm_challenge_rooms';
export const LIVE_CLASS_SESSIONS_KEY = 'lwm_live_class_sessions';
export const LIVE_CLASS_SYNC_ID = 'live_class_sync';

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
    delegated_admin_permissions: { ...DEFAULT_DELEGATED_PERMISSIONS },
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
    delegated_admin_permissions: { ...DEFAULT_DELEGATED_PERMISSIONS },
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
    delegated_admin_permissions: { ...DEFAULT_DELEGATED_PERMISSIONS },
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
    delegated_admin_permissions: { ...DEFAULT_DELEGATED_PERMISSIONS },
  },
  {
    id: 'usr_parent',
    name: 'الأستاذ عمر (ولي أمر موسى)',
    username: 'parent',
    password: '123',
    role: 'parent',
    studentId: 'usr_student_mousa',
    loginCount: 6,
    delegated_admin_permissions: { ...DEFAULT_DELEGATED_PERMISSIONS },
  }
];

export const INITIAL_TEACHER_TASKS: TeacherTask[] = [
  {
    id: 'task_demo_1',
    teacherId: 'usr_teacher',
    teacherName: 'الأستاذة فاطمة الزهراء',
    title: 'مراجعة وتدقيق أنشطة الوعي الصوتي والمدود للصف الأول',
    description: 'يرجى مراجعة وتدقيق أسئلة وبنك أنشطة مهارات الوعي الصوتي لطلاب الصف الأول والتحقق من التشكيل التام بالحركات قبل نهاية الأسبوع.',
    dueDate: '2026-09-25',
    priority: 'high',
    completed: false,
    assignedBy: 'د. أحمد المنصوري',
    assignedByRole: 'hod',
    createdAt: new Date().toISOString()
  },
  {
    id: 'task_demo_2',
    teacherId: 'usr_teacher',
    teacherName: 'الأستاذة فاطمة الزهراء',
    title: 'إسناد قصة الأسبوع من المستودع القرائي',
    description: 'يرجى الدخول إلى المستودع القرائي واختيار قصة الأسبوع الملائمة لطلاب الصف الثاني وتكليفهم بقراءتها مع نشاط تقييمي.',
    dueDate: '2026-09-28',
    priority: 'medium',
    completed: true,
    completedAt: '٢٠٢٦/٠٩/١٩ ١٠:٣٠ ص',
    assignedBy: 'المشرف العام',
    assignedByRole: 'super_admin',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
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

    // استرجاع خريطة الصلاحيات المفوضة من قناة المزامنة السحابية
    let cloudDelegatedMap: Record<string, DelegatedAdminPermissions> = {};
    try {
      const { data: actData } = await supabase
        .from('activities')
        .select('passage')
        .eq('id', DELEGATED_PERMISSIONS_SYNC_ID)
        .maybeSingle();
      if (actData?.passage) {
        cloudDelegatedMap = JSON.parse(actData.passage);
      }
    } catch (e) {
      console.warn('تعذر استرجاع خريطة الصلاحيات المفوضة سحابياً:', e);
    }

    if (Array.isArray(data)) {
      // إعادة تحويل Snake_Case إلى CamelCase مع ضمان تطهير الصلاحيات المفوضة
      const cloudUsers: UserProfile[] = data.map((u: any) => {
        const userDelegated = sanitizeDelegatedPermissions(
          cloudDelegatedMap[u.id] || u.delegated_admin_permissions
        );

        return {
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
          delegated_admin_permissions: userDelegated,
          allowedGrades: Array.isArray(u.allowed_grades) ? u.allowed_grades : [],
          allowedStages: Array.isArray(u.allowed_stages) ? u.allowed_stages : (u.stage ? [u.stage] : ['primary']),
          allowedTracks: Array.isArray(u.allowed_tracks) ? u.allowed_tracks : ['arabic-a'],
          loginCount: u.login_count || 0,
          lastLogin: u.last_login || undefined,
          avatar: u.avatar || undefined,
          email: u.email || undefined,
          timezone: u.timezone || undefined,
          preferences: u.preferences || undefined
        };
      });

      // الحفاظ على الحسابات الافتراضية التجريبية
      const mergedMap = new Map<string, UserProfile>();
      for (const initUser of INITIAL_USERS) {
        mergedMap.set(initUser.username.toLowerCase(), {
          ...initUser,
          delegated_admin_permissions: sanitizeDelegatedPermissions(
            cloudDelegatedMap[initUser.id] || initUser.delegated_admin_permissions
          )
        });
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

  // التأكد الصارم من أن كل مستخدم يمتلك كائن delegated_admin_permissions بقيم افتراضية false
  for (const u of currentList) {
    if (!u.delegated_admin_permissions) {
      u.delegated_admin_permissions = { ...DEFAULT_DELEGATED_PERMISSIONS };
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

/**
 * حفظ واستيراد دفعة من الطلاب (Bulk Students Upsert) لمنع التكرار وتحديث البيانات فورياً
 */
export const saveStudentsBulk = async (newStudents: UserProfile[]): Promise<{ count: number; error?: any }> => {
  if (!newStudents || newStudents.length === 0) {
    return { count: 0 };
  }

  // 1. تحديث التخزين المحلي فوراً
  const users = getUsers();
  let updatedCount = 0;

  for (const st of newStudents) {
    const existingIdx = users.findIndex(
      u => u.id === st.id || (st.username && u.username.toLowerCase() === st.username.toLowerCase())
    );
    if (existingIdx >= 0) {
      users[existingIdx] = { ...users[existingIdx], ...st };
    } else {
      users.push(st);
    }
    updatedCount++;
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // 2. الحفظ السحابي في Supabase لجميع الطلاب
  try {
    for (const st of newStudents) {
      await upsertUserInSupabase(st);
    }
    return { count: updatedCount, error: null };
  } catch (err: any) {
    console.error('فشل حفظ بعض الطلاب سحابياً في الاستيراد الجماعي:', err);
    return { count: updatedCount, error: err };
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

// ================= تفويض صلاحيات الإدارة العليا (Admin Delegation) =================

export const saveUserDelegatedPermissions = async (
  userId: string,
  rawPermissions: DelegatedAdminPermissions,
  adminUser: UserProfile
): Promise<{ user: UserProfile; error?: any }> => {
  if (adminUser.role !== 'super_admin') {
    return {
      user: {} as UserProfile,
      error: new Error('عفواً، تفويض الصلاحيات الإدارية محصور في صلاحيات المشرف العام حصرياً.')
    };
  }

  const permissions = sanitizeDelegatedPermissions(rawPermissions);
  const users = getUsers();
  const targetUserIdx = users.findIndex(u => u.id === userId);
  if (targetUserIdx < 0) {
    return { user: {} as UserProfile, error: new Error('المستخدم غير موجود') };
  }

  const updatedUser: UserProfile = {
    ...users[targetUserIdx],
    delegated_admin_permissions: permissions
  };

  users[targetUserIdx] = updatedUser;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // تحديث المستخدم الحالي إن كان هو نفسه المستخدم المعدل
  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updatedUser);
  }

  // حفظ في Supabase جدول users
  try {
    await upsertUserInSupabase(updatedUser);
  } catch (e) {
    console.warn('Upsert user in supabase error during permission delegation:', e);
  }

  // حفظ في سجل المزامنة السحابية activities لإطلاق إشعار Realtime لجميع النوافذ والمستخدمين المتصلين
  try {
    let cloudMap: Record<string, DelegatedAdminPermissions> = {};
    const { data: actData } = await supabase
      .from('activities')
      .select('passage')
      .eq('id', DELEGATED_PERMISSIONS_SYNC_ID)
      .maybeSingle();

    if (actData?.passage) {
      try {
        cloudMap = JSON.parse(actData.passage);
      } catch (err) {}
    }

    cloudMap[userId] = permissions;

    await supabase.from('activities').upsert({
      id: DELEGATED_PERMISSIONS_SYNC_ID,
      title: 'DELEGATED_PERMISSIONS_MAP',
      passage: JSON.stringify(cloudMap),
      teacher_id: adminUser.id,
      teacher_name: adminUser.name,
      stage: 'primary',
      grade: 'grade-1',
      track: 'arabic-a',
      questions: [],
      created_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {
    console.error('فشل بث تفويض الصلاحيات سحابياً:', e);
  }

  return { user: updatedUser };
};

// ================= مهام وتكليفات المعلمين (Teacher Tasks) =================

export const getTeacherTasks = (): TeacherTask[] => {
  const data = localStorage.getItem(TEACHER_TASKS_KEY);
  if (!data) {
    localStorage.setItem(TEACHER_TASKS_KEY, JSON.stringify(INITIAL_TEACHER_TASKS));
    return INITIAL_TEACHER_TASKS;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_TEACHER_TASKS;
  }
};

export const syncTeacherTasksFromCloud = async (): Promise<TeacherTask[]> => {
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('passage')
      .eq('id', TEACHER_TASKS_SYNC_ID)
      .maybeSingle();

    if (error) {
      console.warn('فشل مزامنة مهام المعلمين سحابياً:', error.message);
      return getTeacherTasks();
    }

    if (data?.passage) {
      const cloudTasks: TeacherTask[] = JSON.parse(data.passage);
      localStorage.setItem(TEACHER_TASKS_KEY, JSON.stringify(cloudTasks));
      return cloudTasks;
    }
  } catch (e) {
    console.warn('استثناء أثناء مزامنة مهام المعلمين:', e);
  }
  return getTeacherTasks();
};

export const saveTeacherTask = async (
  task: TeacherTask,
  actorUser: UserProfile
): Promise<{ task: TeacherTask; error?: any }> => {
  if (!canManageTeacherTasks(actorUser)) {
    return {
      task,
      error: new Error('عفواً، ليس لديك صلاحية لإضافة أو تعديل مهام المعلمين (محصورة في الإدارة ورئيس القسم).')
    };
  }

  const tasks = getTeacherTasks();
  const existingIdx = tasks.findIndex(t => t.id === task.id);
  if (existingIdx >= 0) {
    tasks[existingIdx] = task;
  } else {
    tasks.unshift(task);
  }
  localStorage.setItem(TEACHER_TASKS_KEY, JSON.stringify(tasks));

  // بث التحديث سحابياً
  try {
    await supabase.from('activities').upsert({
      id: TEACHER_TASKS_SYNC_ID,
      title: 'TEACHER_TASKS_DATA',
      passage: JSON.stringify(tasks),
      teacher_id: actorUser.id,
      teacher_name: actorUser.name,
      stage: 'primary',
      grade: 'grade-1',
      track: 'arabic-a',
      questions: [],
      created_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('فشل حفظ مهام المعلمين سحابياً:', e);
  }

  return { task };
};

export const deleteTeacherTask = async (
  taskId: string,
  actorUser: UserProfile
): Promise<{ success: boolean; error?: any }> => {
  if (!canManageTeacherTasks(actorUser)) {
    return {
      success: false,
      error: new Error('عفواً، لا يملك المعلم صلاحية حذف المهام (محصورة في الإدارة العليا ورئيس القسم).')
    };
  }

  const tasks = getTeacherTasks().filter(t => t.id !== taskId);
  localStorage.setItem(TEACHER_TASKS_KEY, JSON.stringify(tasks));

  try {
    await supabase.from('activities').upsert({
      id: TEACHER_TASKS_SYNC_ID,
      title: 'TEACHER_TASKS_DATA',
      passage: JSON.stringify(tasks),
      teacher_id: actorUser.id,
      teacher_name: actorUser.name,
      stage: 'primary',
      grade: 'grade-1',
      track: 'arabic-a',
      questions: [],
      created_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('فشل تحديث حذف مهام المعلمين سحابياً:', e);
  }

  return { success: true };
};

export const toggleTeacherTaskCompleted = async (
  taskId: string,
  actingUserId: string
): Promise<TeacherTask | null> => {
  const tasks = getTeacherTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  task.completed = !task.completed;
  task.completedAt = task.completed
    ? new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : undefined;

  localStorage.setItem(TEACHER_TASKS_KEY, JSON.stringify(tasks));

  try {
    await supabase.from('activities').upsert({
      id: TEACHER_TASKS_SYNC_ID,
      title: 'TEACHER_TASKS_DATA',
      passage: JSON.stringify(tasks),
      teacher_id: actingUserId,
      teacher_name: 'User',
      stage: 'primary',
      grade: 'grade-1',
      track: 'arabic-a',
      questions: [],
      created_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('فشل تحديث حالة إكمال المهمة سحابياً:', e);
  }

  return task;
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

export const INITIAL_STUDENT_SUBMISSIONS: StudentSubmission[] = [
  {
    id: 'sub_demo_phonics_1',
    activityId: 'act_phonics_1',
    activityTitle: 'مغامرة كنز الأصوات: المدود الطويلة والحركات القصيرة 🎶',
    studentId: 'usr_student_mousa',
    studentName: 'موسى البطل 🌟',
    grade: 'grade-1',
    track: 'arabic-a',
    score: 10,
    totalPoints: 10,
    submittedAt: '2026-09-21 10:30',
    answers: {},
    gameType: 'phonics_treasure',
    targetSkill: 'الوعي الصوتي والفونيمات'
  },
  {
    id: 'sub_demo_spelling_1',
    activityId: 'act_spelling_1',
    activityTitle: 'تحدي اللام الشمسية واللام القمرية ورسم الهمزات ☀️🌙',
    studentId: 'usr_student_mousa',
    studentName: 'موسى البطل 🌟',
    grade: 'grade-1',
    track: 'arabic-a',
    score: 9,
    totalPoints: 10,
    submittedAt: '2026-09-21 11:15',
    answers: {},
    gameType: 'category_sorter',
    targetSkill: 'الإملاء والظواهر الكتابية'
  },
  {
    id: 'sub_demo_grammar_1',
    activityId: 'act_grammar_1',
    activityTitle: 'بناء الجمل المفيدة: الفعل والفاعل والمبتدأ والخبر 🧩',
    studentId: 'usr_student_mousa',
    studentName: 'موسى البطل 🌟',
    grade: 'grade-1',
    track: 'arabic-a',
    score: 8,
    totalPoints: 10,
    submittedAt: '2026-09-22 09:00',
    answers: {},
    gameType: 'sentence_builder',
    targetSkill: 'القواعد والتراكيب اللغوية'
  },
  {
    id: 'sub_demo_reading_1',
    activityId: 'act_reading_1',
    activityTitle: 'استيعاب وفهم قصة: الأرنب الذكي والسلحفاة الصبورة 📖',
    studentId: 'usr_student_mousa',
    studentName: 'موسى البطل 🌟',
    grade: 'grade-1',
    track: 'arabic-a',
    score: 9,
    totalPoints: 10,
    submittedAt: '2026-09-22 09:45',
    answers: {},
    gameType: 'story_quest',
    targetSkill: 'الفهم القرائي والاستيعاب'
  }
];

export const getSubmissions = (): StudentSubmission[] => {
  const data = localStorage.getItem(SUBMISSIONS_KEY);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(INITIAL_STUDENT_SUBMISSIONS));
  return INITIAL_STUDENT_SUBMISSIONS;
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
  onTeacherTasksChange?: (tasks: TeacherTask[]) => void;
  onDelegatedPermissionsChange?: (map: Record<string, DelegatedAdminPermissions>) => void;
  onPadletBoardsChange?: () => void;
  onPadletPostsChange?: (payload?: any) => void;
  onLiveClassChange?: (sessions: LiveClassSession[]) => void;
}) => {
  try {
    const channel = supabase
      .channel('lwm-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        callbacks.onUsersChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, (payload: any) => {
        // فحص هل النشاط المعدل هو جلسات الحصة المباشرة
        if (payload?.new && (payload.new.id === LIVE_CLASS_SYNC_ID || payload.new.title === 'LIVE_CLASS_SESSIONS')) {
          try {
            const sessions: LiveClassSession[] = JSON.parse(payload.new.passage);
            localStorage.setItem(LIVE_CLASS_SESSIONS_KEY, JSON.stringify(sessions));
            callbacks.onLiveClassChange?.(sessions);
          } catch (e) {}
        }

        // فحص هل النشاط المعدل هو سجل حوكمة وسياسات الذكاء الاصطناعي
        if (payload?.new && (payload.new.id === AI_GOVERNANCE_SYNC_ID || payload.new.title === 'AI_GOVERNANCE_RULES')) {
          try {
            const rules = JSON.parse(payload.new.passage);
            localStorage.setItem(AI_GOVERNANCE_KEY, JSON.stringify(rules));
            callbacks.onGovernanceChange?.(rules);
          } catch (e) {}
        }

        // فحص هل النشاط المعدل هو سجل مهام وتكليفات المعلمين
        if (payload?.new && (payload.new.id === TEACHER_TASKS_SYNC_ID || payload.new.title === 'TEACHER_TASKS_DATA')) {
          try {
            const tasks: TeacherTask[] = JSON.parse(payload.new.passage);
            localStorage.setItem(TEACHER_TASKS_KEY, JSON.stringify(tasks));
            callbacks.onTeacherTasksChange?.(tasks);
          } catch (e) {}
        }

        // فحص هل النشاط المعدل هو خريطة تفويض الصلاحيات الإدارية
        if (payload?.new && (payload.new.id === DELEGATED_PERMISSIONS_SYNC_ID || payload.new.title === 'DELEGATED_PERMISSIONS_MAP')) {
          try {
            const permsMap: Record<string, DelegatedAdminPermissions> = JSON.parse(payload.new.passage);
            const users = getUsers();
            let changed = false;
            users.forEach(u => {
              if (permsMap[u.id]) {
                u.delegated_admin_permissions = sanitizeDelegatedPermissions(permsMap[u.id]);
                changed = true;
              }
            });
            if (changed) {
              localStorage.setItem(USERS_KEY, JSON.stringify(users));
              const current = getCurrentUser();
              if (current && permsMap[current.id]) {
                setCurrentUser({ ...current, delegated_admin_permissions: sanitizeDelegatedPermissions(permsMap[current.id]) });
              }
            }
            callbacks.onDelegatedPermissionsChange?.(permsMap);
            callbacks.onUsersChange?.();
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'padlet_boards' }, () => {
        callbacks.onPadletBoardsChange?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'padlet_posts' }, (payload: any) => {
        callbacks.onPadletPostsChange?.(payload);
      })
      .on('broadcast', { event: 'live_session_update' }, (payload: any) => {
        const update = payload?.payload;
        if (update) {
          const sessions = getLiveClassSessions();
          if (update.isActive) {
            const idx = sessions.findIndex(s => s.id === update.id);
            if (idx >= 0) sessions[idx] = update;
            else sessions.unshift(update);
          } else {
            const idx = sessions.findIndex(s => s.id === update.id);
            if (idx >= 0) sessions.splice(idx, 1);
          }
          const activeOnly = sessions.filter(s => s.isActive);
          localStorage.setItem(LIVE_CLASS_SESSIONS_KEY, JSON.stringify(activeOnly));
          callbacks.onLiveClassChange?.(activeOnly);
        }
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
    let res = await supabase
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });

    // في حال تعذر الترتيب بسبب عدم وجود عمود created_at، تتم المحاولة بدون ترتيب
    if (res.error) {
      res = await supabase.from('exams').select('*');
    }

    const { data, error } = res;

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
        created_at: e.created_at || new Date().toISOString(),
        is_scheduled: e.is_scheduled === true,
        scheduled_start: e.scheduled_start || null,
        scheduled_end: e.scheduled_end || null
      }));

      // دمج الاختبارات: التأسيسية أولاً، ثم المحلية الموجودة، ثم السحابية (السحابية تسبق وتحدث البيانات)
      const currentLocal = getExams();
      const map = new Map<string, Exam>();
      for (const init of INITIAL_EXAMS) map.set(init.id, init);
      for (const loc of currentLocal) map.set(loc.id, loc);
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
 * حفظ أو تحديث اختبار محلياً وسحابياً في Supabase مع تكيف تلقائي للأعمدة المفقودة
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
    const payload: Record<string, any> = {
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
      created_at: exam.created_at || new Date().toISOString(),
      is_scheduled: exam.is_scheduled === true,
      scheduled_start: exam.scheduled_start || null,
      scheduled_end: exam.scheduled_end || null
    };

    let lastError: any = null;
    let success = false;

    // حلقة محاولات متكيفة: إذا كان جدول exams في سوبابيز يفتقد أي عمود اختياري (مثل description أو is_scheduled)
    // نقوم باستبعاد العمود المفقود تلقائياً وإعادة الحفظ حتى ينجح تخزين الاختبار وظهوره للطلاب
    for (let attempt = 0; attempt < 8; attempt++) {
      const { error } = await supabase.from('exams').upsert(payload);
      if (!error) {
        success = true;
        lastError = null;
        break;
      }

      lastError = error;
      const message = error.message || '';

      // استخراج اسم العمود المفقود في سوبابيز
      // مثال PostgREST: Could not find the 'description' column of 'exams' in the schema cache
      // مثال Postgres: column "description" of relation "exams" does not exist
      const match = message.match(/Could not find the '([^']+)' column/i) ||
                    message.match(/column "([^"]+)" of relation "exams" does not exist/i);

      if (match && match[1] && match[1] in payload) {
        const missingCol = match[1];
        console.warn(`العمود (${missingCol}) غير موجود في جدول exams بسوبابيز، جاري إعادة المحاولة بدونه تلقائياً...`);
        delete payload[missingCol];
      } else {
        console.warn('ملاحظة في حفظ الاختبار سحابياً:', message);
        break;
      }
    }

    if (!success && lastError) {
      return { exam, error: lastError };
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
    const payload: Record<string, any> = {
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
    };

    let lastError: any = null;
    let saved = false;

    for (let attempt = 0; attempt < 6; attempt++) {
      const { error } = await supabase.from('exam_sessions').upsert(payload);
      if (!error) {
        saved = true;
        lastError = null;
        break;
      }

      lastError = error;
      const message = error.message || '';
      const match = message.match(/Could not find the '([^']+)' column/i) ||
                    message.match(/column "([^"]+)" of relation "exam_sessions" does not exist/i);

      if (match && match[1] && match[1] in payload) {
        console.warn(`العمود (${match[1]}) غير موجود في جدول exam_sessions بسوبابيز، جاري الاستبعاد وإعادة المحاولة...`);
        delete payload[match[1]];
      } else {
        break;
      }
    }

    if (!saved && lastError) {
      console.warn('ملاحظة في حفظ جلسة الاختبار سحابياً:', lastError.message);
      return { session, error: lastError };
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

// ================= نظام الجدار التعاوني التفاعلي (Interactive Padlet-like Wall) =================

export const INITIAL_PADLET_BOARDS: PadletBoard[] = [
  {
    id: 'board_grade1_demo',
    title: 'جِدَارُ أَبْطَالِ الصَّفِّ الأَوَّلِ: رِحْلَةُ الإِبْدَاعِ وَالحُرُوفِ 🌟',
    description: 'شاركونا أحبائي الصغار كلماتكم الجميلة، تسجيلاتكم الصوتية، ورسوماتكم الرائعة مع حرف الباء وحروفنا الساحرة!',
    teacher_id: 'usr_teacher',
    teacher_name: 'الأستاذة فاطمة الزهراء',
    grade: 'grade-1',
    target_grade: 'grade-1',
    color: 'yellow',
    track: 'arabic-a',
    theme: 'corkboard',
    allow_comments: true,
    require_approval: false,
    is_locked: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  }
];

export const INITIAL_PADLET_POSTS: PadletPost[] = [
  {
    id: 'post_teacher_welcome',
    board_id: 'board_grade1_demo',
    author_id: 'usr_teacher',
    author_name: 'الأستاذة فاطمة الزهراء 👩‍🏫',
    author_role: 'teacher',
    content: 'أَهْلاً وَمَرْحَباً بِكُمْ يَا عَبَاقِرَةَ الغَدِ فِي جِدَارِنَا التَّفَاعُلِيِّ! 🎈 انْقُرُوا عَلَى زِرِّ (+) لِمُشَارَكَةِ أَفْكَارِكُمْ أَوْ تَسْجِيلِ أَصْوَاتِكُمْ العَذْبَةِ.',
    color: 'yellow',
    content_type: 'text',
    status: 'approved',
    likes_count: 5,
    liked_by: ['usr_student_mousa', 'usr_student_haroon'],
    comments: [
      {
        id: 'c_demo_1',
        authorId: 'usr_student_mousa',
        authorName: 'مُوسَى البَطَل',
        authorRole: 'student',
        text: 'شُكْراً يَا مُعَلِّمَتِي الحَبِيبَةَ! أَنَا مُتَحَمِّسٌ جِدّاً لِلْمُشَارَكَةِ! 🌟',
        createdAt: 'منذ قليل'
      }
    ],
    created_at: new Date(Date.now() - 7200000).toISOString(),
    pinned: true,
  },
  {
    id: 'post_mousa_sample',
    board_id: 'board_grade1_demo',
    author_id: 'usr_student_mousa',
    author_name: 'مُوسَى البَطَل 🌟',
    author_role: 'student',
    content: 'كَتَبْتُ كَلِمَةَ: (بَابٌ نَظِيفٌ) مَعَ الحَرَكَاتِ وَالتَّنْوِينِ! 🚪✨',
    color: 'mint',
    content_type: 'text',
    status: 'approved',
    likes_count: 4,
    liked_by: ['usr_teacher', 'usr_student_haroon'],
    comments: [
      {
        id: 'c_demo_2',
        authorId: 'usr_teacher',
        authorName: 'الأستاذة فاطمة الزهراء',
        authorRole: 'teacher',
        text: 'أَحْسَنْتَ يَا مُوسَى! خَطٌّ وَإِمْلَاءٌ فِي غَايَةِ الجَمَالِ 👏',
        createdAt: 'منذ قليل'
      }
    ],
    created_at: new Date(Date.now() - 3600000).toISOString(),
    pinned: false,
  }
];

export const getPadletBoards = (): PadletBoard[] => {
  const data = localStorage.getItem(PADLET_BOARDS_KEY);
  if (!data) {
    localStorage.setItem(PADLET_BOARDS_KEY, JSON.stringify(INITIAL_PADLET_BOARDS));
    return INITIAL_PADLET_BOARDS;
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : INITIAL_PADLET_BOARDS;
  } catch {
    return INITIAL_PADLET_BOARDS;
  }
};

export const getPadletBoardById = (boardId: string): PadletBoard | null => {
  const boards = getPadletBoards();
  return boards.find(b => b.id === boardId) || null;
};

/**
 * توحيد صيغة الصف الدراسي لمطابقة مختلف التسميات
 * مثل: "1"، "grade-1"، "الصف الأول"، "الاول"، "أول" -> "grade-1"
 * و "all"، "عام"، "الكل"، "جميع الصفوف" -> "all"
 */
export const normalizeGrade = (raw?: string | null): string => {
  if (!raw) return '';
  let str = String(raw).trim().toLowerCase();
  // تحويل الأرقام المشرقية / الهندية إلى أرقام لاتينية
  str = str
    .replace(/٠/g, '0')
    .replace(/١/g, '1')
    .replace(/٢/g, '2')
    .replace(/٣/g, '3')
    .replace(/٤/g, '4')
    .replace(/٥/g, '5')
    .replace(/٦/g, '6')
    .replace(/٧/g, '7')
    .replace(/٨/g, '8')
    .replace(/٩/g, '9');

  if (
    str.includes('all') || 
    str.includes('عام') || 
    str.includes('الكل') || 
    str.includes('جميع') ||
    str === '*'
  ) {
    return 'all';
  }

  if (str.includes('kg') || str.includes('روض') || str.includes('تمهيد')) {
    return 'kg';
  }

  if (str.includes('12') || str.includes('ثاني عشر') || str.includes('ثاني-عشر')) return 'grade-12';
  if (str.includes('11') || str.includes('حادي عشر') || str.includes('حادي-عشر')) return 'grade-11';
  if (str.includes('10') || str.includes('عاشر')) return 'grade-10';
  if (str.includes('9') || str.includes('تاسع')) return 'grade-9';
  if (str.includes('8') || str.includes('ثامن')) return 'grade-8';
  if (str.includes('7') || str.includes('سابع')) return 'grade-7';
  if (str.includes('6') || str.includes('سادس')) return 'grade-6';
  if (str.includes('5') || str.includes('خامس')) return 'grade-5';
  if (str.includes('4') || str.includes('رابع')) return 'grade-4';
  if (str.includes('3') || str.includes('ثالث')) return 'grade-3';
  if (str.includes('2') || str.includes('ثاني')) return 'grade-2';
  if (str.includes('1') || str.includes('أول') || str.includes('اول')) return 'grade-1';

  return str;
};

/**
 * التحقق من مطابقة الحائط التفاعلي لصف الطالب
 * يضمن ظهور الحوائط المتوافقة مع صف الطالب أو الحوائط العامة للجميع
 */
export const isGradeMatching = (boardGrade?: string | null, studentGrade?: string | null): boolean => {
  const normBoard = normalizeGrade(boardGrade);
  const normStudent = normalizeGrade(studentGrade);
  // الحوائط العامة لجميع الصفوف تظهر لجميع الطلاب
  if (!normBoard || normBoard === 'all' || normBoard === 'general') return true;
  if (!normStudent) return true;
  return normBoard === normStudent;
};

export const savePadletBoard = async (board: PadletBoard): Promise<{ board: PadletBoard; error?: any }> => {
  const boards = getPadletBoards();
  const index = boards.findIndex(b => b.id === board.id);
  if (index >= 0) {
    boards[index] = board;
  } else {
    boards.unshift(board);
  }
  localStorage.setItem(PADLET_BOARDS_KEY, JSON.stringify(boards));
  window.dispatchEvent(new CustomEvent('padlet_boards_updated'));

  // إعداد حقول الحفظ مع إرسال القيم بجميع التسميات المحتملة لدعم أي إصدار من جدول Supabase
  const boardData: any = {
    id: board.id,
    title: board.title || 'حائط تفاعلي',
    description: board.description || null,
    teacher_id: board.teacher_id || 'usr_teacher',
    teacher_name: board.teacher_name || 'معلم المادة',
    grade: board.grade || 'grade-1',
    target_grade: board.target_grade || board.grade || 'grade-1',
    color: board.color || 'yellow',
    track: board.track || 'arabic-a',
    theme: board.theme || 'corkboard',
    background_theme: board.theme || 'chalkboard',
    allow_comments: board.allow_comments ?? true,
    allow_student_comments: board.allow_comments ?? true,
    require_approval: board.require_approval ?? false,
    is_locked: board.is_locked ?? false,
    is_active: true,
    created_at: board.created_at || new Date().toISOString()
  };

  try {
    let { error } = await supabase.from('padlet_boards').upsert(boardData, { onConflict: 'id' });
    if (error) {
      console.warn('ملاحظة أثناء مزامنة لوحة الحائط مع Supabase:', error);
      // في حال وجود تعارض أو نقص أعمدة، نقوم بتنظيف الحقول وإعادة المحاولة
      if (error.code === 'PGRST204' || (error.message && error.message.includes('column'))) {
        const sanitized = { ...boardData };
        if (error.message?.includes('target_grade')) delete sanitized.target_grade;
        if (error.message?.includes('background_theme')) delete sanitized.background_theme;
        if (error.message?.includes('allow_student_comments')) delete sanitized.allow_student_comments;
        if (error.message?.includes('allow_comments')) delete sanitized.allow_comments;
        if (error.message?.includes('track')) delete sanitized.track;
        if (error.message?.includes('theme')) delete sanitized.theme;
        if (error.message?.includes('color')) delete sanitized.color;
        if (error.message?.includes('is_active')) delete sanitized.is_active;
        const retry = await supabase.from('padlet_boards').upsert(sanitized, { onConflict: 'id' });
        if (!retry.error) {
          return { board, error: null };
        }
        
        // المحاولة بالحد الأدنى الأساسي
        const minimal = {
          id: board.id,
          title: board.title || 'حائط تفاعلي',
          teacher_id: board.teacher_id || 'usr_teacher',
          teacher_name: board.teacher_name || 'معلم المادة',
          grade: board.grade || 'grade-1',
          created_at: board.created_at || new Date().toISOString()
        };
        const minimalRetry = await supabase.from('padlet_boards').upsert(minimal, { onConflict: 'id' });
        return { board, error: minimalRetry.error };
      }
      return { board, error };
    }
    return { board, error: null };
  } catch (err) {
    console.warn('استثناء في مزامنة لوحة الحائط سحابياً:', err);
    return { board, error: err };
  }
};

/**
 * التأكد من أن الحائط التفاعلي مسجل في السحابة قبل كتابة أي بطاقة فيه
 * هذا يمنع خطأ 23503 (Foreign Key Constraint: padlet_posts_board_id_fkey)
 */
export const ensurePadletBoardExists = async (boardId: string): Promise<void> => {
  if (!boardId) return;
  try {
    const { data, error } = await supabase.from('padlet_boards').select('id').eq('id', boardId).maybeSingle();
    if (!error && data?.id) {
      return; // الحائط موجود بالفعل في السحابة
    }

    // إذا لم يكن موجوداً في السحابة، نبحث عنه في التخزين المحلي لرفعه
    const localBoard = getPadletBoards().find(b => b.id === boardId);
    if (localBoard) {
      await savePadletBoard(localBoard);
      return;
    }

    // إذا لم يكن موجوداً حتى محلياً، ننشئ حائطاً تلقائياً لمنع كسر قيد المفتاح الأجنبي
    const fallbackBoard: PadletBoard = {
      id: boardId,
      title: 'جدار الأبطال التفاعلي 🌟',
      description: 'مساحة تفاعلية لمشاركة الإبداعات والأنشطة',
      teacher_id: 'usr_teacher',
      teacher_name: 'الأستاذة فاطمة الزهراء',
      grade: 'grade-1',
      target_grade: 'grade-1',
      color: 'yellow',
      track: 'arabic-a',
      theme: 'corkboard',
      allow_comments: true,
      require_approval: false,
      is_locked: false,
      created_at: new Date().toISOString()
    };
    await savePadletBoard(fallbackBoard);
  } catch (err) {
    console.warn('تنبيه أثناء التحقق من وجود الحائط التفاعلي في السحابة:', err);
  }
};

export const deletePadletBoard = async (boardId: string): Promise<void> => {
  const boards = getPadletBoards().filter(b => b.id !== boardId);
  localStorage.setItem(PADLET_BOARDS_KEY, JSON.stringify(boards));

  const posts = getPadletPosts().filter(p => p.board_id !== boardId);
  localStorage.setItem(PADLET_POSTS_KEY, JSON.stringify(posts));

  window.dispatchEvent(new CustomEvent('padlet_boards_updated'));
  window.dispatchEvent(new CustomEvent('padlet_posts_updated'));

  (async () => {
    try {
      await supabase.from('padlet_posts').delete().eq('board_id', boardId);
      await supabase.from('padlet_boards').delete().eq('id', boardId);
    } catch (err) {
      console.warn('ملاحظة في حذف لوحة الحائط سحابياً:', err);
    }
  })();
};

export const getPadletPosts = (boardId?: string): PadletPost[] => {
  const data = localStorage.getItem(PADLET_POSTS_KEY);
  let posts: PadletPost[] = [];
  if (!data) {
    posts = INITIAL_PADLET_POSTS;
    localStorage.setItem(PADLET_POSTS_KEY, JSON.stringify(INITIAL_PADLET_POSTS));
  } else {
    try {
      posts = JSON.parse(data);
      if (!Array.isArray(posts)) posts = INITIAL_PADLET_POSTS;
    } catch {
      posts = INITIAL_PADLET_POSTS;
    }
  }

  let filtered = boardId ? posts.filter(p => p.board_id === boardId) : posts;
  // الترتيب: المثبت أولاً، ثم الأحدث
  return filtered.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

// دالة مساعدة لتنظيف كائن البطاقة من الأعمدة غير الموجودة في جدول Supabase بحسب رسالة الخطأ
const sanitizePostPayloadForError = (payload: any, errorMessage: string) => {
  const sanitized = { ...payload };
  const lower = errorMessage.toLowerCase();
  
  if (lower.includes("'comments'") || lower.includes("comments column")) delete sanitized.comments;
  if (lower.includes("'status'") || lower.includes("status column")) delete sanitized.status;
  if (lower.includes("'pinned'") || lower.includes("pinned column")) delete sanitized.pinned;
  if (lower.includes("'content_type'") || lower.includes("content_type column")) delete sanitized.content_type;
  if (lower.includes("'audio_url'") || lower.includes("audio_url column")) delete sanitized.audio_url;
  if (lower.includes("'image_url'") || lower.includes("image_url column")) delete sanitized.image_url;
  if (lower.includes("'likes_count'") || lower.includes("likes_count column")) delete sanitized.likes_count;
  if (lower.includes("'liked_by'") || lower.includes("liked_by column")) delete sanitized.liked_by;
  if (lower.includes("'color'") || lower.includes("color column")) delete sanitized.color;
  if (lower.includes("'author_role'") || lower.includes("author_role column")) delete sanitized.author_role;
  return sanitized;
};

export const savePadletPost = async (post: PadletPost): Promise<{ post: PadletPost; error?: any }> => {
  // تحديث التخزين المحلي فوراً كنسخة احتياطية سريعة وموثوقة
  const posts = getPadletPosts();
  const index = posts.findIndex(p => p.id === post.id);
  if (index >= 0) {
    posts[index] = post;
  } else {
    posts.unshift(post);
  }
  localStorage.setItem(PADLET_POSTS_KEY, JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent('padlet_posts_updated'));

  // 1. التأكد أولاً من وجود الحائط التفاعلي في السحابة قبل إضافة البطاقة لتفادي الخطأ 23503
  await ensurePadletBoardExists(post.board_id);

  // إدراج ومزامنة مباشرة مع Supabase جدول padlet_posts
  let postData: any = {
    id: post.id,
    board_id: post.board_id,
    author_id: post.author_id,
    author_name: post.author_name,
    author_role: post.author_role || 'student',
    content: post.content,
    color: post.color || 'yellow',
    audio_url: post.audio_url || null,
    image_url: post.image_url || null,
    content_type: post.content_type || 'text',
    status: post.status || 'approved',
    likes_count: post.likes_count || 0,
    liked_by: post.liked_by || [],
    comments: post.comments || [],
    pinned: post.pinned || false,
    created_at: post.created_at || new Date().toISOString()
  };

  try {
    const { data, error } = await supabase.from('padlet_posts').upsert(postData, { onConflict: 'id' });
    if (error) {
      console.warn('Padlet post initial upsert returned error:', error);
      
      // معالجة خطأ 23503 (عدم وجود الحائط في padlet_boards)
      if (error.code === '23503' || (error.message && error.message.includes('foreign key constraint'))) {
        await ensurePadletBoardExists(post.board_id);
        const retryFk = await supabase.from('padlet_posts').upsert(postData, { onConflict: 'id' });
        if (!retryFk.error) {
          return { post, error: null };
        }
      }

      // في حال كان جدول Supabase يفتقر لبعض الأعمدة (PGRST204 missing column)
      // نحاول تدريجياً حذف الأعمدة غير الموجودة وإعادة المحاولة حتى ينجح الحفظ السحابي
      if (error.code === 'PGRST204' || (error.message && error.message.includes('column'))) {
        let retryPayload = sanitizePostPayloadForError(postData, error.message || '');
        let retryRes = await supabase.from('padlet_posts').upsert(retryPayload, { onConflict: 'id' });
        
        // إذا كان هناك عمود آخر مفقود في المحاولة الثانية، نجرب الحفظ بالحد الأدنى الأساسي
        if (retryRes.error && (retryRes.error.code === 'PGRST204' || retryRes.error.message?.includes('column'))) {
          retryPayload = sanitizePostPayloadForError(retryPayload, retryRes.error.message || '');
          retryRes = await supabase.from('padlet_posts').upsert(retryPayload, { onConflict: 'id' });
        }

        // إذا استمر الخطأ، نجرب الحفظ بالحقول الأساسية الحتمية فقط
        if (retryRes.error && (retryRes.error.code === 'PGRST204' || retryRes.error.message?.includes('column'))) {
          const minimalPayload: any = {
            id: post.id,
            board_id: post.board_id,
            author_id: post.author_id,
            author_name: post.author_name,
            content: post.content,
            created_at: post.created_at || new Date().toISOString()
          };
          retryRes = await supabase.from('padlet_posts').upsert(minimalPayload, { onConflict: 'id' });
        }

        if (!retryRes.error) {
          console.log('Padlet post saved to cloud successfully via schema adaptation fallback');
          return { post, error: null };
        }
        return { post, error: retryRes.error };
      }

      return { post, error };
    }
    return { post, error: null };
  } catch (err) {
    console.error('Padlet post insert exception:', err);
    return { post, error: err };
  }
};

export const updatePadletPostStatus = async (postId: string, status: 'approved' | 'pending'): Promise<PadletPost | null> => {
  const posts = getPadletPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return null;

  post.status = status;
  localStorage.setItem(PADLET_POSTS_KEY, JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent('padlet_posts_updated'));

  (async () => {
    try {
      await supabase.from('padlet_posts').update({ status }).eq('id', postId);
    } catch (e) {}
  })();

  return post;
};

export const togglePadletPostLike = async (postId: string, userId: string): Promise<PadletPost | null> => {
  const posts = getPadletPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return null;

  const alreadyLiked = post.liked_by.includes(userId);
  if (alreadyLiked) {
    post.liked_by = post.liked_by.filter(id => id !== userId);
    post.likes_count = Math.max(0, post.likes_count - 1);
  } else {
    post.liked_by.push(userId);
    post.likes_count += 1;
  }

  localStorage.setItem(PADLET_POSTS_KEY, JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent('padlet_posts_updated'));

  (async () => {
    try {
      await supabase.from('padlet_posts').update({
        likes_count: post.likes_count,
        liked_by: post.liked_by
      }).eq('id', postId);
    } catch (e) {}
  })();

  return post;
};

export const addPadletComment = async (postId: string, comment: PadletComment): Promise<PadletPost | null> => {
  const posts = getPadletPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return null;

  if (!Array.isArray(post.comments)) {
    post.comments = [];
  }
  post.comments.push(comment);

  localStorage.setItem(PADLET_POSTS_KEY, JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent('padlet_posts_updated'));

  (async () => {
    try {
      await supabase.from('padlet_posts').update({
        comments: post.comments
      }).eq('id', postId);
    } catch (e) {}
  })();

  return post;
};

export const deletePadletPost = async (postId: string): Promise<void> => {
  const posts = getPadletPosts().filter(p => p.id !== postId);
  localStorage.setItem(PADLET_POSTS_KEY, JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent('padlet_posts_updated'));

  (async () => {
    try {
      await supabase.from('padlet_posts').delete().eq('id', postId);
    } catch (e) {}
  })();
};

export const togglePadletPostPin = async (postId: string): Promise<PadletPost | null> => {
  const posts = getPadletPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return null;

  post.pinned = !post.pinned;
  localStorage.setItem(PADLET_POSTS_KEY, JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent('padlet_posts_updated'));

  (async () => {
    try {
      await supabase.from('padlet_posts').update({ pinned: post.pinned }).eq('id', postId);
    } catch (e) {}
  })();

  return post;
};

export const syncPadletBoardsFromCloud = async (): Promise<PadletBoard[]> => {
  try {
    const { data, error } = await supabase
      .from('padlet_boards')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const formatted: PadletBoard[] = data.map((b: any) => ({
        id: b.id,
        title: b.title,
        description: b.description || '',
        teacher_id: b.teacher_id,
        teacher_name: b.teacher_name || '',
        grade: b.grade || b.target_grade || 'grade-1',
        target_grade: b.target_grade || b.grade || 'grade-1',
        color: b.color || 'yellow',
        track: b.track || 'arabic-a',
        theme: b.theme || 'corkboard',
        allow_comments: b.allow_comments ?? true,
        require_approval: b.require_approval ?? false,
        is_locked: b.is_locked ?? false,
        created_at: b.created_at || new Date().toISOString()
      }));

      // دمج اللوحات السحابية مع اللوحات المحلية لتجنب فقدان أي حائط تم إنشاؤه محلياً
      const local = getPadletBoards();
      const map = new Map<string, PadletBoard>();
      formatted.forEach(b => map.set(b.id, b));
      const missingInCloud: PadletBoard[] = [];
      local.forEach(b => {
        if (!map.has(b.id)) {
          map.set(b.id, b);
          missingInCloud.push(b);
        }
      });
      const combined = Array.from(map.values());

      // رفع أي لوحات محلية غير مسجلة في السحابة لضمان اتساق المفاتيح الأجنبية
      if (missingInCloud.length > 0) {
        Promise.all(missingInCloud.map(b => savePadletBoard(b))).catch(() => {});
      }

      localStorage.setItem(PADLET_BOARDS_KEY, JSON.stringify(combined));
      return combined;
    }
  } catch (err) {
    console.warn('فشل جلب لوحات الحائط سحابياً، سيتم استخدام التخزين المحلي:', err);
  }
  return getPadletBoards();
};

export const syncPadletPostsFromCloud = async (boardId?: string): Promise<PadletPost[]> => {
  try {
    let query = supabase.from('padlet_posts').select('*');
    if (boardId) {
      query = query.eq('board_id', boardId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const formatted: PadletPost[] = data.map((p: any) => ({
        id: p.id,
        board_id: p.board_id,
        author_id: p.author_id,
        author_name: p.author_name,
        author_role: p.author_role || 'student',
        content: p.content || '',
        color: p.color || 'yellow',
        audio_url: p.audio_url || undefined,
        image_url: p.image_url || undefined,
        content_type: p.content_type || 'text',
        status: p.status || 'approved',
        likes_count: p.likes_count || 0,
        liked_by: Array.isArray(p.liked_by) ? p.liked_by : [],
        comments: Array.isArray(p.comments) ? p.comments : [],
        pinned: p.pinned || false,
        created_at: p.created_at || new Date().toISOString()
      }));

      // دمج ذكي ثنائي الاتجاه: السحابي هو المرجع الأساسي، مع الحفاظ على أي منشور محلي حديث لم يصله السحاب بعد
      const local = getPadletPosts();
      const map = new Map<string, PadletPost>();
      
      // نبدأ بوضع كل المنشورات السحابية
      formatted.forEach(post => map.set(post.id, post));
      
      // نتحقق من المنشورات المحلية: إذا كان هناك منشور تم إنشاؤه محلياً ولم يُسجل سحابياً بعد، نحتفظ به
      local.forEach(post => {
        if (!map.has(post.id)) {
          map.set(post.id, post);
        }
      });

      const merged = Array.from(map.values()).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      localStorage.setItem(PADLET_POSTS_KEY, JSON.stringify(merged));
      const result = boardId ? merged.filter(p => p.board_id === boardId) : merged;
      return result;
    }
  } catch (err) {
    console.warn('فشل جلب منشورات الحائط سحابياً، سيتم استخدام التخزين المحلي:', err);
  }
  return getPadletPosts(boardId);
};

// ================= تحدي موسى التنافسي الحي (Mousa Challenge Storage & Realtime Sync) =================

export const getChallengeQuizzes = (): ChallengeQuiz[] => {
  const data = localStorage.getItem(CHALLENGE_QUIZZES_KEY);
  if (!data) {
    localStorage.setItem(CHALLENGE_QUIZZES_KEY, JSON.stringify(INITIAL_CHALLENGE_QUIZZES));
    return INITIAL_CHALLENGE_QUIZZES;
  }
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(CHALLENGE_QUIZZES_KEY, JSON.stringify(INITIAL_CHALLENGE_QUIZZES));
      return INITIAL_CHALLENGE_QUIZZES;
    }
    return parsed;
  } catch {
    return INITIAL_CHALLENGE_QUIZZES;
  }
};

export const saveChallengeQuiz = async (quiz: ChallengeQuiz): Promise<ChallengeQuiz> => {
  const quizzes = getChallengeQuizzes();
  const index = quizzes.findIndex(q => q.id === quiz.id);
  let updated: ChallengeQuiz[];
  if (index >= 0) {
    updated = [...quizzes];
    updated[index] = quiz;
  } else {
    updated = [quiz, ...quizzes];
  }
  localStorage.setItem(CHALLENGE_QUIZZES_KEY, JSON.stringify(updated));

  // محاولة المزامنة السحابية غير المعطلة
  try {
    await supabase.from('challenge_quizzes').upsert({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description || null,
      teacher_id: quiz.teacher_id,
      teacher_name: quiz.teacher_name || null,
      target_grade: quiz.target_grade,
      target_track: quiz.target_track || 'arabic-a',
      questions: quiz.questions,
      is_ai_generated: quiz.is_ai_generated || false,
      topic: quiz.topic || null,
      created_at: quiz.created_at || new Date().toISOString()
    });
  } catch (e) {
    console.warn('تعذر حفظ التحدي سحابياً (سيستمر محلياً):', e);
  }

  return quiz;
};

export const deleteChallengeQuiz = async (quizId: string): Promise<void> => {
  const quizzes = getChallengeQuizzes().filter(q => q.id !== quizId);
  localStorage.setItem(CHALLENGE_QUIZZES_KEY, JSON.stringify(quizzes));
  try {
    await supabase.from('challenge_quizzes').delete().eq('id', quizId);
  } catch (e) {
    console.warn('تعذر حذف التحدي سحابياً:', e);
  }
};

// غرف التحدي الحية (Challenge Rooms)
export const getChallengeRooms = (): ChallengeRoom[] => {
  const data = localStorage.getItem(CHALLENGE_ROOMS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const normalizeRoomPlayers = (rawPlayers: any): Record<string, ChallengePlayer> => {
  if (!rawPlayers) return {};
  if (Array.isArray(rawPlayers)) {
    const map: Record<string, ChallengePlayer> = {};
    rawPlayers.forEach((p: any) => {
      if (p && typeof p === 'object' && p.id) {
        map[p.id] = p;
      }
    });
    return map;
  }
  if (typeof rawPlayers === 'object') {
    return rawPlayers as Record<string, ChallengePlayer>;
  }
  return {};
};

export const getChallengeRoomByPin = (pin: string): ChallengeRoom | null => {
  const rooms = getChallengeRooms();
  return rooms.find(r => r.pin === pin.trim()) || null;
};

export const getChallengeRoomById = (roomId: string): ChallengeRoom | null => {
  const rooms = getChallengeRooms();
  return rooms.find(r => r.id === roomId) || null;
};

// حالة توفر خادم الشبكة المحلي لتفادي طلبات 404 على بيئات النشر السحابية مثل Vercel
let localApiAvailable: boolean | null = null;

export const isLocalApiAvailable = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (localApiAvailable !== null) return localApiAvailable;
  const host = window.location.hostname;
  if (host.includes('vercel.app') || host.includes('netlify.app') || host.includes('github.io')) {
    localApiAvailable = false;
    return false;
  }
  return true;
};

export const disableLocalApi = () => {
  localApiAvailable = false;
};

// قناة البث المحلي التفاعلية عبر التبويبات المتعددة
const challengeBroadcastChannel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('mousa_challenge_sync')
  : null;

export const saveChallengeRoom = async (room: ChallengeRoom): Promise<ChallengeRoom> => {
  const rooms = getChallengeRooms();
  const index = rooms.findIndex(r => r.id === room.id || r.pin === room.pin);
  let updated: ChallengeRoom[];
  const now = new Date().toISOString();
  const roomToSave: ChallengeRoom = {
    ...room,
    players: normalizeRoomPlayers(room.players),
    updated_at: now
  };

  if (index >= 0) {
    updated = [...rooms];
    updated[index] = roomToSave;
  } else {
    updated = [roomToSave, ...rooms];
  }
  localStorage.setItem(CHALLENGE_ROOMS_KEY, JSON.stringify(updated));

  // 1. بث التحديث محلياً عبر CustomEvent للمتصفح الحالي
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('challenge_room_updated', { detail: roomToSave }));
  }

  // 2. بث التحديث عبر BroadcastChannel لجميع التبويبات المفتوحة في نفس المتصفح
  try {
    challengeBroadcastChannel?.postMessage({ type: 'ROOM_UPDATE', room: roomToSave });
  } catch {}

  // 3. مزامنة الغرفة مع خادم الشبكة المحلي (فقط في حال توفره وتجنباً لأخطاء 404 على Vercel)
  if (typeof window !== 'undefined' && isLocalApiAvailable()) {
    fetch('/api/challenge/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roomToSave)
    })
      .then(res => {
        if (!res.ok && res.status === 404) disableLocalApi();
      })
      .catch(() => disableLocalApi());
  }

  // 4. المزامنة السحابية غير المعطلة مع Supabase مع دمج الإجابات واللاعبين لحمايتهم من المسح
  try {
    let finalAnswers = Array.isArray(roomToSave.answers_received) ? [...roomToSave.answers_received] : [];
    let mergedPlayers = normalizeRoomPlayers(roomToSave.players);

    // التحقق من بيانات السحابة لدمج أي إجابات أو لاعبين مسجلين حديثاً
    const { data: cloudData } = await supabase
      .from('challenge_rooms')
      .select('answers_received, players, settings, quiz_id, quiz_title, host_id')
      .eq('pin', roomToSave.pin)
      .maybeSingle();

    const cloudSettings = (cloudData?.settings && typeof cloudData.settings === 'object') ? cloudData.settings : {};

    if (cloudData) {
      const cloudAnswers = Array.isArray(cloudData.answers_received) ? cloudData.answers_received : [];
      const ansMap = new Map<string, any>();
      cloudAnswers.forEach((a: any) => {
        if (a && a.playerId !== undefined) ansMap.set(`${a.playerId}_${a.questionIndex}`, a);
      });
      finalAnswers.forEach((a: any) => {
        if (a && a.playerId !== undefined) ansMap.set(`${a.playerId}_${a.questionIndex}`, a);
      });
      finalAnswers = Array.from(ansMap.values());

      const cloudPlayers = normalizeRoomPlayers(cloudData.players);
      
      // حساب الدرجات التراكمية من جميع الإجابات الصحيحة المؤكدة لضمان عدم ضياع أي نقطة
      const computedScores: Record<string, number> = {};
      finalAnswers.forEach((a: any) => {
        if (a && a.playerId && a.isCorrect) {
          computedScores[a.playerId] = (computedScores[a.playerId] || 0) + (Number(a.points) || 0);
        }
      });

      const allIds = new Set([
        ...Object.keys(cloudPlayers),
        ...Object.keys(mergedPlayers),
        ...Object.keys(computedScores)
      ]);

      const reconciledPlayers: Record<string, ChallengePlayer> = {};
      allIds.forEach(id => {
        const cp = cloudPlayers[id];
        const lp = mergedPlayers[id];
        const base = lp || cp;
        if (!base) return;

        const maxScore = Math.max(
          Number(cp?.score || 0),
          Number(lp?.score || 0),
          Number(computedScores[id] || 0)
        );

        const maxStreak = Math.max(
          Number(cp?.streak || 0),
          Number(lp?.streak || 0)
        );

        reconciledPlayers[id] = {
          ...cp,
          ...lp,
          score: maxScore,
          streak: maxStreak,
          isOnline: true
        };
      });

      mergedPlayers = reconciledPlayers;
    }

    const effectiveQuestions = (Array.isArray(roomToSave.questions) && roomToSave.questions.length > 0)
      ? roomToSave.questions
      : (Array.isArray(cloudSettings.questions) && cloudSettings.questions.length > 0
        ? cloudSettings.questions
        : (roomToSave.settings?.questions || []));

    const updatePayload: any = {
      status: roomToSave.status,
      current_question_index: Number(roomToSave.current_question_index || 0),
      players: Object.values(mergedPlayers),
      answers_received: finalAnswers,
      quiz_id: roomToSave.quiz_id || cloudData?.quiz_id || cloudSettings.quiz_id || null,
      quiz_title: roomToSave.quiz_title || cloudData?.quiz_title || cloudSettings.quiz_title || null,
      settings: {
        ...cloudSettings,
        ...(roomToSave.settings || {}),
        question_start_time: roomToSave.question_start_time || cloudSettings.question_start_time || Date.now(),
        questions: effectiveQuestions,
        quiz_id: roomToSave.quiz_id || cloudSettings.quiz_id,
        quiz_title: roomToSave.quiz_title || cloudSettings.quiz_title,
        target_grade: roomToSave.target_grade || cloudSettings.target_grade,
        host_name: roomToSave.host_name || cloudSettings.host_name
      }
    };

    const { error: updateError } = await supabase
      .from('challenge_rooms')
      .update(updatePayload)
      .eq('pin', roomToSave.pin);

    if (updateError) {
      console.warn('Supabase challenge room update note (local fallback active):', updateError.message);
    }
  } catch (e) {
    console.warn('تعذر تحديث غرفة التحدي سحابياً (سيستمر اللعب محلياً دون انقطاع):', e);
  }

  return roomToSave;
};

// وظيفة مخصصة وسريعة لتسجيل إجابة الطالب وتحديث رصيده دون المساس بحالة الغرفة
export const submitChallengeAnswerToCloudAndLocal = async (
  pin: string,
  answer: {
    playerId: string;
    playerName: string;
    questionIndex: number;
    optionIndex: number;
    isCorrect: boolean;
    points: number;
    answeredAt?: number;
  },
  playerUpdate: Partial<ChallengePlayer>
): Promise<ChallengeRoom | null> => {
  const cleanPin = (pin || '').trim();
  if (!cleanPin) return null;

  // 1. الإرسال السريع لخادم الشبكة المحلي (فقط في حال توفره وتجنباً لأخطاء 404)
  let localServerRoom: ChallengeRoom | null = null;
  if (isLocalApiAvailable()) {
    try {
      const res = await fetch(`/api/challenge/rooms/${cleanPin}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answer)
      });
      if (res.ok) {
        const json = await res.json();
        localServerRoom = json.room;
      } else if (res.status === 404) {
        disableLocalApi();
      }
    } catch {
      disableLocalApi();
    }
  }

  // 2. التحديث في localStorage
  const rooms = getChallengeRooms();
  const roomIndex = rooms.findIndex(r => r.pin === cleanPin);
  let updatedRoom: ChallengeRoom | null = null;

  if (roomIndex >= 0) {
    const room = rooms[roomIndex];
    const existingAnswers = Array.isArray(room.answers_received) ? [...room.answers_received] : [];
    const filteredAnswers = existingAnswers.filter(
      (a: any) => !(a.playerId === answer.playerId && Number(a.questionIndex) === Number(answer.questionIndex))
    );
    const newAnswers = [...filteredAnswers, answer];

    const players = normalizeRoomPlayers(room.players);
    if (players[answer.playerId]) {
      players[answer.playerId] = {
        ...players[answer.playerId],
        ...playerUpdate,
        score: (players[answer.playerId].score || 0) + answer.points,
        streak: answer.isCorrect ? ((players[answer.playerId].streak || 0) + 1) : 0,
        lastAnswer: {
          selectedIndex: answer.optionIndex,
          questionIndex: answer.questionIndex,
          isCorrect: answer.isCorrect,
          pointsEarned: answer.points,
          answeredAt: answer.answeredAt || Date.now()
        } as any
      };
    }

    updatedRoom = {
      ...room,
      players,
      answers_received: newAnswers
    };
    rooms[roomIndex] = updatedRoom;
    localStorage.setItem(CHALLENGE_ROOMS_KEY, JSON.stringify(rooms));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('challenge_room_updated', { detail: updatedRoom }));
    }
  }

  // 3. البث الفوري عبر BroadcastChannel
  try {
    challengeBroadcastChannel?.postMessage({
      type: 'ROOM_ANSWER',
      pin: cleanPin,
      answer,
      room: updatedRoom || localServerRoom
    });
  } catch {}

  // 4. المزامنة السحابية غير المعطلة مع Supabase - فقط إرسال answers_received و players
  try {
    const { data: cloudData } = await supabase
      .from('challenge_rooms')
      .select('answers_received, players')
      .eq('pin', cleanPin)
      .maybeSingle();

    const cloudAnswers = Array.isArray(cloudData?.answers_received) ? [...cloudData.answers_received] : [];
    const filteredCloudAnswers = cloudAnswers.filter(
      (a: any) => !(a.playerId === answer.playerId && Number(a.questionIndex) === Number(answer.questionIndex))
    );
    const finalCloudAnswers = [...filteredCloudAnswers, answer];

    const cloudPlayers = normalizeRoomPlayers(cloudData?.players);
    const currentPlayer = cloudPlayers[answer.playerId] || {
      id: answer.playerId,
      name: answer.playerName,
      score: 0,
      streak: 0,
      isOnline: true,
      joinedAt: Date.now()
    };

    // حساب مجموع النقاط الإجمالي للاعب من جميع إجاباته الصحيحة المسجلة
    const totalPointsFromAnswers = finalCloudAnswers
      .filter((a: any) => a.playerId === answer.playerId && a.isCorrect)
      .reduce((sum: number, a: any) => sum + (Number(a.points) || 0), 0);

    const calculatedScore = Math.max(
      totalPointsFromAnswers,
      (Number(currentPlayer.score) || 0) + (answer.isCorrect ? (Number(answer.points) || 0) : 0),
      Number(playerUpdate?.score || 0)
    );

    cloudPlayers[answer.playerId] = {
      ...currentPlayer,
      ...playerUpdate,
      joinedAt: currentPlayer.joinedAt || Date.now(),
      score: calculatedScore,
      streak: answer.isCorrect ? ((currentPlayer.streak || 0) + 1) : 0,
      lastAnswer: {
        questionId: `q_${answer.questionIndex}`,
        selectedIndex: answer.optionIndex,
        questionIndex: answer.questionIndex,
        isCorrect: answer.isCorrect,
        timeTakenMs: 1000,
        pointsEarned: answer.points,
        answeredAt: answer.answeredAt || Date.now()
      } as any
    };

    await supabase
      .from('challenge_rooms')
      .update({
        answers_received: finalCloudAnswers,
        players: Object.values(cloudPlayers)
      })
      .eq('pin', cleanPin);
  } catch (e) {
    console.warn('Supabase answer submit fallback note:', e);
  }

  return updatedRoom || localServerRoom;
};

export const syncChallengeRoomFromCloud = async (roomIdOrPin: string): Promise<ChallengeRoom | null> => {
  const clean = (roomIdOrPin || '').trim();
  try {
    let query = supabase.from('challenge_rooms').select('*');
    if (clean.length === 6 && /^\d+$/.test(clean)) {
      query = query.eq('pin', clean);
    } else {
      query = query.eq('id', clean);
    }
    const { data, error } = await query.maybeSingle();

    if (!error && data) {
      const localMatch = getChallengeRoomByPin(data.pin);
      const quizzes = getChallengeQuizzes();
      const quizMatch = quizzes.find(q => q.id === data.quiz_id || q.title === data.quiz_title);
      const settingsQuestions = data.settings?.questions;
      const roomQuestions = (Array.isArray(data.questions) && data.questions.length > 0)
        ? data.questions
        : ((Array.isArray(settingsQuestions) && settingsQuestions.length > 0)
            ? settingsQuestions
            : (localMatch?.questions || quizMatch?.questions || INITIAL_CHALLENGE_QUIZZES[0].questions));

      const formatted: ChallengeRoom = {
        id: data.id || localMatch?.id || `room_${Date.now()}`,
        pin: data.pin,
        quiz_id: data.quiz_id || data.settings?.quiz_id || localMatch?.quiz_id || '',
        quiz_title: data.quiz_title || data.settings?.quiz_title || localMatch?.quiz_title || 'تحدي موسى التفاعلي',
        host_id: data.host_id,
        host_name: data.host_name || data.settings?.host_name || localMatch?.host_name || 'المعلم',
        target_grade: data.target_grade || data.settings?.target_grade || localMatch?.target_grade || 'grade-1',
        status: data.status,
        current_question_index: typeof data.current_question_index === 'number' ? data.current_question_index : 0,
        questions: roomQuestions,
        players: normalizeRoomPlayers(data.players || localMatch?.players),
        answers_received: Array.isArray(data.answers_received) ? data.answers_received : [],
        question_start_time: data.settings?.question_start_time || undefined,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at
      };

      // حفظ محلي
      const rooms = getChallengeRooms().filter(r => r.id !== formatted.id && r.pin !== formatted.pin);
      localStorage.setItem(CHALLENGE_ROOMS_KEY, JSON.stringify([formatted, ...rooms]));
      return formatted;
    }
  } catch (err) {
    console.warn('فشل جلب غرفة التحدي سحابياً، سيتم فحص الـ Fallback المحلي:', err);
  }

  // Fallback 1: التخزين المحلي في المتصفح
  const local = getChallengeRoomById(clean) || getChallengeRoomByPin(clean);
  if (local) return local;

  // Fallback 2: خادم الشبكة المحلي (فقط في حال توفره وتجنباً لأخطاء 404)
  if (clean.length === 6 && /^\d+$/.test(clean) && isLocalApiAvailable()) {
    try {
      const resp = await fetch(`/api/challenge/rooms/${clean}`);
      if (resp.ok) {
        const json = await resp.json();
        if (json?.room) return json.room;
      } else if (resp.status === 404) {
        disableLocalApi();
      }
    } catch {
      disableLocalApi();
    }
  }

  return null;
};

export const syncChallengeQuizzesFromCloud = async (): Promise<ChallengeQuiz[]> => {
  try {
    const { data, error } = await supabase
      .from('challenge_quizzes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const formatted: ChallengeQuiz[] = data.map((q: any) => ({
        id: q.id,
        title: q.title,
        description: q.description || '',
        teacher_id: q.teacher_id,
        teacher_name: q.teacher_name || '',
        target_grade: q.target_grade,
        target_track: q.target_track || 'arabic-a',
        questions: Array.isArray(q.questions) ? q.questions : [],
        is_ai_generated: q.is_ai_generated || false,
        topic: q.topic || '',
        created_at: q.created_at || new Date().toISOString()
      }));

      // دمج مع الكويزات المحلية
      const local = getChallengeQuizzes();
      const localIds = new Set(formatted.map(f => f.id));
      const remainingLocal = local.filter(l => !localIds.has(l.id));
      const merged = [...formatted, ...remainingLocal];
      localStorage.setItem(CHALLENGE_QUIZZES_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('فشل جلب تحديات موسى سحابياً:', err);
  }
  return getChallengeQuizzes();
};

// ================= جلسات فصل موسى المباشر (Live Classroom Sessions) =================

export const getLiveClassSessions = (): LiveClassSession[] => {
  try {
    const raw = localStorage.getItem(LIVE_CLASS_SESSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const now = Date.now();
        // تصفية وحذف أي جلسات وهمية قديمة أو منتهية لمنع ظهور مؤشرات نشطة خاطئة
        const validSessions = parsed
          .filter((s: LiveClassSession) => {
            if (!s.isActive) return false;
            if (s.startedAt) {
              const start = new Date(s.startedAt).getTime();
              // إذا بدأت الجلسة قبل أكثر من 3 ساعات، تعتبر منتهية تلقائياً
              if (now - start > 3 * 60 * 60 * 1000) {
                return false;
              }
            }
            return true;
          })
          .map((s: LiveClassSession) => ({
            ...s,
            serverDomain: (!s.serverDomain || s.serverDomain === 'meet.ffrn.de' || s.serverDomain === 'jitsi.hamburg.ccc.de') ? 'framatalk.org' : s.serverDomain
          }));

        // تنظيف التخزين المحلي فوراً إذا تم استبعاد أي جلسة منتهية
        if (validSessions.length !== parsed.length) {
          localStorage.setItem(LIVE_CLASS_SESSIONS_KEY, JSON.stringify(validSessions));
        }
        return validSessions;
      }
    }
  } catch (e) {
    console.warn('Error reading live class sessions from storage:', e);
  }
  return [];
};

export const getActiveLiveClassForGrade = (grade: string): LiveClassSession | null => {
  const sessions = getLiveClassSessions();
  const now = Date.now();
  return sessions.find(s => {
    if (!s.isActive) return false;
    if (s.startedAt && now - new Date(s.startedAt).getTime() > 3 * 60 * 60 * 1000) return false;
    return s.grade === grade || s.grade === 'all';
  }) || null;
};

export const getActiveLiveClassForTeacher = (teacherId: string): LiveClassSession | null => {
  const sessions = getLiveClassSessions();
  const now = Date.now();
  return sessions.find(s => {
    if (!s.isActive) return false;
    if (s.startedAt && now - new Date(s.startedAt).getTime() > 3 * 60 * 60 * 1000) return false;
    return s.teacherId === teacherId;
  }) || null;
};

export const saveLiveClassSession = async (session: LiveClassSession): Promise<LiveClassSession> => {
  const sessions = getLiveClassSessions();
  const existingIdx = sessions.findIndex(s => s.id === session.id);
  if (existingIdx >= 0) {
    sessions[existingIdx] = session;
  } else {
    sessions.unshift(session);
  }

  localStorage.setItem(LIVE_CLASS_SESSIONS_KEY, JSON.stringify(sessions));

  // محاولة الحفظ المباشر في جدول live_class_sessions إن وُجد
  try {
    await supabase.from('live_class_sessions').upsert({
      id: session.id,
      room_name: session.roomName,
      grade: typeof session.grade === 'string' ? session.grade : 'grade-1',
      track: typeof session.track === 'string' ? session.track : 'arabic-a',
      teacher_id: session.teacherId,
      teacher_name: session.teacherName,
      title: session.title,
      is_active: session.isActive !== false,
      started_at: session.startedAt || new Date().toISOString(),
      server_domain: session.serverDomain || 'framatalk.org',
      permissions: session.permissions || { allowChat: false, allowScreenShare: false }
    });
  } catch (e) {}

  // بث التحديث سحابياً عبر جدول activities
  try {
    await supabase.from('activities').upsert({
      id: LIVE_CLASS_SYNC_ID,
      title: 'LIVE_CLASS_SESSIONS',
      passage: JSON.stringify(sessions),
      teacher_id: session.teacherId,
      teacher_name: session.teacherName,
      stage: 'primary',
      grade: typeof session.grade === 'string' ? session.grade : 'grade-1',
      track: typeof session.track === 'string' ? session.track : 'arabic-a',
      questions: [],
      created_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('فشل حفظ جلسة الحصة المباشرة سحابياً:', e);
  }

  // بث الإشعار اللحظي لجميع الطلاب والمعلمين عبر Supabase Broadcast
  try {
    const channel = supabase.channel('lwm-realtime-sync');
    channel.send({
      type: 'broadcast',
      event: 'live_session_update',
      payload: session
    });
  } catch (e) {
    console.warn('Broadcast notice:', e);
  }

  return session;
};

export const endLiveClassSession = async (sessionId: string): Promise<void> => {
  const sessions = getLiveClassSessions();
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    session.isActive = false;
    session.endedAt = new Date().toISOString();
  }

  // تنظيف التخزين المحلي وحذف الجلسة المنتهية فوراً
  const remainingActive = sessions.filter(s => s.id !== sessionId && s.isActive);
  localStorage.setItem(LIVE_CLASS_SESSIONS_KEY, JSON.stringify(remainingActive));

  // تحديث جدول live_class_sessions إن وُجد
  try {
    await supabase.from('live_class_sessions').update({
      is_active: false,
      ended_at: new Date().toISOString()
    }).eq('id', sessionId);
  } catch (e) {}

  // تحديث سجل الأنشطة السحابي
  try {
    await supabase.from('activities').upsert({
      id: LIVE_CLASS_SYNC_ID,
      title: 'LIVE_CLASS_SESSIONS',
      passage: JSON.stringify(remainingActive),
      teacher_id: session?.teacherId || 'usr_teacher',
      teacher_name: session?.teacherName || 'المعلم',
      stage: 'primary',
      grade: typeof session?.grade === 'string' ? session.grade : 'grade-1',
      track: typeof session?.track === 'string' ? session.track : 'arabic-a',
      questions: [],
      created_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('فشل إنهاء الحصة المباشرة سحابياً:', e);
  }

  // بث التحديث الفوري لإغلاق شاشة البث وشارات الإشعار عند جميع الطلاب
  try {
    const channel = supabase.channel('lwm-realtime-sync');
    channel.send({
      type: 'broadcast',
      event: 'live_session_update',
      payload: { id: sessionId, isActive: false }
    });
  } catch (e) {}
};

export const syncLiveClassSessionsFromCloud = async (): Promise<LiveClassSession[]> => {
  try {
    // 1. الفحص الصارم من جدول live_class_sessions المخصص أولاً إن وُجد
    try {
      const { data: tableData, error: tableErr } = await supabase
        .from('live_class_sessions')
        .select('*')
        .eq('is_active', true);

      if (!tableErr && Array.isArray(tableData)) {
        if (tableData.length === 0) {
          // لا توجد حصص نشطة على الإطلاق -> تفريغ التخزين المحلي لتفادي أي مؤشرات وهمية
          localStorage.setItem(LIVE_CLASS_SESSIONS_KEY, JSON.stringify([]));
          return [];
        }

        const mapped: LiveClassSession[] = tableData.map((row: any) => ({
          id: row.id,
          roomName: row.room_name || row.roomName,
          grade: row.grade,
          track: row.track,
          teacherId: row.teacher_id || row.teacherId,
          teacherName: row.teacher_name || row.teacherName,
          title: row.title,
          isActive: true,
          startedAt: row.started_at || row.startedAt,
          serverDomain: row.server_domain || row.serverDomain || 'framatalk.org',
          permissions: row.permissions || { allowChat: false, allowScreenShare: false }
        }));

        localStorage.setItem(LIVE_CLASS_SESSIONS_KEY, JSON.stringify(mapped));
        return mapped;
      }
    } catch (e) {}

    // 2. الفحص من جدول activities كقناة مزامنة معتمدة
    const { data } = await supabase
      .from('activities')
      .select('passage')
      .eq('id', LIVE_CLASS_SYNC_ID)
      .maybeSingle();

    if (data?.passage) {
      const sessions: LiveClassSession[] = JSON.parse(data.passage);
      if (Array.isArray(sessions)) {
        const activeOnly = sessions.filter(s => s.isActive);
        localStorage.setItem(LIVE_CLASS_SESSIONS_KEY, JSON.stringify(activeOnly));
        return activeOnly;
      }
    } else {
      // لا توجد أي جلسة نشطة سحابياً -> مسح التخزين المحلي
      localStorage.setItem(LIVE_CLASS_SESSIONS_KEY, JSON.stringify([]));
      return [];
    }
  } catch (err) {
    console.warn('تعذر جلب جلسات الحصة المباشرة سحابياً:', err);
  }
  return getLiveClassSessions();
};

