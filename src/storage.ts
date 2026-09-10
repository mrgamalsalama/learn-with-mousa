import { UserProfile } from './types';

const USERS_KEY = 'lwm_users_data';
const CURRENT_USER_KEY = 'lwm_current_user';

// الحساب الافتراضي للمشرف العام
const DEFAULT_ADMIN: UserProfile = {
  id: 'admin-1',
  name: 'جمال سلامة (المشرف العام)',
  username: 'admin',
  password: '123',
  role: 'super_admin',
};

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
