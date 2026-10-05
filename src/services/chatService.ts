import { supabase } from '../supabaseClient';
import { 
  UserProfile, 
  ChatConversation, 
  ChatMessage, 
  ChatContact, 
  ConversationType 
} from '../types';

const LOCAL_CONVERSATIONS_KEY = 'lwm_chat_conversations_v1';
const LOCAL_MESSAGES_KEY = 'lwm_chat_messages_v1';

// ===================== مولّد معرّف UUID موثوق متوافق مع Postgres =====================
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ===================== مساعد الصوت البسيط (Web Audio Chime) =====================
export function playChatChime(type: 'sent' | 'received') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'sent') {
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } else {
      osc.frequency.setValueAtTime(780, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(950, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    }
  } catch {
    // تجاهل أخطاء تشغيل الصوت إذا كان المتصفح مقيداً
  }
}

// ===================== دوال التخزين المحلي الاحتياطي (Fallback) =====================
function getLocalConversations(): ChatConversation[] {
  try {
    const raw = localStorage.getItem(LOCAL_CONVERSATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalConversations(list: ChatConversation[]) {
  try {
    localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Chat local storage full or error:', e);
  }
}

function getLocalMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalMessages(list: ChatMessage[]) {
  try {
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Chat messages local storage full or error:', e);
  }
}

// ===================== مصفوفة حوكمة قنوات الاتصال المسموحة (Communication Matrix) =====================
export function getPermittedContacts(
  currentUser: UserProfile, 
  allUsers: UserProfile[]
): ChatContact[] {
  const contacts: ChatContact[] = [];
  const schoolUsers = allUsers.filter(u => 
    u.id !== currentUser.id && 
    (!currentUser.school_id || !u.school_id || u.school_id === currentUser.school_id)
  );

  if (currentUser.role === 'student') {
    // 1. الطالب: معلمي فصوله فقط
    const myTeachers = schoolUsers.filter(u => {
      if (u.role !== 'teacher') return false;
      if (currentUser.teacherId && u.id === currentUser.teacherId) return true;
      if (currentUser.grade && u.allowedGrades?.includes(currentUser.grade)) return true;
      return false;
    });

    for (const teacher of myTeachers) {
      contacts.push({
        user: teacher,
        conversationType: 'teacher_student',
        studentContext: currentUser
      });
    }

  } else if (currentUser.role === 'parent') {
    // 2. ولي الأمر: معلمي ابنه ورئيس القسم
    const child = schoolUsers.find(u => u.id === currentUser.studentId && u.role === 'student') ||
      allUsers.find(u => u.id === currentUser.studentId && u.role === 'student');
    
    // المعلمون المرتبطون بالطالب
    const childTeachers = schoolUsers.filter(u => {
      if (u.role !== 'teacher') return false;
      if (child && child.teacherId && u.id === child.teacherId) return true;
      if (child && child.grade && u.allowedGrades?.includes(child.grade)) return true;
      return false;
    });

    for (const teacher of childTeachers) {
      contacts.push({
        user: teacher,
        conversationType: 'teacher_parent',
        studentContext: child
      });
    }

    // رؤساء الأقسام (HOD)
    const hods = schoolUsers.filter(u => u.role === 'hod');
    for (const hod of hods) {
      contacts.push({
        user: hod,
        conversationType: 'hod_parent',
        studentContext: child
      });
    }

  } else if (currentUser.role === 'teacher') {
    // 3. المعلم: طلابه، وأولياء أمور طلابه، ورئيس قسمه
    const teacherGrades = currentUser.allowedGrades || [];
    
    // طلاب المعلم
    const myStudents = schoolUsers.filter(u => 
      u.role === 'student' && 
      (u.teacherId === currentUser.id || (u.grade && teacherGrades.includes(u.grade)))
    );

    for (const student of myStudents) {
      contacts.push({
        user: student,
        conversationType: 'teacher_student',
        studentContext: student
      });
    }

    // أولياء أمور طلاب المعلم
    const myStudentIds = new Set(myStudents.map(s => s.id));
    const parents = schoolUsers.filter(u => 
      u.role === 'parent' && u.studentId && myStudentIds.has(u.studentId)
    );

    for (const parent of parents) {
      const relatedStudent = myStudents.find(s => s.id === parent.studentId);
      contacts.push({
        user: parent,
        conversationType: 'teacher_parent',
        studentContext: relatedStudent
      });
    }

    // رؤساء الأقسام
    const hods = schoolUsers.filter(u => u.role === 'hod');
    for (const hod of hods) {
      contacts.push({
        user: hod,
        conversationType: 'hod_teacher'
      });
    }

  } else if (currentUser.role === 'hod') {
    // 4. رئيس القسم: معلمي المادة، وأولياء الأمور
    const teachers = schoolUsers.filter(u => u.role === 'teacher');
    for (const teacher of teachers) {
      contacts.push({
        user: teacher,
        conversationType: 'hod_teacher'
      });
    }

    const parents = schoolUsers.filter(u => u.role === 'parent');
    for (const parent of parents) {
      const relatedStudent = schoolUsers.find(u => u.id === parent.studentId && u.role === 'student');
      contacts.push({
        user: parent,
        conversationType: 'hod_parent',
        studentContext: relatedStudent
      });
    }

  } else if (currentUser.role === 'school_admin' || currentUser.role === 'super_admin' || currentUser.role === 'supervisor') {
    // الإدارة والمشرفون: التواصل الإداري مع المعلمين ورؤساء الأقسام وأولياء الأمور
    const staff = schoolUsers.filter(u => u.role === 'teacher' || u.role === 'hod' || u.role === 'parent');
    for (const member of staff) {
      contacts.push({
        user: member,
        conversationType: member.role === 'parent' ? 'hod_parent' : 'hod_teacher'
      });
    }
  }

  return contacts;
}

// ===================== إنشاء أو استرجاع المحادثة (Get / Create Conversation) =====================
export async function getOrCreateConversation(params: {
  schoolId: string;
  type: ConversationType;
  currentUserId: string;
  targetUserId: string;
  studentContextId?: string | null;
}): Promise<ChatConversation> {
  const { schoolId, type, currentUserId, targetUserId, studentContextId } = params;

  // 1. محاولة البحث في Supabase السحابي أولاً
  try {
    const { data: cloudConvs, error: selectErr } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_one_id.eq.${currentUserId},participant_two_id.eq.${currentUserId}`);

    if (!selectErr && cloudConvs && cloudConvs.length > 0) {
      const match = cloudConvs.find((c: any) => {
        const isPair = 
          (c.participant_one_id === currentUserId && c.participant_two_id === targetUserId) ||
          (c.participant_one_id === targetUserId && c.participant_two_id === currentUserId);
        
        if (!isPair) return false;
        if (studentContextId) {
          return c.student_context_id === studentContextId;
        }
        return true;
      });

      if (match) {
        return match as ChatConversation;
      }
    }

    // لم يتم العثور على محادثة سابقة، ننشئ محادثة جديدة في Supabase بمعرّف UUID موثوق
    const newConvId = generateUUID();
    const newConvPayload = {
      id: newConvId,
      school_id: schoolId || 'default',
      type,
      participant_one_id: currentUserId,
      participant_two_id: targetUserId,
      student_context_id: studentContextId || null,
      updated_at: new Date().toISOString()
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('conversations')
      .insert(newConvPayload)
      .select()
      .single();

    if (!insertErr && inserted) {
      const local = getLocalConversations();
      saveLocalConversations([inserted as ChatConversation, ...local.filter(c => c.id !== inserted.id)]);
      return inserted as ChatConversation;
    } else if (insertErr) {
      console.warn('Supabase insert conversation warning:', insertErr.message || insertErr);
    }
  } catch (err) {
    console.warn('Supabase getOrCreateConversation error, using fallback:', err);
  }

  // 2. البديل المحلي في حال تعذر الاتصال بـ Supabase
  const localList = getLocalConversations();
  const existingLocal = localList.find(c => {
    const isPair = 
      (c.participant_one_id === currentUserId && c.participant_two_id === targetUserId) ||
      (c.participant_one_id === targetUserId && c.participant_two_id === currentUserId);
    if (!isPair) return false;
    if (studentContextId) return c.student_context_id === studentContextId;
    return true;
  });

  if (existingLocal) {
    return existingLocal;
  }

  // استخدام UUID صالح دائماً
  const generatedId = generateUUID();
  const newLocal: ChatConversation = {
    id: generatedId,
    school_id: schoolId || 'default',
    type,
    participant_one_id: currentUserId,
    participant_two_id: targetUserId,
    student_context_id: studentContextId || null,
    updated_at: new Date().toISOString()
  };

  saveLocalConversations([newLocal, ...localList]);
  return newLocal;
}

// ===================== جلب جميع محادثات المستخدم (Fetch User Conversations) =====================
export async function fetchUserConversations(
  currentUserId: string, 
  schoolId: string
): Promise<ChatConversation[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_one_id.eq.${currentUserId},participant_two_id.eq.${currentUserId}`)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      return data as ChatConversation[];
    }
  } catch (err) {
    console.warn('Supabase fetchUserConversations error, using local fallback:', err);
  }

  // Fallback
  return getLocalConversations().filter(c => 
    (!schoolId || c.school_id === schoolId) &&
    (c.participant_one_id === currentUserId || c.participant_two_id === currentUserId)
  );
}

// ===================== جلب محادثات المدرسة للمشرفين والمديرين (Supervisory Monitoring) =====================
export async function fetchSchoolConversationsForSupervision(
  schoolId: string
): Promise<ChatConversation[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      return data as ChatConversation[];
    }
  } catch (err) {
    console.warn('Supabase supervision fetch error, using local fallback:', err);
  }

  return getLocalConversations().filter(c => !schoolId || c.school_id === schoolId);
}

// ===================== جلب رسائل محادثة معينة (Fetch Messages) =====================
export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  if (!conversationId) return [];

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      return data as ChatMessage[];
    } else if (error) {
      console.warn('Supabase fetchMessages error:', error.message || error);
    }
  } catch (err) {
    console.warn('Supabase fetchMessages exception, using local fallback:', err);
  }

  return getLocalMessages().filter(m => m.conversation_id === conversationId);
}

// ===================== إرسال رسالة جديدة (Send Message) =====================
export async function sendMessage(params: {
  conversationId: string;
  schoolId: string;
  senderId: string;
  senderName?: string;
  senderRole?: string;
  content: string;
}): Promise<ChatMessage> {
  const { conversationId, schoolId, senderId, senderName, senderRole, content } = params;
  const nowIso = new Date().toISOString();
  const messageId = generateUUID();

  const payload: any = {
    id: messageId,
    conversation_id: conversationId,
    school_id: schoolId || 'default',
    sender_id: senderId,
    content: content.trim(),
    created_at: nowIso
  };

  if (senderName) payload.sender_name = senderName;
  if (senderRole) payload.sender_role = senderRole;

  // 1. المحاولة السحابية في Supabase
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      // تحديث توقيت المحادثة
      try {
        await supabase
          .from('conversations')
          .update({ 
            updated_at: nowIso,
            last_message: content.trim(),
            last_message_at: nowIso
          })
          .eq('id', conversationId);
      } catch (uErr) {
        // ignore
      }

      // حفظ نسخة محلية احتياطية
      const allLocal = getLocalMessages();
      saveLocalMessages([...allLocal, data as ChatMessage]);

      playChatChime('sent');
      return data as ChatMessage;
    } else if (error) {
      console.warn('Supabase sendMessage failed, falling back to local:', error.message || error);
    }
  } catch (err) {
    console.warn('Supabase sendMessage exception, using local fallback:', err);
  }

  // 2. البديل المحلي الفوري (يضمن ظهور الرسالة وإرسالها حتى بدون إنترنت أو لو تعذر السيرفر)
  const newMsg: ChatMessage = {
    id: messageId,
    conversation_id: conversationId,
    school_id: schoolId || 'default',
    sender_id: senderId,
    content: content.trim(),
    created_at: nowIso
  };

  const allLocal = getLocalMessages();
  saveLocalMessages([...allLocal, newMsg]);

  // تحديث وقت المحادثة محلياً
  const localConvs = getLocalConversations();
  const updatedConvs = localConvs.map(c => 
    c.id === conversationId 
      ? { ...c, updated_at: nowIso, last_message: content.trim(), last_message_at: nowIso } 
      : c
  );
  saveLocalConversations(updatedConvs);

  playChatChime('sent');
  return newMsg;
}

// ===================== تحديد الرسائل كمقروءة (Mark as Read) =====================
export async function markMessagesAsRead(conversationId: string, currentUserId: string): Promise<void> {
  if (!conversationId) return;
  const nowIso = new Date().toISOString();

  try {
    await supabase
      .from('messages')
      .update({ read_at: nowIso })
      .eq('conversation_id', conversationId)
      .neq('sender_id', currentUserId)
      .is('read_at', null);
  } catch (err) {
    // ignore
  }

  // تحديث محلي
  const localMsgs = getLocalMessages();
  const updated = localMsgs.map(m => {
    if (m.conversation_id === conversationId && m.sender_id !== currentUserId && !m.read_at) {
      return { ...m, read_at: nowIso };
    }
    return m;
  });
  saveLocalMessages(updated);
}

// ===================== حساب إجمالي الرسائل غير المقروءة للمستخدم =====================
export async function getUnreadMessagesCount(currentUserId: string, schoolId: string): Promise<number> {
  try {
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .or(`participant_one_id.eq.${currentUserId},participant_two_id.eq.${currentUserId}`);

    if (convs && convs.length > 0) {
      const convIds = convs.map(c => c.id);
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('sender_id', currentUserId)
        .is('read_at', null);

      if (typeof count === 'number') {
        return count;
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  // Fallback محلي
  const localConvs = getLocalConversations().filter(c => 
    (!schoolId || c.school_id === schoolId) &&
    (c.participant_one_id === currentUserId || c.participant_two_id === currentUserId)
  );
  const convIds = new Set(localConvs.map(c => c.id));
  const localMsgs = getLocalMessages();

  return localMsgs.filter(m => convIds.has(m.conversation_id) && m.sender_id !== currentUserId && !m.read_at).length;
}

// ===================== الاشتراك اللحظي عبر Supabase Realtime =====================
export function subscribeToConversationMessages(
  conversationId: string, 
  onNewMessage: (msg: ChatMessage) => void
): () => void {
  if (!conversationId) return () => {};
  const channelName = `chat_room_${conversationId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
  
  try {
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          if (payload.new) {
            onNewMessage(payload.new as ChatMessage);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn('Realtime removeChannel warning:', e);
      }
    };
  } catch (err) {
    console.warn('Supabase realtime subscription failed:', err);
    return () => {};
  }
}
