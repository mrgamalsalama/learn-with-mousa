import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, GraduationCap, Plus, Trash2, Edit3, KeyRound, 
  CheckCircle2, XCircle, Clock, Calendar, Sparkles, ShieldCheck, 
  ShieldAlert, Sliders, AlertTriangle, UserCheck, HeartHandshake,
  Search, BookOpen, Layers, BarChart3, ListTodo, Award, FileText,
  TrendingUp, Printer, Download, Check, RefreshCw, ArrowRight
} from 'lucide-react';
import { 
  School, UserProfile, SchoolStage, GradeLevel, ArabicTrack, 
  STAGES_CONFIG, TeacherTask, AIGovernanceRules, StudentSubmission,
  DEFAULT_DELEGATED_PERMISSIONS
} from '../types';
import { 
  getSchools, saveSchool, getUsers, saveUser, deleteUser,
  getTeacherTasks, getSubmissions, getAIGovernanceRules, saveAIGovernanceRules
} from '../storage';
import { AdminDelegationModal } from './AdminDelegationModal';
import { EditTeacherGradesModal } from './EditTeacherGradesModal';
import { TeacherTasksManager } from './TeacherTasksManager';

interface SchoolAdminPortalProps {
  currentUser: UserProfile;
  impersonatedSchool?: School | null;
  onExitImpersonation?: () => void;
  onLogout?: () => void;
  onUserProfileClick?: () => void;
  renderLogo?: () => React.ReactNode;
}

export const SchoolAdminPortal: React.FC<SchoolAdminPortalProps> = ({
  currentUser,
  impersonatedSchool,
  onExitImpersonation,
  onLogout,
  onUserProfileClick,
  renderLogo
}) => {
  const [schools, setSchools] = useState<School[]>(() => getSchools());
  const [users, setUsers] = useState<UserProfile[]>(() => getUsers());
  const [teacherTasks, setTeacherTasks] = useState<TeacherTask[]>(() => getTeacherTasks());
  const [submissions, setSubmissions] = useState<StudentSubmission[]>(() => getSubmissions());
  const [governanceRules, setGovernanceRules] = useState<AIGovernanceRules>(() => getAIGovernanceRules());

  // Active School Data
  const currentSchool = useMemo(() => {
    return schools.find(s => s.id === currentUser.school_id) || {
      id: currentUser.school_id || '00000000-0000-0000-0000-000000000001',
      name: 'مدرستي النموذجية',
      slug: 'my-school',
      status: 'active' as const,
      plan_tier: 'annual' as const,
      subscription_start_date: '2026-01-01T00:00:00.000Z',
      subscription_end_date: '2027-12-31T23:59:59.000Z',
      ai_enabled: true,
      max_students: 500,
      created_at: '2026-01-01T00:00:00.000Z'
    };
  }, [schools, currentUser.school_id]);

  // Main Tabs: 1. الكادر والمستخدمين | 2. حوكمة الذكاء الاصطناعي | 3. التقارير المدرسية
  const [mainTab, setMainTab] = useState<'users' | 'ai_controls' | 'reports'>('users');

  // Sub Tab inside Users: teachers | hods | students | parents | tasks
  const [usersSubTab, setUsersSubTab] = useState<'teachers' | 'hods' | 'students' | 'parents' | 'tasks'>('teachers');

  // Search in user list
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Modals
  const [isDelegationModalOpen, setIsDelegationModalOpen] = useState(false);
  const [selectedUserForDelegation, setSelectedUserForDelegation] = useState<UserProfile | null>(null);
  const [isGradesModalOpen, setIsGradesModalOpen] = useState(false);
  const [selectedTeacherForGrades, setSelectedTeacherForGrades] = useState<UserProfile | null>(null);

  // Success Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Add User Form State (Scoped exclusively to currentSchool.id)
  const [formRole, setFormRole] = useState<'teacher' | 'hod' | 'student' | 'parent'>('teacher');
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('123');
  const [formStage, setFormStage] = useState<SchoolStage>('primary');
  const [formGrade, setFormGrade] = useState<GradeLevel>('grade-1');
  const [formTrack, setFormTrack] = useState<ArabicTrack>('arabic-a');
  const [selectedGrades, setSelectedGrades] = useState<GradeLevel[]>(['grade-1', 'grade-2']);
  const [selectedTracks, setSelectedTracks] = useState<ArabicTrack[]>(['arabic-a']);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Filter users to current school ONLY
  const schoolUsers = useMemo(() => {
    return users.filter(u => u.school_id === currentSchool.id);
  }, [users, currentSchool.id]);

  const teachersList = useMemo(() => schoolUsers.filter(u => u.role === 'teacher'), [schoolUsers]);
  const hodsList = useMemo(() => schoolUsers.filter(u => u.role === 'hod'), [schoolUsers]);
  const studentsList = useMemo(() => schoolUsers.filter(u => u.role === 'student'), [schoolUsers]);
  const parentsList = useMemo(() => schoolUsers.filter(u => u.role === 'parent'), [schoolUsers]);

  // Set default student for parent form
  useEffect(() => {
    if (studentsList.length > 0 && !selectedStudentId) {
      setSelectedStudentId(studentsList[0].id);
    }
  }, [studentsList, selectedStudentId]);

  // Handle Add User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim()) return;

    const newId = `usr_${formRole}_${Date.now()}`;
    const newUser: UserProfile = {
      id: newId,
      name: formName.trim(),
      username: formUsername.trim(),
      password: formPassword.trim() || '123',
      role: formRole,
      school_id: currentSchool.id, // عزْلٌ تامّ داخل نطاق المدرسة
      loginCount: 0,
      delegated_admin_permissions: { ...DEFAULT_DELEGATED_PERMISSIONS }
    };

    if (formRole === 'teacher' || formRole === 'hod') {
      newUser.allowedStages = [formStage];
      newUser.allowedGrades = selectedGrades;
      newUser.allowedTracks = selectedTracks;
    } else if (formRole === 'student') {
      newUser.stage = formStage;
      newUser.grade = formGrade;
      newUser.track = formTrack;
    } else if (formRole === 'parent') {
      newUser.studentId = selectedStudentId || undefined;
    }

    await saveUser(newUser);
    setUsers(getUsers());

    // Reset Form
    setFormName('');
    setFormUsername('');
    setFormPassword('123');
    showToast(`تمت إضافة حساب ${newUser.name} بنجاح إلى منظومة ${currentSchool.name}`);
  };

  // Handle Delete User
  const handleDeleteUser = async (userId: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف حساب (${name})؟`)) {
      await deleteUser(userId);
      setUsers(getUsers());
      showToast(`تم حذف الحساب بنجاح`);
    }
  };

  // Granular AI Controls: Toggle School Master AI Switch
  const handleToggleSchoolAi = async () => {
    const updatedSchool: School = {
      ...currentSchool,
      ai_enabled: !currentSchool.ai_enabled
    };
    await saveSchool(updatedSchool);
    setSchools(getSchools());
    showToast(
      updatedSchool.ai_enabled
        ? `تم تشغيل الذكاء الاصطناعي لمدرسة ${currentSchool.name}`
        : `تم إيقاف مفتاح الذكاء الاصطناعي لمدرسة ${currentSchool.name}`
    );
  };

  // Granular Sub-Switches: Teacher AI, Student AI, Parent AI
  const handleToggleSubAiRule = async (key: 'teacher_ai_enabled' | 'student_ai_enabled' | 'parent_ai_enabled') => {
    const updated = {
      ...governanceRules,
      [key]: !governanceRules[key],
      updated_at: new Date().toISOString(),
      updated_by: `school_admin_${currentSchool.slug}`
    };
    setGovernanceRules(updated);
    await saveAIGovernanceRules(updated);
    showToast('تم تحديث إعدادات الحوكمة الدقيقة للذكاء الاصطناعي بالمدرسة بنجاح');
  };

  // Granular Individual User AI Exception
  const handleUserAiStatusChange = async (targetUser: UserProfile, newStatus: 'inherit' | 'allowed' | 'blocked') => {
    const updatedUser: UserProfile = {
      ...targetUser,
      ai_access_status: newStatus
    };
    await saveUser(updatedUser);
    setUsers(getUsers());
    showToast(`تم تعديل صلاحية الذكاء الاصطناعي للمستخدم ${targetUser.name}`);
  };

  // Filtered Users for List Display
  const getFilteredList = (list: UserProfile[]) => {
    if (!userSearchQuery.trim()) return list;
    const q = userSearchQuery.toLowerCase();
    return list.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  };

  const daysLeft = currentSchool.subscription_end_date 
    ? Math.ceil((new Date(currentSchool.subscription_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 365;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans" dir="rtl">
      {/* Impersonation Banner for Super Admin */}
      {impersonatedSchool && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md sticky top-0 z-40 border-b border-amber-400/40 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-white/20 text-white shadow-xs">
              <ShieldCheck className="w-5 h-5 text-white" />
            </span>
            <span className="text-xs sm:text-sm font-extrabold">
              أنت تتصفح مدرسة <span className="bg-white/20 px-2 py-0.5 rounded-md underline underline-offset-4">{impersonatedSchool.name}</span> بصفتك المؤسس العام 🛡️
            </span>
          </div>

          {onExitImpersonation && (
            <button
              onClick={onExitImpersonation}
              className="py-1.5 px-4 bg-white hover:bg-amber-50 text-amber-950 font-black rounded-xl text-xs transition shadow-md flex items-center gap-2 border border-white/40 cursor-pointer"
            >
              <span>العودة للوحة الرئيسية (/super-admin)</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          )}
        </div>
      )}

      {/* Toast Notice */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-2xl animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          {renderLogo ? renderLogo() : (
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
              <Building2 className="w-6 h-6" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base text-slate-900">
                بوابة الإدارة العليا للمدرسة | {currentSchool.name}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                currentSchool.status === 'active' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {currentSchool.status === 'active' ? '● مدرسة نشطة' : '⛔ معلقة'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <span>مدير المدرسة: <b className="text-slate-800">{currentUser.name}</b></span>
              <span>•</span>
              <span className="text-indigo-600 font-semibold">{currentSchool.slug}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {onUserProfileClick && (
            <button
              onClick={onUserProfileClick}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>الملف الشخصي</span>
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition"
            >
              تسجيل خروج
            </button>
          )}
        </div>
      </header>

      {/* Main Tabs Navigation Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 sticky top-[73px] z-20 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMainTab('users')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                mainTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>إدارة المستخدمين والكادر ({schoolUsers.length})</span>
            </button>

            <button
              onClick={() => setMainTab('ai_controls')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                mainTab === 'ai_controls'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  : !currentSchool.ai_enabled
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>الحوكمة الدقيقة للذكاء الاصطناعي (AI Controls)</span>
              {!currentSchool.ai_enabled && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => setMainTab('reports')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 ${
                mainTab === 'reports'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>التقارير المدرسية الشاملة ومخرجات اللغة العربية 📊</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-semibold">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span>باقي على الاشتراك: <b className="text-slate-800">{daysLeft > 0 ? `${daysLeft} يوم` : 'منتهي'}</b></span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* ================= TAB 1: USERS & STAFF MANAGEMENT ================= */}
        {mainTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Add User Form */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs sticky top-36">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-extrabold text-base flex items-center gap-2 text-slate-900">
                    <Plus className="w-5 h-5 text-indigo-600" /> إضافة مستخدم لكادر المدرسة
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                    نطاق: {currentSchool.name}
                  </span>
                </div>

                {/* Role Switcher */}
                <div className="grid grid-cols-2 gap-1.5 mb-5">
                  <button
                    type="button"
                    onClick={() => setFormRole('teacher')}
                    className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      formRole === 'teacher' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" /> معلم
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRole('hod')}
                    className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      formRole === 'hod' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" /> رئيس قسم
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRole('student')}
                    className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      formRole === 'student' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" /> طالب
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRole('parent')}
                    className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      formRole === 'parent' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <HeartHandshake className="w-3.5 h-3.5" /> ولي أمر
                  </button>
                </div>

                <form onSubmit={handleAddUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أ. مريم العتيبي أو الطالب خالد"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">اسم الدخول (Username)</label>
                      <input
                        type="text"
                        required
                        placeholder="t_maryam"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">كلمة السر</label>
                      <input
                        type="text"
                        required
                        placeholder="123"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {(formRole === 'teacher' || formRole === 'hod') && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">المسار المصرح به:</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTracks(prev => 
                                prev.includes('arabic-a') ? prev.filter(t => t !== 'arabic-a') : [...prev, 'arabic-a']
                              );
                            }}
                            className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                              selectedTracks.includes('arabic-a') ? 'bg-indigo-50 border-indigo-500 text-indigo-900' : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <span>ناطقين (Arabic A)</span>
                            {selectedTracks.includes('arabic-a') && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTracks(prev => 
                                prev.includes('arabic-b') ? prev.filter(t => t !== 'arabic-b') : [...prev, 'arabic-b']
                              );
                            }}
                            className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                              selectedTracks.includes('arabic-b') ? 'bg-indigo-50 border-indigo-500 text-indigo-900' : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <span>غير ناطقين (Arabic B)</span>
                            {selectedTracks.includes('arabic-b') && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">الصفوف المصرح بها:</label>
                        <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 border border-slate-100 rounded-xl">
                          {['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6'].map(gId => (
                            <button
                              key={gId}
                              type="button"
                              onClick={() => {
                                setSelectedGrades(prev => 
                                  prev.includes(gId as GradeLevel) ? prev.filter(g => g !== gId) : [...prev, gId as GradeLevel]
                                );
                              }}
                              className={`p-1.5 rounded-lg border text-[11px] font-bold transition flex items-center justify-between ${
                                selectedGrades.includes(gId as GradeLevel) 
                                  ? 'bg-indigo-600 text-white border-indigo-600' 
                                  : 'bg-white text-slate-600 border-slate-200'
                              }`}
                            >
                              <span>{gId.replace('grade-', 'الصف ')}</span>
                              {selectedGrades.includes(gId as GradeLevel) && <Check className="w-3 h-3 text-white" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {formRole === 'student' && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">المرحلة والصف</label>
                        <select
                          value={formGrade}
                          onChange={(e) => setFormGrade(e.target.value as GradeLevel)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium"
                        >
                          <option value="grade-1">الصف الأول الابتدائي</option>
                          <option value="grade-2">الصف الثاني الابتدائي</option>
                          <option value="grade-3">الصف الثالث الابتدائي</option>
                          <option value="grade-4">الصف الرابع الابتدائي</option>
                          <option value="grade-5">الصف الخامس الابتدائي</option>
                          <option value="grade-6">الصف السادس الابتدائي</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">المسار اللغوي</label>
                        <select
                          value={formTrack}
                          onChange={(e) => setFormTrack(e.target.value as ArabicTrack)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium"
                        >
                          <option value="arabic-a">الناطقين باللغة العربية (Arabic A)</option>
                          <option value="arabic-b">الناطقين بغيرها (Arabic B)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {formRole === 'parent' && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1">اختر الطالب التابع له بالمدرسة:</label>
                      {studentsList.length === 0 ? (
                        <p className="text-xs text-rose-500 font-medium">يجب تسجيل طلاب في المدرسة أولاً.</p>
                      ) : (
                        <select
                          value={selectedStudentId}
                          onChange={(e) => setSelectedStudentId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold"
                        >
                          {studentsList.map(st => (
                            <option key={st.id} value={st.id}>
                              {st.name} ({st.grade})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition shadow-md shadow-indigo-600/20"
                  >
                    حفظ وتأكيد الحساب في المدرسة
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: User Lists & Tasks */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
                
                {/* User Tabs Filter */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-4 border-b border-slate-100">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setUsersSubTab('teachers')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                        usersSubTab === 'teachers' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      المعلمون ({teachersList.length})
                    </button>
                    <button
                      onClick={() => setUsersSubTab('hods')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                        usersSubTab === 'hods' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      رؤساء الأقسام ({hodsList.length})
                    </button>
                    <button
                      onClick={() => setUsersSubTab('students')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                        usersSubTab === 'students' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      الطلاب ({studentsList.length})
                    </button>
                    <button
                      onClick={() => setUsersSubTab('parents')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                        usersSubTab === 'parents' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      أولياء الأمور ({parentsList.length})
                    </button>
                    <button
                      onClick={() => setUsersSubTab('tasks')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                        usersSubTab === 'tasks' ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
                      }`}
                    >
                      <ListTodo className="w-3.5 h-3.5" />
                      <span>مهام وتكليفات المعلمين</span>
                    </button>
                  </div>

                  {usersSubTab !== 'tasks' && (
                    <div className="relative w-full sm:w-56 mt-2 sm:mt-0">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="ابحث بالاسم..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>

                {/* SubTab 1: Teachers */}
                {usersSubTab === 'teachers' && (
                  <div className="space-y-3">
                    {getFilteredList(teachersList).map(t => (
                      <div key={t.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm text-slate-900">{t.name}</h4>
                            <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold">معلم مادة</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            اسم الدخول: <b>{t.username}</b> • كلمة السر: <b>{t.password}</b>
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {t.allowedGrades?.map(g => (
                              <span key={g} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold">
                                {g.replace('grade-', 'الصف ')}
                              </span>
                            ))}
                            {t.allowedTracks?.map(tr => (
                              <span key={tr} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold">
                                {tr === 'arabic-a' ? 'ناطقين A' : 'غير ناطقين B'}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => {
                              setSelectedTeacherForGrades(t);
                              setIsGradesModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 transition"
                            title="تعديل الصفوف والمسارات"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>الصفوف</span>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(t.id, t.name)}
                            className="p-1.5 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 transition"
                            title="حذف الحساب"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {teachersList.length === 0 && (
                      <p className="text-center py-8 text-xs text-slate-400">لا يوجد معلمون مسجلون في هذه المدرسة حتى الآن.</p>
                    )}
                  </div>
                )}

                {/* SubTab 2: HODs */}
                {usersSubTab === 'hods' && (
                  <div className="space-y-3">
                    {getFilteredList(hodsList).map(h => (
                      <div key={h.id} className="p-4 rounded-2xl border border-purple-100 bg-purple-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm text-slate-900">{h.name}</h4>
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold">رئيس قسم</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            اسم الدخول: <b>{h.username}</b> • كلمة السر: <b>{h.password}</b>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => {
                              setSelectedUserForDelegation(h);
                              setIsDelegationModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs flex items-center gap-1 shadow-xs hover:bg-purple-700 transition"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>تفويض الصلاحيات</span>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(h.id, h.name)}
                            className="p-1.5 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {hodsList.length === 0 && (
                      <p className="text-center py-8 text-xs text-slate-400">لم يتم تعيين رؤساء أقسام بعد.</p>
                    )}
                  </div>
                )}

                {/* SubTab 3: Students */}
                {usersSubTab === 'students' && (
                  <div className="space-y-3">
                    {getFilteredList(studentsList).map(st => (
                      <div key={st.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">{st.name}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            اسم الدخول: <b>{st.username}</b> • كلمة السر: <b>{st.password}</b>
                          </p>
                          <div className="flex gap-2 mt-2">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold">
                              {st.grade?.replace('grade-', 'الصف ') || 'ابتدائي'}
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                              {st.track === 'arabic-a' ? 'ناطقين (A)' : 'غير ناطقين (B)'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteUser(st.id, st.name)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {studentsList.length === 0 && (
                      <p className="text-center py-8 text-xs text-slate-400">لا يوجد طلاب مسجلون في المدرسة حالياً.</p>
                    )}
                  </div>
                )}

                {/* SubTab 4: Parents */}
                {usersSubTab === 'parents' && (
                  <div className="space-y-3">
                    {getFilteredList(parentsList).map(p => {
                      const linked = studentsList.find(s => s.id === p.studentId);
                      return (
                        <div key={p.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900">{p.name}</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              اسم الدخول: <b>{p.username}</b> • كلمة السر: <b>{p.password}</b>
                            </p>
                            <p className="text-xs text-emerald-700 font-semibold mt-1">
                              ولي أمر: <b>{linked ? linked.name : 'غير محدد'}</b>
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteUser(p.id, p.name)}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                    {parentsList.length === 0 && (
                      <p className="text-center py-8 text-xs text-slate-400">لم يتم تسجيل أولياء أمور بعد.</p>
                    )}
                  </div>
                )}

                {/* SubTab 5: Teacher Tasks Manager */}
                {usersSubTab === 'tasks' && (
                  <div>
                    <TeacherTasksManager
                      actorUser={currentUser}
                      teachers={teachersList}
                      onTasksUpdated={() => setTeacherTasks(getTeacherTasks())}
                    />
                  </div>
                )}

              </div>
            </div>

          </div>
        )}

        {/* ================= TAB 2: GRANULAR SCHOOL AI CONTROLS ================= */}
        {mainTab === 'ai_controls' && (
          <div className="space-y-6">
            
            {/* Master School AI Kill Switch Banner */}
            <div className={`p-6 sm:p-8 rounded-3xl border transition-all ${
              currentSchool.ai_enabled 
                ? 'bg-gradient-to-l from-emerald-950 via-slate-900 to-slate-900 text-white border-emerald-500/30'
                : 'bg-gradient-to-l from-rose-950 via-slate-900 to-slate-900 text-white border-rose-500/40'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                      currentSchool.ai_enabled 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                    }`}>
                      {currentSchool.ai_enabled ? 'مفتاح الذكاء الاصطناعي مفعّل للمدرسة' : '⛔ مفتاح الطوارئ: الذكاء الاصطناعي معطل للمدرسة ككل'}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black mb-2">
                    مفتاح التعطيل الشامل لمدرسة {currentSchool.name} (School Master AI Switch)
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                    يتيح لك كمدير مدرسة إيقاف أو تشغيل كافة قدرات الذكاء الاصطناعي (Gemini AI Suite) الخاصة بمدرستك فوراً في حالات الطوارئ أو فترات الامتحانات الرسمية.
                  </p>
                </div>

                <button
                  onClick={handleToggleSchoolAi}
                  className={`py-3 px-6 rounded-2xl font-black text-xs transition shadow-lg flex items-center gap-2 ${
                    currentSchool.ai_enabled
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span>{currentSchool.ai_enabled ? 'إيقاف الذكاء الاصطناعي للمدرسة ككل ⛔' : 'إعادة تفعيل الذكاء الاصطناعي للمدرسة ⚡'}</span>
                </button>
              </div>
            </div>

            {/* Granular Sub-Switches Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Teacher AI Control */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-700">
                      <Users className="w-5 h-5" />
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                      governanceRules.teacher_ai_enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {governanceRules.teacher_ai_enabled ? 'مفعّل للمعلمين' : 'معطل'}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-base text-slate-900 mb-1">الذكاء الاصطناعي للمعلمين</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    توليد الاختبارات الآلية، التشكيل الإعرابي الذكي، بنك الأسئلة، وتحضير الأنشطة التعليمية لمخرجات اللغة العربية.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">حالة المفتاح الفرعي:</span>
                  <button
                    onClick={() => handleToggleSubAiRule('teacher_ai_enabled')}
                    disabled={!currentSchool.ai_enabled}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                      governanceRules.teacher_ai_enabled
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {governanceRules.teacher_ai_enabled ? 'تعطيل عن المعلمين' : 'تفعيل للمعلمين'}
                  </button>
                </div>
              </div>

              {/* Student AI Control */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="p-2.5 rounded-2xl bg-amber-50 text-amber-700">
                      <GraduationCap className="w-5 h-5" />
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                      governanceRules.student_ai_enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {governanceRules.student_ai_enabled ? 'مفعّل للطلاب' : 'معطل عن الطلاب'}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-base text-slate-900 mb-1">الذكاء الاصطناعي للطلاب</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    المحادثة الصوتية مع رفيق موسى الذكي، توليد القصص التفاعلية التكيفية، وتحديات النطق الصوتي الفوري.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">حالة المفتاح الفرعي:</span>
                  <button
                    onClick={() => handleToggleSubAiRule('student_ai_enabled')}
                    disabled={!currentSchool.ai_enabled}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                      governanceRules.student_ai_enabled
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {governanceRules.student_ai_enabled ? 'تعطيل عن الطلاب' : 'تفعيل للطلاب'}
                  </button>
                </div>
              </div>

              {/* Parent AI Control */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="p-2.5 rounded-2xl bg-teal-50 text-teal-700">
                      <HeartHandshake className="w-5 h-5" />
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                      governanceRules.parent_ai_enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {governanceRules.parent_ai_enabled ? 'مفعّل لأولياء الأمور' : 'معطل'}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-base text-slate-900 mb-1">التقارير الذكية لأولياء الأمور</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    التحليل التوليدي لنقاط قوة وضعف الطالب القرائية والصوتية ومقترحات تعزيز مهارات الفصحى بالمنزل.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">حالة المفتاح الفرعي:</span>
                  <button
                    onClick={() => handleToggleSubAiRule('parent_ai_enabled')}
                    disabled={!currentSchool.ai_enabled}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                      governanceRules.parent_ai_enabled
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {governanceRules.parent_ai_enabled ? 'تعطيل لأولياء الأمور' : 'تفعيل'}
                  </button>
                </div>
              </div>

            </div>

            {/* Individual AI Exceptions Table */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <h4 className="font-extrabold text-base text-slate-900 mb-2 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <span>التحكم الفردي والاستثناءات الخاصة بالذكاء الاصطناعي لكادر وطلاب المدرسة</span>
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                يمكنك كمدير للمدرسة استثناء طلاب أو معلمين محددين بالسماح الدائم أو المنع الفردي بغض النظر عن القواعد العامة.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-extrabold">الاسم</th>
                      <th className="p-3 font-extrabold">الدور</th>
                      <th className="p-3 font-extrabold">المرحلة / الصف</th>
                      <th className="p-3 font-extrabold">إعداد الوصول للـ AI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schoolUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-800">{u.name}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">
                          {u.grade ? u.grade.replace('grade-', 'الصف ') : 'كادر تعليمي'}
                        </td>
                        <td className="p-3">
                          <select
                            value={u.ai_access_status || 'inherit'}
                            onChange={(e) => handleUserAiStatusChange(u, e.target.value as any)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                          >
                            <option value="inherit">تلقائي (يرث إعداد المدرسة)</option>
                            <option value="allowed">مسموح دائماً ⚡</option>
                            <option value="blocked">محظور فردياً ⛔</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ================= TAB 3: COMPREHENSIVE SCHOOL REPORTS ================= */}
        {mainTab === 'reports' && (
          <div className="space-y-6">
            
            {/* Header Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                <span className="text-xs font-bold text-slate-500 block mb-1">إجمالي طلاب المدرسة</span>
                <span className="text-3xl font-black text-slate-900">{studentsList.length}</span>
                <span className="text-[11px] text-slate-400 block mt-1">سعة المدرسة: {currentSchool.max_students}</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-xs">
                <span className="text-xs font-bold text-emerald-700 block mb-1">مسار الناطقين (Arabic A)</span>
                <span className="text-3xl font-black text-emerald-600">
                  {studentsList.filter(s => s.track === 'arabic-a').length}
                </span>
                <span className="text-[11px] text-emerald-600/70 block mt-1">منهاج الفصحى المتقدم</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-xs">
                <span className="text-xs font-bold text-amber-700 block mb-1">مسار غير الناطقين (Arabic B)</span>
                <span className="text-3xl font-black text-amber-600">
                  {studentsList.filter(s => s.track === 'arabic-b').length}
                </span>
                <span className="text-[11px] text-amber-600/70 block mt-1">التأسيس القرائي والصوتي</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-indigo-100 shadow-xs">
                <span className="text-xs font-bold text-indigo-700 block mb-1">تسليمات واختبارات منجزة</span>
                <span className="text-3xl font-black text-indigo-600">
                  {submissions.filter(s => studentsList.some(st => st.id === s.studentId)).length}
                </span>
                <span className="text-[11px] text-indigo-600/70 block mt-1">تقييمات آلية مسجلة</span>
              </div>
            </div>

            {/* Detailed Arabic Outputs & Class Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
                <h4 className="font-extrabold text-base text-slate-900 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <span>مخرجات مادة اللغة العربية حسب الصفوف</span>
                </h4>

                <div className="space-y-4">
                  {[
                    { grade: 'الصف الأول الابتدائي', rate: 94, track: 'Arabic A - وعي صوتي وحركات' },
                    { grade: 'الصف الثاني الابتدائي', rate: 88, track: 'Arabic A - قراءة وسرد قصصي' },
                    { grade: 'الصف الثاني الابتدائي', rate: 82, track: 'Arabic B - التأسيس الصوتي' },
                    { grade: 'الصف الثالث الابتدائي', rate: 91, track: 'Arabic A - الإملاء والمدود' }
                  ].map((row, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-800">{row.grade} ({row.track})</span>
                        <span className="text-emerald-700 font-extrabold">{row.rate}% نسبة الإتقان</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${row.rate}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
                <h4 className="font-extrabold text-base text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <span>نشاط المعلمين والتكليفات المنجزة</span>
                </h4>

                <div className="space-y-3">
                  {teachersList.map(t => {
                    const tasksForTeacher = teacherTasks.filter(task => task.teacherId === t.id);
                    const completed = tasksForTeacher.filter(task => task.completed).length;
                    return (
                      <div key={t.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                        <div>
                          <h5 className="font-extrabold text-xs text-slate-900">{t.name}</h5>
                          <span className="text-[11px] text-slate-500">
                            المهام الإدارية: {completed} / {tasksForTeacher.length || 1} منجزة
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold">
                          نشط هذا الأسبوع
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Submissions Log Table */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <span>سجل تسليمات وتقييمات الطلاب الأخيرة</span>
                </h4>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>طباعة التقرير</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-extrabold">اسم الطالب</th>
                      <th className="p-3 font-extrabold">النشاط / الاختبار</th>
                      <th className="p-3 font-extrabold">الدرجة</th>
                      <th className="p-3 font-extrabold">تاريخ التسليم</th>
                      <th className="p-3 font-extrabold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissions.slice(0, 8).map(sub => {
                      const student = studentsList.find(s => s.id === sub.studentId) || { name: 'موسى البطل 🌟' };
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-800">{student.name}</td>
                          <td className="p-3 text-slate-600">{sub.activityTitle || 'اختبار مهارات القراءة'}</td>
                          <td className="p-3 font-extrabold text-emerald-600">
                            {sub.score !== undefined ? `${sub.score} / ${sub.totalPoints || 10}` : '10 / 10'}
                          </td>
                          <td className="p-3 text-slate-400">
                            {new Date(sub.submittedAt).toLocaleDateString('ar-SA')}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              تم التصحيح والاعتماد
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Delegation Modal */}
      {isDelegationModalOpen && selectedUserForDelegation && (
        <AdminDelegationModal
          isOpen={isDelegationModalOpen}
          user={selectedUserForDelegation}
          adminUser={currentUser}
          onClose={() => {
            setIsDelegationModalOpen(false);
            setSelectedUserForDelegation(null);
          }}
          onSaved={(updatedUser) => {
            setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
            showToast('تم تحديث وتفويض الصلاحيات الإدارية بنجاح');
          }}
        />
      )}

      {/* Edit Teacher Grades Modal */}
      {isGradesModalOpen && selectedTeacherForGrades && (
        <EditTeacherGradesModal
          isOpen={isGradesModalOpen}
          teacher={selectedTeacherForGrades}
          actorUser={currentUser}
          onClose={() => {
            setIsGradesModalOpen(false);
            setSelectedTeacherForGrades(null);
          }}
          onSaved={(updatedTeacher) => {
            setUsers(prev => prev.map(u => u.id === updatedTeacher.id ? updatedTeacher : u));
            showToast('تم حفظ الصفوف والمسارات المعتمدة للمعلم');
          }}
        />
      )}

    </div>
  );
};
