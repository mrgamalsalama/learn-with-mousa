import { supabase, upsertUserInSupabase } from '../supabaseClient';
import { 
  INITIAL_USERS, 
  INITIAL_EXAMS, 
  INITIAL_TEACHER_TASKS,
  INITIAL_STUDENT_SUBMISSIONS,
  saveExam,
  saveSubmission,
  DEFAULT_AI_GOVERNANCE_RULES,
  AI_GOVERNANCE_KEY,
  AI_GOVERNANCE_SYNC_ID,
  TEACHER_TASKS_SYNC_ID
} from '../storage';
import { Activity } from '../types';

export interface SanitizationResult {
  success: boolean;
  message: string;
  clearedTables: string[];
  seededItems: {
    users: number;
    activities: number;
    exams: number;
    submissions: number;
    tasks: number;
  };
}

/**
 * سكريبت تنظيف آمن لحذف كافة السجلات التجريبية والوهمية وإعادة بذر حساب العرض النموذجي (Demo Day)
 */
export async function executeDemoDaySanitization(schoolId: string = 'school_demo_mousa'): Promise<SanitizationResult> {
  const clearedTables: string[] = [];

  console.log(`[Demo Day Sanitization] بدء عملية التنظيف الشامل وإعادة البذر لمدرسة: ${schoolId}...`);

  // 1. تنظيف التخزين المحلي (Local Storage & Cache)
  try {
    const keysToClean = [
      'lwm_submissions',
      'lwm_exam_sessions',
      'lwm_student_badges',
      'lwm_student_phonics',
      'lwm_padlet_posts',
      'lwm_challenge_rooms',
      'lwm_live_class_sessions'
    ];
    keysToClean.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
    });
  } catch (e) {
    console.warn('تحذير أثناء مسح التخزين المحلي:', e);
  }

  // 2. تنظيف الجداول السحابية في Supabase
  // يتم حذف الجلسات العشوائية والتسليمات المكررة غير الرسمية
  const tablesToClean = [
    'exam_sessions',
    'submissions',
    'challenge_rooms',
    'padlet_posts',
    'badges',
    'live_class_sessions'
  ];

  for (const table of tablesToClean) {
    try {
      // حذف السجلات التابعة لمدرسة العرض أو السجلات التجريبية
      const { error } = await supabase.from(table).delete().neq('id', 'KEEP_PRIMARY_ROOT');
      if (!error) {
        clearedTables.push(table);
      } else {
        console.warn(`تنبيه أثناء تنظيف جدول ${table}:`, error.message);
      }
    } catch (err) {
      console.warn(`استثناء أثناء تنظيف جدول ${table}:`, err);
    }
  }

  // 3. إعادة بذر المستخدمين النموذجيين مع ربطهم بالمدرسة school_id
  let seededUsersCount = 0;
  for (const user of INITIAL_USERS) {
    const sanitizedUser = {
      ...user,
      school_id: schoolId
    };
    try {
      await upsertUserInSupabase(sanitizedUser);
      seededUsersCount++;
    } catch (e) {
      console.warn(`فشل بذر المستخدم ${user.username}:`, e);
    }
  }

  // 4. إعادة بذر الأنشطة النموذجية التأسيسية المعتمدة ليوم العرض
  const demoActivities: Activity[] = [
    {
      id: 'act_demo_vowel_train_1',
      title: 'قطار الحركات والمدود السحرية 🚂 (الصف الأول الابتدائي)',
      activityType: 'game',
      school_id: schoolId,
      stage: 'primary',
      grade: 'grade-1',
      track: 'arabic-a',
      teacherId: 'usr_teacher',
      teacherName: 'الأستاذة فاطمة الزهراء',
      createdAt: new Date().toLocaleDateString('ar-EG'),
      gameData: {
        gameType: 'vowel_train',
        targetSkill: 'التمييز بين الحركات القصيرة والمدود الطويلة',
        instructions: 'مَرْحَبًا بِكَ يَا بَطَل! سَاعِدْ قِطَارَ الحَرَكَاتِ فِي اخْتِيَارِ عَرَبَةِ المَدِّ الصَّحِيحَةِ!',
        levels: [
          {
            id: 1,
            prompt: 'سَاعِدْ سَائِقَ القِطَارِ مُوسَى فِي اخْتِيَارِ الكَلِمَةِ الَّتِي تَحْوِي مَدًّا بِالأَلِفِ (ـا):',
            correctAnswers: ['كِتَابٌ'],
            options: ['كِتَابٌ', 'قَلَمٌ', 'وَلَدٌ', 'جَمَلٌ'],
            feedbackSuccess: 'طُوط طُوط! رَائِعٌ جِدًّا! (كِتَابٌ) فِيهَا مَدٌّ بِالأَلِفِ (تَا)! 🚂🌟',
            feedbackHint: 'اسْتَمِعْ لِلصَّوْتِ الطَّوِيلِ المَفْتُوحِ بَعْدَ حَرْفِ التَّاءِ: تَا!',
            vowelType: 'مد بالألف'
          },
          {
            id: 2,
            prompt: 'عَرَبَةُ مَدِّ الوَاوِ تَنْتَظِرُ رُكَّابَهَا! اخْتَرِ الكَلِمَةَ الَّتِي فِيهَا مَدٌّ بِالوَاوِ (ـو):',
            correctAnswers: ['عُصْفُورٌ'],
            options: ['عُصْفُورٌ', 'خُبْزٌ', 'عُمَرُ', 'دُبٌّ'],
            feedbackSuccess: 'يَا سَلَام! (عُصْفُورٌ) فِيهَا صَوْتُ مَدِّ الوَاوِ الطَّوِيلِ! 🐦🚂✨',
            feedbackHint: 'ضُمَّ شَفَتَيْكَ وَمُدَّ الصَّوْتَ مِثْلَ: فُـو!',
            vowelType: 'مد بالواو'
          }
        ]
      },
      questions: []
    },
    {
      id: 'act_demo_sorter_1',
      title: 'ميزان الظواهر اللغوية: اللام الشمسية واللام القمرية ☀️🌙',
      activityType: 'game',
      school_id: schoolId,
      stage: 'primary',
      grade: 'grade-1',
      track: 'arabic-a',
      teacherId: 'usr_teacher',
      teacherName: 'الأستاذة فاطمة الزهراء',
      createdAt: new Date().toLocaleDateString('ar-EG'),
      gameData: {
        gameType: 'category_sorter',
        targetSkill: 'اللام الشمسية واللام القمرية',
        instructions: 'صَنِّفِ الكَلِمَاتِ فِي السَّلَّةِ الصَّحِيحَةِ: سَلَّةُ الشَّمْسِ أَمْ سَلَّةُ القَمَرِ!',
        levels: [
          {
            id: 1,
            prompt: 'صَنِّفِ الكَلِمَاتِ الآتِيَةَ فِي سَلَّتَيْهَا الصَّحِيحَتَيْنِ: (الَّلامُ الشَّمْسِيَّةُ ☀️) أَمْ (الَّلامُ القَمَرِيَّةُ 🌙)؟',
            categories: ['اللام الشمسية ☀️', 'اللام القمرية 🌙'],
            options: ['الشَّمْسُ', 'القَمَرُ', 'النَّجْمُ', 'الكِتَابُ'],
            categoryMap: {
              'الشَّمْسُ': 'اللام الشمسية ☀️',
              'القَمَرُ': 'اللام القمرية 🌙',
              'النَّجْمُ': 'اللام الشمسية ☀️',
              'الكِتَابُ': 'اللام القمرية 🌙'
            },
            correctAnswers: ['الشَّمْسُ', 'النَّجْمُ'],
            feedbackSuccess: 'مِيزَانُكَ اللُّغَوِيُّ فَوْقَ العَادَةِ! مَيَّزْتَ بَيْنَ الشَّمْسِيَّةِ وَالقَمَرِيَّةِ بِدِقَّةٍ! ⚖️☀️🌙',
            feedbackHint: 'تَذَكَّرْ: اللَّامُ الشَّمْسِيَّةُ تُكْتَبُ وَلَا تُنْطَقُ وَتَلِيهَا شَدَّةٌ!'
          }
        ]
      },
      questions: []
    }
  ];

  let seededActivitiesCount = 0;
  for (const act of demoActivities) {
    try {
      await supabase.from('activities').upsert({
        id: act.id,
        title: act.title,
        school_id: schoolId,
        activity_type: act.activityType,
        game_data: act.gameData,
        description: 'نشاط نموذجي معتمد لمنصة موسى',
        passage: null,
        teacher_id: act.teacherId,
        teacher_name: act.teacherName,
        stage: act.stage,
        grade: act.grade,
        track: act.track,
        questions: act.questions,
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });
      seededActivitiesCount++;
    } catch (e) {
      console.warn('فشل بذر النشاط:', e);
    }
  }

  // 5. إعادة بذر الاختبارات المعتمدة المرتبطة بالمدرسة
  let seededExamsCount = 0;
  for (const exam of INITIAL_EXAMS) {
    try {
      await saveExam({
        ...exam,
        school_id: schoolId
      });
      seededExamsCount++;
    } catch (e) {
      console.warn('فشل بذر الاختبار:', e);
    }
  }

  // 6. إعادة بذر تسليمات الطالب موسى النموذجية لعرض سجل الدرجات والتحليلات البيانية
  let seededSubmissionsCount = 0;
  for (const sub of INITIAL_STUDENT_SUBMISSIONS) {
    try {
      await saveSubmission({
        ...sub,
        school_id: schoolId
      });
      seededSubmissionsCount++;
    } catch (e) {
      console.warn('فشل بذر التسليم:', e);
    }
  }

  // 7. تثبيت سياسات الذكاء الاصطناعي ومهام المعلم
  try {
    localStorage.setItem(AI_GOVERNANCE_KEY, JSON.stringify(DEFAULT_AI_GOVERNANCE_RULES));
    await supabase.from('activities').upsert({
      id: AI_GOVERNANCE_SYNC_ID,
      title: 'AI_GOVERNANCE_RULES',
      school_id: schoolId,
      passage: JSON.stringify(DEFAULT_AI_GOVERNANCE_RULES),
      teacher_id: 'usr_admin',
      teacher_name: 'المشرف العام',
      stage: 'primary',
      grade: 'grade-1',
      track: 'arabic-a',
      questions: [],
      created_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {}

  try {
    await supabase.from('activities').upsert({
      id: TEACHER_TASKS_SYNC_ID,
      title: 'TEACHER_TASKS_DATA',
      school_id: schoolId,
      passage: JSON.stringify(INITIAL_TEACHER_TASKS),
      teacher_id: 'usr_admin',
      teacher_name: 'المشرف العام',
      stage: 'primary',
      grade: 'grade-1',
      track: 'arabic-a',
      questions: [],
      created_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {}

  return {
    success: true,
    message: 'تم تنظيف البيانات السابقة وإعادة بذر حساب العرض النموذجي والمدرسة بنجاح 🌟',
    clearedTables,
    seededItems: {
      users: seededUsersCount,
      activities: seededActivitiesCount,
      exams: seededExamsCount,
      submissions: seededSubmissionsCount,
      tasks: INITIAL_TEACHER_TASKS.length
    }
  };
}
