import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Users, GraduationCap, Building2, Plus, Trash2, Edit3, KeyRound, 
  CheckCircle2, Search, Check, AlertTriangle, BookOpen, Layers,
  Eye, EyeOff, ShieldCheck, RefreshCw, Sparkles
} from 'lucide-react';
import { 
  School, UserProfile, SchoolClass, SchoolStage, GradeLevel, ArabicTrack, 
  STAGES_CONFIG, DEFAULT_DELEGATED_PERMISSIONS 
} from '../types';
import { 
  getUsers, saveUser, deleteUser, 
  getClasses, saveClass, deleteClass 
} from '../storage';

interface SchoolStaffManagementModalProps {
  isOpen: boolean;
  school: School | null;
  onClose: () => void;
  onDataChanged?: () => void;
}

export const SchoolStaffManagementModal: React.FC<SchoolStaffManagementModalProps> = ({
  isOpen,
  school,
  onClose,
  onDataChanged
}) => {
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'classes'>('students');
  const [users, setUsers] = useState<UserProfile[]>(() => getUsers());
  const [classes, setClasses] = useState<SchoolClass[]>(() => getClasses());
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Forms Visibility
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);

  // Editing student/teacher modals
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editGrade, setEditGrade] = useState<GradeLevel>('grade-1');
  const [editTrack, setEditTrack] = useState<ArabicTrack>('arabic-a');
  const [editTeacherGrades, setEditTeacherGrades] = useState<GradeLevel[]>([]);
  const [editTeacherTracks, setEditTeacherTracks] = useState<ArabicTrack[]>([]);

  // Password reset modal
  const [passwordResetUser, setPasswordResetUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('123456');

  // Password visibility map
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // New Student Form State
  const [studentName, setStudentName] = useState('');
  const [studentUsername, setStudentUsername] = useState('');
  const [studentPassword, setStudentPassword] = useState('123');
  const [studentGrade, setStudentGrade] = useState<GradeLevel>('grade-1');
  const [studentTrack, setStudentTrack] = useState<ArabicTrack>('arabic-a');
  const [studentStage, setStudentStage] = useState<SchoolStage>('primary');

  // New Teacher Form State
  const [teacherName, setTeacherName] = useState('');
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('123456');
  const [teacherSelectedGrades, setTeacherSelectedGrades] = useState<GradeLevel[]>(['grade-1', 'grade-2']);
  const [teacherSelectedTracks, setTeacherSelectedTracks] = useState<ArabicTrack[]>(['arabic-a']);

  // New Class Form State
  const [className, setClassName] = useState('');
  const [classStage, setClassStage] = useState<SchoolStage>('primary');
  const [classGrade, setClassGrade] = useState<GradeLevel>('grade-1');
  const [classTrack, setClassTrack] = useState<ArabicTrack>('arabic-a');

  useEffect(() => {
    if (isOpen) {
      setUsers(getUsers());
      setClasses(getClasses());
      setSearchQuery('');
      setIsAddStudentOpen(false);
      setIsAddTeacherOpen(false);
      setIsAddClassOpen(false);
      setEditingUser(null);
      setPasswordResetUser(null);
    }
  }, [isOpen, school?.id]);

  if (!isOpen || !school) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const refreshLocalData = () => {
    setUsers(getUsers());
    setClasses(getClasses());
    onDataChanged?.();
  };

  // Filtered lists for this school only
  const schoolStudents = users.filter(u => u.school_id === school.id && u.role === 'student');
  const schoolTeachers = users.filter(u => u.school_id === school.id && (u.role === 'teacher' || u.role === 'hod'));
  const schoolClasses = classes.filter(c => c.school_id === school.id);

  // Search filter
  const filteredStudents = schoolStudents.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTeachers = schoolTeachers.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredClasses = schoolClasses.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Handlers: Student ---
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentUsername.trim()) return;

    const newStudent: UserProfile = {
      id: `usr_std_${Date.now()}`,
      name: studentName.trim(),
      username: studentUsername.trim(),
      password: studentPassword.trim() || '123',
      role: 'student',
      school_id: school.id,
      stage: studentStage,
      grade: studentGrade,
      track: studentTrack,
      loginCount: 0,
      delegated_admin_permissions: { ...DEFAULT_DELEGATED_PERMISSIONS }
    };

    await saveUser(newStudent);
    refreshLocalData();
    setStudentName('');
    setStudentUsername('');
    setStudentPassword('123');
    setIsAddStudentOpen(false);
    showToast(`تمت إضافة الطالب (${newStudent.name}) إلى مدرسة ${school.name}`);
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف الحساب (${name}) نهائياً من المدرسة؟`)) {
      await deleteUser(userId);
      refreshLocalData();
      showToast(`تم حذف الحساب بنجاح`);
    }
  };

  const handleOpenEditStudent = (student: UserProfile) => {
    setEditingUser(student);
    setEditGrade(student.grade || 'grade-1');
    setEditTrack(student.track || 'arabic-a');
  };

  const handleSaveEditStudent = async () => {
    if (!editingUser) return;
    const updated: UserProfile = {
      ...editingUser,
      grade: editGrade,
      track: editTrack
    };
    await saveUser(updated);
    refreshLocalData();
    setEditingUser(null);
    showToast(`تم تحديث بيانات الطالب (${editingUser.name}) بنجاح`);
  };

  // --- Handlers: Teacher ---
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName.trim() || !teacherUsername.trim()) return;

    const newTeacher: UserProfile = {
      id: `usr_tch_${Date.now()}`,
      name: teacherName.trim(),
      username: teacherUsername.trim(),
      password: teacherPassword.trim() || '123456',
      role: 'teacher',
      school_id: school.id,
      allowedStages: ['primary'],
      allowedGrades: teacherSelectedGrades,
      allowedTracks: teacherSelectedTracks,
      loginCount: 0,
      delegated_admin_permissions: { ...DEFAULT_DELEGATED_PERMISSIONS }
    };

    await saveUser(newTeacher);
    refreshLocalData();
    setTeacherName('');
    setTeacherUsername('');
    setTeacherPassword('123456');
    setIsAddTeacherOpen(false);
    showToast(`تمت إضافة المعلم (${newTeacher.name}) إلى مدرسة ${school.name}`);
  };

  const handleOpenEditTeacher = (teacher: UserProfile) => {
    setEditingUser(teacher);
    setEditTeacherGrades(teacher.allowedGrades || ['grade-1']);
    setEditTeacherTracks(teacher.allowedTracks || ['arabic-a']);
  };

  const handleSaveEditTeacher = async () => {
    if (!editingUser) return;
    const updated: UserProfile = {
      ...editingUser,
      allowedGrades: editTeacherGrades,
      allowedTracks: editTeacherTracks
    };
    await saveUser(updated);
    refreshLocalData();
    setEditingUser(null);
    showToast(`تم تحديث صفوف ومسارات المعلم (${editingUser.name})`);
  };

  // --- Handlers: Password Reset ---
  const handleSavePasswordReset = async () => {
    if (!passwordResetUser) return;
    if (!newPassword.trim()) {
      alert('يرجى كتابة كلمة مرور صالحة');
      return;
    }
    const updated: UserProfile = {
      ...passwordResetUser,
      password: newPassword.trim()
    };
    await saveUser(updated);
    refreshLocalData();
    setPasswordResetUser(null);
    setNewPassword('123456');
    showToast(`تمت إعادة تعيين كلمة المرور للمستخدم (${passwordResetUser.name}) بنجاح`);
  };

  // --- Handlers: Classes ---
  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;

    const newCls: SchoolClass = {
      id: `cls_${Date.now()}`,
      school_id: school.id,
      name: className.trim(),
      stage: classStage,
      grade: classGrade,
      track: classTrack,
      created_at: new Date().toISOString()
    };

    saveClass(newCls);
    refreshLocalData();
    setClassName('');
    setIsAddClassOpen(false);
    showToast(`تمت إضافة الفصل (${newCls.name}) بنجاح`);
  };

  const handleDeleteClass = (classId: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف الفصل (${name})؟`)) {
      deleteClass(classId);
      refreshLocalData();
      showToast(`تم حذف الفصل بنجاح`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 font-sans" dir="rtl">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-60 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white font-black text-xs flex items-center gap-2 shadow-2xl animate-fade-in border border-emerald-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scale-up">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 sm:px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black">{school.name}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                  school.status === 'active' 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' 
                    : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                }`}>
                  {school.status === 'active' ? 'نشطة' : 'معلقة'}
                </span>
                <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                  {school.slug}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                <span>سعة الطلاب: <b className="text-white">{schoolStudents.length} / {school.max_students}</b></span>
                <span>•</span>
                <span>المعلمون: <b className="text-white">{schoolTeachers.length}</b></span>
                <span>•</span>
                <span>الفصول: <b className="text-white">{schoolClasses.length}</b></span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs & Search */}
        <div className="bg-slate-100/70 p-3 sm:px-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('students'); setIsAddStudentOpen(false); }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                activeTab === 'students' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>الطلاب ({schoolStudents.length})</span>
            </button>

            <button
              onClick={() => { setActiveTab('teachers'); setIsAddTeacherOpen(false); }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                activeTab === 'teachers' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>المعلمون ({schoolTeachers.length})</span>
            </button>

            <button
              onClick={() => { setActiveTab('classes'); setIsAddClassOpen(false); }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                activeTab === 'classes' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>الفصول الدراسية ({schoolClasses.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="ابحث بالاسم أو المعرف..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {activeTab === 'students' && (
              <button
                onClick={() => setIsAddStudentOpen(prev => !prev)}
                className="py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1 shadow-xs whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddStudentOpen ? 'إلغاء' : 'إضافة طالب ➕'}</span>
              </button>
            )}

            {activeTab === 'teachers' && (
              <button
                onClick={() => setIsAddTeacherOpen(prev => !prev)}
                className="py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1 shadow-xs whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddTeacherOpen ? 'إلغاء' : 'إضافة معلم ➕'}</span>
              </button>
            )}

            {activeTab === 'classes' && (
              <button
                onClick={() => setIsAddClassOpen(prev => !prev)}
                className="py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1 shadow-xs whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddClassOpen ? 'إلغاء' : 'إضافة فصل ➕'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* ================= TAB 1: STUDENTS ================= */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              
              {/* Add Student Drawer Form */}
              {isAddStudentOpen && (
                <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 sm:p-5 animate-fade-in space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                    <h4 className="font-extrabold text-xs text-indigo-900 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                      <span>إضافة طالب جديد مباشرة لمدرسة {school.name}</span>
                    </h4>
                    <span className="text-[10px] bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded font-mono font-bold">
                      school_id: {school.id.slice(0, 8)}...
                    </span>
                  </div>

                  <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الطالب الكامل</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: يوسف أحمد"
                        value={studentName}
                        onChange={e => setStudentName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الدخول (Username)</label>
                      <input
                        type="text"
                        required
                        placeholder="s_youssef"
                        value={studentUsername}
                        onChange={e => setStudentUsername(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">كلمة المرور</label>
                      <input
                        type="text"
                        required
                        placeholder="123"
                        value={studentPassword}
                        onChange={e => setStudentPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">الصف الدراسي</label>
                      <select
                        value={studentGrade}
                        onChange={e => setStudentGrade(e.target.value as GradeLevel)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
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
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">المسار اللغوي</label>
                      <select
                        value={studentTrack}
                        onChange={e => setStudentTrack(e.target.value as ArabicTrack)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                      >
                        <option value="arabic-a">ناطقين (Arabic A)</option>
                        <option value="arabic-b">غير ناطقين (Arabic B)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-5 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddStudentOpen(false)}
                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20"
                      >
                        حفظ الطالب بالمدرسة
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Students Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                    <tr>
                      <th className="p-3">اسم الطالب</th>
                      <th className="p-3">اسم الدخول</th>
                      <th className="p-3">كلمة المرور</th>
                      <th className="p-3">الصف الدراسي</th>
                      <th className="p-3">المسار اللغوي</th>
                      <th className="p-3 text-center">الإجراءات والتحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredStudents.map(student => {
                      const isPwdVisible = showPasswordMap[student.id];
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/60 transition">
                          <td className="p-3 font-extrabold text-slate-800">
                            {student.name}
                          </td>
                          <td className="p-3 font-mono font-bold text-indigo-700">
                            {student.username}
                          </td>
                          <td className="p-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span>{isPwdVisible ? (student.password || '123') : '••••••'}</span>
                              <button
                                type="button"
                                onClick={() => setShowPasswordMap(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                              >
                                {isPwdVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPasswordResetUser(student);
                                  setNewPassword(student.password || '123');
                                }}
                                className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200 flex items-center gap-1"
                                title="إعادة تعيين كلمة المرور"
                              >
                                <KeyRound className="w-3 h-3 text-amber-600" />
                                <span>إعادة تعيين</span>
                              </button>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-bold border border-blue-200 text-[10px]">
                              {student.grade?.replace('grade-', 'الصف ') || 'ابتدائي'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                              student.track === 'arabic-b'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              {student.track === 'arabic-b' ? 'غير ناطقين (B)' : 'ناطقين (A)'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenEditStudent(student)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition border border-indigo-100"
                                title="تعديل الصف والمسار"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(student.id, student.name)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition border border-rose-100"
                                title="حذف الطالب"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-xs text-slate-400">
                          {searchQuery ? 'لا يوجد طلاب يطابقون معايير البحث' : 'لا يوجد طلاب مسجلون في هذه المدرسة حتى الآن. يمكنك إضافة طالب عبر الزر أعلاه ➕'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ================= TAB 2: TEACHERS ================= */}
          {activeTab === 'teachers' && (
            <div className="space-y-4">
              
              {/* Add Teacher Drawer Form */}
              {isAddTeacherOpen && (
                <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-4 sm:p-5 animate-fade-in space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-teal-100">
                    <h4 className="font-extrabold text-xs text-teal-900 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-teal-600" />
                      <span>إضافة معلم جديد لكادر مدرسة {school.name}</span>
                    </h4>
                    <span className="text-[10px] bg-teal-200/60 text-teal-800 px-2 py-0.5 rounded font-mono font-bold">
                      school_id: {school.id.slice(0, 8)}...
                    </span>
                  </div>

                  <form onSubmit={handleAddTeacher} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المعلم</label>
                        <input
                          type="text"
                          required
                          placeholder="أ. مريم السعيد"
                          value={teacherName}
                          onChange={e => setTeacherName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الدخول (Username)</label>
                        <input
                          type="text"
                          required
                          placeholder="t_maryam"
                          value={teacherUsername}
                          onChange={e => setTeacherUsername(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">كلمة المرور</label>
                        <input
                          type="text"
                          required
                          placeholder="123456"
                          value={teacherPassword}
                          onChange={e => setTeacherPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-teal-100">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5">المسار المصرح به</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTeacherSelectedTracks(prev => 
                                prev.includes('arabic-a') ? prev.filter(t => t !== 'arabic-a') : [...prev, 'arabic-a']
                              );
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                              teacherSelectedTracks.includes('arabic-a') ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200'
                            }`}
                          >
                            <span>ناطقين (Arabic A)</span>
                            {teacherSelectedTracks.includes('arabic-a') && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTeacherSelectedTracks(prev => 
                                prev.includes('arabic-b') ? prev.filter(t => t !== 'arabic-b') : [...prev, 'arabic-b']
                              );
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                              teacherSelectedTracks.includes('arabic-b') ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200'
                            }`}
                          >
                            <span>غير ناطقين (Arabic B)</span>
                            {teacherSelectedTracks.includes('arabic-b') && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5">الصفوف المصرح بتدريسها</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6'].map(g => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                setTeacherSelectedGrades(prev => 
                                  prev.includes(g as GradeLevel) ? prev.filter(x => x !== g) : [...prev, g as GradeLevel]
                                );
                              }}
                              className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition ${
                                teacherSelectedGrades.includes(g as GradeLevel) 
                                  ? 'bg-teal-600 text-white border-teal-600' 
                                  : 'bg-white text-slate-600 border-slate-200'
                              }`}
                            >
                              {g.replace('grade-', 'الصف ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddTeacherOpen(false)}
                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-teal-600/20"
                      >
                        حفظ المعلم بالمدرسة
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Teachers Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                    <tr>
                      <th className="p-3">اسم المعلم</th>
                      <th className="p-3">اسم الدخول</th>
                      <th className="p-3">كلمة المرور</th>
                      <th className="p-3">الصفوف المعتمدة</th>
                      <th className="p-3">المسارات المصرح بها</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredTeachers.map(teacher => {
                      const isPwdVisible = showPasswordMap[teacher.id];
                      return (
                        <tr key={teacher.id} className="hover:bg-slate-50/60 transition">
                          <td className="p-3 font-extrabold text-slate-800">
                            {teacher.name}
                            {teacher.role === 'hod' && (
                              <span className="mr-1.5 px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                                رئيس قسم
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-teal-700">
                            {teacher.username}
                          </td>
                          <td className="p-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span>{isPwdVisible ? (teacher.password || '123456') : '••••••'}</span>
                              <button
                                type="button"
                                onClick={() => setShowPasswordMap(prev => ({ ...prev, [teacher.id]: !prev[teacher.id] }))}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                              >
                                {isPwdVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPasswordResetUser(teacher);
                                  setNewPassword(teacher.password || '123456');
                                }}
                                className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200 flex items-center gap-1"
                                title="إعادة تعيين كلمة المرور"
                              >
                                <KeyRound className="w-3 h-3 text-amber-600" />
                                <span>إعادة تعيين</span>
                              </button>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {teacher.allowedGrades?.map(g => (
                                <span key={g} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 text-[10px] font-semibold">
                                  {g.replace('grade-', 'الصف ')}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {teacher.allowedTracks?.map(tr => (
                                <span key={tr} className="px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded text-[10px] font-bold">
                                  {tr === 'arabic-a' ? 'ناطقين A' : 'غير ناطقين B'}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenEditTeacher(teacher)}
                                className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition border border-teal-100"
                                title="تعديل الصفوف والمسارات"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(teacher.id, teacher.name)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition border border-rose-100"
                                title="حذف المعلم"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredTeachers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-xs text-slate-400">
                          {searchQuery ? 'لا يوجد معلمون يطابقون معايير البحث' : 'لم يتم تسجيل معلمين في هذه المدرسة بعد.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ================= TAB 3: CLASSES ================= */}
          {activeTab === 'classes' && (
            <div className="space-y-4">
              
              {/* Add Class Drawer Form */}
              {isAddClassOpen && (
                <div className="bg-purple-50/60 border border-purple-200 rounded-2xl p-4 sm:p-5 animate-fade-in space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                    <h4 className="font-extrabold text-xs text-purple-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-600" />
                      <span>إضافة فصل دراسي جديد لمدرسة {school.name}</span>
                    </h4>
                    <span className="text-[10px] bg-purple-200/60 text-purple-800 px-2 py-0.5 rounded font-mono font-bold">
                      school_id: {school.id.slice(0, 8)}...
                    </span>
                  </div>

                  <form onSubmit={handleAddClass} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الفصل</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: الصف الأول (أ) - براعم الفصحى"
                        value={className}
                        onChange={e => setClassName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">الصف الدراسي</label>
                      <select
                        value={classGrade}
                        onChange={e => setClassGrade(e.target.value as GradeLevel)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                      >
                        <option value="grade-1">الصف الأول</option>
                        <option value="grade-2">الصف الثاني</option>
                        <option value="grade-3">الصف الثالث</option>
                        <option value="grade-4">الصف الرابع</option>
                        <option value="grade-5">الصف الخامس</option>
                        <option value="grade-6">الصف السادس</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">المسار اللغوي</label>
                      <select
                        value={classTrack}
                        onChange={e => setClassTrack(e.target.value as ArabicTrack)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                      >
                        <option value="arabic-a">ناطقين (Arabic A)</option>
                        <option value="arabic-b">غير ناطقين (Arabic B)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-4 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddClassOpen(false)}
                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/20"
                      >
                        حفظ الفصل بالمدرسة
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Classes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredClasses.map(cls => {
                  const studentCount = schoolStudents.filter(s => s.grade === cls.grade && s.track === cls.track).length;
                  return (
                    <div key={cls.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white transition flex flex-col justify-between shadow-xs">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-black text-sm text-slate-900">{cls.name}</h4>
                          <button
                            onClick={() => handleDeleteClass(cls.id, cls.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="حذف الفصل"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold">
                            {cls.grade.replace('grade-', 'الصف ')}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            cls.track === 'arabic-b' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {cls.track === 'arabic-b' ? 'غير ناطقين (B)' : 'ناطقين (A)'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-bold">الطلاب المسجلون:</span>
                        <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                          {studentCount} طلاب
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredClasses.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  {searchQuery ? 'لا توجد فصول تطابق معايير البحث' : 'لم يتم تسجيل فصول في هذه المدرسة حتى الآن. انقر على "إضافة فصل ➕" أعلاه لإنشاء الفصول وتوزيع الطلاب.'}
                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* Edit Student Modal */}
      {editingUser && editingUser.role === 'student' && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-scale-up space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span>تعديل الصف والمسار: {editingUser.name}</span>
              </h3>
              <button onClick={() => setEditingUser(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الصف الدراسي</label>
                <select
                  value={editGrade}
                  onChange={e => setEditGrade(e.target.value as GradeLevel)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white"
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
                  value={editTrack}
                  onChange={e => setEditTrack(e.target.value as ArabicTrack)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white"
                >
                  <option value="arabic-a">ناطقين باللغة العربية (Arabic A)</option>
                  <option value="arabic-b">الناطقين بغيرها (Arabic B)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveEditStudent}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {editingUser && (editingUser.role === 'teacher' || editingUser.role === 'hod') && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 animate-scale-up space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-teal-600" />
                <span>تعديل صلاحيات المعلم: {editingUser.name}</span>
              </h3>
              <button onClick={() => setEditingUser(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">المسارات المصرح بها</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTeacherTracks(prev => 
                        prev.includes('arabic-a') ? prev.filter(t => t !== 'arabic-a') : [...prev, 'arabic-a']
                      );
                    }}
                    className={`flex-1 p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                      editTeacherTracks.includes('arabic-a') ? 'bg-teal-50 border-teal-500 text-teal-900' : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    <span>ناطقين (Arabic A)</span>
                    {editTeacherTracks.includes('arabic-a') && <Check className="w-4 h-4 text-teal-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditTeacherTracks(prev => 
                        prev.includes('arabic-b') ? prev.filter(t => t !== 'arabic-b') : [...prev, 'arabic-b']
                      );
                    }}
                    className={`flex-1 p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                      editTeacherTracks.includes('arabic-b') ? 'bg-teal-50 border-teal-500 text-teal-900' : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    <span>غير ناطقين (Arabic B)</span>
                    {editTeacherTracks.includes('arabic-b') && <Check className="w-4 h-4 text-teal-600" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">الصفوف المصرح بتدريسها</label>
                <div className="grid grid-cols-3 gap-2">
                  {['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6'].map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setEditTeacherGrades(prev => 
                          prev.includes(g as GradeLevel) ? prev.filter(x => x !== g) : [...prev, g as GradeLevel]
                        );
                      }}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                        editTeacherGrades.includes(g as GradeLevel) 
                          ? 'bg-teal-600 text-white border-teal-600' 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{g.replace('grade-', 'الصف ')}</span>
                      {editTeacherGrades.includes(g as GradeLevel) && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveEditTeacher}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-teal-600/20"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 animate-scale-up space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>إعادة تعيين كلمة المرور</span>
              </h3>
              <button onClick={() => setPasswordResetUser(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-600 mb-3">
                تعيين كلمة مرور جديدة للمستخدم: <b className="text-slate-900">{passwordResetUser.name}</b>
              </p>
              <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الجديدة</label>
              <input
                type="text"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <div className="flex gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => setNewPassword('123456')}
                  className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-bold rounded-lg"
                >
                  تعيين: 123456
                </button>
                <button
                  type="button"
                  onClick={() => setNewPassword('123')}
                  className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-bold rounded-lg"
                >
                  تعيين: 123
                </button>
                <button
                  type="button"
                  onClick={() => setNewPassword(Math.floor(100000 + Math.random() * 900000).toString())}
                  className="px-2 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 text-[10px] font-bold rounded-lg border border-amber-200"
                >
                  توليد عشوائي ⚡
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setPasswordResetUser(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleSavePasswordReset}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-600/20"
              >
                تحديث كلمة المرور
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
