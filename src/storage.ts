import { UserProfile, Activity, StudentSubmission, StoryBankItem, BookItem } from './types';
import { INITIAL_BOOKS } from './booksData';
import { supabase } from './supabaseClient';

const USERS_KEY = 'lwm_users';
const ACTIVITIES_KEY = 'lwm_activities';
const SUBMISSIONS_KEY = 'lwm_submissions';
const CURRENT_USER_KEY = 'lwm_current_user';
const BOOKS_KEY = 'lwm_books_repository';

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr_admin',
    name: 'المشرف العام',
    username: 'admin',
    password: '123',
    role: 'super_admin',
    loginCount: 0,
  }
];

// مزامنة المستخدمين من Supabase
export const syncUsersFromCloud = async (): Promise<UserProfile[]> => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (!error && data && data.length > 0) {
      const formatted: UserProfile[] = data.map((u: any) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        password: u.password,
        role: u.role,
        stage: u.stage,
        grade: u.grade,
        track: u.track,
        studentId: u.student_id,
        allowedGrades: u.allowed_grades,
        allowedTracks: u.allowed_tracks,
        loginCount: u.login_count || 0,
        lastLogin: u.last_login
      }));
      localStorage.setItem(USERS_KEY, JSON.stringify(formatted));
      return formatted;
    }
  } catch (err) {
    console.warn('تعذر جلب المستخدمين سحابياً، سيتم استخدام التخزين المحلي مؤقتاً', err);
  }
  return getUsers();
};

export const getUsers = (): UserProfile[] => {
  const data = localStorage.getItem(USERS_KEY);
  if (!data) {
    localStorage.setItem(USERS_KEY, JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  return JSON.parse(data);
};

export const saveUser = async (user: UserProfile): Promise<void> => {
  const users = getUsers();
  const existingIdx = users.findIndex(u => u.id === user.id);
  if (existingIdx >= 0) {
    users[existingIdx] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // رفع سحابي لـ Supabase
  try {
    await supabase.from('users').upsert({
      id: user.id,
      name: user.name,
      username: user.username,
      password: user.password,
      role: user.role,
      stage: user.stage || null,
      grade: user.grade || null,
      track: user.track || null,
      student_id: user.studentId || null,
      allowed_grades: user.allowedGrades || null,
      allowed_tracks: user.allowedTracks || null,
      login_count: user.loginCount || 0,
      last_login: user.lastLogin || null
    });
  } catch (e) {
    console.error('فشل الرفع السحابي للمستخدم:', e);
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

// الأنشطة
export const getActivities = (): Activity[] => {
  const data = localStorage.getItem(ACTIVITIES_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveActivity = async (activity: Activity): Promise<void> => {
  const activities = getActivities();
  activities.unshift(activity);
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));

  try {
    await supabase.from('activities').upsert({
      id: activity.id,
      title: activity.title,
      passage: activity.passage || null,
      teacher_id: activity.teacherId,
      teacher_name: activity.teacherName,
      stage: activity.stage,
      grade: activity.grade,
      track: activity.track,
      questions: activity.questions,
      created_at: activity.createdAt
    });
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

// تسليمات ودرجات الطلاب
export const getSubmissions = (): StudentSubmission[] => {
  const data = localStorage.getItem(SUBMISSIONS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveSubmission = async (submission: StudentSubmission): Promise<void> => {
  const subs = getSubmissions();
  subs.unshift(submission);
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(subs));

  try {
    await supabase.from('submissions').upsert({
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
  } catch (e) {
    console.error('فشل رفع التسليم سحابياً:', e);
  }
};

// بنك القصص الإسلامية
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

// مستودع الكتب
export const getBooksRepository = (): BookItem[] => {
  const data = localStorage.getItem(BOOKS_KEY);
  if (!data) {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(INITIAL_BOOKS));
    return INITIAL_BOOKS;
  }
  return JSON.parse(data);
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
