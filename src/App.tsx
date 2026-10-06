import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
const Analytics = () => null;
const track = (..._args: any[]) => {};
import { 
  ShieldCheck, Users, GraduationCap, LogOut, Plus, Trash2, 
  Lock, User, BookOpen, Award, CheckCircle2, FileText, Send, Sparkles, Check, 
  Activity as ActivityIcon, UserCheck, HeartHandshake, BarChart3, Clock, 
  Library, Download, Eye, CheckSquare, X, Search, FileUp,
  Bot, Palette, Brain, Printer, MessageCircle, Star,
  Loader2, Wand2, Gamepad2, Trophy, Play, Zap, Wifi, WifiOff, Share2,
  ShieldAlert, Sliders, AlertTriangle, FileCheck2,
  ListTodo, KeyRound, Edit3, CalendarClock, Calendar, Pin, RefreshCw, Video,
  FileSpreadsheet, Building2, ChevronDown, ChevronUp, MessageSquare, Globe
} from 'lucide-react';
import JSZip from 'jszip';
import { 
  UserProfile, UserRole, School, SchoolStage, GradeLevel, ArabicTrack, 
  STAGES_CONFIG, Activity, Question, StudentSubmission, StoryBankItem, BookItem,
  ReadingBookAssignment,
  ChildBadge, AIGameType, AIGovernanceRules, Exam, ExamSession,
  TeacherTask, DelegatedAdminPermissions, DEFAULT_DELEGATED_PERMISSIONS, LiveClassSession,
  UILanguage
} from './types';
import { 
  getUsers, saveUser, deleteUser, getCurrentUser, setCurrentUser, recordUserLogin,
  getActivities, saveActivity, deleteActivity, getSubmissions, saveSubmission,
  getStoryBank, getBooksRepository, updateBookAssignment,
  isFullLibraryOpenForGrade, setFullLibraryOpenForGrade, isLibraryOpenForStudent, getReadingBookAssignments,
  saveReadingBookAssignment, deleteReadingBookAssignment,
  syncUsersFromCloud, syncActivitiesFromCloud, syncSubmissionsFromCloud,
  getStudentBadges, syncStudentBadgesFromCloud, subscribeToCloudChanges,
  getOfflineSubmissionsQueue, drainOfflineQueue,
  getAIGovernanceRules, syncAIGovernanceRulesFromCloud, isAIFeatureAllowed, canUserUseAI,
  getExams, getExamSessions, syncExamsFromCloud, syncExamSessionsFromCloud,
  getTeacherTasks, syncTeacherTasksFromCloud,
  getLiveClassSessions, syncLiveClassSessionsFromCloud,
  getSchools, checkSchoolAccess, getSchoolById, syncSchoolsFromCloud,
  getPreferredUILanguage, setPreferredUILanguage
} from './storage';
import { 
  canManageTeacherGrades, 
  canManageTeacherTasks, 
  canControlAIGovernance, 
  canCreateHOD, 
  countDelegatedPermissions 
} from './utils/permissions';
import { getCachedGamesOffline } from './db/offlineCache';
import { MusaCompanionModal } from './components/MusaCompanionModal';
import { AdaptiveStoryModal } from './components/AdaptiveStoryModal';
import { PhonicsGateModal } from './components/PhonicsGateModal';
import { DrawingCanvasModal } from './components/DrawingCanvasModal';
import { DiagnosticReportModal } from './components/DiagnosticReportModal';
import { PrintableWorksheetModal } from './components/PrintableWorksheetModal';
import { ClassDiagnosticModal } from './components/ClassDiagnosticModal';
import { AIGamesTeacherSection } from './components/AIGamesTeacherSection';
import { AIGamePlayerModal } from './components/AIGamePlayerModal';
import { AdaptiveGamesSection } from './components/AdaptiveGamesSection';
import { getRecommendedLevelForGrade, getAdaptiveGamesForLevel } from './data/adaptiveGamesData';
import { QuickAIDiagnosticModal } from './components/QuickAIDiagnosticModal';
import { ShareableBadgeModal } from './components/ShareableBadgeModal';
import { AdminAIGovernancePanel } from './components/AdminAIGovernancePanel';
import { TeacherExamsHub } from './components/TeacherExamsHub';
import { StudentExamModal } from './components/StudentExamModal';
import { AdminDelegationModal } from './components/AdminDelegationModal';
import { EditTeacherGradesModal } from './components/EditTeacherGradesModal';
import { TeacherTasksManager } from './components/TeacherTasksManager';
import { TeacherTasksReadOnlyView } from './components/TeacherTasksReadOnlyView';
import { PadletBoardView } from './components/PadletBoard';
import { MousaChallenge } from './components/MousaChallenge';
import { LiveClassroom } from './components/LiveClassroom';
import { TeacherBookAssignModal } from './components/TeacherBookAssignModal';
import { UserProfileModal } from './components/UserProfileModal';
import { UserNavbarProfileButton } from './components/UserNavbarProfileButton';
import { ParentProgressTab } from './components/ParentProgressTab';
import { TeacherControlHub } from './components/TeacherControlHub';
import { GradebookManager } from './components/GradebookManager';
import { InstantStudentReportModal } from './components/InstantStudentReportModal';
import { OralReadingFluencyModal } from './components/OralReadingFluencyModal';
import { AdaptiveKnowledgeTreeModal } from './components/AdaptiveKnowledgeTreeModal';
import { LanguagePassportModal } from './components/LanguagePassportModal';
import { SuspendedSchoolNotice } from './components/SuspendedSchoolNotice';
import { SuperAdminSchoolsDashboard } from './components/SuperAdminSchoolsDashboard';
import { SchoolAdminPortal } from './components/SchoolAdminPortal';
import { EducationalChatModal } from './components/EducationalChatModal';
import { FloatingChatButton } from './components/FloatingChatButton';
import { challengeAudio } from './utils/challengeAudio';
import { getExamScheduleStatus, formatArabicDateTime, formatCountdown } from './utils/examSchedule';
import { 
  generateAIPassage, 
  generateQuestionsFromPassage, 
  autoTashkeelText 
} from './geminiService';

// مسار الصورة المرفوعة داخل مجلد public
const MOUSA_AVATAR_SRC = '/mousa-avatar.png';

// ================= إدارة ومزامنة التبويب النشط (Tab State Persistence) =================
const normalizeTabName = (rawTab: string | null | undefined): string => {
  if (!rawTab) return '';
  const t = rawTab.trim().toLowerCase();
  if (t === 'challenges' || t === 'challenge' || t === 'تحدي' || t === 'تحديات') return 'challenge';
  if (t === 'padlet' || t === 'wall' || t === 'board' || t === 'جدار' || t === 'ابداع' || t === 'إبداع') return 'padlet';
  if (t === 'ai_studio' || t === 'studio' || t === 'ai' || t === 'استوديو' || t === 'موسى') return 'ai_studio';
  if (t === 'activities' || t === 'activity' || t === 'انشطة' || t === 'أنشطة') return 'activities';
  if (t === 'games' || t === 'game' || t === 'العاب' || t === 'ألعاب') return 'games';
  if (t === 'library' || t === 'books' || t === 'book' || t === 'مكتبة') return 'library';
  if (t === 'exams' || t === 'exam' || t === 'اختبارات' || t === 'اختبار') return 'exams';
  if (t === 'create' || t === 'new' || t === 'انشاء' || t === 'إنشاء') return 'create';
  if (t === 'grades' || t === 'marks' || t === 'درجات') return 'grades';
  if (t === 'tasks' || t === 'teacher_tasks' || t === 'مهام' || t === 'تكليفات') return 'tasks';
  if (t === 'overview' || t === 'dashboard' || t === 'نظرة_عامة') return 'overview';
  if (t === 'governance' || t === 'ai_governance' || t === 'حوكمة') return 'ai_governance';
  if (t === 'progress' || t === 'متابعة') return 'progress';
  if (t === 'teachers' || t === 'معلمون') return 'teachers';
  if (t === 'hods' || t === 'رؤساء_أقسام') return 'hods';
  if (t === 'students' || t === 'طلاب') return 'students';
  if (t === 'parents' || t === 'أولياء_أمور') return 'parents';
  if (t === 'bank' || t === 'بنك_القصص') return 'bank';
  if (t === 'live' || t === 'classroom' || t === 'فصل' || t === 'مباشر' || t === 'بث') return 'live';
  return t;
};

const isValidTabForRole = (tab: string, role?: UserRole | string): boolean => {
  if (!tab || !role) return false;
  if (role === 'student') {
    return ['ai_studio', 'games', 'activities', 'library', 'exams', 'padlet', 'challenge', 'live'].includes(tab);
  }
  if (role === 'teacher') {
    return ['activities', 'create', 'games', 'grades', 'library', 'exams', 'tasks', 'padlet', 'challenge', 'live'].includes(tab);
  }
  if (role === 'hod') {
    return ['overview', 'grades', 'teachers', 'library', 'teacher_tasks', 'tasks', 'padlet', 'challenge', 'live', 'ai_governance'].includes(tab);
  }
  if (role === 'super_admin') {
    return ['schools', 'analytics', 'global_ai'].includes(tab);
  }
  if (role === 'school_admin' || role === 'admin') {
    return ['users', 'ai_controls', 'reports', 'teachers', 'hods', 'students', 'parents', 'tasks'].includes(tab);
  }
  if (role === 'parent') {
    return ['progress', 'library'].includes(tab);
  }
  return false;
};

const getInitialTabForRole = (role: UserRole | string | undefined, defaultTab: string): string => {
  try {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlTab = searchParams.get('tab');
      if (urlTab) {
        const norm = normalizeTabName(urlTab);
        if (role && isValidTabForRole(norm, role)) {
          return norm === 'tasks' && (role === 'hod' || role === 'super_admin' || role === 'admin') ? 'teacher_tasks' : norm;
        }
      }
    }
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('current_active_tab');
      if (saved) {
        const normSaved = normalizeTabName(saved);
        if (role && isValidTabForRole(normSaved, role)) {
          return normSaved === 'tasks' && (role === 'hod' || role === 'super_admin' || role === 'admin') ? 'teacher_tasks' : normSaved;
        }
      }
    }
  } catch (e) {
    console.warn('Error resolving initial tab:', e);
  }
  return defaultTab;
};

function AppContent() {
  const [currentUser, setUser] = useState<UserProfile | null>(() => getCurrentUser());
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [storyBank, setStoryBank] = useState<StoryBankItem[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);

  // حالات أدوات الذكاء الاصطناعي (Gemini AI Suite)
  const [isMusaChatOpen, setIsMusaChatOpen] = useState<boolean>(false);
  const [isMusaDismissed, setIsMusaDismissed] = useState<boolean>(false);
  const [isAdaptiveStoryOpen, setIsAdaptiveStoryOpen] = useState<boolean>(false);
  const [isPhonicsGateOpen, setIsPhonicsGateOpen] = useState<boolean>(false);
  const [isDrawingCanvasOpen, setIsDrawingCanvasOpen] = useState<boolean>(false);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState<boolean>(false);
  const [diagnosticStudent, setDiagnosticStudent] = useState<UserProfile | null>(null);
  const [isPrintableWorksheetOpen, setIsPrintableWorksheetOpen] = useState<boolean>(false);
  const [worksheetStudent, setWorksheetStudent] = useState<UserProfile | null>(null);
  const [studentBadges, setStudentBadges] = useState<ChildBadge[]>([]);
  const [isQuickDiagnosticOpen, setIsQuickDiagnosticOpen] = useState<boolean>(false);
  const [quickDiagnosticStudent, setQuickDiagnosticStudent] = useState<{ id: string; name: string } | null>(null);
  
  // حالة نافذة تقرير أداء الطالب الفعلي وتشخيص الفجوات المباشر (غير معتمد على AI)
  const [isInstantReportOpen, setIsInstantReportOpen] = useState<boolean>(false);
  const [instantReportStudent, setInstantReportStudent] = useState<UserProfile | null>(null);

  // 1. حالة مختبر الطلاقة القرائية الشفهية (ORF)
  const [isORFModalOpen, setIsORFModalOpen] = useState<boolean>(false);
  const [orfTargetStudent, setOrfTargetStudent] = useState<UserProfile | null>(null);

  // 2. حالة شجرة الكفايات التكيفية والتكرار المتباعد (Knowledge Tree & Spaced Repetition)
  const [isKnowledgeTreeOpen, setIsKnowledgeTreeOpen] = useState<boolean>(false);
  const [knowledgeTreeTargetStudent, setKnowledgeTreeTargetStudent] = useState<UserProfile | null>(null);

  // 3. حالة جواز السفر اللغوي الدولي وإطار CEFR
  const [isLanguagePassportOpen, setIsLanguagePassportOpen] = useState<boolean>(false);
  const [languagePassportTargetStudent, setLanguagePassportTargetStudent] = useState<UserProfile | null>(null);
  const [currentUILang, setCurrentUILang] = useState<UILanguage>(() => getPreferredUILanguage());

  // 4. لوحة تحكم وحوكمة المعلم الشاملة (Teacher Control Hub)
  const [isTeacherControlHubOpen, setIsTeacherControlHubOpen] = useState<boolean>(false);
  const [teacherControlHubTargetStudent, setTeacherControlHubTargetStudent] = useState<UserProfile | null>(null);
  const [teacherControlHubInitialTab, setTeacherControlHubInitialTab] = useState<'library' | 'games' | 'cefr' | 'orf' | 'remedial'>('library');

  const [showShareBadgeModal, setShowShareBadgeModal] = useState<boolean>(false);
  const [selectedBadgeForShare, setSelectedBadgeForShare] = useState<ChildBadge | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [aiGovernanceRules, setAiGovernanceRules] = useState<AIGovernanceRules>(getAIGovernanceRules());

  // قائمة المدارس المسجلة
  const [schoolsList, setSchoolsList] = useState<School[]>(() => getSchools());

  // حالة انتحال / الدخول كمدير مدرسة للمؤسس العام (School Admin Impersonation)
  const [impersonatedSchool, setImpersonatedSchool] = useState<School | null>(null);
  const [originalSuperAdmin, setOriginalSuperAdmin] = useState<UserProfile | null>(null);

  const handleImpersonateSchool = (targetSchool: School) => {
    setOriginalSuperAdmin(currentUser);
    setImpersonatedSchool(targetSchool);

    // البحث عن مدير مسجل لهذه المدرسة أو توليد جلسة إدارة مؤقتة
    const existingAdmin = users.find(u => u.school_id === targetSchool.id && u.role === 'school_admin');
    const schoolAdminUser: UserProfile = existingAdmin || {
      id: `usr_imp_adm_${targetSchool.id}`,
      name: `مدير ${targetSchool.name}`,
      username: `${targetSchool.slug}_admin`,
      password: '123',
      role: 'school_admin',
      school_id: targetSchool.id,
      loginCount: 1,
      delegated_admin_permissions: { ...DEFAULT_DELEGATED_PERMISSIONS }
    };

    setUser(schoolAdminUser);
    setCurrentUser(schoolAdminUser);
  };

  const handleExitImpersonation = () => {
    const fallbackSuperAdmin = originalSuperAdmin || users.find(u => u.role === 'super_admin') || {
      id: 'usr_admin',
      name: 'م. موسى الخالدي (المؤسس والمدير العام)',
      username: 'admin',
      password: '123',
      role: 'super_admin',
      school_id: '00000000-0000-0000-0000-000000000001',
      loginCount: 5,
      delegated_admin_permissions: { ...DEFAULT_DELEGATED_PERMISSIONS }
    };

    setImpersonatedSchool(null);
    setOriginalSuperAdmin(null);
    setUser(fallbackSuperAdmin);
    setCurrentUser(fallbackSuperAdmin);
  };

  // تبويبات لوحة المشرف العام مع استعادة التبويب النشط
  const [adminTab, setAdminTab] = useState<'schools' | 'hods' | 'teachers' | 'students' | 'parents' | 'bank' | 'ai_governance' | 'teacher_tasks'>(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('super-admin/schools')) {
      return 'schools';
    }
    const initialUser = getCurrentUser();
    return (getInitialTabForRole(initialUser?.role || 'super_admin', 'schools') as any) || 'schools';
  });

  // الاستماع لتغيير رابط الـ Hash للمسار /super-admin/schools
  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window !== 'undefined' && (window.location.hash === '#super-admin/schools' || window.location.hash.includes('schools'))) {
        if (currentUser?.role === 'super_admin') {
          setAdminTab('schools');
        }
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser?.role]);

  // تبويبات لوحة رئيس القسم مع استعادة التبويب النشط
  const [hodTab, setHodTab] = useState<'overview' | 'grades' | 'teachers' | 'library' | 'teacher_tasks' | 'padlet' | 'challenge' | 'live' | 'ai_governance'>(() => {
    const initialUser = getCurrentUser();
    return getInitialTabForRole(initialUser?.role || 'hod', 'overview') as any;
  });

  // تبويبات لوحة المعلم مع استعادة التبويب النشط
  const [teacherTab, setTeacherTab] = useState<'activities' | 'create' | 'games' | 'grades' | 'library' | 'exams' | 'tasks' | 'padlet' | 'challenge' | 'live'>(() => {
    const initialUser = getCurrentUser();
    return getInitialTabForRole(initialUser?.role || 'teacher', 'activities') as any;
  });

  // قائمة مهام وتكليفات المعلمين
  const [teacherTasks, setTeacherTasks] = useState<TeacherTask[]>(getTeacherTasks());

  // حالة نوافذ تفويض الصلاحيات وتعديل الصفوف
  const [isAdminDelegationModalOpen, setIsAdminDelegationModalOpen] = useState(false);
  const [selectedUserForDelegation, setSelectedUserForDelegation] = useState<UserProfile | null>(null);
  const [isEditTeacherGradesModalOpen, setIsEditTeacherGradesModalOpen] = useState(false);
  const [selectedTeacherForGrades, setSelectedTeacherForGrades] = useState<UserProfile | null>(null);

  // حالة نافذة إعدادات الملف الشخصي والحساب لجميع المستخدمين
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  const handleUserUpdate = useCallback((updated: UserProfile) => {
    setUser(updated);
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    if (updated.preferences?.soundEffects !== undefined) {
      challengeAudio.setEnabled(updated.preferences.soundEffects);
    }
  }, []);

  // ضبط حالة الصوت الافتراضية وفق تفضيلات المستخدم
  useEffect(() => {
    if (currentUser?.preferences?.soundEffects !== undefined) {
      challengeAudio.setEnabled(currentUser.preferences.soundEffects);
    }
  }, [currentUser?.preferences?.soundEffects]);

  // تبويبات لوحة الطالب مع استعادة التبويب النشط
  const [studentTab, setStudentTab] = useState<'ai_studio' | 'games' | 'activities' | 'library' | 'exams' | 'padlet' | 'challenge' | 'live'>(() => {
    const initialUser = getCurrentUser();
    return getInitialTabForRole(initialUser?.role || 'student', 'ai_studio') as any;
  });

  // قائمة جلسات الحصة المباشرة والتفاعل الصفي
  const [liveSessionsList, setLiveSessionsList] = useState<LiveClassSession[]>(() => getLiveClassSessions());

  // قائمة الاختبارات والجلسات وحالة الاختبار النشط للطالب
  const [examsList, setExamsList] = useState<Exam[]>(getExams());
  const [examSessionsList, setExamSessionsList] = useState<ExamSession[]>(getExamSessions());
  const [activeExamForStudent, setActiveExamForStudent] = useState<Exam | null>(null);

  // ساعة حية لتحديث حالات الجدولة والعد التنازلي التفاعلي للطلاب تلقائياً
  const [currentExamClock, setCurrentExamClock] = useState<Date>(new Date());
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentExamClock(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // تبويبات لوحة ولي الأمر مع استعادة التبويب النشط
  const [parentTab, setParentTab] = useState<'progress' | 'library'>(() => {
    const initialUser = getCurrentUser();
    return getInitialTabForRole(initialUser?.role || 'parent', 'progress') as any;
  });

  // التبويب النشط الحالي للمستخدم وفق رتبته
  const currentActiveTab = useMemo(() => {
    if (!currentUser) return null;
    switch (currentUser.role) {
      case 'student': return studentTab;
      case 'teacher': return teacherTab;
      case 'hod': return hodTab === 'live' ? 'live' : (hodTab === 'teacher_tasks' ? 'tasks' : hodTab);
      case 'super_admin': return adminTab === 'teacher_tasks' ? 'tasks' : adminTab;
      case 'parent': return parentTab;
      default: return null;
    }
  }, [currentUser?.role, studentTab, teacherTab, hodTab, adminTab, parentTab]);

  // فحص هل هناك حصة مباشرة جارية ومتاحة لصف الطالب
  const activeLiveSessionForStudent = useMemo(() => {
    if (!currentUser || currentUser.role !== 'student') return null;
    const studentGrade = currentUser.grade || 'grade-1';
    return liveSessionsList.find(s => s.isActive && (s.grade === studentGrade || s.grade === 'all')) || null;
  }, [currentUser, liveSessionsList]);

  // فحص هل المعلم لديه حصة مباشرة جارية حالياً
  const isTeacherLiveActive = useMemo(() => {
    if (!currentUser || currentUser.role !== 'teacher') return false;
    return liveSessionsList.some(s => s.isActive && s.teacherId === currentUser.id);
  }, [currentUser, liveSessionsList]);

  // مزامنة التبويب النشط في الرابط (URL Query Parameter: ?tab=...) وفي التخزين المحلي (localStorage)
  useEffect(() => {
    if (!currentUser || !currentActiveTab) return;
    try {
      localStorage.setItem('current_active_tab', currentActiveTab);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const oldTab = url.searchParams.get('tab');
        if (oldTab !== currentActiveTab) {
          url.searchParams.set('tab', currentActiveTab);
          // استخدام pushState عند الانتقال الفعلي بين التبويبات لدعم سجل التصفح والتتبع الدقيق
          if (oldTab) {
            window.history.pushState({ tab: currentActiveTab }, '', url.toString());
          } else {
            window.history.replaceState({ tab: currentActiveTab }, '', url.toString());
          }
        }
      }
    } catch (err) {
      console.warn('Error syncing active tab to URL/storage:', err);
    }
  }, [currentUser?.role, currentActiveTab]);

  // تتبع تبديل التبويبات والمسارات في Vercel Analytics عبر track('tab_view') الرسمي
  const lastTrackedTabRef = useRef<string>('');
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentTab = currentActiveTab || (currentUser ? 'overview' : 'auth');
    if (lastTrackedTabRef.current !== currentTab) {
      lastTrackedTabRef.current = currentTab;
      try {
        track('tab_view', {
          tab: currentTab,
          role: currentUser?.role || 'guest',
        });
      } catch (err) {
        console.warn('Vercel Analytics tracking error:', err);
      }
    }
  }, [currentActiveTab, currentUser?.role]);

  // الاستماع لأزرار الرجوع والتقدم في المتصفح (Browser Back/Forward)
  useEffect(() => {
    const handlePopState = () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const urlTab = searchParams.get('tab');
        if (!urlTab || !currentUser) return;
        const norm = normalizeTabName(urlTab);
        if (currentUser.role === 'student' && isValidTabForRole(norm, 'student')) {
          setStudentTab(norm as any);
        } else if (currentUser.role === 'teacher' && isValidTabForRole(norm, 'teacher')) {
          setTeacherTab(norm as any);
        } else if (currentUser.role === 'hod' && isValidTabForRole(norm, 'hod')) {
          setHodTab((norm === 'tasks' ? 'teacher_tasks' : norm) as any);
        } else if (currentUser.role === 'super_admin' && isValidTabForRole(norm, 'super_admin')) {
          setAdminTab((norm === 'tasks' ? 'teacher_tasks' : norm) as any);
        } else if (currentUser.role === 'parent' && isValidTabForRole(norm, 'parent')) {
          setParentTab(norm as any);
        }
      } catch (e) {
        console.warn('Error handling popstate:', e);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  // مرشح تصفية الأقسام والمكتبات
  const [selectedSection, setSelectedSection] = useState<string>('all');

  // نافذة بنك القصص الإسلامية داخل استمارة النشاط
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  // نافذة اختيار قصة من مستودع الكتب التفاعلية لبناء نشاط
  const [isBooksModalOpen, setIsBooksModalOpen] = useState(false);
  const [bookSearchKeyword, setBookSearchKeyword] = useState('');

  // نافذة إسناد الكتاب لصفوف المعلم / رئيس القسم
  const [selectedBookForAssign, setSelectedBookForAssign] = useState<BookItem | null>(null);
  const [tempAssignedGrades, setTempAssignedGrades] = useState<GradeLevel[]>([]);
  const [tempAssignedTracks, setTempAssignedTracks] = useState<ArabicTrack[]>(['arabic-a']);

  // حوكمة رف القراءة وتكليف الكتب للطلاب
  const [bookToAssignWithGovernance, setBookToAssignWithGovernance] = useState<BookItem | null>(null);
  const [assignInitialTab, setAssignInitialTab] = useState<'free_reading' | 'interactive_quiz'>('free_reading');
  const [readingAssignments, setReadingAssignments] = useState<ReadingBookAssignment[]>(() => getReadingBookAssignments());
  const [studentReadingTab, setStudentReadingTab] = useState<'assigned' | 'open_library'>('assigned');
  const [openLibraryToggleNonce, setOpenLibraryToggleNonce] = useState(0);

  // عارض الكتاب التفاعلي المباشر (Direct Reader State)
  const [activeReadingBook, setActiveReadingBook] = useState<BookItem | null>(null);

  // حالة تشغيل اللعبة الذكية للطالب أو المعلم
  const [activeGameToPlay, setActiveGameToPlay] = useState<Activity | null>(null);

  // مركز الرسائل المدرسية والتواصل الفوري
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  // بيانات تسجيل الدخول
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // استمارة إضافة مستخدم جديد (لوحة المشرف)
  const [formRole, setFormRole] = useState<UserRole>('teacher');
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // صلاحيات المعلم / رئيس القسم
  const [selectedGrades, setSelectedGrades] = useState<GradeLevel[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<ArabicTrack[]>(['arabic-a']);

  // بيانات الطالب
  const [studentStage, setStudentStage] = useState<SchoolStage>('primary');
  const [studentGrade, setStudentGrade] = useState<GradeLevel>('grade-1');
  const [studentTrack, setStudentTrack] = useState<ArabicTrack>('arabic-a');

  // بيانات ولي الأمر
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // استمارة بناء نشاط جديد (المعلم)
  const [actTitle, setActTitle] = useState('');
  const [actPassage, setActPassage] = useState('');
  const [actGrade, setActGrade] = useState<GradeLevel>('grade-1');
  const [actTrack, setActTrack] = useState<ArabicTrack>('arabic-a');
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: 'q_1',
      text: '',
      type: 'multiple_choice',
      options: ['', '', '', ''],
      correctAnswer: '',
      points: 5,
    },
  ]);

  // حالات حزمة الذكاء الاصطناعي للمعلم (Teacher AI Suite)
  const [isAIPassageModalOpen, setIsAIPassageModalOpen] = useState(false);
  const [aiPassageTopic, setAiPassageTopic] = useState('');
  const [isGeneratingAIPassage, setIsGeneratingAIPassage] = useState(false);
  const [isAutoTashkeelLoading, setIsAutoTashkeelLoading] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isClassDiagnosticOpen, setIsClassDiagnosticOpen] = useState(false);

  // حالة حل النشاط لدى الطالب
  const [selectedActivityToSolve, setSelectedActivityToSolve] = useState<Activity | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [lastScore, setLastScore] = useState<{ score: number; total: number } | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
    setUsers(getUsers());
    
    // تحميل البيانات التأسيسية محلياً فوراً
    setActivities(getActivities());
    setSubmissions(getSubmissions());
    setStoryBank(getStoryBank());
    setBooks(getBooksRepository());

    // مزامنة سحابية كاملة لجميع جداول Supabase (المستخدمين، الأنشطة، التسليمات، الاختبارات) وسياسات الذكاء الاصطناعي
    syncUsersFromCloud().then((cloudUsers) => {
      if (cloudUsers && cloudUsers.length > 0) {
        setUsers(cloudUsers);
        const curr = getCurrentUser();
        if (curr) {
          const fresh = cloudUsers.find(x => x.id === curr.id);
          if (fresh) setUser(fresh);
        }
      }
    });
    syncActivitiesFromCloud().then(cloudActs => setActivities(cloudActs));
    syncSubmissionsFromCloud().then(cloudSubs => setSubmissions(cloudSubs));
    syncAIGovernanceRulesFromCloud().then(rules => setAiGovernanceRules(rules));
    syncExamsFromCloud().then(e => setExamsList(e));
    syncExamSessionsFromCloud().then(s => setExamSessionsList(s));
    syncTeacherTasksFromCloud().then(tasks => setTeacherTasks(tasks));
    syncLiveClassSessionsFromCloud().then(sessions => setLiveSessionsList(sessions));

    // الاشتراك اللحظي في تحديثات Supabase Realtime
    const unsubscribe = subscribeToCloudChanges({
      onUsersChange: () => syncUsersFromCloud().then(u => {
        setUsers(u);
        const curr = getCurrentUser();
        if (curr) {
          const fresh = u.find(x => x.id === curr.id);
          if (fresh) setUser(fresh);
        }
      }),
      onActivitiesChange: () => syncActivitiesFromCloud().then(a => setActivities(a)),
      onSubmissionsChange: () => syncSubmissionsFromCloud().then(s => setSubmissions(s)),
      onExamsChange: () => syncExamsFromCloud().then(e => setExamsList(e)),
      onExamSessionsChange: () => syncExamSessionsFromCloud().then(s => setExamSessionsList(s)),
      onTeacherTasksChange: (tasks) => setTeacherTasks(tasks),
      onLiveClassChange: (sessions) => setLiveSessionsList(sessions),
      onDelegatedPermissionsChange: () => {
        syncUsersFromCloud().then(u => {
          setUsers(u);
          const curr = getCurrentUser();
          if (curr) {
            const fresh = u.find(x => x.id === curr.id);
            if (fresh) setUser(fresh);
          }
        });
      },
      onGovernanceChange: () => {
        syncAIGovernanceRulesFromCloud().then(r => setAiGovernanceRules(r));
      },
      onBadgesChange: () => {
        const curr = getCurrentUser();
        const activeStId = curr?.role === 'student' ? curr.id : (curr?.role === 'parent' ? (curr.studentId || '') : '');
        if (activeStId) {
          syncStudentBadgesFromCloud(activeStId).then(b => setStudentBadges(b));
        }
      }
    });

    // التحقق من حالة الاتصال وفحص طابور التسليمات
    const checkOfflineStatus = async () => {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setIsOnline(online);
      if (online) {
        await drainOfflineQueue();
      }
      const q = await getOfflineSubmissionsQueue();
      setOfflineQueueCount(q.length);

      // في حال عدم توفر أنشطة أو انقطاع الاتصال، استرجاع الألعاب المحفوظة في IndexedDB
      if (!online) {
        const cached = await getCachedGamesOffline();
        if (cached && cached.length > 0) {
          setActivities((prev) => (prev.length === 0 ? cached : prev));
        }
      }
    };

    window.addEventListener('online', checkOfflineStatus);
    window.addEventListener('offline', checkOfflineStatus);
    checkOfflineStatus();

    // معالجة التنقل السريع والخروج من الصفحة / bfcache
    const handlePageHide = () => {
      try {
        unsubscribe();
      } catch (e) {
        console.warn('Realtime cleanup on pagehide:', e);
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      unsubscribe();
      window.removeEventListener('online', checkOfflineStatus);
      window.removeEventListener('offline', checkOfflineStatus);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, []);

  const openReader = (book: BookItem) => {
    setActiveReadingBook(book);
  };

  const closeReader = () => {
    setActiveReadingBook(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    let all = await syncUsersFromCloud();
    if (!all || all.length === 0) {
      all = getUsers();
    }

    const found = all.find(
      (u) => u.username.toLowerCase() === loginUsername.trim().toLowerCase() && u.password === loginPassword
    );

    if (found) {
      const updatedUser = recordUserLogin(found);
      setUser(updatedUser);
      setUsers(all);

      if (updatedUser.role === 'teacher') {
        if (updatedUser.allowedGrades && updatedUser.allowedGrades.length > 0) {
          setActGrade(updatedUser.allowedGrades[0]);
        }
        if (updatedUser.allowedTracks && updatedUser.allowedTracks.length > 0) {
          setActTrack(updatedUser.allowedTracks[0]);
        }
      }

      // تفعيل التبويب الملائم بناء على الرابط أو التخزين السابق
      const defaultRoleTab = updatedUser.role === 'student' ? 'ai_studio' : (updatedUser.role === 'parent' ? 'progress' : (updatedUser.role === 'super_admin' ? 'teachers' : (updatedUser.role === 'hod' ? 'overview' : 'activities')));
      const targetTab = getInitialTabForRole(updatedUser.role, defaultRoleTab);
      if (updatedUser.role === 'student') {
        setStudentTab(targetTab as any);
      } else if (updatedUser.role === 'teacher') {
        setTeacherTab(targetTab as any);
      } else if (updatedUser.role === 'hod') {
        setHodTab((targetTab === 'tasks' ? 'teacher_tasks' : targetTab) as any);
      } else if (updatedUser.role === 'super_admin') {
        setAdminTab((targetTab === 'tasks' ? 'teacher_tasks' : targetTab) as any);
      } else if (updatedUser.role === 'parent') {
        setParentTab(targetTab as any);
      }
    } else {
      setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUser(null);
    setLoginUsername('');
    setLoginPassword('');
    setSelectedActivityToSolve(null);
    setQuizFinished(false);
    closeReader();
    try {
      localStorage.removeItem('current_active_tab');
      localStorage.removeItem('current_padlet_board_id');
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      url.searchParams.delete('board');
      window.history.replaceState(null, '', url.toString());
    } catch (e) {}
  };

  const toggleGrade = (gId: GradeLevel) => {
    setSelectedGrades((prev) =>
      prev.includes(gId) ? prev.filter((g) => g !== gId) : [...prev, gId]
    );
  };

  const toggleTrack = (track: ArabicTrack) => {
    setSelectedTracks((prev) =>
      prev.includes(track)
        ? prev.length > 1 ? prev.filter((t) => t !== track) : prev
        : [...prev, track]
    );
  };

  const openAssignModal = (book: BookItem) => {
    setSelectedBookForAssign(book);
    setTempAssignedGrades(book.assignedGrades || []);
    setTempAssignedTracks(book.assignedTracks || ['arabic-a']);
  };

  const toggleAssignGrade = (gId: GradeLevel) => {
    setTempAssignedGrades(prev =>
      prev.includes(gId) ? prev.filter(g => g !== gId) : [...prev, gId]
    );
  };

  const toggleAssignTrack = (t: ArabicTrack) => {
    setTempAssignedTracks(prev =>
      prev.includes(t) ? (prev.length > 1 ? prev.filter(item => item !== t) : prev) : [...prev, t]
    );
  };

  const saveBookAssignment = () => {
    if (!selectedBookForAssign || !currentUser) return;
    updateBookAssignment(
      selectedBookForAssign.id,
      tempAssignedGrades,
      tempAssignedTracks,
      currentUser.id
    );
    setBooks(getBooksRepository());
    setSelectedBookForAssign(null);
    alert('تم تحديث إسناد الكتاب للصفوف بنجاح!');
  };

  const handleImportStory = (story: StoryBankItem) => {
    setActTitle(story.title);
    setActPassage(story.passage);
    setActGrade(story.grade);
    setActTrack(story.track);
    setQuestions(story.questions);
    setIsBankModalOpen(false);
    alert(`تم سحب قصة «${story.title}» وأسئلتها بنجاح!`);
  };

  const handleSelectBookForActivity = (book: BookItem) => {
    setActTitle(`نشاط قراءة وفهم: ${book.title}`);
    setActPassage(`📖 القصة المقررة: ${book.title}\nمؤلف القصة: ${book.author || 'مؤسسة هنداوي (بوك تايم)'}\nرابط قراءة القصة المباشر:\n${book.readUrl}\n\nيرجى فتح رابط القصة وقراءتها بعناية ثم الإجابة عن الأسئلة التالية:`);
    setIsBooksModalOpen(false);
  };

  const handleGenerateAIPassage = async () => {
    if (!aiPassageTopic.trim()) {
      alert('يرجى تحديد الحرف المستهدف أو الموضوع التربوي أولاً!');
      return;
    }
    setIsGeneratingAIPassage(true);
    try {
      const result = await generateAIPassage(getGradeLabel(actGrade), actTrack, aiPassageTopic);
      setActTitle(result.title);
      setActPassage(result.passage);
      setIsAIPassageModalOpen(false);
      setAiPassageTopic('');
    } catch (err) {
      console.error(err);
      alert('تعذر توليد النص، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGeneratingAIPassage(false);
    }
  };

  const handleAutoTashkeel = async () => {
    if (!actPassage.trim()) {
      alert('يرجى كتابة أو لصق نص في خانة النص القرائي أولاً لتشكيله!');
      return;
    }
    setIsAutoTashkeelLoading(true);
    try {
      const vocalized = await autoTashkeelText(actPassage);
      setActPassage(vocalized);
    } catch (err) {
      console.error(err);
      alert('تعذر ضبط حركات النص، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsAutoTashkeelLoading(false);
    }
  };

  const handleGenerateQuestionsFromPassage = async () => {
    if (!actPassage.trim()) {
      alert('يرجى كتابة نص قرائي أو توليده أولاً بالذكاء الاصطناعي لاستخراج الأسئلة منه!');
      return;
    }
    setIsGeneratingQuestions(true);
    try {
      const aiQuestions = await generateQuestionsFromPassage(actPassage, getGradeLabel(actGrade), 3);
      setQuestions(aiQuestions);
    } catch (err) {
      console.error(err);
      alert('تعذر توليد الأسئلة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleQtiUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      let xmlContent = '';

      if (file.name.endsWith('.zip') || file.type.includes('zip')) {
        const zip = new JSZip();
        const unzipped = await zip.loadAsync(file);

        let targetFileName = '';
        for (const filename of Object.keys(unzipped.files)) {
          if (filename.endsWith('.xml') && !filename.includes('manifest')) {
            targetFileName = filename;
            break;
          }
        }

        if (!targetFileName) {
          targetFileName = Object.keys(unzipped.files).find(f => f.endsWith('.xml')) || '';
        }

        if (!targetFileName) {
          alert('الملف المضغوط لا يحتوي على ملفات أسئلة XML صالحة.');
          return;
        }

        xmlContent = await unzipped.files[targetFileName].async('text');
      } else {
        xmlContent = await file.text();
      }

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      const items = Array.from(xmlDoc.querySelectorAll('item, assessmentItem'));

      if (items.length === 0) {
        alert('لم يتم العثور على عناصر أسئلة متوافقة داخل ملف QTI المرفوع.');
        return;
      }

      const parsedQuestions: Question[] = items.map((item, idx) => {
        const promptEl = item.querySelector('prompt, material mattext');
        const questionText = promptEl?.textContent?.trim() || `سؤال مستورد (${idx + 1})`;

        const responseChoices = Array.from(item.querySelectorAll('simpleChoice, response_lid render_choice response_label'));
        const options: string[] = [];
        const choiceMap: Record<string, string> = {};

        responseChoices.forEach((choice) => {
          const identifier = choice.getAttribute('identifier') || choice.getAttribute('ident') || '';
          const text = choice.textContent?.trim() || '';
          if (text) {
            options.push(text);
            if (identifier) choiceMap[identifier] = text;
          }
        });

        let correctAnswer = '';
        const correctValueEl = item.querySelector('correctResponse value, respcondition conditionvar varequal');
        if (correctValueEl) {
          const correctId = correctValueEl.textContent?.trim() || '';
          correctAnswer = choiceMap[correctId] || correctId;
        }

        if (!options.includes(correctAnswer) && options.length > 0) {
          correctAnswer = options[0];
        }

        return {
          id: 'q_' + Date.now() + '_' + idx,
          text: questionText,
          type: 'multiple_choice',
          options: options.length > 0 ? options : ['', '', '', ''],
          correctAnswer: correctAnswer,
          points: 5,
        };
      });

      setQuestions(parsedQuestions);
      alert(`تم استيراد ${parsedQuestions.length} سؤالاً بنجاح من حزمة QTI! 🎯`);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء فك ضغط أو قراءة ملف QTI.');
    } finally {
      event.target.value = '';
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formUsername || !formPassword) return;

    if (formRole === 'hod' && !canCreateHOD(currentUser)) {
      alert('عفواً، لا تملك صلاحية إنشاء أو ترقية حسابات برتبة رئيس قسم (HOD). هذه الصلاحية محصورة في المشرف العام أو المفوضين إدارياً.');
      return;
    }

    if ((formRole === 'teacher' || formRole === 'hod') && selectedGrades.length === 0) {
      alert('يرجى تحديد صف دراسي واحد على الأقل!');
      return;
    }

    if (formRole === 'parent' && !selectedStudentId) {
      alert('يرجى اختيار الطالب التابع له ولي الأمر!');
      return;
    }

    const stagesOfSelectedGrades: SchoolStage[] = [];
    (Object.keys(STAGES_CONFIG) as SchoolStage[]).forEach((st) => {
      const hasAny = STAGES_CONFIG[st].grades.some((g) => selectedGrades.includes(g.id));
      if (hasAny) stagesOfSelectedGrades.push(st);
    });

    const generateUserId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try {
          return crypto.randomUUID();
        } catch {
          // fallback
        }
      }
      return 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    };

    const newUser: UserProfile = {
      id: generateUserId(),
      name: formName,
      username: formUsername.trim().toLowerCase(),
      password: formPassword,
      role: formRole,
      loginCount: 0,
      delegated_admin_permissions: { ...DEFAULT_DELEGATED_PERMISSIONS },
      ...(formRole === 'teacher' || formRole === 'hod'
        ? {
            allowedGrades: selectedGrades,
            allowedStages: stagesOfSelectedGrades,
            allowedTracks: selectedTracks,
          }
        : {}),
      ...(formRole === 'student'
        ? {
            stage: studentStage,
            grade: studentGrade,
            track: studentTrack,
          }
        : {}),
      ...(formRole === 'parent'
        ? {
            studentId: selectedStudentId,
          }
        : {}),
    };

    const saveResult = await saveUser(newUser);
    // تحديث واجهة المستخدم فوراً بالبيانات المحفوظة لضمان عدم توقف أو تجميد العملية
    setUsers(getUsers());
    
    // مزامنة سحابية هادئة في الخلفية
    syncUsersFromCloud().then((updatedUsers) => {
      if (updatedUsers && updatedUsers.length > 0) {
        setUsers(updatedUsers);
      }
    }).catch((err) => {
      console.warn('ملاحظة أثناء المزامنة السحابية في الخلفية:', err);
    });

    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setSelectedGrades([]);
    setSelectedTracks(['arabic-a']);
    setSelectedStudentId('');

    if (!saveResult.error) {
      alert('تم حفظ الحساب بنجاح في قاعدة البيانات السحابية والمحلية، ويمكن الدخول به من أي جهاز الآن!');
    } else {
      alert('تم حفظ الحساب محلياً، ولكن تعذر رفعه للسحابة (' + (saveResult.error.message || 'خطأ 400') + '). يرجى التحقق من الاتصال والمحاولة لاحقاً.');
    }
  };

  const handleDeleteUser = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الحساب؟')) {
      deleteUser(id);
      setUsers(getUsers());
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: 'q_' + Date.now(),
        text: '',
        type: 'multiple_choice',
        options: ['', '', '', ''],
        correctAnswer: '',
        points: 5,
      },
    ]);
  };

  const updateQuestionText = (index: number, text: string) => {
    const updated = [...questions];
    updated[index].text = text;
    setQuestions(updated);
  };

  const updateQuestionOption = (qIndex: number, optIndex: number, val: string) => {
    const updated = [...questions];
    if (updated[qIndex].options) {
      updated[qIndex].options![optIndex] = val;
      setQuestions(updated);
    }
  };

  const setCorrectAnswer = (qIndex: number, val: string) => {
    const updated = [...questions];
    updated[qIndex].correctAnswer = val;
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !actTitle) return;

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim() || !questions[i].correctAnswer) {
        alert(`يرجى كتابة نص السؤال رقم (${i + 1}) وتحديد الإجابة الصحيحة له.`);
        return;
      }
    }

    let derivedStage: SchoolStage = 'primary';
    (Object.keys(STAGES_CONFIG) as SchoolStage[]).forEach((st) => {
      if (STAGES_CONFIG[st].grades.some((g) => g.id === actGrade)) {
        derivedStage = st;
      }
    });

    const newActivity: Activity = {
      id: 'act_' + Date.now(),
      title: actTitle,
      passage: actPassage,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      stage: derivedStage,
      grade: actGrade,
      track: actTrack,
      questions,
      createdAt: new Date().toLocaleDateString('ar-EG'),
    };

    saveActivity(newActivity).then(() => {
      syncActivitiesFromCloud().then(acts => setActivities(acts));
    });
    setActivities(getActivities());
    setActTitle('');
    setActPassage('');
    setQuestions([
      {
        id: 'q_1',
        text: '',
        type: 'multiple_choice',
        options: ['', '', '', ''],
        correctAnswer: '',
        points: 5,
      },
    ]);
    alert('تم نشر النشاط التفاعلي ومزامنته سحابياً بنجاح!');
    setTeacherTab('activities');
  };

  const handleSubmitQuiz = () => {
    if (!selectedActivityToSolve || !currentUser) return;

    let totalPoints = 0;
    let earnedPoints = 0;

    selectedActivityToSolve.questions.forEach((q) => {
      totalPoints += q.points;
      if (studentAnswers[q.id] === q.correctAnswer) {
        earnedPoints += q.points;
      }
    });

    const sub: StudentSubmission = {
      id: 'sub_' + Date.now(),
      activityId: selectedActivityToSolve.id,
      activityTitle: selectedActivityToSolve.title,
      studentId: currentUser.id,
      studentName: currentUser.name,
      grade: currentUser.grade,
      track: currentUser.track,
      score: earnedPoints,
      totalPoints: totalPoints,
      submittedAt: new Date().toLocaleString('ar-EG'),
      answers: studentAnswers,
    };

    saveSubmission(sub).then(() => {
      syncSubmissionsFromCloud().then(subs => setSubmissions(subs));
    });
    setSubmissions(getSubmissions());
    setLastScore({ score: earnedPoints, total: totalPoints });
    setQuizFinished(true);
  };

  const getGradeLabel = (gId: GradeLevel): string => {
    for (const st of Object.values(STAGES_CONFIG)) {
      const found = st.grades.find((g) => g.id === gId);
      if (found) return found.labelAr;
    }
    return gId;
  };

  const renderBookCard = (
    book: BookItem, 
    role: 'teacher' | 'hod' | 'student' | 'parent',
    allowedGrades?: GradeLevel[]
  ) => {
    const isGenericTitle = !book.title || book.title.startsWith('قصة مصورة');
    const isAssigned = allowedGrades ? book.assignedGrades?.some(g => allowedGrades.includes(g)) : false;

    return (
      <div 
        key={book.id} 
        className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
      >
        <div className="relative aspect-[3/4] w-full bg-slate-900/5 overflow-hidden group flex items-center justify-center p-2">
          <img 
            src={book.coverUrl} 
            alt={book.title} 
            loading="lazy"
            className="w-full h-full object-contain drop-shadow-md rounded-xl group-hover:scale-105 transition duration-300"
          />
          <div className="absolute top-3 right-3 flex flex-col gap-1">
            <span className="px-2.5 py-1 bg-emerald-700/90 backdrop-blur-xs text-white rounded-lg text-[10px] font-bold shadow-xs">
              {book.section || 'مكتبة بوك تايم'}
            </span>
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col justify-between text-right" dir="rtl">
          <div>
            {!isGenericTitle && (
              <h3 className="font-extrabold text-sm text-slate-800 mb-1 line-clamp-1">
                {book.title}
              </h3>
            )}
            <span className="text-[11px] text-slate-400 block mb-2 font-medium">
              {book.author || 'مؤسسة هنداوي (بوك تايم)'}
            </span>

            {role !== 'student' && (
              <div className="mb-3">
                <span className="text-[10px] text-slate-400 font-semibold block mb-1">الصفوف المسند إليها:</span>
                {book.assignedGrades && book.assignedGrades.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {book.assignedGrades.map(gId => (
                      <span key={gId} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[9px] font-bold">
                        {getGradeLabel(gId)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-rose-500 font-medium">غير مسند لأي صف بعد</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100">
            {(role === 'teacher' || role === 'hod') && (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setBookToAssignWithGovernance(book);
                    setAssignInitialTab('free_reading');
                  }}
                  className="py-2 px-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  title="إرسال القصة للقراءة والاستمتاع"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>إرسال للقراءة 📖</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBookToAssignWithGovernance(book);
                    setAssignInitialTab('interactive_quiz');
                  }}
                  className="py-2 px-1.5 bg-teal-700 hover:bg-teal-800 active:scale-98 text-white rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  title="تعيين كنشاط قرائي تفاعلي برصد درجات"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>نشاط قرائي 📝</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => openReader(book)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-500" /> معاينة وقراءة القصة
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSharedReader = () => {
    if (!activeReadingBook) return null;

    const cleanId = activeReadingBook.id.replace('bt_', '');
    const directReaderUrl = `https://read.booktime.org/ar/books/${cleanId}`;

    const handleLaunchReader = () => {
      const w = window.screen.availWidth;
      const h = window.screen.availHeight;
      window.open(
        directReaderUrl,
        'BookReaderWindow',
        `width=${w},height=${h},top=0,left=0,toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );
    };

    return (
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-center shadow-2xl relative overflow-hidden">
          <button
            onClick={closeReader}
            className="absolute top-4 left-4 p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="aspect-[3/4] w-44 mx-auto rounded-2xl overflow-hidden shadow-2xl mb-5 border border-slate-700/80 bg-slate-800 p-2 flex items-center justify-center">
            <img
              src={activeReadingBook.coverUrl}
              alt={activeReadingBook.title}
              className="w-full h-full object-contain rounded-xl"
            />
          </div>

          <h3 className="text-lg font-black text-white mb-1">
            {!activeReadingBook.title.startsWith('قصة مصورة') ? activeReadingBook.title : 'معاينة القصة المصورة'}
          </h3>
          <p className="text-xs text-emerald-400 font-medium mb-6">
            {activeReadingBook.author} • {activeReadingBook.category || 'قصص تفاعلية'}
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleLaunchReader}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30"
            >
              <BookOpen className="w-5 h-5" /> ابدأ قراءة القصة الآن
            </button>

            <button
              type="button"
              onClick={() => {
                alert('رائع! يمكنك الآن التوجه لحل الأنشطة والأسئلة المرتبطة بهذه القصة 🌟');
                closeReader();
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition"
            >
              العودة للمنصة والأنشطة
            </button>
          </div>
        </div>
      </div>
    );
  };

  const availableSections = ['all', ...new Set(books.map(b => b.section || 'مكتبة بوك تايم'))];

  const filteredBooks = books.filter(b => {
    const sec = b.section || 'مكتبة بوك تايم';
    const matchesSection = selectedSection === 'all' || sec === selectedSection;

    const isRealBookCover = 
      b.coverUrl && 
      b.coverUrl.includes('/covers/ar/') && 
      !b.coverUrl.includes('.svg');

    const hasValidReadUrl = 
      b.readUrl && 
      (b.readUrl.includes('/books/') || b.readUrl.includes('read.booktime.org')) &&
      !b.title.includes('حساب');

    return matchesSection && isRealBookCover && hasValidReadUrl;
  });

  useEffect(() => {
    const targetStudentId = currentUser?.role === 'student'
      ? currentUser.id
      : (currentUser?.role === 'parent' ? (currentUser.studentId || '') : (currentUser ? '' : 'usr_student_mousa'));

    if (targetStudentId) {
      setStudentBadges(getStudentBadges(targetStudentId));
      syncStudentBadgesFromCloud(targetStudentId).then(cloudBadges => {
        setStudentBadges(cloudBadges);
      });
    } else {
      setStudentBadges([]);
    }
  }, [currentUser, isPhonicsGateOpen, isAdaptiveStoryOpen, isDrawingCanvasOpen]);

  const handleQuickLogin = (uname: string, pwd: string = '123') => {
    setLoginUsername(uname);
    setLoginPassword(pwd);
    const all = getUsers();
    const found = all.find((u) => u.username.toLowerCase() === uname.toLowerCase() && u.password === pwd);
    if (found) {
      const updatedUser = recordUserLogin(found);
      setUser(updatedUser);
      setUsers(all);
    }
  };

  // زر الرفيق الصوتي بالذكاء الاصطناعي (Floating AI Companion Widget)
  const renderFloatingMusaButton = () => {
    // 1. حصر الظهور في بوابة الطالب فقط (Student Portal Only)
    if (!currentUser || currentUser.role !== 'student') return null;

    // 2. التحقق من حوكمة الذكاء الاصطناعي وسماحية ميزة الرفيق للطالب
    if (!canUserUseAI(currentUser, aiGovernanceRules).allowed || !isAIFeatureAllowed('student').allowed) {
      return null;
    }

    // 3. إذا أغلق الطالب الكرة العائمة مؤقتاً عبر زر الإغلاق الطائر
    if (isMusaDismissed) return null;

    return (
      <div className="fixed bottom-6 left-6 z-40 animate-in fade-in zoom-in-95 duration-300">
        <div className="relative group">
          {/* زر إغلاق عائم صغير طاير بأعلى حافة الدائرة (Floating Close Badge) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMusaDismissed(true);
            }}
            className="absolute -top-1.5 -left-1.5 z-20 w-6 h-6 rounded-full bg-slate-900/85 hover:bg-rose-600 text-white flex items-center justify-center shadow-md border-2 border-white transition-all duration-200 transform hover:scale-115 active:scale-90 cursor-pointer"
            title="إخفاء موسى مؤقتاً (يمكنك استعادته في أي وقت)"
            aria-label="إخفاء رفيق موسى"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* التلميح الطائر الناعم (Tooltip) عند التحويم */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:-translate-y-1 z-30 whitespace-nowrap">
            <div className="bg-slate-900/95 text-white text-[11px] font-black px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 border border-slate-700 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>تَحَدَّثْ مَعَ مُوسَى 💬</span>
            </div>
            <div className="w-2 h-2 bg-slate-900/95 rotate-45 mx-auto -mt-1 border-r border-b border-slate-700" />
          </div>

          {/* الكبسولة الدائرية العائمة (Circular Floating Bubble) */}
          <button
            type="button"
            onClick={() => setIsMusaChatOpen(true)}
            className="relative w-16 h-16 rounded-full p-1 bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-300 shadow-xl shadow-emerald-950/20 border-2 border-white hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center cursor-pointer overflow-hidden focus:outline-hidden focus:ring-4 focus:ring-emerald-400/50"
            title="تحدث مع موسى الرفيق الذكي 🤖💬"
            aria-label="تحدث مع موسى الرفيق الذكي"
          >
            {/* الدائرة الحاوية لصورة شخصية موسى بشكل كامل وواضح */}
            <div className="w-full h-full rounded-full overflow-hidden bg-white shadow-inner">
              <img 
                src={MOUSA_AVATAR_SRC} 
                alt="موسى" 
                className="w-full h-full object-cover rounded-full select-none transform group-hover:scale-105 transition-transform duration-300" 
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            </div>

            {/* نقطة حالة تفاعلية ناعمة في الزاوية */}
            <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            </div>
          </button>
        </div>
      </div>
    );
  };

  const renderAIModals = () => {
    const activeStudentId = currentUser?.role === 'student' ? currentUser.id : (diagnosticStudent?.id || 'usr_student_mousa');
    const activeStudentName = currentUser?.role === 'student' ? currentUser.name : (diagnosticStudent?.name || 'موسى البطل');

    return (
      <>
        {isMusaChatOpen && (
          <MusaCompanionModal
            isOpen={isMusaChatOpen}
            onClose={() => setIsMusaChatOpen(false)}
            studentName={currentUser?.name || 'صديقي البطل'}
          />
        )}

        {isAdaptiveStoryOpen && (
          <AdaptiveStoryModal
            isOpen={isAdaptiveStoryOpen}
            onClose={() => {
              setIsAdaptiveStoryOpen(false);
              setStudentBadges(getStudentBadges(activeStudentId));
              syncStudentBadgesFromCloud(activeStudentId).then(b => setStudentBadges(b));
            }}
            studentId={activeStudentId}
          />
        )}

        {isPhonicsGateOpen && (
          <PhonicsGateModal
            isOpen={isPhonicsGateOpen}
            onClose={() => {
              setIsPhonicsGateOpen(false);
              setStudentBadges(getStudentBadges(activeStudentId));
              syncStudentBadgesFromCloud(activeStudentId).then(b => setStudentBadges(b));
            }}
            studentId={activeStudentId}
          />
        )}

        {isDrawingCanvasOpen && (
          <DrawingCanvasModal
            isOpen={isDrawingCanvasOpen}
            onClose={() => {
              setIsDrawingCanvasOpen(false);
              setStudentBadges(getStudentBadges(activeStudentId));
              syncStudentBadgesFromCloud(activeStudentId).then(b => setStudentBadges(b));
            }}
            studentId={activeStudentId}
          />
        )}

        {isDiagnosticModalOpen && (
          <DiagnosticReportModal
            isOpen={isDiagnosticModalOpen}
            onClose={() => setIsDiagnosticModalOpen(false)}
            studentName={diagnosticStudent?.name || activeStudentName}
            studentId={diagnosticStudent?.id || activeStudentId}
            submissions={submissions.filter(s => s.studentId === (diagnosticStudent?.id || activeStudentId))}
          />
        )}

        {isPrintableWorksheetOpen && (
          <PrintableWorksheetModal
            isOpen={isPrintableWorksheetOpen}
            onClose={() => setIsPrintableWorksheetOpen(false)}
            studentName={worksheetStudent?.name || activeStudentName}
            grade={worksheetStudent?.grade ? getGradeLabel(worksheetStudent.grade) : 'الصف الأول الابتدائي'}
            weakLetters={['ص', 'ض', 'ط']}
          />
        )}

        {isClassDiagnosticOpen && (
          <ClassDiagnosticModal
            isOpen={isClassDiagnosticOpen}
            onClose={() => setIsClassDiagnosticOpen(false)}
            submissions={submissions}
            teacherName={currentUser?.name || 'معلم اللغة العربية'}
            activityTitle="أنشطة القراءة والفهم التفاعلية"
          />
        )}

        {bookToAssignWithGovernance && currentUser && (
          <TeacherBookAssignModal
            isOpen={!!bookToAssignWithGovernance}
            onClose={() => setBookToAssignWithGovernance(null)}
            book={bookToAssignWithGovernance}
            teacher={currentUser}
            allowedGrades={currentUser.allowedGrades || ['grade-1', 'grade-2', 'grade-3']}
            students={users.filter(u => u.role === 'student' && (!u.school_id || u.school_id === currentUser.school_id))}
            initialTab={assignInitialTab}
            onSuccess={(msg) => {
              alert(msg);
              setBooks(getBooksRepository());
              setActivities(getActivities());
              setReadingAssignments(getReadingBookAssignments());
            }}
          />
        )}

        {activeGameToPlay && currentUser && (
          <AIGamePlayerModal
            isOpen={!!activeGameToPlay}
            onClose={() => {
              setActiveGameToPlay(null);
              if (currentUser.role === 'student') {
                setStudentBadges(getStudentBadges(currentUser.id));
                syncStudentBadgesFromCloud(currentUser.id).then((b) => setStudentBadges(b));
                syncSubmissionsFromCloud().then((subs) => setSubmissions(subs));
              }
            }}
            activity={activeGameToPlay}
            student={currentUser}
            onGameCompleted={(newBadge) => {
              if (currentUser.role === 'student') {
                if (newBadge) {
                  setStudentBadges((prev) => [newBadge, ...prev.filter((b) => b.id !== newBadge.id)]);
                }
                syncStudentBadgesFromCloud(currentUser.id).then((b) => setStudentBadges(b));
                syncSubmissionsFromCloud().then((subs) => setSubmissions(subs));
              }
            }}
          />
        )}

        {/* 1-Click AI Learning Diagnostic Modal */}
        {isQuickDiagnosticOpen && quickDiagnosticStudent && (
          <QuickAIDiagnosticModal
            isOpen={isQuickDiagnosticOpen}
            onClose={() => setIsQuickDiagnosticOpen(false)}
            studentName={quickDiagnosticStudent.name}
            studentId={quickDiagnosticStudent.id}
            submissions={submissions}
            onLaunchRecommendedGame={(recommendedGameType) => {
              setIsQuickDiagnosticOpen(false);
              const matchedGame = activities.find(
                a => a.activityType === 'game' && a.gameData?.gameType === recommendedGameType
              ) || activities.find(a => a.activityType === 'game');
              if (matchedGame) {
                setActiveGameToPlay(matchedGame);
              }
            }}
          />
        )}

        {/* Shareable Badge Modal */}
        {showShareBadgeModal && (
          <ShareableBadgeModal
            isOpen={showShareBadgeModal}
            onClose={() => setShowShareBadgeModal(false)}
            badge={selectedBadgeForShare}
            studentName={currentUser?.name || 'موسى البطل'}
          />
        )}

        {/* Student Exam Room Modal with Anti-Cheat */}
        {activeExamForStudent && currentUser && (
          <StudentExamModal
            exam={activeExamForStudent}
            currentUser={currentUser}
            onClose={() => setActiveExamForStudent(null)}
            onExamSubmitted={(submittedSession) => {
              setExamSessionsList(prev => [submittedSession, ...prev.filter(s => s.id !== submittedSession.id)]);
              syncExamSessionsFromCloud().then(sessions => setExamSessionsList(sessions));
            }}
          />
        )}

        {/* Admin Delegation Modal */}
        {isAdminDelegationModalOpen && selectedUserForDelegation && currentUser && (
          <AdminDelegationModal
            isOpen={isAdminDelegationModalOpen}
            onClose={() => {
              setIsAdminDelegationModalOpen(false);
              setSelectedUserForDelegation(null);
            }}
            user={selectedUserForDelegation}
            adminUser={currentUser}
            onSaved={(updated) => {
              setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
              if (currentUser.id === updated.id) {
                setUser(updated);
              }
            }}
          />
        )}

        {/* Edit Teacher Grades Modal */}
        {isEditTeacherGradesModalOpen && selectedTeacherForGrades && currentUser && (
          <EditTeacherGradesModal
            isOpen={isEditTeacherGradesModalOpen}
            onClose={() => {
              setIsEditTeacherGradesModalOpen(false);
              setSelectedTeacherForGrades(null);
            }}
            teacher={selectedTeacherForGrades}
            actorUser={currentUser}
            onSaved={(updated) => {
              setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
            }}
          />
        )}

        {/* User Profile & Account Settings Modal */}
        {isProfileModalOpen && currentUser && (
          <UserProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            currentUser={currentUser}
            onUserUpdate={handleUserUpdate}
          />
        )}

        {/* زر الرسائل العائم للمحادثة السريعة */}
        {currentUser && (
          <FloatingChatButton
            currentUser={currentUser}
            onClick={() => setIsChatModalOpen(true)}
            hasCompanion={currentUser.role === 'student' && !isMusaDismissed && canUserUseAI(currentUser, aiGovernanceRules).allowed && isAIFeatureAllowed('student').allowed}
          />
        )}

        {/* مركز الرسائل المدرسية والتواصل الفوري */}
        {isChatModalOpen && currentUser && (
          <EducationalChatModal
            isOpen={isChatModalOpen}
            onClose={() => setIsChatModalOpen(false)}
            currentUser={currentUser}
            allUsers={users}
          />
        )}

        {/* نافذة تقرير الأداء الفعلي الفوري وتشخيص الفجوات التعليمية (غير معتمد على الذكاء الاصطناعي) */}
        {isInstantReportOpen && instantReportStudent && (
          <InstantStudentReportModal
            isOpen={isInstantReportOpen}
            onClose={() => {
              setIsInstantReportOpen(false);
              setInstantReportStudent(null);
            }}
            student={instantReportStudent}
            allSubmissions={submissions}
            allExamSessions={examsList.length > 0 ? (getExamSessions ? getExamSessions() : []) : []}
            schoolName={currentUser?.school_id ? (schoolsList.find(s => s.id === currentUser.school_id)?.name || 'مدرسة موسى النموذجية') : 'منصة تعلّم مع موسى النموذجية'}
            allClassStudents={users.filter(u => u.role === 'student' && (!instantReportStudent.grade || u.grade === instantReportStudent.grade))}
            onSelectAnotherStudent={(st) => setInstantReportStudent(st)}
            actorRole={currentUser?.role === 'hod' ? 'hod' : 'teacher'}
          />
        )}

        {/* 1. نافذة مختبر الطلاقة القرائية الشفهية (ORF) */}
        {isORFModalOpen && currentUser && (
          <OralReadingFluencyModal
            isOpen={isORFModalOpen}
            onClose={() => {
              setIsORFModalOpen(false);
              setOrfTargetStudent(null);
            }}
            currentUser={currentUser}
            targetStudent={orfTargetStudent || undefined}
          />
        )}

        {/* 2. نافذة شجرة الكفايات التكيفية والتكرار المتباعد (Knowledge Tree & Spaced Repetition) */}
        {isKnowledgeTreeOpen && currentUser && (
          <AdaptiveKnowledgeTreeModal
            isOpen={isKnowledgeTreeOpen}
            onClose={() => {
              setIsKnowledgeTreeOpen(false);
              setKnowledgeTreeTargetStudent(null);
            }}
            currentUser={currentUser}
            targetStudent={knowledgeTreeTargetStudent || undefined}
          />
        )}

        {/* 3. نافذة جواز السفر اللغوي الدولي وإطار CEFR */}
        {isLanguagePassportOpen && currentUser && (
          <LanguagePassportModal
            isOpen={isLanguagePassportOpen}
            onClose={() => {
              setIsLanguagePassportOpen(false);
              setLanguagePassportTargetStudent(null);
            }}
            currentUser={currentUser}
            targetStudent={languagePassportTargetStudent || undefined}
            currentUILang={currentUILang}
            onLanguageChange={(l) => setCurrentUILang(l)}
          />
        )}

        {/* 4. لوحة تحكم وحوكمة المعلم الشاملة (Teacher Control Hub) */}
        {isTeacherControlHubOpen && currentUser && (
          <TeacherControlHub
            currentUser={currentUser}
            students={users.filter(u => u.role === 'student')}
            books={books}
            allowedGrades={currentUser.allowedGrades || ['grade-1', 'grade-2', 'grade-3']}
            initialStudent={teacherControlHubTargetStudent}
            initialTab={teacherControlHubInitialTab}
            onClose={() => {
              setIsTeacherControlHubOpen(false);
              setTeacherControlHubTargetStudent(null);
            }}
            onRefreshData={() => {
              setUsers(getUsers());
              setReadingAssignments(getReadingBookAssignments());
              setActivities(getActivities());
            }}
          />
        )}
      </>
    );
  };

  // شريط مرونة العمل دون إنترنت وحالة المزامنة التلقائية
  const renderOfflineBanner = () => {
    if (isOnline && offlineQueueCount === 0) return null;
    return (
      <div className={`px-4 py-2 text-xs font-bold flex items-center justify-between border-b shadow-xs transition z-20 ${
        !isOnline 
          ? 'bg-amber-500 text-amber-950 border-amber-600' 
          : 'bg-emerald-600 text-white border-emerald-700'
      }`}>
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4 text-amber-950 animate-pulse" />
              <span>وضع العمل دون إنترنت (Offline Mode) — الألعاب والتحديات متاحة ومحفوظة، وسيتم رفع تسليماتك فور عودة الاتصال ⚡</span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 text-emerald-200" />
              <span>متصل بالسحابة 🟢 جارٍ تفريغ طابور المزامنة ({offlineQueueCount} تسليم)...</span>
            </>
          )}
        </div>
        {offlineQueueCount > 0 && (
          <span className="px-2 py-0.5 bg-black/20 rounded-md text-[10px] font-black">
            {offlineQueueCount} معلّق
          </span>
        )}
      </div>
    );
  };

  // عنصر أيقونة الهيدر الموحد
  const renderHeaderLogo = () => (
    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-emerald-500/30 bg-white flex-shrink-0">
      <img 
        src={MOUSA_AVATAR_SRC} 
        alt="شعار موسى" 
        className="w-full h-full object-cover" 
        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
      />
    </div>
  );

  // ================= 1. شاشة تسجيل الدخول =================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/70 p-7 sm:p-8 border border-slate-200/90 relative">
          {/* صورة موسى في شاشة تسجيل الدخول */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg shadow-emerald-700/15 mx-auto mb-3.5 border-2 border-emerald-500/30 bg-white p-0.5">
            <img 
              src={MOUSA_AVATAR_SRC} 
              alt="منصة تعلَّم مع موسى" 
              className="w-full h-full object-cover rounded-xl" 
            />
          </div>
          
          {/* الهوية والشعار المعتمد */}
          <h1 className="text-2xl font-black text-slate-800 text-center mb-1.5 tracking-tight">
            منصة تعلَّم مع موسى
          </h1>
          <div className="text-center mb-6">
            <p className="text-emerald-800 text-sm font-extrabold tracking-wide">
              «صُممت للضاد وليست معرّبة»
            </p>
          </div>

          {loginError && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl text-center font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اسم المستخدم أو البريد الإلكتروني
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="اسم المستخدم أو البريد الإلكتروني"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/60 placeholder:text-slate-400 text-slate-800 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/60 placeholder:text-slate-400 text-slate-800 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              تسجيل الدخول
            </button>
          </form>

          {/* تذييل رسمي للبطاقة */}
          <div className="mt-8 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 font-medium">
              جميع الحقوق محفوظة © {new Date().getFullYear()} منصة تعلَّم مع موسى
            </p>
          </div>
        </div>

        {renderAIModals()}
      </div>
    );
  }

  // ================= فحص حالة اشتراك المدرسة والحظر التلقائي (Access Enforcement) =================
  const schoolAccess = checkSchoolAccess(currentUser.school_id, currentUser.role);
  if (!schoolAccess.allowed && currentUser.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-slate-900 font-sans" dir="rtl">
        <SuspendedSchoolNotice
          user={currentUser}
          school={schoolAccess.school}
          reason={schoolAccess.reason}
          message={schoolAccess.message}
          onLogout={handleLogout}
          onSwitchToDemoSchool={() => handleQuickLogin('admin', '123')}
        />
        {renderAIModals()}
      </div>
    );
  }

  // ================= 2. واجهة المؤسس والمدير العام للمنصة (Platform Founder / Super Admin - المسار: /super-admin) =================
  if (currentUser.role === 'super_admin') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            {renderHeaderLogo()}
            <div>
              <h1 className="font-extrabold text-base text-slate-900">تعلَّم مع موسى | لوحة المؤسس والمدير العام للمنصة</h1>
              <p className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> المشرف العام المركزي: {currentUser.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsChatModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition shadow-xs cursor-pointer"
              title="مركز الرسائل المدرسية والتواصل الفوري"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">مركز الرسائل 💬</span>
            </button>

            <UserNavbarProfileButton
              user={currentUser}
              onClick={() => setIsProfileModalOpen(true)}
            />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
            >
              <LogOut className="w-3.5 h-3.5" /> تسجيل خروج
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <SuperAdminSchoolsDashboard
            currentUser={currentUser}
            onSchoolsUpdated={() => setSchoolsList(getSchools())}
            onSimulateUser={(simUser) => {
              setUser(simUser);
              setCurrentUser(simUser);
            }}
            onImpersonateSchool={handleImpersonateSchool}
          />
        </main>
        {renderSharedReader()}
        {renderAIModals()}
      </div>
    );
  }

  // ================= 3. لوحة الإدارة العليا للمدرسة (School Admin Portal - المسار: /school-admin) =================
  if (currentUser.role === 'school_admin') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <SchoolAdminPortal
          currentUser={currentUser}
          impersonatedSchool={impersonatedSchool}
          onExitImpersonation={handleExitImpersonation}
          onLogout={handleLogout}
          onUserProfileClick={() => setIsProfileModalOpen(true)}
          renderLogo={renderHeaderLogo}
        />
        {renderSharedReader()}
        {renderAIModals()}
      </div>
    );
  }

  // ================= 3. واجهة رئيس القسم =================
  if (currentUser.role === 'hod') {
    const hodGrades = currentUser.allowedGrades || [];
    const departmentTeachers = users.filter((u) => 
      u.role === 'teacher' && u.allowedGrades?.some((g) => hodGrades.includes(g))
    );
    const departmentSubmissions = submissions.filter((s) => s.grade && hodGrades.includes(s.grade));

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {renderHeaderLogo()}
            <div>
              <h1 className="font-extrabold text-base text-slate-800">تعلَّم مع موسى | لوحة رئيس القسم</h1>
              <p className="text-xs text-slate-500 font-medium">رئيس القسم: <b className="text-slate-800">{currentUser.name}</b></p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsChatModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition shadow-xs cursor-pointer"
              title="مركز الرسائل المدرسية والتواصل الفوري"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">مركز الرسائل 💬</span>
            </button>

            <UserNavbarProfileButton
              user={currentUser}
              onClick={() => setIsProfileModalOpen(true)}
            />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
            >
              <LogOut className="w-3.5 h-3.5" /> تسجيل خروج
            </button>
          </div>
        </header>

        <main className={hodTab === 'challenge' || hodTab === 'live' ? "w-full px-2 sm:px-4 py-2 space-y-3" : "max-w-6xl mx-auto px-4 py-8 space-y-6"}>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setHodTab('overview')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                hodTab === 'overview' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> النظرة العامة والتقارير
            </button>
            <button
              onClick={() => setHodTab('grades')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                hodTab === 'grades' ? 'bg-indigo-900 text-white shadow-md shadow-indigo-900/20' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" /> سجل درجات القسم والتصدير 📊
            </button>
            <button
              onClick={() => setHodTab('teacher_tasks')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                hodTab === 'teacher_tasks' ? 'bg-teal-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <ListTodo className="w-4 h-4 text-teal-400" /> إدارة مهام وتكليفات المعلمين
              {teacherTasks.filter(t => !t.completed && departmentTeachers.some(dt => dt.id === t.teacherId)).length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-teal-500 text-white text-[10px] font-bold">
                  {teacherTasks.filter(t => !t.completed && departmentTeachers.some(dt => dt.id === t.teacherId)).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setHodTab('library')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                hodTab === 'library' ? 'bg-emerald-800 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <Library className="w-4 h-4 text-emerald-400" /> المستودع القرائي وإسناد الكتب ({filteredBooks.length})
            </button>
            <button
              onClick={() => setHodTab('padlet')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                hodTab === 'padlet'
                  ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-md shadow-amber-600/20'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Pin className="w-4 h-4 text-amber-500" /> حائط الأنشطة التفاعلي 📌
            </button>
            <button
              onClick={() => setHodTab('challenge')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                hodTab === 'challenge'
                  ? 'bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 text-white shadow-md shadow-indigo-700/20'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-400" /> تَحَدِّي مُوسَى 🏆
            </button>
            <button
              onClick={() => setHodTab('live')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                hodTab === 'live'
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-md shadow-red-600/20'
                  : 'bg-white border border-red-200 text-red-700 hover:bg-red-50'
              }`}
            >
              <Video className="w-4 h-4 text-rose-500" /> فصل موسى المباشر 🎥
            </button>
            {canControlAIGovernance(currentUser) && (
              <button
                onClick={() => setHodTab('ai_governance' as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  (hodTab as string) === 'ai_governance'
                    ? 'bg-rose-700 text-white'
                    : 'bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-rose-500" /> التحكم في الذكاء الاصطناعي (مفوض) ⚡
              </button>
            )}
          </div>

          {hodTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">معلمو القسم</span>
                    <h3 className="text-xl font-bold text-slate-800">{departmentTeachers.length} معلم</h3>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <ActivityIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">إجمالي الأنشطة المنشورة</span>
                    <h3 className="text-xl font-bold text-slate-800">
                      {activities.filter(a => hodGrades.includes(a.grade)).length} نشاط
                    </h3>
                  </div>
                </div>

                <div 
                  onClick={() => setHodTab('grades')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between cursor-pointer hover:border-amber-300 hover:shadow-sm transition"
                  title="عرض وتصدير سجل الدرجات المعتمد للقسم"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-medium">حلول واستجابات الطلاب</span>
                      <h3 className="text-xl font-bold text-slate-800">{departmentSubmissions.length} حل مكتمل</h3>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200">
                    عرض وتصدير 📥
                  </span>
                </div>
              </div>

              {/* بطاقة كشف الفجوات الأكاديمية والتقارير الفورية المباشرة لرئيس القسم */}
              <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md border border-emerald-700/50 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-black border border-emerald-400/30">
                      ميزة إشرافية جديدة 🌟 • غير معتمد على AI
                    </span>
                    <h3 className="text-base font-black">
                      استخراج تقارير التحصيل الفورية وتشخيص الفجوات التعليمية
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                    يمكن لرئيس القسم والمعلم استخراج تقرير أداء فوري مبني حصراً على الدرجات الفعلية للأنشطة والاختبارات، ورسم بياني لمسار التقدم، مع تحديد الفجوات المهارية بدقة، وخطط التدخل العلاجي والتمكين وطباعتها بصفة رسمية.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const firstStudent = users.find(u => u.role === 'student' && (!u.grade || hodGrades.length === 0 || hodGrades.includes(u.grade)));
                      if (firstStudent) {
                        setInstantReportStudent(firstStudent);
                        setIsInstantReportOpen(true);
                      } else {
                        setHodTab('grades');
                      }
                    }}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>استخراج تقرير فوري لطالب 📊</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHodTab('grades')}
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition border border-white/20 cursor-pointer"
                  >
                    <span>عرض سجل درجات القسم 📋</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                <h2 className="font-bold text-base mb-2 text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-600" /> تقرير نشاط وزيارات المعلمين
                </h2>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400">
                        <th className="pb-3 font-semibold">اسم المعلم</th>
                        <th className="pb-3 font-semibold">الصفوف المسندة</th>
                        <th className="pb-3 font-semibold">الأنشطة المنشورة</th>
                        <th className="pb-3 font-semibold">عدد مرات الدخول</th>
                        <th className="pb-3 font-semibold">آخر تسجيل دخول</th>
                        <th className="pb-3 font-semibold text-center">إدارة الصفوف والتكليفات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {departmentTeachers.map((t) => {
                        const actCount = activities.filter((a) => a.teacherId === t.id).length;
                        return (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-3 font-bold text-slate-800">{t.name}</td>
                            <td className="py-3">
                              <div className="flex flex-wrap gap-1">
                                {t.allowedGrades?.map((gId) => (
                                  <span key={gId} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                                    {getGradeLabel(gId)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 font-bold text-emerald-600">{actCount} نشاط</td>
                            <td className="py-3 font-bold text-indigo-600">{t.loginCount || 0} زيارة</td>
                            <td className="py-3 text-slate-500">{t.lastLogin || 'لم يسجل دخول بعد'}</td>
                            <td className="py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedTeacherForGrades(t);
                                    setIsEditTeacherGradesModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 flex items-center gap-1 transition-colors"
                                  title="تعديل الصفوف والمراحل حصرياً لرئيس القسم"
                                >
                                  <GraduationCap className="w-3.5 h-3.5" />
                                  تعديل الصفوف
                                </button>
                                <button
                                  onClick={() => {
                                    setHodTab('teacher_tasks');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-[11px] border border-teal-200 flex items-center gap-1 transition-colors"
                                  title="إدارة المهام والتكليفات"
                                >
                                  <ListTodo className="w-3.5 h-3.5" />
                                  إسناد مهام
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {hodTab === 'grades' && (() => {
            const userPerm = canUserUseAI(currentUser, aiGovernanceRules);
            const isHodAIPermitted = userPerm.overrideStatus === 'inherit' 
              ? isAIFeatureAllowed('teacher').allowed 
              : userPerm.allowed;
            const hodAIReason = userPerm.reason || isAIFeatureAllowed('teacher').reason;
            const departmentStudents = users.filter((u) => 
              u.role === 'student' && (!u.grade || hodGrades.length === 0 || hodGrades.includes(u.grade))
            );

            return (
              <GradebookManager
                currentUser={currentUser}
                students={departmentStudents}
                submissions={departmentSubmissions}
                allowedGrades={hodGrades}
                onOpenQuickDiagnostic={(student) => {
                  setQuickDiagnosticStudent(student);
                  setIsQuickDiagnosticOpen(true);
                }}
                onOpenFullDiagnostic={(student) => {
                  setDiagnosticStudent(student);
                  setIsDiagnosticModalOpen(true);
                }}
                onOpenClassDiagnostic={() => {
                  setIsClassDiagnosticOpen(true);
                }}
                onOpenInstantReport={(student) => {
                  setInstantReportStudent(student);
                  setIsInstantReportOpen(true);
                }}
                onOpenORF={(st) => {
                  setOrfTargetStudent(st);
                  setIsORFModalOpen(true);
                }}
                onOpenKnowledgeTree={(st) => {
                  setKnowledgeTreeTargetStudent(st);
                  setIsKnowledgeTreeOpen(true);
                }}
                onOpenLanguagePassport={(st) => {
                  setLanguagePassportTargetStudent(st);
                  setIsLanguagePassportOpen(true);
                }}
                isAIPermitted={isHodAIPermitted}
                aiBlockedReason={hodAIReason}
                onRefreshData={() => {
                  setUsers(getUsers());
                }}
              />
            );
          })()}

          {hodTab === 'teacher_tasks' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <TeacherTasksManager
                actorUser={currentUser}
                teachers={departmentTeachers}
                onTasksUpdated={() => setTeacherTasks(getTeacherTasks())}
              />
            </div>
          )}

          {(hodTab as string) === 'ai_governance' && canControlAIGovernance(currentUser) && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <AdminAIGovernancePanel
                rules={aiGovernanceRules}
                onRulesUpdated={(newRules) => setAiGovernanceRules(newRules)}
                adminName={currentUser.name + ' (رئيس قسم مفوض)'}
                users={users}
                onUserUpdated={(updatedUser) => {
                  setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
                }}
              />
            </div>
          )}

          {hodTab === 'library' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Library className="w-5 h-5 text-emerald-600" /> المستودع القرائي المركزي (إشراف القسم)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    يمكنك اعتماد القصص وإسنادها لصفوف قسمك لضمان توافقها مع الخطة التعليمية.
                  </p>
                </div>
                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                  إجمالي الكتب: {filteredBooks.length} كتاب
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSection('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    selectedSection === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  جميع الأقسام ({books.length})
                </button>
                {availableSections.filter(s => s !== 'all').map(sec => (
                  <button
                    key={sec}
                    onClick={() => setSelectedSection(sec)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      selectedSection === sec ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    📚 {sec}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredBooks.map((book) => renderBookCard(book, 'hod', hodGrades))}
              </div>
            </div>
          )}

          {hodTab === 'padlet' && (
            <PadletBoardView
              currentUser={currentUser}
              initialGrade={hodGrades[0] || 'grade-1'}
              initialTrack={currentUser.allowedTracks?.[0] || 'arabic-a'}
            />
          )}

          {hodTab === 'challenge' && (
            <div className="w-full h-[calc(100vh-140px)] min-h-[720px]">
              <MousaChallenge
                currentUser={currentUser}
                initialGrade={hodGrades[0] || 'grade-1'}
                initialTrack={currentUser.allowedTracks?.[0] || 'arabic-a'}
              />
            </div>
          )}

          {hodTab === 'live' && (
            <div className="space-y-6">
              <LiveClassroom
                currentUser={currentUser}
                initialGrade={hodGrades[0] || 'grade-1'}
                initialTrack={currentUser.allowedTracks?.[0] || 'arabic-a'}
                onLeave={() => setHodTab('overview')}
              />
            </div>
          )}
        </main>
        {renderSharedReader()}
        {renderAIModals()}
      </div>
    );
  }

  // ================= 4. واجهة المعلم =================
  if (currentUser.role === 'teacher') {
    const teacherAllowedGrades = currentUser.allowedGrades || [];
    const teacherAllowedTracks = currentUser.allowedTracks || ['arabic-a'];
    const teacherActivities = activities.filter((a) => a.teacherId === currentUser.id);

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        {renderOfflineBanner()}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {renderHeaderLogo()}
            <div>
              <h1 className="font-extrabold text-base text-slate-800">تعلَّم مع موسى | بوابة المعلم</h1>
              <p className="text-xs text-slate-500 font-medium">المعلم: <b className="text-slate-800">{currentUser.name}</b></p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsChatModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition shadow-xs cursor-pointer"
              title="مركز الرسائل المدرسية والتواصل الفوري"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">مركز الرسائل 💬</span>
            </button>

            <UserNavbarProfileButton
              user={currentUser}
              onClick={() => setIsProfileModalOpen(true)}
            />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
            >
              <LogOut className="w-3.5 h-3.5" /> تسجيل خروج
            </button>
          </div>
        </header>

        <main className={teacherTab === 'challenge' || teacherTab === 'live' ? "w-full px-2 sm:px-4 py-2" : "max-w-6xl mx-auto px-4 py-8"}>
          <div className="flex flex-wrap gap-2 mb-6">
            {/* زر لوحة حوكمة وتخصيص المعلم الشاملة */}
            <button
              onClick={() => {
                setTeacherControlHubTargetStudent(null);
                setTeacherControlHubInitialTab('library');
                setIsTeacherControlHubOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white shadow-md shadow-indigo-700/25 cursor-pointer hover:opacity-95"
              title="لوحة حوكمة وإسناد المحتوى الشاملة: الرف المفتوح، ألعاب موسى، جواز السفر CEFR، مختبر الطلاقة ORF، خطط التمكين"
            >
              <Sliders className="w-4 h-4 text-amber-300" />
              <span>لوحة تحكم وحوكمة المعلم 🎛️</span>
            </button>

            <button
              onClick={() => setTeacherTab('activities')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'activities' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <BookOpen className="w-4 h-4" /> أنشطتي المنشورة ({teacherActivities.length})
            </button>
            <button
              onClick={() => setTeacherTab('games')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'games'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Gamepad2 className="w-4 h-4 text-amber-300" /> إرسال لعبة ذكية للطلاب 🎮
            </button>
            <button
              onClick={() => setTeacherTab('create')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'create' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <Plus className="w-4 h-4" /> إنشاء نشاط تفاعلي
            </button>
            <button
              onClick={() => setTeacherTab('library')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'library' ? 'bg-emerald-800 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <Library className="w-4 h-4 text-emerald-400" /> المستودع القرائي وإسناد الكتب ({filteredBooks.length})
            </button>
            <button
              onClick={() => setTeacherTab('grades')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'grades' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <Award className="w-4 h-4" /> رصد درجات الطلاب ({submissions.length})
            </button>
            <button
              onClick={() => setTeacherTab('exams')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'exams'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FileCheck2 className="w-4 h-4 text-emerald-500" /> مركز الاختبارات والتقييمات 📝 ({examsList.filter(e => e.teacher_id === currentUser.id).length})
            </button>
            <button
              onClick={() => setTeacherTab('tasks')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'tasks'
                  ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ListTodo className="w-4 h-4 text-teal-600" /> التكليفات والمهام المسندة إليك
              {teacherTasks.filter(t => t.teacherId === currentUser.id && !t.completed).length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {teacherTasks.filter(t => t.teacherId === currentUser.id && !t.completed).length} مطلوبة
                </span>
              )}
            </button>
            <button
              onClick={() => setTeacherTab('padlet')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'padlet'
                  ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-md shadow-amber-600/20'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Pin className="w-4 h-4 text-amber-500" /> حائط الأنشطة التفاعلي 📌
            </button>
            <button
              onClick={() => setTeacherTab('challenge')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'challenge'
                  ? 'bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 text-white shadow-md shadow-indigo-700/20'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-500" /> تَحَدِّي مُوسَى 🏆
            </button>
            <button
              onClick={() => setTeacherTab('live')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                teacherTab === 'live'
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-md shadow-red-600/20'
                  : isTeacherLiveActive
                    ? 'bg-red-50 border-2 border-red-500 text-red-700 hover:bg-red-100 shadow-md shadow-red-500/10'
                    : 'bg-white border border-red-200 text-red-700 hover:bg-red-50'
              }`}
            >
              <Video className="w-4 h-4 text-rose-500" />
              <span>فصل موسى المباشر 🎥</span>
              {isTeacherLiveActive && (
                <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block" />
                  البث جارٍ 🔴
                </span>
              )}
            </button>
          </div>

          {teacherTab === 'library' && (
            <div className="space-y-6">
              {/* ترويسة المستودع القرائي المركزي */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Library className="w-5 h-5 text-emerald-600" /> المستودع القرائي ومكتبة بوك تايم (2165 كتاباً)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    حوكمة القراءة وإسناد الكتب: اختر أي قصة لإرسالها للقراءة والاستمتاع أو تعيينها كنشاط قرائي تفاعلي برصد درجات آلي.
                  </p>
                </div>
                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 flex-shrink-0">
                  إجمالي الكتب: {filteredBooks.length} كتاب
                </div>
              </div>

              {/* أداة حوكمة إتاحة الرف الكامل للقراءة الحرة للفصول (Toggle Governance) */}
              <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-5 text-white shadow-md border border-emerald-700/40">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-[10px] font-black text-emerald-300">
                        حوكمة القراءة المدرسية 🔒
                      </span>
                      <h3 className="text-sm sm:text-base font-black">
                        إتاحة المكتبة الكاملة للقراءة الحرة للفصل
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                      الوضع الافتراضي هو <b>حجب الرف المفتوح</b> عن الطلاب بحيث لا يرى الطالب إلا ما تسنده إليه حصراً. يمكنك تفعيل هذا الخيار لإتاحة كامل الـ 2165 كتاباً للتصفح الحر لطلاب صف معين.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/20">
                    {teacherAllowedGrades.map((gId) => {
                      const isOpenForGrade = isFullLibraryOpenForGrade(gId, currentUser.school_id);
                      return (
                        <div key={gId} className="flex items-center gap-2 bg-slate-950/40 px-3 py-2 rounded-xl border border-white/15">
                          <span className="text-xs font-bold text-emerald-200">{getGradeLabel(gId)}:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextState = !isOpenForGrade;
                              setFullLibraryOpenForGrade(gId, nextState, currentUser.school_id);
                              setOpenLibraryToggleNonce(n => n + 1);
                            }}
                            className={`px-3 py-1 rounded-lg text-[11px] font-black transition flex items-center gap-1.5 cursor-pointer ${
                              isOpenForGrade
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-rose-500/80 hover:bg-rose-500 text-white'
                            }`}
                          >
                            <span>{isOpenForGrade ? 'مفتوحة 🟢' : 'محجوبة 🔒'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSection('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    selectedSection === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  جميع الأقسام ({books.length})
                </button>
                {availableSections.filter(s => s !== 'all').map(sec => (
                  <button
                    key={sec}
                    onClick={() => setSelectedSection(sec)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      selectedSection === sec ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    📚 {sec}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredBooks.map((book) => renderBookCard(book, 'teacher', teacherAllowedGrades))}
              </div>
            </div>
          )}

          {teacherTab === 'create' && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs max-w-3xl mx-auto relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="font-extrabold text-lg flex items-center gap-2 text-slate-800">
                    <Sparkles className="w-5 h-5 text-emerald-600" /> بناء نشاط تفاعلي جديد
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">صمم نشاطك أو اختر قصة مصورة وأسئلة بنقرة زر.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBankModalOpen(true)}
                    className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 transition flex items-center gap-1.5 shadow-xs"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> بنك القصص الإسلامية
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBooksModalOpen(true)}
                    className="px-3 py-2 bg-teal-50 text-teal-800 border border-teal-300 rounded-xl text-xs font-bold hover:bg-teal-100 transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Library className="w-3.5 h-3.5 text-teal-600" /> مستودع الكتب (بوك تايم)
                  </button>
                </div>
              </div>

              {/* مودال اختيار قصة من مستودع الكتب */}
              {isBooksModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-3xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col border border-slate-200 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Library className="w-5 h-5 text-teal-600" />
                        <h3 className="font-extrabold text-sm text-slate-800">اختر قصة من مستودع الكتب لبناء النشاط عليها</h3>
                      </div>
                      <button
                        onClick={() => setIsBooksModalOpen(false)}
                        className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-lg"
                      >
                        إغلاق ✕
                      </button>
                    </div>

                    <div className="relative mb-4">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                      <input
                        type="text"
                        placeholder="ابحث باسم القصة أو الكتاب..."
                        value={bookSearchKeyword}
                        onChange={(e) => setBookSearchKeyword(e.target.value)}
                        className="w-full pr-10 pl-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    <div className="overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
                      {filteredBooks
                        .filter(b => b.title.toLowerCase().includes(bookSearchKeyword.trim().toLowerCase()))
                        .slice(0, 36)
                        .map((b) => (
                          <div key={b.id} className="border border-slate-200 rounded-2xl p-2.5 flex flex-col justify-between bg-slate-50/50 hover:bg-white hover:border-teal-500 hover:shadow-sm transition text-center">
                            <div className="aspect-[3/4] w-full bg-slate-100 rounded-xl overflow-hidden mb-2 p-1">
                              <img src={b.coverUrl} alt={b.title} className="w-full h-full object-contain" />
                            </div>
                            <h4 className="font-bold text-xs text-slate-800 line-clamp-1 mb-2">{b.title}</h4>
                            <button
                              type="button"
                              onClick={() => handleSelectBookForActivity(b)}
                              className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold transition shadow-xs"
                            >
                              اختيار القصة للنشاط
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* مودال بنك القصص الإسلامية */}
              {isBankModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-slate-200 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-extrabold text-sm text-slate-800">بنك القصص والأسئلة الإسلامية والتربوية</h3>
                      </div>
                      <button
                        onClick={() => setIsBankModalOpen(false)}
                        className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-lg"
                      >
                        إغلاق ✕
                      </button>
                    </div>

                    <div className="space-y-3">
                      {storyBank.map((story) => (
                        <div key={story.id} className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/70 transition flex flex-col justify-between gap-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-bold text-sm text-emerald-950">{story.title}</h4>
                              <span className="px-2 py-0.5 bg-emerald-200/70 text-emerald-900 rounded-md text-[10px] font-bold">
                                {story.moralTopic}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-2">{story.passage}</p>
                            <span className="text-[11px] text-slate-400 font-medium">
                              المستوى: {getGradeLabel(story.grade)} • المسار: {story.track === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'} • الأسئلة: {story.questions.length}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleImportStory(story)}
                            className="self-end px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" /> سحب هذه القصة والأسئلة للنشاط
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {teacherAllowedGrades.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                  تنبيه: لم يحدد لك المشرف العام صفوفاً دراسية بعد. يرجى مراجعة إدارة المنصة.
                </div>
              ) : (
                <form onSubmit={handleSaveActivity} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الصف المستهدف</label>
                      <select
                        value={actGrade}
                        onChange={(e) => setActGrade(e.target.value as GradeLevel)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold"
                      >
                        {teacherAllowedGrades.map((gId) => (
                          <option key={gId} value={gId}>{getGradeLabel(gId)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">المسار اللغوي</label>
                      <select
                        value={actTrack}
                        onChange={(e) => setActTrack(e.target.value as ArabicTrack)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold"
                      >
                        {teacherAllowedTracks.map((tr) => (
                          <option key={tr} value={tr}>
                            {tr === 'arabic-a' ? 'ناطقين باللغة العربية (Arabic A)' : 'ناطقين بغيرها (Arabic B)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">عنوان النشاط / الدرس</label>
                      <button
                        type="button"
                        onClick={() => setIsAIPassageModalOpen(true)}
                        className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        توليد نص بالذكاء الاصطناعي ✨
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="عنوان النشاط"
                      value={actTitle}
                      onChange={(e) => setActTitle(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* نافذة توليد نص وقصة بالذكاء الاصطناعي */}
                  {isAIPassageModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                      <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="font-extrabold text-sm text-slate-800">توليد نص وقصة بالذكاء الاصطناعي</h3>
                              <p className="text-[11px] text-slate-400">Gemini 2.5 Flash | نصوص مشكولة وموجهة للأطفال</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsAIPassageModalOpen(false)}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="font-bold text-slate-600">الصف: <b className="text-emerald-700">{getGradeLabel(actGrade)}</b></span>
                          <span>•</span>
                          <span className="font-bold text-slate-600">المسار: <b className="text-indigo-700">{actTrack === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'}</b></span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            الحرف المستهدف أو الموضوع التربوي:
                          </label>
                          <input
                            type="text"
                            placeholder="مثال: حرف الصاد (ص)، أو الصدق والأمانة، أو التعاون..."
                            value={aiPassageTopic}
                            onChange={(e) => setAiPassageTopic(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <span className="block text-[11px] font-bold text-slate-500 mb-1.5">اقتراحات سريعة:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {['حرف الصاد (ص)', 'حرف الراء (ر)', 'حرف الشين (ش)', 'التعاون والصداقة', 'حب القراءة والعلم', 'النظافة والنظام', 'بر الوالدين'].map((item) => (
                              <button
                                key={item}
                                type="button"
                                onClick={() => setAiPassageTopic(item)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-[10px] font-bold text-slate-600 border border-slate-200/80 transition"
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setIsAIPassageModalOpen(false)}
                            className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={handleGenerateAIPassage}
                            disabled={isGeneratingAIPassage || !aiPassageTopic.trim()}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                          >
                            {isGeneratingAIPassage ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                جاري توليد القصة المشكولة...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                توليد النص والعنوان الآن 🚀
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">نص قرائي أو قصة (اختياري)</label>
                      {actPassage.trim() && (
                        <span className="text-[10px] text-emerald-600 font-bold">
                          {actPassage.length} حرف
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={4}
                      placeholder="نص أو قصة ليقرأها الطالب قبل الأسئلة..."
                      value={actPassage}
                      onChange={(e) => setActPassage(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-400">
                        💡 نصيحة: يمكنك ضبط التشكيل الكامل بالحركات لأي نص مكتوب بنقرة زر واحدة.
                      </p>
                      <button
                        type="button"
                        onClick={handleAutoTashkeel}
                        disabled={isAutoTashkeelLoading || !actPassage.trim()}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
                      >
                        {isAutoTashkeelLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                            جاري ضبط الحركات...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-3.5 h-3.5 text-amber-700" />
                            تشكيل النص وضبط الحركات ✍️
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="font-bold text-sm text-slate-800">الأسئلة التفاعلية</h3>
                        <p className="text-[10px] text-slate-400">أسئلة اختيار من متعدد مع التغذية الراجعة الفورية للطالب</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateQuestionsFromPassage}
                          disabled={isGeneratingQuestions || !actPassage.trim()}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                        >
                          {isGeneratingQuestions ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-200" />
                              جاري توليد الأسئلة...
                            </>
                          ) : (
                            <>
                              <Bot className="w-3.5 h-3.5 text-amber-300" />
                              توليد أسئلة من النص آلياً 🤖
                            </>
                          )}
                        </button>

                        <label className="cursor-pointer px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 hover:bg-indigo-100 transition flex items-center gap-1.5 shadow-xs">
                          <FileUp className="w-3.5 h-3.5" /> استيراد بنك أسئلة (QTI / ZIP)
                          <input
                            type="file"
                            accept=".zip,.xml,.qti"
                            onChange={handleQtiUpload}
                            className="hidden"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={addQuestion}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> إضافة سؤال يدوي
                        </button>
                      </div>
                    </div>

                    {questions.map((q, qIndex) => (
                      <div key={q.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-emerald-800">السؤال رقم ({qIndex + 1})</span>
                          {questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeQuestion(qIndex)}
                              className="text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          required
                          placeholder="اكتب نص السؤال هنا..."
                          value={q.text}
                          onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />

                        <div className="space-y-2 pt-2">
                          <label className="block text-[11px] font-bold text-slate-600">الخيارات (اختر الدائرة للإجابة الصحيحة):</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {q.options?.map((opt, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                                <input
                                  type="radio"
                                  name={`correct_${q.id}`}
                                  checked={q.correctAnswer === opt && opt.trim() !== ''}
                                  onChange={() => setCorrectAnswer(qIndex, opt)}
                                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                                />
                                <input
                                  type="text"
                                  placeholder={`الخيار ${optIndex + 1}`}
                                  value={opt}
                                  onChange={(e) => updateQuestionOption(qIndex, optIndex, e.target.value)}
                                  className="w-full text-xs outline-none bg-transparent"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm transition shadow-md shadow-emerald-600/20"
                  >
                    اعتماد ونشر النشاط
                  </button>
                </form>
              )}
            </div>
          )}

          {teacherTab === 'activities' && (
            <div className="space-y-4">
              {teacherActivities.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-700 text-sm">لا توجد أنشطة منشورة بعد</h3>
                  <p className="text-xs text-slate-400 mt-1 mb-4">أنشئ نشاطك الأول أو اسحب من مستودع الكتب وبنك القصص.</p>
                  <button
                    onClick={() => setTeacherTab('create')}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                  >
                    إنشاء نشاط جديد
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teacherActivities.map((act) => (
                    <div key={act.id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-200">
                            {getGradeLabel(act.grade)}
                          </span>
                          <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-bold">
                            {act.track === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1">{act.title}</h3>
                        <p className="text-xs text-slate-400 mb-4">عدد الأسئلة: {act.questions.length} سؤال • {act.createdAt}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-medium">
                          إجابات الطلاب: <b>{submissions.filter(s => s.activityId === act.id).length}</b>
                        </span>
                        <button
                          onClick={() => {
                            if (confirm('هل أنت متأكد من حذف هذا النشاط؟')) {
                              deleteActivity(act.id).then(() => {
                                syncActivitiesFromCloud().then(acts => setActivities(acts));
                              });
                              setActivities(getActivities().filter(a => a.id !== act.id));
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {teacherTab === 'grades' && (() => {
            const userPerm = canUserUseAI(currentUser, aiGovernanceRules);
            const isTeacherAIPermitted = userPerm.overrideStatus === 'inherit' 
              ? isAIFeatureAllowed('teacher').allowed 
              : userPerm.allowed;
            const teacherAIReason = userPerm.reason || isAIFeatureAllowed('teacher').reason;
            const teacherGrades = currentUser.allowedGrades || [];
            const teacherStudents = users.filter((u) => 
              u.role === 'student' && (teacherGrades.length === 0 || (u.grade && teacherGrades.includes(u.grade)))
            );
            const teacherSubmissions = submissions.filter((s) => 
              teacherGrades.length === 0 || (s.grade && teacherGrades.includes(s.grade))
            );

            return (
              <GradebookManager
                currentUser={currentUser}
                students={teacherStudents}
                submissions={teacherSubmissions}
                allowedGrades={teacherGrades}
                onOpenQuickDiagnostic={(student) => {
                  setQuickDiagnosticStudent(student);
                  setIsQuickDiagnosticOpen(true);
                }}
                onOpenFullDiagnostic={(student) => {
                  setDiagnosticStudent(student);
                  setIsDiagnosticModalOpen(true);
                }}
                onOpenClassDiagnostic={() => {
                  setIsClassDiagnosticOpen(true);
                }}
                onOpenInstantReport={(student) => {
                  setInstantReportStudent(student);
                  setIsInstantReportOpen(true);
                }}
                onOpenORF={(st) => {
                  setOrfTargetStudent(st);
                  setIsORFModalOpen(true);
                }}
                onOpenKnowledgeTree={(st) => {
                  setKnowledgeTreeTargetStudent(st);
                  setIsKnowledgeTreeOpen(true);
                }}
                onOpenLanguagePassport={(st) => {
                  setLanguagePassportTargetStudent(st);
                  setIsLanguagePassportOpen(true);
                }}
                onOpenTeacherControlHub={(student, tab) => {
                  setTeacherControlHubTargetStudent(student);
                  setTeacherControlHubInitialTab(tab || 'library');
                  setIsTeacherControlHubOpen(true);
                }}
                isAIPermitted={isTeacherAIPermitted}
                aiBlockedReason={teacherAIReason}
                onRefreshData={() => {
                  setUsers(getUsers());
                }}
              />
            );
          })()}

          {teacherTab === 'games' && (
            <AIGamesTeacherSection
              currentUser={currentUser}
              activities={activities}
              onActivitiesUpdated={(newActs) => setActivities(newActs)}
            />
          )}

          {teacherTab === 'exams' && (
            <div className="space-y-6">
              <TeacherExamsHub
                teacherId={currentUser.id}
                teacherName={currentUser.name}
                allowedGrades={teacherAllowedGrades}
                onExamsUpdated={(updated) => setExamsList(updated)}
              />
            </div>
          )}

          {teacherTab === 'tasks' && (
            <TeacherTasksReadOnlyView
              currentTeacher={currentUser}
              onTaskStatusToggled={() => setTeacherTasks(getTeacherTasks())}
            />
          )}

          {teacherTab === 'padlet' && (
            <PadletBoardView
              currentUser={currentUser}
              initialGrade={teacherAllowedGrades[0] || 'grade-1'}
              initialTrack={teacherAllowedTracks[0] || 'arabic-a'}
            />
          )}

          {teacherTab === 'challenge' && (
            <div className="w-full h-[calc(100vh-140px)] min-h-[720px]">
              <MousaChallenge
                currentUser={currentUser}
                initialGrade={teacherAllowedGrades[0] || 'grade-1'}
                initialTrack={teacherAllowedTracks[0] || 'arabic-a'}
              />
            </div>
          )}

          {teacherTab === 'live' && (
            <div className="space-y-6">
              <LiveClassroom
                currentUser={currentUser}
                initialGrade={teacherAllowedGrades[0] || 'grade-1'}
                initialTrack={teacherAllowedTracks[0] || 'arabic-a'}
                onLeave={() => setTeacherTab('activities')}
              />
            </div>
          )}
        </main>

        {/* نافذة تخصيص إسناد الكتاب لصفوف المعلم */}
        {selectedBookForAssign && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">إسناد الكتاب للطلاب</h3>
                  <span className="text-xs text-emerald-700 font-semibold">{selectedBookForAssign.title}</span>
                </div>
                <button onClick={() => setSelectedBookForAssign(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    اختر الصفوف المصرح لك بها لتظهر القصة في مكتبتهم:
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {teacherAllowedGrades.map((gId) => (
                      <button
                        key={gId}
                        type="button"
                        onClick={() => toggleAssignGrade(gId)}
                        className={`w-full p-2 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                          tempAssignedGrades.includes(gId)
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>{getGradeLabel(gId)}</span>
                        {tempAssignedGrades.includes(gId) && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">المسار المتاح له القراءة:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAssignTrack('arabic-a')}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                        tempAssignedTracks.includes('arabic-a') ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <span>ناطقين</span>
                      {tempAssignedTracks.includes('arabic-a') && <Check className="w-3 h-3 text-emerald-600" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAssignTrack('arabic-b')}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                        tempAssignedTracks.includes('arabic-b') ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <span>غير ناطقين</span>
                      {tempAssignedTracks.includes('arabic-b') && <Check className="w-3 h-3 text-emerald-600" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveBookAssignment}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition"
                >
                  حفظ التعيين
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBookForAssign(null)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {renderSharedReader()}
        {renderAIModals()}
      </div>
    );
  }

  // ================= 5. واجهة الطالب =================
  if (currentUser.role === 'student') {
    const studentActivities = activities.filter((a) => {
      // التحقق أولاً من الاستهداف الفردي أو المجموعاتي
      if (a.target_type === 'individual' || a.target_type === 'group') {
        return a.target_student_ids?.includes(currentUser.id);
      }
      // إذا كان النشاط علاجياً سرياً ولم يُستهدف الطالب، يُحجب عنه
      if (a.is_remedial) {
        return a.target_student_ids?.includes(currentUser.id);
      }
      // الاستهداف العام للفصل
      return a.grade === currentUser.grade && (!a.track || a.track === currentUser.track);
    });
    const studentWorksheets = studentActivities.filter((a) => a.activityType !== 'game');
    const studentGames = studentActivities.filter((a) => a.activityType === 'game');

    const startStarterGame = (type: AIGameType) => {
      // إذا كان هناك نشاط من نفس النوع مرسل من المعلم، نطلقه فوراً
      const existing = studentGames.find((g) => g.gameData?.gameType === type);
      if (existing) {
        setActiveGameToPlay(existing);
        return;
      }

      const recLevel = getRecommendedLevelForGrade(currentUser.grade);
      const adaptiveGames = getAdaptiveGamesForLevel(recLevel);
      const matched = adaptiveGames.find(g => g.gameType === type) || adaptiveGames[0];

      const starterActivity: Activity = {
        id: `starter_${type}_lvl${recLevel}_${Date.now()}`,
        title: `${matched.title} (المستوى ${recLevel})`,
        activityType: 'game',
        gameData: matched.sampleData,
        teacherId: 'system_mousa_adaptive',
        teacherName: 'موسى الذكي',
        stage: currentUser.stage,
        grade: currentUser.grade,
        track: currentUser.track,
        questions: [],
        createdAt: new Date().toLocaleDateString('ar-EG')
      };

      setActiveGameToPlay(starterActivity);
    };

    // حوكمة رف القراءة: فحص هل أتاح المعلم المكتبة الشاملة لهذا الصف أو للطالب استثنائياً
    const isStudentFullLibraryOpen = isLibraryOpenForStudent(
      currentUser.id, 
      currentUser.grade || 'grade-1', 
      currentUser.school_id
    );

    // 1. القصص الحرة المرشحة من المعلم حصراً (خيار 1)
    const myFreeReadingAssignments = readingAssignments.filter((a) => {
      if (a.assignmentType !== 'free_reading') return false;
      if (a.targetType === 'individual') {
        return a.targetStudentId === currentUser.id || a.targetStudentIds?.includes(currentUser.id);
      }
      if (a.targetType === 'group') {
        return a.targetStudentIds?.includes(currentUser.id);
      }
      return !a.targetGrade || a.targetGrade === currentUser.grade;
    });

    // 2. التكليفات القرائية التفاعلية برصد درجات (خيار 2)
    const myReadingQuizzes = activities.filter((a) => {
      const isReadingRelated = a.activityType === 'story' || a.id.startsWith('act_read_') || a.description?.includes('نشاط قراءة');
      if (!isReadingRelated) return false;
      if (a.target_type === 'individual' || a.target_type === 'group') {
        return a.target_student_ids?.includes(currentUser.id);
      }
      return !a.grade || a.grade === currentUser.grade;
    });

    // إجمالي التكليفات والقصص المقررة للطالب فقط (افتراضياً 0 حتى يسند له المعلم)
    const totalMyReadingItems = myFreeReadingAssignments.length + myReadingQuizzes.length;

    const studentAvailableExams = examsList.filter(
      (e) => (e.is_active !== false && (e.is_active as any) !== 'false') && 
        (!e.target_grade || (e.target_grade as string) === 'all' || !currentUser.grade || e.target_grade === currentUser.grade)
    );

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        {renderOfflineBanner()}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {renderHeaderLogo()}
            <div>
              <h1 className="font-extrabold text-base text-slate-800">تعلَّم مع موسى | بوابة الطالب</h1>
              <p className="text-xs text-slate-500 font-medium">
                الطالب: <b className="text-slate-800">{currentUser.name}</b> • {getGradeLabel(currentUser.grade!)} ({currentUser.track === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setLanguagePassportTargetStudent(currentUser);
                setIsLanguagePassportOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition shadow-xs cursor-pointer"
              title="جواز السفر اللغوي وتغيير لغة التوجيهات (Arabic, English, Français, Urdu)"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">جواز السفر (CEFR) 🛂</span>
            </button>

            <button
              type="button"
              onClick={() => setIsChatModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition shadow-xs cursor-pointer"
              title="مركز الرسائل المدرسية والتواصل الفوري"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">مركز الرسائل 💬</span>
            </button>

            <UserNavbarProfileButton
              user={currentUser}
              onClick={() => setIsProfileModalOpen(true)}
            />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
            >
              <LogOut className="w-3.5 h-3.5" /> خروج
            </button>
          </div>
        </header>

        <main className={studentTab === 'challenge' || studentTab === 'live' ? "w-full px-2 sm:px-4 py-2" : "max-w-5xl mx-auto px-4 py-8"}>
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setStudentTab('ai_studio')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                studentTab === 'ai_studio' 
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-md shadow-emerald-600/20' 
                  : 'bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300" /> أكاديمية موسى للذكاء الاصطناعي 🌟
            </button>
            <button
              onClick={() => setStudentTab('games')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                studentTab === 'games' 
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20' 
                  : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-50'
              }`}
            >
              <Gamepad2 className="w-4 h-4 text-amber-400" /> ألعاب موسى الذكية 🎮 ({studentGames.length})
            </button>
            <button
              onClick={() => setStudentTab('activities')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                studentTab === 'activities' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <FileText className="w-4 h-4" /> الأنشطة والواجبات ({studentWorksheets.length})
            </button>
            <button
              onClick={() => {
                setStudentTab('exams');
                syncExamsFromCloud().then(e => setExamsList(e));
                syncExamSessionsFromCloud().then(s => setExamSessionsList(s));
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                studentTab === 'exams' 
                  ? 'bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 text-white shadow-md shadow-teal-600/20' 
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FileCheck2 className="w-4 h-4 text-emerald-500" /> الاختبارات والتقييمات 📝 ({studentAvailableExams.length})
            </button>
            {/* حجب الرف التلقائي عن بوابة الطالب: لا يظهر قسم/زر رف القراءة والمكتبة المصورة إلا إذا أتاح المعلم المكتبة الكاملة للصف أو وجدت تكليفات قرائية مسندة */}
            {(isStudentFullLibraryOpen || totalMyReadingItems > 0) && (
              <button
                onClick={() => setStudentTab('library')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  studentTab === 'library' 
                    ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20' 
                    : 'bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                <Library className="w-4 h-4 text-emerald-500" />
                <span>{isStudentFullLibraryOpen ? 'مكتبتي المصورة ورف القراءة' : 'كتبي وتكليفاتي القرائية'}</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900">
                  {isStudentFullLibraryOpen ? books.length : totalMyReadingItems}
                </span>
              </button>
            )}
            <button
              onClick={() => setStudentTab('padlet')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                studentTab === 'padlet' 
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-md shadow-amber-500/20' 
                  : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-50'
              }`}
            >
              <Pin className="w-4 h-4 text-amber-500" /> جدار الإبداع والمشاركة 🎨
            </button>
            <button
              onClick={() => setStudentTab('challenge')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                studentTab === 'challenge' 
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-rose-600 text-white shadow-md shadow-indigo-600/20' 
                  : 'bg-white border border-purple-200 text-purple-900 hover:bg-purple-50'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-400" /> تَحَدِّي مُوسَى 🏆
            </button>
            <button
              onClick={() => setStudentTab('live')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                studentTab === 'live' 
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-md shadow-red-600/20' 
                  : activeLiveSessionForStudent
                    ? 'bg-red-50 border-2 border-red-500 text-red-700 hover:bg-red-100 shadow-md shadow-red-500/10'
                    : 'bg-white border border-red-200 text-red-700 hover:bg-red-50'
              }`}
            >
              <Video className="w-4 h-4 text-rose-500" />
              <span>فصل موسى المباشر 🎥</span>
              {activeLiveSessionForStudent && (
                <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block" />
                  مباشر الآن 🔴
                </span>
              )}
            </button>

            {/* 1. القياس المعياري للطلاقة القرائية (ORF) */}
            <button
              type="button"
              onClick={() => {
                setOrfTargetStudent(currentUser);
                setIsORFModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 bg-gradient-to-r from-teal-700 to-emerald-800 hover:from-teal-800 hover:to-emerald-900 text-white shadow-md shadow-teal-700/20 cursor-pointer"
              title="مختبر الطلاقة القرائية واحتساب WCPM بالصوت ومخارج الحروف"
            >
              <span>🎙️</span>
              <span>مختبر الطلاقة (ORF)</span>
            </button>

            {/* 2. شجرة الكفايات التكيفية والتكرار المتباعد */}
            <button
              type="button"
              onClick={() => {
                setKnowledgeTreeTargetStudent(currentUser);
                setIsKnowledgeTreeOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 bg-gradient-to-r from-indigo-700 to-blue-800 hover:from-indigo-800 hover:to-blue-900 text-white shadow-md shadow-indigo-700/20 cursor-pointer"
              title="شجرة الكفايات التراكمية، التيجان الذهبية وصقل المهارات"
            >
              <span>🌳</span>
              <span>شجرة الكفايات</span>
            </button>

            {/* 3. الاعتماد الدولي وجواز السفر اللغوي */}
            <button
              type="button"
              onClick={() => {
                setLanguagePassportTargetStudent(currentUser);
                setIsLanguagePassportOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 bg-gradient-to-r from-blue-700 to-slate-800 hover:from-blue-800 hover:to-slate-900 text-white shadow-md shadow-blue-700/20 cursor-pointer"
              title="جواز السفر اللغوي الدولي المعتمد لمسار غير الناطقين بالعربية"
            >
              <span>🛂</span>
              <span>جواز السفر (CEFR)</span>
            </button>

            {/* زر استعادة رفيق موسى في شريط التبويبات عند الإخفاء */}
            {isMusaDismissed && canUserUseAI(currentUser, aiGovernanceRules).allowed && isAIFeatureAllowed('student').allowed && (
              <button
                type="button"
                onClick={() => setIsMusaDismissed(false)}
                className="px-3.5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-800 border border-emerald-200 shadow-xs animate-in fade-in duration-200 cursor-pointer"
                title="إعادة إظهار رفيق موسى الصوتي العائم"
              >
                <span className="w-4 h-4 rounded-full overflow-hidden border border-emerald-300 flex-shrink-0">
                  <img src={MOUSA_AVATAR_SRC} alt="موسى" className="w-full h-full object-cover" />
                </span>
                <span>إظهار رفيق موسى 💬</span>
              </button>
            )}
          </div>

          {/* إشعار وتنبيه البث المباشر الفوري لصف الطالب إن وجد */}
          {activeLiveSessionForStudent && studentTab !== 'live' && (
            <div className="mb-6 p-4 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white rounded-2xl shadow-xl shadow-red-600/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-red-400/40 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <Video className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-white text-red-700 text-[10px] font-black animate-pulse">
                      🔴 بث مباشر الآن
                    </span>
                    <h3 className="font-black text-sm">
                      {activeLiveSessionForStudent.title}
                    </h3>
                  </div>
                  <p className="text-xs text-red-100 mt-0.5">
                    المعلم: <b>{activeLiveSessionForStudent.teacherName}</b> بدأ حصة تفاعلية مباشرة لصفك الآن!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStudentTab('live')}
                className="px-5 py-2.5 bg-white hover:bg-red-50 text-red-700 font-black text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
              >
                <span>انضم إلى البث المباشر فوراً 🚀</span>
              </button>
            </div>
          )}

          {studentTab === 'ai_studio' && (
            <div className="space-y-6">
              {/* بانر الترحيب التفاعلي من موسى بالصورة الجديدة */}
              <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-900/10">
                <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-950/40 flex-shrink-0 border-4 border-white/30 bg-white p-1">
                    <img 
                      src={MOUSA_AVATAR_SRC} 
                      alt="موسى" 
                      className="w-full h-full object-cover rounded-2xl" 
                    />
                  </div>
                  <div className="text-center sm:text-right flex-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black text-amber-200 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" /> رَفِيقُكَ الذَّكِي لِتَعَلُّمِ العَرَبِيَّةِ
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black mb-2 leading-relaxed">
                      مَرْحَبًا بِكَ يَا بَطَلِي <span className="text-amber-300 font-extrabold">{currentUser.name}</span>! 🌟
                    </h2>
                    <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed max-w-2xl mb-4">
                      أَنَا مُوسَى، رَفِيقُكَ المُسَاعِد! يُمْكِنُكَ التَّحَدُّثُ مَعِي، صِنَاعَةُ قَصَصٍ عَجِيبَةٍ، تَحَدِّي نُطْقِ الحُرُوفِ، أَوِ الرَّسْمِ لِأُخَمِّنَ إِبْدَاعَكَ!
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      <button
                        type="button"
                        onClick={() => setIsMusaChatOpen(true)}
                        className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-amber-400/20"
                      >
                        <MessageCircle className="w-4 h-4" /> تَحَدَّثْ مَعَ مُوسَى الآن
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAdaptiveStoryOpen(true)}
                        className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 border border-white/20"
                      >
                        <BookOpen className="w-4 h-4 text-amber-200" /> ابْدَأْ قِصَّةً تَفَاعُلِيَّةً
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* قسم المحاور الأكاديمية العالمية للضاد (ORF, Knowledge Graph, CEFR) */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-indigo-800/60 pb-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 rounded-full text-xs font-black text-indigo-300 mb-1 border border-indigo-400/30">
                      <span>🏛️</span>
                      <span>المحاور الأكاديمية العالمية للضاد • صُممت بمعايير عالمية</span>
                    </div>
                    <h3 className="text-lg font-black text-white">
                      منظومة الإتقان المعياري والطلاقة القرائية والاعتماد الدولي
                    </h3>
                  </div>
                  <span className="text-xs text-indigo-300 font-medium">
                    ORF (WCPM) • Spaced Repetition • CEFR & ACTFL
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* المحور 1: الطلاقة القرائية الشفهية */}
                  <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-4.5 border border-white/15 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-3xl">🎙️</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                          معيار WCPM
                        </span>
                      </div>
                      <h4 className="font-black text-sm text-white mb-1">
                        1. مختبر الطلاقة القرائية (ORF)
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed mb-4">
                        اقرأ النصوص بصوتك، واحسب معدل الكلمات الصحيحة بالدقيقة (WCPM)، واكتشف مواضع التعثر، واستخرج شهادة الطلاقة الرسمية!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOrfTargetStudent(currentUser);
                        setIsORFModalOpen(true);
                      }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/30"
                    >
                      <span>ابدأ اختبار الطلاقة 🎙️</span>
                    </button>
                  </div>

                  {/* المحور 2: شجرة الكفايات والتكرار المتباعد */}
                  <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-4.5 border border-white/15 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-3xl">🌳</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/30 text-amber-300 border border-amber-400/30">
                          Spaced Decay
                        </span>
                      </div>
                      <h4 className="font-black text-sm text-white mb-1">
                        2. شجرة الكفايات والتكرار المتباعد
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed mb-4">
                        خارطة تراكمية من الصوت المفرد حتى البلاغة؛ المهارة تصبح ذهبية 🏆 وإذا غبت أسبوعين تطلب صقلاً 🔄 لثبات الذاكرة.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setKnowledgeTreeTargetStudent(currentUser);
                        setIsKnowledgeTreeOpen(true);
                      }}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/30"
                    >
                      <span>استكشف شجرة المهارات 🌳</span>
                    </button>
                  </div>

                  {/* المحور 3: الاعتماد الدولي وجواز السفر اللغوي */}
                  <div className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl p-4.5 border border-white/15 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-3xl">🛂</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-500/30 text-blue-300 border border-blue-400/30">
                          CEFR A1-B2
                        </span>
                      </div>
                      <h4 className="font-black text-sm text-white mb-1">
                        3. جواز السفر اللغوي الدولي (CEFR)
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed mb-4">
                        توثيق الساعات التدريبية، مواءمة مسار عرب B مع السلم الأوروبي، وواجهة تعليمات متعددة اللغات مع أصالة الفصحى.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLanguagePassportTargetStudent(currentUser);
                        setIsLanguagePassportOpen(true);
                      }}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/30"
                    >
                      <span>عرض جواز السفر اللغوي 🛂</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* قسم حزمة ألعاب موسى التفاعلية الثلاث بالذكاء الاصطناعي */}
              <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 text-white shadow-xl shadow-amber-500/20 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black text-amber-100 mb-2">
                      <Gamepad2 className="w-4 h-4 text-amber-200" /> ألعاب موسى التفاعلية الثلاث المولّدة بالذكاء الاصطناعي
                    </div>
                    <h3 className="text-xl font-black mb-1.5 flex items-center gap-2">
                      تَحَدِّيَاتُ الأَلْعَابِ الذَّكِيَّةِ مَعَ مُوسَى 🎮
                    </h3>
                    <p className="text-xs text-amber-100 leading-relaxed max-w-xl">
                      اختر لعبتك المفضلة الآن: كنز الحروف والصوتيات، أو تركيب الجمل وبنائها، أو اتخاذ القرارات في مغامرات موسى! اربح النجوم والأوسمة فوراً.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => setStudentTab('games')}
                      className="px-5 py-2.5 bg-white text-amber-900 hover:bg-amber-50 font-black rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md flex-1 md:flex-initial"
                    >
                      <Trophy className="w-4 h-4 text-amber-600" /> ساحة الألعاب ({studentGames.length})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() => startStarterGame('phonics_treasure')}
                    className="bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 rounded-2xl p-3.5 text-right transition flex items-center gap-3 group text-white"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-400/30 flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition">
                      💎
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-xs text-white">كَنْزُ الحُرُوفِ</h4>
                      <p className="text-[10px] text-amber-100 truncate">فرز وتمييز الأصوات المشكولة</p>
                    </div>
                    <Play className="w-3.5 h-3.5 text-amber-200 opacity-60 group-hover:opacity-100" />
                  </button>

                  <button
                    type="button"
                    onClick={() => startStarterGame('sentence_builder')}
                    className="bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 rounded-2xl p-3.5 text-right transition flex items-center gap-3 group text-white"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-400/30 flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition">
                      🧩
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-xs text-white">تَرْكِيبُ الجُمَلِ</h4>
                      <p className="text-[10px] text-amber-100 truncate">ترتيب الكلمات المفيدة</p>
                    </div>
                    <Play className="w-3.5 h-3.5 text-amber-200 opacity-60 group-hover:opacity-100" />
                  </button>

                  <button
                    type="button"
                    onClick={() => startStarterGame('story_quest')}
                    className="bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 rounded-2xl p-3.5 text-right transition flex items-center gap-3 group text-white"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-400/30 flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition">
                      🏰
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-xs text-white">مُغَامَرَةُ الحِكَايَةِ</h4>
                      <p className="text-[10px] text-amber-100 truncate">قرارات وحكمة موسى</p>
                    </div>
                    <Play className="w-3.5 h-3.5 text-amber-200 opacity-60 group-hover:opacity-100" />
                  </button>
                </div>
              </div>

              {/* بطاقات المغامرات الأربع بالذكاء الاصطناعي */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. الرفيق الصوتي */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xl mb-4">
                      🤖
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold inline-block mb-2">
                      محادثة واستماع صوتي
                    </span>
                    <h3 className="font-extrabold text-base text-slate-800 mb-1.5">الرفيق الصوتي مع موسى</h3>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      تحدث مع موسى، واسأله عن الكلمات والحكايات، واستمع لصوته المشجع بنصوص مشكولة ومفهومة.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMusaChatOpen(true)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" /> فتح نافذة المحادثة
                  </button>
                </div>

                {/* 2. صانع القصص التكيفية */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl mb-4">
                      📖
                    </div>
                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold inline-block mb-2">
                      قصص متفرعة بالتشكيل
                    </span>
                    <h3 className="font-extrabold text-base text-slate-800 mb-1.5">صانع القصص التفاعلية</h3>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      اختر موضوع قصتك واصنع مساراتها بنفسك! كل قرار تتخذه يغير نهاية الحكاية مع نصوص عربية مضبوطة بالشكل.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAdaptiveStoryOpen(true)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs"
                  >
                    <BookOpen className="w-4 h-4" /> ابدأ صناعة القصة
                  </button>
                </div>

                {/* 3. بوابة النطق والكلمة السحرية */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xl mb-4">
                      🚪
                    </div>
                    <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold inline-block mb-2">
                      صوتيات وتحقق ذكي
                    </span>
                    <h3 className="font-extrabold text-base text-slate-800 mb-1.5">بوابة التحدي والكلمة السحرية</h3>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      تحدي نطق الحروف والكلمات السحرية! تحقق من سلامة مخارج الحروف واكسب أوسمة الأبطال عند فتح الأبواب.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPhonicsGateOpen(true)}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Award className="w-4 h-4" /> افتح بوابة الحروف
                  </button>
                </div>

                {/* 4. لوحة الرسم والتعرف البصري */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xl mb-4">
                      🎨
                    </div>
                    <span className="px-2.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-lg text-[10px] font-bold inline-block mb-2">
                      رؤية حاسوبية ذكية
                    </span>
                    <h3 className="font-extrabold text-base text-slate-800 mb-1.5">لوحة الرسم والتعرف البصري</h3>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      ارسم أي شكل على اللوحة التفاعلية ودع ذكاء موسى البصري يكتشف رسمتك ويشجعك بنجوم ذهبية!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDrawingCanvasOpen(true)}
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Palette className="w-4 h-4" /> افتح لوحة الرسم
                  </button>
                </div>
              </div>

              {/* أوسمتي وإنجازاتي */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <h3 className="font-extrabold text-base text-slate-800">أوسمتي المكتسبة وإنجازاتي 🏆</h3>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    مجموع الأوسمة: <b className="text-emerald-600">{studentBadges.length}</b>
                  </span>
                </div>

                {studentBadges.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <div className="text-4xl mb-2">🌟</div>
                    <p className="text-xs font-bold text-slate-600 mb-1">لم تحصل على أي وسام بعد!</p>
                    <p className="text-[11px] text-slate-400">
                      جرب التحدث مع موسى، أو افتح بوابة الكلمات السحرية، أو ارسم رسمة جديدة لتكسب أوسمتك الأولى!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {studentBadges.map((badge) => (
                      <div
                        key={badge.id}
                        className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/80 flex items-start gap-3"
                      >
                        <div className="text-2xl p-2 rounded-xl bg-white shadow-xs border border-amber-100 flex-shrink-0">
                          {badge.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-extrabold text-xs text-amber-950 truncate mb-0.5">{badge.title}</h4>
                          <p className="text-[10px] text-slate-600 leading-snug line-clamp-2">{badge.description}</p>
                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-amber-200/50">
                            <span className="text-[9px] text-amber-700 font-bold">
                              {badge.earnedAt}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBadgeForShare(badge);
                                setShowShareBadgeModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-[9px] font-black transition shadow-2xs"
                              title="مشاركة الوسام كبطاقة فخر مع العائلة"
                            >
                              <Share2 className="w-2.5 h-2.5" />
                              <span>مشاركة 🌟</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {studentTab === 'games' && (
            <AdaptiveGamesSection
              currentUser={currentUser}
              studentBadges={studentBadges}
              studentGames={studentGames}
              onPlayGame={(activity) => setActiveGameToPlay(activity)}
            />
          )}

          {studentTab === 'library' && (
            <div className="space-y-6">
              {/* ترويسة قسم القراءة وبوابة الطالب */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">
                      {isStudentFullLibraryOpen ? 'المكتبة المفتوحة مفعلة من المعلم 🟢' : 'التكليفات والقصص المقررة فقط 🔒'}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">
                      {isStudentFullLibraryOpen ? `${books.length} قصة متاحة` : `${totalMyReadingItems} مادة قرائية`}
                    </span>
                  </div>
                  <h2 className="font-extrabold text-base sm:text-lg text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-600" />
                    <span>{isStudentFullLibraryOpen ? 'مكتبتي المصورة ورف القراءة' : 'كتبي وتكليفاتي القرائية'}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isStudentFullLibraryOpen
                      ? 'أتاح معلمك إمكانية تصفح وقراءة كامل مستودع الكتب المصورة بحرية.'
                      : 'تعرض هذه الصفحة حصراً الكتب والأنشطة القرائية التي أسندها لك معلّمك.'}
                  </p>
                </div>

                {isStudentFullLibraryOpen && (
                  <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setStudentReadingTab('assigned')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                        studentReadingTab === 'assigned'
                          ? 'bg-white text-emerald-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      تكليفاتي ({totalMyReadingItems})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentReadingTab('open_library')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                        studentReadingTab === 'open_library'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      المكتبة الشاملة ({books.length})
                    </button>
                  </div>
                )}
              </div>

              {/* إذا كانت المكتبة الشاملة مفعلة واختار الطالب تصفح كامل المستودع */}
              {isStudentFullLibraryOpen && studentReadingTab === 'open_library' ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                      <Library className="w-4 h-4 text-emerald-600" /> جميع الكتب المصورة المتاحة للقراءة الحرة
                    </h3>
                    <span className="text-xs text-slate-400 font-bold">{books.length} قصة</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {books.slice(0, 48).map((book) => renderBookCard(book, 'student'))}
                  </div>
                </div>
              ) : (
                /* العرض الافتراضي الصارم: كتبي وتكليفاتي القرائية المسندة حصراً من المعلم */
                <div className="space-y-6">
                  {/* 1. رف قصص القراءة والاستمتاع الحرة التي رشحها المعلم */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                          قصص رشحها لك معلمك للقراءة والاستمتاع 📖
                        </h3>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        {myFreeReadingAssignments.length} قصة
                      </span>
                    </div>

                    {myFreeReadingAssignments.length === 0 ? (
                      <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-2xs">
                        <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <h4 className="font-bold text-slate-700 text-sm">لا توجد قصص قراءة حرة مسندة حالياً</h4>
                        <p className="text-xs text-slate-400 mt-1">عندما يرشح لك معلّمك قصة للاستمتاع بها، ستظهر هنا فوراً في رفك الخاص.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {/* القصص المرشحة عبر نظام الإسناد الصريح من المعلم */}
                        {myFreeReadingAssignments.map((assign) => (
                          <div
                            key={assign.id}
                            className="bg-white rounded-3xl border-2 border-emerald-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
                          >
                            <div className="relative aspect-[3/4] w-full bg-slate-100 flex items-center justify-center p-2 group">
                              <img
                                src={assign.bookCoverUrl}
                                alt={assign.bookTitle}
                                className="w-full h-full object-contain drop-shadow-xs group-hover:scale-105 transition duration-300"
                              />
                              <div className="absolute top-2.5 right-2.5">
                                <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[9px] font-black shadow-xs flex items-center gap-1">
                                  <span>📖</span> قراءة حرة
                                </span>
                              </div>
                            </div>

                            <div className="p-3.5 flex-1 flex flex-col justify-between text-right" dir="rtl">
                              <div>
                                <h4 className="font-extrabold text-xs sm:text-sm text-slate-800 line-clamp-1 mb-1">
                                  {assign.bookTitle}
                                </h4>
                                <p className="text-[11px] text-slate-400 mb-2">
                                  {assign.bookAuthor || 'مؤسسة هنداوي (بوك تايم)'}
                                </p>
                                <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100 mb-3 text-[10px] text-emerald-900 leading-relaxed">
                                  <span>رشحها الأستاذ: <b>{assign.teacherName}</b></span>
                                  {assign.notes && <p className="text-slate-600 mt-0.5">💬 {assign.notes}</p>}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => openReader({
                                  id: assign.bookId,
                                  title: assign.bookTitle,
                                  coverUrl: assign.bookCoverUrl,
                                  readUrl: assign.bookReadUrl,
                                  author: assign.bookAuthor,
                                  assignedGrades: currentUser.grade ? [currentUser.grade] : ['grade-1'],
                                  assignedTracks: currentUser.track ? [currentUser.track] : ['arabic-a']
                                })}
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98"
                              >
                                <BookOpen className="w-3.5 h-3.5" /> اقرأ القصة الآن
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. قسم الأنشطة والتكليفات القرائية التفاعلية ذات الدرجات */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
                        <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                          الأنشطة والتكليفات القرائية المقررة (درجات وموعد تسليم) 📝
                        </h3>
                      </div>
                      <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                        {myReadingQuizzes.length} نشاط
                      </span>
                    </div>

                    {myReadingQuizzes.length === 0 ? (
                      <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-2xs">
                        <FileCheck2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <h4 className="font-bold text-slate-700 text-sm">لا توجد تكليفات قرائية تفاعلية حالياً</h4>
                        <p className="text-xs text-slate-400 mt-1">عندما يكلفك المعلم بنشاط قرائي مرتبط بقصة وأسئلة فهم، سيظهر هنا مباشرة برصد درجاته.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {myReadingQuizzes.map((act) => {
                          const isSolved = submissions.some(
                            s => s.activityId === act.id && s.studentId === currentUser.id
                          );
                          const mySub = submissions.find(
                            s => s.activityId === act.id && s.studentId === currentUser.id
                          );

                          return (
                            <div
                              key={act.id}
                              className={`bg-white rounded-3xl border-2 p-4 flex flex-col justify-between transition shadow-xs hover:shadow-md ${
                                isSolved ? 'border-emerald-200 bg-emerald-50/20' : 'border-teal-300'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-teal-100 text-teal-900 border border-teal-200 flex items-center gap-1">
                                    <FileCheck2 className="w-3 h-3 text-teal-700" /> نشاط قرائي رسمي
                                  </span>
                                  {isSolved ? (
                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> تم الإنجاز ({mySub?.score ?? 100}%)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                      بانتظار الإنجاز ⏳
                                    </span>
                                  )}
                                </div>

                                <h4 className="font-extrabold text-sm text-slate-800 mb-1 line-clamp-1">{act.title}</h4>
                                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{act.description}</p>

                                <div className="space-y-1 mb-4 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                  <div className="flex items-center justify-between">
                                    <span>المعلم: <b className="text-slate-800">{act.teacherName}</b></span>
                                    <span>الأسئلة: <b className="text-teal-700">{act.questions.length}</b></span>
                                  </div>
                                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px]">
                                    <span className="text-slate-400">تاريخ التكليف: {act.createdAt}</span>
                                    <span className="text-teal-700 font-bold">رصد آلي للدرجات 🎯</span>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedActivityToSolve(act);
                                  setStudentAnswers({});
                                  setQuizFinished(false);
                                }}
                                className={`w-full py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                                  isSolved 
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-teal-600/20'
                                }`}
                              >
                                <FileCheck2 className="w-4 h-4" />
                                <span>{isSolved ? 'مراجعة النشاط والحل' : 'ابدأ قراءة القصة وحل الأسئلة 📝'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {studentTab === 'activities' && (
            <div>
              {selectedActivityToSolve ? (
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  {!quizFinished ? (
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                        <div>
                          <h2 className="text-base font-bold text-slate-800">{selectedActivityToSolve.title}</h2>
                          <p className="text-xs text-slate-500">إعداد الأستاذ: {selectedActivityToSolve.teacherName}</p>
                        </div>
                        <button
                          onClick={() => setSelectedActivityToSolve(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          إلغاء والعودة
                        </button>
                      </div>

                      {selectedActivityToSolve.passage && (
                        <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 mb-6 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          <b className="block text-emerald-800 text-xs mb-1">اقرأ الفقرة التالية بعناية:</b>
                          {selectedActivityToSolve.passage}
                        </div>
                      )}

                      <div className="space-y-6">
                        {selectedActivityToSolve.questions.map((q, idx) => (
                          <div key={q.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <h4 className="font-bold text-sm text-slate-800 mb-3">
                              {idx + 1}. {q.text}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {q.options?.map((opt, optIdx) => (
                                <label
                                  key={optIdx}
                                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                                    studentAnswers[q.id] === opt
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`solve_${q.id}`}
                                    value={opt}
                                    checked={studentAnswers[q.id] === opt}
                                    onChange={() => setStudentAnswers({ ...studentAnswers, [q.id]: opt })}
                                    className="hidden"
                                  />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handleSubmitQuiz}
                        className="w-full mt-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl text-sm hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" /> تسليم الإجابات وإنهاء النشاط
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Award className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-1">أحسنت صنعاً! تم تسليم إجابتك</h3>
                      <p className="text-xs text-slate-500 mb-4">نتيجتك في هذا النشاط:</p>
                      <div className="text-3xl font-extrabold text-emerald-600 mb-6">
                        {lastScore?.score} / {lastScore?.total}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedActivityToSolve(null);
                          setQuizFinished(false);
                          setStudentAnswers({});
                        }}
                        className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
                      >
                        العودة لقائمة الأنشطة
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h2 className="font-extrabold text-base mb-4 text-slate-800">أنشطة صَفّك الدراسي الحالية</h2>
                  {studentActivities.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                      <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h4 className="font-bold text-slate-700 text-sm">لا توجد أنشطة جديدة موجهة لصفك حالياً</h4>
                      <p className="text-xs text-slate-400 mt-1">سيقوم معلمك بنشر الأنشطة والواجبات هنا قريباً.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {studentActivities.map((act) => {
                        const isGame = act.activityType === 'game';
                        return (
                          <div
                            key={act.id}
                            className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between ${
                              isGame ? 'border-amber-200 hover:border-amber-300' : 'border-slate-200/80'
                            }`}
                          >
                            <div>
                              {isGame ? (
                                <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 rounded-lg text-[10px] font-bold border border-amber-200 mb-2 inline-flex items-center gap-1">
                                  <Gamepad2 className="w-3 h-3 text-amber-600" /> لعبة تعليمية ذكية 🎮
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200 mb-2 inline-block">
                                  نشاط متاح
                                </span>
                              )}
                              <h3 className="font-bold text-slate-800 text-sm mb-1">{act.title}</h3>
                              {isGame && act.gameData?.targetSkill && (
                                <p className="text-[11px] text-amber-800 font-semibold mb-2 bg-amber-50/70 px-2 py-1 rounded-lg">
                                  🎯 {act.gameData.targetSkill}
                                </p>
                              )}
                              <p className="text-xs text-slate-400 mb-4">
                                إعداد: {act.teacherName} • {isGame ? `${act.gameData?.levels.length || 3} مستويات تحدي` : `${act.questions.length} أسئلة`}
                              </p>
                            </div>
                            {isGame ? (
                              <button
                                onClick={() => setActiveGameToPlay(act)}
                                className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                              >
                                <Play className="w-3.5 h-3.5 text-amber-200" /> العب اللعبة الآن 🎮
                              </button>
                            ) : (
                              <button
                                onClick={() => setSelectedActivityToSolve(act)}
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition"
                              >
                                بدء حل النشاط الآن
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {studentTab === 'exams' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-teal-600" /> الاختبارات والتقييمات المدرسية المتاحة
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    أهلاً بك يا بطل! أثبت تميزك وحل الاختبارات المسندة لصفك مع التزام الهدوء والتركيز التام 🎯
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      syncExamsFromCloud().then(e => setExamsList(e));
                      syncExamSessionsFromCloud().then(s => setExamSessionsList(s));
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-teal-50 text-teal-700 text-xs font-bold rounded-xl border border-teal-200 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                    title="تحديث قائمة الاختبارات سحابياً"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> تحديث الاختبارات
                  </button>
                  <span className="px-3 py-1.5 bg-teal-50 text-teal-800 text-xs font-bold rounded-xl border border-teal-200">
                    {studentAvailableExams.length} اختبار متاح
                  </span>
                </div>
              </div>

              {studentAvailableExams.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                  <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <FileCheck2 className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-base mb-1">لا توجد اختبارات أو تقييمات حالياً</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                    رائع! لقد أنجزت جميع متطلباتك أو لم يقم معلمك بنشر اختبار جديد لصفك حتى اللحظة.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      syncExamsFromCloud().then(e => setExamsList(e));
                      syncExamSessionsFromCloud().then(s => setExamSessionsList(s));
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> التحقق من وجود اختبارات جديدة الآن
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studentAvailableExams.map((exam) => {
                    const session = examSessionsList.find(
                      (s) => s.exam_id === exam.id && s.student_id === currentUser.id
                    );
                    const isCompleted = session?.status === 'submitted';
                    const percentage = session && session.total_marks > 0
                      ? Math.round((session.score / session.total_marks) * 100)
                      : 0;

                    // تقييم حالة الجدولة والنافذة الزمنية
                    const scheduleInfo = getExamScheduleStatus(exam, currentExamClock);
                    const countdown = exam.is_scheduled && exam.scheduled_start
                      ? formatCountdown(exam.scheduled_start, currentExamClock)
                      : null;

                    return (
                      <div
                        key={exam.id}
                        className={`bg-white rounded-3xl p-6 border shadow-xs flex flex-col justify-between transition hover:shadow-md ${
                          isCompleted
                            ? 'border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/20'
                            : 'border-slate-200/80'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                            <span className="px-2.5 py-0.5 bg-teal-50 text-teal-800 text-[10px] font-black rounded-lg border border-teal-200 flex items-center gap-1">
                              <FileCheck2 className="w-3 h-3" /> اختبار مدرسي
                            </span>
                            {isCompleted ? (
                              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-lg flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> تم التسليم
                              </span>
                            ) : exam.is_scheduled ? (
                              scheduleInfo.status === 'upcoming' ? (
                                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-[11px] font-black rounded-lg border border-amber-300 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" /> مجدول قريباً
                                </span>
                              ) : scheduleInfo.status === 'open' ? (
                                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-lg border border-emerald-300 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> متاح الآن للبدء
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[11px] font-black rounded-lg border border-rose-300 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> انتهت فترة الاختبار
                                </span>
                              )
                            ) : (
                              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> متاح الآن
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-extrabold text-slate-800 mb-2 leading-snug">
                            {exam.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {exam.duration_minutes > 0 ? `${exam.duration_minutes} دقيقة` : 'وقت مفتوح'}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                              <CheckSquare className="w-3 h-3 text-slate-400" />
                              {exam.questions.length} أسئلة
                            </span>
                            <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 text-slate-600">
                              <ShieldAlert className="w-3 h-3 text-amber-500" />
                              نظام حماية الغش
                            </span>
                          </div>

                          {/* معلومات النافذة الزمنية المجدولة للطلاب */}
                          {!isCompleted && exam.is_scheduled && (
                            <div className="mb-4">
                              {scheduleInfo.status === 'upcoming' && (
                                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2">
                                  <div className="flex items-center justify-between text-xs text-amber-950 font-bold">
                                    <span className="flex items-center gap-1.5">
                                      <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />
                                      موعد البدء:
                                    </span>
                                    <span>{formatArabicDateTime(exam.scheduled_start)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                                    <span>موعد الإغلاق:</span>
                                    <span className="font-semibold text-slate-700">{formatArabicDateTime(exam.scheduled_end)}</span>
                                  </div>
                                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-amber-200">
                                    <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                      يبدأ خلال:
                                    </span>
                                    <span className="font-mono font-black text-amber-950 text-xs dir-ltr">
                                      {countdown?.displayText}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {scheduleInfo.status === 'open' && (
                                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-900 font-bold flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 text-emerald-700">
                                    <CalendarClock className="w-3.5 h-3.5 text-emerald-600" />
                                    النافذة متاحة حتى:
                                  </span>
                                  <span className="text-emerald-950 font-black">{formatArabicDateTime(exam.scheduled_end)}</span>
                                </div>
                              )}

                              {scheduleInfo.status === 'expired' && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-bold flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                  <span>انتهت فترة الاختبار المحددة ({formatArabicDateTime(exam.scheduled_end)})</span>
                                </div>
                              )}
                            </div>
                          )}

                          {isCompleted && exam.show_results_immediately && session && (
                            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                              <div className="text-xs">
                                <span className="text-emerald-700 font-bold block">درجتك المحققة:</span>
                                <span className="text-emerald-900 font-black text-sm">
                                  {session.score} من {session.total_marks} نقطة
                                </span>
                              </div>
                              <span className={`text-base font-black px-3 py-1 rounded-xl ${
                                percentage >= 85 ? 'bg-emerald-600 text-white' : percentage >= 60 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                              }`}>
                                {percentage}%
                              </span>
                            </div>
                          )}

                          {isCompleted && !exam.show_results_immediately && (
                            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-600">
                              تم تسجيل إجاباتك بنجاح! سيتم إعلان الدرجة من قبل المعلم بعد انتهاء موعد الاختبار.
                            </div>
                          )}
                        </div>

                        <div>
                          {isCompleted ? (
                            <button
                              disabled
                              className="w-full py-2.5 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                            >
                              <Check className="w-4 h-4 text-slate-400" /> تم إنجاز هذا الاختبار بنجاح
                            </button>
                          ) : exam.is_scheduled && scheduleInfo.status === 'upcoming' ? (
                            <button
                              disabled
                              className="w-full py-3 bg-slate-100 text-slate-400 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200"
                            >
                              <Lock className="w-4 h-4 text-slate-400" /> غير متاح حالياً (يبدأ في الموعد المجدول)
                            </button>
                          ) : exam.is_scheduled && scheduleInfo.status === 'expired' ? (
                            <button
                              disabled
                              className="w-full py-3 bg-rose-50 text-rose-400 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-rose-200"
                            >
                              <Lock className="w-4 h-4 text-rose-400" /> انتهت فترة إتاحة هذا الاختبار
                            </button>
                          ) : (
                            <button
                              onClick={() => setActiveExamForStudent(exam)}
                              className="w-full py-3 bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-800 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/20"
                            >
                              <Play className="w-3.5 h-3.5" /> بدء الاختبار الآن 🚀
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {studentTab === 'padlet' && (
            <PadletBoardView
              currentUser={currentUser}
              initialGrade={currentUser.grade || 'grade-1'}
              initialTrack={currentUser.track || 'arabic-a'}
            />
          )}

          {studentTab === 'challenge' && (
            <div className="w-full h-[calc(100vh-140px)] min-h-[720px]">
              <MousaChallenge
                currentUser={currentUser}
                initialGrade={currentUser.grade || 'grade-1'}
                initialTrack={currentUser.track || 'arabic-a'}
              />
            </div>
          )}

          {studentTab === 'live' && (
            <div className="space-y-6">
              <LiveClassroom
                currentUser={currentUser}
                initialGrade={currentUser.grade || 'grade-1'}
                initialTrack={currentUser.track || 'arabic-a'}
                onLeave={() => setStudentTab('ai_studio')}
              />
            </div>
          )}

          {/* خيار استعادة رفيق موسى الصوتي في أسفل الصفحة إن رغب الطالب في الحديث معه */}
          {isMusaDismissed && canUserUseAI(currentUser, aiGovernanceRules).allowed && isAIFeatureAllowed('student').allowed && (
            <div className="mt-8 pt-4 border-t border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100/90 animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-emerald-300 shadow-xs flex-shrink-0 bg-white p-0.5">
                  <img src={MOUSA_AVATAR_SRC} alt="موسى" className="w-full h-full object-cover rounded-full" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800">هل ترغب في التحدث مع رفيقك الذكي موسى؟</h4>
                  <p className="text-[11px] text-slate-500 font-medium">رفيقك الصوتي موسى جاهز دائماً لمساعدتك في فهم الدروس ومرافقتك في رحلتك التعليمية.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMusaDismissed(false)}
                className="inline-flex items-center gap-1.5 font-black text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer flex-shrink-0"
              >
                <Bot className="w-4 h-4" />
                إظهار رفيق موسى الصوتي 💬
              </button>
            </div>
          )}
        </main>
        {renderSharedReader()}
        {renderFloatingMusaButton()}
        {renderAIModals()}
      </div>
    );
  }

  // ================= 6. واجهة ولي الأمر =================
  if (currentUser.role === 'parent') {
    const student = users.find((u) => u.id === currentUser.studentId);
    const studentSubs = submissions.filter((s) => s.studentId === currentUser.studentId);

    const totalEarned = studentSubs.reduce((acc, curr) => acc + curr.score, 0);
    const totalPossible = studentSubs.reduce((acc, curr) => acc + curr.totalPoints, 0);
    const avgPercentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

    const childAssignedBooks = student
      ? books.filter(
          (b) => b.assignedGrades?.includes(student.grade!) && b.assignedTracks?.includes(student.track!)
        )
      : [];

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        {renderOfflineBanner()}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {renderHeaderLogo()}
            <div>
              <h1 className="font-extrabold text-base text-slate-800">تعلَّم مع موسى | بوابة ولي الأمر</h1>
              <p className="text-xs text-slate-500 font-medium">مرحباً بك: <b className="text-slate-800">{currentUser.name}</b></p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsChatModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition shadow-xs cursor-pointer"
              title="مركز الرسائل المدرسية والتواصل الفوري"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">مركز الرسائل 💬</span>
            </button>

            <UserNavbarProfileButton
              user={currentUser}
              onClick={() => setIsProfileModalOpen(true)}
            />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
            >
              <LogOut className="w-3.5 h-3.5" /> تسجيل خروج
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {!student ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
              <p className="text-xs text-rose-500">لم يتم العثور على حساب الطالب المرتبط.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setParentTab('progress')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    parentTab === 'progress' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Award className="w-4 h-4" /> بطاقة متابعة الطالب
                </button>
                <button
                  onClick={() => setParentTab('library')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    parentTab === 'library' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Library className="w-4 h-4 text-emerald-400" /> مكتبة وكتب الطالب ({childAssignedBooks.length})
                </button>
              </div>

              {parentTab === 'progress' && (() => {
                const userPerm = canUserUseAI(currentUser, aiGovernanceRules);
                const isParentAIPermitted = userPerm.overrideStatus === 'inherit'
                  ? isAIFeatureAllowed('parent').allowed
                  : userPerm.allowed;
                const parentAIReason = userPerm.reason || isAIFeatureAllowed('parent').reason;

                return (
                  <ParentProgressTab
                    student={student}
                    studentSubs={studentSubs}
                    totalEarned={totalEarned}
                    totalPossible={totalPossible}
                    avgPercentage={avgPercentage}
                    isParentAIPermitted={isParentAIPermitted}
                    parentAIReason={parentAIReason}
                    onOpenQuickDiagnostic={() => {
                      setQuickDiagnosticStudent({ id: student.id, name: student.name });
                      setIsQuickDiagnosticOpen(true);
                    }}
                    onOpenDiagnosticModal={() => {
                      setDiagnosticStudent(student);
                      setIsDiagnosticModalOpen(true);
                    }}
                    onOpenPrintableWorksheet={() => {
                      setWorksheetStudent(student);
                      setIsPrintableWorksheetOpen(true);
                    }}
                  />
                );
              })()}

              {parentTab === 'library' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-extrabold text-base text-slate-800">مكتبة ابنك ({student.name})</h2>
                      <p className="text-xs text-slate-400">يمكنك مطالعة القصص المقررة على ابنك ومشاركته القراءة الممتعة.</p>
                    </div>
                  </div>

                  {childAssignedBooks.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                      <Library className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h4 className="font-bold text-slate-700 text-sm">لا توجد كتب مسندة حالياً</h4>
                      <p className="text-xs text-slate-400 mt-1">سيقوم معلم الصف بإسناد كتب جديدة قريباً.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {childAssignedBooks.map((book) => renderBookCard(book, 'parent'))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
        {renderSharedReader()}
        {renderAIModals()}
      </div>
    );
  }

  return (
    <>
      {renderSharedReader()}
      {renderAIModals()}
    </>
  );
}

export default function App() {
  return (
    <>
      <AppContent />
      <Analytics />
    </>
  );
}

