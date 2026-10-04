import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, 
  X, RefreshCw, Users, Building2, KeyRound, ArrowRight, ShieldCheck, 
  GraduationCap, BookOpen, Layers
} from 'lucide-react';
import { School, UserProfile, SchoolStage, GradeLevel, ArabicTrack } from '../types';
import { saveSchool, saveUser, getUsers } from '../storage';
import { supabase } from '../supabaseClient';

interface BulkSchoolOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (school: School) => void;
}

interface ParsedTeacher {
  name: string;
  username: string;
  password: string;
  allowedGrades: GradeLevel[];
  allowedTracks: ArabicTrack[];
}

interface ParsedStudent {
  name: string;
  username: string;
  password: string;
  stage: SchoolStage;
  grade: GradeLevel;
  track: ArabicTrack;
}

interface ParsedClass {
  name: string;
  stage: SchoolStage;
  grade: GradeLevel;
  track: ArabicTrack;
}

export const BulkSchoolOnboardingModal: React.FC<BulkSchoolOnboardingModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parsed State
  const [parsedSchool, setParsedSchool] = useState<{
    name: string;
    slug: string;
    plan_tier: 'trial' | 'annual';
    durationDays: number;
    max_students: number;
    adminName: string;
    adminUsername: string;
    adminPassword: string;
    adminEmail?: string;
  } | null>(null);

  const [parsedTeachers, setParsedTeachers] = useState<ParsedTeacher[]>([]);
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [parsedClasses, setParsedClasses] = useState<ParsedClass[]>([]);

  // Step state
  const [activePreviewTab, setActivePreviewTab] = useState<'summary' | 'teachers' | 'students' | 'classes'>('summary');
  const [completedCredentials, setCompletedCredentials] = useState<Array<{ name: string; username: string; role: string; password: string }> | null>(null);

  if (!isOpen) return null;

  // 1. تنزيل نموذج الإكسيل الاسترشادي (Download Sample Excel Template)
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: بيانات المدرسة والمدير
    const schoolData = [
      ['اسم المدرسة', 'المعرف النصي (slug)', 'نوع الخطة (trial/annual)', 'مدة الاشتراك بالأيام', 'الحد الأقصى للطلاب', 'اسم المدير', 'اسم مستخدم المدير', 'كلمة سر المدير', 'بريد المدير'],
      ['أكاديمية الفرسان العالمية', 'al-fursan-academy', 'annual', 365, 500, 'أ. عبد الرحمن الغامدي', 'fursan_admin', '123456', 'admin@fursan.edu.sa']
    ];
    const wsSchool = XLSX.utils.aoa_to_sheet(schoolData);
    XLSX.utils.book_append_sheet(wb, wsSchool, 'بيانات المدرسة والمدير');

    // Sheet 2: المعلمون
    const teachersData = [
      ['الاسم الكامل', 'اسم المستخدم', 'كلمة المرور', 'الصفوف المصرح بها (مفصولة بفواصل)', 'المسار (arabic-a أو arabic-b)'],
      ['أ. مريم السعيد', 'teacher_maryam', '123456', 'grade-1, grade-2', 'arabic-a'],
      ['أ. طارق عبد الله', 'teacher_tariq', '123456', 'grade-3, grade-4', 'arabic-a, arabic-b'],
      ['أ. هبة يوسف', 'teacher_heba', '123456', 'grade-5, grade-6', 'arabic-a']
    ];
    const wsTeachers = XLSX.utils.aoa_to_sheet(teachersData);
    XLSX.utils.book_append_sheet(wb, wsTeachers, 'المعلمون');

    // Sheet 3: الطلاب
    const studentsData = [
      ['الاسم الكامل', 'اسم المستخدم', 'كلمة المرور', 'المرحلة (primary/middle/high)', 'الصف (grade-1 إلى grade-12)', 'المسار (arabic-a/arabic-b)'],
      ['موسى البطل 🌟', 'student_mousa', '123', 'primary', 'grade-1', 'arabic-a'],
      ['سارة أحمد', 'student_sara', '123', 'primary', 'grade-1', 'arabic-a'],
      ['عمر خالد', 'student_omar', '123', 'primary', 'grade-2', 'arabic-a'],
      ['يوسف محمود', 'student_youssef', '123', 'primary', 'grade-2', 'arabic-b'],
      ['ليلى المنصور', 'student_layla', '123', 'primary', 'grade-3', 'arabic-a']
    ];
    const wsStudents = XLSX.utils.aoa_to_sheet(studentsData);
    XLSX.utils.book_append_sheet(wb, wsStudents, 'الطلاب');

    // Sheet 4: الفصول
    const classesData = [
      ['اسم الفصل', 'المرحلة', 'الصف', 'المسار'],
      ['الصف الأول (أ) - براعم الفصحى', 'primary', 'grade-1', 'arabic-a'],
      ['الصف الثاني (أ) - رواد المعرفة', 'primary', 'grade-2', 'arabic-a'],
      ['الصف الثاني (ب) - جسور اللغات', 'primary', 'grade-2', 'arabic-b']
    ];
    const wsClasses = XLSX.utils.aoa_to_sheet(classesData);
    XLSX.utils.book_append_sheet(wb, wsClasses, 'الفصول');

    XLSX.writeFile(wb, 'نموذج_إضافة_مدرسة_مجمعة_تعلّم_مع_موسى.xlsx');
  };

  // 2. قراءة وتحليل ملف الإكسيل المرفوع
  const handleFile = async (file: File) => {
    setParsing(true);
    setParseError(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      // قراءة الورقة الأولى (بيانات المدرسة والمدير)
      const schoolSheetName = wb.SheetNames.find(n => n.includes('مدرسة') || n.toLowerCase().includes('school')) || wb.SheetNames[0];
      const schoolRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[schoolSheetName], { header: 1 });

      if (schoolRows.length < 2) {
        throw new Error('لم يتم العثور على صفوف بيانات المدرسة في ورقة "بيانات المدرسة والمدير"');
      }

      const row = schoolRows[1];
      const schoolName = String(row[0] || '').trim();
      const rawSlug = String(row[1] || '').trim().toLowerCase().replace(/\s+/g, '-');
      const planTier: 'trial' | 'annual' = String(row[2] || '').toLowerCase().includes('trial') ? 'trial' : 'annual';
      const durationDays = Number(row[3]) || (planTier === 'trial' ? 30 : 365);
      const maxStudents = Number(row[4]) || 500;
      const adminName = String(row[5] || `مدير ${schoolName}`).trim();
      const adminUsername = String(row[6] || (rawSlug ? `${rawSlug}_admin` : 'school_admin')).trim();
      const adminPassword = String(row[7] || '123456').trim();
      const adminEmail = row[8] ? String(row[8]).trim() : undefined;

      if (!schoolName) {
        throw new Error('اسم المدرسة مطلوب في الورقة الأولى');
      }

      setParsedSchool({
        name: schoolName,
        slug: rawSlug || schoolName.toLowerCase().replace(/\s+/g, '-'),
        plan_tier: planTier,
        durationDays,
        max_students: maxStudents,
        adminName,
        adminUsername,
        adminPassword,
        adminEmail
      });

      // قراءة ورقة المعلمين
      const teachersSheetName = wb.SheetNames.find(n => n.includes('معلم') || n.toLowerCase().includes('teacher'));
      const teachersList: ParsedTeacher[] = [];
      if (teachersSheetName && wb.Sheets[teachersSheetName]) {
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[teachersSheetName], { header: 1 });
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r[0]) continue;
          const name = String(r[0]).trim();
          const username = String(r[1] || `t_${i}`).trim();
          const password = String(r[2] || '123456').trim();
          const gradesStr = String(r[3] || 'grade-1');
          const allowedGrades = gradesStr.split(/[,،]/).map(g => g.trim() as GradeLevel).filter(Boolean);
          const tracksStr = String(r[4] || 'arabic-a');
          const allowedTracks = tracksStr.split(/[,،]/).map(t => t.trim() as ArabicTrack).filter(Boolean);

          teachersList.push({
            name,
            username,
            password,
            allowedGrades: allowedGrades.length > 0 ? allowedGrades : ['grade-1'],
            allowedTracks: allowedTracks.length > 0 ? allowedTracks : ['arabic-a']
          });
        }
      }
      setParsedTeachers(teachersList);

      // قراءة ورقة الطلاب
      const studentsSheetName = wb.SheetNames.find(n => n.includes('طالب') || n.toLowerCase().includes('student'));
      const studentsList: ParsedStudent[] = [];
      if (studentsSheetName && wb.Sheets[studentsSheetName]) {
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[studentsSheetName], { header: 1 });
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r[0]) continue;
          const name = String(r[0]).trim();
          const username = String(r[1] || `s_${i}`).trim();
          const password = String(r[2] || '123').trim();
          const stage = (r[3] ? String(r[3]).trim() : 'primary') as SchoolStage;
          const grade = (r[4] ? String(r[4]).trim() : 'grade-1') as GradeLevel;
          const track = (r[5] ? String(r[5]).trim() : 'arabic-a') as ArabicTrack;

          studentsList.push({
            name,
            username,
            password,
            stage,
            grade,
            track
          });
        }
      }
      setParsedStudents(studentsList);

      // قراءة ورقة الفصول
      const classesSheetName = wb.SheetNames.find(n => n.includes('فصل') || n.toLowerCase().includes('class'));
      const classesList: ParsedClass[] = [];
      if (classesSheetName && wb.Sheets[classesSheetName]) {
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[classesSheetName], { header: 1 });
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r[0]) continue;
          const name = String(r[0]).trim();
          const stage = (r[1] ? String(r[1]).trim() : 'primary') as SchoolStage;
          const grade = (r[2] ? String(r[2]).trim() : 'grade-1') as GradeLevel;
          const track = (r[3] ? String(r[3]).trim() : 'arabic-a') as ArabicTrack;

          classesList.push({ name, stage, grade, track });
        }
      }
      setParsedClasses(classesList);

    } catch (err: any) {
      console.error('Excel parse error:', err);
      setParseError(err.message || 'حدث خطأ أثناء قراءة ملف الإكسيل. يرجى التأكد من تطابق بنية الملف مع النموذج الاسترشادي.');
    } finally {
      setParsing(false);
    }
  };

  // 3. تنفيذ إنشاء المنظومة كاملة وربطها بالمدرسة
  const handleExecuteOnboarding = async () => {
    if (!parsedSchool) return;
    setProcessing(true);

    try {
      const schoolId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `school_${Date.now()}`;
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + parsedSchool.durationDays * 86400000).toISOString();

      const newSchool: School = {
        id: schoolId,
        name: parsedSchool.name,
        slug: parsedSchool.slug,
        status: 'active',
        plan_tier: parsedSchool.plan_tier,
        subscription_start_date: startDate,
        subscription_end_date: endDate,
        ai_enabled: true,
        max_students: Math.max(parsedSchool.max_students, parsedStudents.length + 50),
        created_at: new Date().toISOString()
      };

      // 1. حفظ المدرسة
      await saveSchool(newSchool);

      const credentialsList: Array<{ name: string; username: string; role: string; password: string }> = [];

      // 2. إنشاء حساب مدير المدرسة
      const adminUser: UserProfile = {
        id: `usr_adm_${Date.now()}`,
        name: parsedSchool.adminName,
        username: parsedSchool.adminUsername,
        password: parsedSchool.adminPassword,
        email: parsedSchool.adminEmail,
        role: 'school_admin',
        school_id: schoolId,
        allowedStages: ['primary', 'middle', 'high'],
        allowedGrades: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6'],
        allowedTracks: ['arabic-a', 'arabic-b'],
        loginCount: 0
      };
      await saveUser(adminUser);
      credentialsList.push({
        name: adminUser.name,
        username: adminUser.username,
        role: 'مدير المدرسة (School Admin)',
        password: adminUser.password || ''
      });

      // 3. إنشاء حسابات المعلمين
      for (let i = 0; i < parsedTeachers.length; i++) {
        const t = parsedTeachers[i];
        const teacherUser: UserProfile = {
          id: `usr_t_${Date.now()}_${i}`,
          name: t.name,
          username: t.username,
          password: t.password,
          role: 'teacher',
          school_id: schoolId,
          allowedStages: ['primary'],
          allowedGrades: t.allowedGrades,
          allowedTracks: t.allowedTracks,
          loginCount: 0
        };
        await saveUser(teacherUser);
        credentialsList.push({
          name: teacherUser.name,
          username: teacherUser.username,
          role: 'معلم (Teacher)',
          password: teacherUser.password || ''
        });
      }

      // 4. إنشاء حسابات الطلاب
      for (let i = 0; i < parsedStudents.length; i++) {
        const s = parsedStudents[i];
        const studentUser: UserProfile = {
          id: `usr_s_${Date.now()}_${i}`,
          name: s.name,
          username: s.username,
          password: s.password,
          role: 'student',
          school_id: schoolId,
          stage: s.stage,
          grade: s.grade,
          track: s.track,
          loginCount: 0
        };
        await saveUser(studentUser);
        credentialsList.push({
          name: studentUser.name,
          username: studentUser.username,
          role: 'طالب (Student)',
          password: studentUser.password || ''
        });
      }

      // 5. حفظ الفصول في Supabase
      if (parsedClasses.length > 0) {
        try {
          const classesPayload = parsedClasses.map((c, idx) => ({
            id: `cls_${Date.now()}_${idx}`,
            school_id: schoolId,
            name: c.name,
            stage: c.stage,
            grade: c.grade,
            track: c.track
          }));
          await supabase.from('classes').insert(classesPayload);
        } catch (e) {
          console.warn('Classes insert error:', e);
        }
      }

      setCompletedCredentials(credentialsList);
      onSuccess(newSchool);
    } catch (err: any) {
      setParseError(err.message || 'حدث خطأ أثناء تأسيس المدرسة');
    } finally {
      setProcessing(false);
    }
  };

  // 4. تنزيل كشف بيانات الدخول (Download Generated Credentials)
  const handleDownloadCredentials = () => {
    if (!completedCredentials || !parsedSchool) return;

    const wb = XLSX.utils.book_new();
    const rows = [
      ['اسم المستخدم', 'اسم الدخول (Username)', 'الدور في المنظومة', 'كلمة المرور الافتراضية', 'المدرسة التابع لها'],
      ...completedCredentials.map(c => [c.name, c.username, c.role, c.password, parsedSchool.name])
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'بيانات الدخول الرسمية');
    XLSX.writeFile(wb, `بيانات_دخول_${parsedSchool.slug}_تعلّم_مع_موسى.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-600/20 text-white">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">
                إضافة مدرسة مجمعة عبر Excel (Bulk Onboarding)
              </h2>
              <p className="text-xs text-slate-400">
                رفع ملف إكسيل واحد لتأسيس المدرسة، حساب المدير، الفصول، وكافة المعلمين والطلاب بربط تلقائي
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Upload or Template if no parsed data */}
        {!parsedSchool && !completedCredentials && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-slate-900 p-5 rounded-2xl border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="font-extrabold text-sm text-emerald-200">النموذج الاسترشادي المعتمد</h4>
                  <p className="text-xs text-slate-400">حمل قالب الإكسيل الجاهز واملأ أوراق: (المدرسة، المعلمين، الطلاب، الفصول)</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-600/20 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>تحميل قالب Excel (.xlsx)</span>
              </button>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                dragActive 
                  ? 'border-emerald-500 bg-emerald-500/10' 
                  : 'border-slate-700 bg-slate-800/40 hover:bg-slate-800/80 hover:border-slate-600'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />

              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Upload className="w-8 h-8" />
              </div>

              <div>
                <span className="font-bold text-base text-white block mb-1">
                  اسحب وأفلت ملف الإكسيل هنا أو انقر للتصفح
                </span>
                <span className="text-xs text-slate-400">
                  يدعم صيغ Excel الرسمية (.xlsx, .xls)
                </span>
              </div>

              {parsing && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold mt-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جارٍ فحص وتحليل جداول الملف...</span>
                </div>
              )}
            </div>

            {parseError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Parsed Preview Screen */}
        {parsedSchool && !completedCredentials && (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">اسم المدرسة</span>
                <span className="text-sm font-black text-white truncate block">{parsedSchool.name}</span>
                <span className="text-[10px] text-emerald-400 font-mono">{parsedSchool.slug}</span>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">حساب مدير المدرسة</span>
                <span className="text-sm font-black text-indigo-300 truncate block">{parsedSchool.adminName}</span>
                <span className="text-[10px] text-slate-400 font-mono">@{parsedSchool.adminUsername}</span>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">المعلمون المكتشفون</span>
                <span className="text-2xl font-black text-emerald-400">{parsedTeachers.length}</span>
                <span className="text-[10px] text-slate-400 block">معلم ومعلمة</span>
              </div>

              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">الطلاب المكتشفون</span>
                <span className="text-2xl font-black text-teal-400">{parsedStudents.length}</span>
                <span className="text-[10px] text-slate-400 block">طالب وطالبة</span>
              </div>
            </div>

            {/* Preview Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActivePreviewTab('summary')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activePreviewTab === 'summary' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                تفاصيل الاشتراك والمدير
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab('teachers')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activePreviewTab === 'teachers' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>المعلمون ({parsedTeachers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab('students')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activePreviewTab === 'students' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>الطلاب ({parsedStudents.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab('classes')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activePreviewTab === 'classes' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>الفصول ({parsedClasses.length})</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 max-h-60 overflow-y-auto">
              {activePreviewTab === 'summary' && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold">باقة الاشتراك المحددة:</span>
                    <span className="font-extrabold text-white">{parsedSchool.plan_tier === 'trial' ? 'فترة تجريبية (Trial)' : 'اشتراك سنوي كامل (Annual)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">مدة الصلاحية:</span>
                    <span className="font-extrabold text-emerald-400">{parsedSchool.durationDays} يوم</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">اسم المدير:</span>
                    <span className="font-extrabold text-white">{parsedSchool.adminName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">اسم الدخول وكلمة المرور:</span>
                    <span className="font-mono text-indigo-300 font-bold">{parsedSchool.adminUsername} / {parsedSchool.adminPassword}</span>
                  </div>
                </div>
              )}

              {activePreviewTab === 'teachers' && (
                <div className="space-y-2">
                  {parsedTeachers.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                      <div>
                        <span className="font-bold text-white block">{t.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{t.username} • {t.password}</span>
                      </div>
                      <div className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md font-bold">
                        {t.allowedGrades.join(', ')} ({t.allowedTracks.join(', ')})
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activePreviewTab === 'students' && (
                <div className="space-y-2">
                  {parsedStudents.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                      <div>
                        <span className="font-bold text-white block">{s.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{s.username} • {s.password}</span>
                      </div>
                      <div className="text-[10px] text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-md font-bold">
                        {s.grade} • {s.track}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activePreviewTab === 'classes' && (
                <div className="space-y-2">
                  {parsedClasses.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                      <span className="font-bold text-white">{c.name}</span>
                      <span className="text-[10px] text-slate-400">{c.stage} / {c.grade} / {c.track}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setParsedSchool(null); setParseError(null); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                رفع ملف آخر
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={handleExecuteOnboarding}
                  className="py-2.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-extrabold rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-600/30"
                >
                  {processing && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>تأكيد وإنشاء المدرسة والحسابات ({parsedTeachers.length + parsedStudents.length + 1} مستخدم)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Success & Download Credentials */}
        {completedCredentials && parsedSchool && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white mb-1">
                تم تأسيس مدرسة "{parsedSchool.name}" بنجاح! 🎉
              </h3>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                تم إنشاء المنظومة كاملة، حساب مدير المدرسة، {parsedTeachers.length} حساب معلم، و {parsedStudents.length} حساب طالب، مع ربطهم تلقائياً بـ school_id المشفر.
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 max-w-lg mx-auto text-xs text-right space-y-2">
              <span className="font-bold text-slate-300 block mb-1">ملخص بيانات المدرسة المؤسسة:</span>
              <div className="flex justify-between text-slate-400">
                <span>المعرّف النصي (slug):</span>
                <span className="font-mono text-emerald-400 font-bold">{parsedSchool.slug}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>حساب المدير المسؤول:</span>
                <span className="font-bold text-indigo-300">@{parsedSchool.adminUsername}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>إجمالي الحسابات المنشأة:</span>
                <span className="font-bold text-white">{completedCredentials.length} حساب</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadCredentials}
                className="py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-extrabold rounded-xl text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-600/30"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل كشف بيانات الدخول الرسمية (Excel)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition"
              >
                إغلاق والعودة للوحة المدارس
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
