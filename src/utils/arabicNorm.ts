/**
 * أداة تسوية ومقارنة النصوص العربية المرنة
 * للتأكد من مطابقة إجابات الطلاب مع مراعاة:
 * - تنظيف التشكيل والحركات (الفتحة، الضمة، الكسرة، السكون، التنوين، الشدة)
 * - توحيد أشكال الهمزة (أ، إ، آ، ء) -> ا
 * - توحيد التاء المربوطة والهاء (ة -> ه)
 * - توحيد الياء والألف المقصورة (ى -> ي)
 * - تجاهل المسافات الزائدة وعلامات الترقيم
 */

export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    // إزالة التشكيل والتنوين والشدة
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // إزالة التطويل (الكشيدة)
    .replace(/\u0640/g, '')
    // توحيد الهمزات
    .replace(/[إأآ]/g, 'ا')
    .replace(/[ؤئ]/g, 'ء')
    // توحيد التاء المربوطة
    .replace(/ة/g, 'ه')
    // توحيد الياء والألف المقصورة
    .replace(/ى/g, 'ي')
    // توحيد المسافات المتعددة
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * مطابقة إجابة الطالب مع الإجابة النموذجية وقائمة الإجابات المقبولة
 */
export function checkArabicAnswerMatch(
  studentInput: string,
  canonicalAnswer: string,
  acceptableAnswers?: string[]
): boolean {
  const normStudent = normalizeArabicText(studentInput);
  if (!normStudent) return false;

  const normCanonical = normalizeArabicText(canonicalAnswer);
  if (normStudent === normCanonical) return true;

  if (Array.isArray(acceptableAnswers)) {
    for (const alt of acceptableAnswers) {
      if (normalizeArabicText(alt) === normStudent) {
        return true;
      }
    }
  }

  // مطابقة بدون أل التعريف إن أمكن كخيار إضافي مرن
  const withoutAl = (s: string) => s.startsWith('ال') ? s.slice(2) : s;
  if (withoutAl(normStudent) === withoutAl(normCanonical)) return true;

  return false;
}
