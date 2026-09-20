import { UserProfile, DelegatedAdminPermissions, DEFAULT_DELEGATED_PERMISSIONS } from '../types';

/**
 * فحص صلاحية تعديل صفوف ومراحل ومسارات المعلمين:
 * محصورة في الإدارة العليا ورئيس القسم، أو أي مستخدم فُوِّضت له الصلاحية صراحة.
 */
export function canManageTeacherGrades(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'hod') return true;
  return Boolean(user.delegated_admin_permissions?.can_manage_teacher_grades);
}

/**
 * فحص صلاحية إدارة وإسناد وحذف مهام المعلمين:
 * محصورة في الإدارة العليا ورئيس القسم، أو أي مستخدم فُوِّضت له الصلاحية صراحة.
 * المعلم العادي لا يملك أي صلاحية لإضافة أو حذف المهام.
 */
export function canManageTeacherTasks(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'hod') return true;
  return Boolean(user.delegated_admin_permissions?.can_manage_teacher_tasks);
}

/**
 * فحص صلاحية التحكم في حوكمة وقواعد الذكاء الاصطناعي وزر الطوارئ (Killswitch):
 * محصورة في الإدارة العليا حصراً، ما لم يتم تفويضها يدوياً للمستخدم.
 */
export function canControlAIGovernance(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return Boolean(user.delegated_admin_permissions?.can_control_ai_governance);
}

/**
 * فحص صلاحية إنشاء أو ترقية حسابات رؤساء الأقسام (HOD):
 * محصورة في الإدارة العليا حصراً، ما لم يتم تفويضها يدوياً للمستخدم.
 */
export function canCreateHOD(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return Boolean(user.delegated_admin_permissions?.can_create_hod);
}

/**
 * حساب عدد الصلاحيات الإدارية المفوضة للمستخدم
 */
export function countDelegatedPermissions(perms?: DelegatedAdminPermissions): number {
  if (!perms) return 0;
  let count = 0;
  if (perms.can_manage_teacher_grades) count++;
  if (perms.can_manage_teacher_tasks) count++;
  if (perms.can_control_ai_governance) count++;
  if (perms.can_create_hod) count++;
  return count;
}

/**
 * التحقق مما إذا كان لدى المستخدم أي صلاحية مفوضة نشطة
 */
export function hasAnyDelegatedPrivilege(user: UserProfile | null): boolean {
  if (!user || !user.delegated_admin_permissions) return false;
  return countDelegatedPermissions(user.delegated_admin_permissions) > 0;
}

/**
 * تطهير وضمان كائن صلاحيات سليم بقيم افتراضية صارمة false
 */
export function sanitizeDelegatedPermissions(raw?: any): DelegatedAdminPermissions {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_DELEGATED_PERMISSIONS };
  }
  return {
    can_manage_teacher_grades: Boolean(raw.can_manage_teacher_grades),
    can_manage_teacher_tasks: Boolean(raw.can_manage_teacher_tasks),
    can_control_ai_governance: Boolean(raw.can_control_ai_governance),
    can_create_hod: Boolean(raw.can_create_hod),
  };
}
