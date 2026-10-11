import React, { useState, useRef, useEffect } from 'react';
import { WorksheetElement } from '../../types';
import { uploadWorksheetAudio } from '../../services/worksheetService';

interface WorksheetAudioRecorderProps {
  element: WorksheetElement;
  currentAudioUrl?: string;
  onSaveAudio: (audioUrl: string) => void;
  onRemoveAudio: () => void;
  isGraded?: boolean;
  result?: { isCorrect: boolean; pointsEarned: number; expected?: any; studentAnswer?: any };
}

export const WorksheetAudioRecorder: React.FC<WorksheetAudioRecorderProps> = ({
  element,
  currentAudioUrl,
  onSaveAudio,
  onRemoveAudio,
  isGraded = false,
  result
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [showExpandedModal, setShowExpandedModal] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // تنظيف المؤقت والمسارات عند إلغاء التركيب
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
    };
  }, []);

  // تحديث مشغل الصوت عند تغير currentAudioUrl
  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
      setAudioProgress(0);
    }
    if (currentAudioUrl) {
      const audio = new Audio(currentAudioUrl);
      audioElementRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration && !isNaN(audio.duration)) {
          setAudioProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.onended = () => {
        setIsPlaying(false);
        setAudioProgress(0);
      };

      audio.onerror = () => {
        setIsPlaying(false);
      };
    } else {
      audioElementRef.current = null;
    }
  }, [currentAudioUrl]);

  // بدء التسجيل الصوتي
  const startRecording = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isGraded) return;
    setMicError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicError('المتصفح لا يدعم ميزة التسجيل الصوتي.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      setMicError('تعذر الوصول للميكروفون، يرجى السماح بالإذن في المتصفح.');
    }
  };

  // إيقاف التسجيل الصوتي وحفظه
  const stopRecording = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!mediaRecorderRef.current || !isRecording) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    setIsUploading(true);

    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        
        // إيقاف مسارات الميكروفون لتحرير العتاد
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }

        // رفع الملف أو تحويله إلى Data URL
        const uploadedUrl = await uploadWorksheetAudio(audioBlob);
        if (uploadedUrl) {
          onSaveAudio(uploadedUrl);
        }
      } catch (err) {
        console.error('Error saving audio recording:', err);
      } finally {
        setIsUploading(false);
      }
    };

    try {
      recorder.stop();
    } catch {
      setIsUploading(false);
    }
  };

  // تشغيل / إيقاف الصوت المسجل
  const togglePlayAudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!audioElementRef.current) return;

    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Audio play error:', err);
          setIsPlaying(false);
        });
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div 
        className="w-full h-full relative flex flex-col justify-between p-1 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* شريط الإشعار أو حالة السؤال */}
        <div className="flex items-center justify-between text-[10px] w-full font-bold">
          <span className="flex items-center gap-1 text-violet-800">
            <span>🎙️</span>
            <span className="truncate max-w-[80px]">
              {element.label || 'تسجيل صوتي'}
            </span>
          </span>

          {/* زر تكبير لقراءة النص بوضوح */}
          {element.targetText && (
            <button
              type="button"
              onClick={() => setShowExpandedModal(true)}
              className="text-[9px] bg-violet-100 hover:bg-violet-200 text-violet-800 px-1.5 py-0.5 rounded transition"
              title="عرض النص المشكول للقراءة"
            >
              📖 النص
            </button>
          )}
        </div>

        {/* جسم التحكم في التسجيل والاستماع */}
        <div className="flex-1 flex flex-col items-center justify-center py-0.5">
          {/* خطأ الميكروفون */}
          {micError && (
            <div className="text-[9px] text-rose-700 bg-rose-50 p-1 rounded text-center w-full truncate mb-1">
              {micError}
            </div>
          )}

          {/* حالة جارِ التحميل أو الرفع */}
          {isUploading && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-violet-700">
              <span className="animate-spin inline-block">⏳</span>
              <span>جارِ الحفظ...</span>
            </div>
          )}

          {/* حالة التسجيل قيد العمل */}
          {isRecording && !isUploading && (
            <div className="flex items-center justify-center gap-2 w-full">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
              <span className="font-mono text-xs font-black text-rose-600">
                {formatTime(recordingSeconds)}
              </span>
              <button
                type="button"
                onClick={stopRecording}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-full shadow transition flex items-center gap-1 active:scale-95"
              >
                <span>⏹️</span>
                <span>إنهاء</span>
              </button>
            </div>
          )}

          {/* حالة تم التسجيل مسبقاً (يوجد صوت) */}
          {!isRecording && !isUploading && currentAudioUrl && (
            <div className="flex items-center justify-between gap-1 w-full bg-white/90 backdrop-blur-sm p-1 rounded-lg border border-violet-200 shadow-xs">
              {/* زر التشغيل والإيقاف */}
              <button
                type="button"
                onClick={togglePlayAudio}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition shadow-sm ${
                  isPlaying
                    ? 'bg-amber-500 text-white animate-pulse'
                    : 'bg-violet-600 hover:bg-violet-700 text-white'
                }`}
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التسجيل'}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>

              {/* شريط التقدم الزمني */}
              <div className="flex-1 px-1">
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-violet-600 h-full transition-all"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
                <div className="text-[9px] text-slate-500 text-center font-semibold mt-0.5">
                  {isPlaying ? 'جارِ الاستماع...' : 'تسجيل جاهز ✓'}
                </div>
              </div>

              {/* زر الحذف وإعادة المحاولة في حال لم يتم التسليم النهائي */}
              {!isGraded && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (audioElementRef.current) audioElementRef.current.pause();
                    setIsPlaying(false);
                    onRemoveAudio();
                  }}
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition text-xs"
                  title="حذف وإعادة التسجيل"
                >
                  🗑️
                </button>
              )}
            </div>
          )}

          {/* حالة لم يتم التسجيل بعد */}
          {!isRecording && !isUploading && !currentAudioUrl && (
            <button
              type="button"
              disabled={isGraded}
              onClick={startRecording}
              className={`w-full py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs ${
                isGraded
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-violet-600 hover:bg-violet-700 active:scale-95 text-white'
              }`}
            >
              <span>🎙️</span>
              <span className="truncate">ابدأ تسجيل القراءة</span>
            </button>
          )}
        </div>

        {/* عرض النتيجة في حال تم التصحيح */}
        {isGraded && result && (
          <div className="text-[9px] font-bold text-center mt-0.5 pt-0.5 border-t border-violet-200/60 truncate">
            {result.isCorrect ? (
              <span className="text-emerald-700">✓ تم تقييم التسجيل ({result.pointsEarned} درجة)</span>
            ) : (
              <span className="text-rose-700">لم يتم إرفاق تسجيل</span>
            )}
          </div>
        )}
      </div>

      {/* نافذة القراءة الموسعة المريحة للطالب لعرض النص المشكول وتسجيل صوته بوضوح */}
      {showExpandedModal && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-900" 
          dir="rtl"
          onClick={() => setShowExpandedModal(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-violet-100 animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎙️</span>
                <h3 className="font-extrabold text-slate-900 text-base">
                  مهمة القراءة والتسجيل الصوتي
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExpandedModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* النص المشكول المطلوب قراءته */}
            <div className="my-5 bg-violet-50/70 p-5 rounded-2xl border border-violet-200 text-center">
              <span className="text-xs font-bold text-violet-700 block mb-2">
                📖 اقرأ النص التالي بصوت واضح ومشكل:
              </span>
              <p className="text-xl sm:text-2xl font-serif font-black text-slate-900 leading-loose tracking-wide">
                {element.targetText || 'لا يوجد نص محدد، قم بقراءة السؤال الموضح على الورقة.'}
              </p>
            </div>

            {/* عناصر التحكم في التسجيل داخل النافذة المنبثقة */}
            <div className="flex flex-col items-center justify-center gap-4 py-2">
              {isRecording ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-rose-600 font-bold text-sm bg-rose-50 px-4 py-2 rounded-full border border-rose-200">
                    <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                    <span>جارِ التسجيل الآن:</span>
                    <span className="font-mono text-base font-black">{formatTime(recordingSeconds)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl shadow-lg transition active:scale-95 flex items-center gap-2"
                  >
                    <span>⏹️</span>
                    <span>إنهاء وحفظ التسجيل</span>
                  </button>
                </div>
              ) : currentAudioUrl ? (
                <div className="w-full flex flex-col items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <span>✓</span>
                    <span>تم حفظ تسجيل قراءتك بنجاح! يمكنك الاستماع إليه أدناه:</span>
                  </span>
                  <div className="flex items-center gap-3 w-full">
                    <button
                      type="button"
                      onClick={togglePlayAudio}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl flex items-center gap-2 transition"
                    >
                      <span>{isPlaying ? '⏸️ إيقاف' : '▶️ استماع'}</span>
                    </button>
                    <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-violet-600 h-full transition-all"
                        style={{ width: `${audioProgress}%` }}
                      />
                    </div>
                  </div>
                  {!isGraded && (
                    <button
                      type="button"
                      onClick={() => {
                        if (audioElementRef.current) audioElementRef.current.pause();
                        setIsPlaying(false);
                        onRemoveAudio();
                      }}
                      className="text-xs text-rose-600 hover:underline flex items-center gap-1 mt-1 font-bold"
                    >
                      <span>🗑️ حذف وإعادة التسجيل من جديد</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isGraded}
                  onClick={startRecording}
                  className="px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white font-black text-sm rounded-2xl shadow-lg transition active:scale-95 flex items-center gap-2"
                >
                  <span className="text-lg">🎙️</span>
                  <span>ابدأ تسجيل قراءتك الآن</span>
                </button>
              )}
            </div>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setShowExpandedModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs"
              >
                العودة لورقة العمل
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
