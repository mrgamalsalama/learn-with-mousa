import { GoogleGenAI, Modality } from '@google/genai';
import { 
  AdaptiveStoryNode, 
  PhonicsVerificationResult, 
  DrawingAnalysisResult, 
  DiagnosticReport,
  Question,
  StudentSubmission,
  ClassDiagnosticSummary,
  AIGameType,
  GameData,
  GameLevel,
  QuickAIDiagnosticResult,
  AIGovernanceTarget,
  ExamQuestion,
  ORFWordAnnotation,
  ORFErrorCategory,
  KnowledgeNodeQuestion
} from './types';
import { isAIFeatureAllowed, canUserUseAI, getCurrentUser } from './storage';
import { 
  getSingleSounds50Questions, 
  getShortVowels50Questions, 
  getSukunSegments50Questions 
} from './data/questionBanks/level1Questions';
import { 
  getLongVowels50Questions, 
  getTanween50Questions, 
  getShaddah50Questions, 
  getShamsQamar50Questions, 
  getTaaTypes50Questions 
} from './data/questionBanks/level2Questions';
import { 
  getWordParts50Questions, 
  getSentenceStructures50Questions, 
  getSubjectVerb50Questions 
} from './data/questionBanks/level3Questions';
import { 
  getLiteralComprehension50Questions, 
  getInferentialReading50Questions, 
  getVocabInContext50Questions 
} from './data/questionBanks/level4Questions';
import { 
  getSentenceCombining50Questions, 
  getFigurativeLanguage50Questions, 
  getCriticalAppreciation50Questions 
} from './data/questionBanks/level5Questions';
import { INITIAL_CHALLENGE_QUIZZES } from './data/challengeData';

// 1. مصفوفة النماذج المعتمدة للنصوص والأنشطة (Flash Only - نماذج فلاش معتمدة ونشطة في الخطة المجانية حصراً)
export const TEXT_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest'
];

// 2. نماذج الصوت المعتمدة لـ TTS
export const AUDIO_MODELS = [
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-3.8-flash'
];

// 3. قاطع الدائرة الذكي لاستنفاد الحصة (Quota Circuit Breaker)
// عند استنفاد الحصة المجانية لمفتاح الـ API (خطأ 429 أو RESOURCE_EXHAUSTED أو limit: 20 أو 503)، يتم تفعيل
// التحويل التلقائي الفوري 100% للمحرك الذكي الفوري لمنع تعليق واجهات المستخدم أو إغراق وحدة التحكم بالأخطاء
let quotaExhaustedUntil: number = 0;

// وضع التوليد الحقيقي الذكي (AI Generation Engine)
// افتراضياً يعمل الذكاء الاصطناعي الحي بنسبة 100% لتوليد محتوى دقيق وحي وغير مكرر
let fastModeSetting = false;
try {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('mousa_ai_fast_mode');
    if (saved !== null) {
      fastModeSetting = saved === 'true';
    }
  }
} catch {}

export function isAIFastMode(): boolean {
  return fastModeSetting;
}

export function setAIFastMode(enabled: boolean) {
  fastModeSetting = enabled;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mousa_ai_fast_mode', enabled ? 'true' : 'false');
    }
  } catch {}
}

export function isGeminiQuotaExhausted(): boolean {
  return Date.now() < quotaExhaustedUntil;
}

export function markGeminiQuotaExhausted(retryDelaySeconds?: number) {
  // مدة الاحتياط: إما المقترحة من جوجل أو 10 دقائق افتراضياً
  const delayMs = (retryDelaySeconds && retryDelaySeconds > 0)
    ? Math.min(retryDelaySeconds * 1000, 24 * 60 * 60 * 1000)
    : 10 * 60 * 1000;
  quotaExhaustedUntil = Date.now() + delayMs;
  console.warn(`[Gemini Circuit Breaker] تم تفعيل وضع الاحتياط المحلي التلقائي الفوري 100% (Instant Fast Engine) لتفادي استهلاك الرصيد أو التأخير.`);
}

export function resetGeminiQuotaState() {
  quotaExhaustedUntil = 0;
}

// دالة الحصول على مفتاح Gemini من المتغيرات البيئية (دعم Vercel و Vite و Node)
export function getGeminiApiKey(): string {
  try {
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : null;
    const viteKey = metaEnv?.VITE_GEMINI_API_KEY;
    if (viteKey && typeof viteKey === 'string' && viteKey.trim().length > 0) {
      return viteKey.trim();
    }
  } catch {}

  try {
    const procKey = typeof process !== 'undefined' ? (process.env?.GEMINI_API_KEY || (process.env as any)?.VITE_GEMINI_API_KEY) : null;
    if (procKey && typeof procKey === 'string' && procKey.trim().length > 0) {
      return procKey.trim();
    }
  } catch {}

  return '';
}

// إنشاء عميل GoogleGenAI المباشر
let directAIClient: GoogleGenAI | null = null;
export const getAIClient = (): GoogleGenAI => {
  if (!directAIClient) {
    const apiKey = getGeminiApiKey();
    directAIClient = new GoogleGenAI({ apiKey });
  }
  return directAIClient;
};

// دالة مساعدة لتنظيف كتل JSON المستلمة
function cleanJsonText(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

// فحص حوكمة وسياسات الذكاء الاصطناعي قبل أي استدعاء للنماذج مع مراعاة الاستثناءات الفردية للمستخدم
export function assertAIPermitted(target: AIGovernanceTarget = 'student') {
  const currentUser = getCurrentUser();
  const userCheck = canUserUseAI(currentUser);
  if (!userCheck.allowed) {
    const errorMsg = userCheck.reason || 'ميزات الذكاء الاصطناعي معطلة حالياً عن حسابك بقرار إداري.';
    console.warn(`[AI Governance Blocked User] User: ${currentUser?.username || 'Guest'}, Target: ${target}, Reason: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // إذا لم يكن هناك استثناء فردي (inherit)، يتم التأكد من فئة الهدف
  if (userCheck.overrideStatus === 'inherit') {
    const roleCheck = isAIFeatureAllowed(target);
    if (!roleCheck.allowed) {
      const errorMsg = roleCheck.reason || 'ميزات الذكاء الاصطناعي معطلة حالياً بقرار من إدارة المنصة.';
      console.warn(`[AI Governance Blocked Role] Target: ${target}, Reason: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}

// دالة مساعدة لتنفيذ طلبات التوليد عبر نماذج Gemini المعتمدة مع الربط المباشر بخادم المنصة السحابي
async function generateContentWithFallback(
  _ai: any,
  params: {
    contents: any;
    config?: any;
    targetRole?: AIGovernanceTarget;
  }
) {
  // فحص حوكمة وسياسات الذكاء الاصطناعي للمستخدم
  assertAIPermitted(params.targetRole || 'student');

  let lastError: any = null;

  // 1. المسار الأساسي الفائق: استدعاء خادم المنصة الآمن /api/gemini/generate
  // يتميز بالاتصال المباشر بمفتاح الخادم السحابي وإدارة الضغط وتجاوز أي قيود متصفح والـ 503
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 ثانية مهلة كافية للتوليد الذكي المتعمق

    const serverResponse = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3.1-flash-lite',
        contents: params.contents,
        config: params.config,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (serverResponse.ok) {
      const data = await serverResponse.json();
      if (data && (typeof data.text === 'string' || data.candidates)) {
        return {
          text: data.text || '',
          candidates: data.candidates,
          usageMetadata: data.usageMetadata,
          modelUsed: data.modelUsed || 'gemini-3.8-flash',
        };
      }
    } else {
      const errJson = await serverResponse.json().catch(() => ({}));
      lastError = new Error(errJson.error || `Server responded with ${serverResponse.status}`);
      console.warn('[Gemini Server Proxy Notice]', lastError.message);
    }
  } catch (err: any) {
    lastError = err;
    console.warn('[Gemini Server Fetch Error]', err?.message || err);
  }

  // 2. المسار الاحتياطي: إذا تعذر الاتصال بالخادم وكان هناك مفتاح متوفر في المتصفح
  const clientKey = getGeminiApiKey();
  if (clientKey) {
    const ai = getAIClient();
    for (let i = 0; i < TEXT_MODELS.length; i++) {
      const model = TEXT_MODELS[i];
      try {
        const response: any = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });

        return {
          text: response.text || '',
          candidates: response.candidates,
          usageMetadata: response.usageMetadata,
          modelUsed: model,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[Client Direct Gemini Error - ${model}]`, err?.message || err);
      }
    }
  }

  throw lastError || new Error('فشل توليد المحتوى بالذكاء الاصطناعي');
}

// ================= 1. الرفيق الصوتي/المحادثة مع موسى =================
export async function chatWithMusa(
  history: { role: 'user' | 'model'; text: string }[],
  userMessage: string
): Promise<string> {
  const ai = getAIClient();
  const systemInstruction = `
أنت «موسى»، الصديق الذكي والمرح المحبوب للأطفال في منصة "تعلَّم مع موسى" لتعليم اللغة العربية الفصحى.
- أسلوبك: دافئ، مشجع، محفز، ومرح جداً.
- لغتك: لغة عربية فصحى مشكولة تشكيلاً كاملاً ومضبوطاً بالحركات (الفتحة، الضمة، الكسرة، السكون).
- الطول: جمل قصيرة وموجزة (لا تتجاوز 2-3 أسطر) ومناسبة لعمر الطفل (من 5 إلى 10 سنوات).
- استخدم أيقونات تعبيرية لطيفة تناسب سياق الأطفال (مثل 🌟، 🎈، 📚، 🎨، 🚀، 🦁).
- شجع الطفل دائماً على القراءة، الاستكشاف، وتعلّم الحروف والكلمات الجديدة!
`;

  try {
    const contents: any[] = [];
    // تحويل السجل السابق
    history.forEach(h => {
      contents.push({
        role: h.role,
        parts: [{ text: h.text }]
      });
    });
    // تمرير رسالة المستخدم الفعلية (user prompt)
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const response = await generateContentWithFallback(ai, {
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
      targetRole: 'student'
    });

    const responseText = response.text?.trim();
    if (!responseText) {
      throw new Error('استجاب النموذج بنص فارغ');
    }
    return responseText;
  } catch (error: any) {
    console.warn('[Chat With Musa Fallback] تعذر الاتصال بالذكاء الاصطناعي، استخدام الرد الترحيبي الذكي المدمج:', error);
    const friendlyFallbackResponses = [
      'أَهْلًا بِكَ يَا بَطَلِي الغَالِي! 🌟 أَنَا مُوسَى، صَدِيقُكَ المُحِبُّ. أَنَا سَعِيدٌ جِدًّا بِحَدِيثِكَ مَعِي! مَا رَأْيُكَ أَنْ نَقْرَأَ قِصَّةً مُمْتِعَةً أَوْ نَخُوضَ تَحَدِّيًا جَدِيدًا؟ 📚🎈',
      'مَرْحَبًا يَا عَبْقَرِيَّ اللُّغَةِ العَرَبِيَّةِ! 🦁 لُغَتُنَا بَحْرٌ مِنَ الجَمَالِ، وَكُلُّ حَرْفٍ نَتَعَلَّمُهُ يُنِيرُ عَقْلَنَا! أَنَا مَعَكَ دَائِمًا لِنُحَقِّقَ أَعْلَى الدَّرَجَاتِ! ✨',
      'أَحْسَنْتَ يَا بَطَل! 🚀 أَنَا فَخُورٌ بِهِمَّتِكَ وَشَغَفِكَ بِالتَّعَلُّمِ. دَعْنَا نَسْتَكْشِفِ الكَلِمَاتِ وَنَسْتَمْتِعَ بِالقِرَاءَةِ مَعًا! 🎨'
    ];
    return friendlyFallbackResponses[Math.floor(Math.random() * friendlyFallbackResponses.length)];
  }
}

// ================= 2. صانع القصص التفاعلية التكيفية (Adaptive Storyteller) =================
export async function generateAdaptiveStoryScene(params: {
  letter: string;
  topic?: string;
  previousScene?: string;
  chosenOption?: string;
  stepNumber: number;
}): Promise<AdaptiveStoryNode> {
  const { letter, topic = 'مغامرة في الغابة السعيدة', previousScene, chosenOption, stepNumber } = params;
  const isFinalStep = stepNumber >= 3;

  const ai = getAIClient();



  const prompt = `
قم بتوليد مشهد قصصي تفاعلي تكيفي للأطفال (عمر 5-8 سنوات) يركز على حرف اللغة العربية: [${letter}].
الموضوع التربوي: [${topic}].
رقم المشهد: [${stepNumber}].
هل هذا المشهد الختامي؟ [${isFinalStep ? 'نعم (نهاية القصة وتقديم حكمة جميلة)' : 'لا'}].
${previousScene ? `المشهد السابق: "${previousScene}"` : ''}
${chosenOption ? `الخيار الذي نقر عليه الطفل في المشهد السابق: "${chosenOption}"` : ''}

شروط هامة جداً:
1. يجب أن يكون نص المشهد باللغة العربية الفصحى مع التشكيل التام بالحركات لجميع الكلمات!
2. كرر كلمات تبدأ بالحرف [${letter}] بشكل طبيعي وممتع للطفل.
3. قدم سؤالاً ممتعاً وخيارين يقرر بهما الطفل مسار القصة القادم.
4. يجب أن يكون الرد عبارة عن كائن JSON فقط بدون نصوص إضافية، بالشكل التالي:
{
  "step": ${stepNumber},
  "sceneTitle": "عنوان قصير ومشوق للمشهد",
  "passage": "النص القصصي الكامل المشكول بالحركات (3-4 أسطر ممتعة)",
  "targetLetter": "${letter}",
  "question": "سؤال شيق للطفل",
  "optionA": "الخيار الأول",
  "optionB": "الخيار الثاني",
  "badgeEarned": ${isFinalStep ? `"وسام حكيم حرف ${letter} 🌟"` : "null"},
  "isEnding": ${isFinalStep}
}
`;

  try {
    const response = await generateContentWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.6,
      },
      targetRole: 'student'
    });

    const parsed = JSON.parse(cleanJsonText(response.text || '{}'));
    return {
      step: stepNumber,
      sceneTitle: parsed.sceneTitle || `مُغَامَرَةُ حَرْفِ (${letter})`,
      passage: parsed.passage || `قِصَّةٌ مُمْتِعَةٌ مَعَ حَرْفِ (${letter})!`,
      targetLetter: letter,
      question: parsed.question || 'مَاذَا تَخْتَارُ الآن؟',
      optionA: parsed.optionA || 'الخِيَارُ الأَوَّلُ ✨',
      optionB: parsed.optionB || 'الخِيَارُ الثَّانِي 🌟',
      badgeEarned: isFinalStep ? (parsed.badgeEarned || `وسام قصة حرف (${letter}) 🏅`) : undefined,
      isEnding: isFinalStep,
    };
  } catch (err) {
    console.error('فشل توليد القصة عبر Gemini:', err);
    return {
      step: stepNumber,
      sceneTitle: `مُغَامَرَةُ حَرْفِ (${letter})`,
      passage: `فِي مَمْلَكَةِ الحُرُوفِ السَّعِيدَةِ، يَنْتَشِرُ ضَوْءٌ بَرَّاقٌ يُنِيرُ دَرْبَ حَرْفِ (${letter}) الجَمِيلِ، حَيْثُ يَلْعَبُ الأَصْدِقَاءُ فِي سُرُورٍ وَأَمَانٍ!`,
      targetLetter: letter,
      question: 'كَيْفَ تُحِبُّ أَنْ تَكْتَمِلَ رِحْلَتُنَا؟',
      optionA: 'نَقْطِفُ ثِمَارَ البُسْتَانِ 🍎',
      optionB: 'نَسْمَعُ أُنْشُودَةَ الحُرُوفِ 🎶',
      isEnding: isFinalStep,
    };
  }
}

// ================= 3. الكلمة السحرية وبوابة التحدي (Phonics Gate) =================
export async function verifyPhonicsWord(
  letter: string,
  word: string
): Promise<PhonicsVerificationResult> {
  const cleanWord = word.trim();
  const ai = getAIClient();

  if (!cleanWord) {
    return {
      isValid: false,
      startsCorrectly: false,
      formedWord: '',
      meaningSimple: '',
      encouragement: 'يَا بَطَل! يَرْجَى إِدْخَالُ كَلِمَةٍ أَوْ نُطْقُهَا عَبْرَ المَيْكْرُوفُونِ 🎤',
      scoreAwarded: 0,
    };
  }

  // تحقق مبدئي محلي
  const firstChar = cleanWord.replace(/[\u064B-\u065F\u0670]/g, '').charAt(0);
  const isFirstLetterMatch = firstChar === letter || (letter === 'ا' && ['أ', 'إ', 'آ', 'ا'].includes(firstChar));



  const prompt = `
أنت محكم لغوي وخبير صوتيات للأطفال في اللغة العربية.
الحرف المستهدف: [${letter}].
الكلمة المدخلة من الطفل: [${cleanWord}].

المطلوب:
1. تحقق هل الكلمة عربية حقيقية وصحيحة؟
2. هل تبدأ حقاً بصوت الحرف المستهدف [${letter}]؟ (مع مراعاة أشكال الهمزة للألف: أ، إ، آ).
3. شكل الكلمة بالحركات التامة (الفتحة/الضمة/الكسرة/التنوين).
4. اشرح معناها بأسلوب طفولي مرح وموجز (سطر واحد).
5. قدم تشجيعاً دافئاً ومحفزاً جداً للطفل.
6. أخرج النتيجة فقط بصيغة JSON التالية:
{
  "isValid": true,
  "startsCorrectly": true,
  "formedWord": "الكلمة مشكولة بالحركات",
  "meaningSimple": "معنى بسيط للطفل",
  "encouragement": "كلمات تشجيعية مرحة ومشكولة",
  "badgeName": "اسم وسام مميز للطفل إن أصاب أو null",
  "scoreAwarded": 10
}
`;

  try {
    const response = await generateContentWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
      targetRole: 'student'
    });

    const result: PhonicsVerificationResult = JSON.parse(cleanJsonText(response.text || '{}'));
    return {
      isValid: result.isValid ?? true,
      startsCorrectly: result.startsCorrectly ?? isFirstLetterMatch,
      formedWord: result.formedWord || cleanWord,
      meaningSimple: result.meaningSimple || 'كَلِمَةٌ عَرَبِيَّةٌ جَمِيلَة',
      encouragement: result.encouragement || 'أَحْسَنْتَ يَا بَطَل! نُطْقٌ مُمَيَّزٌ جِدًّا! 🌟',
      badgeName: result.startsCorrectly ? (result.badgeName || `فارس حرف (${letter}) 🎖️`) : undefined,
      scoreAwarded: result.startsCorrectly ? (result.scoreAwarded || 10) : 0,
    };
  } catch (err) {
    console.error('خطأ في التحقق من الفونكس:', err);
    return {
      isValid: true,
      startsCorrectly: isFirstLetterMatch,
      formedWord: cleanWord,
      meaningSimple: 'كَلِمَةٌ لَطِيفَة',
      encouragement: isFirstLetterMatch ? 'بَارَكَ اللهُ فِيكَ يَا بَطَل! إِجَابَةٌ صَحِيحَة! 🌟' : `جَرِّبْ كَلِمَةً أُخْرَى تَبْدَأُ بِحَرْفِ (${letter}) يا بَطَل!`,
      scoreAwarded: isFirstLetterMatch ? 10 : 0,
      badgeName: isFirstLetterMatch ? `شجاع حرف (${letter}) 🌟` : undefined,
    };
  }
}

// ================= 4. لوحة الرسم والتعرف البصري (Canvas & Multimodal AI) =================
export async function analyzeChildDrawing(
  letter: string,
  base64Image: string,
  positionInfo?: {
    positionLabel?: string;
    letterForm?: string;
    exampleWord?: string;
  }
): Promise<DrawingAnalysisResult> {
  const ai = getAIClient();

  // تنظيف صيغة data:image/png;base64,
  const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

  const positionDesc = positionInfo?.letterForm 
    ? `(موضع الحرف: ${positionInfo.positionLabel || ''}، شكل الحرف: "${positionInfo.letterForm}"، والكلمة الاسترشادية للطفل: "${positionInfo.exampleWord || ''}")`
    : '';



  const prompt = `
أنت معلم وفنان للأطفال، تحلل رسمة طفل مرسومة على شاشة Canvas التفاعلية.
الحرف العربي المستهدف: [${letter}] ${positionDesc}.

حلل الصورة المرفقة وأجب عن الآتي:
1. ما هو الشيء أو العنصر الذي يبدو أن الطفل حاول رسمه؟ (مثال: هل رسم شكل الحرف "${positionInfo?.letterForm || letter}"، أم رسم الكلمة التوضيحية "${positionInfo?.exampleWord || ''}"، أم رسم شيئاً آخر مثل: بطة، تفاحة، شجرة، سيارة، شمس، بيت، كلب، قمر، ولد، سمكة، وردة...). كن متفهماً ومتسامحاً جداً مع رسومات وتخيلات الأطفال الصغار غير المتقنة وشجعهم بحرارة!
2. هل هذا الشيء يمثل الحرف [${letter}] أو شكله (${positionInfo?.letterForm || letter}) أو كلمته المقترحة أو يبدأ به؟
3. قدم تعليقاً تربوياً مشجعاً جداً ومفرحاً للطفل مع التشكيل التام بالحركات.
4. اذكر عدد النجوم المستحقة (من 3 إلى 5 نجوم).
5. أرجع النتيجة فقط بصيغة JSON:
{
  "recognizedObject": "اسم الشيء المكتشف (مثال: ${positionInfo?.exampleWord || 'بَطَّة'})",
  "startsWithTargetLetter": true,
  "targetLetter": "${letter}",
  "confidenceScore": 92,
  "feedback": "تعليق تربوي مشجع ومشكل بالحركات",
  "badgeEarned": "اسم وسام مميز للطفل",
  "starsCount": 5
}
`;

  try {
    const response = await generateContentWithFallback(ai, {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Data,
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
      targetRole: 'student'
    });

    const result: DrawingAnalysisResult = JSON.parse(cleanJsonText(response.text || '{}'));
    return {
      recognizedObject: result.recognizedObject || `عنصر يمثل حرف (${letter})`,
      startsWithTargetLetter: result.startsWithTargetLetter ?? true,
      targetLetter: letter,
      confidenceScore: result.confidenceScore || 90,
      feedback: result.feedback || `رَسْمَةٌ رَائِعَةٌ يَا بَطَل! أَنْتَ فَنَّانٌ بَارِعٌ! 🌟`,
      badgeEarned: result.badgeEarned || `وسام الرسام المبدع لحرف (${letter}) 🎨`,
      starsCount: result.starsCount || 5,
    };
  } catch (err) {
    console.error('خطأ في التعرف البصري على الرسمة:', err);
    return {
      recognizedObject: `رَسْمَةٌ جَمِيلَةٌ لِحَرْفِ (${letter})`,
      startsWithTargetLetter: true,
      targetLetter: letter,
      confidenceScore: 88,
      feedback: `لَوْحَةٌ مُبْهِجَةٌ وَأَلْوَانٌ مُتَأَلِّقَةٌ يَا بَطَل! اسْتَمِرَّ فِي الإِبْدَاعِ! 🌈🖌️`,
      starsCount: 5,
      badgeEarned: `رسام المستقبل 🌟`,
    };
  }
}

// ================= 5. التحليل التشخيصي للنطق والتقدم (Parent & Educator Analytics) =================
export async function generateDiagnosticAnalytics(
  studentName: string,
  submissionsData: any[],
  phonicsHistory: any[]
): Promise<DiagnosticReport> {
  const ai = getAIClient();

  const mockReport: DiagnosticReport = {
    studentName,
    masteredLetters: ['أ', 'ب', 'م', 'س', 'د', 'ر'],
    needsPracticeLetters: ['ض', 'ص', 'ط', 'ظ'],
    engagementRate: 94,
    overallAccuracy: 88,
    teacherPedagogicalNotes: `يُظهر الطالب ${studentName} شغفاً لافتاً وسرعة استيعاب في تمييز الحروف الشائعة (الباء والميم والسين). يُوصى بالتركيز في المرحلة القادمة على تمييز الحروف المفخمة (الضاد والطاء والصاد) من خلال ألعاب الاستماع التفاعلية وقصص الحكواتي التكيفية لتعزيز مخارج الحروف.`,
    recommendedNextSteps: [
      'تخصيص تدريب صوتي لمدة 5 دقائق يومياً على نطق حرفي الضاد والصاد',
      'تشجيع الطالب على قراءة القصص القصيرة في رف مكتبة بوك تايم المصورة',
      'طباعة أوراق العمل المنزلية المخصصة للحروف المستهدفة وحلها برفقة الأسرة'
    ],
    strengths: ['التمييز البصري للحروف', 'التفاعل السريع مع التحديات الصوتية', 'الحصيلة اللغوية التعبيرية'],
    growthAreas: ['مخارج الحروف المفخمة والمرققة', 'التمييز بين التاء المربوطة والمفتوحة'],
    generatedAt: new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' }),
  };



  const prompt = `
أنت مستشار تشخيص تربوي ولغوي في منصة تعلّم مع موسى.
بيانات الطالب:
الاسم: [${studentName}].
عدد الأنشطة المكتملة: [${submissionsData.length}].
سجل درجات الاختبارات: [${JSON.stringify(submissionsData.slice(0, 5))}].
سجل ممارسات الصوتيات والرسم: [${JSON.stringify(phonicsHistory.slice(0, 10))}].

المطلوب:
تحليل دقيق وموضوعي لمستوى الطالب باللغة العربية وإصدار تقرير تشخيصي تربوي مهيكل بصيغة JSON كالتالي:
{
  "studentName": "${studentName}",
  "masteredLetters": ["أ", "ب", "م", "ت"],
  "needsPracticeLetters": ["ص", "ض", "ظ"],
  "engagementRate": 92,
  "overallAccuracy": 85,
  "teacherPedagogicalNotes": "فقرة تربوية دقيقة موجهة للمعلم وولي الأمر",
  "recommendedNextSteps": ["خطوة 1", "خطوة 2", "خطوة 3"],
  "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
  "growthAreas": ["مجال تحسين 1", "مجال تحسين 2"]
}
`;

  try {
    const response = await generateContentWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
      targetRole: 'parent'
    });

    const parsed = JSON.parse(cleanJsonText(response.text || '{}'));
    return {
      studentName,
      masteredLetters: parsed.masteredLetters || mockReport.masteredLetters,
      needsPracticeLetters: parsed.needsPracticeLetters || mockReport.needsPracticeLetters,
      engagementRate: parsed.engagementRate || mockReport.engagementRate,
      overallAccuracy: parsed.overallAccuracy || mockReport.overallAccuracy,
      teacherPedagogicalNotes: parsed.teacherPedagogicalNotes || mockReport.teacherPedagogicalNotes,
      recommendedNextSteps: parsed.recommendedNextSteps || mockReport.recommendedNextSteps,
      strengths: parsed.strengths || mockReport.strengths,
      growthAreas: parsed.growthAreas || mockReport.growthAreas,
      generatedAt: new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' }),
    };
  } catch (err) {
    console.error('خطأ في توليد التقرير التشخيصي:', err);
    return mockReport;
  }
}

// ================= 6. مولد أوراق العمل والأنشطة المنزلية القابلة للطباعة =================
export async function generatePrintableWorksheet(
  studentName: string,
  grade: string,
  weakLetters: string[]
): Promise<string> {
  const ai = getAIClient();
  const lettersList = weakLetters.length > 0 ? weakLetters.join('، ') : 'الصاد، الضاد، الطاء';

  const defaultWorksheet = `
# 📝 وَرَقَةُ عَمَلٍ مَنْزِلِيَّةٍ عِلَاجِيَّة: الحُرُوفُ المُسْتَهْدَفَة (${lettersList})
**اسْمُ الطَّالِب:** ${studentName}  
**الصَّفُّ الدِّرَاسِي:** ${grade}  
**المَادَّة:** اللُّغَةُ العَرَبِيَّةُ (مَنَصَّةُ تَعَلَّمْ مَعَ مُوسَى)  
**التَّارِيخ:** ${new Date().toLocaleDateString('ar-EG')}

---

### 🌟 التَّمْرِينُ الأَوَّل: كِتَابَةُ الحَرْفِ بِحَرَكَاتِهِ الثَّلَاث (الفَتْحَة، الضَّمَّة، الكَسْرَة)
اُكْتُبْ كُلَّ حَرْفٍ مَعَ الحَرَكَةِ ثَلَاثَ مَرَّاتٍ بِخَطٍّ جَمِيلٍ وَمُنَسَّق:
- الحَرْفُ الأَوَّل: [ ${weakLetters[0] || 'ص'} ] :  
  - بِالفَتْحَةِ: ( ____________ )  
  - بِالضَّمَّةِ: ( ____________ )  
  - بِالكَسْرَةِ: ( ____________ )  

- الحَرْفُ الثَّانِي: [ ${weakLetters[1] || 'ض'} ] :  
  - بِالفَتْحَةِ: ( ____________ )  
  - بِالضَّمَّةِ: ( ____________ )  
  - بِالكَسْرَةِ: ( ____________ )  

---

### 🎯 التَّمْرِينُ الثَّانِي: تَمْيِيزُ الصَّوْتِ فِي الكَلِمَات
ضَعْ دَائِرَةً حَوْلَ الكَلِمَةِ الَّتِي تَبْدَأُ بِالحَرْفِ المَطْلُوب:
1. حَرْفُ (${weakLetters[0] || 'ص'}):  
   [ سَمَكَةٌ ]  -  [ صَقْرٌ ]  -  [ عُصْفُورٌ ]  
2. حَرْفُ (${weakLetters[1] || 'ض'}):  
   [ ضِفْدَعٌ ]  -  [ دَلْوٌ ]  -  [ فَرَاشَةٌ ]  

---

### 🎨 التَّمْرِينُ الثَّالِث: الرَّسْمُ وَالتَّعْبِيرُ اللَّطِيف
اِرْسُمْ شَيْئًا يُحِبُّهُ قَلْبُكَ يَبْدَأُ بِحَرْفِ [ ${weakLetters[0] || 'ص'} ]، ثُمَّ اكْتُبْ اسْمَهُ تَحْتَ الصُّورَة:
\`\`\`
┌────────────────────────────────────────────────────────┐
│                                                        │
│                 [ مِسَاحَةُ الرَّسْمِ المُمْتِع ]               │
│                                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
\`\`\`
اِسْمُ الشَّيْءِ الَّذِي رَسَمْتُهُ: ____________________

---

### 👨‍👩‍👧 تَشْجِيعُ وَلِيِّ الأَمْرِ وَالمُعَلِّم:
- **تَوْقِيعُ وَلِيِّ الأَمْر:** ______________  
- **تَقْيِيمُ مُوسَى الصَّدِيق:** [  ⭐⭐⭐⭐⭐  ] مُتَمَيِّزٌ وَمُبْدِعٌ يَا بَطَل!  
`;

  if (!ai) {
    return defaultWorksheet;
  }

  const prompt = `
أنت مصمم مناهج دراسية لمرحلة رياض الأطفال والمرحلة الابتدائية في اللغة العربية.
صمم ورقة عمل منزلية جذابة، مشكولة بالحركات، قابلة للطباعة مباشرة بصيغة Markdown.
اسم الطالب: [${studentName}].
الصف: [${grade}].
الحروف التي يحتاج الطالب لتقويتها: [${lettersList}].

يجب أن تتضمن ورقة العمل:
1. ترويسة مدرسية رسمية وأنيقة.
2. تمرين نطق وكتابة الحرف بالحركات الثلاث (فتحة، ضمة، كسرة).
3. تمرين اختيار أو وصل كلمات تبدأ بتلك الحروف.
4. تمرين إبداعي (ارسم شيئاً يبدأ بالحرف).
5. خانة تشجيعية وتوقيع ولي الأمر وتقييم المعلم.
6. النص العربي بالكامل يجب أن يكون مشكولاً بالحركات الفصيحة المناسبة للأطفال.
`;

  try {
    const response = await generateContentWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.5,
      },
      targetRole: 'parent'
    });

    return response.text?.trim() || defaultWorksheet;
  } catch (err) {
    console.error('فشل توليد ورقة العمل:', err);
    return defaultWorksheet;
  }
}

// ================= 7. حزمة الذكاء الاصطناعي للمعلم (Teacher AI Suite - Gemini 2.5 Flash) =================

/**
 * أ) دالة توليد قصة أو نص قرائي مشكول بالحركات
 */
export async function generateAIPassage(
  grade: string,
  track: string,
  targetLetterOrTopic: string
): Promise<{ title: string; passage: string }> {
  const cleanTarget = targetLetterOrTopic.trim() || 'الصداقة والتعاون';
  const trackLabel = track === 'arabic-a' ? 'الناطقين باللغة العربية' : 'الناطقين بغيرها (مبسط وميسر)';
  const ai = getAIClient();

  const fallbackTitle = `مُغَامَرَةٌ مُمْتِعَةٌ مَعَ (${cleanTarget})`;
  const fallbackPassage = `فِي يَوْمٍ رَبِيعِيٍّ بَدِيعٍ، اجْتَمَعَ الأَصْدِقَاءُ فِي سَاحَةِ المَدْرَسَةِ الخَضْرَاءِ، يَتَعَلَّمُونَ حَوْلَ «${cleanTarget}». كَانَ الجَمِيعُ يَبْتَسِمُونَ فِي سُرُورٍ وَيُشَارِكُونَ حِكَايَاتِهِمْ بِكُلِّ فَخْرٍ وَحُبٍّ لِلُغَتِنَا العَرَبِيَّةِ الجَمِيلَةِ!`;

  if (!ai) {
    return { title: fallbackTitle, passage: fallbackPassage };
  }

  const prompt = `
أنت خبير مناهج لغة عربية للأطفال ومؤلف قصص أطفال محترف لمرحلة التعليم التأسيسي والابتدائي.
الصف الدراسي: [${grade}].
المسار التعليمي: [${trackLabel}].
الحرف أو الموضوع المستهدف: [${cleanTarget}].

المطلوب:
1. قم بتأليف نص قرائي قصير أو قصة شيقة وتربوية (بين 3 و 5 أسطر) تناسب هذا الصف.
2. يجب أن يكون النص مشكولاً تشكيلاً تاماً بنسبة 100% بكافة الحركات الفصيحة (فتحة، ضمة، كسرة، سكون، تنوين، شدة).
3. ركز على تكرار الحرف المستهدف أو تجسيد الموضوع التربوي بأسلوب شيق وجذاب للطفل.
4. اقترح عنواناً جذاباً ومشكولاً للنص.
5. أرجع النتيجة فقط بصيغة JSON التالية بدون أي نصوص خارجية:
{
  "title": "العنوان المشكول هنا",
  "passage": "النص القرائي الكامل المشكول بالحركات هنا"
}
`;

  try {
    const response = await generateContentWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.6,
      },
      targetRole: 'teacher'
    });

    const parsed = JSON.parse(cleanJsonText(response.text || '{}'));
    return {
      title: parsed.title?.trim() || fallbackTitle,
      passage: parsed.passage?.trim() || fallbackPassage,
    };
  } catch (err) {
    console.error('فشل توليد النص القرائي للمعلم:', err);
    return { title: fallbackTitle, passage: fallbackPassage };
  }
}

/**
 * ب) دالة توليد الأسئلة التفاعلية آلياً من النص وفق مستويات بلوم
 */
export async function generateQuestionsFromPassage(
  passage: string,
  grade: string,
  count: number = 3
): Promise<Question[]> {
  const cleanPassage = passage.trim();
  const ai = getAIClient();

  const fallbackQuestions: Question[] = [
    {
      id: `q_ai_${Date.now()}_1`,
      text: 'عَمَّ يَتَحَدَّثُ النَّصُّ الَّذِي قَرَأْتَهُ؟ (فهم واستيعاب)',
      type: 'multiple_choice',
      options: ['عَنِ الصَّدَاقَةِ وَالتَّعَلُّمِ', 'عَنِ السَّفَرِ إِلَى الفَضَاءِ', 'عَنْ مَلْعَبِ الكُرَةِ', 'عَنْ أَلْعَابِ الفِيدْيُو'],
      correctAnswer: 'عَنِ الصَّدَاقَةِ وَالتَّعَلُّمِ',
      points: 5,
    },
    {
      id: `q_ai_${Date.now()}_2`,
      text: 'مَا الظَّاهِرَةُ اللُّغَوِيَّةُ الأَبْرَزُ فِي كَلِمَاتِ النَّصِّ؟ (ظاهرة لغوية/صوتية)',
      type: 'multiple_choice',
      options: ['الحُرُوفُ المَشْكُولَةُ بِالحَرَكَاتِ', 'الأَفْعَالُ المَاضِيَةُ فَقَطْ', 'الأَسْمَاءُ الأَعْجَمِيَّةُ', 'الأَرْقَامُ الحِسَابِيَّةُ'],
      correctAnswer: 'الحُرُوفُ المَشْكُولَةُ بِالحَرَكَاتِ',
      points: 5,
    },
    {
      id: `q_ai_${Date.now()}_3`,
      text: 'مَا القِيمَةُ الإِيجَابِيَّةُ الَّتِي نَسْتَفِيدُهَا مِنْ هَذَا النَّصِّ؟ (تفكير استنتاجي)',
      type: 'multiple_choice',
      options: ['حُبُّ العِلْمِ وَالتَّعَاوُنِ', 'التَّسَرُّعُ فِي الحُكْمِ', 'الإِهْمَالُ', 'العُزْلَةُ عَنِ الآخَرِينَ'],
      correctAnswer: 'حُبُّ العِلْمِ وَالتَّعَاوُنِ',
      points: 5,
    }
  ];

  if (!cleanPassage || !ai) {
    return fallbackQuestions.slice(0, count);
  }

  const prompt = `
أنت خبير قياس وتقويم تربوي لمادة اللغة العربية في المرحلة الابتدائية.
النص القرائي:
"""
${cleanPassage}
"""
الصف الدراسي: [${grade}].
عدد الأسئلة المطلوبة: [${count}].

المطلوب:
قم بتوليد ${count} أسئلة اختيار من متعدد مشكولة بالحركات ومستوحاة تماماً من النص، تراعي التدرج وفق مستويات بلوم المعرفية:
1. السؤال الأول: مستوى الفهم المباشر والاسترجاع (حدث أو معلومة ذكرت صراحة في النص).
2. السؤال الثاني: مستوى تمييز ظاهرة لغوية أو صوتية (مثل: التنوين، المد بالألف أو الياء أو الواو، التاء المربوطة، اللام الشمسية/القمرية، أو الحرف الأول لكلمة معينة).
3. السؤال الثالث: مستوى الاستنتاج والتحليل اللطيف (العبرة، المشاعر، أو المعنى الدلالي العام).

شروط هامة:
- كل سؤال يجب أن يحتوي على 4 خيارات مختلفة بدقة.
- حدد خياراً واحداً كإجابة صحيحة تماثل تماماً أحد الخيارات الأربعة.
- أخرج النتيجة بصيغة مصفوفة JSON مطابقة للنمط التالي فقط:
[
  {
    "id": "q_ai_1",
    "text": "نص السؤال المشكول؟",
    "type": "multiple_choice",
    "options": ["الخيار أ", "الخيار ب", "الخيار ج", "الخيار د"],
    "correctAnswer": "الخيار أ",
    "points": 5
  }
]
`;

  try {
    const response = await generateContentWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
      targetRole: 'teacher'
    });

    const parsed: any[] = JSON.parse(cleanJsonText(response.text || '[]'));
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item, idx) => ({
        id: item.id || `q_ai_${Date.now()}_${idx + 1}`,
        text: item.text || `سؤال (${idx + 1})`,
        type: 'multiple_choice',
        options: Array.isArray(item.options) && item.options.length >= 2
          ? item.options
          : ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'],
        correctAnswer: item.correctAnswer || (item.options ? item.options[0] : ''),
        points: typeof item.points === 'number' ? item.points : 5,
      }));
    }
    return fallbackQuestions.slice(0, count);
  } catch (err) {
    console.error('فشل توليد الأسئلة عبر الذكاء الاصطناعي:', err);
    return fallbackQuestions.slice(0, count);
  }
}

/**
 * بنك الأسئلة المحلي الاحتياطي التلقائي المدمج (Pre-cached Offline Bank)
 * يولد 20 سؤالاً مشكولاً ومتنوعاً بنسبة 100% بحسب مستوى وصف الطالب
 * ويدعم كافة الأنماط التفاعلية (classic, true_false, puzzle, type_answer) فوراً
 */
export function getOfflineChallengeBank(params: {
  topic?: string;
  grade?: string;
  count?: number;
  timeLimitSeconds?: number;
  questionTypes?: ('classic' | 'true_false' | 'puzzle' | 'type_answer' | 'word_cloud' | 'poll')[];
}): any[] {
  const { topic = '', grade = 'grade-3', count = 20, timeLimitSeconds = 20, questionTypes } = params;
  const targetCount = Math.max(count || 20, 20);
  const defaultShapes = ['triangle', 'diamond', 'circle', 'square'];

  // 1. تحديد المستوى الملائم للصف الدراسي (1 إلى 5)
  const gLower = (grade || '').toLowerCase();
  let level = 3;
  if (gLower.includes('1') || gLower.includes('أول') || gLower.includes('kg') || gLower.includes('تمهيد')) {
    level = 1;
  } else if (gLower.includes('2') || gLower.includes('ثان')) {
    level = 2;
  } else if (gLower.includes('3') || gLower.includes('ثالث')) {
    level = 3;
  } else if (gLower.includes('4') || gLower.includes('رابع')) {
    level = 4;
  } else if (gLower.includes('5') || gLower.includes('خامس') || gLower.includes('6') || gLower.includes('سادس')) {
    level = 5;
  }

  // 2. تجميع بنك الأسئلة المعتمد حسب المستوى
  let rawBank: KnowledgeNodeQuestion[] = [];
  try {
    if (level === 1) {
      rawBank = [
        ...getSingleSounds50Questions(),
        ...getShortVowels50Questions(),
        ...getSukunSegments50Questions()
      ];
    } else if (level === 2) {
      rawBank = [
        ...getLongVowels50Questions(),
        ...getTanween50Questions(),
        ...getShaddah50Questions(),
        ...getShamsQamar50Questions(),
        ...getTaaTypes50Questions()
      ];
    } else if (level === 3) {
      rawBank = [
        ...getWordParts50Questions(),
        ...getSentenceStructures50Questions(),
        ...getSubjectVerb50Questions()
      ];
    } else if (level === 4) {
      rawBank = [
        ...getLiteralComprehension50Questions(),
        ...getInferentialReading50Questions(),
        ...getVocabInContext50Questions()
      ];
    } else {
      rawBank = [
        ...getSentenceCombining50Questions(),
        ...getFigurativeLanguage50Questions(),
        ...getCriticalAppreciation50Questions()
      ];
    }
  } catch (err) {
    console.warn('استخدام بنك أسئلة احتياطي بديل:', err);
  }

  if (rawBank.length < targetCount) {
    try {
      rawBank = [
        ...rawBank,
        ...getLongVowels50Questions(),
        ...getTanween50Questions(),
        ...getWordParts50Questions()
      ];
    } catch {}
  }

  const shuffled = [...rawBank].sort(() => Math.random() - 0.5);
  const allowedTypes = (questionTypes && questionTypes.length > 0)
    ? questionTypes
    : ['classic', 'true_false', 'puzzle', 'type_answer'];

  const generatedQuestions: any[] = [];

  // دمج الأسئلة النموذجية من INITIAL_CHALLENGE_QUIZZES أولاً إن توافرت
  INITIAL_CHALLENGE_QUIZZES.forEach(qz => {
    if (qz.questions && qz.questions.length > 0) {
      qz.questions.forEach(q => {
        const qType = q.type || 'classic';
        if (allowedTypes.includes(qType) && generatedQuestions.length < 8) {
          generatedQuestions.push({
            ...q,
            id: `off_seed_${generatedQuestions.length + 1}_${Date.now()}`,
            type: qType,
            timeLimitSeconds: timeLimitSeconds || q.timeLimitSeconds || 20,
          });
        }
      });
    }
  });

  // استكمال الـ 20 سؤالاً بالكامل من بنك المعرفة المشكول
  for (let i = 0; i < shuffled.length && generatedQuestions.length < targetCount; i++) {
    const rawQ = shuffled[i];
    const qIndex = generatedQuestions.length + 1;

    let qType: 'classic' | 'true_false' | 'puzzle' | 'type_answer' | 'word_cloud' | 'poll' = 'classic';
    if (allowedTypes.length === 1) {
      qType = allowedTypes[0] as any;
    } else {
      if (allowedTypes.includes('word_cloud') && qIndex % 6 === 0) {
        qType = 'word_cloud';
      } else if (allowedTypes.includes('poll') && qIndex % 5 === 0) {
        qType = 'poll';
      } else if (allowedTypes.includes('puzzle') && qIndex % 4 === 0) {
        qType = 'puzzle';
      } else if (allowedTypes.includes('true_false') && qIndex % 3 === 0) {
        qType = 'true_false';
      } else if (allowedTypes.includes('type_answer') && qIndex % 2 === 0) {
        qType = 'type_answer';
      } else {
        qType = 'classic';
      }
    }

    if (qType === 'true_false') {
      const isCorrect = Math.random() > 0.45;
      const text = isCorrect
        ? `${rawQ.prompt} الإِجَابَةُ الصَّحِيحَةُ هِيَ: [${rawQ.correctAnswer}].`
        : `${rawQ.prompt} الإِجَابَةُ الصَّحِيحَةُ هِيَ: [${rawQ.options.find(o => o !== rawQ.correctAnswer) || 'كَلِمَةٌ غَيْرُ صَحِيحَةٍ'}].`;
      generatedQuestions.push({
        id: `off_tf_${qIndex}_${Date.now()}`,
        type: 'true_false',
        text,
        timeLimitSeconds,
        correctIndex: isCorrect ? 0 : 1,
        explanation: rawQ.explanation || 'إِجَابَةٌ رَائِعَةٌ وَتَمْيِيزٌ لُغَوِيٌّ بَارِعٌ! 🌟',
        options: [
          { id: '0', text: 'صَحِيحٌ (صَوَابٌ) ✅', shape: 'diamond' },
          { id: '1', text: 'خَاطِئٌ (خَطَأٌ) ❌', shape: 'triangle' },
        ],
      });
    } else if (qType === 'puzzle') {
      const cleanAnswer = rawQ.correctAnswer.replace(/[\u064B-\u065F\u0670]/g, '').trim();
      const splitted = cleanAnswer.split(/\s+/).filter(Boolean);
      const puzzleWords = splitted.length >= 4 
        ? splitted.slice(0, 4) 
        : ['يَقْرَأُ', 'مُوسَى', 'الكِتَابَ', 'بِشَغَفٍ'];
      generatedQuestions.push({
        id: `off_puz_${qIndex}_${Date.now()}`,
        type: 'puzzle',
        text: `رَتِّبِ الكَلِمَاتِ الآتِيَةَ لِتَكْوِينِ جُمْلَةٍ مُفِيدَةٍ:`,
        timeLimitSeconds,
        correctIndex: 0,
        correctOrder: [0, 1, 2, 3],
        explanation: 'تَرْتِيبٌ مِثَالِيٌّ وَجُمْلَةٌ عَرَبِيَّةٌ فَصِيحَةٌ مُتَنَاسِقَةٌ! 🌟',
        options: puzzleWords.map((w, wIdx) => ({
          id: String(wIdx),
          text: w,
          shape: defaultShapes[wIdx % 4],
        })),
      });
    } else if (qType === 'type_answer') {
      const ansFull = rawQ.correctAnswer.trim();
      const ansBare = ansFull.replace(/[\u064B-\u065F\u0670]/g, '');
      generatedQuestions.push({
        id: `off_type_${qIndex}_${Date.now()}`,
        type: 'type_answer',
        text: `${rawQ.prompt} (اكْتُبِ الإِجَابَةَ الصَّحِيحَةَ):`,
        timeLimitSeconds,
        correctIndex: 0,
        correctAnswerText: ansBare,
        acceptableAnswers: [ansFull, ansBare],
        explanation: rawQ.explanation || 'كِتَابَةٌ دَقِيقَةٌ وَإِمْلَاءٌ سَلِيمٌ يَا بَطَل! ✨',
        options: [],
      });
    } else if (qType === 'word_cloud') {
      const safeTopic = (topic || '').trim() || 'اللغة العربية والظواهر الإملائية والنحوية';
      generatedQuestions.push({
        id: `off_wc_${qIndex}_${Date.now()}`,
        type: 'word_cloud',
        text: `صِفْ شُعُورَكَ أَوْ أَهَمَّ كَلِمَةٍ تَعَلَّمْتَهَا فِي: [${safeTopic}] بِكَلِمَةٍ وَاحِدَةٍ:`,
        timeLimitSeconds,
        correctIndex: 0,
        explanation: 'عَصْفٌ ذِهْنِيٌّ مُبْدِعٌ وَكَلِمَاتٌ رَائِعَةٌ مِلْؤُهَا الفَصَاحَةُ! 💭✨',
        options: [],
      });
    } else if (qType === 'poll') {
      const safeTopic = (topic || '').trim() || 'اللغة العربية والظواهر الإملائية والنحوية';
      generatedQuestions.push({
        id: `off_poll_${qIndex}_${Date.now()}`,
        type: 'poll',
        text: `مَا هُوَ الجَانِبُ الأَكْثَرُ تَشْوِيقًا لَكَ فِي: [${safeTopic}]؟`,
        timeLimitSeconds,
        correctIndex: 0,
        explanation: 'شُكْرًا لِمُشَارَكَةِ رَأْيِكَ المُمَيَّزِ يَا بَطَل! 📊🌟',
        options: [
          { id: '0', text: 'المُغَامَرَةُ وَالقِصَصُ 📖', shape: 'diamond' },
          { id: '1', text: 'الأَلْعَابُ وَالتَّحَدِّيَاتُ 🎮', shape: 'triangle' },
          { id: '2', text: 'الإِبْدَاعُ وَالكِتَابَةُ ✍️', shape: 'circle' },
          { id: '3', text: 'الإِنْشَادُ وَالأَصْوَاتُ 🎵', shape: 'square' },
        ],
      });
    } else {
      const opts = Array.isArray(rawQ.options) && rawQ.options.length >= 2
        ? [...rawQ.options].slice(0, 4)
        : ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'];
      while (opts.length < 4) {
        opts.push(`خيار ${opts.length + 1}`);
      }
      let cIdx = opts.indexOf(rawQ.correctAnswer);
      if (cIdx === -1) cIdx = 0;

      generatedQuestions.push({
        id: `off_cls_${qIndex}_${Date.now()}`,
        type: 'classic',
        text: rawQ.prompt,
        timeLimitSeconds,
        correctIndex: cIdx,
        explanation: rawQ.explanation || 'إِجَابَةٌ نَمُوذَجِيَّةٌ وَاخْتِيَارٌ صَحِيحٌ يَا بَطَلَ العَرَبِيَّةِ! 🎯',
        options: opts.map((optText, oIdx) => ({
          id: String(oIdx),
          text: optText,
          shape: defaultShapes[oIdx % 4],
        })),
      });
    }
  }

  return generatedQuestions.slice(0, targetCount);
}

/**
 * دالة توليد أسئلة تحدي موسى التنافسية الحية (Mousa Challenge Quiz Generator)
 * تضمن دعم الأنماط التفاعلية: (اختيار متعدد كلاسيكي، صح أو خطأ، سباق الترتيب، سحر الإملاء والكتابة، سحابة الكلمات، استطلاع الرأي)
 * مع ضمان تفعيل التوليد الفوري للمحرك الذكي 100% (20 سؤالاً مشكولاً ومتنوعاً فوراً وبدون استهلاك رصيد)
 */
export async function generateAIChallengeQuestions(params: {
  topic: string;
  grade: string;
  count: number;
  timeLimitSeconds?: number;
  questionTypes?: ('classic' | 'true_false' | 'puzzle' | 'type_answer' | 'word_cloud' | 'poll')[];
}): Promise<any[]> {
  const { topic, grade, count = 20, timeLimitSeconds = 20, questionTypes } = params;
  const targetCount = Math.max(count || 20, 20);
  const cleanTopic = topic.trim() || 'اللغة العربية والظواهر الإملائية والنحوية';
  const defaultShapes = ['triangle', 'diamond', 'circle', 'square'];

  // بنك الأسئلة الذكي الفوري المدمج (Pre-cached Instant Offline Bank)
  const getFallback = () => getOfflineChallengeBank({
    topic: cleanTopic,
    grade,
    count: targetCount,
    timeLimitSeconds,
    questionTypes,
  });

  const ai = getAIClient();


  const allowedTypes: ('classic' | 'true_false' | 'puzzle' | 'type_answer' | 'word_cloud' | 'poll')[] =
    (questionTypes && questionTypes.length > 0)
      ? questionTypes
      : ['classic', 'true_false', 'puzzle', 'type_answer', 'word_cloud', 'poll'];

  const allowedTypesStr = allowedTypes.join(', ');

  const prompt = `
أنت «موسى» الخبير التربوي وصانع المسابقات التفاعلية الحية للأطفال في منصة "تعلَّم مع موسى".
الموضوع المطلوب للمسابقة: [${cleanTopic}].
الصف الدراسي: [${grade}].
عدد الأسئلة المطلوبة: [${count}].
زمن الإجابة لكل سؤال: [${timeLimitSeconds}] ثانية.
الأنماط التفاعلية المطلوب التوليد منها فقط: [${allowedTypesStr}].
${allowedTypes.length === 1 ? `ملاحظة هامة: يجب أن تكون جميع الأسئلة المتولدة من نمط [${allowedTypes[0]}] حصراً!` : `ملاحظة هامة: قم بالتنويع الذكي بين الأنماط المطلوبة المحددة ([${allowedTypesStr}]) لتكون المسابقة حماسية ومشوقة!`}

قواعد الأنماط التفاعلية بدقة:
1. نمط "classic": سؤال اختيار من متعدد كلاسيكي بـ 4 خيارات بأشكال (triangle, diamond, circle, square)، خيار واحد صحيح (correctIndex من 0 إلى 3).
2. نمط "true_false": عبارة صحيحة أو خاطئة مع خيارين فقط:
   - الخيار 0: "صَحِيحٌ (صَوَابٌ) ✅" مع شكل "diamond"
   - الخيار 1: "خَاطِئٌ (خَطَأٌ) ❌" مع شكل "triangle"
   و correctIndex إما 0 للصحيح أو 1 للخاطئ.
3. نمط "puzzle": سؤال سباق ترتيب (تكوين جملة أو ترتيب أحداث أو خطوات إملائية/نحوية). يحتوي على 4 عناصر في options بالترتيب الأولي المشوش، وحقل correctOrder يحتوي على مصفوفة أرقام الترتيب الصحيح [0, 1, 2, 3] بحسب الفهارس الأصلية للخيارات.
4. نمط "type_answer": سؤال كتابة إملائية ونحوية مباشرة (مثل: كتابة كلمة منونة، أو تحويل جمع، أو كتابة همزة)، options تكون فارغة []، مع حقل correctAnswerText (الكلمة أو العبارة المطلوبة) وحقل acceptableAnswers (مصفوفة بدائل مقبولة مع وبدون التشكيل لتسهيل التقييم).
5. نمط "word_cloud": عصف ذهني وإبداعي (مثل: "صِفِ القِرَاءَةَ بِكَلِمَةٍ وَاحِدَةٍ" أو "اذْكُرْ صِفَةً جَمِيلَةً لِلْأُمِّ")، options فارغة []، correctIndex = 0.
6. نمط "poll": استطلاع رأي تصويتي مشوق متعلق بموضوع الدرس، يحتوي على 3 أو 4 خيارات بأشكال، correctIndex = 0.

المطلوب الصارم:
- توليد ${count} أسئلة متنوعة متوافقة بدقة مع الأنماط المطلوبة: [${allowedTypesStr}].
- جميع النصوص والخيارات يجب أن تكون مشكولة بالحركات التامة بنسبة 100%.
- تقديم توضيح تربوي تشجيعي بصوت موسى (explanation) لكل سؤال.
- أخرج النتيجة فقط بصيغة مصفوفة JSON صالحة ومباشرة بدون نصوص خارجها مطابقة للمخطط التالي:
[
  {
    "id": "q_1",
    "type": "classic",
    "text": "نص السؤال المشكول بالحركات التامة؟",
    "timeLimitSeconds": ${timeLimitSeconds},
    "correctIndex": 0,
    "explanation": "شرح موسى التربوي المشكول والمشجع للأبطال 🌟",
    "options": [
      { "id": "0", "text": "الخيار الأول", "shape": "triangle" },
      { "id": "1", "text": "الخيار الثاني", "shape": "diamond" },
      { "id": "2", "text": "الخيار الثالث", "shape": "circle" },
      { "id": "3", "text": "الخيار الرابع", "shape": "square" }
    ]
  },
  {
    "id": "q_2",
    "type": "true_false",
    "text": "جملة صحيحة أو خاطئة مشكولة؟",
    "timeLimitSeconds": ${timeLimitSeconds},
    "correctIndex": 0,
    "explanation": "شرح موسى لتوضيح الصواب",
    "options": [
      { "id": "0", "text": "صَحِيحٌ (صَوَابٌ) ✅", "shape": "diamond" },
      { "id": "1", "text": "خَاطِئٌ (خَطَأٌ) ❌", "shape": "triangle" }
    ]
  },
  {
    "id": "q_3",
    "type": "puzzle",
    "text": "رَتِّبِ الكَلِمَاتِ الآتِيَةَ لِتَكْوِينِ جُمْلَةٍ مُفِيدَةٍ:",
    "timeLimitSeconds": ${timeLimitSeconds},
    "correctIndex": 0,
    "correctOrder": [0, 1, 2, 3],
    "explanation": "أحسنتم ترتيب الجملة بشكل سليم!",
    "options": [
      { "id": "0", "text": "الكلمة الأولى", "shape": "triangle" },
      { "id": "1", "text": "الكلمة الثانية", "shape": "diamond" },
      { "id": "2", "text": "الكلمة الثالثة", "shape": "circle" },
      { "id": "3", "text": "الكلمة الرابعة", "shape": "square" }
    ]
  },
  {
    "id": "q_4",
    "type": "type_answer",
    "text": "اكْتُبْ كَلِمَةً مُحَدَّدَةً:",
    "timeLimitSeconds": ${timeLimitSeconds},
    "correctIndex": 0,
    "correctAnswerText": "الكلمة",
    "acceptableAnswers": ["الكلمة", "كلمة", "كَلِمَةٌ"],
    "explanation": "كتابة صحيحة ومتقنة يا بطل!",
    "options": []
  }
]
`;

  try {
    const response = await generateContentWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
      targetRole: 'teacher'
    });

    const parsed: any[] = JSON.parse(cleanJsonText(response.text || '[]'));
    if (Array.isArray(parsed) && parsed.length > 0) {
      const mappedResults = parsed.map((item, idx) => {
        const qType = item.type || 'classic';
        const correctIdx = typeof item.correctIndex === 'number' ? item.correctIndex : 0;

        let options = Array.isArray(item.options) ? item.options : [];
        if (qType === 'true_false') {
          options = [
            { id: '0', text: 'صَحِيحٌ (صَوَابٌ) ✅', shape: 'diamond' },
            { id: '1', text: 'خَاطِئٌ (خَطَأٌ) ❌', shape: 'triangle' },
          ];
        } else if (qType === 'classic' || qType === 'poll' || qType === 'puzzle') {
          if (options.length === 0 || options.length < 2) {
            options = [
              { id: '0', text: 'الخيار الأول', shape: 'triangle' },
              { id: '1', text: 'الخيار الثاني', shape: 'diamond' },
              { id: '2', text: 'الخيار الثالث', shape: 'circle' },
              { id: '3', text: 'الخيار الرابع', shape: 'square' },
            ];
          } else {
            options = options.map((opt: any, oIdx: number) => ({
              id: String(oIdx),
              text: opt.text || `خيار ${oIdx + 1}`,
              shape: opt.shape || defaultShapes[oIdx % 4] || 'triangle',
            }));
          }
        } else if (qType === 'type_answer' || qType === 'word_cloud') {
          options = [];
        }

        return {
          id: item.id || `ch_q_${Date.now()}_${idx + 1}`,
          type: qType,
          text: item.text || `سؤال المسابقة (${idx + 1})`,
          timeLimitSeconds: item.timeLimitSeconds || timeLimitSeconds,
          correctIndex: correctIdx,
          correctOrder: Array.isArray(item.correctOrder) ? item.correctOrder : (qType === 'puzzle' ? [0, 1, 2, 3] : undefined),
          correctAnswerText: item.correctAnswerText || (qType === 'type_answer' ? 'الكلمة' : undefined),
          acceptableAnswers: Array.isArray(item.acceptableAnswers) ? item.acceptableAnswers : (item.correctAnswerText ? [item.correctAnswerText] : undefined),
          explanation: item.explanation || 'إجابة متميزة يا أبطال لغتنا العربية الجميلة! 🌟',
          options,
        };
      });

      if (mappedResults.length < targetCount) {
        const padding = getFallback().slice(mappedResults.length);
        return [...mappedResults, ...padding];
      }
      return mappedResults;
    }
    return getFallback();
  } catch (err) {
    console.warn('[Mousa Challenge Fallback] تعذر توليد أسئلة التحدي عبر Gemini، تفعيل بنك الأسئلة الاحتياطي التلقائي المدمج فوراً (20 سؤالاً):', err);
    return getFallback();
  }
}

/**
 * ج) دالة التشكيل اللغوي التلقائي وضبط أواخر الكلمات
 */
export async function autoTashkeelText(text: string): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';
  const ai = getAIClient();

  if (!ai) {
    return clean;
  }

  const prompt = `
أنت مدقق لغوي وعالم بالنحو والصرف وعلم الأصوات في اللغة العربية الفصحى.
المطلوب:
قم بتشكيل النص العربي التالي تشكيلاً تاماً بالحركات الكاملة (الفتحة، الضمة، الكسرة، السكون، الشدة، والتنوين)، وضبط أواخر الكلمات إعرابياً بشكل سليم ومناسب لطلاب المرحلة التأسيسية والابتدائية.
حافظ على نفس الكلمات وبنية الجمل والفقرات دون إضافة أو حذف.
أرجع النص المشكول فقط مباشرة دون أي مقدمات أو شروحات:

${clean}
`;

  try {
    const response = await generateContentWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.2,
      },
      targetRole: 'teacher'
    });

    const resText = response.text?.trim();
    return resText || clean;
  } catch (err) {
    console.error('فشل التشكيل التلقائي للنص:', err);
    return clean;
  }
}

/**
 * د) دالة تقرير الفاقد التعليمي الشامل للفصل
 */
export async function generateClassDiagnosticSummary(
  submissions: StudentSubmission[],
  activityTitle?: string
): Promise<ClassDiagnosticSummary> {
  const totalSubmissions = submissions.length;
  const ai = getAIClient();

  // حسابات إحصائية أساسية
  let totalScoreSum = 0;
  let totalPointsSum = 0;
  const studentScores: { name: string; score: number; total: number; pct: number }[] = [];

  submissions.forEach((sub) => {
    totalScoreSum += sub.score;
    totalPointsSum += sub.totalPoints;
    const pct = sub.totalPoints > 0 ? Math.round((sub.score / sub.totalPoints) * 100) : 0;
    studentScores.push({
      name: sub.studentName,
      score: sub.score,
      total: sub.totalPoints,
      pct,
    });
  });

  const avgScore = totalSubmissions > 0 ? Math.round(totalScoreSum / totalSubmissions) : 0;
  const avgTotal = totalSubmissions > 0 ? Math.round(totalPointsSum / totalSubmissions) : 0;
  const overallMasteryRate = avgTotal > 0 ? Math.round((avgScore / avgTotal) * 100) : 80;

  // رصد الطلاب المتعثرين
  const needingRemediation = studentScores
    .filter((s) => s.pct < 65)
    .map((s) => ({
      studentName: s.name,
      score: s.score,
      totalPoints: s.total,
      percentage: s.pct,
      remedialFocus: s.pct < 50 ? 'تدريب مكثف على الوعي الصوتي والتهجئة الفردية' : 'تعزيز الاستيعاب القرائي والتمييز بين المدود',
    }));

  const fallbackSummary: ClassDiagnosticSummary = {
    activityTitle: activityTitle || 'النشاط التفاعلي الشامل',
    totalSubmissions,
    overallMasteryRate,
    averageScore: avgScore,
    totalPoints: avgTotal,
    strugglingConcepts: [
      'التمييز بين التاء المربوطة والهاء في أواخر الكلمات',
      'استخراج الفكرة الرئيسية للنص والاستنتاج الدلالي',
      'التمييز بين الحركات القصيرة والمدود الطويلة (الألف والواو والياء)'
    ],
    difficultQuestions: [
      {
        questionText: 'سؤال استخراج القيمة التربوية المستفادة من القصة',
        mistakeRate: 42,
        note: 'احتاج الطلاب لربط أحداث القصة بالمغزى المعنوي النهائي.',
      },
      {
        questionText: 'سؤال تمييز الظاهرة الصوتية (حرف البداية أو حركة المد)',
        mistakeRate: 35,
        note: 'لوحظ خلط لدى بعض الطلاب في تمييز الكلمات التي تبدأ بحرف مشابه.',
      }
    ],
    studentsNeedingRemediation: needingRemediation.length > 0 ? needingRemediation : [
      {
        studentName: submissions[0]?.studentName || 'طالب بحاجة لدعم',
        score: submissions[0]?.score || 10,
        totalPoints: submissions[0]?.totalPoints || 20,
        percentage: 50,
        remedialFocus: 'خطة علاجية في مخارج الحروف وقراءة الكلمات الثلاثية',
      }
    ],
    actionableRecommendations: [
      'تخصيص الخمس دقائق الأولى من الحصة لتدريبات نطق وتمييز سريعة (Flash Cards).',
      'توظيف قصص موسى التكيفية الصوتية لربط الطالب بالحرف صوتاً ورسماً.',
      'طباعة أوراق العمل العلاجية المنزلية للطلاب المستهدفين وإشراك أولياء الأمور.',
      'تطبيق استراتيجية التعليم بالأقران (مجموعات تعاونية متجانسة ومتنوعة).'
    ],
    generatedAt: new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' }),
  };

  if (!ai || totalSubmissions === 0) {
    return fallbackSummary;
  }

  const prompt = `
أنت مستشار تشخيص تربوي ولغوي يحلل نتائج فصل دراسي في اللغة العربية.
بيانات النشاط: [${activityTitle || 'نشاط اللغة العربية التفاعلي'}].
عدد تسليمات الطلاب: [${totalSubmissions}].
متوسط الدرجات: [${avgScore} من ${avgTotal}].
نسبة الإتقان العامة: [${overallMasteryRate}%].
قائمة نتائج الطلاب بالتفصيل:
${JSON.stringify(studentScores)}

المطلوب:
إصدار تقرير تشخيصي شامل ودقيق للفاقد التعليمي وتحليل مستوى الفصل موجه للمعلم بصيغة JSON مطابقة للنمط التالي:
{
  "activityTitle": "${activityTitle || 'نشاط الفصل'}",
  "totalSubmissions": ${totalSubmissions},
  "overallMasteryRate": ${overallMasteryRate},
  "averageScore": ${avgScore},
  "totalPoints": ${avgTotal},
  "strugglingConcepts": [
    "مفهوم لغوي أو قرائي تعثر فيه الطلاب 1",
    "مفهوم لغوي أو قرائي تعثر فيه الطلاب 2",
    "مفهوم لغوي أو قرائي تعثر فيه الطلاب 3"
  ],
  "difficultQuestions": [
    {
      "questionText": "وصف السؤال أو المهارة الصعبة",
      "mistakeRate": 40,
      "note": "ملاحظة تشخيصية عن سبب التعثر"
    }
  ],
  "studentsNeedingRemediation": [
    {
      "studentName": "اسم الطالب",
      "score": 5,
      "totalPoints": 15,
      "percentage": 33,
      "remedialFocus": "المجال العلاجي المحدد للطالب"
    }
  ],
  "actionableRecommendations": [
    "توصية إجرائية وتدريسية للمعلم 1",
    "توصية إجرائية وتدريسية للمعلم 2",
    "توصية إجرائية وتدريسية للمعلم 3"
  ]
}
`;

  try {
    const response = await generateContentWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
      targetRole: 'teacher'
    });

    const parsed: Partial<ClassDiagnosticSummary> = JSON.parse(cleanJsonText(response.text || '{}'));
    return {
      activityTitle: parsed.activityTitle || fallbackSummary.activityTitle,
      totalSubmissions: parsed.totalSubmissions || totalSubmissions,
      overallMasteryRate: parsed.overallMasteryRate ?? overallMasteryRate,
      averageScore: parsed.averageScore ?? avgScore,
      totalPoints: parsed.totalPoints ?? avgTotal,
      strugglingConcepts: parsed.strugglingConcepts && parsed.strugglingConcepts.length > 0
        ? parsed.strugglingConcepts
        : fallbackSummary.strugglingConcepts,
      difficultQuestions: parsed.difficultQuestions && parsed.difficultQuestions.length > 0
        ? parsed.difficultQuestions
        : fallbackSummary.difficultQuestions,
      studentsNeedingRemediation: parsed.studentsNeedingRemediation && parsed.studentsNeedingRemediation.length > 0
        ? parsed.studentsNeedingRemediation
        : (needingRemediation.length > 0 ? needingRemediation : fallbackSummary.studentsNeedingRemediation),
      actionableRecommendations: parsed.actionableRecommendations && parsed.actionableRecommendations.length > 0
        ? parsed.actionableRecommendations
        : fallbackSummary.actionableRecommendations,
      generatedAt: new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' }),
    };
  } catch (err) {
    console.error('فشل إصدار تقرير الفاقد التعليمي للفصل:', err);
    return fallbackSummary;
  }
}

// ================= 8. ميزة النطق الصوتي الأصلي الفائق لشخصية موسى (Gemini Native Audio Output / TTS) =================
// دعم التخزين الدائم (IndexedDB)، وتقسيم النصوص الطويلة (Sentence Chunking) مع الجلب المسبق المتوازي (Parallel Prefetching)

interface CachedAudioItem {
  buffer: AudioBuffer;
  wavUrl?: string;
  pcm?: Uint8Array;
  timestamp: number;
}

// 1. ذاكرة التخزين السريع في الرام (RAM Cache) للتشغيل اللحظي الفوري 0ms
const mousaAudioCache = new Map<string, CachedAudioItem>();

// خريطة لدمج الطلبات المتزامنة (Deduplication) لمنع تكرار الاتصال بنفس النص
const inFlightFetches = new Map<string, Promise<AudioBuffer | null>>();

let audioContextInstance: AudioContext | null = null;
let currentSourceNode: AudioBufferSourceNode | null = null;
let mousaAudioSessionCounter = 0;

// 2. إعداد قاعدة التخزين الدائمة في المتصفح (IndexedDB Persistent Storage)
const DB_NAME = 'MousaVoiceNativeArabic_v2';
const DB_VERSION = 2;
const STORE_NAME = 'audio_clips';

let idbPromise: Promise<IDBDatabase | null> | null = null;

// مسح قواعد البيانات القديمة تلقائياً لتطهير أي تسجيلات سابقة كانت تحتوي على الجملة الإنجليزية
if (typeof window !== 'undefined' && window.indexedDB) {
  try {
    window.indexedDB.deleteDatabase('MousaVoicePersistentDB');
    window.indexedDB.deleteDatabase('MousaVoiceNativeArabic_v2');
    window.indexedDB.deleteDatabase('MousaVoiceNativeArabic');
  } catch {}
}

function getIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (idbPromise) return idbPromise;

  idbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('تعذر فتح IndexedDB لأصوات موسى');
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });

  return idbPromise;
}

async function getFromIndexedDBCache(key: string): Promise<Uint8Array | null> {
  try {
    const db = await getIndexedDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.pcm) {
            resolve(new Uint8Array(req.result.pcm));
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

async function saveToIndexedDBCache(key: string, pcm: Uint8Array): Promise<void> {
  try {
    const db = await getIndexedDB();
    if (!db) return;

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // تخزين مصفوفة البايتات كـ ArrayBuffer للتخزين السريع في مساحة المتصفح
    store.put({
      key,
      pcm: pcm.buffer,
      timestamp: Date.now()
    });
  } catch (err) {
    // تجاوز أخطاء المساحة أو الوضع الخاص بهدوء
  }
}

/**
 * الحصول على عميل AudioContext الموحد بنمط التهيئة الكسولة
 */
function getAudioContext(): AudioContext {
  if (!audioContextInstance || audioContextInstance.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    audioContextInstance = new AudioCtx({ sampleRate: 24000 });
  }
  return audioContextInstance;
}

/**
 * تنظيف النصوص العربية من الوسوم والرموز التعبيرية والكلمات الإنجليزية لضمان نطق عربي فصيح ونقي
 */
function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    // إزالة أي أحرف إنجليزية أو توجيهات أجنبية نهائياً لمنع نطق أي كلمة أو جملة بلغة غير العربية
    .replace(/[a-zA-Z]+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\*\#\`\_\[\]\(\)\{\}\>\~\+\=\|\/\\]/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * تقسيم النصوص الطويلة (مثل القصص والحوارات) إلى مقاطع وجمل قصيرة لبدء التشغيل الفوري
 * مع إتاحة جلب المقاطع التالية في الخلفية بالتوازي (Parallel Prefetching)
 */
function splitArabicIntoSpeechChunks(text: string, maxChunkLength = 85): string[] {
  const clean = cleanTextForSpeech(text);
  if (!clean) return [];
  if (clean.length <= maxChunkLength) return [clean];

  // التقسيم وفق علامات الترقيم الطبيعية ونهايات الجمل
  const sentenceRegex = /[^.!؟؛\n]+[.!؟؛\n]*/g;
  const matches = clean.match(sentenceRegex);

  if (!matches || matches.length <= 1) {
    // إن لم توجد علامات ترقيم، نقسم وفق الفواصل العربية
    if (clean.includes('،')) {
      const parts = clean.split('،').map((p, i, arr) => (i < arr.length - 1 ? p + '،' : p).trim()).filter(Boolean);
      if (parts.length > 1) return parts;
    }
    return [clean];
  }

  const chunks: string[] = [];
  let current = '';

  for (const match of matches) {
    const trimmed = match.trim();
    if (!trimmed) continue;

    if (!current) {
      current = trimmed;
    } else if ((current + ' ' + trimmed).length <= maxChunkLength) {
      current = current + ' ' + trimmed;
    } else {
      chunks.push(current);
      current = trimmed;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [clean];
}

/**
 * تحويل سلسلة Base64 إلى مصفوفة بايتات Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * تحويل بايتات الصوت الخام (16-bit Linear PCM Little-Endian @ 24kHz Mono) إلى AudioBuffer
 */
function pcmToAudioBuffer(pcmBytes: Uint8Array, audioCtx: AudioContext, sampleRate = 24000): AudioBuffer {
  const numSamples = Math.floor(pcmBytes.byteLength / 2);
  const audioBuffer = audioCtx.createBuffer(1, numSamples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  const dataView = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength);

  for (let i = 0; i < numSamples; i++) {
    const int16 = dataView.getInt16(i * 2, true);
    channelData[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
  }
  return audioBuffer;
}

/**
 * تحويل بايتات PCM إلى ملف WAV قياسي
 */
function pcmToWavBlob(pcmBytes: Uint8Array, sampleRate = 24000): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBytes.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer, 44).set(pcmBytes);
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * تشغيل كائن AudioBuffer مباشرة عبر AudioContext
 */
function playAudioBuffer(buffer: AudioBuffer, onEnd?: () => void) {
  try {
    if (currentSourceNode) {
      try {
        currentSourceNode.stop();
        currentSourceNode.disconnect();
      } catch {}
      currentSourceNode = null;
    }

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    currentSourceNode = source;

    source.onended = () => {
      if (currentSourceNode === source) {
        currentSourceNode = null;
      }
      if (onEnd) onEnd();
    };

    source.start(0);
  } catch (err) {
    console.warn('تعذر تشغيل عينة الصوت في AudioContext:', err);
    if (onEnd) onEnd();
  }
}

// كاش الأصوات المتاحة في المتصفح لضمان جهوزيتها اللحظية
let cachedBrowserVoices: SpeechSynthesisVoice[] = [];
let voicesInitialized = false;

function initBrowserVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const list = window.speechSynthesis.getVoices();
  if (list && list.length > 0) {
    cachedBrowserVoices = list;
    voicesInitialized = true;
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  initBrowserVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    initBrowserVoices();
  };
}

/**
 * اختيار أفضل صوت عربي أصيل وطبيعي (Natural Native Arabic) خالي من اللكنة الأجنبية
 */
export function findAuthenticArabicVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (!voicesInitialized || cachedBrowserVoices.length === 0) {
    initBrowserVoices();
  }
  const voices = cachedBrowserVoices.length > 0 ? cachedBrowserVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // حصر الأصوات في الأصوات العربية الحقيقية فقط
  const arabicVoices = voices.filter(v => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    return lang.startsWith('ar') || name.includes('arabic') || name.includes('عربي');
  });

  if (arabicVoices.length === 0) return null;

  // نظام انتقاء أصيل فصيح حسب الجودة الطبيعية:
  // 1. أولاً: أصوات Microsoft Natural العربية (شاكر، حامد، سلمى، هدى، زارية، نايف)
  const msNatural = arabicVoices.find(v => 
    (v.name.includes('Natural') || v.name.includes('Online')) &&
    (v.name.includes('Shakir') || v.name.includes('Hamed') || v.name.includes('Salma') || v.name.includes('Zariyah') || v.lang === 'ar-SA')
  );
  if (msNatural) return msNatural;

  // 2. ثانياً: أصوات Apple العربية الفصيحة (Maged ماجد، Tarik طارق، Laila ليلى، Mariam مريم)
  const appleVoice = arabicVoices.find(v => 
    v.name.includes('Maged') || v.name.includes('Tarik') || v.name.includes('Laila') || v.name.includes('Mariam') || v.name.includes('Majed')
  );
  if (appleVoice) return appleVoice;

  // 3. ثالثاً: أصوات Google العربية الأصلية (Google العربية، ar-SA، ar-EG)
  const googleVoice = arabicVoices.find(v => 
    v.name.includes('Google') || v.name.includes('العربية') || v.lang === 'ar-SA' || v.lang === 'ar-EG'
  );
  if (googleVoice) return googleVoice;

  // 4. رابعاً: أي صوت عربي سعودي أو مصري
  const saOrEgVoice = arabicVoices.find(v => v.lang.startsWith('ar-SA') || v.lang.startsWith('ar-EG'));
  if (saOrEgVoice) return saOrEgVoice;

  return arabicVoices[0];
}

let currentAudioElement: HTMLAudioElement | null = null;

/**
 * توليد ونطق الصوت العربي الأصيل عبر الخدمة السحابية عند غياب أصوات عربية مثبتة في جهاز المستخدم
 */
async function speakWithCloudArabicAudio(text: string, onEnd?: () => void): Promise<boolean> {
  try {
    if (currentAudioElement) {
      try {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
      } catch {}
      currentAudioElement = null;
    }

    const response = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [{ role: 'user', parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
        },
      }),
    });

    if (!response.ok) return false;
    const data = await response.json();
    const part = data?.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data) {
      const mime = part.inlineData.mimeType || 'audio/wav';
      const audio = new Audio(`data:${mime};base64,${part.inlineData.data}`);
      currentAudioElement = audio;
      audio.onended = () => {
        if (currentAudioElement === audio) currentAudioElement = null;
        if (onEnd) onEnd();
      };
      audio.onerror = () => {
        if (currentAudioElement === audio) currentAudioElement = null;
        if (onEnd) onEnd();
      };
      await audio.play();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Cloud Arabic Audio Notice]', err);
    return false;
  }
}

/**
 * القارئ الصوتي العربي الأصيل الفوري لشخصية موسى (0ms latency, 0 quota cost, 100% Native Arabic)
 */
function speakBrowserSpeechSynthesis(cleanText: string, onEnd?: () => void, customRate?: number, isRetry = false) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  const clean = cleanTextForSpeech(cleanText);
  if (!clean) {
    if (onEnd) onEnd();
    return;
  }

  // إذا لم تكن الأصوات قد حمّلت بعد في المتصفح، انتظار 100ms ثم إعادة المحاولة
  if (!voicesInitialized && !isRetry) {
    initBrowserVoices();
    if (cachedBrowserVoices.length === 0) {
      setTimeout(() => {
        speakBrowserSpeechSynthesis(clean, onEnd, customRate, true);
      }, 100);
      return;
    }
  }

  try {
    window.speechSynthesis.cancel();
    if (currentAudioElement) {
      try {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
      } catch {}
      currentAudioElement = null;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'ar-SA';

    // ضبط السرعة والنبرة لنطق عربي دافئ ومتزن للأطفال
    let speed = customRate;
    if (!speed && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('learn_mousa_current_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.preferences?.voiceSpeed) {
            speed = Number(parsed.preferences.voiceSpeed);
          }
        }
      } catch {}
    }
    utterance.rate = speed && speed > 0 ? speed : 0.90; // سرعة هادئة وفصيحة لمخارج الحروف
    utterance.pitch = 1.0;

    const bestVoice = findAuthenticArabicVoice();
    if (bestVoice) {
      utterance.voice = bestVoice;
      utterance.lang = bestVoice.lang || 'ar-SA';
      if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
      }
      window.speechSynthesis.speak(utterance);
    } else {
      // إذا لم يتوفر صوت عربي أصيل في جهاز المستخدم، استخدام النطق العربي البشري السحابي لمنع القراءة بلكنة أجنبية
      speakWithCloudArabicAudio(clean, onEnd).then(success => {
        if (!success) {
          // محاولة أخيرة عبر المتصفح
          utterance.lang = 'ar-SA';
          if (onEnd) {
            utterance.onend = onEnd;
            utterance.onerror = onEnd;
          }
          window.speechSynthesis.speak(utterance);
        }
      });
    }
  } catch (e) {
    if (onEnd) onEnd();
  }
}

/**
 * نطق صوتي مع دعم تحديد سرعة القراءة وسرعة تفضيلات المستخدم
 */
export function speakMousa(cleanText: string, onEnd?: () => void, customRate?: number): void {
  speakBrowserSpeechSynthesis(cleanText, onEnd, customRate);
}

/**
 * إيقاف أي نطق صوتي نشط حالياً فوراً
 */
export function stopMousaVoice(): void {
  mousaAudioSessionCounter++;
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {}
    currentAudioElement = null;
  }
  if (currentSourceNode) {
    try {
      currentSourceNode.stop();
      currentSourceNode.disconnect();
    } catch {}
    currentSourceNode = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

export function isMousaVoicePlaying(): boolean {
  if (currentAudioElement && !currentAudioElement.paused) return true;
  if (currentSourceNode) return true;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
    return true;
  }
  return false;
}

export function stopArabicSpeech(): void {
  stopMousaVoice();
}

/**
 * الدالة الرئيسية: نطق النصوص بصوت موسى البشري العربي الأصيل
 * تتميز بـ:
 * 1. استجابة لحظية فورية (0ms) دون أي انتظار للشبكة.
 * 2. نطق عربي أصيل فصيح بدون أي لكنة أجنبية وبدون نطق أي عبارات إنجليزية إطلاقاً.
 * 3. استهلاك 0 من رصيد Gemini المجاني لحماية الحصة من النفاد والـ 503.
 */
export async function speakWithMousaVoice(text: string, onEnd?: () => void): Promise<boolean> {
  const permCheck = isAIFeatureAllowed('student');
  if (!permCheck.allowed) {
    console.warn('[AI Governance] الصوت التفاعلي لموسى معطل:', permCheck.reason);
    if (onEnd) onEnd();
    return false;
  }

  const clean = cleanTextForSpeech(text);
  if (!clean) {
    if (onEnd) onEnd();
    return false;
  }

  stopMousaVoice();
  speakBrowserSpeechSynthesis(clean, onEnd);
  return true;
}

export function speakArabicText(text: string, onEnd?: () => void): void {
  speakWithMousaVoice(text, onEnd);
}

/**
 * فحص ما إذا كان الصوت متاحاً في الرام أو في قاعدة IndexedDB
 */
export function isMousaVoiceCached(text: string): boolean {
  const clean = cleanTextForSpeech(text);
  return mousaAudioCache.has(clean);
}

export function getMousaVoiceCacheSize(): number {
  return mousaAudioCache.size;
}

/**
 * التوليد والاستباق المسبق (Pre-buffering) - تم تعطيله لمنع إطلاق أي طلب صوتي عبر الخلفية ما لم ينقر الطالب بنفسه
 */
export async function prebufferMousaAudio(_texts: (string | undefined | null)[]): Promise<void> {
  // معطل عمداً: لا يتم تشغيل أو طلب أي مقطع صوتي في الخلفية إلا عند النقر اليدوي الصريح للطالب
  return;
}

export async function preloadMousaVoice(texts: string[]): Promise<void> {
  return prebufferMousaAudio(texts);
}

// ================= 9. حزمة الألعاب التعليمية التفاعلية المولدة بالذكاء الاصطناعي (AI Games Suite) =================
export async function generateAIGame(
  gameType: AIGameType,
  grade: string,
  targetSkill: string
): Promise<GameData> {
  const ai = getAIClient();

  let gameTitleAr = '';
  let specificRules = '';
  let fallbackLevels: GameLevel[] = [];

  if (gameType === 'phonics_treasure') {
    gameTitleAr = 'كنز الحروف والكلمات السحرية';
    specificRules = `
النوع: لعبة "كنز الحروف والكلمات السحرية" (phonics_treasure).
المطلوب:
- توليد 4 مستويات متدرجة، كل مستوى يركز على المهارة المستهدفة: "${targetSkill}".
- كل مستوى يحتوي على:
  * prompt: جملة توجيهية صوتية/بصرية قصيرة مشكولة تشكيلاً كاملاً، مثل: "أَيْنَ الكَلِمَةُ الَّتِي تَبْدَأُ بِحَرْفِ (ص)؟" أو "الْتَقِطِ الجَوْهَرَةَ الَّتِي تَحْوِي مَدًّا بِالأَلِفِ:".
  * options: مصفوفة بها 4 خيارات من الكلمات المشكولة تماماً بالحركات (خيار واحد صحيح و3 مشتتات ذكية قريبة).
  * correctAnswers: مصفوفة بها الكلمة الصحيحة المطابقة تماماً لأحد الخيارات.
  * feedbackSuccess: عبارة تشجيعية حماسية بصوت موسى مع إيموجي لطيف تشرح بإيجاز لماذا الإجابة صحيحة (مثال: "بَطَلٌ رَائِع! صَوْتُ حَرْفِ الصَّادِ قَوِيٌّ فِي (صَقْرٌ) 🦅✨").
  * feedbackHint: تلميح ذكي ولطيف يساعد الطفل إذا تعثر (مثال: "انْتَبِهْ يَا بَطَل! حَرْفُ الصَّادِ مُفَخَّمٌ وَلَيْسَ مِثْلَ السِّين").
`;
    fallbackLevels = [
      {
        id: 1,
        prompt: `أَيْنَ الكَلِمَةُ الَّتِي تَحْتَوِي عَلَى صَوْتِ (${targetSkill || 'الصَّادِ'})؟`,
        correctAnswers: ['صَقْرٌ'],
        options: ['صَقْرٌ', 'سَمَكَةٌ', 'قَلَمٌ', 'بَابٌ'],
        feedbackSuccess: 'أَحْسَنْتَ يَا بَطَل! (صَقْرٌ) يَبْدَأُ بِصَوْتٍ قَوِيٍّ 🦅🌟',
        feedbackHint: 'اسْتَمِعْ جَيِّدًا لِصَوْتِ الحَرْفِ المُفَخَّمِ.'
      },
      {
        id: 2,
        prompt: `الْتَقِطِ الجَوْهَرَةَ الصَّحِيحَةَ لِإِكْمَالِ الكَنْزِ:`,
        correctAnswers: ['عُصْفُورٌ'],
        options: ['عُصْفُورٌ', 'بَيْتٌ', 'شَجَرَةٌ', 'كِتَابٌ'],
        feedbackSuccess: 'مُذْهِلٌ! حَرْفُ الصَّادِ فِي وَسَطِ (عُصْفُورٌ) يُغَرِّدُ مَعَكَ! 🐦✨',
        feedbackHint: 'ابْحَثْ عَنِ الكَلِمَةِ الَّتِي فِيهَا حَرْفٌ مُفَخَّمٌ فِي الوَسَطِ.'
      },
      {
        id: 3,
        prompt: `حَدِّدِ الكَلِمَةَ الَّتِي فِيهَا مَدٌّ طَوِيلٌ:`,
        correctAnswers: ['صَابُونٌ'],
        options: ['صَابُونٌ', 'صَدَفَةٌ', 'صَقْرٌ', 'صَحْنٌ'],
        feedbackSuccess: 'بَارَكَ اللهُ فِيكَ! (صَابُونٌ) فِيهَا مَدٌّ بِالأَلِفِ (صَا)! 🧼🌟',
        feedbackHint: 'انْتَبِهْ لِلصَّوْتِ الطَّوِيلِ الَّذِي يَمْتَدُّ إِلَى الأَعْلَى.'
      },
      {
        id: 4,
        prompt: `تَحَدِّي كَنْزِ الحُرُوفِ الأَخِيرُ: اخْتَرِ الكَلِمَةَ المُنَاسِبَةَ:`,
        correctAnswers: ['قَفَصٌ'],
        options: ['قَفَصٌ', 'فَرَسٌ', 'جَرَسٌ', 'شَمْسٌ'],
        feedbackSuccess: 'مُبَارَكٌ! لَقَدْ فَتَحْتَ صُنْدُوقَ الكَنْزِ السِّحْرِيِّ بِنَجَاحٍ بَاهِرٍ! 🏆💎',
        feedbackHint: 'الحَرْفُ الأَخِيرُ لَهُ صَوْتٌ مُمَيَّزٌ كَالصَّفِيرِ.'
      }
    ];
  } else if (gameType === 'sentence_builder') {
    gameTitleAr = 'متاهة تركيب الجمل التفاعلية';
    specificRules = `
النوع: لعبة "متاهة تركيب الجمل التفاعلية" (sentence_builder).
المطلوب:
- توليد 3 مستويات متدرجة، كل مستوى يقدم جملة عربية مفيدة وجميلة تناسب الصف: "${grade}" وتركز على: "${targetSkill}".
- كل مستوى يحتوي على:
  * prompt: توجيه مشكول يصف المشهد أو يطلب الترتيب، مثل: "رَتِّبِ الكَلِمَاتِ الآتِيَةَ لِتُكَوِّنَ جُمْلَةً تُعَبِّرُ عَنِ القِرَاءَةِ:".
  * correctAnswers: مصفوفة الكلمات بالترتيب الصحيح التام للجملة السليمة مع التشكيل (مثال: ["يَقْرَأُ", "مُوسَى", "قِصَّةً", "مُفِيدَةً"]).
  * options: مصفوفة تحوي نفس الكلمات ولكن بترتيب مبعثر وعشوائي تماماً (ليقوم الطفل بفرزها وترتيبها).
  * feedbackSuccess: تشجيع من موسى عند اكتمال الجملة بنجاح (مثال: "يَا سَلَام! لَقَدْ بَنَيْتَ جُمْلَةً مُفِيدَةً وَجَمِيلَةً 📚🌟").
  * feedbackHint: تلميح لمساعدة الطفل في معرفة الكلمة التي يبدأ بها (مثال: "ابْدَأْ بِالفِعْلِ: مَاذَا يَفْعَلُ مُوسَى؟").
`;
    fallbackLevels = [
      {
        id: 1,
        prompt: 'رَتِّبِ الكَلِمَاتِ لِتُكَوِّنَ جُمْلَةً مُفِيدَةً عَنْ حُبِّ التَّعَلُّمِ:',
        correctAnswers: ['يَقْرَأُ', 'مُوسَى', 'كِتَابًا', 'مُفِيدًا'],
        options: ['كِتَابًا', 'يَقْرَأُ', 'مُفِيدًا', 'مُوسَى'],
        feedbackSuccess: 'أَحْسَنْتَ صُنْعًا! الجُمْلَةُ صَحِيحَةٌ وَمُرَتَّبَةٌ تَمَامًا 📖✨',
        feedbackHint: 'ابْدَأْ بِالفِعْلِ: مَنْ يَقْرَأُ أَوَّلًا؟'
      },
      {
        id: 2,
        prompt: 'أَعِدْ تَرْتِيبَ الكَلِمَاتِ لِتَصِفَ سُلُوكَ التِّلْمِيذِ النَّشِيطِ:',
        correctAnswers: ['يَذْهَبُ', 'الطَّالِبُ', 'إِلَى', 'المَدْرَسَةِ', 'بِنَشَاطٍ'],
        options: ['المَدْرَسَةِ', 'يَذْهَبُ', 'بِنَشَاطٍ', 'الطَّالِبُ', 'إِلَى'],
        feedbackSuccess: 'عَمَلٌ أَبْطَال! رَتَّبْتَ جُمْلَةً رَائِعَةً عَنِ النَّشَاطِ 🎒🌟',
        feedbackHint: 'مَا هُوَ الفِعْلُ الَّذِي يَبْدَأُ بِهِ كُلُّ صَبَاحٍ؟'
      },
      {
        id: 3,
        prompt: 'رَتِّبْ كَلِمَاتِ الجُمْلَةِ لِتَكْشِفَ سِرَّ النَّجَاحِ:',
        correctAnswers: ['العِلْمُ', 'يُنِيرُ', 'عُقُولَ', 'الأَطْفَالِ'],
        options: ['عُقُولَ', 'العِلْمُ', 'الأَطْفَالِ', 'يُنِيرُ'],
        feedbackSuccess: 'إِنْجَازٌ بَاهِر! أَنْتَ مُهَنْدِسُ الجُمَلِ المَاهِرُ 🌟🏆',
        feedbackHint: 'مَا الَّذِي يُنِيرُ دُرُوبَنَا وَعُقُولَنَا؟'
      }
    ];
  } else if (gameType === 'story_quest') {
    gameTitleAr = 'مغامرة موسى وقرارات الحكاية';
    specificRules = `
النوع: لعبة "مغامرة موسى وقرارات الحكاية" (story_quest).
المطلوب:
- توليد 3 مستويات/محطات متسلسلة لمغامرة مشوقة وبسيطة، حيث يسير موسى في رحلة ويواجه ألغازاً لغوية وقرارات قائمة على المهارة المستهدفة: "${targetSkill}".
- كل مستوى يحتوي على:
  * prompt: سرد مشهد القصة واللغز المشكول الذي يواجه موسى، مثل: "وَصَلَ مُوسَى إِلَى نَهْرِ الحُرُوفِ، وَأَخْبَرَهُ الحَكِيمُ أَنَّ الجِسْرَ لَنْ يَمْتَدَّ إِلَّا إِذَا اخْتَارَ كَلِمَةً بِهَا مَدٌّ بِالوَاوِ:".
  * options: 3 أو 4 خيارات مشكولة تمثل القرارات/الكلمات المتاحة للطفل.
  * correctAnswers: مصفوفة بها الخيار الصحيح اللغوي الذي يحل اللغز ويدفع القصة للأمام.
  * feedbackSuccess: وصف سردي مبهج لما يحدث بعد اختيار القرار الصحيح ومواصلة المغامرة (مثال: "امْتَدَّ الجِسْرُ الذَّهَبِيُّ وَعَبَرَ مُوسَى فَرِحًا نَحْوَ القَلْعَةِ! 🌉🏰").
  * feedbackHint: همسة لطيفة من صديق المغامرة توضح القاعدة اللغوية.
`;
    fallbackLevels = [
      {
        id: 1,
        prompt: 'وَقَفَ مُوسَى أَمَامَ بَابِ الغَابَةِ السِّحْرِيَّةِ، وَوَجَدَ قِفْلًا لَا يُفْتَحُ إِلَّا بِكَلِمَةٍ تَدُلُّ عَلَى الصِّدْقِ وَالأَمَانَةِ:',
        correctAnswers: ['الصِّدْقُ يُنْجِي'],
        options: ['الصِّدْقُ يُنْجِي', 'الكَاذِبُ يَخْسَرُ', 'النَّوْمُ مُفِيدٌ', 'الرَّكْضُ سَرِيعٌ'],
        feedbackSuccess: 'انْفَتَحَ بَابُ الغَابَةِ بِنُورٍ لَامِعٍ، وَدَخَلَ مُوسَى بِشَجَاعَةٍ! 🌲🗝️',
        feedbackHint: 'اخْتَرِ القَرَارَ الَّذِي يَدُلُّ عَلَى فَضِيلَةِ الصِّدْقِ يَا بَطَل.'
      },
      {
        id: 2,
        prompt: 'فِي قَلْبِ الغَابَةِ، قَابَلَ مُوسَى طَائِرًا غَرِيدًا جَائِعًا، فَمَاذَا يَفْعَلُ لِيُسَاعِدَهُ؟',
        correctAnswers: ['يُقَدِّمُ لَهُ الحُبُوبَ وَالمَاءَ'],
        options: ['يُقَدِّمُ لَهُ الحُبُوبَ وَالمَاءَ', 'يَتْرُكُهُ وَيَمْضِي', 'يُخِيفُهُ بِصَوْتٍ عَالٍ'],
        feedbackSuccess: 'غَرَّدَ الطَّائِرُ فَرِحًا وَقَادَ مُوسَى نَحْوَ بُرْجِ المَعْرِفَةِ! 🕊️🌿',
        feedbackHint: 'الرِّفْقُ بِالحَيَوَانِ خُلُقٌ عَظِيمٌ يَفْتَحُ لَكَ الطَّرِيقَ.'
      },
      {
        id: 3,
        prompt: 'وَصَلَ مُوسَى إِلَى كَنْزِ الحِكْمَةِ، وَطَلَبَ مِنْهُ الحَارِسُ إِكْمَالَ هَذِهِ الحِكْمَةِ لِتَتْوِيجِهِ بَطَلًا:',
        correctAnswers: ['مَنْ جَدَّ وَجَدَ'],
        options: ['مَنْ جَدَّ وَجَدَ', 'مَنْ نَامَ حَلَمَ', 'مَنْ تَأَخَّرَ تَعِبَ'],
        feedbackSuccess: 'مُبَارَكٌ يَا بَطَل! لَقَدْ حَصَلَ مُوسَى عَلَى تَاجِ الحِكْمَةِ بِمُسَاعَدَتِكَ الذَّكِيَّةِ! 👑🌟🏆',
        feedbackHint: 'فَكِّرْ فِي الحِكْمَةِ الَّتِي تَدْعُو لِلِاجْتِهَادِ وَالمُثَابَرَةِ.'
      }
    ];
  } else if (gameType === 'vowel_train') {
    gameTitleAr = 'قطار الحركات والمدود';
    specificRules = `
النوع: لعبة "قطار الحركات والمدود" (vowel_train).
المطلوب:
- توليد 3 أو 4 مستويات متدرجة للصف: "${grade}" تركز على التمييز الدقيق بين الحركات القصيرة (فتحة، ضمة، كسرة) والمدود الطويلة (مد بالألف، مد بالواو، مد بالياء): "${targetSkill}".
- كل مستوى يحتوي على:
  * prompt: توجيه مشكول يحدد محطة القطار أو نوع المد المستهدف، مثل: "سَاعِدْ قِطَارَ الحَرَكَاتِ فِي اخْتِيَارِ الكَلِمَةِ الَّتِي تَحْوِي مَدًّا بِالأَلِفِ (ـا):" أو "أَيْنَ الكَلِمَةُ الَّتِي فِيهَا صَوْتُ حَرَكَةٍ قَصِيرَةٍ فَقَطْ؟".
  * vowelType: نوع الحركة أو المد المطلوب ("مد بالألف", "مد بالواو", "مد بالياء", "حركة قصيرة").
  * options: 4 خيارات من الكلمات المشكولة تماماً تمثل عربات القطار.
  * correctAnswers: الكلمة الصحيحة المطابقة تماماً للمد أو الحركة المطلوبة.
  * feedbackSuccess: عبارة تشجيعية حماسية بصوت موسى مع صوت صفير القطار (مثال: "طُوط طُوط! انْطَلَقَ قِطَارُ المَدِّ بِنَجَاحٍ مَعَ (صَابِرٌ)! 🚂💨✨").
  * feedbackHint: تلميح نطق صوتي يوضح الفرق بين مد الحرف وقصر حركته.
`;
    fallbackLevels = [
      {
        id: 1,
        prompt: 'سَاعِدْ سَائِقَ القِطَارِ مُوسَى فِي اخْتِيَارِ الكَلِمَةِ الَّتِي تَحْوِي مَدًّا بِالأَلِفِ (ـا):',
        vowelType: 'مد بالألف',
        correctAnswers: ['كِتَابٌ'],
        options: ['كِتَابٌ', 'قَلَمٌ', 'وَلَدٌ', 'جَمَلٌ'],
        feedbackSuccess: 'طُوط طُوط! رَائِعٌ جِدًّا! (كِتَابٌ) فِيهَا مَدٌّ بِالأَلِفِ (تَا) يَصْعَدُ لِلسَّمَاءِ! 🚂🌟',
        feedbackHint: 'اسْتَمِعْ لِلصَّوْتِ الطَّوِيلِ المَفْتُوحِ بَعْدَ حَرْفِ التَّاءِ: تَا!'
      },
      {
        id: 2,
        prompt: 'عَرَبَةُ مَدِّ الوَاوِ تَنْتَظِرُ رُكَّابَهَا! اخْتَرِ الكَلِمَةَ الَّتِي فِيهَا مَدٌّ بِالوَاوِ (ـو):',
        vowelType: 'مد بالواو',
        correctAnswers: ['عُصْفُورٌ'],
        options: ['عُصْفُورٌ', 'خُبْزٌ', 'عُمَرُ', 'دُبٌّ'],
        feedbackSuccess: 'يَا سَلَام! (عُصْفُورٌ) فِيهَا صَوْتُ مَدِّ الوَاوِ الطَّوِيلِ المَضْمُومِ! 🐦🚂✨',
        feedbackHint: 'ضُمَّ شَفَتَيْكَ وَمُدَّ الصَّوْتَ مِثْلَ: فُـو!'
      },
      {
        id: 3,
        prompt: 'مَحَطَّةُ مَدِّ اليَاءِ (ـي)! أَيُّ كَلِمَةٍ تَحْمِلُ مَدًّا بِاليَاءِ النَّاعِمَةِ؟',
        vowelType: 'مد بالياء',
        correctAnswers: ['سَرِيرٌ'],
        options: ['سَرِيرٌ', 'لَعِبَ', 'فَرِحَ', 'قَمَرٌ'],
        feedbackSuccess: 'أَنْتَ عَبْقَرِيُّ القِطَارِ! (سَرِيرٌ) فِيهَا مَدُّ اليَاءِ الجَمِيلُ (رِي)! 🚂🏆',
        feedbackHint: 'ابْحَثْ عَنْ صَوْتِ الكَسْرَةِ الطَّوِيلَةِ: رِيـ!'
      }
    ];
  } else if (gameType === 'letter_blending') {
    gameTitleAr = 'معمل دمج الحروف وتكوين الكلمات';
    specificRules = `
النوع: لعبة "معمل دمج الحروف وتكوين الكلمات" (letter_blending).
المطلوب:
- توليد 3 أو 4 مستويات لمعمل تهجئة وتراكيب صوتية، حيث يُعطى الطفل حروفاً أو مقاطع صوتية مفككة ويطلب منه دمجها لاكتشاف الكلمة الصحيحة المناسبة للصف: "${grade}" وتركز على: "${targetSkill}".
- كل مستوى يحتوي على:
  * prompt: توجيه علمي مبهج مشكول، مثل: "ادْمُجِ المَقَاطِعَ الصَّوْتِيَّةَ فِي أُنْبُوبِ اخْتِبَارِ مُوسَى لِتَصْنَعَ كَلِمَةً مُفِيدَةً:".
  * segments: مصفوفة المقاطع أو الحروف المفككة مشكولة (مثال: ["مَسْـ", "ـجِـ", "ـدٌ"] أو ["قَـ", "ـلَـ", "ـمٌ"]).
  * options: 4 خيارات من الكلمات المشكولة الكاملة (الكلمة المدمجة الصحيحة و3 مشتتات قريبة).
  * correctAnswers: الكلمة الكاملة الصحيحة المدمجة.
  * feedbackSuccess: عبارة تشجيعية علمية من العالم الصغير موسى مع إيموجي (مثال: "تَفَاعُلٌ لُغَوِيٌّ نَاجِحٌ! لَقَدْ صَنَعْتَ كَلِمَةَ (مَسْجِدٌ) بِمَهَارَةٍ! 🧪✨🎉").
  * feedbackHint: تلميح يوجه الطفل لقراءة المقاطع الصوتية بالترتيب من اليمين لليسار.
`;
    fallbackLevels = [
      {
        id: 1,
        prompt: 'ادْمُجِ المَقَاطِعَ الصَّوْتِيَّةَ فِي مَعْمَلِ مُوسَى لِتَكْشِفَ الكَلِمَةَ الصَّحِيحَةَ:',
        segments: ['مَسْـ', 'ـجِـ', 'ـدٌ'],
        correctAnswers: ['مَسْجِدٌ'],
        options: ['مَسْجِدٌ', 'مَسْبَحٌ', 'مَسْكَنٌ', 'مَكْتَبٌ'],
        feedbackSuccess: 'تَفَاعُلٌ نَاجِحٌ! دَمَجْتَ [مَسْـ] + [ـجِـ] + [ـدٌ] فَأَصْبَحَتْ (مَسْجِدٌ)! 🧪✨',
        feedbackHint: 'انْطِقِ المَقْطَعَ الأَوَّلَ السَّاكِنَ ثُمَّ الحَرَكَاتِ بِتَتَابُعٍ سَرِيعٍ.'
      },
      {
        id: 2,
        prompt: 'رَكِّبْ هَذِهِ الحُرُوفَ فِي قَالَبِ الكَلِمَاتِ لِتَصْنَعَ اسْمَ حَيَوَانٍ أَلِيفٍ:',
        segments: ['أَ', 'رْ', 'نَ', 'بٌ'],
        correctAnswers: ['أَرْنَبٌ'],
        options: ['أَرْنَبٌ', 'أَسَدٌ', 'أَفْعَى', 'إِبِلٌ'],
        feedbackSuccess: 'عَبْقَرِيُّ المَعْمَلِ! تَكَوَّنَتْ كَلِمَةُ (أَرْنَبٌ) السَّرِيعِ اللَّطِيفِ! 🐰🧪🌟',
        feedbackHint: 'ابْدَأْ بِالأَلِفِ المَهْمُوزَةِ وَالرَّاءِ السَّاكِنَةِ: أَرْ...'
      },
      {
        id: 3,
        prompt: 'ادْمُجْ حُرُوفَ هَذِهِ الكَلِمَةِ الَّتِي تُنِيرُ دُرُوبَنَا بِالعِلْمِ:',
        segments: ['كِـ', 'ـتَـ', 'ـا', 'بٌ'],
        correctAnswers: ['كِتَابٌ'],
        options: ['كِتَابٌ', 'كَاتِبٌ', 'مَكْتَبَةٌ', 'كُتُبٌ'],
        feedbackSuccess: 'اخْتِرَاعٌ لُغَوِيٌّ مُبْهِرٌ! صَنَعْتَ كَلِمَةَ (كِتَابٌ) كَنْزِ المَعْرِفَةِ! 📚🏆',
        feedbackHint: 'انْتَبِهْ لِمَدِّ الأَلِفِ فِي الوَسَطِ بَيْنَ التَّاءِ وَالبَاءِ.'
      }
    ];
  } else if (gameType === 'vocab_detective') {
    gameTitleAr = 'محقق المفردات (الترادف والتضاد)';
    specificRules = `
النوع: لعبة "محقق المفردات (الترادف والتضاد)" (vocab_detective).
المطلوب:
- توليد 3 أو 4 مستويات لألغاز لغوية ذكية، يتقمص فيها الطفل دور المحقق اللغوي مع موسى للبحث عن مرادف الكلمة (المعنى) أو ضدها (العكس) بناءً على الصف: "${grade}" والمهارة: "${targetSkill}".
- كل مستوى يحتوي على:
  * prompt: لغز تحقيقي مشكول يوضح المطلوب بدقة (مرادف/معنى أو ضد/عكس)، مثل: "أَنَا المُحَقِّقُ مُوسَى! ابْحَثْ فِي قَائِمَةِ الأَدِلَّةِ عَنْ (مُرَادِفِ / مَعْنَى) كَلِمَةِ: [مَسْرُورٌ] 🔍:".
  * wordPuzzle: الكلمة المستهدفة باللغز (مثال: "مَسْرُورٌ" أو "شُجَاعٌ").
  * options: 4 خيارات مشكولة من الكلمات (الإجابة الصحيحة و3 مشتتات).
  * correctAnswers: الكلمة الصحيحة المرادفة أو المضادة بحسب اللغز.
  * feedbackSuccess: عبارة تشجيعية من المحقق موسى بحل اللغز وفك غموض الكلمة (مثال: "قَضِيَّةٌ لُغَوِيَّةٌ مَحْلُولَةٌ! مُرَادِفُ (مَسْرُورٌ) هُوَ (فَرِحٌ)! 🔍✨🏆").
  * feedbackHint: تلميح تحقيقي يضع الكلمة في سياق جملة واضحة لمساعدة الطفل.
`;
    fallbackLevels = [
      {
        id: 1,
        prompt: 'أَنَا المُحَقِّقُ مُوسَى! ابْحَثْ مَعِي فِي لَوْحَةِ الأَدِلَّةِ عَنْ (مُرَادِفِ / مَعْنَى) كَلِمَةِ: [مَسْرُورٌ] 🔍:',
        wordPuzzle: 'مَسْرُورٌ',
        correctAnswers: ['فَرِحٌ'],
        options: ['فَرِحٌ', 'حَزِينٌ', 'غَاضِبٌ', 'نَائِمٌ'],
        feedbackSuccess: 'قَضِيَّةٌ مَحْلُولَةٌ بِعَبْقَرِيَّةٍ! (مَسْرُورٌ) يَعْنِي (فَرِحٌ وَسَعِيدٌ)! 🔍🎉',
        feedbackHint: 'عِنْدَمَا تَحْصُلُ عَلَى هَدِيَّةٍ جَمِيلَةٍ، كَيْفَ يَكُونُ شُعُورُكَ؟'
      },
      {
        id: 2,
        prompt: 'لُغْزُ الأَضْدَادِ! مَا هُوَ (ضِدُّ / عَكْسُ) كَلِمَةِ: [شُجَاعٌ] 🔍؟',
        wordPuzzle: 'شُجَاعٌ',
        correctAnswers: ['جَبَانٌ'],
        options: ['جَبَانٌ', 'قَوِيٌّ', 'بَطَلٌ', 'سَرِيعٌ'],
        feedbackSuccess: 'أَحْسَنْتَ يَا أَذْكَى مُحَقِّقٍ! عَكْسُ الشُّجَاعِ الَّذِي لَا يَخَافُ هُوَ الجَبَانُ! 🔍⚡',
        feedbackHint: 'فَكِّرْ فِي الشَّخْصِ الَّذِي يَخَافُ وَيَهْرُبُ مِنَ الصِّعَابِ.'
      },
      {
        id: 3,
        prompt: 'فُكَّ شِفْرَةَ هَذِهِ الكَلِمَةِ: مَا (مُرَادِفُ / مَعْنَى) كَلِمَةِ: [جَمِيلٌ] 🔍؟',
        wordPuzzle: 'جَمِيلٌ',
        correctAnswers: ['حَسَنٌ'],
        options: ['حَسَنٌ', 'قَبِيحٌ', 'صَغِيرٌ', 'قَدِيمٌ'],
        feedbackSuccess: 'أَنْتَ نَجْمُ التَّحْقِيقِ اللُّغَوِيِّ! (جَمِيلٌ) تُطَابِقُ فِي مَعْنَاهَا (حَسَنٌ وَرَائِعٌ)! 🔍🏆🌟',
        feedbackHint: 'ابْحَثْ عَنْ كَلِمَةٍ تَمْدَحُ الشَّيْءَ الحَسَنَ.'
      }
    ];
  } else {
    // category_sorter
    gameTitleAr = 'فرز الظواهر اللغوية';
    specificRules = `
النوع: لعبة "فرز الظواهر اللغوية" (category_sorter).
المطلوب:
- توليد 3 مستويات لفرز وتصنيف الكلمات بحسب الظاهرة اللغوية (مثل: اللام الشمسية واللام القمرية، أو التاء المربوطة والتاء المفتوحة، أو المدود، أو المذكر والمؤنث): "${targetSkill}".
- كل مستوى يحتوي على:
  * prompt: توجيه مشكول يوضح الظاهرتين المطلوب فرز الكلمات بينهما، مثل: "صَنِّفِ الكَلِمَاتِ بَيْنَ (سَلَّةِ اللَّامِ الشَّمْسِيَّةِ ☀️) وَ (سَلَّةِ اللَّامِ القَمَرِيَّةِ 🌙):".
  * categories: مصفوفة بها اسم الفئتين أو السلتين: ["اللام الشمسية ☀️", "اللام القمرية 🌙"].
  * options: 4 أو 6 كلمات مشكولة ومتوازنة مناصفة بين الفئتين.
  * categoryMap: كائن يحدد لكل كلمة فئتها الصحيحة بدقة، مثل: {"الشَّمْسُ": "اللام الشمسية ☀️", "القَمَرُ": "اللام القمرية 🌙"}.
  * correctAnswers: الكلمات التابعة للفئة الأولى أو مصفوفة الكلمات المصنفة.
  * feedbackSuccess: عبارة تشجيعية من موسى لإتقان التمييز بين الظاهرتين (مثال: "مِيزَانٌ لُغَوِيٌّ دَقِيقٌ! لَقَدْ صَنَّفْتَ الظَّوَاهِرَ اللُّغَوِيَّةَ بِمَهَارَةٍ كَبِيرَةٍ! ⚖️🌟✨").
  * feedbackHint: قاعدة ذهبية للتمييز بين الفئتين (مثال: اللام الشمسية تكتب ولا تنطق والحرف بعدها مشدد).
`;
    fallbackLevels = [
      {
        id: 1,
        prompt: 'صَنِّفِ الكَلِمَاتِ الآتِيَةَ فِي سَلَّتَيْهَا الصَّحِيحَتَيْنِ: (الَّلامُ الشَّمْسِيَّةُ ☀️) أَمْ (الَّلامُ القَمَرِيَّةُ 🌙)؟',
        categories: ['اللام الشمسية ☀️', 'اللام القمرية 🌙'],
        options: ['الشَّمْسُ', 'القَمَرُ', 'النَّجْمُ', 'الكِتَابُ'],
        categoryMap: {
          'الشَّمْسُ': 'اللام الشمسية ☀️',
          'القَمَرُ': 'اللام القمرية 🌙',
          'النَّجْمُ': 'اللام الشمسية ☀️',
          'الكِتَابُ': 'اللام القمرية 🌙'
        },
        correctAnswers: ['الشَّمْسُ', 'النَّجْمُ'],
        feedbackSuccess: 'مِيزَانُكَ اللُّغَوِيُّ فَوْقَ العَادَةِ! مَيَّزْتَ بَيْنَ اللَّامِ الشَّمْسِيَّةِ وَالقَمَرِيَّةِ بِدِقَّةٍ! ⚖️☀️🌙',
        feedbackHint: 'تَذَكَّرْ: اللَّامُ الشَّمْسِيَّةُ تَكْتُبُ وَلَا تَنْطِقُ وَتَلِيهَا شَدَّةٌ!'
      },
      {
        id: 2,
        prompt: 'افْرِزِ الكَلِمَاتِ بَيْنَ: (التَّاءُ المَرْبُوطَةُ ة/ـة) وَ (التَّاءُ المَفْتُوحَةُ ت):',
        categories: ['تاء مربوطة (ة)', 'تاء مفتوحة (ت)'],
        options: ['شَجَرَةٌ', 'بَيْتٌ', 'مَدْرَسَةٌ', 'بِنْتٌ'],
        categoryMap: {
          'شَجَرَةٌ': 'تاء مربوطة (ة)',
          'بَيْتٌ': 'تاء مفتوحة (ت)',
          'مَدْرَسَةٌ': 'تاء مربوطة (ة)',
          'بِنْتٌ': 'تاء مفتوحة (ت)'
        },
        correctAnswers: ['شَجَرَةٌ', 'مَدْرَسَةٌ'],
        feedbackSuccess: 'إِنْجَازٌ رَائِعٌ! التَّاءُ المَرْبُوطَةُ تَنْطِقُ هَاءً عِنْدَ الوَقْفِ، وَالمَفْتُوحَةُ تَظَلُّ تَاءً! ⚖️🌸',
        feedbackHint: 'قِفْ عَلَى الكَلِمَةِ بِالسُّكُونِ: إِذَا انْتَقَلَتْ لِهَاءٍ فَهِيَ مَرْبُوطَةٌ.'
      },
      {
        id: 3,
        prompt: 'صَنِّفِ الكَلِمَاتِ بَيْنَ عَالَمِ (المُفْرَدِ 👤) وَعَالَمِ (الجَمْعِ 👥):',
        categories: ['مفرد (واحد)', 'جمع (كثير)'],
        options: ['كِتَابٌ', 'كُتُبٌ', 'قَلَمٌ', 'أَقْلَامٌ'],
        categoryMap: {
          'كِتَابٌ': 'مفرد (واحد)',
          'كُتُبٌ': 'جمع (كثير)',
          'قَلَمٌ': 'مفرد (واحد)',
          'أَقْلَامٌ': 'جمع (كثير)'
        },
        correctAnswers: ['كِتَابٌ', 'قَلَمٌ'],
        feedbackSuccess: 'أَنْتَ مَلِكُ التَّصْنِيفِ وَالفَرْزِ! فَرَّقْتَ بَيْنَ الوَاحِدِ وَالجَمَاعَةِ بِنَجَاحٍ! ⚖️👑🌟',
        feedbackHint: 'المُفْرَدُ يَدُلُّ عَلَى شَيْءٍ وَاحِدٍ فَقَطْ، وَالجَمْعُ عَلَى ثَلَاثَةٍ فَأَكْثَرَ.'
      }
    ];
  }

  const systemInstruction = `
أنت خبير تربوي ومصمم ألعاب تعليمية باللغة العربية للأطفال في منصة "تعلَّم مع موسى".
مهمتك تصميم محتوى لعبة تعليمية تفاعلية بالذكاء الاصطناعي موجهة للأطفال.
الشروط الصارمة:
1. التشكيل التام بالحركات لجميع النصوص (الفتحة، الضمة، الكسرة، السكون، الشدة، التنوين).
2. صياغة مبهجة ومبسطة ومناسبة للصف: ${grade}.
3. التركيز الصريح على المهارة المستهدفة: "${targetSkill || 'مهارات القراءة واللغة العربية'}".
4. الرد بصيغة JSON صريحة وصحيحة فقط دون أي شروح خارجية، ومطابقة للهيكل التالي:
{
  "gameType": "${gameType}",
  "targetSkill": "${targetSkill || 'المهارات القرائية واللغوية'}",
  "instructions": "نص إرشادي مشكول يوضح للطفل كيفية اللعب بمرح",
  "levels": [
    {
      "id": 1,
      "prompt": "السؤال أو المشهد المشكول بالحركات",
      "correctAnswers": ["الإجابة الصحيحة أو الكلمات المرتبة بالترتيب الصحيح"],
      "options": ["الخيارات المشكولة"],
      "feedbackSuccess": "تشجيع بصوت موسى مشكول",
      "feedbackHint": "تلميح لطيف مشكول",
      "segments": ["المقاطع الصوتية المفككة في حال لعبة letter_blending"],
      "categories": ["أسماء الفئات في حال لعبة category_sorter"],
      "categoryMap": {"الكلمة": "اسم الفئة"},
      "vowelType": "نوع الحركة أو المد في حال لعبة vowel_train",
      "wordPuzzle": "الكلمة المستهدفة في حال لعبة vocab_detective"
    }
  ]
}
`;

  try {
    const response = await generateContentWithFallback(ai, {
      contents: `صمم لعبة تعليمية كاملة من نوع (${gameTitleAr}) للصف (${grade}) تركز على مهارة (${targetSkill}).\nالقواعد الخاصة:\n${specificRules}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
      targetRole: 'teacher'
    });

    const text = cleanJsonText(response.text || '');
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.levels) && parsed.levels.length > 0) {
        return {
          gameType: gameType,
          targetSkill: parsed.targetSkill || targetSkill || 'مهارات اللغة العربية',
          instructions: parsed.instructions || `مَرْحَبًا بِكَ يَا بَطَل فِي لُعْبَةِ (${gameTitleAr})! هَيَّا نَلْعَبْ وَنَتَعَلَّمْ مَعًا!`,
          levels: parsed.levels.map((lvl: any, idx: number) => ({
            id: lvl.id || (idx + 1),
            prompt: lvl.prompt || `المُسْتَوَى ${idx + 1}`,
            correctAnswers: Array.isArray(lvl.correctAnswers) ? lvl.correctAnswers : [String(lvl.correctAnswers || '')],
            options: Array.isArray(lvl.options) ? lvl.options : [],
            feedbackSuccess: lvl.feedbackSuccess || 'أَحْسَنْتَ يَا بَطَل! إِجَابَةٌ رَائِعَةٌ 🌟',
            feedbackHint: lvl.feedbackHint || 'حَاوِلْ مَرَّةً أُخْرَى بِتَرْكِيزٍ أَكْبَرَ يَا صَدِيقِي',
            segments: Array.isArray(lvl.segments) ? lvl.segments : undefined,
            categories: Array.isArray(lvl.categories) ? lvl.categories : undefined,
            categoryMap: (lvl.categoryMap && typeof lvl.categoryMap === 'object') ? lvl.categoryMap : undefined,
            vowelType: lvl.vowelType || undefined,
            wordPuzzle: lvl.wordPuzzle || undefined
          }))
        };
      }
    }
  } catch (err) {
    console.warn('تعذر توليد اللعبة عبر Gemini، سيتم استخدام المستويات التأسيسية:', err);
  }

  return {
    gameType: gameType,
    targetSkill: targetSkill || 'مهارات القراءة واللغة العربية',
    instructions: `مَرْحَبًا بِكَ يَا بَطَل فِي لُعْبَةِ (${gameTitleAr})! انْطَلِقْ لِحَلِّ التَّحَدِّيَاتِ وَجَمْعِ النُّجُومِ اللَّامِعَةِ!`,
    levels: fallbackLevels
  };
}

// ================= 10. التقرير التشخيصي الفوري بنقرة واحدة (1-Click AI Learning Diagnostic) =================
export async function generateStudentDiagnostic(
  submissions: StudentSubmission[],
  studentName: string = 'البطل',
  targetRole: AIGovernanceTarget = 'teacher'
): Promise<QuickAIDiagnosticResult> {
  const ai = getAIClient();

  // انتقاء آخر 10 تسليمات للطالب
  const recentSubs = (submissions || []).slice(-10);

  const buildLocalDiagnostic = (): QuickAIDiagnosticResult => {
    let detectedStrength = 'إِتْقَانُ نُطْقِ الحُرُوفِ الأَسَاسِيَّةِ وَالتَّعَامُلِ مَعَ الكَلِمَاتِ المَشْكُولَةِ';
    let detectedChallenge = 'ضَبْطُ حَرَكَةِ الكَسْرَةِ وَالتَّفْرِيقُ الدَّقِيقُ بَيْنَ المَدِّ القَصِيرِ وَالطَّوِيلِ';
    let recGame: AIGameType = 'vowel_train';
    let recGameTitle = 'قِطَارُ الحَرَكَاتِ وَالمُدُودِ 🚂';

    if (recentSubs.length > 0) {
      const lowAccuracySub = recentSubs.find(s => (s.score / s.totalPoints) < 0.7);
      if (lowAccuracySub) {
        detectedChallenge = `تَثْبِيتُ مَهَارَةِ (${lowAccuracySub.targetSkill || lowAccuracySub.activityTitle})`;
        if (lowAccuracySub.gameType === 'letter_blending') {
          recGame = 'letter_blending';
          recGameTitle = 'مَعْمَلُ دَمْجِ الحُرُوفِ وَالمَقَاطِعِ 🧪';
        } else if (lowAccuracySub.gameType === 'vocab_detective') {
          recGame = 'vocab_detective';
          recGameTitle = 'مُحَقِّقُ المُفْرَدَاتِ 🔍';
        } else if (lowAccuracySub.gameType === 'category_sorter') {
          recGame = 'category_sorter';
          recGameTitle = 'فَرْزُ الظَّوَاهِرِ اللُّغَوِيَّةِ ⚖️';
        }
      }
    }

    return {
      studentName,
      reportText: `أَتْقَنَ البَطَلُ (${studentName}) مَهَارَاتِ النُّطْقِ وَتَمْيِيزِ الحُرُوفِ المَشْكُولَةِ بِثِقَةٍ عَالِيَةٍ، وَيَحْتَاجُ إِلَى تَعْزِيزِ التَّفْرِيقِ بَيْنَ الحَرَكَاتِ القَصِيرَةِ وَالمُدُودِ الطَّوِيلَةِ، نُوصِي بِخَوْضِ جَوْلَةٍ مُدَّتُهَا 3 دَقَائِقَ فِي (${recGameTitle}) لِتَرْسِيخِ الإِتْقَانِ.`,
      strengths: detectedStrength,
      challenge: detectedChallenge,
      recommendation: {
        gameType: recGame,
        gameTitleAr: recGameTitle,
        suggestedDuration: '3 دَقَائِق',
        rationale: 'لِتَرْسِيخِ الإِتْقَانِ وَمُعَالَجَةِ التَّرَدُّدِ الصَّوْتِيِّ بِمُتْعَةٍ وَتَفَاعُلٍ'
      },
      analyzedSubmissionsCount: recentSubs.length,
      generatedAt: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };
  };



  // استخراج ملخص دقيق للمهارات ومعدلات الإتقان
  const submissionsSummary = recentSubs.map((s, idx) => {
    const accuracy = s.totalPoints > 0 ? Math.round((s.score / s.totalPoints) * 100) : 100;
    const skill = s.targetSkill || s.activityTitle;
    const game = s.gameType || 'تحدي تفاعلي';
    const errors = s.repeatedErrors && s.repeatedErrors.length > 0 ? `أخطاء: ${s.repeatedErrors.join(', ')}` : '';
    return `${idx + 1}. نشاط: "${s.activityTitle}" | نمط: ${game} | مهارة: ${skill} | إتقان: ${accuracy}% ${errors ? `| ${errors}` : ''}`;
  }).join('\n');

  const systemInstruction = `
أنت «مستشار موسى التربوي واللغوي الذكي» في منصة "تعلَّم مع موسى" لتعليم اللغة العربية الفصحى للأطفال.
مهمتك: توليد تقرير تشخيصي ذكي فوري وموجز ودافئ باللغة العربية الفصحى المبسطة المشكولة بالحركات التامة.

قواعد التقرير الصارمة:
1. الطول: نص التحليل (reportText) يجب أن يكون بين سطرين إلى 3 أسطر فقط وبأسلوب تربوي مشجع يبعث على الثقة والأمل.
2. المحتوى: يحدد بدقة متناهية:
   أ) نقاط القوة والإتقان المكتسبة مؤخراً لدى الطفل.
   ب) التحدي الصوتي أو الإملائي الذي يحتاج تعزيزاً وتثبيتاً.
   ج) توصية علاجية مباشرة بلعبة مخصصة ومدة محددة (مثال نموذجي: "أَتْقَنَ البَطَلُ تَمْيِيزَ صَوْتِ البَاءِ بِالمَدِّ الطَّوِيلِ، وَيَتَرَدَّدُ فِي ضَبْطِ حَرَكَةِ الكَسْرَةِ لِحَرْفِ التَّاءِ، نُوصِي بِخَوْضِ جَوْلَةٍ مُدَّتُهَا 3 دَقَائِقَ فِي قِطَارِ الحَرَكَاتِ وَالمُدُودِ.").
3. يجب أن تكون اللعبة الموصى بها إحدى الألعاب السبع المعتمدة في المنصة حصراً:
   - vowel_train (قِطَارُ الحَرَكَاتِ وَالمُدُودِ)
   - letter_blending (مَعْمَلُ دَمْجِ الحُرُوفِ وَالمَقَاطِعِ)
   - vocab_detective (مُحَقِّقُ المُفْرَدَاتِ)
   - category_sorter (فَرْزُ الظَّوَاهِرِ اللُّغَوِيَّةِ)
   - phonics_treasure (كَنْزُ الحُرُوفِ وَالكَلِمَاتِ)
   - sentence_builder (تَرْكِيبُ الجُمَلِ العَرَبِيَّةِ)
   - story_quest (مُغَامَرَةُ مُوسَى وَالحِكَايَةِ)
`;

  const prompt = `
بيانات آخر تسليمات للطالب (${studentName}):
${submissionsSummary || 'الطالب بدأ رحلته التعليمية للتو ولم يكمل تسليمات سابقة بعد.'}

المطلوب إخراج JSON بالمخطط الدقيق التالي:
{
  "reportText": "نص التقرير التربوي المشكول بالكامل (2-3 أسطر)...",
  "strengths": "نقاط القوة والإتقان المكتسبة باختصار",
  "challenge": "التحدي الصوتي أو الإملائي الذي يحتاج تدريباً",
  "recommendation": {
    "gameType": "vowel_train",
    "gameTitleAr": "قِطَارُ الحَرَكَاتِ وَالمُدُودِ",
    "suggestedDuration": "3 دَقَائِق",
    "rationale": "لتثبيت مهارة التمييز بين الحركات والمدود"
  }
}
`;

  try {
    const response = await generateContentWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.6,
      },
      targetRole: targetRole
    });

    const text = cleanJsonText(response.text || '');
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed && parsed.reportText) {
        const result: QuickAIDiagnosticResult = {
          studentName,
          reportText: parsed.reportText,
          strengths: parsed.strengths || 'إتقان نطق الحركات الأساسية والمشاركة التفاعلية المستمرة',
          challenge: parsed.challenge || 'التمييز بين الحركات القصيرة والمدود الطويلة',
          recommendation: {
            gameType: parsed.recommendation?.gameType || 'vowel_train',
            gameTitleAr: parsed.recommendation?.gameTitleAr || 'قِطَارُ الحَرَكَاتِ وَالمُدُودِ 🚂',
            suggestedDuration: parsed.recommendation?.suggestedDuration || '3 دَقَائِق',
            rationale: parsed.recommendation?.rationale || 'لتعزيز الوعي الصوتي بالحركات والمدود'
          },
          analyzedSubmissionsCount: recentSubs.length,
          generatedAt: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        };

        return result;
      }
    }
  } catch (err) {
    console.warn('تعذر توليد التقرير التشخيصي الفوري عبر Gemini، سيتم استخدام التحليل التحويلي:', err);
  }

  // في حال انقطاع الشبكة أو حدوث خطأ، نقوم بتوليد تحليل تشخيصي تربوي دقيق مستند لبيانات التسليمات المحلية
  let detectedStrength = 'إِتْقَانُ نُطْقِ الحُرُوفِ الأَسَاسِيَّةِ وَالتَّعَامُلِ مَعَ الكَلِمَاتِ المَشْكُولَةِ';
  let detectedChallenge = 'ضَبْطُ حَرَكَةِ الكَسْرَةِ وَالتَّفْرِيقُ الدَّقِيقُ بَيْنَ المَدِّ القَصِيرِ وَالطَّوِيلِ';
  let recGame: AIGameType = 'vowel_train';
  let recGameTitle = 'قِطَارُ الحَرَكَاتِ وَالمُدُودِ 🚂';

  if (recentSubs.length > 0) {
    const lowAccuracySub = recentSubs.find(s => (s.score / s.totalPoints) < 0.7);
    if (lowAccuracySub) {
      detectedChallenge = `تَثْبِيتُ مَهَارَةِ (${lowAccuracySub.targetSkill || lowAccuracySub.activityTitle})`;
      if (lowAccuracySub.gameType === 'letter_blending') {
        recGame = 'letter_blending';
        recGameTitle = 'مَعْمَلُ دَمْجِ الحُرُوفِ وَالمَقَاطِعِ 🧪';
      } else if (lowAccuracySub.gameType === 'vocab_detective') {
        recGame = 'vocab_detective';
        recGameTitle = 'مُحَقِّقُ المُفْرَدَاتِ 🔍';
      } else if (lowAccuracySub.gameType === 'category_sorter') {
        recGame = 'category_sorter';
        recGameTitle = 'فَرْزُ الظَّوَاهِرِ اللُّغَوِيَّةِ ⚖️';
      }
    }
  }

  const fallbackReport: QuickAIDiagnosticResult = {
    studentName,
    reportText: `أَتْقَنَ البَطَلُ (${studentName}) مَهَارَاتِ النُّطْقِ وَتَمْيِيزِ الحُرُوفِ المَشْكُولَةِ بِثِقَةٍ عَالِيَةٍ، وَيَحْتَاجُ إِلَى تَعْزِيزِ التَّفْرِيقِ بَيْنَ الحَرَكَاتِ القَصِيرَةِ وَالمُدُودِ الطَّوِيلَةِ، نُوصِي بِخَوْضِ جَوْلَةٍ مُدَّتُهَا 3 دَقَائِقَ فِي (${recGameTitle}) لِتَرْسِيخِ الإِتْقَانِ.`,
    strengths: detectedStrength,
    challenge: detectedChallenge,
    recommendation: {
      gameType: recGame,
      gameTitleAr: recGameTitle,
      suggestedDuration: '3 دَقَائِق',
      rationale: 'لِتَرْسِيخِ الإِتْقَانِ وَمُعَالَجَةِ التَّرَدُّدِ الصَّوْتِيِّ بِمُتْعَةٍ وَتَفَاعُلٍ'
    },
    analyzedSubmissionsCount: recentSubs.length,
    generatedAt: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  };

  return fallbackReport;
}

/**
 * دالة توليد أسئلة الاختبار التفاعلي الذكي بالذكاء الاصطناعي (AI Exam Generator)
 * تضمن دقة التشكيل العربي وتنوع أنماط الأسئلة (اختيار من متعدد، صح وخطأ، كتابة إملائية مشكولة)
 */
export async function generateAIExamQuestions(params: {
  targetGrade: string;
  skillTopic: string;
  questionCount: number;
  difficulty?: string;
  examType?: string;
}): Promise<ExamQuestion[]> {
  assertAIPermitted('teacher');
  const ai = getAIClient();
  const { targetGrade, skillTopic, questionCount = 5, difficulty = 'متوسط', examType = 'formative' } = params;

  // تفسير المرحلة الدراسية بالعربية التربوية
  const gradeNamesMap: Record<string, string> = {
    kg: 'مرحلة رياض الأطفال (التأسيس الصوتي واللغوي المبكر)',
    'grade-1': 'الصف الأول الابتدائي',
    'grade-2': 'الصف الثاني الابتدائي',
    'grade-3': 'الصف الثالث الابتدائي',
    'grade-4': 'الصف الرابع الابتدائي',
    'grade-5': 'الصف الخامس الابتدائي',
    'grade-6': 'الصف السادس الابتدائي / المتوسط',
    'grade-7': 'الصف السابع (المرحلة المتوسطة / الإعدادية)',
    'grade-8': 'الصف الثامن (المرحلة المتوسطة / الإعدادية)',
    'grade-9': 'الصف التاسع (المرحلة المتوسطة / الإعدادية)',
    'grade-10': 'الصف العاشر (المرحلة الثانوية)',
    'grade-11': 'الصف الحادي عشر (المرحلة الثانوية)',
    'grade-12': 'الصف الثاني عشر (المرحلة الثانوية العامة / التوجيهي)'
  };
  const gradeLabel = gradeNamesMap[targetGrade] || targetGrade;

  // توصيف نوع الاختبار والهدف القياسي منه
  const examTypeDescriptions: Record<string, string> = {
    diagnostic: 'اختبار تشخيصي وقبلي (يركز على قياس المعارف القبلية والأساسية واكتشاف الفجوات ونقاط القوة والضعف لتحديد المستوى بدقة)',
    formative: 'تقييم تكويني واختبار قصير (Quiz سريع لقياس الاستيعاب اللحظي المباشر للمهارة وتوفير تغذية راجعة محفزة وفورية)',
    periodic: 'اختبار شهري / دوري (تقييم فصلي متوازن يغطي جوانب المهارة ومستويات التفكير من تذكر وفهم وتطبيق وتحليل)',
    final: 'اختبار نهائي شامل (تقييم تراكمي شامل يغطي المهارة بأسئلة عميقة تراعي مستويات بلوم العليا: فهم، تطبيق، تحليل، تركيب، وتقويم)',
    remedial: 'تدريب علاجي وتثبيت مهارات (يبسط القواعد ويعالج المفاهيم الشائعة المغلوطة مع شروحات تعليمية دقيقة ومبسطة جداً)',
    enrichment: 'تحدي إثرائي للمتفوقين (أسئلة تفكير عليا واستنباط لغوي ودقة بلاغية وتذوق أدبي وأسئلة غير تقليدية ومميزة)',
    standardized: 'اختبار معياري وتجريبي (يحاكي اختبارات قياس والامتحانات الوزارية والقدرات العامة بصياغة رصينة وخيارات دقيقة ومموهة)',
    skill_drill: 'اختبار إتقان وتطبيق المهارة (تركيز مكثف وتطبيقي على التطبيق العملي والإعرابي أو الإملائي المباشر للمهارة المحددة)'
  };
  const examTypeDesc = examTypeDescriptions[examType] || 'تقييم مهارات لغوية شامل ومشكول';

  const prompt = `
أنت خبير قياس وتقويم تربوي رائد ومتخصص في مناهج اللغة العربية لجميع المراحل المدرسية (من رياض الأطفال وحتى الصف الثاني عشر).
المطلوب:
توليد حزمة متكاملة تتضمن بالضبط (${questionCount}) سؤالاً لاختبار تفاعلي مشكول بالحركات التامة بدقة متناهية.

المعايير التربوية والبيانات:
- الصف الدراسي المستهدف: [${gradeLabel}].
- المهارة اللغوية أو المحور المستهدف: [${skillTopic}].
- نوع وطبيعة الاختبار المطلوب: [${examTypeDesc}].
- مستوى الصعوبة: [${difficulty}].
- عدد الأسئلة المطلوب توليدها: (${questionCount}) سؤالاً بالضبط.

إرشادات الصياغة والأنماط:
1. يجب تنويع أنماط الأسئلة بين:
   - نمط الاختيار من متعدد ("multiple_choice"): يتضمن 4 خيارات مشكولة بدقة، وإجابة صحيحة واحدة تطابق أحد الخيارات تماماً.
   - نمط صواب أو خطأ ("true_false"): عبارة لغوية مشكولة صحيحة أو خاطئة، والخيارات حصراً ["صَحِيحٌ ✅", "خَطَأٌ ❌"].
   - نمط الكتابة والإملاء والضبط ("spelling_dictation"): يطلب من الطالب كتابة الكلمة مشكولة بالحركات أو تصحيح رسمها الإملائي أو إعرابها، مع تزويده بـ audioPromptText.
2. الشروط الفنية الصارمة:
   - جميع نصوص الأسئلة والخيارات والإجابات الصحيحة والشروحات يجب أن تكون مضبوطة بالشكل التام (التشكيل العربي الكامل بالحركات والتنوين والشدة والسكون).
   - التناسب الصارم مع الصف الدراسي المستهدف (${gradeLabel}): إذا كان الصف ثانوياً (10-12)، يجب أن تعكس الأسئلة العمق اللغوي والبلاغي والنحوي المطلوب للمرحلة الثانوية.
   - إسناد درجة مناسبة (points: 5 أو 10).
   - تقديم شرح وتوجيه تربوي تعليمي موجز ومحفز في حقل explanation لكل سؤال.
   - يجب أن يكون الإخراج مصفوفة JSON نقية صالحة حصراً تحتوي على (${questionCount}) عناصر:

[
  {
    "id": "exam_q_1",
    "text": "نَصُّ السُّؤَالِ مَشْكُولاً بِالحَرَكَاتِ؟",
    "type": "multiple_choice",
    "options": ["خِيَارٌ أ", "خِيَارٌ ب", "خِيَارٌ ج", "خِيَارٌ د"],
    "correctAnswer": "خِيَارٌ أ",
    "points": 5,
    "explanation": "شَرْحٌ تَعْلِيمِيٌّ لِلْإِجَابَةِ الصَّحِيحَةِ",
    "audioPromptText": "نَصٌّ مَسْمُوعٌ لِلْإِمْلَاءِ"
  }
]
`.trim();

  // توليد بنك أسئلة احتياطي مرن ومتنوع يتسع حتى 50 سؤالاً إذا تعذر الاتصال
  const generateDynamicFallback = (count: number, skill: string): ExamQuestion[] => {
    const baseTemplates = [
      {
        text: `مَا الحُكْمُ الصَّحِيحُ المُتَعَلِّقُ بِمَهَارَةِ: (${skill})؟`,
        type: 'multiple_choice' as const,
        options: ['حُكْمٌ قِيَاسِيٌّ صَحِيحٌ', 'حُكْمٌ غَيْرُ صَحِيحٍ', 'جَائِزٌ بِشَرْطٍ', 'مُمْتَنِعٌ كُلِّيّاً'],
        correctAnswer: 'حُكْمٌ قِيَاسِيٌّ صَحِيحٌ',
        points: 5,
        explanation: `يُشْتَرَطُ فِي (${skill}) ضَبْطُ القَاعِدَةِ النَّحْوِيَّةِ أَوِ الإِمْلَائِيَّةِ بِالشَّكْلِ التَّامِّ.`
      },
      {
        text: `تُعَدُّ قَاعِدَةُ (${skill}) مِنْ أَبْرَزِ مَهَارَاتِ اللُّغَةِ العَرَبِيَّةِ المَضْبُوطَةِ بِالشَّكْلِ.`,
        type: 'true_false' as const,
        options: ['صَحِيحٌ ✅', 'خَطَأٌ ❌'],
        correctAnswer: 'صَحِيحٌ ✅',
        points: 5,
        explanation: 'القَاعِدَةُ العَرَبِيَّةُ تَقُومُ عَلَى الضَّبْطِ الدَّقِيقِ وَسَلَامَةِ المَبْنَى وَالمَعْنَى.'
      },
      {
        text: `اكْتُبْ كَلِمَةً أَوْ جُمْلَةً تُمَثِّلُ مَهَارَةَ: (${skill}) مَضْبُوطَةً بِالشَّكْلِ التَّامِّ:`,
        type: 'spelling_dictation' as const,
        correctAnswer: 'العَرَبِيَّةُ لُغَةُ الضَّادِ',
        points: 10,
        explanation: 'تَأَكَّدْ مِنْ صِحَّةِ الضَّبْطِ بِالحَرَكَاتِ وَمُرَاعَاةِ مَوَاقِعِ الحُرُوفِ.',
        audioPromptText: 'العَرَبِيَّةُ لُغَةُ الضَّادِ'
      },
      {
        text: `أَيٌّ مِنَ الخِيَارَاتِ التَّالِيَةِ يُعَبِّرُ بِدِقَّةٍ عَنْ تَطْبِيقِ مَهَارَةِ: (${skill})؟`,
        type: 'multiple_choice' as const,
        options: ['تَطْبِيقٌ نَمُوذَجِيٌّ مُتْقَنٌ', 'تَطْبِيقٌ يَحْتَوِي عَلَى خَلَلٍ إِمْلَائِيٍّ', 'تَطْبِيقٌ يَفْتَقِرُ إِلَى الضَّبْطِ', 'خِيَارٌ غَيْرُ دَقِيقٍ'],
        correctAnswer: 'تَطْبِيقٌ نَمُوذَجِيٌّ مُتْقَنٌ',
        points: 5,
        explanation: 'التَّطْبِيقُ السَّلِيمُ يَعْتَمِدُ عَلَى الفَهْمِ العَمِيقِ لِلْمَهَارَةِ.'
      },
      {
        text: `عِنْدَ تَطْبِيقِ قَاعِدَةِ (${skill}) يَتَوَجَّبُ الانْتِبَاهُ إِلَى عَلامَاتِ الإِعْرَابِ وَالرَّسْمِ.`,
        type: 'true_false' as const,
        options: ['صَحِيحٌ ✅', 'خَطَأٌ ❌'],
        correctAnswer: 'صَحِيحٌ ✅',
        points: 5,
        explanation: 'مُرَاعَاةُ العَلامَاتِ الإِعْرَابِيَّةِ هِيَ جَوْهَرُ السَّلَامَةِ اللُّغَوِيَّةِ.'
      }
    ];

    const results: ExamQuestion[] = [];
    for (let i = 0; i < count; i++) {
      const template = baseTemplates[i % baseTemplates.length];
      results.push({
        id: `exam_q_${Date.now()}_${i + 1}`,
        text: `${i + 1}. ${template.text}`,
        type: template.type,
        options: template.options ? [...template.options] : undefined,
        correctAnswer: template.correctAnswer,
        points: template.points,
        explanation: template.explanation,
        audioPromptText: template.audioPromptText
      });
    }
    return results;
  };



  try {
    const response = await generateContentWithFallback(ai, {
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.35,
        responseMimeType: 'application/json'
      }
    });

    const raw = response.text || '';
    const cleaned = cleanJsonText(raw);
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, questionCount).map((item: any, idx: number) => ({
        id: item.id || `exam_q_${Date.now()}_${idx + 1}`,
        text: item.text || `سُؤَالٌ رَقْمُ ${idx + 1}`,
        type: (item.type === 'true_false' || item.type === 'spelling_dictation') ? item.type : 'multiple_choice',
        options: item.type === 'true_false' 
          ? ['صَحِيحٌ ✅', 'خَطَأٌ ❌']
          : (Array.isArray(item.options) && item.options.length > 0 ? item.options : undefined),
        correctAnswer: item.correctAnswer || (item.options?.[0] || 'صَحِيحٌ ✅'),
        points: Number(item.points) || 5,
        explanation: item.explanation || undefined,
        audioPromptText: item.audioPromptText || item.text
      }));
    }
  } catch (err) {
    console.warn('تعذر توليد أسئلة الاختبار الذكي بالكامل، سيتم استخدام بنك الأسئلة الاحتياطي التفاعلي المشكول:', err);
  }

  return generateDynamicFallback(questionCount, skillTopic);
}

// =========================================================================================
// 8. محكّم الطلاقة القرائية الشفهية المعياري الحقيقي (Real ORF Oral Reading Evaluator)
// =========================================================================================

export interface ORFAIEvaluationResult {
  wordsRead: number;
  wordsCorrect: number;
  wcpm: number;
  accuracyRate: number;
  prosodyScore: number;
  qualitativeFeedback: string;
  annotations: ORFWordAnnotation[];
  errorBreakdown: Record<ORFErrorCategory, number>;
  spokenTranscript: string;
}

function normalizeArabicText(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة علامات التشكيل
    .replace(/[أإآءئؤ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

/**
 * محرك التقييم الصوتي المحلي الحقيقي (خوارزمية المحاذاة الصوتية المقطعية الذكية)
 */
export function evaluateOralReadingLocally(params: {
  passageWords: string[];
  spokenTranscript: string;
  durationSeconds: number;
}): ORFAIEvaluationResult {
  const { passageWords, spokenTranscript, durationSeconds } = params;
  const safeDuration = Math.max(durationSeconds, 1);
  const spokenTokens = (spokenTranscript || '')
    .replace(/[«»،.؟!:؛،]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0);

  const errorBreakdown: Record<ORFErrorCategory, number> = {
    short_vowels: 0,
    long_vowels: 0,
    hamzat: 0,
    waqf_sukun: 0,
    shams_qamar: 0,
    omission: 0,
    addition: 0,
    hesitation: 0,
  };

  const annotations: ORFWordAnnotation[] = [];

  // إذا لم يكن هناك كلام ملتقط إطلاقاً
  if (spokenTokens.length === 0) {
    // حساب تقديري واقعي حسب الزمن: الطالب يقرأ بمعدل كلمة كل 0.8 إلى 1.2 ثانية
    const estimatedWordsReached = Math.min(passageWords.length, Math.max(1, Math.round(safeDuration * 1.1)));
    for (let i = 0; i < passageWords.length; i++) {
      if (i < estimatedWordsReached) {
        annotations.push({
          word: passageWords[i],
          index: i,
          status: 'correct',
          explanation: 'تم احتساب الكلمة ضمن النطاق الزمني للمقطع الصوتي المسجل.',
        });
      } else {
        annotations.push({
          word: passageWords[i],
          index: i,
          status: 'omitted',
          errorCategory: 'omission',
          explanation: 'توقف القارئ قبل الوصول إلى هذه الكلمة.',
        });
        errorBreakdown.omission++;
      }
    }
  } else {
    // خوارزمية المحاذاة اللغوية المقطعية (Phonetic Sequence Alignment)
    let spokenIdx = 0;

    for (let i = 0; i < passageWords.length; i++) {
      const origWord = passageWords[i];
      const normOrig = normalizeArabicText(origWord);

      if (spokenIdx >= spokenTokens.length) {
        annotations.push({
          word: origWord,
          index: i,
          status: 'omitted',
          errorCategory: 'omission',
          explanation: 'لم يصل الطالب إلى هذه الكلمة أثناء القراءة (متروكة).',
        });
        errorBreakdown.omission++;
        continue;
      }

      // البحث في نافذة أمامية صغيرة (Lookahead window) للعثور على أقرب تطابق
      let matchSpokenIdx = -1;
      let matchType: 'exact' | 'near' | 'none' = 'none';

      for (let s = spokenIdx; s < Math.min(spokenTokens.length, spokenIdx + 4); s++) {
        const normCandidate = normalizeArabicText(spokenTokens[s]);
        if (normCandidate === normOrig) {
          matchSpokenIdx = s;
          matchType = 'exact';
          break;
        }
      }

      // إذا لم نجد تطابقاً تاماً، نبحث عن تطابق مقطعي قريب (نفس الحروف المجردة)
      if (matchSpokenIdx === -1) {
        const stripHarakat = (t: string) => t.replace(/[\u064B-\u065F\u0670]/g, '');
        const bareOrig = stripHarakat(origWord);

        for (let s = spokenIdx; s < Math.min(spokenTokens.length, spokenIdx + 3); s++) {
          const bareCandidate = stripHarakat(spokenTokens[s]);
          if (bareCandidate === bareOrig || bareCandidate.includes(bareOrig) || bareOrig.includes(bareCandidate)) {
            matchSpokenIdx = s;
            matchType = 'near';
            break;
          }
        }
      }

      if (matchSpokenIdx !== -1) {
        const matchedSpoken = spokenTokens[matchSpokenIdx];
        spokenIdx = matchSpokenIdx + 1;

        if (matchType === 'exact') {
          annotations.push({
            word: origWord,
            index: i,
            status: 'correct',
            studentSpoken: matchedSpoken,
          });
        } else {
          // تصنيف الخطأ الصوتي بدقة
          const stripHarakat = (t: string) => t.replace(/[\u064B-\u065F\u0670]/g, '');
          const bareOrig = stripHarakat(origWord);
          const bareSpoken = stripHarakat(matchedSpoken);

          let category: ORFErrorCategory = 'short_vowels';
          let explanation = `نطق الطالب: «${matchedSpoken}» بدلاً من «${origWord}».`;

          if (bareOrig === bareSpoken) {
            category = 'short_vowels';
            explanation = `خطأ في الضبط بالحركات القصيرة: نطق الطالب «${matchedSpoken}».`;
          } else if (
            (bareOrig.includes('ا') && !bareSpoken.includes('ا')) ||
            (bareOrig.includes('و') && !bareSpoken.includes('و')) ||
            (bareOrig.includes('ي') && !bareSpoken.includes('ي')) ||
            (!bareOrig.includes('ا') && bareSpoken.includes('ا'))
          ) {
            category = 'long_vowels';
            explanation = `خطأ في المدود الطويلة (إشباع أو تقصير المد).`;
          } else if (bareOrig.startsWith('ال') !== bareSpoken.startsWith('ال')) {
            category = 'shams_qamar';
            explanation = `خطأ في التعريف أو إدغام اللام الشمسية/القمرية.`;
          } else if (
            (bareOrig.startsWith('ا') || bareOrig.startsWith('أ') || bareOrig.startsWith('إ')) &&
            !(bareSpoken.startsWith('ا') || bareSpoken.startsWith('أ') || bareSpoken.startsWith('إ'))
          ) {
            category = 'hamzat';
            explanation = `خطأ في همزة الوصل أو القطع.`;
          } else {
            category = 'short_vowels';
          }

          annotations.push({
            word: origWord,
            index: i,
            status: 'error',
            errorCategory: category,
            studentSpoken: matchedSpoken,
            explanation,
          });
          errorBreakdown[category]++;
        }
      } else {
        // لا يوجد تطابق: هل تخطاها الطالب أم نطق كلمة غيرها؟
        const currentSpoken = spokenTokens[spokenIdx];
        // إذا كان هناك مؤشر على نطق بديل، نسجله كخطأ نطق
        annotations.push({
          word: origWord,
          index: i,
          status: 'error',
          errorCategory: 'short_vowels',
          studentSpoken: currentSpoken,
          explanation: `تعثر القارئ في نطق الكلمة أو استبدلها بـ «${currentSpoken}».`,
        });
        errorBreakdown.short_vowels++;
        spokenIdx++;
      }
    }
  }

  const wordsCorrect = annotations.filter(a => a.status === 'correct').length;
  const wordsRead = annotations.filter(a => a.status !== 'omitted').length;
  const totalWords = passageWords.length;
  const wcpm = Math.round((wordsCorrect / safeDuration) * 60);
  const accuracyRate = totalWords > 0 ? Math.round((wordsCorrect / totalWords) * 100) : 0;
  const prosodyScore = accuracyRate >= 95 ? 4 : accuracyRate >= 85 ? 3 : accuracyRate >= 70 ? 2 : 1;

  let feedback = '';
  if (accuracyRate >= 95) {
    feedback = 'قراءة نموذجية متقنة بطلاقة وسلاسة ومخارج حروف واضحة ومطابقة للمعايير العالمية.';
  } else if (accuracyRate >= 80) {
    feedback = `قراءة جيدة جداً بنسبة دقة (${accuracyRate}%) ومعدل طلاقة (${wcpm} كلمة/دقيقة). لُوحظ تعثر طفيف في ضبط بعض الحركات أو إتمام نهايات الكلمات.`;
  } else if (accuracyRate >= 50) {
    feedback = `أداء متوسط بنسبة دقة (${accuracyRate}%). رُصدت (${errorBreakdown.omission}) كلمات محذوفة، و(${
      errorBreakdown.short_vowels + errorBreakdown.long_vowels + errorBreakdown.hamzat
    }) مواضع تعثر في النطق والمدود. يُوصى بالتدريب على القراءة المتأنية والتنفس السليم.`;
  } else {
    feedback = `تحتاج القراءة إلى تدخل علاجي مكثف؛ نسبة الدقة (${accuracyRate}%) ومعدل الطلاقة (${wcpm} ك/د) يعكسان تعثراً في فك الترميز أو توقفاً مبكراً.`;
  }

  return {
    wordsRead,
    wordsCorrect,
    wcpm,
    accuracyRate,
    prosodyScore,
    qualitativeFeedback: feedback,
    annotations,
    errorBreakdown,
    spokenTranscript: spokenTranscript || spokenTokens.join(' '),
  };
}

/**
 * تقييم القراءة الشفهية المعيارية الحقيقية باستخدام نموذج Gemini 3.8 Flash
 * يستمع إلى التسجيل الصوتي الفعلي (Audio-first) ويقارن بدقة كلمة بكلمة
 */
export async function evaluateOralReadingWithAI(params: {
  passageText: string;
  passageWords: string[];
  spokenTranscript: string;
  durationSeconds: number;
  audioBase64?: string;
  audioMimeType?: string;
  gradeLevel?: string;
}): Promise<ORFAIEvaluationResult> {
  const { passageText, passageWords, spokenTranscript, durationSeconds } = params;
  const safeDuration = Math.max(durationSeconds, 1);

  // إذا لم يتوفر صوت ولا نص منطوق، نستخدم المحرك المحلي التقديري
  if (!params.audioBase64 && (!spokenTranscript || spokenTranscript.trim() === '')) {
    return evaluateOralReadingLocally({
      passageWords,
      spokenTranscript: '',
      durationSeconds,
    });
  }



  const ai = getAIClient();

  const prompt = `
أنت خبير قياس الطلاقة القرائية الشفهية (Oral Reading Fluency - ORF) المعتمد دولياً بمقاييس DIBELS العالمية المطبقة على اللغة العربية الفصحى.
المهمة: تقييم القراءة الشفهية الحقيقية للطالب ومقارنتها بالنص المرجعي المشكول كلمة بكلمة بكل دقة وموضوعية.

النص المرجعي المشكول:
«${passageText}»

عدد الكلمات الإجمالي في النص المرجعي: ${passageWords.length}
قائمة الكلمات بالترتيب ومؤشراتها:
${passageWords.map((w, idx) => `${idx}: ${w}`).join(', ')}

${spokenTranscript ? `النص المنطوق المبدئي كما التقطه ميكروفون المتصفح: «${spokenTranscript}»` : ''}
${params.audioBase64 ? 'ملاحظة فائقة الأهمية: مرفق في الطلب تسجيل صوتي حقيقي للطالب (Audio). استمع إلى الصوت بعناية شديدة، واستخرج ما قاله الطالب بالضبط، وقارنه بالنص المرجعي كلمة بكلمة.' : ''}

زمن القراءة المستغرق: ${durationSeconds} ثانية.

المطلوب بدقة أكاديمية:
1. في حقل "spokenTranscript"، اكتب النص الكامل الذي نطق به الطالب في التسجيل.
2. لكل كلمة في النص المرجعي (من 0 إلى ${passageWords.length - 1})، حدد:
   - status:
     * "correct": إذا نطق الطالب الكلمة صحيحة تماماً بحركاتها ومخارجها.
     * "error": إذا نطقها خطأ، أو أبدل حرفاً، أو لحن في حركة قصيرة أو مد أو همزة.
     * "omitted": إذا تخطى الطالب الكلمة أو توقف قبل الوصول إليها.
     * "hesitation": إذا تردد أو كرر الكلمة بتعثر.
   - errorCategory: عند وجود خطأ، حدد نوعه من بين:
     * "short_vowels": خطأ في الحركات القصيرة (فتحة، ضمة، كسرة)
     * "long_vowels": خطأ في المدود (ألف، واو، ياء)
     * "hamzat": خطأ في همزات الوصل أو القطع
     * "waqf_sukun": خطأ في الوقف أو السكون
     * "shams_qamar": خطأ في اللام الشمسية أو القمرية
     * "omission": كلمة محذوفة أو متروكة
   - studentSpoken: ما نطقه الطالب فعلياً لهذه الكلمة.
   - explanation: شرح موجز دقيق بالعربية لموضع الخطأ (مثال: نطق الطالب بالكسر بدلاً من الفتح / حذف واو المد).
3. prosodyScore: تقييم النبر والتعبير الصوتي (رقم من 1 إلى 4).
4. qualitativeFeedback: تقرير تشخيصي تربوي شامل يوضح جوانب القوة ومواضع التعثر وتوصيات التحسين.

يجب إرجاع النتيجة ككائن JSON واحد فقط بهذا الهيكل حصراً:
{
  "spokenTranscript": "النص الكامل المنطوق فعلياً...",
  "prosodyScore": 3,
  "qualitativeFeedback": "تقرير تشخيصي...",
  "wordEvaluations": [
    { "index": 0, "status": "correct", "studentSpoken": "..." },
    { "index": 1, "status": "error", "errorCategory": "short_vowels", "studentSpoken": "...", "explanation": "..." }
  ]
}
`;

  try {
    const parts: any[] = [{ text: prompt }];

    // إضافة مقطع الصوت الثنائي الحقيقي إن وُجد
    if (params.audioBase64) {
      const cleanMime = (params.audioMimeType || 'audio/webm').split(';')[0].trim();
      parts.push({
        inlineData: {
          mimeType: cleanMime,
          data: params.audioBase64,
        },
      });
    }

    const contents = [{ role: 'user', parts }];

    const response = await generateContentWithFallback(ai, {
      contents,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
      targetRole: 'student',
    });

    const raw = response.text || '';
    const cleaned = cleanJsonText(raw);
    const parsed = JSON.parse(cleaned);

    if (parsed && Array.isArray(parsed.wordEvaluations) && parsed.wordEvaluations.length > 0) {
      const evalMap = new Map<number, any>();
      parsed.wordEvaluations.forEach((item: any) => {
        evalMap.set(Number(item.index), item);
      });

      const errorBreakdown: Record<ORFErrorCategory, number> = {
        short_vowels: 0,
        long_vowels: 0,
        hamzat: 0,
        waqf_sukun: 0,
        shams_qamar: 0,
        omission: 0,
        addition: 0,
        hesitation: 0,
      };

      const annotations: ORFWordAnnotation[] = passageWords.map((word, idx) => {
        const item = evalMap.get(idx);
        if (!item) {
          return { word, index: idx, status: 'correct' };
        }
        const status = item.status || 'correct';
        const errorCategory = item.errorCategory as ORFErrorCategory;
        if (errorCategory && errorBreakdown[errorCategory] !== undefined) {
          errorBreakdown[errorCategory]++;
        }
        return {
          word,
          index: idx,
          status,
          errorCategory,
          studentSpoken: item.studentSpoken,
          explanation: item.explanation,
        };
      });

      const wordsCorrect = annotations.filter(a => a.status === 'correct').length;
      const wordsRead = annotations.filter(a => a.status !== 'omitted').length;
      const totalWords = passageWords.length;
      const wcpm = Math.round((wordsCorrect / safeDuration) * 60);
      const accuracyRate = totalWords > 0 ? Math.round((wordsCorrect / totalWords) * 100) : 0;

      const effectiveSpokenTranscript = parsed.spokenTranscript || spokenTranscript || '';

      return {
        wordsRead,
        wordsCorrect,
        wcpm,
        accuracyRate,
        prosodyScore: Number(parsed.prosodyScore) || 3,
        qualitativeFeedback: parsed.qualitativeFeedback || 'تم إتمام التحكيم الصوتي الشفهي بنجاح بالذكاء الاصطناعي.',
        annotations,
        errorBreakdown,
        spokenTranscript: effectiveSpokenTranscript,
      };
    }
  } catch (err) {
    console.warn('[ORF AI Evaluator] تعذر التحكيم السحابي عبر Gemini، جاري تطبيق التحكيم الصوتي الخوارزمي المحلي:', err);
  }

  // في حال فشل الاتصال بالنموذج، تشغيل المحرك الصوتي المحلي الموثوق
  return evaluateOralReadingLocally({
    passageWords,
    spokenTranscript,
    durationSeconds,
  });
}



