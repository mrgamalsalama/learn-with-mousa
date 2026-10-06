import React, { useState, useMemo } from 'react';
import { Users, User, CheckSquare, Square, Search, Check, Filter } from 'lucide-react';
import { UserProfile, GradeLevel, TargetAssignmentType } from '../types';
import { getGradeLabel } from '../utils/gradebookExport';

interface AssignmentTargetSelectorProps {
  targetType: TargetAssignmentType;
  onTargetTypeChange: (type: TargetAssignmentType) => void;
  students: UserProfile[];
  selectedStudentIds: string[];
  onSelectedStudentIdsChange: (ids: string[]) => void;
  selectedGrade?: GradeLevel;
  onGradeChange?: (grade: GradeLevel) => void;
  allowedGrades?: GradeLevel[];
  label?: string;
}

export const AssignmentTargetSelector: React.FC<AssignmentTargetSelectorProps> = ({
  targetType,
  onTargetTypeChange,
  students,
  selectedStudentIds,
  onSelectedStudentIdsChange,
  selectedGrade,
  onGradeChange,
  allowedGrades = [],
  label = 'نطاق الاستهداف والتخصيص'
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // فلترة الطلاب بحسب الصف المختار (إن وُجد) وبحسب البحث
  const gradeFilteredStudents = useMemo(() => {
    return students.filter(s => {
      if (s.role !== 'student') return false;
      if (selectedGrade && s.grade && s.grade !== selectedGrade) return false;
      return true;
    });
  }, [students, selectedGrade]);

  const searchedStudents = useMemo(() => {
    if (!searchQuery.trim()) return gradeFilteredStudents;
    const q = searchQuery.trim().toLowerCase();
    return gradeFilteredStudents.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.username && s.username.toLowerCase().includes(q))
    );
  }, [gradeFilteredStudents, searchQuery]);

  const toggleStudent = (studentId: string) => {
    if (targetType === 'individual') {
      onSelectedStudentIdsChange([studentId]);
    } else {
      if (selectedStudentIds.includes(studentId)) {
        onSelectedStudentIdsChange(selectedStudentIds.filter(id => id !== studentId));
      } else {
        onSelectedStudentIdsChange([...selectedStudentIds, studentId]);
      }
    }
  };

  const handleSelectAll = () => {
    const allIds = gradeFilteredStudents.map(s => s.id);
    onSelectedStudentIdsChange(allIds);
  };

  const handleDeselectAll = () => {
    onSelectedStudentIdsChange([]);
  };

  return (
    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3.5 text-right" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
        <div>
          <span className="text-xs font-black text-slate-800 block">{label}</span>
          <span className="text-[11px] text-slate-500">
            حدد ما إذا كان الإجراء يشمل الفصل بأكمله، أو مجموعة مختارة، أو طالباً بعينه
          </span>
        </div>

        {/* محدد الصف الدراسي إن كان للمعلم أكثر من صف */}
        {allowedGrades.length > 1 && onGradeChange && (
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="text-[11px] font-bold text-slate-500">الصف:</span>
            <select
              value={selectedGrade || allowedGrades[0]}
              onChange={(e) => onGradeChange(e.target.value as GradeLevel)}
              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
            >
              {allowedGrades.map(g => (
                <option key={g} value={g}>{getGradeLabel(g)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* خيارات الاستهداف الثلاثة الرئيسية */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            onTargetTypeChange('class');
            onSelectedStudentIdsChange([]);
          }}
          className={`p-3 rounded-xl border text-right transition flex items-center justify-between cursor-pointer ${
            targetType === 'class'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-600/20'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
              targetType === 'class' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
            }`}>
              🏫
            </div>
            <div>
              <span className="text-xs font-black block">الفصل كاملاً</span>
              <span className={`text-[10px] block ${targetType === 'class' ? 'text-emerald-100' : 'text-slate-400'}`}>
                {gradeFilteredStudents.length} طالباً
              </span>
            </div>
          </div>
          {targetType === 'class' && <Check className="w-4 h-4 text-white" />}
        </button>

        <button
          type="button"
          onClick={() => {
            onTargetTypeChange('group');
            if (selectedStudentIds.length === 0 && gradeFilteredStudents.length > 0) {
              onSelectedStudentIdsChange([gradeFilteredStudents[0].id]);
            }
          }}
          className={`p-3 rounded-xl border text-right transition flex items-center justify-between cursor-pointer ${
            targetType === 'group'
              ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-600/20'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
              targetType === 'group' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
            }`}>
              👥
            </div>
            <div>
              <span className="text-xs font-black block">طلاب محددون</span>
              <span className={`text-[10px] block ${targetType === 'group' ? 'text-indigo-100' : 'text-slate-400'}`}>
                {selectedStudentIds.length} محددون
              </span>
            </div>
          </div>
          {targetType === 'group' && <Check className="w-4 h-4 text-white" />}
        </button>

        <button
          type="button"
          onClick={() => {
            onTargetTypeChange('individual');
            if (selectedStudentIds.length !== 1 && gradeFilteredStudents.length > 0) {
              onSelectedStudentIdsChange([gradeFilteredStudents[0].id]);
            }
          }}
          className={`p-3 rounded-xl border text-right transition flex items-center justify-between cursor-pointer ${
            targetType === 'individual'
              ? 'bg-purple-600 text-white border-purple-700 shadow-md shadow-purple-600/20'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
              targetType === 'individual' ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-700'
            }`}>
              👤
            </div>
            <div>
              <span className="text-xs font-black block">طالب فردي</span>
              <span className={`text-[10px] block ${targetType === 'individual' ? 'text-purple-100' : 'text-slate-400'}`}>
                تخصيص فردي
              </span>
            </div>
          </div>
          {targetType === 'individual' && <Check className="w-4 h-4 text-white" />}
        </button>
      </div>

      {/* لوحة اختيار الطلاب عند اختيار مجموعة أو طالب فردي */}
      {(targetType === 'group' || targetType === 'individual') && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-2.5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن اسم الطالب..."
                className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {targetType === 'group' && (
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                >
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              </div>
            )}
          </div>

          {/* قائمة الطلاب مع مربعات الاختيار */}
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-100">
            {searchedStudents.length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-400 font-bold">
                لا يوجد طلاب يطابقون البحث
              </p>
            ) : (
              searchedStudents.map((st) => {
                const isSelected = selectedStudentIds.includes(st.id);
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => toggleStudent(st.id)}
                    className={`w-full pt-1.5 pb-1.5 px-2 rounded-xl transition flex items-center justify-between text-right cursor-pointer ${
                      isSelected 
                        ? (targetType === 'individual' ? 'bg-purple-50 text-purple-950 font-bold' : 'bg-indigo-50 text-indigo-950 font-bold')
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black flex items-center justify-center shrink-0">
                        {st.avatar || '🎓'}
                      </div>
                      <div>
                        <span className="text-xs font-bold block">{st.name}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {st.grade ? getGradeLabel(st.grade) : ''} • {st.track === 'arabic-b' ? 'عرب B' : 'عرب A'}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 mr-2">
                      {isSelected ? (
                        <CheckSquare className={`w-4 h-4 ${targetType === 'individual' ? 'text-purple-600' : 'text-indigo-600'}`} />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="text-[11px] font-bold text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span>الطلاب المختارون:</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              selectedStudentIds.length > 0 ? 'bg-indigo-100 text-indigo-900' : 'bg-slate-100 text-slate-500'
            }`}>
              {selectedStudentIds.length} من {gradeFilteredStudents.length} طالباً
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
