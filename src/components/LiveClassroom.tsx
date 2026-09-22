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
  Check,
  MessageSquare,
  Monitor,
  VolumeX,
  Volume2,
  Sparkles,
  Lock,
  Unlock,
  X,
  Send,
  UserCheck
} from 'lucide-react';
import { UserProfile, GradeLevel, ArabicTrack, LiveClassSession, LiveClassPermissions } from '../types';
import { 
  getActiveLiveClassForGrade, 
  getActiveLiveClassForTeacher, 
  saveLiveClassSession, 
  endLiveClassSession,
  syncLiveClassSessionsFromCloud
} from '../storage';
import { supabase } from '../supabaseClient';
import { challengeAudio } from '../utils/challengeAudio';

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
  const [isRefreshingStatus, setIsRefreshingStatus] = useState<boolean>(false);

  // حالات الصلاحيات الحية للحصة المباشرة (Live Class Permissions)
  const [livePermissions, setLivePermissions] = useState<LiveClassPermissions>({
    allowChat: false,
    allowScreenShare: false
  });
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState<boolean>(false);

  // إشعار موسى التفاعلي اللطيف للطالب
  const [mousaToast, setMousaToast] = useState<{ id: string; text: string; icon: 'chat' | 'screen' | 'mute' } | null>(null);

  // حالة فتح نافذة الدردشة عند الطالب
  const [isStudentChatOpen, setIsStudentChatOpen] = useState<boolean>(false);
  const [studentChatMessages, setStudentChatMessages] = useState<Array<{ id: string; sender: string; isTeacher: boolean; text: string; time: string }>>([
    {
      id: 'welcome',
      sender: 'مُوسَى الودود 🌟',
      isTeacher: false,
      text: 'أهلاً بكم في حصتنا المباشرة! استمعوا لتوجيهات المعلم وشاركوا بفصاحة وأدب ✨',
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInputText, setChatInputText] = useState<string>('');
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const loadingTimeoutRef = useRef<any>(null);
  const prevPermissionsRef = useRef<LiveClassPermissions>({ allowChat: false, allowScreenShare: false });

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

  // التمرير لأسفل قائمة رسائل الشات عند وصول رسالة جديدة
  useEffect(() => {
    if (isStudentChatOpen) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [studentChatMessages, isStudentChatOpen]);

  // إرسال رسالة في شات الصف التفاعلي
  const handleSendChatMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInputText.trim() || (!isTeacher && !livePermissions.allowChat)) return;

    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender: currentUser.name + (isTeacher ? ' (المعلم) 🎓' : ''),
      isTeacher: isTeacher,
      text: chatInputText.trim(),
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };

    setStudentChatMessages(prev => [...prev, newMsg]);
    setChatInputText('');

    // بث الرسالة عبر Supabase Realtime لجميع الحاضرين
    try {
      const channel = supabase.channel('lwm-realtime-sync');
      channel.send({
        type: 'broadcast',
        event: 'live_chat_message',
        payload: {
          roomName: currentRoomName || activeSession?.roomName,
          message: newMsg
        }
      });
    } catch (err) {
      console.warn('Realtime chat broadcast failed:', err);
    }

    // إرسال الرسالة إلى شات Jitsi أيضاً إن وُجد
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.executeCommand('sendChatMessage', newMsg.text);
      } catch (err) {}
    }
  };

  // فحص الجلسات الحية النشطة والتحقق الصارم من Supabase
  useEffect(() => {
    const checkActiveSession = async () => {
      // مزامنة سريعة من السحابة للتأكد من حالة البث الحقيقية
      try {
        const cloudSessions = await syncLiveClassSessionsFromCloud();
        if (isTeacher) {
          const teacherSession = cloudSessions.find(s => s.isActive && s.teacherId === currentUser.id) || null;
          setActiveSession(teacherSession);
          if (teacherSession?.permissions) {
            setLivePermissions(teacherSession.permissions);
            prevPermissionsRef.current = teacherSession.permissions;
          }
          if (teacherSession?.serverDomain) {
            setSelectedServer(sanitizeServerDomain(teacherSession.serverDomain));
          }
        } else {
          const studentGrade = currentUser.grade || selectedGrade;
          const gradeSession = cloudSessions.find(s => s.isActive && (s.grade === studentGrade || s.grade === 'all')) || null;
          setActiveSession(gradeSession);
          if (gradeSession?.permissions) {
            setLivePermissions(gradeSession.permissions);
            prevPermissionsRef.current = gradeSession.permissions;
          }
          if (gradeSession?.serverDomain) {
            setSelectedServer(sanitizeServerDomain(gradeSession.serverDomain));
          }
        }
      } catch (err) {
        // العودة للتخزين المحلي في حال تعثر الشبكة
        if (isTeacher) {
          const teacherSession = getActiveLiveClassForTeacher(currentUser.id);
          setActiveSession(teacherSession);
          if (teacherSession?.permissions) {
            setLivePermissions(teacherSession.permissions);
            prevPermissionsRef.current = teacherSession.permissions;
          }
        } else {
          const studentGrade = currentUser.grade || selectedGrade;
          const gradeSession = getActiveLiveClassForGrade(studentGrade);
          setActiveSession(gradeSession);
          if (gradeSession?.permissions) {
            setLivePermissions(gradeSession.permissions);
            prevPermissionsRef.current = gradeSession.permissions;
          }
        }
      }
    };

    checkActiveSession();

    // الاستماع للتحديثات اللحظية عبر Supabase Broadcast
    try {
      const channel = supabase.channel('lwm-realtime-sync');
      
      // استقبال تحديث الجلسة وتحديث الصلاحيات اللحظي
      channel.on('broadcast', { event: 'live_session_update' }, (payload: any) => {
        if (payload?.payload) {
          const updated: LiveClassSession = payload.payload;
          const relevantGrade = currentUser.grade || selectedGrade;
          if (updated.grade === relevantGrade || updated.grade === 'all' || updated.teacherId === currentUser.id) {
            setActiveSession(updated.isActive ? updated : null);
            if (updated.serverDomain) {
              setSelectedServer(sanitizeServerDomain(updated.serverDomain));
            }
            if (updated.permissions) {
              handleIncomingPermissions(updated.permissions);
            }
            if (!updated.isActive && isMeetingActive && !isTeacher) {
              handleEndOrLeave();
            }
          }
        }
      });

      // استقبال رسائل الدردشة الصفيّة الفورية
      channel.on('broadcast', { event: 'live_chat_message' }, (payload: any) => {
        if (payload?.payload) {
          const { roomName, message } = payload.payload;
          const myRoom = currentRoomName || activeSession?.roomName;
          if (message && (!roomName || roomName === myRoom)) {
            setStudentChatMessages(prev => {
              if (prev.some(m => m.id === message.id)) return prev;
              return [...prev, message];
            });
            // نغمة خفيفة عند وصول رسالة جديدة
            try {
              challengeAudio.playTick();
            } catch (e) {}
          }
        }
      });
    } catch (e) {
      console.warn('Realtime channel subscribe warning in LiveClassroom:', e);
    }
  }, [currentUser, isTeacher, selectedGrade, isMeetingActive]);

  // دالة معالجة الصلاحيات الجديدة الواردة من السحابة أو البث اللحظي
  const handleIncomingPermissions = (newPerms: LiveClassPermissions) => {
    const prev = prevPermissionsRef.current;
    setLivePermissions(newPerms);
    prevPermissionsRef.current = newPerms;

    // إذا كان المستخدم طالباً: تفعيل الإشعارات وتكييف الواجهة و Jitsi
    if (!isTeacher) {
      // 1. فحص تبدل صلاحية الدردشة
      if (!prev.allowChat && newPerms.allowChat) {
        showMousaToast('المعلم فتح الدردشة الصفيّة! شارك بأدب وفصاحة 💬', 'chat');
        try { challengeAudio.playCorrect(); } catch (e) {}
      } else if (prev.allowChat && !newPerms.allowChat) {
        // إغلاق أي نافذة دردشة مفتوحة فوراً لمنع التشتت والعبث
        setIsStudentChatOpen(false);
      }

      // 2. فحص تبدل صلاحية مشاركة الشاشة
      if (!prev.allowScreenShare && newPerms.allowScreenShare) {
        showMousaToast('يمكنك الآن مشاركة شاشتك وعرض إبداعك 🖥️', 'screen');
        try { challengeAudio.playCorrect(); } catch (e) {}
      }

      // 3. تحديث أزرار شريط أدوات Jitsi ديناميكياً بحسب الصلاحيات المحدثة
      updateStudentJitsiToolbar(newPerms);
    }
  };

  // إظهار إشعار موسى التفاعلي اللطيف للطالب
  const showMousaToast = (text: string, icon: 'chat' | 'screen' | 'mute') => {
    setMousaToast({
      id: Math.random().toString(),
      text,
      icon
    });
    setTimeout(() => {
      setMousaToast(prev => (prev?.text === text ? null : prev));
    }, 6000);
  };

  // تحديث شريط أدوات Jitsi للطالب حياً عند تغيير الصلاحيات
  const updateStudentJitsiToolbar = (perms: LiveClassPermissions) => {
    if (!jitsiApiRef.current) return;
    try {
      const buttons = ['microphone', 'camera', 'raisehand', 'hangup'];
      if (perms.allowChat) buttons.push('chat');
      if (perms.allowScreenShare) buttons.push('desktop');

      // بعض إصدارات Jitsi تدعم setToolbarButtons أو executeCommand
      if (typeof jitsiApiRef.current.executeCommand === 'function') {
        try {
          jitsiApiRef.current.executeCommand('setToolbarButtons', buttons);
        } catch (e) {
          // بديل: تعديل عناصر التحكم أو إعادة ضبط جودة الفيديو دون قطع المكالمة
          jitsiApiRef.current.executeCommand('setVideoQuality', 720);
        }
      }
    } catch (e) {
      console.warn('Error dynamically updating Jitsi student toolbar:', e);
    }
  };

  // تبديل المعلم لصلاحيات الحصة المباشرة وبثها سحابياً ولحظياً
  const handleTogglePermission = async (key: keyof LiveClassPermissions) => {
    if (!isTeacher || !activeSession || isUpdatingPermissions) return;

    setIsUpdatingPermissions(true);
    const updatedPermissions: LiveClassPermissions = {
      ...livePermissions,
      [key]: !livePermissions[key]
    };

    setLivePermissions(updatedPermissions);
    prevPermissionsRef.current = updatedPermissions;

    try {
      const updatedSession: LiveClassSession = {
        ...activeSession,
        permissions: updatedPermissions
      };

      setActiveSession(updatedSession);
      await saveLiveClassSession(updatedSession);
      try { challengeAudio.playTick(); } catch (e) {}
    } catch (err) {
      console.error('Failed to update live permissions:', err);
    } finally {
      setIsUpdatingPermissions(false);
    }
  };

  // أمر كتم أصوات جميع الطلاب بنقرة واحدة (Mute Everyone) للمعلم المشرف
  const handleMuteEveryone = () => {
    if (!isTeacher || !jitsiApiRef.current) return;
    try {
      if (typeof jitsiApiRef.current.executeCommand === 'function') {
        jitsiApiRef.current.executeCommand('muteEveryone');
        try { challengeAudio.playCorrect(); } catch (e) {}
      }
    } catch (err) {
      console.warn('Jitsi muteEveryone command error:', err);
    }
  };

  // تنفيذ أمر رفع اليد للطالب
  const handleStudentRaiseHand = () => {
    if (jitsiApiRef.current && typeof jitsiApiRef.current.executeCommand === 'function') {
      try {
        jitsiApiRef.current.executeCommand('toggleRaiseHand');
        try { challengeAudio.playTick(); } catch (e) {}
      } catch (err) {}
    }
  };

  // تنفيذ أمر مشاركة الشاشة للطالب عند السماح له
  const handleStudentToggleDesktop = () => {
    if (!livePermissions.allowScreenShare) return;
    if (jitsiApiRef.current && typeof jitsiApiRef.current.executeCommand === 'function') {
      try {
        jitsiApiRef.current.executeCommand('toggleShareScreen');
        try { challengeAudio.playTick(); } catch (e) {}
      } catch (err) {}
    }
  };

  // تنفيذ فتح أو إغلاق الدردشة للطالب
  const handleStudentToggleChat = () => {
    if (!livePermissions.allowChat) return;
    setIsStudentChatOpen(prev => !prev);
    if (jitsiApiRef.current && typeof jitsiApiRef.current.executeCommand === 'function') {
      try {
        jitsiApiRef.current.executeCommand('toggleChat');
      } catch (err) {}
    }
  };

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

    // بناء قائمة أزرار الطالب في Jitsi ديناميكياً حسب صلاحيات الجلسة
    const studentButtons = ['microphone', 'camera', 'raisehand', 'hangup'];
    if (livePermissions.allowChat) {
      studentButtons.push('chat');
    }
    if (livePermissions.allowScreenShare) {
      studentButtons.push('desktop');
    }

    // ضبط خصائص مكالمة Jitsi للطلاب لمنع المشتتات ومنع دعوة غرباء
    const studentConfigOverwrite = {
      disableDeepLinking: true,
      prejoinPageEnabled: false,
      disableInviteFunctions: true, // منع دعوة أي شخص خارجي تماماً وإخفاء زر Invite someone
      enableInsecureRoomNameWarning: false,
      toolbarButtons: studentButtons
    };

    const studentInterfaceConfigOverwrite = {
      TOOLBAR_BUTTONS: studentButtons,
      SETTINGS_SECTIONS: ['devices'], // إخفاء إعدادات الأمان والإشراف
      HIDE_INVITE_MORE_HEADER: true
    };

    // إعدادات المعلم كمشرف كامل (Moderator)
    const teacherConfigOverwrite = {
      startWithAudioMuted: false,
      startWithVideoMuted: false,
      disableDeepLinking: true,
      prejoinPageEnabled: false,
      enableUserRolesBasedOnToken: false,
      toolbarButtons: [
        'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
        'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
        'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
        'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
        'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone', 'security'
      ]
    };

    const options: any = {
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: isTeacher ? `${currentUser.name} (المعلم)` : currentUser.name,
        role: isTeacher ? 'moderator' : 'participant'
      },
      configOverwrite: isTeacher ? teacherConfigOverwrite : studentConfigOverwrite
    };

    if (!isTeacher) {
      options.interfaceConfigOverwrite = studentInterfaceConfigOverwrite;
    }

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

      // رصد أخطاء المؤتمر وتقديم حل النافذة المستقلة للمعلم أو تنبيه مبسط للطالب
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
          message: isTeacher
            ? 'تعذر تشغيل الفيديو داخل الإطار الداخلي (Iframe/Videobridge). يمكنك الانتقال فوراً للنافذة المستقلة ومتابعة الحصة.'
            : 'عذراً يا بطل! تعذر الاتصال بالغرفة حالياً. يمكنك إعادة المحاولة أو مغادرة الحصة.',
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
        message: isTeacher
          ? 'حدث تعثر في مشغل الفيديو الداخلي. يمكنك الدخول المباشر للحصة عبر النافذة الخارجية فوراً.'
          : 'تعذر الاتصال بغرفة الحصة المباشرة. يرجى المحاولة بعد قليل.',
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

    const initialPerms: LiveClassPermissions = {
      allowChat: false,
      allowScreenShare: false
    };
    setLivePermissions(initialPerms);
    prevPermissionsRef.current = initialPerms;

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
      serverDomain: selectedServer,
      permissions: initialPerms
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
    if (activeSession?.permissions) {
      setLivePermissions(activeSession.permissions);
      prevPermissionsRef.current = activeSession.permissions;
    }
    startJitsiSession(roomName, targetDomain);
  };

  // تحديث حالة البث الصارمة للطالب من Supabase
  const handleRefreshStatus = async () => {
    setIsRefreshingStatus(true);
    try {
      const cloudSessions = await syncLiveClassSessionsFromCloud();
      const studentGrade = currentUser.grade || selectedGrade;
      const found = cloudSessions.find(s => s.isActive && (s.grade === studentGrade || s.grade === 'all')) || null;
      setActiveSession(found);
      if (found?.serverDomain) {
        setSelectedServer(sanitizeServerDomain(found.serverDomain));
      }
      if (found?.permissions) {
        handleIncomingPermissions(found.permissions);
      }
    } finally {
      setTimeout(() => {
        setIsRefreshingStatus(false);
      }, 500);
    }
  };

  // نسخ رابط الحصة المباشر (للمعلم فقط)
  const handleCopyLink = () => {
    const room = currentRoomName || activeSession?.roomName || computeRoomName(selectedGrade, currentUser.id);
    const domain = sanitizeServerDomain(selectedServer || activeSession?.serverDomain);
    const directUrl = `https://${domain}/${room}`;
    navigator.clipboard.writeText(directUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // فتح في نافذة خارجية مباشرة (للمعلم فقط)
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
    setIsStudentChatOpen(false);

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
          
          {/* مؤشر الخادم النشط مع إمكانية التبديل (خاص بالمعلم فقط) */}
          {isTeacher && (
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
          )}

          {/* عداد وقت الحصة */}
          {isMeetingActive && (
            <div className="flex items-center gap-1.5 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs font-mono font-bold text-emerald-400">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formatDuration(elapsedSeconds)}</span>
            </div>
          )}

          {/* زر فتح في نافذة خارجية (مرئي فقط للمعلم) */}
          {isMeetingActive && isTeacher && (
            <button
              onClick={handleOpenExternal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
              title="فتح الاجتماع في نافذة مستقلة بملء الشاشة"
            >
              <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden md:inline">نافذة خارجية</span>
            </button>
          )}

          {/* زر نسخ الرابط (خاص بالمعلم فقط) */}
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

      {/* ============================================================================== */}
      {/* 1. شريط أدوات صلاحيات الحصة للمعلم (Teacher Live Permissions Bar) */}
      {/* ============================================================================== */}
      {isMeetingActive && isTeacher && (
        <div 
          id="teacher-live-permissions-bar"
          className="bg-slate-950/95 border-b border-emerald-500/30 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 z-30 shadow-md backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>تحكم الصلاحيات الحية للطلاب:</span>
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              (تُبث التغييرات لحظياً لجميع الطلاب دون إعادة تحميل الصفحة)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* مفتاح تبديل الدردشة الصفيّة */}
            <button
              id="toggle-live-chat-btn"
              type="button"
              onClick={() => handleTogglePermission('allowChat')}
              disabled={isUpdatingPermissions}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                livePermissions.allowChat
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-600/20 animate-pulse'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={livePermissions.allowChat ? 'انقر لتعطيل الدردشة الصفيّة للطلاب' : 'انقر للسماح بالدردشة الصفيّة للطلاب'}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>
                {livePermissions.allowChat ? '💬 الدردشة الصفيّة: مفعّلة للطلاب' : '💬 الدردشة: معطلة (افتراضي)'}
              </span>
              <span className={`w-2 h-2 rounded-full ${livePermissions.allowChat ? 'bg-emerald-200' : 'bg-slate-500'}`} />
            </button>

            {/* مفتاح تبديل مشاركة الشاشة للطلاب */}
            <button
              id="toggle-live-screenshare-btn"
              type="button"
              onClick={() => handleTogglePermission('allowScreenShare')}
              disabled={isUpdatingPermissions}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                livePermissions.allowScreenShare
                  ? 'bg-teal-600 hover:bg-teal-500 text-white border-teal-400 shadow-lg shadow-teal-600/20 animate-pulse'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={livePermissions.allowScreenShare ? 'انقر لمنع الطلاب من مشاركة الشاشة' : 'انقر للسماح للطلاب بمشاركة الشاشة'}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>
                {livePermissions.allowScreenShare ? '🖥️ مشاركة الشاشة: مسموحة' : '🖥️ مشاركة الشاشة: معطلة'}
              </span>
              <span className={`w-2 h-2 rounded-full ${livePermissions.allowScreenShare ? 'bg-teal-200' : 'bg-slate-500'}`} />
            </button>

            {/* زر المشرف: كتم صوت الجميع بنقرة واحدة (Mute Everyone) */}
            <button
              id="mute-everyone-btn"
              type="button"
              onClick={handleMuteEveryone}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
              title="كتم أصوات جميع ميكروفونات الطلاب بنقرة واحدة"
            >
              <VolumeX className="w-3.5 h-3.5 text-amber-400" />
              <span>كتم صوت الجميع 🔇</span>
            </button>
          </div>
        </div>
      )}

      {/* مساحة العرض الرئيسية */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-2 sm:p-4 bg-slate-900 overflow-hidden">
        
        {/* ============================================================================== */}
        {/* 4. إشعار تفاعلي لطيف للطالب بصوت ورسالة موسى الذكية */}
        {/* ============================================================================== */}
        {mousaToast && !isTeacher && (
          <div 
            id="mousa-live-permission-toast"
            className="absolute top-4 right-4 sm:right-6 z-50 max-w-sm w-full bg-gradient-to-r from-emerald-900/95 via-teal-900/95 to-slate-900/95 border-2 border-emerald-400 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-300"
          >
            <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-emerald-300 shadow-md bg-white shrink-0 p-0.5">
              <img src="/mousa-avatar.png" alt="موسى" className="w-full h-full object-cover rounded-xl" />
            </div>
            <div className="flex-1 text-right">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-300">
                <Sparkles className="w-3 h-3 text-emerald-300 animate-spin" />
                <span>رسالة من مُوسَى المباشر:</span>
              </div>
              <p className="text-xs font-bold text-white mt-0.5 leading-snug">
                {mousaToast.text}
              </p>
            </div>
            <button
              onClick={() => setMousaToast(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* تنبيه الخطأ أو التبديل التلقائي إن وُجد (للمعلم فقط) */}
        {scriptError && isTeacher && (
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

        {/* ============================================================================== */}
        {/* 2 & 3. شريط أدوات الطالب الديناميكي المتكيف لحظياً مع صلاحيات المعلم */}
        {/* ============================================================================== */}
        {isMeetingActive && !isTeacher && (
          <div 
            id="student-live-action-bar"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 bg-slate-950/90 border border-slate-700/80 px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-lg flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2"
          >
            {/* زر رفع اليد الدائم */}
            <button
              type="button"
              onClick={handleStudentRaiseHand}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
              title="رفع اليد لطلب الكلمة من المعلم"
            >
              <Hand className="w-3.5 h-3.5 text-amber-400" />
              <span>رفع اليد ✋</span>
            </button>

            {/* زر الدردشة الصفيّة: يظهر فقط إذا سمح المعلم (allowChat === true) */}
            {livePermissions.allowChat ? (
              <button
                id="student-chat-action-btn"
                type="button"
                onClick={handleStudentToggleChat}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer animate-in zoom-in-95 ${
                  isStudentChatOpen
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                }`}
                title="فتح أو إغلاق الدردشة الصفيّة"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>الدردشة 💬</span>
              </button>
            ) : null}

            {/* زر مشاركة الشاشة: يظهر فقط إذا سمح المعلم (allowScreenShare === true) */}
            {livePermissions.allowScreenShare ? (
              <button
                id="student-screenshare-action-btn"
                type="button"
                onClick={handleStudentToggleDesktop}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 rounded-xl text-xs font-bold transition cursor-pointer animate-in zoom-in-95"
                title="مشاركة الشاشة وعرض أعمالك للمعلم والزملاء"
              >
                <Monitor className="w-3.5 h-3.5 text-teal-400" />
                <span>مشاركة الشاشة 🖥️</span>
              </button>
            ) : null}

            {/* زر مغادرة الحصة */}
            <button
              type="button"
              onClick={handleEndOrLeave}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5 text-red-400" />
              <span>مغادرة 🚪</span>
            </button>
          </div>
        )}

        {/* صندوق الدردشة الصفيّة التفاعلي المباشر (عند فتحها للطالب أو المعلم) */}
        {isMeetingActive && isStudentChatOpen && (
          <div 
            id="student-live-chat-panel"
            className="absolute bottom-16 left-4 sm:left-6 z-50 w-80 sm:w-96 max-h-[420px] h-[380px] bg-slate-950/95 border-2 border-emerald-500/40 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95"
          >
            {/* رأس صندوق الشات */}
            <div className="bg-emerald-950/80 px-4 py-2.5 border-b border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-black text-white">الدردشة الصفيّة التفاعلية 💬</h4>
              </div>
              <button
                onClick={() => setIsStudentChatOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* قائمة الرسائل */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-right">
              {studentChatMessages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`p-2.5 rounded-2xl text-xs max-w-[85%] ${
                    msg.isTeacher 
                      ? 'bg-emerald-900/60 border border-emerald-500/30 text-emerald-100 mr-auto'
                      : 'bg-slate-900/80 border border-slate-800 text-slate-200 ml-auto'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 mb-1">
                    <span className="font-bold text-white">{msg.sender}</span>
                    <span>{msg.time}</span>
                  </div>
                  <p className="leading-relaxed break-words">{msg.text}</p>
                </div>
              ))}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* نموذج كتابة الرسالة */}
            <form onSubmit={handleSendChatMessage} className="p-2.5 bg-slate-900/90 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
                placeholder="اكتب رسالتك بأدب وفصاحة..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={!chatInputText.trim()}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* بطاقة حل الطوارئ التلقائي الفوري (Pop-out) عند حدوث أي خلل في الـ Iframe */}
        {isMeetingActive && popoutNotice && (
          <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="max-w-md w-full bg-slate-900 border border-amber-500/50 rounded-3xl p-6 sm:p-7 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                <AlertCircle className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-black text-white">
                  {isTeacher ? 'حل الطوارئ الفوري للحصة 🚀' : 'تعذر الاتصال بالبث ⚠️'}
                </h4>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {popoutNotice.message}
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                {isTeacher ? (
                  <>
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
                  </>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startJitsiSession(popoutNotice.roomName, popoutNotice.domain)}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>إعادة المحاولة 🔄</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleEndOrLeave}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      مغادرة الحصة 🚪
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* شريط المساعدة السريع إذا كان المعلم على خادم jit.si الرسمي الذي يتطلب مضيفاً */}
        {isMeetingActive && isTeacher && selectedServer === 'meet.jit.si' && (
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
              {isTeacher && <p className="text-[10px] text-slate-400">الخادم: {selectedServer}</p>}
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
            
            {/* واجهة المعلم الكاملة لإدارة وبدء البث المباشر */}
            {isTeacher && (
              <>
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
                    غرفة التحكم في البث المباشر 🎙️
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    تقنية فصل موسى التفاعلي تتيح بث الصوت والصورة ومشاركة الشاشة ورفع اليد وإدارة صلاحيات الطلاب الحية بسهولة تامة.
                  </p>
                </div>

                {/* اختيار الخادم المسبق (للمعلم فقط) */}
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
              </>
            )}

            {/* واجهة الطالب الصديقة والمشجعة الخالية تماماً من المشتتات والخيارات التقنية */}
            {!isTeacher && (
              <div className="space-y-4">
                {activeSession ? (
                  <div className="bg-emerald-950/50 border border-emerald-500/50 rounded-3xl p-6 text-center space-y-4 shadow-xl shadow-emerald-900/30 animate-in fade-in zoom-in-95">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-black animate-pulse shadow-md shadow-red-600/30">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      المعلم في البث المباشر الآن! 🔴
                    </div>
                    <h4 className="text-lg font-black text-emerald-300">
                      {activeSession.title}
                    </h4>
                    <p className="text-xs text-slate-300">
                      معلم المادة: <b className="text-white font-bold">{activeSession.teacherName}</b> • {formatGradeName(currentUser.grade || selectedGrade)}
                    </p>

                    <div className="pt-2">
                      <button
                        id="student-join-live-class-btn"
                        onClick={handleStudentJoin}
                        disabled={!scriptLoaded}
                        className="w-full py-4 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm sm:text-base rounded-2xl transition shadow-xl shadow-emerald-600/40 flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                      >
                        <Video className="w-5 h-5" />
                        <span>انضم إلى الحصة الآن 🚀</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 animate-in fade-in">
                    {/* صورة شخصية موسى الودية والمشجعة */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-3xl overflow-hidden border-4 border-emerald-400/40 shadow-2xl bg-white p-1">
                      <img src="/mousa-avatar.png" alt="موسى" className="w-full h-full object-cover rounded-2xl" />
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-base sm:text-lg font-black text-emerald-300">
                        لا توجد حصة مباشرة الآن.. سنخبرك فور بدء معلمك بالحصة! ✨
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                        أهلاً بك يا بطل ({currentUser.name}) في {formatGradeName(currentUser.grade || selectedGrade)}. استعد بكتبك وأدواتك، وسيصلك إشعار البث المباشر فور بدء المعلم!
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleRefreshStatus}
                        disabled={isRefreshingStatus}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingStatus ? 'animate-spin' : ''}`} />
                        <span>تحديث حالة البث الآن 🔄</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* نصائح تربوية وتوجيهات */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
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
