import React, { useState, useRef } from 'react';
import { 
  X, UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, 
  Download, Users, Sparkles, RefreshCw, ArrowRight, ShieldCheck
} from 'lucide-react';
import { UserProfile, GradeLevel, ArabicTrack, STAGES_CONFIG, DEFAULT_DELEGATED_PERMISSIONS } from '../types';
import { 
  parseStudentsFile, 
  ParsedStudentRow, 
  downloadStudentImportTemplate, 
  getGradeLabel 
} from '../utils/gradebookExport';
import { saveStudentsBulk } from '../storage';

interface BulkStudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  allowedGrades?: GradeLevel[];
  onImportSuccess: (count: number, gradeLabel: string) => void;
}

export const BulkStudentImportModal: React.FC<BulkStudentImportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allowedGrades = [],
  onImportSuccess,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  
  // خيارات افتراضية للصف والمسار
  const [defaultGrade, setDefaultGrade] = useState<GradeLevel>(
    allowedGrades[0] || 'grade-1'
  );
  const [defaultTrack, setDefaultTrack] = useState<ArabicTrack>('arabic-a');
  
  const [isSaving, setIsSaving] = useState(false);
  const [successResult, setSuccessResult] = useState<{ count: number; gradeText: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // معالجة اختيار الملف
  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setParseError(null);
    setSuccessResult(null);

    const result = await parseStudentsFile(file);
    setIsParsing(false);

    if (result.error) {
      setParseError(result.error);
      setParsedRows([]);
    } else {
      setParsedRows(result.rows);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  // اعتماد وحفظ الطلاب دفعة واحدة
  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;

    setIsSaving(true);
    try {
      const teacherId = currentUser.role === 'teacher' ? currentUser.id : undefined;

      const newStudents: UserProfile[] = validRows.map((r) => {
        // إنشاء اسم مستخدم فريد وآمن
        const sanitizedUsername = r.academicId
          ? r.academicId.toLowerCase().replace(/[^a-z0-9_-]/g, '')
          : `stu_${Date.now()}_${r.index}`;

        return {
          id: `usr_student_${r.academicId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          name: r.name,
          username: sanitizedUsername || `student_${Date.now()}_${r.index}`,
          password: '123',
          role: 'student',
          stage: 'primary',
          grade: r.grade || defaultGrade,
          track: r.track || defaultTrack,
          teacherId,
          email: r.email || undefined,
          loginCount: 0,
          delegated_admin_permissions: { ...DEFAULT_DELEGATED_PERMISSIONS },
        };
      });

      const res = await saveStudentsBulk(newStudents);
      const gradeText = getGradeLabel(defaultGrade);

      setSuccessResult({
        count: res.count,
        gradeText,
      });

      onImportSuccess(res.count, gradeText);
    } catch (err: any) {
      setParseError(`حدث خطأ أثناء حفظ الطلاب: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setParseError(null);
    setSuccessResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      dir="rtl"
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* الترويسة */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-6 py-4.5 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg">استيراد قائمة الطلاب الجماعي 👥</h2>
              <p className="text-xs text-emerald-100">
                إضافة وتحديث سجلات الطلاب بضغطة زر عبر ملفات Microsoft Excel و CSV
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوى النافذة المنبثقة */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* حالة النجاح النهائي المبهج */}
          {successResult ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm animate-bounce">
                <Sparkles className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">
                  تم الاستيراد والاعتماد بنجاح! ✨
                </h3>
                <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                  تم تسجيل وتحديث <b className="text-emerald-700 font-extrabold">{successResult.count} طالب</b> بنجاح في المنظومة، وأصبحوا متاحين فورياً في كشف الدرجات وقوائم الفصول.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800 flex items-center justify-center gap-2 max-w-md mx-auto">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>تم تأمين الحسابات بكلمة المرور الافتراضية (123) وبكود الطالب الأكاديمي.</span>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={resetState}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> استيراد ملف إضافي
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  تم، العودة لكشف الدرجات 📊
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* الخطوة 1: تنزيل نموذج الإكسيل الجاهز المعتمد */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800">
                      قالب الإكسيل المعتمد للاستيراد 📄
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      يحتوي على الأعمدة القياسية: (اسم الطالب، الرقم الأكاديمي، الصف الدراسي، المسار التعليمي، البريد)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadStudentImportTemplate('xlsx')}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-100/60 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="تنزيل ملف Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تحميل قالب Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadStudentImportTemplate('csv')}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-100/60 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="تنزيل قالب CSV"
                  >
                    <span>قالب CSV</span>
                  </button>
                </div>
              </div>

              {/* الخطوة 2: منطقة سحب وإفلات الملف المعبأ */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  dragActive 
                    ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]' 
                    : 'border-slate-300 hover:border-emerald-400 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                  <UploadCloud className="w-7 h-7" />
                </div>

                <div>
                  <h4 className="font-extrabold text-sm text-slate-800">
                    {selectedFile ? selectedFile.name : 'اسحب وأفلت ملف الطلاب هنا، أو انقر للاختيار'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    ندعم صيغ Microsoft Excel (.xlsx, .xls) وملفات القيم المفصولة بفواصل (.csv)
                  </p>
                </div>

                {selectedFile && (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">
                    حجم الملف: {(selectedFile.size / 1024).toFixed(1)} كيلوبايت
                  </span>
                )}
              </div>

              {/* مؤشر المعالجة */}
              {isParsing && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center gap-2 text-xs text-indigo-800 font-bold">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>جارٍ فحص ومعالجة صفوف الطلاب والتحقق من صحة الأرقام الأكاديمية...</span>
                </div>
              )}

              {/* خطأ التحليل إن وجد */}
              {parseError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">تنبيه في قراءة الملف:</span>
                    <span>{parseError}</span>
                  </div>
                </div>
              )}

              {/* المعاينة الفورية الذكية إذا وُجدت بيانات */}
              {parsedRows.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-slate-800">المعاينة الفورية للطلاب قبل الاعتماد:</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                        {parsedRows.length} صف
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {validRows.length} طالب جاهز
                      </span>
                      {invalidRows.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          {invalidRows.length} يحتاج تصحيح
                        </span>
                      )}
                    </div>
                  </div>

                  {/* جدول المعاينة */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                        <tr className="text-slate-500 font-bold">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">اسم الطالب</th>
                          <th className="py-2.5 px-3">الرقم الأكاديمي</th>
                          <th className="py-2.5 px-3">الصف الدراسي</th>
                          <th className="py-2.5 px-3">المسار</th>
                          <th className="py-2.5 px-3 text-center">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedRows.map((r) => (
                          <tr key={r.index} className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                            <td className="py-2 px-3 text-slate-400 text-[11px]">{r.index}</td>
                            <td className="py-2 px-3 font-bold text-slate-800">{r.name}</td>
                            <td className="py-2 px-3 font-mono text-indigo-700 font-bold text-[11px]">{r.academicId}</td>
                            <td className="py-2 px-3 text-slate-600">{r.gradeLabel}</td>
                            <td className="py-2 px-3 text-slate-600">{r.trackLabel}</td>
                            <td className="py-2 px-3 text-center">
                              {r.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  جاهز ✅
                                </span>
                              ) : (
                                <span 
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold"
                                  title={r.validationError}
                                >
                                  {r.validationError} ⚠️
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* تذييل النافذة والأزرار */}
        {!successResult && (
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-medium">
              سيتم إضافة الطلاب فورياً في قاعدة البيانات والتخزين المحلي دون تكرار.
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                id="confirm-bulk-import-btn"
                onClick={handleConfirmImport}
                disabled={validRows.length === 0 || isSaving}
                className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ الحفظ والمزامنة...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>اعتماد واستيراد {validRows.length} طالب ✨</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
