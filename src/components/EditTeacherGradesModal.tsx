import React, { useState, useEffect } from 'react';
import { UserProfile, SchoolStage, GradeLevel, ArabicTrack } from '../types';
import { saveUser } from '../storage';
import { canManageTeacherGrades } from '../utils/permissions';
import { GraduationCap, Check, X, ShieldAlert, BookOpen, Layers, CheckSquare, Square } from 'lucide-react';

interface EditTeacherGradesModalProps {
  teacher: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  actorUser: UserProfile;
  onSaved?: (updatedTeacher: UserProfile) => void;
}

const AVAILABLE_STAGES: { id: SchoolStage; label: string }[] = [
  { id: 'kg', label: 'رياض الأطفال (KG)' },
  { id: 'primary', label: 'المرحلة الابتدائية' },
  { id: 'middle', label: 'المرحلة الإعدادية' },
  { id: 'high', label: 'المرحلة الثانوية' },
];

const AVAILABLE_GRADES: { id: GradeLevel; label: string }[] = [
  { id: 'grade-1', label: 'الصف الأول' },
  { id: 'grade-2', label: 'الصف الثاني' },
  { id: 'grade-3', label: 'الصف الثالث' },
  { id: 'grade-4', label: 'الصف الرابع' },
  { id: 'grade-5', label: 'الصف الخامس' },
  { id: 'grade-6', label: 'الصف السادس' },
];

const AVAILABLE_TRACKS: { id: ArabicTrack; label: string; desc: string }[] = [
  { id: 'arabic-a', label: 'المسار العام (أ) - ناطقون بالعربية', desc: 'المنهاج المتقدم والتأسيس القرائي الشامل' },
  { id: 'arabic-b', label: 'مسار التأسيس (ب) - الناطقين بغيرها', desc: 'مستوى التدرج الصوتي والوعي الأساسي' },
];

export const EditTeacherGradesModal: React.FC<EditTeacherGradesModalProps> = ({
  teacher,
  isOpen,
  onClose,
  actorUser,
  onSaved,
}) => {
  const [selectedStages, setSelectedStages] = useState<SchoolStage[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<GradeLevel[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<ArabicTrack[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (teacher) {
      setSelectedStages(teacher.allowedStages && teacher.allowedStages.length > 0 ? teacher.allowedStages : ['primary']);
      setSelectedGrades(teacher.allowedGrades && teacher.allowedGrades.length > 0 ? teacher.allowedGrades : ['grade-1']);
      setSelectedTracks(teacher.allowedTracks && teacher.allowedTracks.length > 0 ? teacher.allowedTracks : ['arabic-a']);
      setErrorMsg(null);
    }
  }, [teacher, isOpen]);

  if (!isOpen || !teacher) return null;

  const isAuthorized = canManageTeacherGrades(actorUser);

  const toggleStage = (stage: SchoolStage) => {
    setSelectedStages(prev =>
      prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]
    );
  };

  const toggleGrade = (grade: GradeLevel) => {
    setSelectedGrades(prev =>
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    );
  };

  const toggleTrack = (track: ArabicTrack) => {
    setSelectedTracks(prev =>
      prev.includes(track) ? prev.filter(t => t !== track) : [...prev, track]
    );
  };

  const handleSave = async () => {
    if (!isAuthorized) {
      setErrorMsg('عفواً، ليست لديك صلاحية لتعديل صفوف ومراحل المعلم.');
      return;
    }

    if (selectedGrades.length === 0) {
      setErrorMsg('يرجى تحديد صف دراسي واحد على الأقل للمعلم.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const updated: UserProfile = {
      ...teacher,
      allowedStages: selectedStages.length > 0 ? selectedStages : ['primary'],
      allowedGrades: selectedGrades,
      allowedTracks: selectedTracks.length > 0 ? selectedTracks : ['arabic-a'],
    };

    try {
      const res = await saveUser(updated);
      if (res.error) {
        setErrorMsg('فشل حفظ التعديلات سحابياً: ' + (res.error.message || ''));
      } else {
        onSaved?.(res.user);
        onClose();
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'حدث خطأ أثناء الحفظ.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        id="edit-teacher-grades-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <GraduationCap className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">تعديل الصفوف والمراحل والمسارات</h3>
              <p className="text-xs text-blue-100">
                المعلم: <span className="font-bold text-white">{teacher.name}</span> ({teacher.username})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {!isAuthorized && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <span>هذه الميزة محصورة حصراً في الإدارة العليا ورئيس القسم أو المفوضين إدارياً.</span>
            </div>
          )}

          {/* Stages Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              المراحل الدراسية المصرح بها
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {AVAILABLE_STAGES.map(stage => {
                const isSelected = selectedStages.includes(stage.id);
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => toggleStage(stage.id)}
                    className={`p-3 rounded-xl border text-xs font-bold text-right flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    <span>{stage.label}</span>
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grades Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                الصفوف الدراسية المسندة للمعلم
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedGrades(['grade-1', 'grade-2'])}
                  className="text-[11px] text-indigo-600 hover:underline font-semibold"
                >
                  صفوف التأسيس (1-2)
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedGrades(['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6'])}
                  className="text-[11px] text-indigo-600 hover:underline font-semibold"
                >
                  الكل
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AVAILABLE_GRADES.map(grade => {
                const isSelected = selectedGrades.includes(grade.id);
                return (
                  <button
                    key={grade.id}
                    type="button"
                    onClick={() => toggleGrade(grade.id)}
                    className={`p-3 rounded-xl border text-xs font-bold text-right flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    <span>{grade.label}</span>
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tracks Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              المسارات التعليمية المتاحة للمعلم
            </label>
            <div className="space-y-2">
              {AVAILABLE_TRACKS.map(track => {
                const isSelected = selectedTracks.includes(track.id);
                return (
                  <div
                    key={track.id}
                    onClick={() => toggleTrack(track.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer select-none transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-violet-500 bg-violet-50/60 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{track.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{track.desc}</div>
                    </div>
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-lg border border-slate-300 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isAuthorized}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {isSaving ? 'جارٍ الحفظ...' : 'حفظ الصفوف والمراحل'}
          </button>
        </div>
      </div>
    </div>
  );
};
