import React, { useState, useRef, useEffect } from 'react';
import { WorksheetElement } from '../../types';
import { uploadWorksheetAudio } from '../../services/worksheetService';

interface WorksheetAudioReviewerProps {
  element: WorksheetElement;
  studentAudioUrl?: string;
  pointsEarned: number;
  maxPoints: number;
  teacherFeedback?: string;
  teacherAudioFeedback?: string;
  onUpdateGradeAndFeedback: (
    newPoints: number,
    feedbackText?: string,
    feedbackAudioUrl?: string
  ) => Promise<void> | void;
}

export const WorksheetAudioReviewer: React.FC<WorksheetAudioReviewerProps> = ({
  element,
  studentAudioUrl,
  pointsEarned,
  maxPoints,
  teacherFeedback = '',
  teacherAudioFeedback = '',
  onUpdateGradeAndFeedback
}) => {
  const [isPlayingStudent, setIsPlayingStudent] = useState(false);
  const [studentProgress, setStudentProgress] = useState(0);

  // حالة تعديل الدرجة والملاحظات
  const [currentScore, setCurrentScore] = useState<number>(pointsEarned);
  const [textNote, setTextNote] = useState<string>(teacherFeedback);
  const [audioNoteUrl, setAudioNoteUrl] = useState<string>(teacherAudioFeedback);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // حالة تسجيل صوت المعلم التشجيعي
  const [isRecordingTeacher, setIsRecordingTeacher] = useState(false);
  const [teacherRecSeconds, setTeacherRecSeconds] = useState(0);
  const [isPlayingTeacherAudio, setIsPlayingTeacherAudio] = useState(false);

  const studentAudioRef = useRef<HTMLAudioElement | null>(null);
  const teacherAudioRef = useRef<HTMLAudioElement | null>(null);
  const teacherMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const teacherChunksRef = useRef<Blob[]>([]);
  const teacherTimerRef = useRef<any>(null);
  const teacherStreamRef = useRef<MediaStream | null>(null);

  // إعداد مشغل صوت الطالب
  useEffect(() => {
    if (studentAudioUrl) {
      const audio = new Audio(studentAudioUrl);
      studentAudioRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration && !isNaN(audio.duration)) {
          setStudentProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.onended = () => {
        setIsPlayingStudent(false);
        setStudentProgress(0);
      };

      audio.onerror = () => {
        setIsPlayingStudent(false);
      };
    } else {
      studentAudioRef.current = null;
    }

    return () => {
      if (studentAudioRef.current) studentAudioRef.current.pause();
    };
  }, [studentAudioUrl]);

  // إعداد مشغل صوت المعلم
  useEffect(() => {
    if (audioNoteUrl) {
      const audio = new Audio(audioNoteUrl);
      teacherAudioRef.current = audio;

      audio.onended = () => setIsPlayingTeacherAudio(false);
      audio.onerror = () => setIsPlayingTeacherAudio(false);
    } else {
      teacherAudioRef.current = null;
    }

    return () => {
      if (teacherAudioRef.current) teacherAudioRef.current.pause();
    };
  }, [audioNoteUrl]);

  const togglePlayStudent = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!studentAudioRef.current) return;

    if (isPlayingStudent) {
      studentAudioRef.current.pause();
      setIsPlayingStudent(false);
    } else {
      studentAudioRef.current.play()
        .then(() => setIsPlayingStudent(true))
        .catch(err => {
          console.error('Playback error:', err);
          setIsPlayingStudent(false);
        });
    }
  };

  const togglePlayTeacher = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!teacherAudioRef.current) return;

    if (isPlayingTeacherAudio) {
      teacherAudioRef.current.pause();
      setIsPlayingTeacherAudio(false);
    } else {
      teacherAudioRef.current.play()
        .then(() => setIsPlayingTeacherAudio(true))
        .catch(err => {
          console.error('Teacher audio play error:', err);
          setIsPlayingTeacherAudio(false);
        });
    }
  };

  // تسجيل تعليق صوتي تشجيعي من المعلم
  const startTeacherRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      teacherStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      teacherMediaRecorderRef.current = mediaRecorder;
      teacherChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          teacherChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200);
      setIsRecordingTeacher(true);
      setTeacherRecSeconds(0);

      teacherTimerRef.current = setInterval(() => {
        setTeacherRecSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error recording teacher voice note:', err);
    }
  };

  const stopTeacherRecording = async () => {
    if (!teacherMediaRecorderRef.current || !isRecordingTeacher) return;

    if (teacherTimerRef.current) clearInterval(teacherTimerRef.current);
    setIsRecordingTeacher(false);

    const recorder = teacherMediaRecorderRef.current;
    recorder.onstop = async () => {
      try {
        const blob = new Blob(teacherChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (teacherStreamRef.current) {
          teacherStreamRef.current.getTracks().forEach(t => t.stop());
          teacherStreamRef.current = null;
        }

        const uploadedUrl = await uploadWorksheetAudio(blob, `teacher_feedback_${Date.now()}.webm`);
        if (uploadedUrl) {
          setAudioNoteUrl(uploadedUrl);
        }
      } catch (e) {
        console.error('Error saving teacher audio note:', e);
      }
    };

    recorder.stop();
  };

  // حفظ التعديل
  const handleSaveEvaluation = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateGradeAndFeedback(currentScore, textNote, audioNoteUrl);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error('Failed to save evaluation:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* مشغل الصوت المدمج فوق السؤال */}
      <div 
        className="w-full h-full flex flex-col justify-between p-1 bg-violet-50/95 border-2 border-violet-400 rounded-lg text-slate-900 select-none cursor-pointer hover:bg-violet-100/90 transition shadow-xs"
        onClick={() => setShowReviewModal(true)}
      >
        <div className="flex items-center justify-between text-[9px] font-bold">
          <span className="text-violet-900 flex items-center gap-1">
            <span>🎙️</span>
            <span>قراءة الطالب</span>
          </span>
          <span className="bg-violet-600 text-white px-1 rounded text-[8px]">
            {currentScore} / {maxPoints}د
          </span>
        </div>

        {/* مشغل صوت الطالب المصغر */}
        <div className="flex items-center justify-center gap-1.5 my-0.5">
          {studentAudioUrl ? (
            <button
              type="button"
              onClick={togglePlayStudent}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition shadow ${
                isPlayingStudent ? 'bg-amber-500 text-white animate-pulse' : 'bg-violet-600 text-white hover:bg-violet-700'
              }`}
              title="استمع لتسجيل الطالب"
            >
              {isPlayingStudent ? '⏸️' : '▶️'}
            </button>
          ) : (
            <span className="text-[9px] text-slate-400 font-medium">لم يسجل الطالب</span>
          )}

          {studentAudioUrl && (
            <div className="flex-1 bg-violet-200 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-violet-600 h-full transition-all"
                style={{ width: `${studentProgress}%` }}
              />
            </div>
          )}
        </div>

        <div className="text-center text-[8px] text-violet-700 font-bold truncate">
          انقر للتقييم والتغذية الراجعة 🔍
        </div>
      </div>

      {/* نافذة التقييم والمقارنة التفصيلية للمعلم */}
      {showReviewModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-900"
          dir="rtl"
          onClick={() => setShowReviewModal(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-violet-100 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* رأس النافذة */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎙️</span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    تحكيم قراءة الطالب وتقييم المهمة الصوتية
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    الدرجة المقررة: {maxPoints} درجات
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* النص المشكول المطلوب قراءته للمقارنة */}
            <div className="my-4 bg-violet-50 p-4 rounded-2xl border border-violet-200 text-right">
              <span className="text-[11px] font-bold text-violet-700 block mb-1">
                📖 النص المشكول المرجعي المطلوب من الطالب قراءته:
              </span>
              <p className="text-lg font-serif font-black text-slate-900 leading-relaxed">
                {element.targetText || 'لم يتم إدخال نص مشكول محدد لهذا السؤال.'}
              </p>
            </div>

            {/* مشغل تسجيل قراءة الطالب */}
            <div className="mb-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                🎧 الاستماع لتسجيل الطالب:
              </span>
              {studentAudioUrl ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlayStudent}
                    className={`px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 transition ${
                      isPlayingStudent ? 'bg-amber-500 animate-pulse' : 'bg-violet-600 hover:bg-violet-700'
                    }`}
                  >
                    <span>{isPlayingStudent ? '⏸️ إيقاف' : '▶️ استماع للتسجيل'}</span>
                  </button>
                  <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-violet-600 h-full transition-all"
                      style={{ width: `${studentProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-rose-600 font-bold bg-rose-50 p-2 rounded-lg text-center">
                  ⚠️ لم يقم الطالب برفع أو تسجيل صوته لهذا السؤال.
                </div>
              )}
            </div>

            {/* تعديل الدرجة المستحقة */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الدرجة الممنوحة للطالب:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={maxPoints}
                  value={currentScore}
                  onChange={(e) => setCurrentScore(Math.min(maxPoints, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-20 bg-slate-50 border border-slate-300 rounded-xl p-2 text-center font-bold text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <span className="text-xs font-semibold text-slate-500">من أصل {maxPoints} درجات</span>

                {/* أزرار سريعة */}
                <div className="flex items-center gap-1 mr-auto">
                  <button
                    type="button"
                    onClick={() => setCurrentScore(maxPoints)}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition"
                  >
                    درجة كاملة ({maxPoints})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentScore(Math.round(maxPoints / 2))}
                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition"
                  >
                    نصف الدرجة ({Math.round(maxPoints / 2)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentScore(0)}
                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition"
                  >
                    صفر
                  </button>
                </div>
              </div>
            </div>

            {/* ملاحظة المعلم التشجيعية (نصية + صوتية) */}
            <div className="space-y-3 mb-5 border-t border-slate-100 pt-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  💬 تعليق المعلم النصي التشجيعي:
                </label>
                <input
                  type="text"
                  value={textNote}
                  onChange={(e) => setTextNote(e.target.value)}
                  placeholder="مثال: قراءة ممتازة يا بطل! انتبه فقط لمخرج حرف الثاء..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
              </div>

              {/* تعليق صوتي من المعلم */}
              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                <span className="text-xs font-bold text-amber-900 block mb-1.5">
                  🎙️ تسجيل ملاحظة صوتية تشجيعية للطالب بصوتك:
                </span>
                
                <div className="flex items-center gap-2">
                  {isRecordingTeacher ? (
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                      <span className="text-xs font-bold text-rose-600 font-mono">
                        {teacherRecSeconds} ثانية
                      </span>
                      <button
                        type="button"
                        onClick={stopTeacherRecording}
                        className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold transition hover:bg-rose-700"
                      >
                        ⏹️ إنهاء التسجيل
                      </button>
                    </div>
                  ) : audioNoteUrl ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={togglePlayTeacher}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <span>{isPlayingTeacherAudio ? '⏸️' : '▶️'}</span>
                        <span>تشغيل ملاحظتك</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAudioNoteUrl('')}
                        className="text-xs text-rose-600 hover:underline font-bold"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startTeacherRecording}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition"
                    >
                      <span>🎙️</span>
                      <span>سجل كلمة تشجيعية</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* أزرار الحفظ والإغلاق */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveEvaluation}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition active:scale-95 disabled:opacity-50"
              >
                <span>{isSaving ? 'جارِ الحفظ...' : saveSuccess ? '✓ تم حفظ التقييم بنجاح' : '💾 حفظ التقييم وتحديث الدرجة'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
