import React, { useState, useEffect } from 'react';
import { 
  X, Globe, Award, Printer, ShieldCheck, CheckCircle2, Clock, 
  BookOpen, Star, HelpCircle, Download, Share2, Sparkles, User,
  FileCheck2, Compass, Layers, Check
} from 'lucide-react';
import { 
  UserProfile, CEFRLevel, CEFRCompetencyDomain, LanguagePassportEntry, UILanguage 
} from '../types';
import { 
  I18N_DICTIONARIES, 
  CEFR_LEVEL_DESCRIPTORS 
} from '../utils/i18nTranslations';
import { 
  getLanguagePassport, 
  saveLanguagePassport, 
  getPreferredUILanguage, 
  setPreferredUILanguage,
  getStudentCEFROverride,
  isGatekeeperUnlockedForStudent
} from '../storage';
import { getGradeLabel } from '../utils/gradebookExport';

interface LanguagePassportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  targetStudent?: UserProfile;
  currentUILang?: UILanguage;
  onLanguageChange?: (lang: UILanguage) => void;
}

export const LanguagePassportModal: React.FC<LanguagePassportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetStudent,
  currentUILang: externalUILang,
  onLanguageChange,
}) => {
  const student = targetStudent || currentUser;
  const isTeacherOrAdmin = currentUser.role === 'teacher' || currentUser.role === 'hod' || currentUser.role === 'super_admin';

  // إدارة لغة الواجهة التوجيهية (عربي، إنجليزي، فرنسي، أوردو)
  const [activeLang, setActiveLang] = useState<UILanguage>(() => {
    return externalUILang || getPreferredUILanguage();
  });

  const t = I18N_DICTIONARIES[activeLang] || I18N_DICTIONARIES.ar;

  // جلب أو إنشاء بيانات جواز السفر اللغوي للطالب
  const [passportData, setPassportData] = useState<LanguagePassportEntry>(() => {
    const existing = getLanguagePassport(student.id);
    if (existing) return existing;

    // تهيئة افتراضية متوافقة مع CEFR لمسار غير الناطقين
    const initialCefr: CEFRLevel = student.track === 'arabic-b' ? 'A2.1' : 'B1.1';
    const initialPassport: LanguagePassportEntry = {
      id: `pass_${student.id}`,
      studentId: student.id,
      studentName: student.name,
      passportNumber: `LWM-PASSPORT-${student.id.slice(0, 4).toUpperCase()}-${new Date().getFullYear()}`,
      nativeLanguage: 'English / Urdu / French',
      targetLanguage: 'Modern Standard Arabic (اللغة العربية الفصحى)',
      currentCefrLevel: initialCefr,
      certifiedHours: 48,
      issuedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      competencies: {
        listening: {
          level: initialCefr,
          titleAr: 'الاستماع والفهم الصوتي',
          description: CEFR_LEVEL_DESCRIPTORS[initialCefr].listeningDesc,
          score: 88,
        },
        reading: {
          level: initialCefr,
          titleAr: 'القراءة والتحليل الدلالي',
          description: CEFR_LEVEL_DESCRIPTORS[initialCefr].readingDesc,
          score: 85,
        },
        spoken_interaction: {
          level: initialCefr,
          titleAr: 'التواصل والتفاعل الشفهي',
          description: CEFR_LEVEL_DESCRIPTORS[initialCefr].spokenDesc,
          score: 82,
        },
        spoken_production: {
          level: initialCefr,
          titleAr: 'الإنتاج الشفهي والتعبير',
          description: CEFR_LEVEL_DESCRIPTORS[initialCefr].spokenDesc,
          score: 80,
        },
        writing: {
          level: initialCefr,
          titleAr: 'الكتابة والإنشاء والإملاء',
          description: CEFR_LEVEL_DESCRIPTORS[initialCefr].writingDesc,
          score: 86,
        },
      },
      verifiedBy: isTeacherOrAdmin ? currentUser.name : 'أكاديمية منصة تعلّم مع موسى الدولية',
      institution: 'Global Arabic CEFR Accreditation Center',
    };

    saveLanguagePassport(initialPassport);
    return initialPassport;
  });

  useEffect(() => {
    if (isOpen) {
      const existing = getLanguagePassport(student.id);
      if (existing) setPassportData(existing);
    }
  }, [isOpen, student.id]);

  const handleSelectLanguage = (lang: UILanguage) => {
    setActiveLang(lang);
    setPreferredUILanguage(lang);
    onLanguageChange?.(lang);
  };

  const handleLevelChange = (newLevel: CEFRLevel) => {
    const updated: LanguagePassportEntry = {
      ...passportData,
      currentCefrLevel: newLevel,
      competencies: {
        listening: {
          ...passportData.competencies.listening,
          level: newLevel,
          description: CEFR_LEVEL_DESCRIPTORS[newLevel].listeningDesc,
        },
        reading: {
          ...passportData.competencies.reading,
          level: newLevel,
          description: CEFR_LEVEL_DESCRIPTORS[newLevel].readingDesc,
        },
        spoken_interaction: {
          ...passportData.competencies.spoken_interaction,
          level: newLevel,
          description: CEFR_LEVEL_DESCRIPTORS[newLevel].spokenDesc,
        },
        spoken_production: {
          ...passportData.competencies.spoken_production,
          level: newLevel,
          description: CEFR_LEVEL_DESCRIPTORS[newLevel].spokenDesc,
        },
        writing: {
          ...passportData.competencies.writing,
          level: newLevel,
          description: CEFR_LEVEL_DESCRIPTORS[newLevel].writingDesc,
        },
      },
    };
    setPassportData(updated);
    saveLanguagePassport(updated);
  };

  const handleHoursIncrement = (delta: number) => {
    const newHours = Math.max(1, passportData.certifiedHours + delta);
    const updated = { ...passportData, certifiedHours: newHours };
    setPassportData(updated);
    saveLanguagePassport(updated);
  };

  if (!isOpen) return null;

  const currentDescriptor = CEFR_LEVEL_DESCRIPTORS[passportData.currentCefrLevel];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in" dir="rtl">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* الترويسة الرئيسية مع شريط اختيار لغة التوجيه */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white px-6 py-4 border-b border-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold text-xl shadow-inner">
              🛂
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">
                  {t.passportTitle}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  CEFR & ACTFL Framework
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                {t.passportSubtitle}
              </p>
            </div>
          </div>

          {/* محول لغة التعليمات متعدد اللغات */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/10 text-xs">
              <Globe className="w-3.5 h-3.5 text-blue-300 mx-1" />
              {(['ar', 'en', 'fr', 'ur'] as UILanguage[]).map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => handleSelectLanguage(l)}
                  className={`px-2 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                    activeLang === l
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {l === 'ar' ? 'العربية' : l === 'en' ? 'EN' : l === 'fr' ? 'FR' : 'اردو'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* جسم النافذة الرئيسي */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

          {/* شريط معلومات الطالب وساعات التدريب المعتمدة */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black text-xl">
                👤
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base text-slate-900">{student.name}</h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    {student.track === 'arabic-b' ? 'مسار غير الناطقين (عرب B)' : 'مسار الناطقين (عرب A)'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>{t.passportNumber}: <b className="font-mono text-slate-700">{passportData.passportNumber}</b></span>
                  <span>•</span>
                  <span>الصف: <b className="text-slate-700">{getGradeLabel(student.grade || 'grade-2')}</b></span>
                </div>
              </div>
            </div>

            {/* ساعات التدريب المعتمدة والتحكم بها */}
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 self-start md:self-auto">
              <Clock className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-slate-400 block">{t.verifiedHours}</span>
                <span className="text-xl font-black text-slate-900">{passportData.certifiedHours} ساعة أكاديمية</span>
              </div>
              {isTeacherOrAdmin && (
                <div className="flex items-center gap-1 mr-2">
                  <button
                    type="button"
                    onClick={() => handleHoursIncrement(2)}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                    title="إضافة ساعتين تدريبيتين"
                  >
                    +2
                  </button>
                  <button
                    type="button"
                    onClick={() => handleHoursIncrement(-2)}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                    title="خصم ساعتين"
                  >
                    -2
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ترقية استثنائية موثقة من المعلم إن وُجدت */}
          {(() => {
            const ovr = getStudentCEFROverride(student.id);
            const isGkUnlocked = isGatekeeperUnlockedForStudent(student.id, student.grade);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* حالة اختبار العبور للمستوى التالي */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
                  isGkUnlocked
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{isGkUnlocked ? '🔓' : '🔒'}</span>
                    <div>
                      <span className="font-black block">اختبار العبور للمستوى التالي (Gatekeeper Benchmark):</span>
                      <span className="text-[11px] text-slate-500">
                        {isGkUnlocked 
                          ? 'مفتوح ومعتمد للطالب لتقديم تقييم العبور' 
                          : 'مقفل حالياً بانتظار استيفاء شروط الكفاءة من المعلم'}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 ${
                    isGkUnlocked ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {isGkUnlocked ? 'مفتوح 🔓' : 'مقفل 🔒'}
                  </span>
                </div>

                {/* شارة الترقية الاستثنائية */}
                {ovr ? (
                  <div className="p-4 rounded-2xl border bg-indigo-50/70 border-indigo-200 text-xs text-indigo-950 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black flex items-center gap-1.5">
                          <span>🌟</span>
                          <span>ترقية استثنائية معتمدة من المعلم</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                          {ovr.previousLevel} ➔ {ovr.overrideLevel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2">
                        💬 <b>المبرر:</b> {ovr.justification}
                      </p>
                    </div>
                    <span className="text-[10px] text-indigo-700 mt-2 block font-medium">
                      المعتمد: {ovr.teacherName} • {new Date(ovr.updatedAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl border bg-slate-50 border-slate-200 text-xs text-slate-600 flex items-center gap-2.5">
                    <span className="text-xl">📜</span>
                    <div>
                      <span className="font-bold block text-slate-800">حالة المسار والاعتماد:</span>
                      <span className="text-[11px] text-slate-500">
                        المستوى معتمد وفق السلم الأكاديمي القياسي {passportData.currentCefrLevel} ({student.track === 'arabic-b' ? 'مسار عرب B' : 'مسار عرب A'})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* محدد المستوى المرجعي الأوروبي (CEFR Level Selector) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block">المستوى الحالي المكتسب وفق سلم CEFR:</span>
                <h4 className="font-black text-sm text-slate-900">
                  {currentDescriptor.nameAr}
                </h4>
              </div>
              <span className={`px-3 py-1 rounded-xl text-xs font-black border ${currentDescriptor.badgeColor}`}>
                {passportData.currentCefrLevel}
              </span>
            </div>

            {/* أزرار اختيار المستويات المرجعية A1.1 إلى B2 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-2">
              {(['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2'] as CEFRLevel[]).map(lvl => {
                const isSelected = passportData.currentCefrLevel === lvl;
                const isCurrentTrackMatch = (lvl.startsWith('A') && student.track === 'arabic-b') || (lvl.startsWith('B') && student.track === 'arabic-a');

                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => isTeacherOrAdmin && handleLevelChange(lvl)}
                    disabled={!isTeacherOrAdmin}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-black shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    } ${!isTeacherOrAdmin ? 'cursor-default' : ''}`}
                  >
                    <span className="text-xs font-extrabold">{lvl}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      {lvl.startsWith('A1') ? 'تأسيسي' : lvl.startsWith('A2') ? 'أولي' : lvl.startsWith('B1') ? 'متوسط' : 'متقدم'}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-500 pt-1">
              • <b>ملاحظة تربوية:</b> {t.cefrFrameworkInfo}
            </p>
          </div>

          {/* الكفايات الخمس المعتمدة (Listening, Reading, Spoken Interaction, Spoken Production, Writing) */}
          <div className="space-y-3">
            <h4 className="font-black text-xs text-slate-700 flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600" />
              <span>مصفوفة الكفايات اللغوية الخمس المعتمدة دولياً:</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(passportData.competencies).map(([domainKey, comp]) => (
                <div key={domainKey} className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">{comp.titleAr}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800">
                      {comp.level} • {comp.score}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {comp.description}
                  </p>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full" 
                      style={{ width: `${comp.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* زر عرض وثيقة الجواز اللغوي للطباعة الرسمية */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-3xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-black flex items-center gap-2">
                <span>وثيقة جواز السفر اللغوي الرسمية القابلة للطباعة 📜</span>
              </h4>
              <p className="text-xs text-slate-300 mt-1">
                تتضمن الخاتم الرسمي، ورقم الاعتماد الدولي، وتفاصيل الكفايات باللغتين العربية والإنجليزية.
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-xl text-xs font-black transition flex items-center gap-2 shadow-md cursor-pointer self-start sm:self-auto"
            >
              <Printer className="w-4 h-4" />
              <span>{t.printPassport}</span>
            </button>
          </div>

        </div>

        {/* الشريط السفلي */}
        <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400 font-medium">
            معتمد وفق متطلبات المدارس الدولية والمناهج الوزارية لمسارات تعليم اللغة العربية للناطقين بغيرها.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            {t.close}
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* وثيقة جواز السفر اللغوي الرسمية للطباعة (window.print container) */}
      {/* ========================================================================= */}
      <div id="language-passport-printable" className="hidden print:block p-8 bg-white text-slate-900 space-y-6" dir="rtl">
        <div className="border-4 border-double border-blue-900 p-8 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b-2 border-blue-900 pb-4">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase block tracking-widest">
                International Arabic Language Passport • CEFR Framework
              </span>
              <h1 className="text-2xl font-black text-blue-950 mt-1">
                جواز السفر اللغوي الدولي للغة العربية الفصحى
              </h1>
            </div>
            <div className="text-left font-mono text-xs text-slate-600">
              <span className="block font-bold text-blue-900">{passportData.passportNumber}</span>
              <span className="text-[10px] text-slate-400">Accredited Document</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2 text-xs border-b border-slate-200 pb-4">
            <div>
              <span className="text-slate-400 block">اسم الطالب (Learner Name):</span>
              <span className="text-base font-black text-slate-900">{student.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block">المستوى المكتسب (CEFR Level):</span>
              <span className="text-base font-black text-blue-800">{passportData.currentCefrLevel} ({currentDescriptor.nameAr})</span>
            </div>
            <div>
              <span className="text-slate-400 block">الساعات التدريبية (Certified Hours):</span>
              <span className="font-bold text-slate-800">{passportData.certifiedHours} ساعة تدريبية</span>
            </div>
            <div>
              <span className="text-slate-400 block">المسار الأكاديمي:</span>
              <span className="font-bold text-slate-800">{student.track === 'arabic-b' ? 'Arabic B (عرب ب)' : 'Arabic A'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-black text-sm text-blue-950">تفاصيل الكفايات المعتمدة (Certified Competencies):</h3>
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 font-bold">المجال اللغوي</th>
                  <th className="p-2 font-bold">المستوى</th>
                  <th className="p-2 font-bold">الوصف المعياري</th>
                  <th className="p-2 font-bold">نسبة التحصيل</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(passportData.competencies).map(([k, c]) => (
                  <tr key={k} className="border-b border-slate-200">
                    <td className="p-2 font-bold">{c.titleAr}</td>
                    <td className="p-2 font-mono font-bold text-blue-800">{c.level}</td>
                    <td className="p-2 text-slate-600">{c.description}</td>
                    <td className="p-2 font-black text-slate-900">{c.score}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-blue-900 text-xs">
            <div>
              <span className="text-slate-400 block">الجهة المانحة والموثقة:</span>
              <span className="font-bold text-slate-800">{passportData.institution}</span>
              <div className="h-6"></div>
              <span className="text-slate-400">التوقيع والختم: ..........................</span>
            </div>
            <div>
              <span className="text-slate-400 block">تاريخ الإصدار والاعتماد:</span>
              <span className="font-bold text-slate-800">
                {new Date(passportData.issuedAt).toLocaleDateString('ar-EG')}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
