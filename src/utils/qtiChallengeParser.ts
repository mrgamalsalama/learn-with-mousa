import JSZip from 'jszip';
import { ChallengeQuestion, ChallengeQuestionType, ChallengeOption } from '../types';

/**
 * معالج استيراد حزم وملفات QTI (IMS QTI 1.2 / 2.1) خصيصاً لمسابقة تحدي موسى
 * يدعم كلاً من حزم ZIP ومستندات XML المباشرة
 */
export async function parseQTIForChallenge(file: File): Promise<{
  questions: ChallengeQuestion[];
  quizTitle: string;
}> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.zip')) {
    return await parseQTIZipForChallenge(file);
  } else if (fileName.endsWith('.xml') || fileName.endsWith('.qti')) {
    const text = await file.text();
    return parseQTIXmlForChallenge(text, file.name.replace(/\.[^/.]+$/, ''));
  } else {
    throw new Error('صيغة الملف غير مدعومة. يرجى اختيار ملف QTI بصيغة (.zip) أو (.xml)');
  }
}

async function parseQTIZipForChallenge(file: File): Promise<{
  questions: ChallengeQuestion[];
  quizTitle: string;
}> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const xmlFiles: { name: string; content: string }[] = [];
  let quizTitle = file.name.replace(/\.zip$/i, '');

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

  // قراءة المانيفست imsmanifest.xml إن وجد
  const manifest = xmlFiles.find(f => f.name.toLowerCase().includes('imsmanifest.xml'));
  if (manifest) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(manifest.content, 'application/xml');
      const titleElem = doc.querySelector('metadata > title, manifest > metadata > title, title');
      if (titleElem && titleElem.textContent?.trim()) {
        quizTitle = titleElem.textContent.trim();
      }
    } catch {}
  }

  const allQuestions: ChallengeQuestion[] = [];

  for (const xmlFile of xmlFiles) {
    if (xmlFile.name.toLowerCase().includes('imsmanifest.xml')) continue;
    try {
      const parsed = parseQTIXmlForChallenge(xmlFile.content, xmlFile.name);
      if (parsed.questions.length > 0) {
        allQuestions.push(...parsed.questions);
      }
    } catch (e) {
      console.warn(`تخطي ملف غير صالح: ${xmlFile.name}`, e);
    }
  }

  if (allQuestions.length === 0) {
    throw new Error('تعذر العثور على أي أسئلة قياسية صالحة داخل حزمة QTI المرفوعة.');
  }

  return {
    questions: allQuestions,
    quizTitle: quizTitle || 'تحدي موسى المستورد'
  };
}

export function parseQTIXmlForChallenge(xmlString: string, defaultTitle: string = 'تحدي موسى المستورد'): {
  questions: ChallengeQuestion[];
  quizTitle: string;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`خطأ في قراءة ملف XML: ${parseError.textContent?.slice(0, 150)}`);
  }

  let quizTitle = defaultTitle;
  const assessmentElem = doc.querySelector('assessment, assessmentItem, qti-assessment-test');
  if (assessmentElem?.getAttribute('title')) {
    quizTitle = assessmentElem.getAttribute('title')!;
  }

  let itemNodes = Array.from(doc.querySelectorAll('assessmentItem, item, question, qti-assessment-item'));
  if (itemNodes.length === 0 && doc.documentElement.nodeName.toLowerCase().includes('item')) {
    itemNodes = [doc.documentElement];
  }

  const questions: ChallengeQuestion[] = [];

  itemNodes.forEach((node, index) => {
    try {
      const q = parseSingleChallengeItem(node, index);
      if (q) questions.push(q);
    } catch (e) {
      console.warn(`فشل قراءة السؤال رقم ${index + 1}:`, e);
    }
  });

  return {
    questions,
    quizTitle
  };
}

function parseSingleChallengeItem(node: Element, index: number): ChallengeQuestion | null {
  const itemId = node.getAttribute('identifier') || node.getAttribute('id') || `qti_ch_${Date.now()}_${index + 1}`;

  // 1. نص السؤال
  let questionText = '';
  const promptElem = node.querySelector('prompt, itemBody > p, itemBody, material > mattext, mattext, question_text, text');
  if (promptElem) {
    questionText = promptElem.textContent?.trim() || '';
  }
  if (!questionText) {
    const titleAttr = node.getAttribute('title');
    if (titleAttr) questionText = titleAttr.trim();
  }
  if (!questionText) {
    questionText = `سؤال التحدي رقم ${index + 1}`;
  }

  // 2. زمن السؤال (Time limit)
  let timeLimitSeconds = 20;
  const timeElem = node.querySelector('duration, timelimit, time_limit');
  if (timeElem && timeElem.textContent) {
    const parsedTime = parseInt(timeElem.textContent.trim(), 10);
    if (!isNaN(parsedTime) && parsedTime > 0) {
      timeLimitSeconds = Math.min(60, Math.max(10, parsedTime));
    }
  }

  // 3. الإجابة النموذجية
  let rawCorrect = '';
  const correctValElem = node.querySelector('correctResponse > value, response_label[correct="true"], answer, correct_answer');
  if (correctValElem) {
    rawCorrect = correctValElem.textContent?.trim() || '';
  }

  // 4. خيارات الإجابة إن وجدت
  const choiceNodes = Array.from(node.querySelectorAll('simpleChoice, response_label, choice, option, simpleAssociableChoice'));
  const rawOptions: { id: string; text: string }[] = [];
  choiceNodes.forEach(cNode => {
    const cId = cNode.getAttribute('identifier') || cNode.getAttribute('id') || '';
    const cText = cNode.textContent?.trim() || '';
    if (cText) {
      rawOptions.push({ id: cId, text: cText });
    }
  });

  // 5. فحص نمط السؤال
  let questionType: ChallengeQuestionType = 'classic';
  let correctIndex = 0;
  let options: ChallengeOption[] = [];
  let correctAnswerText = rawCorrect;

  const defaultShapes: ('triangle' | 'diamond' | 'circle' | 'square')[] = ['triangle', 'diamond', 'circle', 'square'];

  // فحص نمط صح أو خطأ
  const isTF = rawOptions.length === 2 && isTrueFalseOptions(rawOptions.map(o => o.text));
  const isOrdering = node.querySelector('orderInteraction, sequenceInteraction') !== null;

  if (isOrdering && rawOptions.length >= 2) {
    questionType = 'puzzle';
    options = rawOptions.slice(0, 4).map((opt, idx) => ({
      id: String(idx),
      text: opt.text,
      shape: defaultShapes[idx] || 'triangle'
    }));
  } else if (isTF) {
    questionType = 'true_false';
    const trueOptionIdx = rawOptions.findIndex(o => isTrueText(o.text));
    const falseOptionIdx = rawOptions.findIndex(o => isFalseText(o.text));
    
    // توحيد الخيارات إلى صواب وخطأ
    options = [
      { id: '0', text: 'صَحِيحٌ (صَوَابٌ) ✅', shape: 'diamond' },
      { id: '1', text: 'خَاطِئٌ (خَطَأٌ) ❌', shape: 'triangle' }
    ];

    if (rawCorrect) {
      if (rawCorrect === rawOptions[trueOptionIdx]?.id || isTrueText(rawCorrect)) {
        correctIndex = 0;
      } else {
        correctIndex = 1;
      }
    }
  } else if (rawOptions.length === 0) {
    // سؤال كتابة أو إملاء قصير
    questionType = 'type_answer';
    correctAnswerText = rawCorrect || questionText;
    options = [];
  } else {
    // اختيار من متعدد كلاسيكي
    questionType = 'classic';
    const validChoices = rawOptions.slice(0, 4);
    while (validChoices.length < 4) {
      validChoices.push({ id: String(validChoices.length), text: `خيار ${validChoices.length + 1}` });
    }

    // تحديد correctIndex
    const matchIdx = validChoices.findIndex(c => c.id === rawCorrect || c.text === rawCorrect);
    correctIndex = matchIdx >= 0 ? matchIdx : 0;

    options = validChoices.map((c, idx) => ({
      id: String(idx),
      text: c.text,
      shape: defaultShapes[idx] || 'triangle'
    }));
  }

  return {
    id: itemId,
    text: questionText,
    type: questionType,
    options,
    correctIndex,
    correctAnswerText: questionType === 'type_answer' ? correctAnswerText : undefined,
    acceptableAnswers: questionType === 'type_answer' ? [correctAnswerText].filter(Boolean) : undefined,
    timeLimitSeconds,
    explanation: 'سؤال مستورد عبر حزمة QTI القياسية'
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

function isTrueText(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('صحيح') || t.includes('صواب') || t.includes('نعم') || t.includes('true');
}

function isFalseText(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('خطأ') || t.includes('خاطئ') || t.includes('لا') || t.includes('false');
}
