-- =========================================================================
-- نظام المراسلة والمحادثة السريعة والآمنة (Real-Time Educational Chat Hub)
-- منصة تعلّم مع موسى | Database Schema & Row Level Security (RLS)
-- =========================================================================

-- تفعيل ملحق UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. جدول المحادثات (Conversations)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('teacher_student', 'teacher_parent', 'hod_teacher', 'hod_parent')),
    participant_one_id TEXT NOT NULL,
    participant_two_id TEXT NOT NULL,
    student_context_id TEXT, -- معرف الطالب في حال كانت المحادثة بين المعلم وولي الأمر لمتابعة طالب بعينه
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهارس تسريع الاستعلام للمحادثات
CREATE INDEX IF NOT EXISTS idx_conversations_school_id ON public.conversations(school_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(participant_one_id, participant_two_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- 2. جدول الرسائل (Messages)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    school_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- فهارس تسريع الاستعلام للرسائل
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_school_id ON public.messages(school_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);

-- 3. تفعيل Realtime على الجدولين في Supabase
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- 4. تفعيل سياسات الأمان على مستوى الصفوف (Row Level Security - RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- سياسة الوصول لجدول المحادثات (Conversations Policy):
-- تتيح لأطراف المحادثة المباشرين الاطلاع والتعديل، بالإضافة للمشرف (HOD) ومدير المدرسة للاطلاع الرقابي داخل مدرستهم
DROP POLICY IF EXISTS "Conversations access policy" ON public.conversations;
CREATE POLICY "Conversations access policy"
ON public.conversations
FOR ALL
USING (
  -- الطرف الأول أو الطرف الثاني في المحادثة
  auth.uid()::text = participant_one_id OR 
  auth.uid()::text = participant_two_id OR
  -- إتاحة الصلاحية للمشرف (hod) ومدير المدرسة للاطلاع الرقابي داخل مدرستهم
  EXISTS (
    SELECT 1 FROM public.users
    WHERE public.users.id = auth.uid()::text 
      AND public.users.school_id = public.conversations.school_id
      AND public.users.role IN ('hod', 'school_admin', 'super_admin', 'supervisor')
  )
);

-- سياسة الوصول لجدول الرسائل (Messages Policy):
-- تتيح لأطراف المحادثة قراءة الرسائل، وللمشرفين والمديرين الاطلاع الرقابي داخل نفس المدرسة
DROP POLICY IF EXISTS "Messages access policy" ON public.messages;
CREATE POLICY "Messages access policy"
ON public.messages
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE public.conversations.id = public.messages.conversation_id
      AND (
        auth.uid()::text = public.conversations.participant_one_id OR
        auth.uid()::text = public.conversations.participant_two_id OR
        EXISTS (
          SELECT 1 FROM public.users
          WHERE public.users.id = auth.uid()::text 
            AND public.users.school_id = public.messages.school_id
            AND public.users.role IN ('hod', 'school_admin', 'super_admin', 'supervisor')
        )
      )
  )
);

-- سياسة إرسال الرسائل (Messages Insert Policy):
-- تشترط أن يكون المرسل طرفاً معتمداً في المحادثة وأن يسجل هويته كمرسل
DROP POLICY IF EXISTS "Messages insert policy" ON public.messages;
CREATE POLICY "Messages insert policy"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid()::text = sender_id AND
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE public.conversations.id = public.messages.conversation_id
      AND (
        auth.uid()::text = public.conversations.participant_one_id OR
        auth.uid()::text = public.conversations.participant_two_id
      )
  )
);
