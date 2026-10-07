import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Mic, MicOff, Square, Play, RefreshCw, Printer, Award, 
  CheckCircle2, AlertTriangle, TrendingUp, Volume2, Sparkles, 
  Clock, BookOpen, Layers, Check, BarChart3, HelpCircle, Star,
  Loader2, Info, Edit3, ArrowRight, Wand2, Sliders, ChevronDown, RotateCcw
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
import { saveORFSession, getStudentORFAssignments } from '../storage';
import { getGradeLabel } from '../utils/gradebookExport';
import { evaluateOralReadingWithAI, evaluateOralReadingLocally } from '../geminiService';

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

  // التكليفات المسندة للطالب من المعلم
  const assignedTasks = useMemo(() => {
    return getStudentORFAssignments(student.id, student.grade);
  }, [student.id, student.grade]);

  useEffect(() => {
    if (assignedTasks.length > 0) {
      const matched = ORF_STANDARD_PASSAGES.find(p => p.id === assignedTasks[0].passageId);
      if (matched && selectedPassage.id !== matched.id) {
        setSelectedPassage(matched);
      }
    }
  }, [assignedTasks]);

  // حالة التسجيل والتوقيت
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // مخرجات التعرف الصوتي الحي والمحكم الذكي
  const [liveSpokenTranscript, setLiveSpokenTranscript] = useState<string>('');
  const [aiDiagnosticNote, setAiDiagnosticNote] = useState<string | null>(null);

  // تفكيك كلمات النص وتعيين الحالات (الحالة المبدئية pending نظيفة بدون علامات صح مسبقة)
  const [wordAnnotations, setWordAnnotations] = useState<ORFWordAnnotation[]>([]);
  const [prosodyScore, setProsodyScore] = useState<number>(4); // مقياس النبر والتعبير 1-4
  const [isCertificateViewOpen, setIsCertificateViewOpen] = useState(false);
  const [completedSession, setCompletedSession] = useState<ORFAssessmentSession | null>(null);

  // الكلمة المحددة حالياً للفحص والتعديل اليدوي السريع
  const [activeInspectorIndex, setActiveInspectorIndex] = useState<number | null>(null);

  // مراجع التسجيل الصوتي بالمتصفح
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const recognitionRef = useRef<any>(null);
  const spokenTranscriptRef = useRef<string>('');
  const timerIntervalRef = useRef<any>(null);
  const isRecordingRef = useRef<boolean>(false);

  // استخراج الكلمات المشكولة الأصلية للنص
  const getPassageWords = (text: string): string[] => {
    return text
      .replace(/[«»،.؟!:؛]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0);
  };

  // تهيئة الكلمات عند تغيير النص كحالة محايدة غير مختبرة بعد (pending)
  useEffect(() => {
    if (!selectedPassage) return;
    const words = getPassageWords(selectedPassage.text);

    const initialAnnotations: ORFWordAnnotation[] = words.map((w, idx) => ({
      word: w,
      index: idx,
      status: 'pending', // تبدأ محايدة ونظيفة تماماً بدون أي علامات صح سابقة
    }));

    setWordAnnotations(initialAnnotations);
    setElapsedSeconds(0);
    setIsRecording(false);
    setIsAnalyzing(false);
    setHasCompleted(false);
    setAudioUrl(null);
    setLiveSpokenTranscript('');
    setAiDiagnosticNote(null);
    setCompletedSession(null);
    setIsCertificateViewOpen(false);
    setActiveInspectorIndex(null);
    spokenTranscriptRef.current = '';
    recordedBlobRef.current = null;
    isRecordingRef.current = false;
  }, [selectedPassage]);

  // عداد الوقت أثناء التسجيل
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

  // تنظيف الموارد عند إغلاق المودال
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // إعادة القراءة والمحاولة من جديد (تصفير كامل وإعادة الطفل لوضع البداية)
  const handleResetAndRetry = () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsAnalyzing(false);
    setHasCompleted(false);
    setElapsedSeconds(0);
    setAudioUrl(null);
    setLiveSpokenTranscript('');
    setAiDiagnosticNote(null);
    setCompletedSession(null);
    setIsCertificateViewOpen(false);
    setActiveInspectorIndex(null);
    spokenTranscriptRef.current = '';
    recordedBlobRef.current = null;
    audioChunksRef.current = [];

    const words = getPassageWords(selectedPassage.text);
    const resetAnnotations: ORFWordAnnotation[] = words.map((w, idx) => ({
      word: w,
      index: idx,
      status: 'pending', // عودة الكلمات للوضع المحايد
    }));
    setWordAnnotations(resetAnnotations);
  };

  // دالة مساعدة لتحويل Blob إلى Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        const base64 = res.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  };

  // بدء التسجيل الصوتي الحقيقي + تفعيل Speech Recognition المباشر
  const handleStartRecording = async () => {
    spokenTranscriptRef.current = '';
    setLiveSpokenTranscript('');
    setAiDiagnosticNote(null);
    setHasCompleted(false);
    setElapsedSeconds(0);
    recordedBlobRef.current = null;
    audioChunksRef.current = [];
    isRecordingRef.current = true;
    setActiveInspectorIndex(null);

    // إعادة ضبط الكلمات إلى وضع الانتظار المحايد قبل التقييم
    const words = getPassageWords(selectedPassage.text);
    setWordAnnotations(words.map((w, idx) => ({
      word: w,
      index: idx,
      status: 'pending',
    })));

    // 1. تشغيل الميكروفون الحقيقي عبر MediaRecorder بتدفق زمني مستمر (250ms chunks)
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
        
        let mime = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mime = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mime = 'audio/mp4';
        }

        const mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(250); // تجميع كل 250 ميلي ثانية لضمان توفر البيانات دائماً
      }
    } catch (err) {
      console.warn('Microphone access notice:', err);
    }

    // 2. تشغيل محرك التعرف الصوتي للغة العربية الفصحى (Web Speech API)
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      try {
        const recognition = new SpeechRecognitionClass();
        recognition.lang = 'ar-SA';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + ' ';
          }
          const trimmed = fullTranscript.trim();
          spokenTranscriptRef.current = trimmed;
          setLiveSpokenTranscript(trimmed);
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition warning:', e);
        };

        recognition.onend = () => {
          // إعادة التشغيل تلقائياً طالما أن المستخدم ما زال في وضع التسجيل
          if (isRecordingRef.current) {
            try { recognition.start(); } catch {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (recErr) {
        console.warn('Speech recognition start failed:', recErr);
      }
    }

    setIsRecording(true);
  };

  // إيقاف التسجيل وتفعيل التحكيم الصوتي الذكي الحقيقي
  const handleStopRecording = async () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsAnalyzing(true);

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    // إيقاف MediaRecorder وانتظار تجميع Blob
    let audioBlob: Blob | null = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      audioBlob = await new Promise<Blob | null>((resolve) => {
        const recorder = mediaRecorderRef.current!;
        recorder.onstop = () => {
          try {
            const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
            recordedBlobRef.current = blob;
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            // إيقاف مسارات الميكروفون
            if (recorder.stream) {
              recorder.stream.getTracks().forEach(t => t.stop());
            }
            resolve(blob);
          } catch {
            resolve(null);
          }
        };
        try {
          recorder.stop();
        } catch {
          resolve(null);
        }
      });
    }

    const finalDuration = Math.max(elapsedSeconds, 1);
    let audioBase64 = '';
    if (audioBlob) {
      audioBase64 = await blobToBase64(audioBlob);
    } else if (recordedBlobRef.current) {
      audioBase64 = await blobToBase64(recordedBlobRef.current);
    }

    const passageWords = getPassageWords(selectedPassage.text);
    const spokenText = spokenTranscriptRef.current.trim();

    try {
      // استدعاء محكم الطلاقة الذكي الحقيقي (Gemini 3.8 Flash مع الاستماع الصوتي المباشر والتحكيم المقطعي)
      const evalResult = await evaluateOralReadingWithAI({
        passageText: selectedPassage.text,
        passageWords,
        spokenTranscript: spokenText,
        durationSeconds: finalDuration,
        audioBase64: audioBase64 || undefined,
        audioMimeType: mediaRecorderRef.current?.mimeType || 'audio/webm',
        gradeLevel: studentGrade,
      });

      setWordAnnotations(evalResult.annotations);
      setProsodyScore(evalResult.prosodyScore);
      setAiDiagnosticNote(evalResult.qualitativeFeedback);
      if (evalResult.spokenTranscript) {
        setLiveSpokenTranscript(evalResult.spokenTranscript);
      }

      const benchmarkLevelInfo = evaluateORFPerformance(evalResult.wcpm, studentGrade);
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
        totalWords: passageWords.length,
        durationSeconds: finalDuration,
        wordsRead: evalResult.wordsRead,
        wordsCorrect: evalResult.wordsCorrect,
        wcpm: evalResult.wcpm,
        accuracyRate: evalResult.accuracyRate,
        prosodyScore: evalResult.prosodyScore,
        assessorRole: isTeacherAssessor ? 'teacher_evaluated' : 'student_self',
        assessorName: currentUser.name,
        date: new Date().toISOString(),
        errorBreakdown: evalResult.errorBreakdown,
        annotations: evalResult.annotations,
        gradeBenchmarkLevel: benchmarkLevelInfo.level,
        certificateNumber: certNum,
        spokenTranscript: evalResult.spokenTranscript || spokenText,
        aiDiagnosticNote: evalResult.qualitativeFeedback,
      };

      saveORFSession(session);
      setCompletedSession(session);
      onSessionCompleted?.(session);
    } catch (evalErr) {
      console.warn('[ORF Evaluator] تعذر التحكيم عبر السحابة، اعتماد التحكيم الصوتي الخوارزمي المحلي 100%:', evalErr);
      const fallbackResult = evaluateOralReadingLocally({
        passageWords,
        spokenTranscript: spokenText,
        durationSeconds: finalDuration,
      });

      setWordAnnotations(fallbackResult.annotations);
      setProsodyScore(fallbackResult.prosodyScore);
      setAiDiagnosticNote(fallbackResult.qualitativeFeedback);
      if (fallbackResult.spokenTranscript) {
        setLiveSpokenTranscript(fallbackResult.spokenTranscript);
      }

      const benchmarkLevelInfo = evaluateORFPerformance(fallbackResult.wcpm, studentGrade);
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
        totalWords: passageWords.length,
        durationSeconds: finalDuration,
        wordsRead: fallbackResult.wordsRead,
        wordsCorrect: fallbackResult.wordsCorrect,
        wcpm: fallbackResult.wcpm,
        accuracyRate: fallbackResult.accuracyRate,
        prosodyScore: fallbackResult.prosodyScore,
        assessorRole: isTeacherAssessor ? 'teacher_evaluated' : 'student_self',
        assessorName: currentUser.name,
        date: new Date().toISOString(),
        errorBreakdown: fallbackResult.errorBreakdown,
        annotations: fallbackResult.annotations,
        gradeBenchmarkLevel: benchmarkLevelInfo.level,
        certificateNumber: certNum,
        spokenTranscript: fallbackResult.spokenTranscript || spokenText,
        aiDiagnosticNote: fallbackResult.qualitativeFeedback,
      };

      saveORFSession(session);
      setCompletedSession(session);
      onSessionCompleted?.(session);
    } finally {
      setIsAnalyzing(false);
      setHasCompleted(true);
    }
  };

  // إعادة التحكيم اليدوي الفوري عند تعديل المعلم أو الطالب لحالة كلمة
  const recomputeFromAnnotations = (currentAnnotations: ORFWordAnnotation[], targetDuration?: number) => {
    const totalWords = currentAnnotations.length;
    const wordsCorrect = currentAnnotations.filter(w => w.status === 'correct').length;
    const wordsRead = currentAnnotations.filter(w => w.status !== 'omitted' && w.status !== 'pending').length;
    const durationSec = Math.max(targetDuration || completedSession?.durationSeconds || elapsedSeconds, 1);

    const rawWcpm = Math.round((wordsCorrect / durationSec) * 60);
    const accuracyRate = totalWords > 0 ? Math.round((wordsCorrect / totalWords) * 100) : 0;

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

    currentAnnotations.forEach(w => {
      if (w.errorCategory && errorBreakdown[w.errorCategory] !== undefined) {
        errorBreakdown[w.errorCategory]++;
      }
    });

    const benchmarkLevelInfo = evaluateORFPerformance(rawWcpm, studentGrade);
    const certNum = completedSession?.certificateNumber || `ORF-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const updatedSession: ORFAssessmentSession = {
      id: completedSession?.id || `orf_${Date.now()}`,
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
      wcpm: rawWcpm,
      accuracyRate,
      prosodyScore: prosodyScore,
      assessorRole: isTeacherAssessor ? 'teacher_evaluated' : 'student_self',
      assessorName: currentUser.name,
      date: new Date().toISOString(),
      errorBreakdown,
      annotations: currentAnnotations,
      gradeBenchmarkLevel: benchmarkLevelInfo.level,
      certificateNumber: certNum,
      spokenTranscript: completedSession?.spokenTranscript || liveSpokenTranscript,
      aiDiagnosticNote: completedSession?.aiDiagnosticNote || aiDiagnosticNote || undefined,
    };

    saveORFSession(updatedSession);
    setCompletedSession(updatedSession);
    onSessionCompleted?.(updatedSession);
  };

  // تعيين حالة محددة لكلمة بنقرة واحدة من لوحة الفحص السريع
  const setWordStatusDirectly = (
    index: number, 
    status: 'correct' | 'error' | 'omitted' | 'hesitation' | 'pending',
    errorCategory?: ORFErrorCategory,
    spoken?: string,
    explanation?: string
  ) => {
    setWordAnnotations(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      item.status = status;
      item.errorCategory = errorCategory;
      if (spoken !== undefined) item.studentSpoken = spoken;
      if (explanation !== undefined) item.explanation = explanation;
      updated[index] = item;

      recomputeFromAnnotations(updated);
      return updated;
    });
  };

  // دورة التبديل السريع عند النقر المباشر على الكلمة
  const handleToggleWordStatus = (index: number) => {
    setActiveInspectorIndex(activeInspectorIndex === index ? null : index);
  };

  // تفعيل أحد سيناريوهات المحاكاة المعيارية السريعة للتجربة والإثبات الفعلي
  const applyPresetScenario = (scenario: 'proficient' | 'vowel_errors' | 'struggling') => {
    const words = getPassageWords(selectedPassage.text);
    let newAnnotations: ORFWordAnnotation[] = [];
    let testDuration = 22;
    let feedback = '';

    if (scenario === 'proficient') {
      // قراءة نموذجية متقنة بنسبة 96%
      testDuration = 20;
      newAnnotations = words.map((w, idx) => {
        if (idx === 3 && words.length > 5) {
          return {
            word: w,
            index: idx,
            status: 'hesitation',
            explanation: 'تردد خفيف وسريع ثم واصل القراءة بطلاقة.',
          };
        }
        return {
          word: w,
          index: idx,
          status: 'correct',
          studentSpoken: w,
        };
      });
      feedback = 'قراءة نموذجية متقنة ومبهرة! مخارج حروف نقية، وسرعة طلاقة ممتازة (WCPM متقدم) مع مراعاة كاملة للحركات والمدود ومواضع الوصل.';
      setProsodyScore(4);
    } else if (scenario === 'vowel_errors') {
      // قراءة بها أخطاء حركات ومدود وهمزات (72% دقة - 52 WCPM)
      testDuration = 25;
      newAnnotations = words.map((w, idx) => {
        if (idx === 1) {
          return {
            word: w,
            index: idx,
            status: 'error',
            errorCategory: 'short_vowels',
            studentSpoken: w.replace(/َ/g, 'ِ').replace(/ُ/g, 'َ'),
            explanation: 'لحن في حركة الحرف الأخير بالكسر بدلاً من الفتح.',
          };
        }
        if (idx === 4) {
          return {
            word: w,
            index: idx,
            status: 'error',
            errorCategory: 'long_vowels',
            studentSpoken: 'مقطع مقصور',
            explanation: 'قصر مد الألف بدلاً من إشباعه بحركتين.',
          };
        }
        if (idx === 7) {
          return {
            word: w,
            index: idx,
            status: 'error',
            errorCategory: 'hamzat',
            studentSpoken: 'قطع الهمزة',
            explanation: 'نطق همزة الوصل قطعاً في درج الكلام.',
          };
        }
        if (idx === 10) {
          return {
            word: w,
            index: idx,
            status: 'error',
            errorCategory: 'short_vowels',
            studentSpoken: 'تسكين الحرف',
            explanation: 'وقف على حركة في غير موضع الوقف الطبيعي.',
          };
        }
        return {
          word: w,
          index: idx,
          status: 'correct',
          studentSpoken: w,
        };
      });
      feedback = 'قراءة مقبولة ولكن رُصدت تعثرات واضحة في: ضبط الحركات القصيرة والمدود وهمزات الوصل. يُوصى بالتركيز على التلازم بين الصوت والحركة.';
      setProsodyScore(2);
    } else {
      // قراءة متعثرة وتوقف مبكر (45% دقة - 28 WCPM)
      testDuration = 28;
      const cutoff = Math.floor(words.length * 0.55);
      newAnnotations = words.map((w, idx) => {
        if (idx >= cutoff) {
          return {
            word: w,
            index: idx,
            status: 'omitted',
            errorCategory: 'omission',
            explanation: 'توقف القارئ ولم يستكمل بقية النص.',
          };
        }
        if (idx === 2 || idx === 5) {
          return {
            word: w,
            index: idx,
            status: 'error',
            errorCategory: 'short_vowels',
            studentSpoken: 'خطأ إبدال صوتي',
            explanation: 'تعثر في نطق الحركات والتهجي البطيء.',
          };
        }
        return {
          word: w,
          index: idx,
          status: 'correct',
        };
      });
      feedback = 'تحتاج القراءة إلى تدخل علاجي فوري ومكثف؛ التوقف المبكر ونسبة الدقة المرتفعة في الأخطاء تشيران إلى ضعف في فك الترميز التلقائي.';
      setProsodyScore(1);
    }

    setWordAnnotations(newAnnotations);
    setElapsedSeconds(testDuration);
    setAiDiagnosticNote(feedback);
    setHasCompleted(true);
    setActiveInspectorIndex(null);
    recomputeFromAnnotations(newAnnotations, testDuration);
  };

  // الكلمات ومؤشرات القياس
  const currentDuration = Math.max(completedSession?.durationSeconds || elapsedSeconds, 1);
  const wordsCorrectCount = wordAnnotations.filter(w => w.status === 'correct').length;
  const liveWcpm = Math.round((wordsCorrectCount / currentDuration) * 60);
  const currentWcpm = completedSession ? completedSession.wcpm : liveWcpm;
  const benchmarkInfo = evaluateORFPerformance(currentWcpm, studentGrade);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in" dir="rtl">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* الترويسة الرئيسية */}
        <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white px-6 py-4 border-b border-emerald-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center font-bold text-lg shadow-inner">
              🎙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">
                  مختبر الطلاقة القرائية المعياري الحقيقي (Oral Reading Fluency - ORF)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  معيار DIBELS / WCPM المقنن
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                الطالب: <b className="text-white">{student.name}</b> • {getGradeLabel(studentGrade)} ({student.track === 'arabic-b' ? 'عرب B' : 'عرب A'}) • قياس صوتي ذكي بالذكاء الاصطناعي
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/70">

          {/* تنبيه تكليف المعلم الرسمي إن وُجد */}
          {assignedTasks.length > 0 && (
            <div className="p-3 bg-gradient-to-r from-teal-50 to-emerald-50 border-2 border-teal-300 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📋</span>
                <div>
                  <span className="font-black text-teal-950 block">
                    مهمة تسجيل قراءة مسندة من المعلم: {assignedTasks[0].passageTitle}
                  </span>
                  <span className="text-[11px] text-teal-700">
                    المعلم: <b>{assignedTasks[0].teacherName}</b>
                    {assignedTasks[0].dueDate && ` • موعد التسليم: ${assignedTasks[0].dueDate}`}
                    {assignedTasks[0].instructions && ` • التوجيه: ${assignedTasks[0].instructions}`}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-teal-600 text-white text-[10px] font-black shrink-0 shadow-2xs">
                مطلوب إنجازه 🎯
              </span>
            </div>
          )}

          {/* محدد النص ومؤشرات المعايير + أزرار التجربة السريعة */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📖</span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block">النص المرجعي المشكول:</span>
                <span className="text-xs font-black text-slate-800">
                  {selectedPassage.title} ({selectedPassage.wordCount} كلمة)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">النص:</span>
                <select
                  value={selectedPassage.id}
                  onChange={(e) => {
                    const found = ORF_STANDARD_PASSAGES.find(p => p.id === e.target.value);
                    if (found) setSelectedPassage(found);
                  }}
                  disabled={isRecording || isAnalyzing}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {ORF_STANDARD_PASSAGES.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.wordCount} كلمة)
                    </option>
                  ))}
                </select>
              </div>

              {/* أزرار التجربة السريعة للتحقق الفوري من صحة القياس وتمييز الكلمات */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px]">
                <span className="text-slate-400 px-1 font-bold">محاكاة:</span>
                <button
                  type="button"
                  onClick={() => applyPresetScenario('proficient')}
                  disabled={isRecording || isAnalyzing}
                  className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold shadow-2xs cursor-pointer transition text-[10px]"
                  title="محاكاة قراءة نموذجية متقنة بنسبة 96% لرؤية تمييز الكلمات باللون الأخضر وارتفاع WCPM"
                >
                  🌟 متقنة (96%)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetScenario('vowel_errors')}
                  disabled={isRecording || isAnalyzing}
                  className="px-2 py-1 bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-bold shadow-2xs cursor-pointer transition text-[10px]"
                  title="محاكاة قراءة بها أخطاء حركات ومدود لرؤية تمييز الكلمات الخاطئة بالأصفر والأزرق وانخفاض WCPM"
                >
                  ⚠️ أخطاء حركات (72%)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetScenario('struggling')}
                  disabled={isRecording || isAnalyzing}
                  className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 rounded-lg font-bold shadow-2xs cursor-pointer transition text-[10px]"
                  title="محاكاة قراءة متعثرة وتوقف مبكر لرؤية الكلمات المشطوبة والمحذوفة"
                >
                  🛑 متعثرة (45%)
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* شريط التحكم الأساسي والتسجيل (موقع علوي بارز يسهل وصول الطفل والمعلم إليه) */}
          {/* ========================================================================= */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 rounded-2xl border border-slate-700 shadow-md flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {!isRecording ? (
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={handleStartRecording}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-md shadow-emerald-500/30 cursor-pointer"
                >
                  <Mic className="w-4 h-4 text-emerald-100 animate-pulse" />
                  <span>ابدأ القراءة والتسجيل الحقيقي 🎙️</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-md shadow-rose-600/30 cursor-pointer animate-pulse"
                >
                  <Square className="w-4 h-4" />
                  <span>إيقاف واحتساب الطلاقة الحقيقية ⏹️</span>
                </button>
              )}

              {/* زر إعادة القراءة والمحاولة من جديد متاح دائماً وواضح للطفل */}
              <button
                type="button"
                onClick={handleResetAndRetry}
                disabled={isRecording || isAnalyzing}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-white/20 cursor-pointer"
                title="إعادة تعيين النص والوقت للبدء في محاولة قراءة جديدة من الصفر"
              >
                <RotateCcw className="w-4 h-4 text-amber-300" />
                <span>إعادة القراءة والمحاولة من جديد 🔄</span>
              </button>

              {hasCompleted && audioUrl && (
                <audio src={audioUrl} controls className="h-8 max-w-[170px]" />
              )}

              {/* زر إعادة الفحص بالذكاء الاصطناعي عند الطلب */}
              {hasCompleted && (
                <button
                  type="button"
                  onClick={() => {
                    const words = getPassageWords(selectedPassage.text);
                    const currentTranscript = liveSpokenTranscript || completedSession?.spokenTranscript || '';
                    const currentDur = completedSession?.durationSeconds || elapsedSeconds || 20;
                    setIsAnalyzing(true);
                    evaluateOralReadingWithAI({
                      passageText: selectedPassage.text,
                      passageWords: words,
                      spokenTranscript: currentTranscript,
                      durationSeconds: currentDur,
                      gradeLevel: studentGrade,
                    }).then(res => {
                      setWordAnnotations(res.annotations);
                      setAiDiagnosticNote(res.qualitativeFeedback);
                      recomputeFromAnnotations(res.annotations);
                    }).catch(err => {
                      console.warn('[ORF Re-evaluate] تعذر التحكيم السحابي، استخدام التحكيم المحلي:', err);
                      const localRes = evaluateOralReadingLocally({
                        passageWords: words,
                        spokenTranscript: currentTranscript,
                        durationSeconds: currentDur,
                      });
                      setWordAnnotations(localRes.annotations);
                      setAiDiagnosticNote(localRes.qualitativeFeedback);
                      recomputeFromAnnotations(localRes.annotations);
                    }).finally(() => {
                      setIsAnalyzing(false);
                    });
                  }}
                  disabled={isAnalyzing}
                  className="px-3 py-2 bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-400/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 text-indigo-300" />
                  <span>إعادة التحكيم بالذكاء الاصطناعي 🤖</span>
                </button>
              )}
            </div>

            {/* العدادات وشارات الحالة */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>{hasCompleted && completedSession ? completedSession.durationSeconds : elapsedSeconds} ثانية</span>
              </div>

              <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 text-center min-w-[75px]">
                <span className="text-[10px] text-slate-300 block font-bold">معدل WCPM</span>
                <span className="text-sm font-black text-emerald-400">
                  {hasCompleted ? currentWcpm : (isRecording ? liveWcpm : '--')} <span className="text-[9px] font-normal text-slate-300">ك/د</span>
                </span>
              </div>

              {/* حالة الجلسة */}
              <div className="hidden sm:block">
                {!isRecording && !hasCompleted && (
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    ⚪ في انتظار بدء القراءة
                  </span>
                )}
                {isRecording && (
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                    🔴 الميكروفون يستمع بنشاط...
                  </span>
                )}
                {hasCompleted && (
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ✅ تم التحكيم والتقييم
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* منصة القراءة التفاعلية وشاشة النص */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-emerald-100 shadow-sm space-y-4">
            
            {/* دليل الألوان وتعليمات الفحص */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="font-extrabold text-xs text-slate-800">
                  لوحة تفكيك الكلمات المشكولة ومطابقة النطق التلقائي واليدوي:
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300">⚪ جاهزة للقراءة</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">🟢 صحيح</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-400">🟡 حركة قصيرة</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-400">🔵 مد طويل</span>
                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-400">🟣 همزة</span>
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-400">🔴 خطأ نطق</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 line-through">⚪ متروكة</span>
              </div>
            </div>

            {/* النص القرائي مفككاً بكلمات تفاعلية - تبدأ بحالة محايدة بيضاء ونظيفة بدون علامات صح مسبقة */}
            <div className="p-5 rounded-2xl bg-amber-50/20 border border-amber-200/60 leading-loose text-base sm:text-lg font-serif tracking-wide select-none">
              {wordAnnotations.map((item, idx) => {
                let badgeClass = 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300 hover:bg-slate-50 shadow-2xs';
                let tagLabel = '';
                let tagColor = '';

                if (item.status === 'pending') {
                  // حالة مبدئية نظيفة ومحايدة تماماً قبل القراءة
                  badgeClass = 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300 hover:bg-slate-50 font-medium shadow-2xs';
                  tagLabel = '';
                  tagColor = '';
                } else if (item.status === 'correct') {
                  badgeClass = 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold shadow-xs ring-1 ring-emerald-200';
                  tagLabel = 'صحيح ✓';
                  tagColor = 'text-emerald-800 bg-emerald-200';
                } else if (item.status === 'omitted') {
                  badgeClass = 'bg-slate-100 text-slate-500 border-dashed border-slate-400 line-through opacity-65';
                  tagLabel = 'متروكة ✂️';
                  tagColor = 'text-slate-600 bg-slate-200';
                } else if (item.status === 'error') {
                  if (item.errorCategory === 'short_vowels') {
                    badgeClass = 'bg-amber-100 text-amber-950 border-amber-400 font-black shadow-xs ring-2 ring-amber-300/80';
                    tagLabel = 'حركة ⚠️';
                    tagColor = 'text-amber-900 bg-amber-200';
                  } else if (item.errorCategory === 'long_vowels') {
                    badgeClass = 'bg-blue-100 text-blue-950 border-blue-400 font-black shadow-xs ring-2 ring-blue-300/80';
                    tagLabel = 'مد 〰️';
                    tagColor = 'text-blue-900 bg-blue-200';
                  } else if (item.errorCategory === 'hamzat') {
                    badgeClass = 'bg-purple-100 text-purple-950 border-purple-400 font-black shadow-xs ring-2 ring-purple-300/80';
                    tagLabel = 'همزة ⚡';
                    tagColor = 'text-purple-900 bg-purple-200';
                  } else if (item.errorCategory === 'shams_qamar') {
                    badgeClass = 'bg-teal-100 text-teal-950 border-teal-400 font-black shadow-xs ring-2 ring-teal-300/80';
                    tagLabel = 'لام ☀️🌙';
                    tagColor = 'text-teal-900 bg-teal-200';
                  } else {
                    badgeClass = 'bg-rose-100 text-rose-950 border-rose-500 font-black shadow-xs ring-2 ring-rose-400/80';
                    tagLabel = 'خطأ ❌';
                    tagColor = 'text-rose-900 bg-rose-200';
                  }
                } else if (item.status === 'hesitation') {
                  badgeClass = 'bg-yellow-100 text-yellow-950 border-yellow-400 font-bold';
                  tagLabel = 'تردد ⏳';
                  tagColor = 'text-yellow-900 bg-yellow-200';
                }

                const isSelectedForInspect = activeInspectorIndex === idx;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleToggleWordStatus(idx)}
                    className={`inline-flex flex-col items-center mx-1 my-1 px-3 py-1.5 rounded-xl border text-sm sm:text-base transition-all cursor-pointer relative ${badgeClass} ${isSelectedForInspect ? 'ring-4 ring-indigo-500 scale-105 z-10' : ''}`}
                    title={item.explanation || (item.studentSpoken ? `نطق الطالب: ${item.studentSpoken}` : 'انقر لتعديل نوع التعثر الصوتي للكلمة')}
                  >
                    <span className="font-bold tracking-wide">{item.word}</span>
                    {tagLabel ? (
                      <span className={`text-[9px] font-sans font-black px-1.5 py-0.2 rounded-full mt-0.5 ${tagColor}`}>
                        {tagLabel}
                      </span>
                    ) : (
                      <span className="text-[9px] font-sans text-slate-400 opacity-60 mt-0.5">
                        {idx + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* لوحة الفحص والتعديل اليدوي المباشر للكلمة المحددة (Word Inspector Bar) */}
            {activeInspectorIndex !== null && wordAnnotations[activeInspectorIndex] && (
              <div className="p-4 bg-indigo-50/80 rounded-2xl border-2 border-indigo-300 space-y-3 animate-fade-in text-right">
                <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-indigo-700" />
                    <span className="text-xs font-black text-indigo-950">
                      لوحة تدقيق وتعديل الكلمة: «<b className="text-indigo-700 text-sm">{wordAnnotations[activeInspectorIndex].word}</b>»
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveInspectorIndex(null)}
                    className="p-1 hover:bg-indigo-200 rounded-lg text-indigo-700 cursor-pointer text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* أزرار التعيين السريعة بنقرة واحدة */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    اختر التقييم الحقيقي لهذه الكلمة (يُعاد احتساب WCPM ونسبة الدقة فورياً):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setWordStatusDirectly(activeInspectorIndex, 'correct', undefined, wordAnnotations[activeInspectorIndex].word, 'نطق صحيح ومتقن')}
                      className={`p-2 rounded-xl border text-right font-bold transition flex items-center gap-1.5 cursor-pointer ${wordAnnotations[activeInspectorIndex].status === 'correct' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-300'}`}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>🟢 صحيح 100%</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWordStatusDirectly(activeInspectorIndex, 'error', 'short_vowels', undefined, 'خطأ في الحركات القصيرة (فتحة/ضمة/كسرة)')}
                      className={`p-2 rounded-xl border text-right font-bold transition flex items-center gap-1.5 cursor-pointer ${wordAnnotations[activeInspectorIndex].status === 'error' && wordAnnotations[activeInspectorIndex].errorCategory === 'short_vowels' ? 'bg-amber-600 text-white border-amber-700 shadow-sm' : 'bg-white hover:bg-amber-50 text-amber-950 border-amber-300'}`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>🟡 حركة قصيرة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWordStatusDirectly(activeInspectorIndex, 'error', 'long_vowels', undefined, 'خطأ في إشباع أو قصر المدود الطويلة')}
                      className={`p-2 rounded-xl border text-right font-bold transition flex items-center gap-1.5 cursor-pointer ${wordAnnotations[activeInspectorIndex].status === 'error' && wordAnnotations[activeInspectorIndex].errorCategory === 'long_vowels' ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white hover:bg-blue-50 text-blue-950 border-blue-300'}`}
                    >
                      <Sliders className="w-4 h-4 shrink-0" />
                      <span>🔵 مد طويل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWordStatusDirectly(activeInspectorIndex, 'error', 'hamzat', undefined, 'خطأ في همزة الوصل أو القطع')}
                      className={`p-2 rounded-xl border text-right font-bold transition flex items-center gap-1.5 cursor-pointer ${wordAnnotations[activeInspectorIndex].status === 'error' && wordAnnotations[activeInspectorIndex].errorCategory === 'hamzat' ? 'bg-purple-600 text-white border-purple-700 shadow-sm' : 'bg-white hover:bg-purple-50 text-purple-950 border-purple-300'}`}
                    >
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span>🟣 همزة وصل/قطع</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWordStatusDirectly(activeInspectorIndex, 'error', 'shams_qamar', undefined, 'خطأ في اللام الشمسية أو القمرية')}
                      className={`p-2 rounded-xl border text-right font-bold transition flex items-center gap-1.5 cursor-pointer ${wordAnnotations[activeInspectorIndex].status === 'error' && wordAnnotations[activeInspectorIndex].errorCategory === 'shams_qamar' ? 'bg-teal-600 text-white border-teal-700 shadow-sm' : 'bg-white hover:bg-teal-50 text-teal-950 border-teal-300'}`}
                    >
                      <span>☀️🌙 شمسية / قمرية</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWordStatusDirectly(activeInspectorIndex, 'error', 'short_vowels', undefined, 'خطأ إبدال صوتي أو نطق غير صحيح')}
                      className={`p-2 rounded-xl border text-right font-bold transition flex items-center gap-1.5 cursor-pointer ${wordAnnotations[activeInspectorIndex].status === 'error' && (!wordAnnotations[activeInspectorIndex].errorCategory || wordAnnotations[activeInspectorIndex].errorCategory === 'short_vowels') ? 'bg-rose-600 text-white border-rose-700 shadow-sm' : 'bg-white hover:bg-rose-50 text-rose-950 border-rose-300'}`}
                    >
                      <span>🔴 خطأ نطق عام</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWordStatusDirectly(activeInspectorIndex, 'omitted', 'omission', undefined, 'تخطى الطالب الكلمة ولم يقرأها')}
                      className={`p-2 rounded-xl border text-right font-bold transition flex items-center gap-1.5 cursor-pointer ${wordAnnotations[activeInspectorIndex].status === 'omitted' ? 'bg-slate-700 text-white border-slate-800 shadow-sm' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'}`}
                    >
                      <span>⚪ محذوفة (متروكة)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWordStatusDirectly(activeInspectorIndex, 'hesitation', 'hesitation', undefined, 'تردد أو تعثر أو تكرار الكلمة')}
                      className={`p-2 rounded-xl border text-right font-bold transition flex items-center gap-1.5 cursor-pointer ${wordAnnotations[activeInspectorIndex].status === 'hesitation' ? 'bg-yellow-600 text-white border-yellow-700 shadow-sm' : 'bg-white hover:bg-yellow-50 text-yellow-950 border-yellow-300'}`}
                    >
                      <span>⏳ تردد وتعثر</span>
                    </button>
                  </div>
                </div>

                {/* تفاصيل نطق الطالب */}
                {wordAnnotations[activeInspectorIndex].explanation && (
                  <p className="text-[11px] text-indigo-900 bg-white p-2 rounded-lg border border-indigo-100">
                    💡 <b>التشخيص:</b> {wordAnnotations[activeInspectorIndex].explanation}
                  </p>
                )}
              </div>
            )}

            {/* شريط الكلام المنطوق الفعلي من الميكروفون */}
            {(isRecording || liveSpokenTranscript || completedSession?.spokenTranscript) && (
              <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-black text-indigo-950">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                  <span>النص المنطوق الفعلي كما التقطه الميكروفون (Speech Transcript):</span>
                </div>
                <p className="text-slate-700 leading-relaxed font-sans text-xs sm:text-sm bg-white p-2.5 rounded-xl border border-indigo-100/60">
                  {completedSession?.spokenTranscript || liveSpokenTranscript || (isRecording ? 'جاري التقاط الصوت... تحدث باللغة العربية الفصحى' : 'لم يتم التقاط نص صوتي بعد')}
                </p>
              </div>
            )}

            {/* شريط جاري التحليل بالذكاء الاصطناعي */}
            {isAnalyzing && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 flex items-center justify-center gap-3 animate-pulse">
                <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                <div className="text-right">
                  <span className="text-xs font-black text-emerald-950 block">
                    جاري التحكيم الصوتي واللغوي الدقيق بالذكاء الاصطناعي (Gemini 3.8 Flash Oral Auditor)...
                  </span>
                  <span className="text-[11px] text-emerald-700 block">
                    يتم الاستماع إلى المقطع الصوتي، ومطابقة مخارج الحروف، التشكيل، المدود، والكلمات المتروكة لاحتساب WCPM الحقيقي بدقة.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* لوحة النتائج والتحليل الصوتي المعياري عند اكتمال الجلسة */}
          {/* ========================================================================= */}
          {hasCompleted && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      نتيجة اختبار الطلاقة القرائية الشفهية المعتمدة الحقيقية
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      مقارنة الأداء الفعلي المسجل بالمعايير العالمية للكلمات الصحيحة في الدقيقة (WCPM).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    {/* زر إعادة المحاولة البارز في لوحة النتائج */}
                    <button
                      type="button"
                      onClick={handleResetAndRetry}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>إعادة القراءة والمحاولة من جديد 🔄</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCertificateViewOpen(true)}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      <Award className="w-4 h-4" />
                      <span>عرض وطباعة الشهادة الرسمية 📜</span>
                    </button>
                  </div>
                </div>

                {/* كروت المؤشرات الأربعة */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">معدل الطلاقة الفعلي</span>
                    <span className="text-2xl font-black text-emerald-600">
                      {currentWcpm} <span className="text-xs font-normal text-slate-500">WCPM</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">كلمة صحيحة في الدقيقة</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">دقة الضبط الصوتي</span>
                    <span className="text-2xl font-black text-indigo-600">
                      {completedSession?.accuracyRate ?? Math.round((wordsCorrectCount / Math.max(wordAnnotations.length, 1)) * 100)}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      ({wordsCorrectCount} من {wordAnnotations.length} كلمة)
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
                          onClick={() => {
                            setProsodyScore(star);
                            if (completedSession) {
                              const updated = { ...completedSession, prosodyScore: star };
                              setCompletedSession(updated);
                              saveORFSession(updated);
                            }
                          }}
                          className={`w-4 h-4 cursor-pointer transition ${star <= prosodyScore ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-1">مقياس 1-4 لسلامة الوقف</span>
                  </div>
                </div>

                {/* الملاحظة التشخيصية الصوتية المعتمدة من المحكم الذكي */}
                {aiDiagnosticNote && (
                  <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-1.5 text-xs text-right">
                    <div className="flex items-center gap-2 font-black text-indigo-950">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>التقرير الصوتي واللغوي المعتمد من المحكّم الذكي:</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed font-sans text-xs">
                      {aiDiagnosticNote}
                    </p>
                  </div>
                )}

                {/* تشخيص مواضع التعثر الصوتي */}
                <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900 block">
                      الكشف التلقائي عن مواضع التعثر الصوتي الفعلي:
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      💡 يمكنك النقر فوق أي كلمة في النص لتعديل حالتها يدوياً إذا دعت الحاجة
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                      <span className="text-slate-500 text-[11px] block">أخطاء الحركات القصيرة:</span>
                      <span className="font-extrabold text-amber-800 text-sm">
                        {completedSession?.errorBreakdown?.short_vowels ?? wordAnnotations.filter(w => w.errorCategory === 'short_vowels').length} كلمة
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                      <span className="text-slate-500 text-[11px] block">أخطاء المدود الطويلة:</span>
                      <span className="font-extrabold text-blue-800 text-sm">
                        {completedSession?.errorBreakdown?.long_vowels ?? wordAnnotations.filter(w => w.errorCategory === 'long_vowels').length} كلمة
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                      <span className="text-slate-500 text-[11px] block">أخطاء همزات الوصل/القطع:</span>
                      <span className="font-extrabold text-purple-800 text-sm">
                        {completedSession?.errorBreakdown?.hamzat ?? wordAnnotations.filter(w => w.errorCategory === 'hamzat').length} كلمة
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                      <span className="text-slate-500 text-[11px] block">الكلمات المتروكة أو المحذوفة:</span>
                      <span className="font-extrabold text-rose-800 text-sm">
                        {completedSession?.errorBreakdown?.omission ?? wordAnnotations.filter(w => w.status === 'omitted').length} كلمة
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-[11px] text-slate-600 pt-1">
                    • <b>التوجيه التربوي المعياري:</b> {benchmarkInfo.comparisonText}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* الشريط السفلي */}
        <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400 font-medium">
            المعيار مستند إلى اختبارات WCPM المقننة للمرحلة الابتدائية باللغة العربية مع التحكيم الصوتي الذكي الحقيقي.
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
      {isCertificateViewOpen && (
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
                <div className="flex items-center justify-between">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block">رقم الشهادة المعتمد</span>
                    <span className="text-xs font-mono font-black text-slate-800">{completedSession?.certificateNumber || 'ORF-2026-881290'}</span>
                  </div>
                  <div className="text-2xl">🏆</div>
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-slate-400 block">تاريخ الإصدار</span>
                    <span className="text-xs font-mono font-bold text-slate-800">
                      {new Date(completedSession?.date || Date.now()).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                </div>

                <h1 className="text-2xl font-black text-slate-900 mt-3">
                  شهادة مقياس الطلاقة القرائية الرسمية
                </h1>
                <p className="text-xs font-bold text-amber-700 mt-1">
                  Oral Reading Fluency (ORF) Benchmark Certificate
                </p>
              </div>

              <div className="space-y-2 py-2">
                <p className="text-sm text-slate-600 font-medium">تشهد منصة «تعلَّم مع موسى» بأن الطالب:</p>
                <h2 className="text-2xl font-black text-indigo-950 underline decoration-amber-400 underline-offset-8">
                  {completedSession?.studentName || student.name}
                </h2>
                <p className="text-xs text-slate-500 mt-2">
                  المقيد بـ: <b>{getGradeLabel(completedSession?.grade || studentGrade)}</b> • مسار: <b>{student.track === 'arabic-b' ? 'عرب B (الناطقين بغيرها)' : 'عرب A'}</b>
                </p>
              </div>

              {/* جدول الدرجات المعيارية */}
              <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-4 grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl border border-amber-200/80">
                  <span className="text-[10px] font-bold text-slate-400 block">سرعة الطلاقة (WCPM)</span>
                  <span className="text-xl font-black text-emerald-700">{completedSession?.wcpm || currentWcpm}</span>
                  <span className="text-[10px] text-slate-400 block">كلمة صحيحة / د</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200/80">
                  <span className="text-[10px] font-bold text-slate-400 block">دقة الضبط الصوتي</span>
                  <span className="text-xl font-black text-indigo-700">
                    {completedSession?.accuracyRate ?? Math.round((wordsCorrectCount / Math.max(wordAnnotations.length, 1)) * 100)}%
                  </span>
                  <span className="text-[10px] text-slate-400 block">دقة الحركات والمدود</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200/80">
                  <span className="text-[10px] font-bold text-slate-400 block">المستوى المعياري</span>
                  <span className="text-xs font-black text-amber-900 block mt-1">
                    {benchmarkInfo.labelAr.split('(')[0]}
                  </span>
                  <span className="text-[10px] text-slate-400 block">رتبة: ~{benchmarkInfo.percentileApprox}%</span>
                </div>
              </div>

              {/* التقرير الصوتي المعتمد */}
              {(completedSession?.aiDiagnosticNote || aiDiagnosticNote) && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-right text-xs">
                  <span className="font-black text-slate-800 block mb-1">التقرير الصوتي واللغوي للمحكّم:</span>
                  <p className="text-slate-600 leading-relaxed font-sans text-[11px]">
                    {completedSession?.aiDiagnosticNote || aiDiagnosticNote}
                  </p>
                </div>
              )}

              {/* التوقيع والاعتماد */}
              <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-right text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">المحكّم الصوتي واللغوي:</span>
                  <span className="font-black text-slate-800">
                    {completedSession?.assessorName || currentUser.name} ({isTeacherAssessor ? 'معلم معتمد' : 'تقييم ذاتي ذكي'})
                  </span>
                </div>

                <div className="text-center">
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-amber-400 mx-auto flex items-center justify-center font-bold text-[10px] text-amber-700 rotate-[-12deg]">
                    خاتم الاعتماد
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 block">DIBELS-Aligned</span>
                </div>

                <div className="text-left">
                  <span className="text-[10px] font-bold text-slate-400 block">المعايير المرجعية:</span>
                  <span className="font-mono text-[10px] text-slate-600 block">DIBELS / Lexile ORF Arabized</span>
                </div>
              </div>
            </div>

            {/* أزرار الطباعة */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between print:hidden">
              <button
                type="button"
                onClick={() => setIsCertificateViewOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الشهادة الرسمية الآن (PDF) 🖨️</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
