import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  PhoneOff, 
  Clock, 
  AlertCircle, 
  Radio, 
  ShieldCheck, 
  Hand, 
  ExternalLink,
  Server,
  CheckCircle2,
  RefreshCw,
  Mic,
  Copy,
  Check
} from 'lucide-react';
import { UserProfile, GradeLevel, ArabicTrack, LiveClassSession } from '../types';
import { 
  getActiveLiveClassForGrade, 
  getActiveLiveClassForTeacher, 
  saveLiveClassSession, 
  endLiveClassSession
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

// قائمة خوادم Jitsi المعتمدة (خوادم مستقرة ومجانية 100%)
export const JITSI_SERVERS = [
  {
    id: 'framatalk.org',
    name: 'خادم Framatalk المفتوح (framatalk.org)',
    desc: 'خادم مجاني ومستقر جداً يعمل به جسر الفيديو Videobridge بنسبة 100% (موصى به ⭐)',
    badge: 'موصى به ⭐'
  },
  {
    id: 'meet.jit.si',
    name: 'خادم Jitsi الرسمي (meet.jit.si)',
    desc: 'الخادم الرسمي لمنصة Jitsi (يتطلب تسجيل دخول المعلم كمضيف)',
    badge: 'رسمي'
  }
];

export const sanitizeServerDomain = (domain?: string): string => {
  if (!domain || domain === 'meet.ffrn.de' || domain === 'jitsi.hamburg.ccc.de') {
    return 'framatalk.org';
  }
  return domain;
};

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
  const [selectedServer, setSelectedServer] = useState<string>('framatalk.org'); // الافتراضي خادم Framatalk المستقر والمفتوح
  const [isMeetingActive, setIsMeetingActive] = useState<boolean>(false);
  const [currentRoomName, setCurrentRoomName] = useState<string>('');
  const [activeSession, setActiveSession] = useState<LiveClassSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [popoutNotice, setPopoutNotice] = useState<{ message: string; roomName: string; domain: string } | null>(null);
  const [isLoadingMeeting, setIsLoadingMeeting] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const loadingTimeoutRef = useRef<any>(null);

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
        if (teacherSession?.serverDomain) {
          setSelectedServer(sanitizeServerDomain(teacherSession.serverDomain));
        }
      } else {
        const studentGrade = currentUser.grade || selectedGrade;
        const gradeSession = getActiveLiveClassForGrade(studentGrade);
        setActiveSession(gradeSession);
        if (gradeSession?.serverDomain) {
          setSelectedServer(sanitizeServerDomain(gradeSession.serverDomain));
        }
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
            if (updated.serverDomain) {
              setSelectedServer(sanitizeServerDomain(updated.serverDomain));
            }
            if (!updated.isActive && isMeetingActive && !isTeacher) {
              handleEndOrLeave();
            }
          }
        }
      });
    } catch (e) {
      console.warn('Realtime channel subscribe warning in LiveClassroom:', e);
    }
  }, [currentUser, isTeacher, selectedGrade, isMeetingActive]);

  // تحميل سكريبت Jitsi ديناميكياً من الخوادم المعتمدة
  useEffect(() => {
    if (window.JitsiMeetExternalAPI) {
      setScriptLoaded(true);
      return;
    }

    const scriptUrls = [
      'https://framatalk.org/external_api.js',
      'https://meet.jit.si/external_api.js'
    ];

    let currentScriptIdx = 0;

    const tryLoadScript = () => {
      if (window.JitsiMeetExternalAPI) {
        setScriptLoaded(true);
        return;
      }

      if (currentScriptIdx >= scriptUrls.length) {
        setScriptError('تعذر تحميل مشغل الفيديو المباشر. يرجى التأكد من اتصال الإنترنت أو استخدام زر الفتح في نافذة خارجية.');
        return;
      }

      const url = scriptUrls[currentScriptIdx];
      const script = document.createElement('script');
      script.src = url;
      script.async = true;

      script.onload = () => {
        setScriptLoaded(true);
        setScriptError(null);
      };

      script.onerror = () => {
        currentScriptIdx++;
        tryLoadScript();
      };

      document.body.appendChild(script);
    };

    tryLoadScript();
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

  // تنظيف وإغلاق كامل لموارد الكاميرا والمايكروفون عند مغادرة المكون
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
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

  // تنسيق وقت الحصة
  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // إطلاق اجتماع Jitsi مع تصحيح خيارات configOverwrite ومؤقت أقصاه 3 ثوانٍ
  const startJitsiSession = (roomName: string, overrideDomain?: string) => {
    if (!window.JitsiMeetExternalAPI) {
      setScriptError('سكريبت Jitsi Meet لم يكتمل تحميله بعد. يرجى الانتظار ثوانٍ معدودة.');
      return;
    }

    const domain = overrideDomain || selectedServer;
    setCurrentRoomName(roomName);

    // 1. جعل شاشة الاجتماع نشطة فوراً لتمكين المستخدم من الرؤية وعدم الحجب
    setIsMeetingActive(true);
    setIsLoadingMeeting(true);

    // 2. وضع مؤقت أقصاه 3 ثوانٍ فقط لمؤشر التحميل لإخفاء مؤشر التحميل مهما كانت استجابة السيرفر
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoadingMeeting(false);
    }, 3000);

    // تنظيف أي نسخة سابقة
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.dispose();
      } catch (e) {}
      jitsiApiRef.current = null;
    }

    if (jitsiContainerRef.current) {
      jitsiContainerRef.current.innerHTML = '';
    }

    // إعدادات وتكوين Jitsi المبسطة لتجنب تضارب sourceNameSignaling
    const options = {
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: `${currentUser.name} (${isTeacher ? 'المعلم' : 'طالب'})`
      },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
        prejoinPageEnabled: false
      }
    };

    try {
      const api = new window.JitsiMeetExternalAPI(domain, options);
      jitsiApiRef.current = api;

      // التأكد من أن عنصر الـ iframe يأخذ الصلاحيات الكاملة
      setTimeout(() => {
        try {
          const iframe = api.getIFrame ? api.getIFrame() : jitsiContainerRef.current?.querySelector('iframe');
          if (iframe) {
            iframe.setAttribute('allow', 'camera; microphone; fullscreen; display-capture; autoplay; clipboard-write');
            iframe.setAttribute('allowfullscreen', 'true');
          }
        } catch (e) {
          console.warn('Iframe permissions setup:', e);
        }
      }, 50);

      api.addEventListener('videoConferenceJoined', () => {
        setIsLoadingMeeting(false);
        setPopoutNotice(null);
      });

      // رصد أخطاء المؤتمر وتقديم حل النافذة المستقلة فوراً
      api.addEventListener('videoConferenceFailed', (err: any) => {
        console.warn('Jitsi conference failed:', err);
        setIsLoadingMeeting(false);
        const errStr = JSON.stringify(err || '');

        if (errStr.includes('membersOnly') || (typeof err === 'object' && err?.error?.includes('membersOnly'))) {
          if (domain === 'meet.jit.si') {
            setScriptError('خادم meet.jit.si يتطلب تسجيل دخول كمضيف (أنا المضيف). يتم التحويل الفوري إلى خادم Framatalk المستقر...');
            setTimeout(() => {
              handleSwitchServer('framatalk.org', roomName);
            }, 800);
            return;
          }
        }

        // دعم خيار فتح في نافذة مستقلة (Pop-out) تلقائياً عند فشل الاتصال
        setPopoutNotice({
          message: 'تعذر تشغيل الفيديو داخل الإطار الداخلي (Iframe/Videobridge). يمكنك الانتقال فوراً للنافذة المستقلة ومتابعة الحصة.',
          roomName,
          domain
        });
      });

      api.addEventListener('videoConferenceLeft', () => {
        handleEndOrLeave();
      });

      api.addEventListener('readyToClose', () => {
        handleEndOrLeave();
      });
    } catch (err: any) {
      console.error('Failed to initialize Jitsi:', err);
      setIsLoadingMeeting(false);
      setPopoutNotice({
        message: 'حدث تعثر في مشغل الفيديو الداخلي. يمكنك الدخول المباشر للحصة عبر النافذة الخارجية فوراً.',
        roomName,
        domain
      });
    }
  };

  // التبديل بين الخوادم بسلاسة
  const handleSwitchServer = (newServer: string, roomOverride?: string) => {
    setSelectedServer(newServer);
    const room = roomOverride || currentRoomName || (activeSession?.roomName) || computeRoomName(selectedGrade, currentUser.id);
    if (isMeetingActive) {
      startJitsiSession(room, newServer);
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
      startedAt: new Date().toISOString(),
      serverDomain: selectedServer
    };

    await saveLiveClassSession(newSession);
    setActiveSession(newSession);
    startJitsiSession(roomName);
  };

  // انضمام الطالب للحصة
  const handleStudentJoin = () => {
    const targetDomain = activeSession?.serverDomain || selectedServer;
    setSelectedServer(targetDomain);
    const roomName = activeSession?.roomName || computeRoomName(currentUser.grade || selectedGrade, currentUser.teacherId || 'usr_teacher');
    startJitsiSession(roomName, targetDomain);
  };

  // نسخ رابط الحصة المباشر
  const handleCopyLink = () => {
    const room = currentRoomName || activeSession?.roomName || computeRoomName(selectedGrade, currentUser.id);
    const domain = sanitizeServerDomain(selectedServer || activeSession?.serverDomain);
    const directUrl = `https://${domain}/${room}`;
    navigator.clipboard.writeText(directUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // فتح في نافذة خارجية مباشرة
  const handleOpenExternal = () => {
    const room = currentRoomName || activeSession?.roomName || computeRoomName(selectedGrade, currentUser.id);
    const domain = sanitizeServerDomain(selectedServer || activeSession?.serverDomain);
    const directUrl = `https://${domain}/${room}`;
    window.open(directUrl, '_blank', 'noopener,noreferrer');
  };

  // إنهاء الحصة أو المغادرة وتنظيف الكاميرا والمايك فوراً
  const handleEndOrLeave = async () => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

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
      
      {/* الشريط العلوي للحصة */}
      <header className="bg-slate-950/85 backdrop-blur-md px-4 sm:px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30 shrink-0">
            <Video className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                فَصْلُ مُوسَى المَبَاشِر
              </h2>
              {isMeetingActive ? (
                <span className="flex items-center gap-1 bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse border border-red-400/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  بث مباشر الآن 🔴
                </span>
              ) : (
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                  غرفة البث الآمن
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {formatGradeName(isTeacher ? selectedGrade : (currentUser.grade || selectedGrade))} • {currentUser.name}
            </p>
          </div>
        </div>

        {/* مدة الحصة وشارات التحكم والتبديل */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* مؤشر الخادم النشط مع إمكانية التبديل */}
          <div className="flex items-center gap-1 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/60 text-xs">
            <Server className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] text-slate-300 font-mono hidden sm:inline">{selectedServer}</span>
            <select
              value={selectedServer}
              onChange={(e) => handleSwitchServer(e.target.value)}
              className="bg-transparent text-emerald-400 text-xs font-bold focus:outline-none cursor-pointer pr-1 max-w-[170px]"
              title="تبديل خادم البث المباشر"
            >
              {JITSI_SERVERS.map((srv) => (
                <option key={srv.id} value={srv.id} className="bg-slate-900 text-white">
                  {srv.name}
                </option>
              ))}
            </select>
          </div>

          {/* عداد وقت الحصة */}
          {isMeetingActive && (
            <div className="flex items-center gap-1.5 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs font-mono font-bold text-emerald-400">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formatDuration(elapsedSeconds)}</span>
            </div>
          )}

          {/* زر فتح في نافذة خارجية */}
          {isMeetingActive && (
            <button
              onClick={handleOpenExternal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
              title="فتح الاجتماع في نافذة مستقلة بملء الشاشة"
            >
              <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden md:inline">نافذة خارجية</span>
            </button>
          )}

          {/* زر نسخ الرابط */}
          {isMeetingActive && isTeacher && (
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
              title="نسخ رابط الحصة المباشر"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
              <span className="hidden md:inline">{copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}</span>
            </button>
          )}

          {/* زر إنهاء أو مغادرة الحصة */}
          {isMeetingActive && (
            <button
              id="live-classroom-hangup-btn"
              onClick={handleEndOrLeave}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-red-600/20 cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>{isTeacher ? 'إنهاء الحصة 🛑' : 'مغادرة الحصة 🚪'}</span>
            </button>
          )}
        </div>
      </header>

      {/* مساحة العرض الرئيسية */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-2 sm:p-4 bg-slate-900 overflow-hidden">
        
        {/* تنبيه الخطأ أو التبديل التلقائي إن وُجد */}
        {scriptError && (
          <div className="absolute top-2 left-4 right-4 z-40 p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-xs text-amber-200 flex items-center justify-between gap-2 shadow-xl backdrop-blur-md animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{scriptError}</span>
            </div>
            <button
              onClick={() => setScriptError(null)}
              className="text-amber-300 hover:text-white text-xs font-bold px-2 py-0.5 rounded bg-black/20"
            >
              إغلاق ✕
            </button>
          </div>
        )}

        {/* حاوية Iframe الخاصة بـ Jitsi - مأهولة ومرئية دائماً عند بدء الاجتماع دون حجب */}
        <div 
          ref={jitsiContainerRef} 
          id="jitsi-meet-viewport"
          className={`w-full h-full rounded-2xl overflow-hidden bg-slate-950 relative ${
            isMeetingActive ? 'block' : 'hidden'
          }`}
        />

        {/* بطاقة حل الطوارئ التلقائي الفوري (Pop-out) عند حدوث أي خلل في الـ Iframe */}
        {isMeetingActive && popoutNotice && (
          <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="max-w-md w-full bg-slate-900 border border-amber-500/50 rounded-3xl p-6 sm:p-7 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                <AlertCircle className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-black text-white">حل الطوارئ الفوري للحصة 🚀</h4>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {popoutNotice.message}
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const url = `https://${popoutNotice.domain}/${popoutNotice.roomName}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-xl transition shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح في نافذة مستقلة (Pop-out) الآن 🎥</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchServer('framatalk.org', popoutNotice.roomName)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition cursor-pointer"
                  >
                    إعادة المحاولة على Framatalk
                  </button>
                  <button
                    type="button"
                    onClick={() => setPopoutNotice(null)}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs rounded-xl transition cursor-pointer"
                  >
                    إخفاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* شريط المساعدة السريع إذا كان المستخدم على خادم jit.si الرسمي الذي يتطلب مضيفاً */}
        {isMeetingActive && selectedServer === 'meet.jit.si' && (
          <div className="absolute top-3 left-4 right-4 z-30 p-2.5 bg-indigo-950/95 border border-indigo-500/50 rounded-2xl text-xs text-indigo-100 flex flex-wrap items-center justify-between gap-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                <b>ملاحظة:</b> إذا ظهرت لك رسالة "أنا المضيف" (Moderator)، يمكنك تسجيل الدخول بحساب Google أو الانتقال فوراً لخادم Framatalk المفتوح بدون تسجيل:
              </span>
            </div>
            <button
              onClick={() => handleSwitchServer('framatalk.org')}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 shrink-0"
            >
              <span>التحويل لخادم Framatalk فوراً ⚡</span>
            </button>
          </div>
        )}

        {/* مؤشر التحميل المؤقت (أقصاه 3 ثوانٍ فقط، غير حاجب لـ Jitsi Iframe) */}
        {isMeetingActive && isLoadingMeeting && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 border border-emerald-500/40 text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />
            <div className="text-right">
              <p className="text-xs font-bold text-slate-100">جارٍ تهيئة غرفة الفيديو...</p>
              <p className="text-[10px] text-slate-400">الخادم: {selectedServer}</p>
            </div>
            <button 
              onClick={() => setIsLoadingMeeting(false)}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-[10px] rounded-lg text-slate-300 hover:text-white transition cursor-pointer"
            >
              إخفاء المؤشر
            </button>
          </div>
        )}

        {/* الشاشة الترحيبية وغرفة الانتظار قبل بدء الاجتماع */}
        {!isMeetingActive && (
          <div className="max-w-xl w-full bg-slate-950/70 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl text-center space-y-5 shadow-2xl">
            
            {/* أيقونة تفاعلية */}
            <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <Radio className="w-8 h-8 sm:w-10 sm:h-10 text-white animate-pulse" />
              {activeSession && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-slate-950"></span>
                </span>
              )}
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                {isTeacher ? 'غرفة التحكم في البث المباشر 🎙️' : 'صالة استقبال الطلاب للبث المباشر 🌟'}
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                تقنية فصل موسى التفاعلي تتيح بث الصوت والصورة ومشاركة الشاشة ورفع اليد بجودة عالية ومجانية 100% دون أي رسوم أو قيود.
              </p>
            </div>

            {/* اختيار الخادم المسبق */}
            <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl text-right space-y-2">
              <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>خادم البث المباشر:</span>
                <span className="text-[10px] text-emerald-400 font-normal">مجاني 100% وبلا قيود</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {JITSI_SERVERS.map((srv) => (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => setSelectedServer(srv.id)}
                    className={`p-2.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                      selectedServer === srv.id
                        ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{srv.name}</span>
                      {selectedServer === srv.id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">{srv.desc}</span>
                  </button>
                ))}
              </div>
            </div>

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

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    id="start-live-class-btn"
                    onClick={handleTeacherStart}
                    disabled={!scriptLoaded}
                    className="flex-1 py-3 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 text-white font-black text-xs sm:text-sm rounded-xl transition shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Radio className="w-4 h-4 text-white animate-pulse" />
                    <span>بدء الحصة المباشرة الآن 🎙️</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenExternal}
                    className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="فتح غرفة الحصة مباشرة في نافذة مستقلة بمتصفحك"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
                    <span>نافذة خارجية</span>
                  </button>
                </div>
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

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <button
                        id="student-join-live-class-btn"
                        onClick={handleStudentJoin}
                        disabled={!scriptLoaded}
                        className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm rounded-xl transition shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer animate-bounce"
                      >
                        <Video className="w-4 h-4" />
                        <span>انضم إلى الحصة الآن 🚀</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenExternal}
                        className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        title="الانضمام عبر نافذة مستقلة"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
                        <span>نافذة خارجية</span>
                      </button>
                    </div>
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
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        onClick={handleStudentJoin}
                        disabled={!scriptLoaded}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer border border-slate-700"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>الدخول للغرفة الاستباقية</span>
                      </button>
                      <button
                        onClick={handleOpenExternal}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-xs rounded-xl border border-slate-700"
                        title="فتح في نافذة جديدة"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
                        <span>نافذة جديدة</span>
                      </button>
                    </div>
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
