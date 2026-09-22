import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Users, 
  Clock, 
  Sparkles, 
  AlertCircle, 
  Radio, 
  Play, 
  Square, 
  ShieldCheck, 
  Hand, 
  Maximize2,
  RefreshCw
} from 'lucide-react';
import { UserProfile, GradeLevel, ArabicTrack, LiveClassSession } from '../types';
import { 
  getActiveLiveClassForGrade, 
  getActiveLiveClassForTeacher, 
  saveLiveClassSession, 
  endLiveClassSession,
  getLiveClassSessions
} from '../storage';
import { supabase } from '../supabaseClient';

interface LiveClassroomProps {
  currentUser: UserProfile;
  initialGrade?: GradeLevel | string;
  initialTrack?: ArabicTrack | string;
  onLeave?: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: any;
  }
}

const JITSI_SCRIPT_URL = 'https://meet.jit.si/external_api.js';

export const LiveClassroom: React.FC<LiveClassroomProps> = ({
  currentUser,
  initialGrade,
  initialTrack,
  onLeave
}) => {
  const isTeacher = currentUser.role === 'teacher' || currentUser.role === 'hod' || currentUser.role === 'super_admin';
  const defaultGrade = initialGrade || (currentUser.allowedGrades && currentUser.allowedGrades[0]) || currentUser.grade || 'grade-1';
  
  const [selectedGrade, setSelectedGrade] = useState<string>(defaultGrade);
  const [selectedTrack] = useState<string>(initialTrack || currentUser.track || 'arabic-a');
  const [lessonTopic, setLessonTopic] = useState<string>('حصة تفاعلية مباشرة مع موسى');
  const [isMeetingActive, setIsMeetingActive] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<LiveClassSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [isLoadingMeeting, setIsLoadingMeeting] = useState<boolean>(false);

  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // تنسيق اسم الصف
  const formatGradeName = (grade: string) => {
    switch (grade) {
      case 'kg': return 'رياض الأطفال';
      case 'grade-1': return 'الصف الأول الابتدائي';
      case 'grade-2': return 'الصف الثاني الابتدائي';
      case 'grade-3': return 'الصف الثالث الابتدائي';
      case 'grade-4': return 'الصف الرابع الابتدائي';
      case 'grade-5': return 'الصف الخامس الابتدائي';
      case 'grade-6': return 'الصف السادس الابتدائي';
      default: return grade;
    }
  };

  // توليد اسم غرفة آمن ومتوافق مع Jitsi ومخصص للصف والمعلم
  const computeRoomName = (grade: string, teacherId: string) => {
    const cleanGrade = grade.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanTeacher = (teacherId || 'mousa').replace(/[^a-zA-Z0-9_-]/g, '_').slice(-6);
    return `MousaClass_${cleanGrade}_${cleanTeacher}`;
  };

  // فحص الجلسات الحية النشطة
  useEffect(() => {
    const checkActiveSession = () => {
      if (isTeacher) {
        const teacherSession = getActiveLiveClassForTeacher(currentUser.id);
        setActiveSession(teacherSession);
      } else {
        const studentGrade = currentUser.grade || selectedGrade;
        const gradeSession = getActiveLiveClassForGrade(studentGrade);
        setActiveSession(gradeSession);
      }
    };

    checkActiveSession();

    // الاستماع للتحديثات اللحظية عبر Supabase Broadcast
    try {
      const channel = supabase.channel('lwm-realtime-sync');
      channel.on('broadcast', { event: 'live_session_update' }, (payload: any) => {
        if (payload?.payload) {
          const updated: LiveClassSession = payload.payload;
          const relevantGrade = currentUser.grade || selectedGrade;
          if (updated.grade === relevantGrade || updated.grade === 'all' || updated.teacherId === currentUser.id) {
            setActiveSession(updated.isActive ? updated : null);
            if (!updated.isActive && isMeetingActive && !isTeacher) {
              // المعلم أغلق الحصة
              handleEndOrLeave();
            }
          }
        }
      });
    } catch (e) {
      console.warn('Realtime channel subscribe warning in LiveClassroom:', e);
    }
  }, [currentUser, isTeacher, selectedGrade, isMeetingActive]);

  // تحميل سكريبت Jitsi الرسمي ديناميكياً
  useEffect(() => {
    if (window.JitsiMeetExternalAPI) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.querySelector(`script[src="${JITSI_SCRIPT_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => setScriptLoaded(true));
      existingScript.addEventListener('error', () => setScriptError('تعذر تحميل خادم الاجتماع المباشر'));
      return;
    }

    const script = document.createElement('script');
    script.src = JITSI_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      setScriptLoaded(true);
      setScriptError(null);
    };
    script.onerror = () => {
      setScriptError('تعذر الاتصال بخادم Jitsi Meet. يرجى التحقق من اتصال الإنترنت.');
    };
    document.body.appendChild(script);

    return () => {
      // لا نحذف السكريبت حتى يظل متوفراً للتنقلات اللاحقة بسلاسة
    };
  }, []);

  // عداد مدة الحصة
  useEffect(() => {
    if (isMeetingActive) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedSeconds(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isMeetingActive]);

  // تنظيف وإغلاق كامل لموارد الكاميرا والمايكروفون عند مغادرة المكون (Strict Cleanup)
  useEffect(() => {
    return () => {
      if (jitsiApiRef.current) {
        try {
          jitsiApiRef.current.dispose();
        } catch (err) {
          console.warn('Error during Jitsi dispose on unmount:', err);
        }
        jitsiApiRef.current = null;
      }
    };
  }, []);

  // تنسيق وقت الحصة (MM:SS أو HH:MM:SS)
  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // إطلاق اجتماع Jitsi
  const startJitsiSession = (roomName: string) => {
    if (!window.JitsiMeetExternalAPI) {
      setScriptError('سكريبت Jitsi Meet لم يكتمل تحميله بعد. يرجى الانتظار ثوانٍ معدودة.');
      return;
    }

    if (!jitsiContainerRef.current) return;

    setIsLoadingMeeting(true);

    // تنظيف أي نسخة سابقة
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.dispose();
      } catch (e) {}
      jitsiApiRef.current = null;
    }

    jitsiContainerRef.current.innerHTML = '';

    const domain = 'meet.jit.si';
    const options = {
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: `${currentUser.name} (${isTeacher ? 'المعلم' : 'طالب'})`,
        email: currentUser.username ? `${currentUser.username}@mousa.edu` : undefined
      },
      configOverwrite: {
        defaultLanguage: 'ar',
        lang: 'ar',
        disableDeepLinking: true,
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        prejoinPageEnabled: false,
        prejoinConfig: { enabled: false },
        enableWelcomePage: false,
        enableClosePage: false,
        toolbarButtons: [
          'microphone',
          'camera',
          'closedcaptions',
          'desktop',
          'fullscreen',
          'fodeviceselection',
          'hangup',
          'chat',
          'raisehand',
          'videoquality',
          'tileview'
        ],
        disableThirdPartyRequests: true
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        BRAND_WATERMARK_LINK: '',
        DEFAULT_REMOTE_DISPLAY_NAME: 'طالب مبدع 🌟',
        TOOLBAR_BUTTONS: [
          'microphone',
          'camera',
          'closedcaptions',
          'desktop',
          'fullscreen',
          'fodeviceselection',
          'hangup',
          'chat',
          'raisehand',
          'videoquality',
          'tileview'
        ]
      }
    };

    try {
      const api = new window.JitsiMeetExternalAPI(domain, options);
      jitsiApiRef.current = api;

      api.addEventListener('videoConferenceJoined', () => {
        setIsMeetingActive(true);
        setIsLoadingMeeting(false);
      });

      api.addEventListener('videoConferenceLeft', () => {
        handleEndOrLeave();
      });

      api.addEventListener('readyToClose', () => {
        handleEndOrLeave();
      });
    } catch (err: any) {
      console.error('Failed to initialize Jitsi:', err);
      setScriptError('حدث خطأ أثناء فتح غرفة الاجتماع. تحقق من إذن الكاميرا والمايكروفون.');
      setIsLoadingMeeting(false);
    }
  };

  // بدء الحصة من المعلم
  const handleTeacherStart = async () => {
    const teacherId = currentUser.id;
    const roomName = computeRoomName(selectedGrade, teacherId);

    const newSession: LiveClassSession = {
      id: `live_${selectedGrade}_${Date.now()}`,
      roomName,
      grade: selectedGrade,
      track: selectedTrack,
      teacherId,
      teacherName: currentUser.name,
      title: lessonTopic.trim() || 'حصة تفاعلية مباشرة مع موسى',
      isActive: true,
      startedAt: new Date().toISOString()
    };

    await saveLiveClassSession(newSession);
    setActiveSession(newSession);
    startJitsiSession(roomName);
  };

  // انضمام الطالب للحصة
  const handleStudentJoin = () => {
    const roomName = activeSession?.roomName || computeRoomName(currentUser.grade || selectedGrade, currentUser.teacherId || 'usr_teacher');
    startJitsiSession(roomName);
  };

  // إنهاء الحصة أو المغادرة وتنظيف الكاميرا والمايك فوراً
  const handleEndOrLeave = async () => {
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.dispose();
      } catch (err) {
        console.warn('Dispose warning:', err);
      }
      jitsiApiRef.current = null;
    }

    if (jitsiContainerRef.current) {
      jitsiContainerRef.current.innerHTML = '';
    }

    setIsMeetingActive(false);
    setIsLoadingMeeting(false);

    if (isTeacher && activeSession) {
      await endLiveClassSession(activeSession.id);
      setActiveSession(null);
    }

    if (onLeave) {
      onLeave();
    }
  };

  return (
    <div id="mousa-live-classroom-container" className="w-full flex flex-col h-[calc(100vh-140px)] min-h-[620px] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl text-slate-100">
      
      {/* الشريط العلوي الخفيف للحصة */}
      <header className="bg-slate-950/80 backdrop-blur-md px-6 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30">
            <Video className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white flex items-center gap-1.5">
                فَصْلُ مُوسَى المَبَاشِر
              </h2>
              {isMeetingActive && (
                <span className="flex items-center gap-1 bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse border border-red-400/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  بث مباشر الآن 🔴
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium">
              {formatGradeName(isTeacher ? selectedGrade : (currentUser.grade || selectedGrade))} • {currentUser.name}
            </p>
          </div>
        </div>

        {/* مدة الحصة وشارات التحكم */}
        <div className="flex items-center gap-3">
          {isMeetingActive && (
            <div className="flex items-center gap-2 bg-slate-800/90 px-3.5 py-1.5 rounded-xl border border-slate-700/60 text-xs font-mono font-bold text-emerald-400">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formatDuration(elapsedSeconds)}</span>
            </div>
          )}

          {isMeetingActive ? (
            <button
              id="live-classroom-hangup-btn"
              onClick={handleEndOrLeave}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-red-600/20 cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" />
              <span>{isTeacher ? 'إنهاء الحصة وإغلاق البث 🛑' : 'مغادرة الحصة 🚪'}</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* مساحة العرض الرئيسية */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-4 bg-slate-900 overflow-hidden">
        
        {/* حاوية Iframe الخاصة بـ Jitsi */}
        <div 
          ref={jitsiContainerRef} 
          id="jitsi-meet-viewport"
          className={`w-full h-full rounded-2xl overflow-hidden transition-all duration-300 ${
            isMeetingActive ? 'block opacity-100' : 'hidden opacity-0'
          }`}
        />

        {/* مؤشر جارِ بدء الاتصال */}
        {isLoadingMeeting && !isMeetingActive && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center z-30 space-y-4">
            <div className="w-14 h-14 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
            <p className="text-sm font-bold text-slate-200">جارٍ تهيئة غرفة الفيديو الآمنة...</p>
            <p className="text-xs text-slate-400">يتم تشغيل الكاميرا والمايكروفون المعتمدين</p>
          </div>
        )}

        {/* الشاشة الترحيبية وغرفة الانتظار قبل بدء الاجتماع */}
        {!isMeetingActive && !isLoadingMeeting && (
          <div className="max-w-xl w-full bg-slate-950/70 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-xl text-center space-y-6 shadow-2xl">
            
            {/* أيقونة تفاعلية */}
            <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <Radio className="w-10 h-10 text-white animate-pulse" />
              {activeSession && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-slate-950"></span>
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xl font-black text-white">
                {isTeacher ? 'غرفة التحكم في البث المباشر 🎙️' : 'صالة استقبال الطلاب للبث المباشر 🌟'}
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                تقنية فصل موسى التفاعلي تتيح بث الصوت والصورة ومشاركة الشاشة ورفع اليد بجودة عالية ومجانية 100% دون أي رسوم أو قيود.
              </p>
            </div>

            {/* رسالة الخطأ إن وجدت */}
            {scriptError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center gap-2 text-right">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{scriptError}</span>
              </div>
            )}

            {/* عناصر تحكم المعلم */}
            {isTeacher && (
              <div className="space-y-4 text-right bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    اختر الصف الدراسي للبث المباشر:
                  </label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {(currentUser.allowedGrades || ['grade-1', 'grade-2', 'grade-3', 'grade-4']).map((g) => (
                      <option key={g} value={g}>{formatGradeName(g)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    عنوان وموضوع الحصة:
                  </label>
                  <input
                    type="text"
                    value={lessonTopic}
                    onChange={(e) => setLessonTopic(e.target.value)}
                    placeholder="مثال: مراجعة مهارات الوعي الصوتي والمدود..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  id="start-live-class-btn"
                  onClick={handleTeacherStart}
                  disabled={!scriptLoaded}
                  className="w-full mt-2 py-3 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 text-white font-black text-sm rounded-xl transition shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Radio className="w-5 h-5 text-white animate-pulse" />
                  <span>بدء الحصة المباشرة الآن 🎙️</span>
                </button>
              </div>
            )}

            {/* عناصر بوابة الطالب */}
            {!isTeacher && (
              <div className="space-y-4">
                {activeSession ? (
                  <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-5 text-center space-y-3 animate-in fade-in zoom-in-95">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-bold animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      المعلم في البث المباشر الآن!
                    </div>
                    <h4 className="text-base font-black text-emerald-300">
                      {activeSession.title}
                    </h4>
                    <p className="text-xs text-slate-300">
                      معلم المادة: <b className="text-white">{activeSession.teacherName}</b>
                    </p>

                    <button
                      id="student-join-live-class-btn"
                      onClick={handleStudentJoin}
                      disabled={!scriptLoaded}
                      className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm rounded-2xl transition shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer animate-bounce"
                    >
                      <Video className="w-5 h-5" />
                      <span>انضم إلى الحصة المباشرة الآن 🚀</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                      <Clock className="w-6 h-6 animate-pulse" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-200">
                      في انتظار بدء المعلم للحصة المباشرة...
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      عندما يبدأ المعلم البث لصفك ({formatGradeName(currentUser.grade || selectedGrade)})، ستظهر لك إشارة البدء تلقائياً هنا!
                    </p>
                    <button
                      onClick={handleStudentJoin}
                      disabled={!scriptLoaded}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer border border-slate-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>الدخول للغرفة الاستباقية</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* نصائح تربوية وتوجيهات */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Hand className="w-3.5 h-3.5 text-amber-400" /> استخدم زر "رفع اليد" للمشاركة
              </span>
              <span className="flex items-center gap-1">
                <Mic className="w-3.5 h-3.5 text-emerald-400" /> كتم المايك أثناء شرح المعلم
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> بيئة صفية مشفرة وآمنة
              </span>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
