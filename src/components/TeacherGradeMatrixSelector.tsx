import React from 'react';
import { GradeLevel, SchoolStage, STAGES_CONFIG, getStagesForGrades } from '../types';
import { Check, CheckCheck, X, Sparkles, BookOpen } from 'lucide-react';

export interface StageDefinition {
  stageId: SchoolStage;
  nameAr: string;
  badgeColor: string;
  activeColor: string;
  borderColor: string;
  grades: { id: GradeLevel; labelAr: string; shortLabelAr?: string }[];
}

export const SYSTEM_STAGES_MATRIX: StageDefinition[] = [
  {
    stageId: 'kg',
    nameAr: 'مرحلة رياض الأطفال',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    activeColor: 'bg-amber-600 text-white border-amber-600 shadow-amber-600/20',
    borderColor: 'border-amber-200 bg-amber-50/40',
    grades: [
      { id: 'kg-1', labelAr: 'روضة أولى (KG1)', shortLabelAr: 'KG1' },
      { id: 'kg-2', labelAr: 'روضة ثانية (KG2)', shortLabelAr: 'KG2' },
    ],
  },
  {
    stageId: 'primary',
    nameAr: 'المرحلة الابتدائية',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    activeColor: 'bg-blue-600 text-white border-blue-600 shadow-blue-600/20',
    borderColor: 'border-blue-200 bg-blue-50/40',
    grades: [
      { id: 'grade-1', labelAr: 'الصف الأول الابتدائي', shortLabelAr: 'الصف 1' },
      { id: 'grade-2', labelAr: 'الصف الثاني الابتدائي', shortLabelAr: 'الصف 2' },
      { id: 'grade-3', labelAr: 'الصف الثالث الابتدائي', shortLabelAr: 'الصف 3' },
      { id: 'grade-4', labelAr: 'الصف الرابع الابتدائي', shortLabelAr: 'الصف 4' },
      { id: 'grade-5', labelAr: 'الصف الخامس الابتدائي', shortLabelAr: 'الصف 5' },
      { id: 'grade-6', labelAr: 'الصف السادس الابتدائي', shortLabelAr: 'الصف 6' },
    ],
  },
  {
    stageId: 'middle',
    nameAr: 'المرحلة المتوسطة',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    activeColor: 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/20',
    borderColor: 'border-emerald-200 bg-emerald-50/40',
    grades: [
      { id: 'grade-7', labelAr: 'الصف السابع (متوسط)', shortLabelAr: 'الصف 7' },
      { id: 'grade-8', labelAr: 'الصف الثامن (متوسط)', shortLabelAr: 'الصف 8' },
      { id: 'grade-9', labelAr: 'الصف التاسع (متوسط)', shortLabelAr: 'الصف 9' },
    ],
  },
  {
    stageId: 'high',
    nameAr: 'المرحلة الثانوية',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    activeColor: 'bg-purple-600 text-white border-purple-600 shadow-purple-600/20',
    borderColor: 'border-purple-200 bg-purple-50/40',
    grades: [
      { id: 'grade-10', labelAr: 'الصف العاشر (ثانوي)', shortLabelAr: 'الصف 10' },
      { id: 'grade-11', labelAr: 'الصف الحادي عشر (ثانوي)', shortLabelAr: 'الصف 11' },
      { id: 'grade-12', labelAr: 'الصف الثاني عشر (ثانوي)', shortLabelAr: 'الصف 12' },
    ],
  },
];

interface TeacherGradeMatrixSelectorProps {
  selectedGrades: GradeLevel[];
  onChange: (grades: GradeLevel[]) => void;
  onStagesChange?: (stages: SchoolStage[]) => void;
  compact?: boolean;
  className?: string;
}

export const TeacherGradeMatrixSelector: React.FC<TeacherGradeMatrixSelectorProps> = ({
  selectedGrades,
  onChange,
  onStagesChange,
  compact = false,
  className = '',
}) => {
  const allGrades = SYSTEM_STAGES_MATRIX.flatMap((s) => s.grades.map((g) => g.id));

  const updateGrades = (newGrades: GradeLevel[]) => {
    onChange(newGrades);
    if (onStagesChange) {
      onStagesChange(getStagesForGrades(newGrades));
    }
  };

  const toggleSingleGrade = (gradeId: GradeLevel) => {
    if (selectedGrades.includes(gradeId)) {
      updateGrades(selectedGrades.filter((g) => g !== gradeId));
    } else {
      updateGrades([...selectedGrades, gradeId]);
    }
  };

  const isStageFullySelected = (stage: StageDefinition) => {
    const stageIds = stage.grades.map((g) => g.id);
    return stageIds.every((id) => selectedGrades.includes(id));
  };

  const toggleWholeStage = (stage: StageDefinition) => {
    const stageIds = stage.grades.map((g) => g.id);
    const fullySelected = isStageFullySelected(stage);

    if (fullySelected) {
      // Unselect this stage's grades
      updateGrades(selectedGrades.filter((g) => !stageIds.includes(g)));
    } else {
      // Select all grades of this stage
      const merged = Array.from(new Set([...selectedGrades, ...stageIds]));
      updateGrades(merged);
    }
  };

  const selectAll = () => updateGrades(allGrades);
  const clearAll = () => updateGrades([]);
  const selectFoundationOnly = () => updateGrades(['kg-1', 'kg-2', 'grade-1', 'grade-2']);
  const selectPrimaryOnly = () => updateGrades(['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6']);

  return (
    <div className={`space-y-3 ${className}`} dir="rtl">
      {/* Quick Global Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
          <span>الصفوف المحددة:</span>
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-black">
            {selectedGrades.length} من {allGrades.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={selectAll}
            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition flex items-center gap-1"
          >
            <CheckCheck className="w-3 h-3" />
            تحديد الكل
          </button>
          <button
            type="button"
            onClick={selectPrimaryOnly}
            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition"
          >
            الابتدائية فقط (1-6)
          </button>
          <button
            type="button"
            onClick={selectFoundationOnly}
            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold transition flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            التأسيس (KG + 1-2)
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="px-2 py-1 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition flex items-center gap-1"
            title="إلغاء تحديد كافة الصفوف"
          >
            <X className="w-3 h-3" />
            إلغاء
          </button>
        </div>
      </div>

      {/* Stages Grid */}
      <div className={`grid ${compact ? 'grid-cols-1 gap-2.5' : 'grid-cols-1 md:grid-cols-2 gap-3'}`}>
        {SYSTEM_STAGES_MATRIX.map((stage) => {
          const stageIds = stage.grades.map((g) => g.id);
          const selectedInStage = stage.grades.filter((g) => selectedGrades.includes(g.id));
          const isFullySelected = selectedInStage.length === stage.grades.length;
          const isPartiallySelected = selectedInStage.length > 0 && !isFullySelected;

          return (
            <div
              key={stage.stageId}
              className={`rounded-2xl border p-3 transition-all ${
                isFullySelected
                  ? stage.borderColor + ' shadow-xs ring-1 ring-slate-200'
                  : isPartiallySelected
                  ? 'border-slate-300 bg-slate-50/70'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {/* Stage Header with 1-click select/deselect button */}
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${stage.badgeColor}`}>
                    {stage.nameAr}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">
                    ({selectedInStage.length}/{stage.grades.length})
                  </span>
                </div>

                {/* 1-Click Toggle for the entire stage */}
                <button
                  type="button"
                  onClick={() => toggleWholeStage(stage)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 ${
                    isFullySelected
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs'
                  }`}
                >
                  {isFullySelected ? (
                    <>
                      <X className="w-3 h-3 text-rose-600" />
                      إلغاء المرحلة
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3 text-indigo-600" />
                      تحديد المرحلة كاملة
                    </>
                  )}
                </button>
              </div>

              {/* Grade Chips for this Stage */}
              <div className="flex flex-wrap gap-1.5">
                {stage.grades.map((grade) => {
                  const isSelected = selectedGrades.includes(grade.id);

                  return (
                    <button
                      key={grade.id}
                      type="button"
                      onClick={() => toggleSingleGrade(grade.id)}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? `${stage.activeColor} shadow-xs font-black`
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                      title={grade.labelAr}
                    >
                      <span>{grade.shortLabelAr || grade.labelAr}</span>
                      {isSelected ? (
                        <div className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-300 bg-slate-50" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
