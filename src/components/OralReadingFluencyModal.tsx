import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Mic, MicOff, Square, Play, RefreshCw, Printer, Award, 
  CheckCircle2, AlertTriangle, TrendingUp, Volume2, Sparkles, 
  Clock, BookOpen, Layers, Check, BarChart3, HelpCircle, Star
} from 'lucide-react';
import { 
  UserProfile, GradeLevel, ArabicTrack, ORFAssessmentSession, 
  ORFPassage, ORFWordAnnotation, ORFErrorCategory, ORFBenchmarkLevel 
} from '../types';
import { 
  ORF_STANDARD_PASSAGES, 
  ORF_GRADE_BENCHMARKS, 
  evaluateORFPerformance, 
  detectArabicPhoneticError 
} from '../data/orfBenchmarkData';
import { saveORFSession } from '../storage';
import { getGradeLabel } from '../utils/gradebookExport';

interface OralReadingFluencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  targetStudent?: UserProfile;
  onSessionCompleted?: (session: ORFAssessmentSession) => void;
}

export const OralReadingFluencyModal: React.FC<OralReadingFluencyModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetStudent,
  onSessionCompleted,
}) => {
  // الطالب محل التقييم (سواء كان الطالب نفسه يقرأ أو المعلم يقيّم طالباً)
  const student = targetStudent || currentUser;
  const isTeacherAssessor = currentUser.role === 'teacher' || currentUser.role === 'hod' || currentUser.role === 'super_admin';

  // تحديد النصوص المناسبة لصف الطالب
  const studentGrade: GradeLevel = student.grade || 'grade-2';
  const availablePassages = ORF_STANDARD_PASSAGES.filter(
    p => p.targetGrade.includes(studentGrade) || p.targetGrade.includes('grade-2')
  );

  const [selectedPassage, setSelectedPassage] = useState<ORFPassage>(
    availablePassages[0] || ORF_STANDARD_PASSAGES[0]
  );

  // حالة التسجيل والتوقيت
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // تفكيك كلمات النص وتعيين الحالات
  const [wordAnnotations, setWordAnnotations] = useState<ORFWordAnnotation[]>([]);
  const [prosodyScore, setProsodyScore] = useState<number>(4); // مقياس النبر والتعبير 1-4
  const [isCertificateViewOpen, setIsCertificateViewOpen] = useState(false);
  const [completedSession, setCompletedSession] = useState<ORFAssessmentSession | null>(null);

  // مراجع التسجيل الصوتي بالمتصفح
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // تهيئة الكلمات عند تغيير النص
  useEffect(() => {
    if (!selectedPassage) return;
    const words = selectedPassage.text
      .replace(/[«»،.؟!:؛]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0);

    const initialAnnotations: ORFWordAnnotation[] = words.map((w, idx) => ({
      word: w,
      index: idx,
      status: 'correct',
    }));

    setWordAnnotations(initialAnnotations);
    setElapsedSeconds(0);
    setIsRecording(false);
    setHasCompleted(false);
    setAudioUrl(null);
    setCompletedSession(null);
    setIsCertificateViewOpen(false);
  }, [selectedPassage]);

  // عداد الوقت
  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  if (!isOpen) return null;

  // بدء التسجيل الصوتي
  const handleStartRecording = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          // إيقاف مسارات المايكروفون
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
      }
    } catch (err) {
      console.warn('Microphone access notice (simulation active):', err);
    }

    setIsRecording(true);
    setHasCompleted(false);
    setElapsedSeconds(0);
  };

  // إيقاف التسجيل وإنهاء الجلسة واحتساب النتيجة
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setHasCompleted(true);

    const finalDuration = Math.max(elapsedSeconds, 5); // حد أدنى 5 ثوانٍ
    computeAndSaveSession(finalDuration);
  };

  // النقر على الكلمة لتعديل حالتها (صحيحة / خطأ تشكيل / خطأ مد / همزة / متروكة)
  const handleToggleWordStatus = (index: number) => {
    setWordAnnotations(prev => {
      const updated = [...prev];
      const current = updated[index];
      if (current.status === 'correct') {
        current.status = 'error';
        current.errorCategory = 'short_vowels';
      } else if (current.status === 'error' && current.errorCategory === 'short_vowels') {
        current.errorCategory = 'long_vowels';
      } else if (current.status === 'error' && current.errorCategory === 'long_vowels') {
        current.errorCategory = 'hamzat';
      } else if (current.status === 'error' && current.errorCategory === 'hamzat') {
        current.status = 'omitted';
        current.errorCategory = 'omission';
      } else {
        current.status = 'correct';
        current.errorCategory = undefined;
      }

      // إذا كانت الجلسة مكتملة، نعيد حساب الدرجة لحظياً
      if (hasCompleted) {
        setTimeout(() => computeAndSaveSession(Math.max(elapsedSeconds, 5)), 10);
      }

      return updated;
    });
  };

  // حساب النتيجة المعيارية وحفظ الجلسة
  const computeAndSaveSession = (durationSec: number) => {
    const totalWords = wordAnnotations.length;
    const wordsCorrect = wordAnnotations.filter(w => w.status === 'correct').length;
    const wordsRead = wordAnnotations.filter(w => w.status !== 'omitted').length;

    // حساب الـ WCPM المعياري: (الكلمات الصحيحة / عدد الثواني) * 60
    const rawWcpm = durationSec > 0 ? Math.round((wordsCorrect / durationSec) * 60) : 0;
    const wcpm = Math.max(0, rawWcpm);
    const accuracyRate = totalWords > 0 ? Math.round((wordsCorrect / totalWords) * 100) : 100;

    // تصنيف الأخطاء
    const errorBreakdown: Record<ORFErrorCategory, number> = {
      short_vowels: 0,
      long_vowels: 0,
      hamzat: 0,
      waqf_sukun: 0,
      shams_qamar: 0,
      omission: 0,
      addition: 0,
      hesitation: 0,
    };

    wordAnnotations.forEach(w => {
      if (w.errorCategory && errorBreakdown[w.errorCategory] !== undefined) {
        errorBreakdown[w.errorCategory]++;
      }
    });

    const evalResult = evaluateORFPerformance(wcpm, studentGrade);
    const certNum = `ORF-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const session: ORFAssessmentSession = {
      id: `orf_${Date.now()}`,
      studentId: student.id,
      studentName: student.name,
      grade: studentGrade,
      track: student.track,
      passageId: selectedPassage.id,
      passageTitle: selectedPassage.title,
      passageText: selectedPassage.text,
      totalWords,
      durationSeconds: durationSec,
      wordsRead,
      wordsCorrect,
      wcpm,
      accuracyRate,
      prosodyScore,
      assessorRole: isTeacherAssessor ? 'teacher_evaluated' : 'student_self',
      assessorName: currentUser.name,
      date: new Date().toISOString(),
      errorBreakdown,
      annotations: wordAnnotations,
      gradeBenchmarkLevel: evalResult.level,
      certificateNumber: certNum,
    };

    saveORFSession(session);
    setCompletedSession(session);
    onSessionCompleted?.(session);
  };

  const currentDuration = Math.max(elapsedSeconds, 1);
  const wordsCorrectCount = wordAnnotations.filter(w => w.status === 'correct').length;
  const liveWcpm = Math.round((wordsCorrectCount / currentDuration) * 60);
  const benchmarkInfo = evaluateORFPerformance(completedSession ? completedSession.wcpm : liveWcpm, studentGrade);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in" dir="rtl">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* الترويسة الرئيسية */}
        <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white px-6 py-4.5 border-b border-emerald-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center font-bold text-lg shadow-inner">
              🎙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">
                  مختبر الطلاقة القرائية المعياري (Oral Reading Fluency - ORF)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                  معيار WCPM العالمي
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                الطالب: <b className="text-white">{student.name}</b> • {getGradeLabel(studentGrade)} ({student.track === 'arabic-b' ? 'عرب B' : 'عرب A'})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* جسم النافذة */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

          {/* اختيار النص القرائي */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="text-[11px] font-bold text-slate-400 block">النص القرائي المشكول المعتمد:</span>
                <span className="text-xs font-extrabold text-slate-800">{selectedPassage.title}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">تغيير النص:</span>
              <select
                value={selectedPassage.id}
                onChange={(e) => {
                  const found = ORF_STANDARD_PASSAGES.find(p => p.id === e.target.value);
                  if (found) setSelectedPassage(found);
                }}
                disabled={isRecording}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-1.5 font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {ORF_STANDARD_PASSAGES.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.wordCount} كلمة)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* منصة القراءة التفاعلية وشاشة النص */}
          <div className="bg-white rounded-3xl p-6 border-2 border-emerald-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="font-extrabold text-xs text-slate-700">
                  لوحة تفكيك الكلمات ومطابقة النطق (انقر على أي كلمة لتغيير حالتها):
                </h3>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                <span className="text-emerald-700">🟢 صحيح</span>
                <span className="text-amber-700">🟡 حركات</span>
                <span className="text-blue-700">🔵 مدود</span>
                <span className="text-purple-700">🟣 همزات</span>
                <span className="text-rose-700">🔴 محذوف</span>
              </div>
            </div>

            {/* النص القرائي مفككاً بكلمات تفاعلية */}
            <div className="p-5 rounded-2xl bg-amber-50/30 border border-amber-200/60 leading-loose text-base sm:text-lg font-serif tracking-wide select-none">
              {wordAnnotations.map((item, idx) => {
                let badgeClass = 'bg-emerald-50 text-emerald-950 border-emerald-200 hover:bg-emerald-100';
                if (item.status === 'omitted') {
                  badgeClass = 'bg-rose-100 text-rose-900 border-rose-300 line-through opacity-70';
                } else if (item.status === 'error') {
                  if (item.errorCategory === 'short_vowels') {
                    badgeClass = 'bg-amber-100 text-amber-950 border-amber-300';
                  } else if (item.errorCategory === 'long_vowels') {
                    badgeClass = 'bg-blue-100 text-blue-950 border-blue-300';
                  } else if (item.errorCategory === 'hamzat') {
                    badgeClass = 'bg-purple-100 text-purple-950 border-purple-300';
                  } else {
                    badgeClass = 'bg-rose-100 text-rose-950 border-rose-300';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleToggleWordStatus(idx)}
                    className={`inline-block mx-1 my-1 px-2.5 py-1 rounded-xl border text-sm sm:text-base font-bold transition-all cursor-pointer shadow-2xs ${badgeClass}`}
                    title="انقر لتعديل نوع التعثر الصوتي للكلمة"
                  >
                    {item.word}
                  </button>
                );
              })}
            </div>

            {/* شريط التحكم بالتسجيل والمؤقت الحي */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-md shadow-emerald-600/30 cursor-pointer"
                  >
                    <Mic className="w-4 h-4 text-emerald-200 animate-pulse" />
                    <span>ابدأ القراءة والتسجيل 🎙️</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-md shadow-rose-600/30 cursor-pointer animate-pulse"
                  >
                    <Square className="w-4 h-4" />
                    <span>إيقاف واحتساب الطلاقة ⏹️</span>
                  </button>
                )}

                {hasCompleted && audioUrl && (
                  <audio src={audioUrl} controls className="h-9 max-w-[200px]" />
                )}
              </div>

              {/* المؤقت وعداد السرعة المباشر */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-xs">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="font-bold text-slate-800">
                    {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400 font-bold block">معدل WCPM التقديري</span>
                  <span className="text-base font-black text-emerald-600">
                    {hasCompleted && completedSession ? completedSession.wcpm : liveWcpm} <span className="text-[10px] font-normal text-slate-400">ك/د</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* لوحة النتائج والتحليل الصوتي المعياري عند اكتمال الجلسة */}
          {hasCompleted && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      نتيجة اختبار الطلاقة القرائية الشفهية المعتمدة
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      مقارنة الأداء الفعلي بالمعايير العالمية للكلمات الصحيحة في الدقيقة (WCPM).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCertificateViewOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer self-start sm:self-auto"
                  >
                    <Award className="w-4 h-4" />
                    <span>عرض وطباعة الشهادة الرسمية 📜</span>
                  </button>
                </div>

                {/* كروت المؤشرات الأربعة */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">معدل الطلاقة الفعلي</span>
                    <span className="text-2xl font-black text-emerald-600">
                      {completedSession?.wcpm} <span className="text-xs font-normal text-slate-500">WCPM</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">كلمة صحيحة في الدقيقة</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">دقة الضبط الصوتي</span>
                    <span className="text-2xl font-black text-indigo-600">
                      {completedSession?.accuracyRate}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      ({completedSession?.wordsCorrect} من {completedSession?.totalWords} كلمة)
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">التصنيف المعياري للصف</span>
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-black mt-1 ${benchmarkInfo.badgeColor}`}>
                      {benchmarkInfo.labelAr.split('(')[0]}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-1">الرتبة المئينية: ~{benchmarkInfo.percentileApprox}%</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">النبر والتعبير (Prosody)</span>
                    <div className="flex items-center gap-1 mt-1 text-amber-500">
                      {[1, 2, 3, 4].map(star => (
                        <Star
                          key={star}
                          onClick={() => setProsodyScore(star)}
                          className={`w-4 h-4 cursor-pointer transition ${star <= prosodyScore ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-1">مقياس 1-4 لسلامة الوقف</span>
                  </div>
                </div>

                {/* تشخيص مواضع التعثر الصوتي */}
                <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200 space-y-2">
                  <span className="text-xs font-black text-amber-900 block">
                    الكشف التلقائي عن مواضع التعثر الصوتي:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                      <span className="text-slate-500 text-[11px] block">أخطاء الحركات القصيرة:</span>
                      <span className="font-extrabold text-amber-800 text-sm">
                        {completedSession?.errorBreakdown.short_vowels || 0} كلمة
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                      <span className="text-slate-500 text-[11px] block">أخطاء المدود الطويلة:</span>
                      <span className="font-extrabold text-blue-800 text-sm">
                        {completedSession?.errorBreakdown.long_vowels || 0} كلمة
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                      <span className="text-slate-500 text-[11px] block">أخطاء همزات الوصل/القطع:</span>
                      <span className="font-extrabold text-purple-800 text-sm">
                        {completedSession?.errorBreakdown.hamzat || 0} كلمة
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                      <span className="text-slate-500 text-[11px] block">الكلمات المتروكة أو المحذوفة:</span>
                      <span className="font-extrabold text-rose-800 text-sm">
                        {completedSession?.errorBreakdown.omission || 0} كلمة
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 pt-1">
                    • <b>التوجيه التربوي:</b> {benchmarkInfo.comparisonText}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* الشريط السفلي */}
        <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400 font-medium">
            المعيار مستند إلى اختبارات WCPM المقننة للمرحلة الابتدائية باللغة العربية.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* نافذة شهادة الطلاقة القرائية الرسمية القابلة للطباعة (window.print) */}
      {/* ========================================================================= */}
      {isCertificateViewOpen && completedSession && (
        <div className="fixed inset-0 z-60 bg-slate-950/90 flex items-center justify-center p-4 animate-fade-in overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl border-4 border-amber-400 relative">
            <button
              onClick={() => setIsCertificateViewOpen(false)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-700 print:hidden cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* محتوى الشهادة */}
            <div id="orf-printable-certificate" className="text-center space-y-6 p-4">
              <div className="border-b-2 border-amber-400 pb-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                  منصة تعلّم مع موسى • الاعتماد الأكاديمي للطلاقة القرائية
                </span>
                <h1 className="text-2xl font-black text-slate-900 mt-1">
                  شهادة مقياس الطلاقة القرائية الشفهية (ORF)
                </h1>
                <span className="text-xs font-bold text-amber-600 block mt-1">
                  Oral Reading Fluency Certificate of Mastery
                </span>
              </div>

              <div className="space-y-2 py-2">
                <p className="text-xs text-slate-500">يشهد قسم اللغة العربية والتعليم التفاعلي بأن الطالب/ـة:</p>
                <h2 className="text-2xl font-black text-indigo-900 border-b border-dashed border-slate-300 pb-2 inline-block px-8">
                  {student.name}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  المقيد بالصف: <b>{getGradeLabel(studentGrade)}</b> قد أتم اختبار القراءة الشفهية المعياري بنجاح:
                </p>
              </div>

              {/* جدول الدرجات في الشهادة */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">معدل الطلاقة (WCPM)</span>
                  <span className="text-2xl font-black text-emerald-700">{completedSession.wcpm}</span>
                  <span className="text-[10px] text-slate-500 block">كلمة/دقيقة</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">نسبة الدقة اللغوية</span>
                  <span className="text-2xl font-black text-indigo-700">{completedSession.accuracyRate}%</span>
                  <span className="text-[10px] text-slate-500 block">ضبط الحركات</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">التقييم المعياري</span>
                  <span className="text-sm font-black text-amber-700 block mt-1">
                    {benchmarkInfo.labelAr.split('(')[0]}
                  </span>
                  <span className="text-[10px] text-slate-500 block">مستوى متقدم</span>
                </div>
              </div>

              <div className="text-xs text-slate-600 leading-relaxed max-w-lg mx-auto">
                <p>
                  النص المقروء: «{completedSession.passageTitle}» • عدد الكلمات: {completedSession.totalWords} كلمة في زمن {completedSession.durationSeconds} ثانية.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">معلم المادة / الفاحص:</span>
                  <span className="font-bold text-slate-800">{completedSession.assessorName}</span>
                  <div className="h-6"></div>
                  <span className="text-[10px] text-slate-400">التوقيع: ..........................</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">رقم الشهادة المعتمد:</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm block">
                    {completedSession.certificateNumber}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    تاريخ الإصدار: {new Date(completedSession.date).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>طباعة الشهادة الآن 🖨️</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCertificateViewOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
