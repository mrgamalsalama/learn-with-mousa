import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, X, Clock, Search, ShieldCheck, 
  GraduationCap, Users, Sparkles, RefreshCw, 
  ChevronRight, Check, CheckCheck
} from 'lucide-react';
import { 
  UserProfile, 
  ChatConversation, 
  ChatMessage, 
  ChatContact 
} from '../types';
import { 
  getPermittedContacts, 
  getOrCreateConversation, 
  fetchMessages, 
  sendMessage, 
  markMessagesAsRead,
  subscribeToConversationMessages,
  playChatChime,
  fetchSchoolConversationsForSupervision,
  generateUUID
} from '../services/chatService';

interface EducationalChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  allUsers: UserProfile[];
}

export const EducationalChatModal: React.FC<EducationalChatModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers
}) => {
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeFilterRole, setActiveFilterRole] = useState<'all' | 'teacher' | 'student' | 'parent' | 'hod'>('all');
  
  // وضع الرقابة الإشرافية لرئيس القسم والمدير
  const [isSupervisionMode, setIsSupervisionMode] = useState(false);
  const [supervisedConversations, setSupervisedConversations] = useState<ChatConversation[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // قائمة جهات الاتصال المسموح بها وفق مصفوفة الحوكمة
  const permittedContacts = useMemo(() => {
    return getPermittedContacts(currentUser, allUsers);
  }, [currentUser, allUsers]);

  // فلترة جهات الاتصال حسب البحث والنوع
  const filteredContacts = useMemo(() => {
    return permittedContacts.filter(c => {
      const matchRole = activeFilterRole === 'all' || c.user.role === activeFilterRole;
      const matchSearch = 
        c.user.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        (c.studentContext?.name && c.studentContext.name.toLowerCase().includes(searchKeyword.toLowerCase()));
      return matchRole && matchSearch;
    });
  }, [permittedContacts, activeFilterRole, searchKeyword]);

  // تحديد أول جهة اتصال تلقائياً على الشاشات الكبيرة (md فما فوق) فقط
  useEffect(() => {
    if (isOpen && permittedContacts.length > 0 && !activeContact && !isSupervisionMode) {
      if (window.innerWidth >= 768) {
        handleSelectContact(permittedContacts[0]);
      }
    }
  }, [isOpen, permittedContacts.length]);

  // تحميل محادثات الرقابة الإشرافية
  useEffect(() => {
    if (isOpen && isSupervisionMode) {
      fetchSchoolConversationsForSupervision(currentUser.school_id || '').then(res => {
        setSupervisedConversations(res);
      });
    }
  }, [isOpen, isSupervisionMode, currentUser.school_id]);

  // اختيار جهة اتصال وبدء أو استرجاع المحادثة
  const handleSelectContact = async (contact: ChatContact) => {
    setActiveContact(contact);
    setIsLoadingMessages(true);

    try {
      const conv = await getOrCreateConversation({
        schoolId: currentUser.school_id || 'default_school',
        type: contact.conversationType,
        currentUserId: currentUser.id,
        targetUserId: contact.user.id,
        studentContextId: contact.studentContext?.id || null
      });

      setActiveConversation(conv);
      const msgs = await fetchMessages(conv.id);
      setMessages(msgs);

      // تحديد الرسائل كمقروءة
      markMessagesAsRead(conv.id, currentUser.id);
    } catch (err) {
      console.warn('Error loading conversation:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // اختيار محادثة في وضع الرقابة
  const handleSelectSupervisedConv = async (conv: ChatConversation) => {
    setActiveConversation(conv);
    setIsLoadingMessages(true);
    const msgs = await fetchMessages(conv.id);
    setMessages(msgs);
    setIsLoadingMessages(false);
  };

  // الاشتراك اللحظي في الرسائل والاقتراع السريع (Realtime + Polling Fallback)
  useEffect(() => {
    if (!isOpen || !activeConversation) return;

    // 1. اشتراك Supabase Realtime
    const unsubscribe = subscribeToConversationMessages(activeConversation.id, (newMsg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        if (newMsg.sender_id !== currentUser.id) {
          playChatChime('received');
          markMessagesAsRead(activeConversation.id, currentUser.id);
        }
        return [...prev, newMsg];
      });
    });

    // 2. اقتراع دوري خفيف كل 4 ثوانٍ لضمان وصول الرسائل تحت أي ظرف شبكي
    const interval = setInterval(async () => {
      const latest = await fetchMessages(activeConversation.id);
      setMessages(prev => {
        if (latest.length !== prev.length || latest[latest.length - 1]?.id !== prev[prev.length - 1]?.id) {
          if (latest.length > prev.length && latest[latest.length - 1]?.sender_id !== currentUser.id) {
            playChatChime('received');
            markMessagesAsRead(activeConversation.id, currentUser.id);
          }
          return latest;
        }
        return prev;
      });
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isOpen, activeConversation?.id, currentUser.id]);

  // التمرير التلقائي لأسفل عند وصول رسالة
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoadingMessages]);

  // إرسال رسالة مع تحديث تفاؤلي فوري (Instant Optimistic Update)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeConversation || isSending) return;

    const content = inputText.trim();
    setInputText('');

    // رسالة فورية تظهر في واجهة المستخدم في نفس اللحظة
    const tempId = generateUUID();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversation_id: activeConversation.id,
      school_id: currentUser.school_id || 'default_school',
      sender_id: currentUser.id,
      content,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setIsSending(true);

    try {
      const sentMsg = await sendMessage({
        conversationId: activeConversation.id,
        schoolId: currentUser.school_id || 'default_school',
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        content
      });

      // تحديث هوية الرسالة بالمعرّف المعتمد
      setMessages(prev => prev.map(m => m.id === tempId ? sentMsg : m));
    } catch (err) {
      console.warn('Failed to send message via cloud, preserved locally:', err);
    } finally {
      setIsSending(false);
    }
  };

  // العبارات التعليمية السريعة
  const quickReplies = [
    'السلام عليكم ورحمة الله وبركاته 🌸',
    'شكراً جزيلاً أستاذنا الفاضل على المتابعة 🌟',
    'أرجو الإفادة حول الواجب والأنشطة المقررة 📚',
    'تم تسليم الواجب المطلوب بحمد الله 👍',
    'بارك الله في جهودك يا بنيّ، مستواك متميز! 🏆'
  ];

  if (!isOpen) return null;

  const canSupervise = ['hod', 'school_admin', 'super_admin', 'supervisor'].includes(currentUser.role);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-5xl h-[92vh] max-h-[820px] rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col relative"
        dir="rtl"
      >
        {/* شريط الرأس الرئيسي للمركز */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white px-4 sm:px-5 py-3.5 flex items-center justify-between shadow-md flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-lg sm:text-xl shadow-xs">
              💬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight">
                  مركز الرسائل المدرسية والتواصل الفوري
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 hidden xs:inline-block">
                  اتصال مباشر وآمن 🔒
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-medium line-clamp-1">
                قنوات معتمدة للتواصل بين المعلمين والطلاب وأولياء الأمور
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canSupervise && (
              <button
                type="button"
                onClick={() => {
                  setIsSupervisionMode(!isSupervisionMode);
                  setActiveContact(null);
                  setActiveConversation(null);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                  isSupervisionMode 
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold' 
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="الاطلاع الرقابي الشامل على محادثات المدرسة"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isSupervisionMode ? 'العودة لرسائلي' : 'الرقابة الإشرافية 👁️'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              title="إغلاق المحادثات"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* جسم النافذة المقسم: القائمة الجانبية + منطقة الدردشة */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* 1. القائمة الجانبية (جهات الاتصال المسموح بها) */}
          <div className={`
            ${activeContact && !isSupervisionMode ? 'hidden md:flex' : 'flex'}
            w-full md:w-80 lg:w-96 bg-slate-50 border-l border-slate-200 flex-col justify-between flex-shrink-0 h-full
          `}>
            {/* مربع البحث والفلترة */}
            <div className="p-3 border-b border-slate-200/80 space-y-2 bg-white flex-shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو الطالب..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50"
                />
              </div>

              {/* أزرار الفلترة للأدوار المتعددة */}
              {(currentUser.role === 'teacher' || currentUser.role === 'hod') && !isSupervisionMode && (
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveFilterRole('all')}
                    className={`px-2 py-0.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                      activeFilterRole === 'all' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    الكل ({permittedContacts.length})
                  </button>
                  {currentUser.role === 'teacher' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveFilterRole('student')}
                        className={`px-2 py-0.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                          activeFilterRole === 'student' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        الطلاب
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFilterRole('parent')}
                        className={`px-2 py-0.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                          activeFilterRole === 'parent' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        أولياء الأمور
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveFilterRole('hod')}
                    className={`px-2 py-0.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                      activeFilterRole === 'hod' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    رئيس القسم
                  </button>
                </div>
              )}
            </div>

            {/* قائمة جهات الاتصال */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {isSupervisionMode ? (
                <div className="p-3 space-y-2">
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] font-medium leading-relaxed">
                    👁️ <b>وضع الرقابة الإشرافية:</b> تظهر هنا جميع المحادثات المسجلة بالمدرسة لضمان السلامة والالتزام المهني.
                  </div>
                  {supervisedConversations.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs font-bold">
                      لا توجد محادثات مسجلة بالمدرسة بعد
                    </div>
                  ) : (
                    supervisedConversations.map((conv) => {
                      const p1 = allUsers.find(u => u.id === conv.participant_one_id);
                      const p2 = allUsers.find(u => u.id === conv.participant_two_id);
                      const isSelected = activeConversation?.id === conv.id;

                      return (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => handleSelectSupervisedConv(conv)}
                          className={`w-full p-3 rounded-2xl text-right transition border flex flex-col gap-1 cursor-pointer ${
                            isSelected 
                              ? 'bg-amber-100 border-amber-300 shadow-xs' 
                              : 'bg-white border-slate-200/70 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-700">
                              {conv.type}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(conv.updated_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="text-xs font-black text-slate-800">
                            {p1?.name || 'مستخدم'} ↔ {p2?.name || 'مستخدم'}
                          </div>
                          {conv.student_context_id && (
                            <span className="text-[10px] text-emerald-700 font-semibold">
                              متابعة: {allUsers.find(u => u.id === conv.student_context_id)?.name || 'طالب'}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-12 px-4 text-slate-400">
                  <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600 mb-1">لا توجد جهات اتصال مطابقة</p>
                  <p className="text-[11px] text-slate-400">
                    {currentUser.role === 'student' 
                      ? 'يسمح لك فقط بالتواصل مع معلمي صفوفك المعتمدين.'
                      : 'وفق مصفوفة الحوكمة، يسمح فقط بالتواصل المعتمد نظامياً.'}
                  </p>
                </div>
              ) : (
                filteredContacts.map((contact) => {
                  const isSelected = activeContact?.user.id === contact.user.id && !isSupervisionMode;
                  
                  // شارة الدور
                  const roleBadge = 
                    contact.user.role === 'teacher' ? { label: 'معلم', color: 'bg-blue-100 text-blue-800' } :
                    contact.user.role === 'student' ? { label: 'طالب', color: 'bg-emerald-100 text-emerald-800' } :
                    contact.user.role === 'parent' ? { label: 'ولي أمر', color: 'bg-purple-100 text-purple-800' } :
                    contact.user.role === 'hod' ? { label: 'رئيس قسم', color: 'bg-amber-100 text-amber-900' } :
                    { label: 'إدارة', color: 'bg-slate-100 text-slate-800' };

                  return (
                    <button
                      key={`${contact.user.id}_${contact.conversationType}_${contact.studentContext?.id || ''}`}
                      type="button"
                      onClick={() => handleSelectContact(contact)}
                      className={`w-full p-3 text-right transition flex items-start gap-3 cursor-pointer ${
                        isSelected 
                          ? 'bg-emerald-50/90 border-r-4 border-emerald-600' 
                          : 'hover:bg-slate-100/70 bg-white'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-100 flex items-center justify-center font-black text-sm text-slate-700 flex-shrink-0 border border-slate-200 shadow-2xs">
                        {contact.user.avatar ? (
                          <img src={contact.user.avatar} alt="" className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          contact.user.name.charAt(0)
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="font-extrabold text-xs text-slate-800 truncate">
                            {contact.user.name}
                          </h4>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${roleBadge.color}`}>
                            {roleBadge.label}
                          </span>
                        </div>

                        {contact.studentContext && (
                          <div className="text-[10px] text-emerald-800 font-semibold truncate flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-emerald-600" />
                            <span>متابعة الطالب: <b>{contact.studentContext.name}</b></span>
                          </div>
                        )}

                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          انقر لبدء المراسلة الفورية
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* بطاقة الحوكمة السفلية */}
            <div className="p-2.5 bg-slate-100/80 border-t border-slate-200 text-[10px] text-slate-500 font-medium flex items-center gap-2 flex-shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>قنوات اتصال آمنة ومراقبة تربوياً وفق لوائح المدرسة.</span>
            </div>
          </div>

          {/* 2. منطقة الدردشة واستعراض الرسائل (Chat Area) */}
          <div className={`
            ${!activeContact && !isSupervisionMode ? 'hidden md:flex' : 'flex'}
            flex-1 flex-col bg-slate-100/40 justify-between h-full min-w-0
          `}>
            {activeContact || activeConversation ? (
              <>
                {/* شريط رأس المحادثة الحالية مع زر العودة للشاشات الصغيرة */}
                <div className="bg-white border-b border-slate-200 px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between shadow-2xs flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    {/* زر الرجوع لقائمة المحادثات للشاشات الصغيرة */}
                    <button
                      type="button"
                      onClick={() => setActiveContact(null)}
                      className="md:hidden p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      title="الرجوع لجهات الاتصال"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span className="text-[11px]">جهات الاتصال</span>
                    </button>

                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center font-black text-sm flex-shrink-0">
                      {activeContact?.user.avatar ? (
                        <img src={activeContact.user.avatar} alt="" className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        activeContact?.user.name.charAt(0) || '💬'
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 truncate">
                          {activeContact?.user.name || 'محادثة مسجلة'}
                        </h3>
                        <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          متصل
                        </span>
                      </div>
                      {activeContact?.studentContext && (
                        <p className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold truncate">
                          سياق الطالب: {activeContact.studentContext.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 hidden sm:flex">
                    <Clock className="w-3.5 h-3.5" />
                    <span>مزامنة لحظية ⚡</span>
                  </div>
                </div>

                {/* قائمة الرسائل */}
                <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-2.5">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                      <span className="text-xs font-bold">جاري تحميل الرسائل...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                      <div className="text-4xl mb-2">💬</div>
                      <h4 className="font-black text-sm text-slate-700 mb-1">بداية المحادثة الآمنة</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                        أهلاً بك! يمكنك الآن تبادل الرسائل التعليمية والمتابعة المباشرة بكل سهولة وسرعة.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === currentUser.id;
                      const senderUser = allUsers.find(u => u.id === msg.sender_id);
                      const timeStr = new Date(msg.created_at).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
                        >
                          <div className="flex items-end gap-1.5 max-w-[88%] sm:max-w-[70%]">
                            {!isMe && (
                              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center flex-shrink-0 mb-1">
                                {senderUser?.name.charAt(0) || '💬'}
                              </div>
                            )}

                            <div
                              className={`rounded-2xl px-3.5 py-2 text-xs shadow-xs leading-relaxed whitespace-pre-wrap ${
                                isMe 
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-xs' 
                                  : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                              }`}
                            >
                              {!isMe && (
                                <span className="block text-[10px] font-black text-emerald-700 mb-0.5">
                                  {senderUser?.name || 'المرسل'}
                                </span>
                              )}
                              <p className="font-medium text-xs sm:text-[13px]">{msg.content}</p>

                              <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                                isMe ? 'text-emerald-100' : 'text-slate-400'
                              }`}>
                                <span>{timeStr}</span>
                                {isMe && (
                                  msg.read_at ? (
                                    <span title="تمت القراءة"><CheckCheck className="w-3 h-3 text-cyan-200" /></span>
                                  ) : (
                                    <span title="تم الإرسال"><Check className="w-3 h-3 text-emerald-200" /></span>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* العبارات السريعة المقترحة */}
                {!isSupervisionMode && (
                  <div className="px-3 sm:px-4 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto flex-shrink-0">
                    <span className="text-[10px] font-black text-slate-400 whitespace-nowrap flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" /> مقترحات:
                    </span>
                    {quickReplies.map((reply, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setInputText(reply)}
                        className="px-2.5 py-1 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 rounded-lg text-[10px] font-semibold border border-slate-200/70 whitespace-nowrap transition cursor-pointer"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}

                {/* حقل كتابة الرسالة وزر الإرسال */}
                {!isSupervisionMode ? (
                  <form onSubmit={handleSendMessage} className="p-2.5 sm:p-3 bg-white border-t border-slate-200 flex items-center gap-2 flex-shrink-0">
                    <input
                      type="text"
                      placeholder="اكتب رسالتك التعليمية هنا... (اضغط Enter للإرسال)"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="flex-1 py-2 sm:py-2.5 px-3.5 sm:px-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none focus:bg-white transition"
                    />

                    <button
                      type="submit"
                      disabled={!inputText.trim() || isSending}
                      className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-2xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-98 flex-shrink-0"
                    >
                      <span>إرسال</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="p-3 bg-amber-50 border-t border-amber-200 text-center text-xs font-bold text-amber-900 flex-shrink-0">
                    🔒 وضع المعاينة الإشرافية - لا يمكن إرسال رسائل من خلال وضع الرقابة
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mb-3 shadow-inner">
                  💬
                </div>
                <h3 className="font-black text-base text-slate-800 mb-1">
                  اختر جهة اتصال لبدء المحادثة
                </h3>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-4">
                  اختر أحد المعلمين أو الطلاب أو أولياء الأمور المعتمدين من القائمة الجانبية للتواصل والمتابعة المباشرة.
                </p>
                <div className="p-3 bg-white rounded-2xl border border-slate-200 text-[11px] text-slate-600 text-right max-w-md space-y-1">
                  <b className="text-emerald-800 block mb-1">قواعد المحادثة المدرسية:</b>
                  <p>• الطالب يتواصل حصراً مع معلمي صفوفه المعتمدين.</p>
                  <p>• ولي الأمر يتواصل مع معلمي ابنه ورئيس القسم.</p>
                  <p>• يُمنع التواصل المباشر بين الطلاب حفاظاً على البيئة التربوية الآمنة.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
