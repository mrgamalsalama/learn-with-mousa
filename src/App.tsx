import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShieldCheck, Users, GraduationCap, LogOut, Plus, Trash2, 
  Lock, User, BookOpen, Award, CheckCircle2, FileText, Send, Sparkles, Check, 
  Activity as ActivityIcon, UserCheck, HeartHandshake, BarChart3, Clock, 
  Library, Download, Eye, CheckSquare, X, Search, FileUp,
  Bot, Palette, Brain, Printer, MessageCircle, Star,
  Loader2, Wand2, Gamepad2, Trophy, Play, Zap, Wifi, WifiOff, Share2,
  ShieldAlert, Sliders, AlertTriangle, FileCheck2,
  ListTodo, KeyRound, Edit3, CalendarClock, Calendar, Pin, RefreshCw, Video
} from 'lucide-react';
import JSZip from 'jszip';
import { 
  UserProfile, UserRole, SchoolStage, GradeLevel, ArabicTrack, 
  STAGES_CONFIG, Activity, Question, StudentSubmission, StoryBankItem, BookItem,
  ChildBadge, AIGameType, AIGovernanceRules, Exam, ExamSession,
  TeacherTask, DelegatedAdminPermissions, DEFAULT_DELEGATED_PERMISSIONS, LiveClassSession
} from './types';
import { 
  getUsers, saveUser, deleteUser, getCurrentUser, setCurrentUser, recordUserLogin,
  getActivities, saveActivity, deleteActivity, getSubmissions, saveSubmission,
  getStoryBank, getBooksRepository, updateBookAssignment,
  syncUsersFromCloud, syncActivitiesFromCloud, syncSubmissionsFromCloud,
  getStudentBadges, syncStudentBadgesFromCloud, subscribeToCloudChanges,
  getOfflineSubmissionsQueue, drainOfflineQueue,
  getAIGovernanceRules, syncAIGovernanceRulesFromCloud, isAIFeatureAllowed, canUserUseAI,
  getExams, getExamSessions, syncExamsFromCloud, syncExamSessionsFromCloud,
  getTeacherTasks, syncTeacherTasksFromCloud,
  getLiveClassSessions, syncLiveClassSessionsFromCloud
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
import { UserProfileModal } from './components/UserProfileModal';
import { UserNavbarProfileButton } from './components/UserNavbarProfileButton';
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
    return ['overview', 'teachers', 'library', 'teacher_tasks', 'tasks', 'padlet', 'challenge', 'live', 'ai_governance'].includes(tab);
  }
  if (role === 'super_admin' || role === 'admin') {
    return ['teachers', 'hods', 'students', 'parents', 'bank', 'ai_governance', 'teacher_tasks', 'tasks'].includes(tab);
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

export default function App() {
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
  const [showShareBadgeModal, setShowShareBadgeModal] = useState<boolean>(false);
  const [selectedBadgeForShare, setSelectedBadgeForShare] = useState<ChildBadge | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [aiGovernanceRules, setAiGovernanceRules] = useState<AIGovernanceRules>(getAIGovernanceRules());

  // تبويبات لوحة المشرف العام مع استعادة التبويب النشط
  const [adminTab, setAdminTab] = useState<'hods' | 'teachers' | 'students' | 'parents' | 'bank' | 'ai_governance' | 'teacher_tasks'>(() => {
    const initialUser = getCurrentUser();
    return getInitialTabForRole(initialUser?.role || 'super_admin', 'teachers') as any;
  });

  // تبويبات لوحة رئيس القسم مع استعادة التبويب النشط
  const [hodTab, setHodTab] = useState<'overview' | 'teachers' | 'library' | 'teacher_tasks' | 'padlet' | 'challenge' | 'live' | 'ai_governance'>(() => {
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
        if (url.searchParams.get('tab') !== currentActiveTab) {
          url.searchParams.set('tab', currentActiveTab);
          window.history.replaceState({ tab: currentActiveTab }, '', url.toString());
        }
      }
    } catch (err) {
      console.warn('Error syncing active tab to URL/storage:', err);
    }
  }, [currentUser?.role, currentActiveTab]);

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

  // عارض الكتاب التفاعلي المباشر (Direct Reader State)
  const [activeReadingBook, setActiveReadingBook] = useState<BookItem | null>(null);

  // حالة تشغيل اللعبة الذكية للطالب أو المعلم
  const [activeGameToPlay, setActiveGameToPlay] = useState<Activity | null>(null);

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
              <button
                type="button"
                onClick={() => openAssignModal(book)}
                className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  isAssigned 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {isAssigned ? 'تعديل إسناد الصفوف' : 'إسناد الكتاب لصفوفي'}
              </button>
            )}

            <button
              type="button"
              onClick={() => openReader(book)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
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
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-200/80">
          {/* صورة موسى في شاشة تسجيل الدخول */}
          <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-xl shadow-emerald-600/20 mx-auto mb-4 border-2 border-emerald-500/40 bg-white p-1">
            <img 
              src={MOUSA_AVATAR_SRC} 
              alt="منصة تعلَّم مع موسى" 
              className="w-full h-full object-cover rounded-2xl" 
            />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 text-center mb-1">منصة تعلَّم مع موسى</h1>
          <p className="text-slate-500 text-xs text-center mb-6">بوابة الدخول للنظام المركزي</p>

          {loginError && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl text-center font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="اسم المستخدم"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-600/20"
            >
              تسجيل الدخول
            </button>
          </form>

          {/* تجربة الأدوار بنقرة واحدة */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <span className="block text-[11px] font-bold text-slate-500 mb-2 text-center">
              تجربة المنصة الفورية (اختر دوراً للدخول المباشر):
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('student', '123')}
                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold border border-emerald-200 transition text-center"
              >
                👦 الطالب (موسى)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('teacher', '123')}
                className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl font-bold border border-indigo-200 transition text-center"
              >
                👩‍🏫 المعلمة (فاطمة)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('parent', '123')}
                className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl font-bold border border-amber-200 transition text-center"
              >
                👨‍👩‍👧 ولي الأمر (عمر)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('hod', '123')}
                className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-xl font-bold border border-purple-200 transition text-center"
              >
                👔 رئيس القسم (د. أحمد)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin', '123')}
                className="col-span-2 p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold border border-slate-300 transition text-center"
              >
                🛡️ المشرف العام (الإدارة العليا)
              </button>
            </div>
          </div>
        </div>

        {renderAIModals()}
      </div>
    );
  }

  // ================= 2. واجهة المشرف العام =================
  if (currentUser.role === 'super_admin') {
    const hodsList = users.filter((u) => u.role === 'hod');
    const teachersList = users.filter((u) => u.role === 'teacher');
    const studentsList = users.filter((u) => u.role === 'student');
    const parentsList = users.filter((u) => u.role === 'parent');

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            {renderHeaderLogo()}
            <div>
              <h1 className="font-extrabold text-base text-slate-800">تعلَّم مع موسى | لوحة المؤسس والإدارة العليا</h1>
              <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> المشرف العام: {currentUser.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
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

        <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <h2 className="font-bold text-base mb-4 flex items-center gap-2 text-slate-800">
                <Plus className="w-5 h-5 text-emerald-600" /> إضافة مستخدم جديد
              </h2>

              <div className="grid grid-cols-2 gap-1.5 mb-5">
                <button
                  type="button"
                  onClick={() => setFormRole('hod')}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                    formRole === 'hod' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" /> رئيس قسم
                </button>
                <button
                  type="button"
                  onClick={() => setFormRole('teacher')}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                    formRole === 'teacher' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> معلم
                </button>
                <button
                  type="button"
                  onClick={() => setFormRole('student')}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                    formRole === 'student' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" /> طالب
                </button>
                <button
                  type="button"
                  onClick={() => setFormRole('parent')}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                    formRole === 'parent' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200'
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
                    placeholder="الاسم الكامل"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم الدخول</label>
                    <input
                      type="text"
                      required
                      placeholder="Username"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">كلمة السر</label>
                    <input
                      type="text"
                      required
                      placeholder="Password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {(formRole === 'teacher' || formRole === 'hod') && (
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">المسار المصرح به:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => toggleTrack('arabic-a')}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                            selectedTracks.includes('arabic-a') ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <span>ناطقين (Arabic A)</span>
                          {selectedTracks.includes('arabic-a') && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleTrack('arabic-b')}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                            selectedTracks.includes('arabic-b') ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <span>غير ناطقين (Arabic B)</span>
                          {selectedTracks.includes('arabic-b') && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">الصفوف المصرح بها:</label>
                      <div className="space-y-3 max-h-56 overflow-y-auto pr-1 border border-slate-100 p-2 rounded-2xl bg-slate-50/50">
                        {(Object.keys(STAGES_CONFIG) as SchoolStage[]).map((st) => (
                          <div key={st} className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-500 block">{STAGES_CONFIG[st].nameAr}</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {STAGES_CONFIG[st].grades.map((g) => (
                                <button
                                  key={g.id}
                                  type="button"
                                  onClick={() => toggleGrade(g.id)}
                                  className={`p-2 rounded-lg border text-right text-[11px] font-semibold transition flex items-center justify-between ${
                                    selectedGrades.includes(g.id) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <span>{g.labelAr}</span>
                                  {selectedGrades.includes(g.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {formRole === 'student' && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">المرحلة الدراسية</label>
                      <select
                        value={studentStage}
                        onChange={(e) => {
                          const s = e.target.value as SchoolStage;
                          setStudentStage(s);
                          setStudentGrade(STAGES_CONFIG[s].grades[0].id);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        {(Object.keys(STAGES_CONFIG) as SchoolStage[]).map((st) => (
                          <option key={st} value={st}>{STAGES_CONFIG[st].nameAr}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الصف التابع له</label>
                      <select
                        value={studentGrade}
                        onChange={(e) => setStudentGrade(e.target.value as GradeLevel)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        {STAGES_CONFIG[studentStage].grades.map((g) => (
                          <option key={g.id} value={g.id}>{g.labelAr}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">المسار اللغوي</label>
                      <select
                        value={studentTrack}
                        onChange={(e) => setStudentTrack(e.target.value as ArabicTrack)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                      >
                        <option value="arabic-a">الناطقين باللغة العربية (Arabic A)</option>
                        <option value="arabic-b">الناطقين بغيرها (Arabic B)</option>
                      </select>
                    </div>
                  </div>
                )}

                {formRole === 'parent' && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">اختر الطالب التابع له:</label>
                      {studentsList.length === 0 ? (
                        <p className="text-xs text-rose-500 font-medium">يجب إضافة حساب طالب أولاً.</p>
                      ) : (
                        <select
                          value={selectedStudentId}
                          onChange={(e) => setSelectedStudentId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold"
                        >
                          {studentsList.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name} ({getGradeLabel(st.grade!)})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20"
                >
                  حفظ وتأكيد الحساب
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-slate-100">
                <button
                  onClick={() => setAdminTab('teachers')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    adminTab === 'teachers' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  المعلمون ({teachersList.length})
                </button>
                <button
                  onClick={() => setAdminTab('hods')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    adminTab === 'hods' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  رؤساء الأقسام ({hodsList.length})
                </button>
                <button
                  onClick={() => setAdminTab('students')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    adminTab === 'students' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  الطلاب ({studentsList.length})
                </button>
                <button
                  onClick={() => setAdminTab('parents')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    adminTab === 'parents' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  أولياء الأمور ({parentsList.length})
                </button>
                <button
                  onClick={() => setAdminTab('bank')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    adminTab === 'bank' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <Library className="w-3.5 h-3.5" /> بنك القصص الإسلامية ({storyBank.length})
                </button>
                <button
                  onClick={() => setAdminTab('teacher_tasks')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                    adminTab === 'teacher_tasks'
                      ? 'bg-teal-700 text-white'
                      : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
                  }`}
                >
                  <ListTodo className="w-3.5 h-3.5 text-teal-600" />
                  <span>مهام وتكليفات المعلمين</span>
                  {teacherTasks.filter(t => !t.completed).length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-teal-600 text-white text-[10px] font-bold">
                      {teacherTasks.filter(t => !t.completed).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setAdminTab('ai_governance')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                    adminTab === 'ai_governance'
                      ? 'bg-rose-700 text-white'
                      : aiGovernanceRules.master_ai_killswitch
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>التحكم في الذكاء الاصطناعي</span>
                  {aiGovernanceRules.master_ai_killswitch && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  )}
                </button>
              </div>

              {adminTab === 'teacher_tasks' && (
                <TeacherTasksManager
                  actorUser={currentUser}
                  teachers={teachersList}
                  onTasksUpdated={() => setTeacherTasks(getTeacherTasks())}
                />
              )}

              {adminTab === 'ai_governance' && (
                <AdminAIGovernancePanel
                  rules={aiGovernanceRules}
                  onRulesUpdated={(newRules) => setAiGovernanceRules(newRules)}
                  adminName={currentUser?.name || 'المشرف العام'}
                  users={users}
                  onUserUpdated={(updatedUser) => {
                    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
                    if (currentUser && currentUser.id === updatedUser.id) {
                      setUser(updatedUser);
                    }
                  }}
                />
              )}

              {adminTab === 'bank' && (
                <div className="space-y-3">
                  {storyBank.map((s) => (
                    <div key={s.id} className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-extrabold text-sm text-slate-800">{s.title}</h4>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                          {s.moralTopic}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mb-2 line-clamp-2 leading-relaxed">{s.passage}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                        <span>المستوى: {getGradeLabel(s.grade)}</span>
                        <span>•</span>
                        <span>المسار: {s.track === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'}</span>
                        <span>•</span>
                        <span>الأسئلة: {s.questions.length} أسئلة</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'teachers' && (
                <div className="space-y-3">
                  {teachersList.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">لم يتم إضافة معلمين بعد.</p>
                  ) : (
                    teachersList.map((t) => {
                      const delegatedCount = countDelegatedPermissions(t.delegated_admin_permissions);
                      return (
                        <div key={t.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col gap-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-slate-800">{t.name}</h4>
                                {delegatedCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold border border-indigo-200 flex items-center gap-1">
                                    <KeyRound className="w-3 h-3 text-indigo-600" />
                                    {delegatedCount} صلاحيات مفوضة
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500">اسم المستخدم: <b>{t.username}</b> • كلمة السر: <b>{t.password}</b></span>
                            </div>

                            <button
                              onClick={() => handleDeleteUser(t.id)}
                              className="self-end sm:self-center p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                              title="حذف المعلم"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1.5 items-center">
                            {t.allowedTracks?.map((tr) => (
                              <span key={tr} className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[10px] font-bold">
                                {tr === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'}
                              </span>
                            ))}
                            {t.allowedGrades?.map((gId) => (
                              <span key={gId} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                                {getGradeLabel(gId)}
                              </span>
                            ))}
                          </div>

                          {/* أزرار الإدارة الحصرية: تعديل الصفوف والمراحل + إسناد المهام + تفويض الصلاحيات */}
                          <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedTeacherForGrades(t);
                                setIsEditTeacherGradesModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1.5 transition-colors"
                            >
                              <GraduationCap className="w-3.5 h-3.5" />
                              تعديل الصفوف والمراحل
                            </button>

                            <button
                              onClick={() => {
                                setAdminTab('teacher_tasks');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs border border-teal-200 flex items-center gap-1.5 transition-colors"
                            >
                              <ListTodo className="w-3.5 h-3.5" />
                              إدارة التكليفات
                            </button>

                            <button
                              onClick={() => {
                                setSelectedUserForDelegation(t);
                                setIsAdminDelegationModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 flex items-center gap-1.5 transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                              تفويض الصلاحيات الإدارية 🛡️
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {adminTab === 'hods' && (
                <div className="space-y-3">
                  {hodsList.map((h) => {
                    const delegatedCount = countDelegatedPermissions(h.delegated_admin_permissions);
                    return (
                      <div key={h.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-800">{h.name}</h4>
                              {delegatedCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold border border-indigo-200 flex items-center gap-1">
                                  <KeyRound className="w-3 h-3 text-indigo-600" />
                                  {delegatedCount} صلاحيات مفوضة
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500">اسم الدخول: <b>{h.username}</b> • كلمة السر: <b>{h.password}</b></span>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {h.allowedGrades?.map((gId) => (
                                <span key={gId} className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[10px] font-bold">
                                  {getGradeLabel(gId)}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteUser(h.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                            title="حذف رئيس القسم"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* زر تفويض الصلاحيات لرئيس القسم */}
                        <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedUserForDelegation(h);
                              setIsAdminDelegationModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 flex items-center gap-1.5 transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                            تفويض الصلاحيات الإدارية 🛡️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {adminTab === 'students' && (
                <div className="space-y-3">
                  {studentsList.map((st) => (
                    <div key={st.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{st.name}</h4>
                        <span className="text-[11px] text-slate-500">اسم الدخول: <b>{st.username}</b> • كلمة السر: <b>{st.password}</b></span>
                        <div className="flex gap-2 mt-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold">
                            {st.stage ? STAGES_CONFIG[st.stage]?.nameAr : ''}
                          </span>
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md text-[10px] font-bold">
                            {getGradeLabel(st.grade!)}
                          </span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold">
                            {st.track === 'arabic-a' ? 'ناطقين' : 'غير ناطقين'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteUser(st.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {adminTab === 'parents' && (
                <div className="space-y-3">
                  {parentsList.map((p) => {
                    const linkedStudent = users.find((u) => u.id === p.studentId);
                    return (
                      <div key={p.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">{p.name}</h4>
                          <span className="text-[11px] text-slate-500">اسم الدخول: <b>{p.username}</b> • كلمة السر: <b>{p.password}</b></span>
                          <div className="mt-2 text-xs">
                            <span className="text-slate-500">ولي أمر الطالب: </span>
                            <b className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {linkedStudent ? linkedStudent.name : 'غير محدد'}
                            </b>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteUser(p.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
        {renderSharedReader()}
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

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">حلول الطلاب</span>
                    <h3 className="text-xl font-bold text-slate-800">{departmentSubmissions.length} حل مكتمل</h3>
                  </div>
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
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Library className="w-5 h-5 text-emerald-600" /> المستودع القرائي المركزي
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    اختر القصص والكتب المصورة الملائمة لمناهجك وأسندها لصفوفك لتظهر في مكتبة الطالب فوراً.
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

            return (
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                {!isTeacherAIPermitted && (
                  <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <span className="font-bold block">ميزات الذكاء الاصطناعي للمعلم معطلة</span>
                      <span className="text-[11px] text-rose-600">{teacherAIReason}</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                      <Award className="w-5 h-5 text-indigo-600" />
                      قائمة درجات وحلول الطلاب
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      رصد استجابات المتعلمين ونتائج الاختبارات التفاعلية
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isTeacherAIPermitted) {
                          alert(`عذراً، توليد التقارير الذكية معطل بأمر الإدارة العليا:\n${teacherAIReason}`);
                          return;
                        }
                        const firstStudent = users.find(u => u.role === 'student');
                        if (firstStudent) {
                          setQuickDiagnosticStudent({ id: firstStudent.id, name: firstStudent.name });
                          setIsQuickDiagnosticOpen(true);
                        } else if (submissions.length > 0) {
                          setQuickDiagnosticStudent({ id: submissions[0].studentId, name: submissions[0].studentName });
                          setIsQuickDiagnosticOpen(true);
                        }
                      }}
                      disabled={submissions.length === 0 || !isTeacherAIPermitted}
                      className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                      title={!isTeacherAIPermitted ? teacherAIReason : "توليد التقرير الذكي الفوري للطالب بنقرة واحدة"}
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>توليد التقرير الذكي الفوري للطالب ⚡</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!isTeacherAIPermitted) {
                          alert(`عذراً، تقرير الفاقد التعليمي الذكي معطل بأمر الإدارة العليا:\n${teacherAIReason}`);
                          return;
                        }
                        setIsClassDiagnosticOpen(true);
                      }}
                      disabled={submissions.length === 0 || !isTeacherAIPermitted}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                      title={!isTeacherAIPermitted ? teacherAIReason : "تحليل ذكي تراكمي للفاقد التعليمي للفصل بالكامل"}
                    >
                      <BarChart3 className="w-4 h-4 text-amber-300" />
                      تقرير الفاقد التعليمي للفصل 📊
                    </button>
                  </div>
                </div>

              {submissions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">لم يقم أي طالب بحل الأنشطة بعد.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400">
                        <th className="pb-3 font-semibold">اسم الطالب</th>
                        <th className="pb-3 font-semibold">النشاط</th>
                        <th className="pb-3 font-semibold">الدرجة</th>
                        <th className="pb-3 font-semibold">النسبة</th>
                        <th className="pb-3 font-semibold">تاريخ التسليم</th>
                        <th className="pb-3 font-semibold text-center">أدوات الذكاء الاصطناعي 🧠</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {submissions.map((sub) => {
                        const percentage = Math.round((sub.score / sub.totalPoints) * 100) || 0;
                        const targetStudent = users.find(u => u.id === sub.studentId) || {
                          id: sub.studentId,
                          name: sub.studentName,
                          role: 'student' as const,
                          grade: sub.grade,
                          track: sub.track,
                          stage: 'primary' as const,
                          username: 'student',
                          password: '123'
                        };

                        return (
                          <tr key={sub.id} className="hover:bg-slate-50">
                            <td className="py-3 font-bold text-slate-800">{sub.studentName}</td>
                            <td className="py-3 text-slate-600">{sub.activityTitle}</td>
                            <td className="py-3 font-bold text-emerald-600">{sub.score} / {sub.totalPoints}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                percentage >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {percentage}%
                              </span>
                            </td>
                            <td className="py-3 text-slate-400">{sub.submittedAt}</td>
                            <td className="py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isTeacherAIPermitted) {
                                      alert(`عذراً، التشخيص الفوري معطل بأمر الإدارة العليا:\n${teacherAIReason}`);
                                      return;
                                    }
                                    setQuickDiagnosticStudent({ id: sub.studentId, name: sub.studentName });
                                    setIsQuickDiagnosticOpen(true);
                                  }}
                                  disabled={!isTeacherAIPermitted}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-[10px] font-bold border border-amber-300 transition flex items-center gap-1 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
                                  title={!isTeacherAIPermitted ? teacherAIReason : "توليد التقرير التشخيصي الفوري لهذا الطالب بنقرة واحدة"}
                                >
                                  <Zap className="w-3 h-3 text-amber-600" /> تشخيص فوري ⚡
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isTeacherAIPermitted) {
                                      alert(`عذراً، التقرير التشخيصي معطل بأمر الإدارة العليا:\n${teacherAIReason}`);
                                      return;
                                    }
                                    setDiagnosticStudent(targetStudent);
                                    setIsDiagnosticModalOpen(true);
                                  }}
                                  disabled={!isTeacherAIPermitted}
                                  className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg text-[10px] font-bold border border-cyan-200 transition flex items-center gap-1 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
                                  title={!isTeacherAIPermitted ? teacherAIReason : "التقرير التشخيصي للطفل بالذكاء الاصطناعي"}
                                >
                                  <Brain className="w-3 h-3 text-cyan-600" /> تقرير تشخيصي
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isTeacherAIPermitted) {
                                      alert(`عذراً، توليد ورقة العمل العلاجية معطل بأمر الإدارة العليا:\n${teacherAIReason}`);
                                      return;
                                    }
                                    setWorksheetStudent(targetStudent);
                                    setIsPrintableWorksheetOpen(true);
                                  }}
                                  disabled={!isTeacherAIPermitted}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold border border-emerald-200 transition flex items-center gap-1 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
                                  title={!isTeacherAIPermitted ? teacherAIReason : "توليد ورقة عمل علاجية للطباعة"}
                                >
                                  <Printer className="w-3 h-3 text-emerald-600" /> ورقة علاجية
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
    const studentActivities = activities.filter(
      (a) => a.grade === currentUser.grade && a.track === currentUser.track
    );
    const studentWorksheets = studentActivities.filter((a) => a.activityType !== 'game');
    const studentGames = studentActivities.filter((a) => a.activityType === 'game');

    const startStarterGame = (type: AIGameType) => {
      // إذا كان هناك نشاط من نفس النوع مرسل من المعلم، نطلقه فوراً
      const existing = studentGames.find((g) => g.gameData?.gameType === type);
      if (existing) {
        setActiveGameToPlay(existing);
        return;
      }

      let sampleData;
      if (type === 'phonics_treasure') {
        sampleData = {
          gameType: 'phonics_treasure' as const,
          targetSkill: 'تَمْيِيزُ الحُرُوفِ المُتَقَارِبَةِ صَوْتِيًّا (س / ص)',
          instructions: 'ابْحَثْ عَنِ الكَلِمَةِ الصَّحِيحَةِ وَانْقُرْ عَلَى جَوْهَرَتِهَا السَّحْرِيَّةِ!',
          levels: [
            {
              id: 1,
              prompt: 'أَيْنَ الكَلِمَةُ الَّتِي تَبْدَأُ بِحَرْفِ (الصَّادِ - صَـ)؟',
              correctAnswers: ['صَقْرٌ'],
              options: ['سَمَكَةٌ', 'صَقْرٌ', 'سَفِينَةٌ', 'سَيَّارَةٌ'],
              feedbackSuccess: 'أَحْسَنْتَ يَا بَطَلِي! (صَقْرٌ) تَبْدَأُ بِالصَّادِ المُفَخَّمَةِ 🦅',
              feedbackHint: 'انْتَبِهْ! الصَّادُ حَرْفٌ مُفَخَّمٌ مِثْلَ: صَـ.. صَقْرٌ!'
            },
            {
              id: 2,
              prompt: 'ابْحَثْ عَنِ الكَلِمَةِ الَّتِي تَحْتَوِي عَلَى (سِـ) مَكْسُورَةٍ:',
              correctAnswers: ['سِتَارٌ'],
              options: ['صُنْدُوقٌ', 'سِتَارٌ', 'صَابُونٌ', 'صَيْدَلِيَّةٌ'],
              feedbackSuccess: 'إِجَابَةٌ رَائِعَةٌ جِدًّا! (سِتَارٌ) صَوْتُهَا سِـ نَاعِمٌ وَمُرَقَّقٌ 🌟',
              feedbackHint: 'اسْتَمِعْ جَيِّدًا لِصَوْتِ الكَسْرَةِ الخَفِيفَةِ مَعَ السِّينِ: سِـ!'
            },
            {
              id: 3,
              prompt: 'أَيُّ كَلِمَةٍ مِمَّا يَلِي فِيهَا مَدٌّ بِالأَلِفِ مَعَ الصَّادِ (صَا)؟',
              correctAnswers: ['صَابِرٌ'],
              options: ['سَامِرٌ', 'صَابِرٌ', 'سَعِيدٌ', 'سُلَيْمَانُ'],
              feedbackSuccess: 'يَا لَكَ مِنْ ذَكِيٍّ عَبْقَرِيٍّ! كَلِمَةُ (صَابِرٌ) صَوْتُهَا مَمْدُودٌ بِفَخَامَةٍ! 🏆',
              feedbackHint: 'ابْحَثْ عَنْ كَلِمَةٍ فِيهَا صَادٌ تَلِيهَا أَلِفُ المَدِّ!'
            }
          ]
        };
      } else if (type === 'sentence_builder') {
        sampleData = {
          gameType: 'sentence_builder' as const,
          targetSkill: 'تَرْتِيبُ الجُمْلَةِ الفِعْلِيَّةِ وَالاسْمِيَّةِ البَسِيطَةِ',
          instructions: 'انْقُرْ عَلَى الكَلِمَاتِ بِالتَّرْتِيبِ الصَّحِيحِ لِتَصْنَعَ جُمْلَةً مُفِيدَةً!',
          levels: [
            {
              id: 1,
              prompt: 'رَتِّبِ الكَلِمَاتِ لِتُكَوِّنَ جُمْلَةً تُعَبِّرُ عَنْ حُبِّ القِرَاءَةِ:',
              correctAnswers: ['قَرَأَ', 'مُوسَى', 'قِصَّةً', 'مُفِيدَةً'],
              options: ['قَرَأَ', 'مُفِيدَةً', 'قِصَّةً', 'مُوسَى'],
              feedbackSuccess: 'مُمْتَازٌ جِدًّا! (قَرَأَ مُوسَى قِصَّةً مُفِيدَةً) جُمْلَةٌ تَامَّةُ المَعْنَى 📚',
              feedbackHint: 'ابْدَأْ بِالفِعْلِ أَوَّلًا: (قَرَأَ...) مَنْ قَرَأَ؟'
            },
            {
              id: 2,
              prompt: 'رَتِّبْ كَلِمَاتِ الجُمْلَةِ التَّالِيَةِ لِتَصِفَ جَمَالَ الطَّبِيعَةِ:',
              correctAnswers: ['تُغَرِّدُ', 'العَصَافِيرُ', 'فِي', 'الصَّبَاحِ'],
              options: ['الصَّبَاحِ', 'فِي', 'تُغَرِّدُ', 'العَصَافِيرُ'],
              feedbackSuccess: 'بَارَكَ اللَّهُ فِيكَ! جُمْلَةٌ نَقِيَّةٌ وَجَمِيلَةٌ كَصَوْتِ العَصَافِيرِ 🕊️',
              feedbackHint: 'ابْدَأْ بِصَوْتِ التَّغْرِيدِ: (تُغَرِّدُ...)!'
            },
            {
              id: 3,
              prompt: 'رَتِّبِ الكَلِمَاتِ لِتُكَوِّنَ نَصِيحَةً لِلأَبْطَالِ:',
              correctAnswers: ['العِلْمُ', 'نُورٌ', 'يَهْدِي', 'القُلُوبَ'],
              options: ['يَهْدِي', 'نُورٌ', 'القُلُوبَ', 'العِلْمُ'],
              feedbackSuccess: 'عَظِيمٌ يَا بَطَلِي العَبْقَرِي! صَنَعْتَ حِكْمَةً لُغَوِيَّةً خَالِدَةً 🌟',
              feedbackHint: 'ابْدَأْ بِالمُبْتَدَإِ (العِلْمُ...)'
            }
          ]
        };
      } else if (type === 'vowel_train') {
        sampleData = {
          gameType: 'vowel_train' as const,
          targetSkill: 'التَّمْيِيزُ بَيْنَ الحَرَكَاتِ القَصِيرَةِ وَالمُدُودِ الطَّوِيلَةِ',
          instructions: 'اخْتَرِ عَرَبَةَ القِطَارِ الَّتِي تَحْمِلُ الكَلِمَةَ بِالمَدِّ أَوِ الحَرَكَةِ المَطْلُوبَةِ!',
          levels: [
            {
              id: 1,
              prompt: 'أَيُّ عَرَبَةٍ تَحْمِلُ كَلِمَةً فِيهَا (مَدٌّ بِالأَلِفِ - ــا)؟',
              correctAnswers: ['كِتَابٌ'],
              options: ['كَتَبَ', 'كِتَابٌ', 'كُتُبٌ', 'يَكْتُبُ'],
              feedbackSuccess: 'طُوط طُوط! 🚂💨 أَحْسَنْتَ! كَلِمَةُ (كِتَابٌ) فِيهَا صَوْتُ أَلِفِ المَدِّ الطَّوِيلِ!',
              feedbackHint: 'اسْتَمِعْ إِلَى امْتِدَادِ صَوْتِ الفَتْحَةِ الطَّوِيلَةِ: تَا.. كِتَابٌ!'
            },
            {
              id: 2,
              prompt: 'أَيْنَ عَرَبَةُ القِطَارِ الَّتِي فِيهَا كَلِمَةٌ بِمَدِّ (الوَاوِ - ــو)؟',
              correctAnswers: ['عُصْفُورٌ'],
              options: ['عُصْفُورٌ', 'عَصِيرٌ', 'عَطَفَ', 'عَنْبَرٌ'],
              feedbackSuccess: 'صَافِرَةُ القِطَارِ تُحَيِّيكَ! 🚂🌟 (عُصْفُورٌ) تَحْتَوِي عَلَى مَدِّ الوَاوِ الجَمِيلِ!',
              feedbackHint: 'ضُمَّ شَفَتَيْكَ وَمُدَّ الصَّوْتَ: فُو.. عُصْفُورٌ!'
            },
            {
              id: 3,
              prompt: 'اخْتَرِ الكَلِمَةَ الَّتِي تَحْتَوِي عَلَى حَرَكَةٍ قَصِيرَةٍ فَقَطْ (بِلَا مَدٍّ):',
              correctAnswers: ['لَعِبَ'],
              options: ['لَاعِبٌ', 'لَعِبَ', 'يَلْعَبُونَ', 'لِعَابٌ'],
              feedbackSuccess: 'عَبْقَرِيُّ قِطَارِ الحَرَكَاتِ! 🚂🎉 كَلِمَةُ (لَعِبَ) كُلُّ حَرَكَاتِهَا قَصِيرَةٌ وَسَرِيعَةٌ!',
              feedbackHint: 'الحَرَكَةُ القَصِيرَةُ نَنْطِقُهَا بِسُرْعَةٍ دُونَ مَطٍّ فِي الصَّوْتِ!'
            }
          ]
        };
      } else if (type === 'letter_blending') {
        sampleData = {
          gameType: 'letter_blending' as const,
          targetSkill: 'دَمْجُ المَقَاطِعِ الصَّوْتِيَّةِ وَالحُرُوفِ لِتَكْوِينِ الكَلِمَاتِ',
          instructions: 'انْقُرْ عَلَى المَقَاطِعِ لِسَمَاعِ صَوْتِهَا، ثُمَّ اخْتَرِ الكَلِمَةَ الكَامِلَةَ النَّاتِجَةَ عَنِ الدَّمْجِ!',
          levels: [
            {
              id: 1,
              prompt: 'ادْمُجِ المَقَاطِعَ الصَّوْتِيَّةَ: [ مَسْـ ] + [ ـجِـ ] + [ ـدٌ ] لِتُكَوِّنَ كَلِمَةً:',
              correctAnswers: ['مَسْجِدٌ'],
              options: ['مَسْجِدٌ', 'مَسْبَحٌ', 'مَصْنَعٌ', 'مَسْرَحٌ'],
              segments: ['مَسْـ', 'ـجِـ', 'ـدٌ'],
              feedbackSuccess: 'مَعْمَلٌ عَبْقَرِيٌّ! 🧪✨ رَكَّبْتَ الكَلِمَةَ (مَسْجِدٌ) بِتَفَوُّقٍ بَاهِرٍ!',
              feedbackHint: 'انْطِقِ المَقْطَعَ السَّاكِنَ أَوَّلًا: مَسْـ، ثُمَّ أَضِفِ الكَسْرَةَ: ـجِـ، ثُمَّ التَّنْوِينَ: ـدٌ!'
            },
            {
              id: 2,
              prompt: 'مَا الكَلِمَةُ الَّتِي تَنْتُجُ عَنْ دَمْجِ: [ مُـ ] + [ ـعَلِّـ ] + [ ـمٌ ]؟',
              correctAnswers: ['مُعَلِّمٌ'],
              options: ['مُعَلِّمٌ', 'مُهَنْدِسٌ', 'مُتَعَلِّمٌ', 'مُمَرِّضٌ'],
              segments: ['مُـ', 'ـعَلِّـ', 'ـمٌ'],
              feedbackSuccess: 'نَجَاحٌ كِيمْيَائِيٌّ لُغَوِيٌّ! 🧪🌟 كَوَّنْتَ كَلِمَةَ (مُعَلِّمٌ) صَانِعِ الأَجْيَالِ!',
              feedbackHint: 'انْتَبِهْ لِلشَّدَّةِ مَعَ الكَسْرَةِ فِي المَقْطَعِ الأَوْسَطِ: ـعَلِّـ!'
            },
            {
              id: 3,
              prompt: 'ادْمُجِ الحُرُوفَ التَّالِيَةَ: [ مَـ ] + [ ـدْ ] + [ رَ ] + [ سَـ ] + [ ـةٌ ]:',
              correctAnswers: ['مَدْرَسَةٌ'],
              options: ['مَدْرَسَةٌ', 'مَكْتَبَةٌ', 'مَزْرَعَةٌ', 'مَحْكَمَةٌ'],
              segments: ['مَدْ', 'رَ', 'سَـ', 'ـةٌ'],
              feedbackSuccess: 'عَالِمُ الكَلِمَاتِ الصَّغِيرُ! 🧪🏆 أَصْبَحْتَ خَبِيرَ دَمْجِ الحُرُوفِ فِي المَدْرَسَةِ!',
              feedbackHint: 'اقْرَأِ المَقْطَعَ الأَوَّلَ السَّاكِنَ: مَدْ.. مَدْرَسَةٌ!'
            }
          ]
        };
      } else if (type === 'vocab_detective') {
        sampleData = {
          gameType: 'vocab_detective' as const,
          targetSkill: 'مُحَقِّقُ المُفْرَدَاتِ: التَّرَادُفُ وَالتَّضَادُّ اللُّغَوِيُّ',
          instructions: 'ابْحَثْ فِي أَدِلَّةِ التَّحْقِيقِ عَنْ مُرَادِفِ أَوِ ضِدِّ الكَلِمَةِ المَطْلُوبَةِ!',
          levels: [
            {
              id: 1,
              prompt: 'أَيُّهَا المُحَقِّقُ الذَّكِيُّ، مَا مُرَادِفُ (مَعْنَى) كَلِمَةِ: [ مَسْرُورٌ ]؟',
              wordPuzzle: 'مَسْرُورٌ',
              correctAnswers: ['فَرِحٌ'],
              options: ['فَرِحٌ', 'حَزِينٌ', 'غَاضِبٌ', 'خَائِفٌ'],
              feedbackSuccess: 'حُلَّتِ القَضِيَّةُ بِنَجَاحٍ! 🔍🎉 (مَسْرُورٌ) تَعْنِي (فَرِحٌ)!',
              feedbackHint: 'تَذَكَّرِ الشُّعُورَ الجَمِيلَ عِنْدَمَا تَحْصُلُ عَلَى هَدِيَّةٍ: سُرُورٌ وَفَرَحٌ!'
            },
            {
              id: 2,
              prompt: 'ابْحَثْ فِي الأَدِلَّةِ عَنْ ضِدِّ (عَكْسِ) كَلِمَةِ: [ شُجَاعٌ ]:',
              wordPuzzle: 'شُجَاعٌ',
              correctAnswers: ['جَبَانٌ'],
              options: ['جَبَانٌ', 'قَوِيٌّ', 'بَطَلٌ', 'صَبُورٌ'],
              feedbackSuccess: 'مُحَقِّقٌ عَبْقَرِيٌّ لَا تَفُوتُهُ فَائِتَةٌ! 🔍🌟 عَكْسُ الشُّجَاعِ هُوَ (جَبَانٌ)!',
              feedbackHint: 'نَحْنُ نَبْحَثُ عَنِ الضِّدِّ (العَكْسِ) وَلَيْسَ المَعْنَى!'
            },
            {
              id: 3,
              prompt: 'مَا مُرَادِفُ (مَعْنَى) كَلِمَةِ: [ غَنِيمَةٌ ]؟',
              wordPuzzle: 'غَنِيمَةٌ',
              correctAnswers: ['مَكْسَبٌ'],
              options: ['مَكْسَبٌ', 'خَسَارَةٌ', 'صُعُوبَةٌ', 'هَزِيمَةٌ'],
              feedbackSuccess: 'كَتَبْتَ تَقْرِيرَ التَّحْقِيقِ الكَامِلَ بِامْتِيَازٍ! 🔍🏆 غَنِيمَةٌ تَعْنِي مَكْسَبٌ كَبِيرٌ!',
              feedbackHint: 'الغَنِيمَةُ هِيَ الفَوْزُ وَالمَكْسَبُ الَّذِي يَحْصُلُ عَلَيْهِ الفَائِزُ!'
            }
          ]
        };
      } else if (type === 'category_sorter') {
        sampleData = {
          gameType: 'category_sorter' as const,
          targetSkill: 'تَصْنِيفُ الكَلِمَاتِ حَسَبَ اللَّامِ الشَّمْسِيَّةِ وَالقَمَرِيَّةِ',
          instructions: 'فَرِّزِ الكَلِمَاتِ بِوَضْعِ كُلِّ كَلِمَةٍ فِي سَلَّتِهَا الصَّحِيحَةِ (شَمْسِيَّةٌ أَمْ قَمَرِيَّةٌ)!',
          levels: [
            {
              id: 1,
              prompt: 'صَنِّفِ الكَلِمَاتِ التَّالِيَةَ إِلَى لَامٍ شَمْسِيَّةٍ ☀️ أَوْ لَامٍ قَمَرِيَّةٍ 🌙:',
              categories: ['اللَّامُ الشَّمْسِيَّةُ ☀️', 'اللَّامُ القَمَرِيَّةُ 🌙'],
              options: ['الشَّمْسُ', 'القَمَرُ', 'النُّورُ', 'الكِتَابُ'],
              categoryMap: {
                'الشَّمْسُ': 'اللَّامُ الشَّمْسِيَّةُ ☀️',
                'القَمَرُ': 'اللَّامُ القَمَرِيَّةُ 🌙',
                'النُّورُ': 'اللَّامُ الشَّمْسِيَّةُ ☀️',
                'الكِتَابُ': 'اللَّامُ القَمَرِيَّةُ 🌙'
              },
              correctAnswers: ['الشَّمْسُ', 'النُّورُ'],
              feedbackSuccess: 'تَصْنِيفٌ مُتْقَنٌ جِدًّا يَا بَطَلِي! ⚖️🌟 مَيَّزْتَ بَيْنَ الشَّمْسِيَّةِ وَالقَمَرِيَّةِ بِبَرَاعَةٍ!',
              feedbackHint: 'انْتَبِهْ: اللَّامُ الشَّمْسِيَّةُ لَا تُنْطَقُ وَيَلِيهَا حَرْفٌ مُشَدَّدٌ، أَمَّا القَمَرِيَّةُ فَتُنْطَقُ وَتَظْهَرُ سَاكِنَةً!'
            },
            {
              id: 2,
              prompt: 'فَرْزُ التَّاءِ المَرْبُوطَةِ (ـة / ة) 🌸 وَالتَّاءِ المَفْتُوحَةِ (ت) 🏷️:',
              categories: ['تَاءٌ مَرْبُوطَةٌ 🌸', 'تَاءٌ مَفْتُوحَةٌ 🏷️'],
              options: ['شَجَرَةٌ', 'بَيْتٌ', 'حَدِيقَةٌ', 'صَوْتٌ'],
              categoryMap: {
                'شَجَرَةٌ': 'تَاءٌ مَرْبُوطَةٌ 🌸',
                'بَيْتٌ': 'تَاءٌ مَفْتُوحَةٌ 🏷️',
                'حَدِيقَةٌ': 'تَاءٌ مَرْبُوطَةٌ 🌸',
                'صَوْتٌ': 'تَاءٌ مَفْتُوحَةٌ 🏷️'
              },
              correctAnswers: ['شَجَرَةٌ', 'حَدِيقَةٌ'],
              feedbackSuccess: 'خَبِيرُ التَّاءِ العَبْقَرِيُّ! ⚖️🌸 فَرَزْتَ التَّاءَ المَرْبُوطَةَ وَالمَفْتُوحَةَ بِامْتِيَازٍ!',
              feedbackHint: 'التَّاءُ المَرْبُوطَةُ تُنْطَقُ هَاءً عِنْدَ الوَقْفِ (شَجَرَهْ)، أَمَّا المَفْتُوحَةُ فَتَبْقَى تَاءً صَرِيحَةً!'
            }
          ]
        };
      } else {
        sampleData = {
          gameType: 'story_quest' as const,
          targetSkill: 'المَغْزَى الأَخْلَاقِيُّ وَالفَهْمُ القِرَائِيُّ',
          instructions: 'اقْرَأِ المَوْقِفَ وَاخْتَرِ التَّصَرُّفَ الصَّحِيحَ لِتُسَاعِدَ مُوسَى فِي مُغَامَرَتِهِ!',
          levels: [
            {
              id: 1,
              prompt: 'وَجَدَ مُوسَى قِطَّةً صَغِيرَةً جَائِعَةً فِي حَدِيقَةِ الحَيِّ، مَاذَا يَفْعَلُ؟',
              correctAnswers: ['يُقَدِّمُ لَهَا الطَّعَامَ وَالمَاءَ بِرِفْقٍ'],
              options: [
                'يُقَدِّمُ لَهَا الطَّعَامَ وَالمَاءَ بِرِفْقٍ',
                'يَتْرُكُهَا وَيَذْهَبُ بَعِيدًا',
                'يُخِيفُهَا بِصَوْتٍ عَالٍ'
              ],
              feedbackSuccess: 'أَحْسَنْتَ يَا بَطَلَ الرَّحْمَةِ! الرِّفْقُ بِالحَيَوَانِ خُلُقٌ نَبِيلٌ 🐱✨',
              feedbackHint: 'فَكِّرْ فِي خُلُقِ الإِحْسَانِ وَالرَّحْمَةِ مَعَ الكَائِنَاتِ الضَّعِيفَةِ.'
            },
            {
              id: 2,
              prompt: 'أَرَادَ مُوسَى اسْتِعَارَةَ قَلَمٍ مِنْ زَمِيلِهِ، مَا العِبَارَةُ اللَّبِقَةُ الَّتِي يَقُولُهَا؟',
              correctAnswers: ['مِنْ فَضْلِكَ يَا صَدِيقِي، هَلْ تُعِيرُنِي قَلَمَكَ؟'],
              options: [
                'أَعْطِنِي قَلَمَكَ حَالًا!',
                'مِنْ فَضْلِكَ يَا صَدِيقِي، هَلْ تُعِيرُنِي قَلَمَكَ؟',
                'سَآخُذُ القَلَمَ دُونَ إِذْنِكَ!'
              ],
              feedbackSuccess: 'يَا لَكَ مِنْ أَمِيرٍ مُؤَدَّبٍ! كَلِمَاتُكَ مَلِيئَةٌ بِالذَّوْقِ وَاللَّبَاقَةِ 💎',
              feedbackHint: 'ابْحَثْ عَنِ الجُمْلَةِ الَّتِي فِيهَا اسْتِئْذَانٌ وَاحْتِرَامٌ (مِنْ فَضْلِكَ).'
            },
            {
              id: 3,
              prompt: 'رَأَى مُوسَى وَرَقَةً مَلْفُوفَةً فِيهَا لُغْزٌ: "أَنَا أَبْدَأُ بِحَرْفِ المِيمِ وَأُنِيرُ العُقُولَ"، فَمَا هِيَ؟',
              correctAnswers: ['المَعْرِفَةُ'],
              options: ['المَعْرِفَةُ', 'المِرْوَحَةُ', 'المَلْعَبُ'],
              feedbackSuccess: 'فُزْتَ بِالمُغَامَرَةِ يَا فَارِسَ اللُّغَةِ! المَعْرِفَةُ هِيَ كَنْزُ الحَيَاةِ 🏰🌟',
              feedbackHint: 'فَكِّرْ فِيمَا يُنِيرُ عَقْلَ الإِنْسَانِ وَيَجْعَلُهُ حَكِيمًا!'
            }
          ]
        };
      }

      let starterTitle = '';
      if (type === 'phonics_treasure') starterTitle = 'كنز الحروف: تمييز س وص';
      else if (type === 'sentence_builder') starterTitle = 'متاهة تركيب الجمل البسيطة';
      else if (type === 'story_quest') starterTitle = 'مغامرة موسى وقرارات الحكمة';
      else if (type === 'vowel_train') starterTitle = 'قطار الحركات والمدود السريع';
      else if (type === 'letter_blending') starterTitle = 'معمل دمج الحروف وتكوين الكلمات';
      else if (type === 'vocab_detective') starterTitle = 'محقق المفردات: الترادف والتضاد';
      else starterTitle = 'فرز الظواهر اللغوية: شمسية وقمرية';

      const starterActivity: Activity = {
        id: `starter_${type}_${Date.now()}`,
        title: starterTitle,
        activityType: 'game',
        gameData: sampleData,
        teacherId: 'system_mousa',
        teacherName: 'موسى الذكي',
        stage: currentUser.stage,
        grade: currentUser.grade,
        track: currentUser.track,
        questions: [],
        createdAt: new Date().toLocaleDateString('ar-EG')
      };

      setActiveGameToPlay(starterActivity);
    };

    const studentAssignedBooks = books.filter(
      (b) => 
        b.assignedGrades?.includes(currentUser.grade!) && 
        b.assignedTracks?.includes(currentUser.track!) &&
        b.coverUrl?.includes('/covers/ar/') && 
        !b.coverUrl?.includes('.svg') &&
        !b.title.includes('حساب')
    );

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
            <button
              onClick={() => setStudentTab('library')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                studentTab === 'library' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <Library className="w-4 h-4 text-emerald-400" /> رف القراءة ومكتبتي المصورة ({studentAssignedBooks.length})
            </button>
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
            <div className="space-y-6">
              {/* ترويسة ساحة الألعاب التفاعلية */}
              <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-amber-500/20 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black text-amber-100 mb-2">
                      <Gamepad2 className="w-4 h-4 text-amber-200" /> ساحة ألعاب الذكاء الاصطناعي التفاعلية
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black mb-1.5">
                      مَرْحَبًا بِكَ فِي سَاحَةِ الأَلْعَابِ الذَّكِيَّةِ 🎮
                    </h2>
                    <p className="text-xs sm:text-sm text-amber-100 max-w-xl">
                      اختر أي لعبة مسندة من معلمك أو العب التحديات المباشرة مع موسى لتكسب الأوسمة ونقاط التميز!
                    </p>
                  </div>
                  <div className="flex items-center gap-3 bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20">
                    <Trophy className="w-7 h-7 text-amber-200" />
                    <div>
                      <div className="text-[11px] text-amber-100 font-bold">أوسمتك الحالية</div>
                      <div className="text-lg font-black text-white">{studentBadges.length} وسام 🏆</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ألعاب الصف المسندة من المعلم */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-600" /> ألعاب صفي المسندة من المعلم ({studentGames.length})
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">ألعاب مخصصة لمنهجك الدراسي</span>
                </div>

                {studentGames.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs">
                    <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Gamepad2 className="w-7 h-7" />
                    </div>
                    <h4 className="font-bold text-slate-700 text-sm mb-1">لا توجد ألعاب مسندة من معلمك حالياً</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mb-2">
                      سيقوم معلمك بإسناد ألعاب ذكاء اصطناعي جديدة لصفك قريباً. وفي هذه الأثناء، يمكنك الاستمتاع بالتحديات الجاهزة أدناه!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {studentGames.map((gameAct) => {
                      const gType = gameAct.gameData?.gameType || 'phonics_treasure';
                      const icon = gType === 'phonics_treasure' ? '💎' : gType === 'sentence_builder' ? '🧩' : '🏰';
                      const label = gType === 'phonics_treasure' ? 'كنز الحروف والصوتيات' : gType === 'sentence_builder' ? 'تركيب وبناء الجمل' : 'مغامرة موسى والقرارات';
                      return (
                        <div
                          key={gameAct.id}
                          className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-[10px] font-black flex items-center gap-1">
                                <span>{icon}</span> {label}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">{gameAct.createdAt}</span>
                            </div>
                            <h4 className="font-extrabold text-sm text-slate-800 mb-1.5">{gameAct.title}</h4>
                            {gameAct.gameData?.targetSkill && (
                              <p className="text-xs text-amber-800 font-bold bg-amber-50/60 p-2 rounded-xl mb-3 border border-amber-100">
                                🎯 المهارة: {gameAct.gameData.targetSkill}
                              </p>
                            )}
                            <p className="text-xs text-slate-500 mb-4 line-clamp-2">
                              {gameAct.gameData?.instructions || 'انطلق في هذا التحدي التفاعلي مع موسى واجمع النقاط!'}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-3">
                            <span className="text-xs text-slate-500 font-semibold">
                              إعداد: <b className="text-slate-700">{gameAct.teacherName}</b>
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveGameToPlay(gameAct)}
                              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                            >
                              <Play className="w-3.5 h-3.5" /> العب الآن 🎮
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ألعاب موسى التأسيسية المباشرة */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" /> ألعاب موسى التأسيسية المباشرة (ابدأ اللعب فوراً)
                  </h3>
                  <span className="text-xs text-slate-400">جاهزة للعب في أي وقت</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {/* 1. كنز الحروف */}
                  <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl mb-2.5">
                        💎
                      </div>
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-bold rounded-md border border-amber-200 inline-block mb-1.5">
                        صوتيات وتمييز بصري
                      </span>
                      <h4 className="font-black text-sm text-slate-800 mb-1">كَنْزُ الحُرُوفِ وَالصَّوْتِيَّاتِ</h4>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        ابحث عن الكلمات الصحيحة ذات الحركات التشكيلية والمخارج المتقاربة واملأ جعبة موسى بالجواهر!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startStarterGame('phonics_treasure')}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5" /> العب كنز الحروف 💎
                    </button>
                  </div>

                  {/* 2. تركيب الجمل */}
                  <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl mb-2.5">
                        🧩
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200 inline-block mb-1.5">
                        تركيب ونحو مبسط
                      </span>
                      <h4 className="font-black text-sm text-slate-800 mb-1">مَتَاهَةُ تَرْكِيبِ الجُمَلِ</h4>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        رتّب الكلمات المبعثرة المشكولة بدقة لتصنع جملاً تامة المعنى ذات سياق تربوي سليم!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startStarterGame('sentence_builder')}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5" /> العب تركيب الجمل 🧩
                    </button>
                  </div>

                  {/* 3. مغامرة الحكاية */}
                  <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center text-xl mb-2.5">
                        🏰
                      </div>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 text-[10px] font-bold rounded-md border border-indigo-200 inline-block mb-1.5">
                        فهم قرائي وقيم أخلاقية
                      </span>
                      <h4 className="font-black text-sm text-slate-800 mb-1">مُغَامَرَةُ مُوسَى وَالحِكَايَةِ</h4>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        ساعد موسى في مواقفه الحياتية عبر اتخاذ القرارات اللغوية والتربوية الصائبة لإنهاء المغامرة!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startStarterGame('story_quest')}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5" /> العب مغامرة الحكاية 🏰
                    </button>
                  </div>

                  {/* 4. قطار الحركات والمدود */}
                  <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center text-xl mb-2.5">
                        🚂
                      </div>
                      <span className="px-2 py-0.5 bg-sky-50 text-sky-800 text-[10px] font-bold rounded-md border border-sky-200 inline-block mb-1.5">
                        حركات قصيرة ومدود طويلة
                      </span>
                      <h4 className="font-black text-sm text-slate-800 mb-1">قِطَارُ الحَرَكَاتِ وَالمُدُودِ</h4>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        وجّه قاطرة موسى نحو العربة الصحيحة وميّز بين الحركات القصيرة والمدود الطويلة بصوت فوري!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startStarterGame('vowel_train')}
                      className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5" /> العب قطار الحركات 🚂
                    </button>
                  </div>

                  {/* 5. معمل دمج الحروف */}
                  <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center text-xl mb-2.5">
                        🧪
                      </div>
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-800 text-[10px] font-bold rounded-md border border-purple-200 inline-block mb-1.5">
                        تحليل ودمج مقاطع
                      </span>
                      <h4 className="font-black text-sm text-slate-800 mb-1">مَعْمَلُ دَمْجِ الحُرُوفِ</h4>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        استمع لنطق كل مقطع صوتي في المختبر، ثم ادمج المقاطع لتكوين الكلمات السليمة واكسب وسام العالِم!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startStarterGame('letter_blending')}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5" /> العب معمل الدمج 🧪
                    </button>
                  </div>

                  {/* 6. محقق المفردات */}
                  <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center text-xl mb-2.5">
                        🔍
                      </div>
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-900 text-[10px] font-bold rounded-md border border-amber-200 inline-block mb-1.5">
                        ترادف وتضاد لغوي
                      </span>
                      <h4 className="font-black text-sm text-slate-800 mb-1">مُحَقِّقُ المُفْرَدَاتِ</h4>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        اكتشف اللغز وابحث عن معاني الكلمات أو أضدادها بالاستماع لنطق موسى وحل قضايا المفردات الغامضة!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startStarterGame('vocab_detective')}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5" /> العب محقق المفردات 🔍
                    </button>
                  </div>

                  {/* 7. فرز الظواهر اللغوية */}
                  <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center text-xl mb-2.5">
                        ⚖️
                      </div>
                      <span className="px-2 py-0.5 bg-teal-50 text-teal-800 text-[10px] font-bold rounded-md border border-teal-200 inline-block mb-1.5">
                        شمسية وقمرية وتاءات
                      </span>
                      <h4 className="font-black text-sm text-slate-800 mb-1">فَرْزُ الظَّوَاهِرِ اللُّغَوِيَّةِ</h4>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        صنّف الكلمات المشكولة في سلتين منفصلتين وميّز القواعد الإملائية والظواهر الصوتية بدقة!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startStarterGame('category_sorter')}
                      className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5" /> العب فرز الظواهر ⚖️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {studentTab === 'library' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-extrabold text-base text-slate-800">قصصك وكتبك المختارة من معلمك</h2>
                  <p className="text-xs text-slate-400">استمتع بقراءة القصص المصورة التفاعلية لتنمية مهاراتك اللغوية.</p>
                </div>
              </div>

              {studentAssignedBooks.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                  <Library className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="font-bold text-slate-700 text-sm">رف القراءة فارغ حالياً</h4>
                  <p className="text-xs text-slate-400 mt-1">سيقوم معلمك بإسناد قصص ممتعة لصفك قريباً.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {studentAssignedBooks.map((book) => renderBookCard(book, 'student'))}
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
                <>
                  {!isParentAIPermitted && (
                    <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                      <div>
                        <span className="font-bold block">تقارير الذكاء الاصطناعي التشخيصية لولي الأمر معطلة</span>
                        <span className="text-[11px] text-rose-600">{parentAIReason}</span>
                      </div>
                    </div>
                  )}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
                      <div>
                        <span className="text-xs text-emerald-600 font-bold block mb-1">بطاقة متابعة الطالب</span>
                        <h2 className="text-xl font-black text-slate-800">{student.name}</h2>
                        <span className="text-xs text-slate-500">
                          {getGradeLabel(student.grade!)} • {student.track === 'arabic-a' ? 'مسار الناطقين بها' : 'مسار الناطقين بغيرها'}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!isParentAIPermitted) {
                              alert(`عذراً، التقارير الذكية معطلة بأمر الإدارة العليا:\n${parentAIReason}`);
                              return;
                            }
                            setQuickDiagnosticStudent({ id: student.id, name: student.name });
                            setIsQuickDiagnosticOpen(true);
                          }}
                          disabled={!isParentAIPermitted}
                          className="px-3 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
                          title={!isParentAIPermitted ? parentAIReason : "توليد التقرير الذكي الفوري للطالب بنقرة واحدة"}
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>التقرير الفوري ⚡</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isParentAIPermitted) {
                              alert(`عذراً، التقرير التشخيصي الذكي معطل بأمر الإدارة العليا:\n${parentAIReason}`);
                              return;
                            }
                            setDiagnosticStudent(student);
                            setIsDiagnosticModalOpen(true);
                          }}
                          disabled={!isParentAIPermitted}
                          className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
                          title={!isParentAIPermitted ? parentAIReason : "استخراج تقرير تشخيصي ذكي بالذكاء الاصطناعي"}
                        >
                          <Brain className="w-4 h-4" /> التقرير التشخيصي الذكي
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isParentAIPermitted) {
                              alert(`عذراً، توليد ورقة العمل العلاجية معطل بأمر الإدارة العليا:\n${parentAIReason}`);
                              return;
                            }
                            setWorksheetStudent(student);
                            setIsPrintableWorksheetOpen(true);
                          }}
                          disabled={!isParentAIPermitted}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
                          title={!isParentAIPermitted ? parentAIReason : "توليد وطباعة أوراق عمل علاجية"}
                        >
                          <Printer className="w-4 h-4" /> ورقة عمل علاجية
                        </button>
                        <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                          <Award className="w-7 h-7 text-emerald-600" />
                          <div>
                            <span className="text-[10px] text-emerald-800 font-bold block">معدل التحصيل</span>
                            <span className="text-base font-black text-emerald-700">{avgPercentage}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[11px] text-slate-400 block mb-1">الأنشطة المكتملة</span>
                        <span className="text-base font-extrabold text-slate-800">{studentSubs.length}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[11px] text-slate-400 block mb-1">مجموع الدرجات</span>
                        <span className="text-base font-extrabold text-emerald-600">{totalEarned} نقطة</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
                        <span className="text-[11px] text-slate-400 block mb-1">تقييم الأداء</span>
                        <span className="text-xs font-bold text-slate-700">
                          {avgPercentage >= 85 ? 'ممتاز ومتميز 🌟' : avgPercentage >= 70 ? 'جيد جداً 👍' : 'يحتاج متابعة وتدريب 🎯'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                    <h3 className="font-extrabold text-sm mb-4 text-slate-800">سجل إجابات ودرجات الأنشطة المكتملة</h3>
                    {studentSubs.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">لم يكمل الطالب أي نشاط حتى الآن.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {studentSubs.map((sub) => {
                          const perc = Math.round((sub.score / sub.totalPoints) * 100) || 0;
                          return (
                            <div key={sub.id} className="py-3.5 flex items-center justify-between">
                              <div>
                                <h4 className="font-bold text-xs text-slate-800 mb-0.5">{sub.activityTitle}</h4>
                                <span className="text-[10px] text-slate-400">تاريخ الإنجاز: {sub.submittedAt}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-xs text-slate-700">
                                  {sub.score} / {sub.totalPoints}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                                  perc >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {perc}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
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
