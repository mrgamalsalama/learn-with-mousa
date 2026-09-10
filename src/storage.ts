import { UserProfile, Activity, StudentSubmission, StoryBankItem, BookItem, GradeLevel, ArabicTrack } from './types';
import { INITIAL_STORY_BANK } from './storyBank';
import { INITIAL_BOOKS } from './booksData';

const USERS_KEY = 'lwm_users_data';
const CURRENT_USER_KEY = 'lwm_current_user';
const ACTIVITIES_KEY = 'lwm_activities_data';
const SUBMISSIONS_KEY = 'lwm_submissions_data';
const STORY_BANK_KEY = 'lwm_story_bank_data';
const BOOKS_KEY = 'lwm_books_repository';

const DEFAULT_ADMIN: UserProfile = {
  id: 'admin-1',
  name: 'جمال سلامة (المؤسس والمشرف العام)',
  username: 'admin',
  password: '123',
  role: 'super_admin',
  loginCount: 1,
  lastLogin: new Date().toLocaleString('ar-EG'),
};

// --- المستخدمون ---
export function getUsers(): UserProfile[] {
  try {
    const data = localStorage.getItem(USERS_KEY);
    if (!data) {
      localStorage.setItem(USERS_KEY, JSON.stringify([DEFAULT_ADMIN]));
      return [DEFAULT_ADMIN];
    }
    return JSON.parse(data);
  } catch {
    return [DEFAULT_ADMIN];
  }
}

export function saveUser(user: UserProfile): void {
  const users = getUsers();
  const index = users.findIndex((u) => u.id === user.id);
  if (index >= 0) {
    users[index] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function deleteUser(id: string): void {
  const users = getUsers().filter((u) => u.id !== id);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentUser(): UserProfile | null {
  try {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function recordUserLogin(user: UserProfile): UserProfile {
  const nowStr = new Date().toLocaleString('ar-EG');
  const updatedUser: UserProfile = {
    ...user,
    loginCount: (user.loginCount || 0) + 1,
    lastLogin: nowStr,
  };
  saveUser(updatedUser);
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
  return updatedUser;
}

export function setCurrentUser(user: UserProfile | null): void {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

// --- بنك القصص الإسلامية ---
export function getStoryBank(): StoryBankItem[] {
  try {
    const data = localStorage.getItem(STORY_BANK_KEY);
    if (!data) {
      localStorage.setItem(STORY_BANK_KEY, JSON.stringify(INITIAL_STORY_BANK));
      return INITIAL_STORY_BANK;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_STORY_BANK;
  }
}

export function saveStoryBankItem(item: StoryBankItem): void {
  const bank = getStoryBank();
  const index = bank.findIndex((s) => s.id === item.id);
  if (index >= 0) {
    bank[index] = item;
  } else {
    bank.unshift(item);
  }
  localStorage.setItem(STORY_BANK_KEY, JSON.stringify(bank));
}

// --- مستودع الكتب الرقمية الشامل (بوك تايم والمكتبة الرقمية) ---
export function getBooksRepository(): BookItem[] {
  try {
    const data = localStorage.getItem(BOOKS_KEY);
    if (!data) {
      localStorage.setItem(BOOKS_KEY, JSON.stringify(INITIAL_BOOKS));
      return INITIAL_BOOKS;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_BOOKS;
  }
}

export function saveBooksRepository(books: BookItem[]): void {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
}

// دالة تحكم المعلم في إسناد الكتاب لصف ومسار معين أو إلغائه
export function updateBookAssignment(
  bookId: string, 
  grades: GradeLevel[], 
  tracks: ArabicTrack[], 
  teacherId: string
): void {
  const books = getBooksRepository();
  const index = books.findIndex((b) => b.id === bookId);
  if (index >= 0) {
    books[index].assignedGrades = grades;
    books[index].assignedTracks = tracks;
    books[index].assignedByTeacherId = teacherId;
    saveBooksRepository(books);
  }
}

// --- الأنشطة التفاعلية ---
export function getActivities(): Activity[] {
  try {
    const data = localStorage.getItem(ACTIVITIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveActivity(activity: Activity): void {
  const activities = getActivities();
  const index = activities.findIndex((a) => a.id === activity.id);
  if (index >= 0) {
    activities[index] = activity;
  } else {
    activities.unshift(activity);
  }
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
}

export function deleteActivity(id: string): void {
  const activities = getActivities().filter((a) => a.id !== id);
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
}

// --- رصد حلول الطلاب ---
export function getSubmissions(): StudentSubmission[] {
  try {
    const data = localStorage.getItem(SUBMISSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveSubmission(sub: StudentSubmission): void {
  const subs = getSubmissions();
  subs.unshift(sub);
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(subs));
}
