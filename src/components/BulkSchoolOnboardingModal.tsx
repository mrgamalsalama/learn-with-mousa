import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, 
  X, RefreshCw, Users, Building2, KeyRound, ArrowRight, ShieldCheck, 
  GraduationCap, BookOpen, Layers
} from 'lucide-react';
import { School, UserProfile, SchoolStage, GradeLevel, ArabicTrack, getStageForGrade } from '../types';
import { saveSchool, saveUser, getUsers, generateUniqueUsername } from '../storage';
import { supabase, generateValidUUID } from '../supabaseClient';
import { mapTextToGradeId } from '../utils/gradebookExport';

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

  // 1. تنزيل نموذج الإكسيل الاسترشادي الشامل المعتمد لـ Supabase (Classes, Teachers, Students, Staff, Lookups)
  const handleDownloadTemplate = () => {
    try {
      const link = document.createElement('a');
      link.href = '/templates/school_onboarding_template.xlsx';
      link.download = 'قالب_استيراد_بيانات_المدرسة_الشامل_موسى.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.location.href = '/templates/school_onboarding_template.xlsx';
    }
  };

  // 2. قراءة وتحليل ملف الإكسيل المرفوع
  const handleFile = async (file: File) => {
    setParsing(true);
    setParseError(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      // قراءة الورقة الأولى (بيانات المدرسة والمدير)
      // 1. تحديد بيانات المدرسة والمدير
      let schoolName = 'مدرسة الأجيال الأهلية';
      let rawSlug = 'al-ajyal-school';
      let planTier: 'trial' | 'annual' = 'annual';
      let durationDays = 365;
      let maxStudents = 500;
      let adminName = 'أ. عبد الله الراشد';
      let adminUsername = 'school_admin';
      let adminPassword = '123456';
      let adminEmail: string | undefined = 'admin@school.edu.sa';

      // فحص ورقة بيانات المدرسة المخصصة (إن وجدت)
      const dedicatedSchoolSheet = wb.SheetNames.find(n => n.includes('مدرسة') || n.toLowerCase().includes('school'));
      if (dedicatedSchoolSheet && wb.Sheets[dedicatedSchoolSheet]) {
        const schoolRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[dedicatedSchoolSheet], { header: 1 });
        if (schoolRows.length >= 2) {
          const row = schoolRows[1];
          if (row && row[0]) {
            schoolName = String(row[0] || schoolName).trim();
            rawSlug = String(row[1] || schoolName.toLowerCase().replace(/\s+/g, '-')).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
            planTier = String(row[2] || '').toLowerCase().includes('trial') ? 'trial' : 'annual';
            durationDays = Number(row[3]) || (planTier === 'trial' ? 30 : 365);
            maxStudents = Number(row[4]) || 500;
            adminName = String(row[5] || `مدير ${schoolName}`).trim();
            adminUsername = String(row[6] || (rawSlug ? `${rawSlug}_admin` : 'school_admin')).trim();
            adminPassword = String(row[7] || '123456').trim();
            adminEmail = row[8] ? String(row[8]).trim() : undefined;
          }
        }
      } else {
        // فحص ورقة Staff_Admin للبحث عن مدير المدرسة في النموذج الشامل القياسي
        const staffSheet = wb.SheetNames.find(n => n.toLowerCase().includes('staff') || n.includes('إدارة') || n.includes('ادارة'));
        if (staffSheet && wb.Sheets[staffSheet]) {
          const staffRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[staffSheet], { header: 1 });
          for (let i = 1; i < staffRows.length; i++) {
            const r = staffRows[i];
            if (!r || !r[0]) continue;
            if (String(r[0]).includes('staff_id') || String(r[0]).includes('معرف')) continue;
            const role = String(r[6] || r[4] || '').toLowerCase();
            if (role.includes('admin') || role.includes('principal') || role.includes('مدير')) {
              adminName = String(r[4] || r[2] || adminName).trim();
              adminEmail = r[5] ? String(r[5]).trim() : adminEmail;
              adminUsername = adminEmail ? adminEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_') : 'admin_school';
              schoolName = `مدرسة ${adminName.replace(/أ\.|د\.|المدير/g, '').trim()} النموذجية`;
              rawSlug = adminUsername.replace(/_admin|admin_/g, '') || 'mousa-school';
              break;
            }
          }
        }
      }

      setParsedSchool({
        name: schoolName,
        slug: rawSlug || 'school-demo',
        plan_tier: planTier,
        durationDays,
        max_students: maxStudents,
        adminName,
        adminUsername,
        adminPassword,
        adminEmail
      });

      // 2. قراءة ورقة المعلمين (Teachers)
      const teachersSheetName = wb.SheetNames.find(n => n.includes('معلم') || n.toLowerCase().includes('teacher'));
      const teachersList: ParsedTeacher[] = [];
      if (teachersSheetName && wb.Sheets[teachersSheetName]) {
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[teachersSheetName], { header: 1 });
        const isStandard = rows[0] && String(rows[0][0]).toLowerCase().includes('teacher_id');
        const startIdx = isStandard ? 2 : 1; // تخطي الصفين الفني والوصفي إن وُجدا

        for (let i = startIdx; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r[0]) continue;
          if (String(r[0]).includes('معرف') || String(r[0]).includes('teacher_id') || String(r[0]).includes('الاسم')) continue;

          if (isStandard) {
            // هيكل جدول المعلمين التقني: col 0: teacher_id, col 4: full_name_ar, col 6: email, col 11: assigned_classes
            const name = String(r[4] || `${r[2] || ''} ${r[3] || ''}` || r[0]).trim();
            const email = r[6] ? String(r[6]).trim() : '';
            const username = email ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_') : `t_${r[0]}`.toLowerCase();
            const password = '123';
            const gradesStr = String(r[11] || 'grade-1');
            const allowedGrades = gradesStr.split(/[,،]/).map(g => g.trim() as GradeLevel).filter(Boolean);

            teachersList.push({
              name,
              username,
              password,
              allowedGrades: allowedGrades.length > 0 ? allowedGrades : ['grade-1'],
              allowedTracks: ['arabic-a']
            });
          } else {
            // الهيكل البسيط القديم
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
      }
      setParsedTeachers(teachersList);

      // 3. قراءة ورقة الطلاب (Students)
      const studentsSheetName = wb.SheetNames.find(n => n.includes('طالب') || n.includes('طلاب') || n.toLowerCase().includes('student'));
      const studentsList: ParsedStudent[] = [];
      if (studentsSheetName && wb.Sheets[studentsSheetName]) {
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[studentsSheetName], { header: 1 });
        const isStandard = rows[0] && String(rows[0][0]).toLowerCase().includes('student_id');
        const startIdx = isStandard ? 2 : 1;

        for (let i = startIdx; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r[0]) continue;
          if (String(r[0]).includes('الرقم') || String(r[0]).includes('student_id') || String(r[0]).includes('الاسم')) continue;

          if (isStandard) {
            // هيكل جدول الطلاب التقني: col 0: student_id, col 4: full_name_ar, col 7: grade_level, col 10: track
            const name = String(r[4] || `${r[2] || ''} ${r[3] || ''}` || r[0]).trim();
            const username = String(r[0]).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            const password = '123';
            const gradeRaw = String(r[7] || 'Grade 1');
            const grade = mapTextToGradeId(gradeRaw);
            const stage = getStageForGrade(grade);
            const track = (String(r[10] || '').toLowerCase().includes('b') ? 'arabic-b' : 'arabic-a') as ArabicTrack;

            studentsList.push({ name, username, password, stage, grade, track });
          } else {
            const name = String(r[0]).trim();
            const username = String(r[1] || `s_${i}`).trim();
            const password = String(r[2] || '123').trim();
            const stage = (r[3] ? String(r[3]).trim() : 'primary') as SchoolStage;
            const grade = (r[4] ? String(r[4]).trim() : 'grade-1') as GradeLevel;
            const track = (r[5] ? String(r[5]).trim() : 'arabic-a') as ArabicTrack;

            studentsList.push({ name, username, password, stage, grade, track });
          }
        }
      }
      setParsedStudents(studentsList);

      // 4. قراءة ورقة الفصول (Classes_Grades)
      const classesSheetName = wb.SheetNames.find(n => n.includes('فصل') || n.includes('فصول') || n.toLowerCase().includes('class'));
      const classesList: ParsedClass[] = [];
      if (classesSheetName && wb.Sheets[classesSheetName]) {
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[classesSheetName], { header: 1 });
        const isStandard = rows[0] && String(rows[0][0]).toLowerCase().includes('class_id');
        const startIdx = isStandard ? 2 : 1;

        for (let i = startIdx; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r[0]) continue;
          if (String(r[0]).includes('معرف') || String(r[0]).includes('class_id') || String(r[0]).includes('اسم')) continue;

          if (isStandard) {
            // هيكل الفصول التقني: col 0: class_id, col 2: class_name_ar, col 3: stage, col 4: grade_level, col 5: track
            const name = String(r[2] || r[0]).trim();
            const stage = (r[3] ? String(r[3]).trim() : 'primary') as SchoolStage;
            const gradeRaw = String(r[4] || 'Grade 1');
            const grade = (gradeRaw.toLowerCase().includes('kg') ? 'kg' : 
                          gradeRaw.includes('2') ? 'grade-2' : 
                          gradeRaw.includes('3') ? 'grade-3' : 'grade-1') as GradeLevel;
            const track = (String(r[5] || '').toLowerCase().includes('b') ? 'arabic-b' : 'arabic-a') as ArabicTrack;
            classesList.push({ name, stage, grade, track });
          } else {
            const name = String(r[0]).trim();
            const stage = (r[1] ? String(r[1]).trim() : 'primary') as SchoolStage;
            const grade = (r[2] ? String(r[2]).trim() : 'grade-1') as GradeLevel;
            const track = (r[3] ? String(r[3]).trim() : 'arabic-a') as ArabicTrack;
            classesList.push({ name, stage, grade, track });
          }
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
      const existingUsernames = new Set(getUsers().map(u => u.username));

      // 2. إنشاء حساب مدير المدرسة باسم مستخدم فريد مرتبط بالمدرسة
      const adminUsername = generateUniqueUsername(
        parsedSchool.adminUsername || 'admin',
        parsedSchool.slug,
        'school_admin',
        existingUsernames
      );
      existingUsernames.add(adminUsername);

      const adminUser: UserProfile = {
        id: generateValidUUID(),
        name: parsedSchool.adminName,
        username: adminUsername,
        password: parsedSchool.adminPassword || '123456',
        email: parsedSchool.adminEmail,
        role: 'school_admin',
        allowedStages: ['kg', 'primary', 'middle', 'high'],
        allowedGrades: [
          'kg-1', 'kg-2',
          'grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6',
          'grade-7', 'grade-8', 'grade-9',
          'grade-10', 'grade-11', 'grade-12'
        ],
        allowedTracks: ['arabic-a', 'arabic-b'],
        loginCount: 0
      };
      await saveUser(adminUser, { onConflict: 'username' });
      credentialsList.push({
        name: adminUser.name,
        username: adminUser.username,
        role: 'مدير المدرسة (School Admin)',
        password: adminUser.password || ''
      });

      // 3. إنشاء حسابات المعلمين بأسماء فريدة ومربوطة بنطاق المدرسة
      for (let i = 0; i < parsedTeachers.length; i++) {
        const t = parsedTeachers[i];
        const teacherUsername = generateUniqueUsername(
          t.username || `teacher_${i + 1}`,
          parsedSchool.slug,
          'teacher',
          existingUsernames
        );
        existingUsernames.add(teacherUsername);

        const teacherUser: UserProfile = {
          id: generateValidUUID(),
          name: t.name,
          username: teacherUsername,
          password: t.password || '123456',
          role: 'teacher',
          school_id: schoolId,
          allowedStages: ['primary'],
          allowedGrades: t.allowedGrades,
          allowedTracks: t.allowedTracks,
          loginCount: 0
        };
        await saveUser(teacherUser, { onConflict: 'username' });
        credentialsList.push({
          name: teacherUser.name,
          username: teacherUser.username,
          role: 'معلم (Teacher)',
          password: teacherUser.password || ''
        });
      }

      // 4. إنشاء حسابات الطلاب بأسماء فريدة ومربوطة بنطاق المدرسة
      for (let i = 0; i < parsedStudents.length; i++) {
        const s = parsedStudents[i];
        const studentUsername = generateUniqueUsername(
          s.username || `student_${i + 1}`,
          parsedSchool.slug,
          'student',
          existingUsernames
        );
        existingUsernames.add(studentUsername);

        const studentUser: UserProfile = {
          id: generateValidUUID(),
          name: s.name,
          username: studentUsername,
          password: s.password || '123',
          role: 'student',
          school_id: schoolId,
          stage: s.stage,
          grade: s.grade,
          track: s.track,
          loginCount: 0
        };
        await saveUser(studentUser, { onConflict: 'username' });
        credentialsList.push({
          name: studentUser.name,
          username: studentUser.username,
          role: 'طالب (Student)',
          password: studentUser.password || ''
        });
      }

      // 5. حفظ الفصول في Supabase (classes_grades & classes)
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

          const classesGradesPayload = parsedClasses.map((c, idx) => ({
            class_id: `cls_${Date.now()}_${idx}`,
            school_id: schoolId,
            section_code: c.name.replace(/[^a-zA-Z0-9_\u0621-\u064A-]/g, '').slice(0, 30) || `SEC-${idx + 1}`,
            class_name_ar: c.name,
            stage: c.stage === 'kg' ? 'kindergarten' : c.stage,
            grade_level: c.grade,
            track: c.track || 'arabic-a',
            academic_year: '2026-2027',
            is_active: true
          }));
          await supabase.from('classes_grades').upsert(classesGradesPayload, { onConflict: 'class_id' });
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
            <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-slate-900 p-5 rounded-2xl border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-9 h-9 text-emerald-400 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm text-emerald-200">النموذج الاسترشادي الشامل المعتمد (Supabase Architecture)</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      5 أوراق عمل منظمة
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    يتضمن قوالب الطلاب، المعلمين، الإدارة، الفصول، ودليل التحقق وقواعد الربط العلائقي
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex-1 md:flex-initial py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل قالب Excel (.xlsx)</span>
                </button>
                <a
                  href="/templates/csv/students.csv"
                  download="students_template.csv"
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-700 whitespace-nowrap"
                  title="تحميل قالب الطلاب بصيغة CSV لـ Supabase"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>CSV طلاب</span>
                </a>
              </div>
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
