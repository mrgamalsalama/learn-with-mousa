import JSZip from 'jszip';
import { ExamQuestion, ExamQuestionType } from '../types';

/**
 * معالج فك واستيراد حزم وملفات التقييم المعيارية QTI (IMS Question and Test Interoperability)
 * يدعم كلاً من حزم ZIP المضغوطة وملفات XML المباشرة.
 */
export async function parseQTIFile(file: File): Promise<{
  questions: ExamQuestion[];
  assessmentTitle?: string;
  totalPoints: number;
}> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.zip')) {
    return await parseQTIZip(file);
  } else if (fileName.endsWith('.xml') || fileName.endsWith('.qti')) {
    const text = await file.text();
    return parseQTIXml(text, file.name.replace(/\.[^/.]+$/, ''));
  } else {
    throw new Error('صيغة الملف غير مدعومة. يرجى اختيار ملف QTI بصيغة .zip أو .xml');
  }
}

/**
 * فك حزمة ZIP واستخراج ملفات أسئلة QTI XML منها
 */
async function parseQTIZip(file: File): Promise<{
  questions: ExamQuestion[];
  assessmentTitle?: string;
  totalPoints: number;
}> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const xmlFiles: { name: string; content: string }[] = [];
  let assessmentTitle = file.name.replace(/\.zip$/i, '');

  // البحث عن ملفات XML داخل الحزمة
  const fileEntries = Object.keys(loadedZip.files);
  for (const relativePath of fileEntries) {
    const entry = loadedZip.files[relativePath];
    if (!entry.dir && (relativePath.toLowerCase().endsWith('.xml') || relativePath.toLowerCase().endsWith('.qti'))) {
      const content = await entry.async('string');
      xmlFiles.push({ name: relativePath, content });
    }
  }

  if (xmlFiles.length === 0) {
    throw new Error('لم يتم العثور على أي ملفات XML للأسئلة داخل حزمة ZIP المرفوعة.');
  }

  // محاولة قراءة المانيفست imsmanifest.xml لمعرفة العنوان إن وُجد
  const manifestFile = xmlFiles.find(f => f.name.toLowerCase().includes('imsmanifest.xml'));
  if (manifestFile) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(manifestFile.content, 'application/xml');
      const titleElem = doc.querySelector('metadata > title, manifest > metadata, title');
      if (titleElem && titleElem.textContent?.trim()) {
        assessmentTitle = titleElem.textContent.trim();
      }
    } catch {}
  }

  const allQuestions: ExamQuestion[] = [];

  for (const xmlFile of xmlFiles) {
    // تخطي ملف المانيفست العام
    if (xmlFile.name.toLowerCase().includes('imsmanifest.xml')) continue;

    try {
      const parsed = parseQTIXml(xmlFile.content, xmlFile.name);
      if (parsed.questions.length > 0) {
        allQuestions.push(...parsed.questions);
      }
    } catch (e) {
      console.warn(`تخطي ملف غير صالح: ${xmlFile.name}`, e);
    }
  }

  if (allQuestions.length === 0) {
    throw new Error('تعذر العثور على عناصر أسئلة صالحة داخل ملفات الحزمة المرفوعة.');
  }

  const totalPoints = allQuestions.reduce((sum, q) => sum + (q.points || 5), 0);
  return {
    questions: allQuestions,
    assessmentTitle,
    totalPoints,
  };
}

/**
 * تحليل شجرة XML لمواصفة QTI (الإصدار 1.2 أو 2.0 أو 2.1 أو 2.2)
 */
export function parseQTIXml(xmlString: string, defaultTitle: string = 'اختبار QTI'): {
  questions: ExamQuestion[];
  assessmentTitle: string;
  totalPoints: number;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  // فحص أخطاء التحليل النحوي لـ XML
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`خطأ في قراءة ملف XML: ${parseError.textContent?.slice(0, 150)}`);
  }

  let assessmentTitle = defaultTitle;
  const assessmentElem = doc.querySelector('assessment, assessmentItem, qti-assessment-test');
  if (assessmentElem?.getAttribute('title')) {
    assessmentTitle = assessmentElem.getAttribute('title')!;
  }

  // البحث عن عناصر الأسئلة سواء كانت assessmentItem أو item أو question
  let itemNodes = Array.from(doc.querySelectorAll('assessmentItem, item, question, qti-assessment-item'));

  // إذا لم نجد عناصر مجمعة وكان الجذر نفسه عبارة عن assessmentItem
  if (itemNodes.length === 0 && (doc.documentElement.nodeName.toLowerCase().includes('item'))) {
    itemNodes = [doc.documentElement];
  }

  const questions: ExamQuestion[] = [];

  itemNodes.forEach((node, index) => {
    try {
      const q = parseSingleItem(node, index);
      if (q) questions.push(q);
    } catch (e) {
      console.warn(`فشل قراءة السؤال رقم ${index + 1}:`, e);
    }
  });

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 5), 0);

  return {
    questions,
    assessmentTitle,
    totalPoints,
  };
}

function parseSingleItem(node: Element, index: number): ExamQuestion | null {
  const itemId = node.getAttribute('identifier') || node.getAttribute('id') || `qti_${Date.now()}_${index + 1}`;
  
  // 1. استخراج نص السؤال (Prompt)
  let questionText = '';
  const promptElem = node.querySelector('prompt, itemBody > p, itemBody, material > mattext, mattext, question_text, text');
  if (promptElem) {
    // تنظيف أي وسوم HTML داخلية مع إبقاء النص
    questionText = promptElem.textContent?.trim() || '';
  }

  if (!questionText) {
    const titleAttr = node.getAttribute('title');
    if (titleAttr) questionText = titleAttr.trim();
  }

  if (!questionText) {
    questionText = `السؤال رقم ${index + 1}`;
  }

  // 2. البحث عن الدرجة (Points / Score)
  let points = 5;
  const maxScoreElem = node.querySelector('outcomeDeclaration[identifier="SCORE"] > defaultValue > value, setvar, points, score');
  if (maxScoreElem && maxScoreElem.textContent) {
    const parsedPts = parseFloat(maxScoreElem.textContent.trim());
    if (!isNaN(parsedPts) && parsedPts > 0) points = parsedPts;
  }

  // 3. البحث عن الإجابة الصحيحة (Correct Answer)
  let correctAnswer = '';
  const correctValElem = node.querySelector('correctResponse > value, response_label[correct="true"], answer, correct_answer');
  if (correctValElem) {
    correctAnswer = correctValElem.textContent?.trim() || '';
  }

  // 4. استخراج الخيارات ونوع السؤال
  const choiceNodes = Array.from(node.querySelectorAll('simpleChoice, response_label, choice, option, simpleAssociableChoice'));
  const options: string[] = [];
  let foundCorrectIdentifier = correctAnswer;

  if (choiceNodes.length > 0) {
    choiceNodes.forEach(cNode => {
      const cId = cNode.getAttribute('identifier') || cNode.getAttribute('id') || '';
      const cText = cNode.textContent?.trim() || '';
      if (cText) {
        options.push(cText);
        // إذا كانت الإجابة النموذجية معرف identifier يطابق هذا الخيار
        if (foundCorrectIdentifier && (foundCorrectIdentifier === cId)) {
          correctAnswer = cText;
        }
      }
    });
  }

  // تحديد نوع السؤال
  let type: ExamQuestionType = 'multiple_choice';

  if (options.length === 2 && isTrueFalseOptions(options)) {
    type = 'true_false';
  } else if (options.length === 0) {
    // سؤال كتابة أو إملاء
    type = 'spelling_dictation';
  } else {
    type = 'multiple_choice';
  }

  // إذا لم يتم تحديد الإجابة الصحيحة بوضوح، نضع الخيار الأول كقيمة افتراضية
  if (!correctAnswer && options.length > 0) {
    correctAnswer = options[0];
  }

  return {
    id: itemId,
    text: questionText,
    type,
    options: options.length > 0 ? options : undefined,
    correctAnswer: correctAnswer || 'صحيح',
    points,
    explanation: 'سؤال مستورد عبر معيار QTI الدولي',
  };
}

function isTrueFalseOptions(options: string[]): boolean {
  const joined = options.join(' ').toLowerCase();
  return (
    (joined.includes('صحيح') && joined.includes('خطأ')) ||
    (joined.includes('نعم') && joined.includes('لا')) ||
    (joined.includes('true') && joined.includes('false')) ||
    (joined.includes('صواب') && joined.includes('خطأ'))
  );
}
