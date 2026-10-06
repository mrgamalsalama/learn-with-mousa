import React, { useState, useMemo } from 'react';
import { 
  X, Sliders, BookOpen, Gamepad2, Award, Mic, ShieldAlert, 
  CheckCircle2, AlertTriangle, Plus, Trash2, Calendar, Sparkles, 
  Lock, Unlock, ArrowRight, UserCheck, Star, Users, User, 
  FileCheck2, Check, RefreshCw, Send, ChevronRight, PenTool
} from 'lucide-react';
import { 
  UserProfile, GradeLevel, ArabicTrack, BookItem, TargetAssignmentType,
  ReadingBookAssignment, GameGovernanceRule, ORFAssignmentTask, 
  CEFROverrideRecord, RemedialPlan, Activity, AIGameType, CEFRLevel,
  ORFPassage
} from '../types';
import { 
  ORF_STANDARD_PASSAGES 
} from '../data/orfBenchmarkData';
import { 
  getReadingBookAssignments, saveReadingBookAssignment, deleteReadingBookAssignment,
  isFullLibraryOpenForGrade, setFullLibraryOpenForGrade,
  isLibraryOpenForStudent, setLibraryAccessForStudent, removeLibraryStudentOverride,
  getLibraryStudentOverrides,
  getGameGovernanceRules, saveGameGovernanceRule, deleteGameGovernanceRule,
  getCEFROverrides, saveCEFROverride,
  getORFAssignments, saveORFAssignment, deleteORFAssignment,
  getORFSessions, saveORFSession,
  getActivities, saveActivity, deleteActivity,
  saveRemedialPlan, getRemedialPlans,
  getUsers, saveUsers,
  getLanguagePassport, saveLanguagePassport,
  isGatekeeperUnlockedForStudent, setGatekeeperUnlockedForStudent, setGatekeeperUnlockedForClass
} from '../storage';
import { getGradeLabel } from '../utils/gradebookExport';
import { AssignmentTargetSelector } from './AssignmentTargetSelector';

interface TeacherControlHubProps {
  currentUser: UserProfile;
  students: UserProfile[];
  books: BookItem[];
  allowedGrades: GradeLevel[];
  initialStudent?: UserProfile | null;
  initialTab?: 'library' | 'games' | 'cefr' | 'orf' | 'remedial';
  onClose?: () => void;
  onRefreshData?: () => void;
}

export const TeacherControlHub: React.FC<TeacherControlHubProps> = ({
  currentUser,
  students,
  books,
  allowedGrades = [],
  initialStudent = null,
  initialTab = 'library',
  onClose,
  onRefreshData
}) => {
  const teacherGrade = allowedGrades[0] || 'grade-1';
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(teacherGrade);
  const [activeTab, setActiveTab] = useState<'library' | 'games' | 'cefr' | 'orf' | 'remedial'>(initialTab);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialStudent) {
      setBookTargetType('individual');
      setBookTargetStudentIds([initialStudent.id]);
      setGameTargetType('individual');
      setGameTargetStudentIds([initialStudent.id]);
      setCefrStudentId(initialStudent.id);
      setOrfTargetType('individual');
      setOrfTargetStudentIds([initialStudent.id]);
      setRemedialStudentId(initialStudent.id);
      if (initialStudent.grade) {
        setSelectedGrade(initialStudent.grade);
      }
    }
  }, [initialStudent]);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // فلترة طلاب المعلم في الصف المحدد
  const teacherStudents = useMemo(() => {
    return students.filter(s => s.role === 'student' && (!s.grade || s.grade === selectedGrade));
  }, [students, selectedGrade]);

  // =========================================================================
  // المحور 1: حوكمة رف الكتب والمكتبة المصورة
  // =========================================================================
  const [readingAssignments, setReadingAssignments] = useState<ReadingBookAssignment[]>(() => getReadingBookAssignments());
  const [isClassLibraryOpen, setIsClassLibraryOpen] = useState<boolean>(() => 
    isFullLibraryOpenForGrade(selectedGrade, currentUser.school_id)
  );
  const [studentLibraryOverrides, setStudentLibraryOverrides] = useState<Record<string, boolean>>(() => 
    getLibraryStudentOverrides()
  );

  // نموذج إسناد كتاب جديد
  const [bookTargetType, setBookTargetType] = useState<TargetAssignmentType>(initialStudent ? 'individual' : 'class');
  const [bookTargetStudentIds, setBookTargetStudentIds] = useState<string[]>(initialStudent ? [initialStudent.id] : []);
  const [selectedBookId, setSelectedBookId] = useState<string>(books[0]?.id || '');
  const [bookAssignmentType, setBookAssignmentType] = useState<'free_reading' | 'interactive_quiz'>('free_reading');
  const [bookNotes, setBookNotes] = useState<string>('قراءة ممتعة وموجهة! ركز في معاني المفردات وأحداث القصة.');
  const [bookDueDate, setBookDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  const handleToggleClassLibrary = (open: boolean) => {
    setFullLibraryOpenForGrade(selectedGrade, open, currentUser.school_id);
    setIsClassLibraryOpen(open);
    showToast(open ? `تم فتح التصفح الشامل لمكتبة ${getGradeLabel(selectedGrade)} 📖` : `تم حجب التصفح المفتوح واقتصار الرف على الكتب المسندة 🔒`);
    onRefreshData?.();
  };

  const handleToggleStudentLibrary = (studentId: string, currentOpen: boolean) => {
    const nextVal = !currentOpen;
    setLibraryAccessForStudent(studentId, nextVal);
    setStudentLibraryOverrides(getLibraryStudentOverrides());
    showToast(nextVal ? 'تم تمكين التصفح المفتوح للطالب استثنائياً ✅' : 'تم قفل التصفح المفتوح للطالب 🔒');
    onRefreshData?.();
  };

  const handleAssignBook = () => {
    const targetBook = books.find(b => b.id === selectedBookId);
    if (!targetBook) {
      alert('يرجى اختيار قصة أو كتاب من القائمة أولاً');
      return;
    }

    if (bookTargetType !== 'class' && bookTargetStudentIds.length === 0) {
      alert('يرجى اختيار طالب واحد على الأقل لإسناد القصة إليه');
      return;
    }

    const firstStudent = students.find(s => s.id === bookTargetStudentIds[0]);

    const newAssignment: ReadingBookAssignment = {
      id: `assign_${Date.now()}`,
      bookId: targetBook.id,
      bookTitle: targetBook.title,
      bookAuthor: targetBook.author,
      bookCoverUrl: targetBook.coverUrl,
      bookReadUrl: targetBook.readUrl,
      section: targetBook.section,
      assignmentType: bookAssignmentType,
      targetType: bookTargetType,
      targetGrade: selectedGrade,
      targetStudentId: bookTargetType === 'individual' ? bookTargetStudentIds[0] : undefined,
      targetStudentIds: bookTargetType !== 'class' ? bookTargetStudentIds : undefined,
      targetStudentName: bookTargetType === 'individual' ? firstStudent?.name : undefined,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      school_id: currentUser.school_id,
      assignedAt: new Date().toLocaleDateString('ar-EG'),
      dueDate: bookAssignmentType === 'interactive_quiz' ? bookDueDate : undefined,
      notes: bookNotes
    };

    saveReadingBookAssignment(newAssignment);

    // إذا كان تكليفاً قرائياً واجب الحل، إنشاء نشاط فهم قرائي تفاعلي مطابق
    if (bookAssignmentType === 'interactive_quiz') {
      const quizActivity: Activity = {
        id: `act_read_${targetBook.id}_${Date.now()}`,
        title: `نشاط فهم قرائي: ${targetBook.title}`,
        description: `نشاط قرائي رسمي واجب الحل لقصة «${targetBook.title}». ${bookNotes}`,
        passage: `📖 القصة المقررة: ${targetBook.title}\nالمؤلف: ${targetBook.author || 'مؤسسة هنداوي (بوك تايم)'}\nرابط قراءة القصة المباشر:\n${targetBook.readUrl}\n\nيرجى قراءة القصة بعناية ثم الإجابة عن أسئلة قياس الفهم القرائي التالية:`,
        activityType: 'story',
        teacherId: currentUser.id,
        teacherName: currentUser.name,
        school_id: currentUser.school_id,
        stage: firstStudent?.stage || 'primary',
        grade: selectedGrade,
        track: firstStudent?.track || 'arabic-a',
        createdAt: new Date().toLocaleDateString('ar-EG'),
        target_type: bookTargetType,
        target_student_ids: bookTargetType !== 'class' ? bookTargetStudentIds : undefined,
        due_date: bookDueDate,
        min_mastery_score: 80,
        questions: [
          {
            id: `q_read_1_${Date.now()}`,
            text: `ما هي الفكرة الرئيسة التي دارت حولها قصة «${targetBook.title}»؟`,
            type: 'multiple_choice',
            options: ['التحلي بالقيم والفضائل الحميدة', 'أهمية التعاون وحب المعرفة', 'الاستفادة من التجارب والعبر'],
            correctAnswer: 'التحلي بالقيم والفضائل الحميدة',
            points: 5
          },
          {
            id: `q_read_2_${Date.now()}`,
            text: `أيّ الشخصيات أو المواقف كان لها التأثير الأبرز في مجريات قصة «${targetBook.title}»؟`,
            type: 'multiple_choice',
            options: ['الشخصية الرئيسية بحكمتها وتصرفها الإيجابي', 'المواقف التحدّية التي تغلب عليها الأبطال', 'العبرة الختامية التي تعلمها الجميع'],
            correctAnswer: 'الشخصية الرئيسية بحكمتها وتصرفها الإيجابي',
            points: 5
          }
        ]
      };
      saveActivity(quizActivity);
    }

    setReadingAssignments(getReadingBookAssignments());
    showToast(`🎉 تم إسناد قصة «${targetBook.title}» بنجاح!`);
    onRefreshData?.();
  };

  const handleDeleteBookAssignment = (id: string) => {
    if (confirm('هل أنت متأكد من إلغاء إسناد هذا الكتاب؟')) {
      deleteReadingBookAssignment(id);
      setReadingAssignments(getReadingBookAssignments());
      showToast('تم حذف التكليف القرائي بنجاح');
      onRefreshData?.();
    }
  };

  // =========================================================================
  // المحور 2: حوكمة الألعاب التكيفية (ألعاب موسى)
  // =========================================================================
  const [gameRules, setGameRules] = useState<GameGovernanceRule[]>(() => getGameGovernanceRules());
  const [gameTargetType, setGameTargetType] = useState<TargetAssignmentType>(initialStudent ? 'individual' : 'class');
  const [gameTargetStudentIds, setGameTargetStudentIds] = useState<string[]>(initialStudent ? [initialStudent.id] : []);
  const [gameDefaultLevel, setGameDefaultLevel] = useState<number>(1);
  const [gameLockSwitcher, setGameLockSwitcher] = useState<boolean>(false);
  const [includeWeeklyQuest, setIncludeWeeklyQuest] = useState<boolean>(true);
  const [questGameType, setQuestGameType] = useState<AIGameType>('vowel_train');
  const [questSkill, setQuestSkill] = useState<string>('قطار الحركات القصيرة والمدود');
  const [questQuestionCount, setQuestQuestionCount] = useState<number>(15);
  const [questMastery, setQuestMastery] = useState<number>(80);
  const [questDueDate, setQuestDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  const handleSaveGameRule = () => {
    if (gameTargetType !== 'class' && gameTargetStudentIds.length === 0) {
      alert('يرجى تحديد الطلاب المستهدفين بحوكمة اللعبة');
      return;
    }

    const newRule: GameGovernanceRule = {
      id: `game_gov_${Date.now()}`,
      teacherId: currentUser.id,
      schoolId: currentUser.school_id,
      grade: selectedGrade,
      targetType: gameTargetType,
      targetStudentIds: gameTargetType !== 'class' ? gameTargetStudentIds : undefined,
      defaultLevel: gameDefaultLevel,
      lockLevelSwitcher: gameLockSwitcher,
      weeklyQuest: includeWeeklyQuest ? {
        gameType: questGameType,
        title: `تحدي أسبوعي: ${questSkill}`,
        targetSkill: questSkill,
        questionCount: questQuestionCount,
        requiredMastery: questMastery,
        dueDate: questDueDate,
      } : undefined,
      updatedAt: new Date().toISOString()
    };

    saveGameGovernanceRule(newRule);
    setGameRules(getGameGovernanceRules());
    showToast('🎮 تم حفظ قواعد حوكمة ألعاب موسى وإسناد التحدي بنجاح!');
    onRefreshData?.();
  };

  const handleDeleteGameRule = (id: string) => {
    deleteGameGovernanceRule(id);
    setGameRules(getGameGovernanceRules());
    showToast('تم حذف قاعدة حوكمة اللعبة');
    onRefreshData?.();
  };

  // =========================================================================
  // المحور 3: جواز السفر اللغوي (CEFR) والمسارات الدولية
  // =========================================================================
  const [cefrStudentId, setCefrStudentId] = useState<string>(initialStudent?.id || teacherStudents[0]?.id || '');
  const targetCefrStudent = useMemo(() => {
    return students.find(s => s.id === cefrStudentId) || teacherStudents[0];
  }, [students, cefrStudentId, teacherStudents]);

  const [cefrOverrides, setCefrOverrides] = useState<CEFROverrideRecord[]>(() => getCEFROverrides());
  const [overrideLevel, setOverrideLevel] = useState<CEFRLevel>('B1.1');
  const [overrideJustification, setOverrideJustification] = useState<string>('');
  const [gatekeeperUnlocked, setGatekeeperUnlocked] = useState<boolean>(true);
  const [targetStudentTrack, setTargetStudentTrack] = useState<ArabicTrack>(targetCefrStudent?.track || 'arabic-a');

  React.useEffect(() => {
    if (targetCefrStudent) {
      setTargetStudentTrack(targetCefrStudent.track || 'arabic-a');
      const pass = getLanguagePassport(targetCefrStudent.id);
      if (pass?.currentCefrLevel) {
        setOverrideLevel(pass.currentCefrLevel);
      }
    }
  }, [targetCefrStudent]);

  const handleSaveCefrOverride = () => {
    if (!targetCefrStudent) return;
    if (!overrideJustification.trim()) {
      alert('يرجى كتابة المبرر الأكاديمي والتوثيق للترقية الاستثنائية');
      return;
    }

    const currentPass = getLanguagePassport(targetCefrStudent.id);
    const prevLevel = currentPass?.currentCefrLevel || 'A1.1';

    const record: CEFROverrideRecord = {
      id: `cefr_ovr_${Date.now()}`,
      studentId: targetCefrStudent.id,
      studentName: targetCefrStudent.name,
      previousLevel: prevLevel,
      overrideLevel: overrideLevel,
      justification: overrideJustification.trim(),
      gatekeeperUnlocked: gatekeeperUnlocked,
      certifiedTrack: targetStudentTrack,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      updatedAt: new Date().toISOString()
    };

    saveCEFROverride(record);
    setCefrOverrides(getCEFROverrides());

    // تحديث جواز السفر الفعلي للطالب فورياً
    if (currentPass) {
      saveLanguagePassport({
        ...currentPass,
        currentCefrLevel: overrideLevel,
        verifiedBy: `المعلم: ${currentUser.name} (ترقية استثنائية موثقة)`,
        validUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0]
      });
    }

    // تحديث مسار الطالب إن تغير
    if (targetCefrStudent.track !== targetStudentTrack) {
      const allUsers = getUsers();
      const updatedUsers = allUsers.map(u => u.id === targetCefrStudent.id ? { ...u, track: targetStudentTrack } : u);
      saveUsers(updatedUsers);
    }

    showToast(`🛂 تم توثيق ترقية المستوى لـ «${targetCefrStudent.name}» إلى (${overrideLevel}) بنجاح!`);
    setOverrideJustification('');
    onRefreshData?.();
  };

  // حوكمة فتح/قفل اختبار العبور للمستوى التالي (Gatekeeper Benchmark)
  const [gkTargetType, setGkTargetType] = useState<TargetAssignmentType>('class');
  const [gkTargetStudentIds, setGkTargetStudentIds] = useState<string[]>(initialStudent ? [initialStudent.id] : []);
  const [gkStatusToSet, setGkStatusToSet] = useState<boolean>(true);

  const handleApplyGatekeeper = () => {
    if (gkTargetType === 'class') {
      setGatekeeperUnlockedForClass(selectedGrade, gkStatusToSet);
      showToast(gkStatusToSet ? `تم فتح اختبار العبور لكافة طلاب الصف (${getGradeLabel(selectedGrade)}) 🔓` : `تم قفل اختبار العبور لطلاب الصف 🔒`);
    } else {
      if (gkTargetStudentIds.length === 0) {
        alert('يرجى تحديد طالب واحد على الأقل لفتح أو قفل اختبار العبور');
        return;
      }
      gkTargetStudentIds.forEach(stId => {
        setGatekeeperUnlockedForStudent(stId, gkStatusToSet);
      });
      showToast(gkStatusToSet ? `تم فتح اختبار العبور لـ (${gkTargetStudentIds.length}) طلاب مستوفين 🔓` : `تم قفل اختبار العبور للطلاب المحددين 🔒`);
    }
    onRefreshData?.();
  };

  // =========================================================================
  // المحور 4: مختبر الطلاقة القرائية (ORF - WCPM)
  // =========================================================================
  const [orfAssignments, setOrfAssignments] = useState<ORFAssignmentTask[]>(() => getORFAssignments());
  const [orfSessions, setOrfSessions] = useState(() => getORFSessions());
  const [orfTargetType, setOrfTargetType] = useState<TargetAssignmentType>(initialStudent ? 'individual' : 'class');
  const [orfTargetStudentIds, setOrfTargetStudentIds] = useState<string[]>(initialStudent ? [initialStudent.id] : []);
  const [selectedOrfPassageId, setSelectedOrfPassageId] = useState<string>(ORF_STANDARD_PASSAGES[0]?.id || '');
  const [orfInstructions, setOrfInstructions] = useState<string>('يرجى تسجيل قراءة هذا النص بصوت واضح ومشكول لاحتساب سرعة الطلاقة (WCPM) ودقة الحركات.');
  const [orfDueDate, setOrfDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });

  const handleAssignORF = () => {
    const passage = ORF_STANDARD_PASSAGES.find(p => p.id === selectedOrfPassageId) || ORF_STANDARD_PASSAGES[0];
    if (!passage) return;

    if (orfTargetType !== 'class' && orfTargetStudentIds.length === 0) {
      alert('يرجى تحديد الطلاب المستهدفين بتكليف الطلاقة القرائية');
      return;
    }

    const task: ORFAssignmentTask = {
      id: `orf_task_${Date.now()}`,
      passageId: passage.id,
      passageTitle: passage.title,
      passageText: passage.text,
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      schoolId: currentUser.school_id,
      grade: selectedGrade,
      targetType: orfTargetType,
      targetStudentIds: orfTargetType !== 'class' ? orfTargetStudentIds : undefined,
      dueDate: orfDueDate,
      instructions: orfInstructions,
      createdAt: new Date().toLocaleDateString('ar-EG')
    };

    saveORFAssignment(task);
    setOrfAssignments(getORFAssignments());
    showToast(`🎙️ تم إسناد مهمة الطلاقة القرائية بنجاح للنص: «${passage.title}»!`);
    onRefreshData?.();
  };

  const handleDeleteOrfAssignment = (id: string) => {
    deleteORFAssignment(id);
    setOrfAssignments(getORFAssignments());
    showToast('تم حذف تكليف الطلاقة القرائية');
    onRefreshData?.();
  };

  // اعتماد وتعديل نبر وتعبير جلسة طالب يدوياً
  const handleUpdateSessionProsody = (sessionId: string, newScore: number) => {
    const session = orfSessions.find(s => s.id === sessionId);
    if (!session) return;
    const updated = {
      ...session,
      prosodyScore: newScore,
      assessorRole: 'teacher_evaluated' as const,
      assessorName: currentUser.name,
    };
    saveORFSession(updated);
    setOrfSessions(getORFSessions());
    showToast('تم تحديث واعتماد تقييم النبر والتعبير للطالب بنجاح ⭐');
    onRefreshData?.();
  };

  // =========================================================================
  // المحور 5: خطط الدعم والتمكين الأكاديمي الفردية (Remedial Plans)
  // =========================================================================
  const [remedialStudentId, setRemedialStudentId] = useState<string>(initialStudent?.id || teacherStudents[0]?.id || '');
  const [remedialSkill, setRemedialSkill] = useState<string>('التفريق بين الحركات القصيرة والمدود الطويلة');
  const [remedialWeakLetters, setRemedialWeakLetters] = useState<string>('أ، و، ي، س، ص');
  const [remedialNotes, setRemedialNotes] = useState<string>('توجد فجوة في التمييز الصوتي بين الفتحة ومد الألف، تتطلب تدريباً علاجياً متكرراً في بيئة خاصة.');
  const [remedialGameType, setRemedialGameType] = useState<AIGameType>('vowel_train');
  const [remedialPlansList, setRemedialPlansList] = useState<RemedialPlan[]>(() => getRemedialPlans());

  const targetRemedialStudent = useMemo(() => {
    return students.find(s => s.id === remedialStudentId) || teacherStudents[0];
  }, [students, remedialStudentId, teacherStudents]);

  const handleCreateRemedialPlan = () => {
    if (!targetRemedialStudent) {
      alert('يرجى تحديد الطالب المستهدف بخطة التمكين');
      return;
    }
    if (!remedialSkill.trim()) {
      alert('يرجى كتابة المهارة أو الفجوة المستهدفة');
      return;
    }

    const letters = remedialWeakLetters.split(/[,،\s]+/).filter(Boolean);
    const plan: RemedialPlan = {
      id: `rem_${Date.now()}`,
      student_id: targetRemedialStudent.id,
      student_name: targetRemedialStudent.name,
      teacher_id: currentUser.id,
      school_id: currentUser.school_id,
      target_skill: remedialSkill.trim(),
      weak_letters: letters,
      recommended_game_type: remedialGameType,
      status: 'in_progress',
      notes: remedialNotes.trim(),
      created_at: new Date().toISOString()
    };

    saveRemedialPlan(plan);
    setRemedialPlansList(getRemedialPlans());

    // إنشاء نشاط علاجي سري مخصص لهذا الطالب فقط
    const remedialActivity: Activity = {
      id: `act_remedial_${Date.now()}`,
      title: `خطة تمكين خاصة: ${remedialSkill.trim()}`,
      description: remedialNotes.trim(),
      activityType: 'worksheet',
      teacherId: currentUser.id,
      teacherName: currentUser.name,
      school_id: currentUser.school_id,
      stage: targetRemedialStudent.stage || 'primary',
      grade: targetRemedialStudent.grade || selectedGrade,
      track: targetRemedialStudent.track || 'arabic-a',
      questions: [
        {
          id: 'rem_q1',
          text: `حدد الكلمة التي تحتوي على (${remedialSkill.trim()}):`,
          type: 'multiple_choice',
          options: ['سَارَ (مد طويل)', 'سَرَ (حركة قصيرة)', 'سِرْ (سكون)'],
          correctAnswer: 'سَارَ (مد طويل)',
          points: 5
        }
      ],
      createdAt: new Date().toLocaleDateString('ar-EG'),
      target_type: 'individual',
      target_student_ids: [targetRemedialStudent.id],
      is_remedial: true,
      min_mastery_score: 80
    };

    saveActivity(remedialActivity);
    showToast(`🛡️ تم إنشاء خطة التمكين العلاجية وإسناد النشاط السري للطالب «${targetRemedialStudent.name}»!`);
    onRefreshData?.();
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden text-right" dir="rtl">
      {/* الترويسة الرئيسية */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 border-b border-indigo-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-300 flex items-center justify-center font-bold text-xl shadow-inner">
            🎛️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white">
                لوحة تحكم وحوكمة المعلم الشاملة (Teacher Control Hub)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                صلاحيات الإسناد والتخصيص
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              تحكم دقيق وشامل على مستوى: <b>الفصل بالكامل</b> • <b>مجموعة طلاب</b> • <b>طالب فردي</b>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* محدد الصف الدراسي */}
          <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 text-xs font-bold">
            <span className="text-slate-300 text-[11px]">الصف:</span>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value as GradeLevel)}
              className="bg-transparent text-white font-black focus:outline-hidden cursor-pointer"
            >
              {allowedGrades.map(g => (
                <option key={g} value={g} className="bg-slate-900 text-white">{getGradeLabel(g)}</option>
              ))}
            </select>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* رسالة التنبيه اللحظية */}
      {toastMsg && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold text-center flex items-center justify-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* شريط التبويبات الخمسة */}
      <div className="bg-slate-100/80 p-2 border-b border-slate-200 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'library'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
          <span>أ. حوكمة رف الكتب والمكتبة 📚</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('games')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'games'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5 text-amber-300" />
          <span>ب. حوكمة ألعاب موسى 🎮</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cefr')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'cefr'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-indigo-300" />
          <span>ج. جواز السفر اللغوي (CEFR) 🛂</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orf')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'orf'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
          }`}
        >
          <Mic className="w-3.5 h-3.5 text-teal-300" />
          <span>د. مختبر الطلاقة القرائية (ORF) 🎙️</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('remedial')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'remedial'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-purple-300" />
          <span>هـ. خطط الدعم والتمكين الفردية 🛡️</span>
        </button>
      </div>

      {/* محتوى التبويبات */}
      <div className="p-5 sm:p-6 bg-slate-50/50 space-y-6">

        {/* ========================================================================= */}
        {/* التبويب 1: حوكمة رف الكتب والمكتبة المصورة */}
        {/* ========================================================================= */}
        {activeTab === 'library' && (
          <div className="space-y-6 animate-fade-in">
            {/* بطاقة التحكم في التصفح المفتوح للرف */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>مفتاح حوكمة التصفح المفتوح لرف الكتب (Open Bookshelf Access Toggle)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    عند إيقاف التصفح المفتوح، لن يرى الطالب إلا القصص المسندة إليه كقراءة موجهة أو تكليف قرائي.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    تصفح الصف بالكامل ({getGradeLabel(selectedGrade)}):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleClassLibrary(!isClassLibraryOpen)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                      isClassLibraryOpen
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {isClassLibraryOpen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    <span>{isClassLibraryOpen ? 'متاح ومفتوح للجميع 🔓' : 'محجوب ومقيد بالتكليفات 🔒'}</span>
                  </button>
                </div>
              </div>

              {/* قائمة الاستثناءات الفردية لطلاب الصف */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-700 block">
                  الاستثناءات الفردية لطلاب الصف (التحكم بالاسم):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {teacherStudents.map(st => {
                    const isStudentOpen = isLibraryOpenForStudent(st.id, selectedGrade, currentUser.school_id);
                    return (
                      <div key={st.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 truncate">{st.name}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleStudentLibrary(st.id, isStudentOpen)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                            isStudentOpen
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {isStudentOpen ? 'مفتوح 🔓' : 'مقفل 🔒'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* أداة إسناد قصة أو تكليف قرائي */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Send className="w-4 h-4 text-indigo-600" />
                <span>إسناد قصة أو تكليف قرائي موجه (Targeted Reading Assignment)</span>
              </h3>

              {/* نوع الإسناد: قراءة حرة موجهة vs نشاط قرائي واجب الحل */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBookAssignmentType('free_reading')}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer ${
                    bookAssignmentType === 'free_reading'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-black'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs block font-black">1. قراءة حرة موجهة (Guided Free Reading)</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">تظهر القصة في رف الطالب للاستمتاع بالقراءة دون أسئلة ملزمة.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBookAssignmentType('interactive_quiz')}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer ${
                    bookAssignmentType === 'interactive_quiz'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-black'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs block font-black">2. نشاط قرائي واجب الحل (Interactive Reading Quiz)</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">قراءة مصحوبة بأسئلة قياس الفهم القرائي وتاريخ تسليم ورصد درجات.</span>
                </button>
              </div>

              {/* اختيار القصة من المكتبة */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">اختر القصة أو الكتاب من المستودع:</label>
                <select
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {books.map(b => (
                    <option key={b.id} value={b.id}>{b.title} {b.author ? `(تأليف: ${b.author})` : ''} - {b.section || 'عام'}</option>
                  ))}
                </select>
              </div>

              {/* أداة الاستهداف الموحدة */}
              <AssignmentTargetSelector
                targetType={bookTargetType}
                onTargetTypeChange={setBookTargetType}
                students={students}
                selectedStudentIds={bookTargetStudentIds}
                onSelectedStudentIdsChange={setBookTargetStudentIds}
                selectedGrade={selectedGrade}
                onGradeChange={setSelectedGrade}
                allowedGrades={allowedGrades}
                label="نطاق إسناد القصة القرائية"
              />

              {/* تفاصيل إضافية */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ملاحظة وتوجيه المعلم للطلاب:</label>
                  <input
                    type="text"
                    value={bookNotes}
                    onChange={(e) => setBookNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
                {bookAssignmentType === 'interactive_quiz' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">تاريخ التسليم النهائي (Due Date):</label>
                    <input
                      type="date"
                      value={bookDueDate}
                      onChange={(e) => setBookDueDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleAssignBook}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>إسناد القصة ونشرها للطلاب المحددين الآن 🚀</span>
              </button>
            </div>

            {/* قائمة التكليفات المسندة حالياً */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-black text-slate-800 block">القصص والتكليفات القرائية المسندة حالياً ({readingAssignments.length}):</h3>
              {readingAssignments.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center font-bold">لم تقم بإسناد أي كتب بعد</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
                  {readingAssignments.map(a => (
                    <div key={a.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">{a.bookTitle}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          <span className={`px-1.5 py-0.2 rounded ${a.assignmentType === 'interactive_quiz' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'bg-emerald-50 text-emerald-700 font-bold'}`}>
                            {a.assignmentType === 'interactive_quiz' ? 'واجب فهم قرائي' : 'قراءة حرة موجهة'}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-slate-600">
                            {a.targetType === 'class' ? `الفصل كاملاً (${getGradeLabel(a.targetGrade || selectedGrade)})` : a.targetType === 'individual' ? `طالب: ${a.targetStudentName || 'محدد'}` : `مجموعة: ${a.targetStudentIds?.length || 0} طلاب`}
                          </span>
                          {a.dueDate && <span>• موعد: {a.dueDate}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBookAssignment(a.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="إلغاء الإسناد"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* التبويب 2: حوكمة الألعاب التكيفية (ألعاب موسى) */}
        {/* ========================================================================= */}
        {activeTab === 'games' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Sliders className="w-4 h-4 text-amber-600" />
                <span>ضبط مستوى الألعاب وقفل التنقل وتعيين التحدي الأسبوعي</span>
              </h3>

              {/* أداة الاستهداف الموحدة */}
              <AssignmentTargetSelector
                targetType={gameTargetType}
                onTargetTypeChange={setGameTargetType}
                students={students}
                selectedStudentIds={gameTargetStudentIds}
                onSelectedStudentIdsChange={setGameTargetStudentIds}
                selectedGrade={selectedGrade}
                onGradeChange={setSelectedGrade}
                allowedGrades={allowedGrades}
                label="نطاق تطبيق قواعد اللعبة والتحدي"
              />

              {/* ضبط المستوى وقفل التنقل */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">المستوى الافتراضي للبدء (1 إلى 6):</label>
                  <select
                    value={gameDefaultLevel}
                    onChange={(e) => setGameDefaultLevel(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    {[1, 2, 3, 4, 5, 6].map(lvl => (
                      <option key={lvl} value={lvl}>المستوى {lvl} {lvl === 1 ? '(تأسيسي صوتي)' : lvl === 6 ? '(بلاغي متقدم)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="text-xs font-bold text-slate-700 block mb-1">حرية تنقل الطالب بين المستويات:</label>
                  <button
                    type="button"
                    onClick={() => setGameLockSwitcher(!gameLockSwitcher)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      gameLockSwitcher
                        ? 'bg-rose-50 border-rose-300 text-rose-900 font-black'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                    }`}
                  >
                    <span>{gameLockSwitcher ? '🔒 تنقل مقفل (ملتزم بالمستوى المحدد)' : '🔓 تنقل حر ومفتوح للطالب'}</span>
                    <span>{gameLockSwitcher ? 'مقفل' : 'متاح'}</span>
                  </button>
                </div>
              </div>

              {/* التحدي الأسبوعي الإلزامي */}
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black text-amber-950">إسناد تحدي لعب أسبوعي إلزامي (Game Quest)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeWeeklyQuest}
                    onChange={(e) => setIncludeWeeklyQuest(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                  />
                </div>

                {includeWeeklyQuest && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs pt-1">
                    <div>
                      <label className="text-slate-600 block mb-1 font-bold">نوع اللعبة:</label>
                      <select
                        value={questGameType}
                        onChange={(e) => setQuestGameType(e.target.value as AIGameType)}
                        className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 font-bold"
                      >
                        <option value="vowel_train">قطار الحركات والمدود 🚂</option>
                        <option value="category_sorter">فرز الظواهر اللغوية 🧺</option>
                        <option value="phonics_treasure">كنز الحروف 💎</option>
                        <option value="letter_blending">معمل دمج الكلمات 🧪</option>
                        <option value="vocab_detective">محقق المفردات 🔍</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1 font-bold">المهارة المستهدفة:</label>
                      <input
                        type="text"
                        value={questSkill}
                        onChange={(e) => setQuestSkill(e.target.value)}
                        className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1 font-bold">نسبة الإتقان المطلوبة:</label>
                      <select
                        value={questMastery}
                        onChange={(e) => setQuestMastery(Number(e.target.value))}
                        className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 font-bold"
                      >
                        <option value={70}>70% (مقبول)</option>
                        <option value={80}>80% (إتقان معياري)</option>
                        <option value={90}>90% (إتقان تام متميز)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-600 block mb-1 font-bold">تاريخ التسليم:</label>
                      <input
                        type="date"
                        value={questDueDate}
                        onChange={(e) => setQuestDueDate(e.target.value)}
                        className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveGameRule}
                className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-black transition shadow-md shadow-amber-600/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <Sliders className="w-4 h-4" />
                <span>حفظ وتطبيق حوكمة الألعاب والتحدي الأسبوعي 🎮</span>
              </button>
            </div>

            {/* قائمة القواعد النشطة */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-black text-slate-800">قواعد حوكمة الألعاب المسجلة ({gameRules.length}):</h3>
              {gameRules.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center font-bold">لا توجد قواعد مخصصة بعد (يطبق الإعداد الافتراضي للجميع)</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
                  {gameRules.map(r => (
                    <div key={r.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">
                          المستوى الافتراضي: {r.defaultLevel} • {r.lockLevelSwitcher ? 'تنقل مقفل 🔒' : 'تنقل حر 🔓'}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          النطاق: {r.targetType === 'class' ? `الفصل كاملاً (${getGradeLabel(r.grade)})` : r.targetType === 'individual' ? 'طالب فردي' : `مجموعة: ${r.targetStudentIds?.length} طلاب`}
                          {r.weeklyQuest && ` • تحدي: ${r.weeklyQuest.title} (مطلوب ${r.weeklyQuest.requiredMastery}%)`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteGameRule(r.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="حذف القاعدة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* التبويب 3: جواز السفر اللغوي (CEFR) والمسارات الدولية */}
        {/* ========================================================================= */}
        {activeTab === 'cefr' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Award className="w-4 h-4 text-indigo-600" />
                <span>الترقية الاستثنائية للمستوى (Manual Level Override) وحوكمة المسارات</span>
              </h3>

              {/* اختيار الطالب */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">اختر الطالب المستهدف بالترقية والتوثيق:</label>
                <select
                  value={cefrStudentId}
                  onChange={(e) => setCefrStudentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {teacherStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.track === 'arabic-b' ? 'عرب B' : 'عرب A'})</option>
                  ))}
                </select>
              </div>

              {/* بطاقة الطالب الحالية وتعديل المسار */}
              {targetCefrStudent && (
                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">الطالب:</span>
                    <span className="font-black text-indigo-950 text-sm">{targetCefrStudent.name}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">المسار المعتمد:</span>
                    <div className="flex items-center gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => setTargetStudentTrack('arabic-a')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                          targetStudentTrack === 'arabic-a' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border'
                        }`}
                      >
                        عرب A (ناطقين)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetStudentTrack('arabic-b')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                          targetStudentTrack === 'arabic-b' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border'
                        }`}
                      >
                        عرب B (غير ناطقين)
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">اختبار العبور (Gatekeeper Benchmark):</span>
                    <button
                      type="button"
                      onClick={() => setGatekeeperUnlocked(!gatekeeperUnlocked)}
                      className={`mt-1 px-3 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                        gatekeeperUnlocked
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {gatekeeperUnlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span>{gatekeeperUnlocked ? 'مفتوح للطالب 🔓' : 'مقفل 🔒'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* المستوى الجديد والمبرر الأكاديمي الإلزامي */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">المستوى الجديد المعتمد (CEFR Level):</label>
                  <select
                    value={overrideLevel}
                    onChange={(e) => setOverrideLevel(e.target.value as CEFRLevel)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="A1.1">A1.1 (تأسيسي مبتدئ أول)</option>
                    <option value="A1.2">A1.2 (تأسيسي مبتدئ ثانٍ)</option>
                    <option value="A2.1">A2.1 (مرحلي أساسي أول)</option>
                    <option value="A2.2">A2.2 (مرحلي أساسي ثانٍ)</option>
                    <option value="B1.1">B1.1 (متوسط واستقلالية أولى)</option>
                    <option value="B1.2">B1.2 (متوسط واستقلالية ثانية)</option>
                    <option value="B2">B2 (كفاءة متقدمة واحترافية)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">المبرر الأكاديمي المكتوب (إلزامي للتوثيق):</label>
                  <input
                    type="text"
                    value={overrideJustification}
                    onChange={(e) => setOverrideJustification(e.target.value)}
                    placeholder="مثال: اجتاز اختبار الكفاءة بدرجة 92% وأظهر طلاقة متقدمة في الفهم القرائي..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveCefrOverride}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black transition shadow-md shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <Award className="w-4 h-4" />
                <span>اعتماد الترقية الاستثنائية وتحديث جواز السفر اللغوي رسمياً 📜</span>
              </button>
            </div>

            {/* سجل الترقيات الموثقة */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-black text-slate-800">سجل الترقيات الاستثنائية الموثقة ({cefrOverrides.length}):</h3>
              {cefrOverrides.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center font-bold">لا توجد ترقيات استثنائية مسجلة بعد</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
                  {cefrOverrides.map(ov => (
                    <div key={ov.id} className="py-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{ov.studentName}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900">
                          {ov.previousLevel || 'سابق'} ➔ {ov.overrideLevel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                        💬 <b>المبرر الأكاديمي:</b> {ov.justification}
                      </p>
                      <span className="text-[10px] text-slate-400 block">
                        المعتمد: {ov.teacherName} • {new Date(ov.updatedAt).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* أداة حوكمة اختبار العبور للمستوى التالي (Unlock Gatekeeper Benchmark) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-emerald-600" />
                    <span>حوكمة اختبار العبور للمستوى التالي (Unlock Gatekeeper Benchmark)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إتاحة أو تقييد اختبار عبور المستوى للطالب أو لمجموعة مستوفية للشروط بعد التأكد من الكفاءة.
                  </p>
                </div>
              </div>

              {/* أداة الاستهداف الموحدة */}
              <AssignmentTargetSelector
                targetType={gkTargetType}
                onTargetTypeChange={setGkTargetType}
                students={students}
                selectedStudentIds={gkTargetStudentIds}
                onSelectedStudentIdsChange={setGkTargetStudentIds}
                selectedGrade={selectedGrade}
                onGradeChange={setSelectedGrade}
                allowedGrades={allowedGrades}
                label="نطاق حوكمة اختبار العبور"
              />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">حالة اختبار العبور المراد تطبيقها:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGkStatusToSet(true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                        gkStatusToSet
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      مفتوح ومتاح للعبور 🔓
                    </button>
                    <button
                      type="button"
                      onClick={() => setGkStatusToSet(false)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                        !gkStatusToSet
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      مقفل ومحجوب 🔒
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleApplyGatekeeper}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
                >
                  <Check className="w-4 h-4" />
                  <span>تطبيق حالة اختبار العبور للمستهدفين</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* التبويب 4: مختبر الطلاقة القرائية (ORF - WCPM) */}
        {/* ========================================================================= */}
        {activeTab === 'orf' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Mic className="w-4 h-4 text-teal-600" />
                <span>تكليف قراءة شفهية مقننة واعتماد تقييمات الطلاقة (WCPM)</span>
              </h3>

              {/* اختيار النص المرجعي */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">اختر النص المرجعي المشكول لاختبار الطلاقة:</label>
                <select
                  value={selectedOrfPassageId}
                  onChange={(e) => setSelectedOrfPassageId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                >
                  {ORF_STANDARD_PASSAGES.map(p => (
                    <option key={p.id} value={p.id}>{p.title} ({p.wordCount} كلمة) - {p.genre === 'heritage' ? 'تراثي' : 'قصصي/علمي'}</option>
                  ))}
                </select>
              </div>

              {/* أداة الاستهداف الموحدة */}
              <AssignmentTargetSelector
                targetType={orfTargetType}
                onTargetTypeChange={setOrfTargetType}
                students={students}
                selectedStudentIds={orfTargetStudentIds}
                onSelectedStudentIdsChange={setOrfTargetStudentIds}
                selectedGrade={selectedGrade}
                onGradeChange={setSelectedGrade}
                allowedGrades={allowedGrades}
                label="نطاق تكليف اختبار الطلاقة القرائية"
              />

              {/* التعليمات والموعد */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">تعليمات وتوجيه القراءة للطالب:</label>
                  <input
                    type="text"
                    value={orfInstructions}
                    onChange={(e) => setOrfInstructions(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">تاريخ التسليم الأخير:</label>
                  <input
                    type="date"
                    value={orfDueDate}
                    onChange={(e) => setOrfDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAssignORF}
                className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-black transition shadow-md shadow-teal-600/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <Mic className="w-4 h-4" />
                <span>إسناد مهمة الطلاقة القرائية للطلاب المحددين الآن 🎙️</span>
              </button>
            </div>

            {/* سجل جلسات الطلاقة واعتماد درجات النبر والتعبير Prosody يدوياً */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-black text-slate-800">
                جلسات القراءة المسجلة بانتظار الاعتماد وتعديل النبر ({orfSessions.length}):
              </h3>

              {orfSessions.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center font-bold">لا توجد تسجيلات طلاقة مسجلة حتى الآن</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                  {orfSessions.map(session => (
                    <div key={session.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{session.studentName}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            {session.wcpm} WCPM (دقة {session.accuracyRate}%)
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          النص: «{session.passageTitle}» • الزمن: {session.durationSeconds} ثانية • {new Date(session.date).toLocaleDateString('ar-EG')}
                        </span>
                        {session.audioUrl && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-slate-500 font-bold">🎧 تسجيل الطالب:</span>
                            <audio src={session.audioUrl} controls className="h-6 w-44 rounded-md" />
                          </div>
                        )}
                        {session.assessorRole === 'teacher_evaluated' && (
                          <span className="inline-block mt-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            ✓ معتمد من المعلم: {session.assessorName}
                          </span>
                        )}
                      </div>

                      {/* تعديل نجوم النبر والتعبير يدوياً من المعلم */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500">النبر والتعبير:</span>
                        <div className="flex items-center gap-0.5 text-amber-500">
                          {[1, 2, 3, 4].map(star => (
                            <Star
                              key={star}
                              onClick={() => handleUpdateSessionProsody(session.id, star)}
                              className={`w-4 h-4 cursor-pointer transition ${star <= (session.prosodyScore || 3) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* التبويب 5: خطط الدعم والتمكين الأكاديمي الفردية */}
        {/* ========================================================================= */}
        {activeTab === 'remedial' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <ShieldAlert className="w-4 h-4 text-purple-600" />
                <span>إسناد خطة علاجية وتمكين فردي سري (Remedial & Support Plan)</span>
              </h3>
              <p className="text-xs text-slate-500">
                الأنشطة المسندة هنا تظهر <b>فقط للطالب المستهدف</b> ولا يراها بقية طلاب الفصل لحماية الخصوصية النفسية والتربوية.
              </p>

              {/* اختيار الطالب */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">اختر الطالب المستهدف بالخطة العلاجية:</label>
                <select
                  value={remedialStudentId}
                  onChange={(e) => setRemedialStudentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                >
                  {teacherStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* المهارة والحروف المستهدفة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">المهارة أو الفجوة المستهدفة بالتمكين:</label>
                  <input
                    type="text"
                    value={remedialSkill}
                    onChange={(e) => setRemedialSkill(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">الحروف أو الظواهر المتعثر فيها:</label>
                  <input
                    type="text"
                    value={remedialWeakLetters}
                    onChange={(e) => setRemedialWeakLetters(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* اللعبة التمكينية المقترحة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">اللعبة التكيفية المقترحة للتدريب:</label>
                  <select
                    value={remedialGameType}
                    onChange={(e) => setRemedialGameType(e.target.value as AIGameType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="vowel_train">قطار الحركات والمدود 🚂</option>
                    <option value="phonics_treasure">كنز الحروف والصوتيات 💎</option>
                    <option value="letter_blending">معمل دمج المقاطع والحروف 🧪</option>
                    <option value="category_sorter">فرز الظواهر والهمزات 🧺</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">ملاحظات التشخيص التربوي:</label>
                  <input
                    type="text"
                    value={remedialNotes}
                    onChange={(e) => setRemedialNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateRemedialPlan}
                className="w-full py-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl text-xs font-black transition shadow-md shadow-purple-700/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>إنشاء خطة التمكين وإسناد النشاط السري للطالب 🛡️</span>
              </button>
            </div>

            {/* خطط التمكين المنشأة */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-black text-slate-800">خطط التمكين العلاجية النشطة ({remedialPlansList.length}):</h3>
              {remedialPlansList.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center font-bold">لا توجد خطط تمكين مسجلة بعد</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
                  {remedialPlansList.map(plan => (
                    <div key={plan.id} className="py-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{plan.student_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-900">
                          {plan.target_skill}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                        📋 <b>ملاحظة المعلم:</b> {plan.notes}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
