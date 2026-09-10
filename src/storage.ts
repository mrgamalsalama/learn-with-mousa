import { UserProfile, Activity, StudentSubmission } from './types';

const USERS_KEY = 'lwm_users_data';
const CURRENT_USER_KEY = 'lwm_current_user';
const ACTIVITIES_KEY = 'lwm_activities_data';
const SUBMISSIONS_KEY = 'lwm_submissions_data';

// الحساب الافتراضي للمشرف العام
const DEFAULT_ADMIN: UserProfile = {
  id: 'admin-1',
  name: 'جمال سلامة (المشرف العام)',
  username: 'admin',
  password: '123',
  role: 'super_admin',
};

// --- دوال إدارة المستخدمين ---
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

export function setCurrentUser(user: UserProfile | null): void {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

// --- دوال إدارة الأنشطة التفاعلية ---
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

// --- دوال رصد نتائج وحلول الطلاب ---
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
