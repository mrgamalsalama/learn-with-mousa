import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

/**
 * PATCH /api/super-admin/schools/[id]
 * تعديل حالة المدرسة (Active / Suspended / Expired)، تمديد الاشتراك، أو تبديل الذكاء الاصطناعي
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const schoolId = params.id;
    if (!schoolId) {
      return NextResponse.json({ error: 'معرّف المدرسة مطلوب' }, { status: 400 });
    }

    const body = await request.json();
    const updatePayload: Record<string, any> = {};

    if (body.status && ['active', 'suspended', 'expired'].includes(body.status)) {
      updatePayload.status = body.status;
    }

    if (typeof body.ai_enabled === 'boolean') {
      updatePayload.ai_enabled = body.ai_enabled;
    }

    if (body.subscription_end_date) {
      updatePayload.subscription_end_date = body.subscription_end_date;
    }

    if (body.plan_tier && ['trial', 'annual'].includes(body.plan_tier)) {
      updatePayload.plan_tier = body.plan_tier;
    }

    if (body.max_students) {
      updatePayload.max_students = Number(body.max_students);
    }

    // تمديد الاشتراك بالأيام (convenience helper)
    if (body.extendDays && Number(body.extendDays) > 0) {
      const { data: currentSchool } = await supabaseAdmin
        .from('schools')
        .select('subscription_end_date')
        .eq('id', schoolId)
        .single();

      const currentEnd = currentSchool?.subscription_end_date 
        ? new Date(currentSchool.subscription_end_date).getTime() 
        : Date.now();
      const baseTime = Math.max(currentEnd, Date.now());
      updatePayload.subscription_end_date = new Date(baseTime + Number(body.extendDays) * 86400000).toISOString();
      if (updatePayload.status === 'expired' || !updatePayload.status) {
        updatePayload.status = 'active';
      }
    }

    const { data: updatedSchool, error } = await supabaseAdmin
      .from('schools')
      .update(updatePayload)
      .eq('id', schoolId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      school: updatedSchool,
      message: 'تم تحديث بيانات المدرسة بنجاح'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل تحديث المدرسة' }, { status: 500 });
  }
}
