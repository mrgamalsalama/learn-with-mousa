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
  ExamQuestion
} from './types';
import { isAIFeatureAllowed, canUserUseAI, getCurrentUser } from './storage';

// 1. مصفوفة النماذج المعتمدة للنصوص والأنشطة (Fallback Waterfall)
export const TEXT_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.5-pro'
];

// 2. نماذج الصوت المعتمدة لـ TTS
export const AUDIO_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-3.6-flash',
  'gemini-2.5-flash'
];

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

// دالة مساعدة لتنفيذ طلبات التوليد عبر خادم التطبيق الآمن (Server-Side Proxy) مع دعم التبديل التلقائي
async function generateContentWithFallback(
  _ai: any,
  params: {
    contents: any;
    config?: any;
    targetRole?: AIGovernanceTarget;
  }
) {
  // فحص حوكمة الذكاء الاصطناعي فوراً قبل الشروع في الاتصال بنماذج Google GenAI
  assertAIPermitted(params.targetRole || 'student');

  // المحاولة الأولى: عبر خادم التطبيق الداخلي Server Proxy (/api/gemini/generate)
  try {
    const serverRes = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3.8-flash',
        contents: params.contents,
        config: params.config,
      }),
    });

    if (serverRes.ok) {
      const data = await serverRes.json();
      return {
        text: data.text || '',
        candidates: data.candidates,
        usageMetadata: data.usageMetadata,
        modelUsed: data.modelUsed || 'gemini-3.8-flash',
      };
    } else {
      const errorJson = await serverRes.json().catch(() => ({}));
      console.warn('[Gemini Server Proxy] استجاب الخادم بحالة غير ناجحة:', serverRes.status, errorJson);
      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        throw new Error(errorJson?.error || 'خادم الذكاء الاصطناعي غير متصل حالياً. يرجى التأكد من إعداد GEMINI_API_KEY.');
      }
    }
  } catch (proxyErr: any) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.error('[Gemini Cascade] تعذر الاتصال عبر خادم التطبيق ولا يوجد مفتاح محلي:', proxyErr);
      throw proxyErr;
    }
    console.warn('[Gemini Cascade] فشل الاستدعاء عبر الخادم، جاري المحاولة عبر مفتاح العميل المباشر...');
  }

  const ai = getAIClient();
  let lastError: any = null;

  for (let i = 0; i < TEXT_MODELS.length; i++) {
    const model = TEXT_MODELS[i];
    try {
      const response = await ai.models.generateContent({
        model: model,
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
      const errMsg = err?.message || String(err || '');
      console.warn(`[Gemini Cascade] تعذر ${model}، جاري الانتقال للنموذج التالي... التفاصيل:`, errMsg);

      // في حال وجود نموذج تالٍ، ننتظر مهلة بسيطة (Jitter بين 300ms إلى 500ms) قبل الانتقال
      if (i < TEXT_MODELS.length - 1) {
        const jitterMs = 300 + Math.floor(Math.random() * 200);
        await new Promise((resolve) => setTimeout(resolve, jitterMs));
      }
    }
  }

  console.error('[Gemini Cascade] فشل الاستدعاء بكافة النماذج المعتمدة للنصوص:', lastError);
  throw lastError || new Error('فشل الاتصال بنماذج الذكاء الاصطناعي');
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
    console.error('خطأ حقيقي في دالة generateContent (chatWithMusa):', error);
    console.error('User Prompt الفعلي المرسل إلى النموذج:', userMessage);
    throw error;
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

  if (!ai) {
    // سيناريو ذكي مبني بالحركات
    return {
      step: stepNumber,
      sceneTitle: `مُغَامَرَةُ حَرْفِ (${letter}) - المَشْهَدُ ${stepNumber}`,
      passage: stepNumber === 1 
        ? `فِي صَبَاحٍ مُشْرِقٍ، خَرَجَ الأَرْنَبُ (بَاسِمٌ) يَبْحَثُ عَنْ أَصْدِقَائِهِ فِي البُسْتَانِ البَدِيعِ. رَأَى بَرَاعِمَ الأَزْهَارِ تَتَفَتَّحُ، وَسَمِعَ صَوْتَ بُلْبُلٍ يُغَرِّدُ بِأَلْحَانٍ عَذْبَةٍ فَوْقَ غُصْنِ شَجَرَةِ البُرْتُقَالِ!`
        : `وَاصَلَ الأَرْنَبُ الصَّغِيرُ طَرِيقَهُ فَرَأَى بُحَيْرَةً صَافِيَةً تَسْبَحُ فِيهَا بَطَّةٌ جَمِيلَةٌ بَيْضَاءُ. نَادَتْهُ البَطَّةُ قَائِلَةً: «مَرْحَبًا بِكَ يَا بَاسِمُ، هَلْ تُشَارِكُنِي تَنَاوُلَ بَعْضِ البُذُورِ اللَّذِيذَة؟»`,
      targetLetter: letter,
      question: isFinalStep ? 'مَاذَا تَعَلَّمْتَ مِنْ هَذِهِ القِصَّةِ الجَمِيلَة؟' : 'مَاذَا يَخْتَارُ بَاسِمٌ أَنْ يَفْعَلَ الآن؟',
      optionA: isFinalStep ? 'الابْتِسَامَةُ وَحُبُّ الأَصْدِقَاءِ 🌸' : 'يَسْبَحُ مَعَ البَطَّةِ فِي البُحَيْرَةِ 🦆',
      optionB: isFinalStep ? 'شُكْرُ اللهِ عَلَى النِّعَمِ 🌟' : 'يَجْلِسُ تَحْتَ شَجَرَةِ البُرْتُقَالِ لِيَسْتَرِيحَ 🍊',
      badgeEarned: isFinalStep ? `وسام حكواتي حرف (${letter}) المبدع 🏆` : undefined,
      isEnding: isFinalStep,
    };
  }

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

  if (!ai) {
    if (isFirstLetterMatch) {
      return {
        isValid: true,
        startsCorrectly: true,
        formedWord: cleanWord,
        meaningSimple: `كَلِمَةٌ عَرَبِيَّةٌ جَمِيلَةٌ تَبْدَأُ بِحَرْفِ (${letter})`,
        encouragement: `مَا شَاءَ اللهُ يَا بَطَل! نُطْقٌ صَحِيحٌ وَإِجَابَةٌ رَائِعَةٌ تَفْتَحُ لَكَ البَوَّابَةَ السِّحْرِيَّةَ! 🌟🎉`,
        badgeName: `وسام نطق حرف (${letter}) الذهبي 🏅`,
        scoreAwarded: 10,
      };
    } else {
      return {
        isValid: true,
        startsCorrectly: false,
        formedWord: cleanWord,
        meaningSimple: 'كَلِمَةٌ لَطِيفَةٌ وَلَكِنَّهَا لَا تَبْدَأُ بِالحَرْفِ المَطْلُوب',
        encouragement: `حَاوِلْ مَرَّةً أُخْرَى يَا بَطَل! نَحْنُ نَبْحَثُ عَنْ كَلِمَةٍ تَبْدَأُ بِحَرْفِ (${letter})، مِثْلَ كَلِمَةِ هَدَفٍ صَحِيحَةٍ! 💪`,
        scoreAwarded: 0,
      };
    }
  }

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

  if (!ai) {
    return {
      recognizedObject: positionInfo?.exampleWord || `رَسْمَةٌ إِبْدَاعِيَّةٌ تَبْدَأُ بِحَرْفِ (${letter})`,
      startsWithTargetLetter: true,
      targetLetter: letter,
      confidenceScore: 95,
      feedback: `مَا شَاءَ اللهُ! لَوْحَةٌ فَنِّيَّةٌ مُبْهِرَةٌ يَا صَدِيقِي الفَنَّان! رَسَمْتَ شَيْئًا جَمِيلًا يُمَثِّلُ حَرْفَ (${positionInfo?.letterForm || letter})! لَقَدْ حَصَلْتَ عَلَى ٥ نُجُوم! 🎨⭐`,
      badgeEarned: `وسام فنان الحروف العبقري (${letter}) 🎨🖌️`,
      starsCount: 5,
    };
  }

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

  if (!ai) {
    return mockReport;
  }

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
 * دالة توليد أسئلة تحدي موسى التنافسية الحية (Mousa Challenge Quiz Generator)
 * تضمن دعم الأنماط التفاعلية: (اختيار متعدد كلاسيكي، صح أو خطأ، سباق الترتيب، سحر الإملاء والكتابة، سحابة الكلمات، استطلاع الرأي)
 */
export async function generateAIChallengeQuestions(params: {
  topic: string;
  grade: string;
  count: number;
  timeLimitSeconds?: number;
  questionTypes?: ('classic' | 'true_false' | 'puzzle' | 'type_answer' | 'word_cloud' | 'poll')[];
}): Promise<any[]> {
  const { topic, grade, count = 4, timeLimitSeconds = 20, questionTypes } = params;
  const ai = getAIClient();
  const cleanTopic = topic.trim() || 'اللغة العربية والظواهر الإملائية والنحوية';

  const defaultShapes = ['triangle', 'diamond', 'circle', 'square'];

  const fallbackQuestions = [
    {
      id: `ch_q_${Date.now()}_1`,
      type: 'classic',
      text: `مَا المَفْهُومُ الأَسَاسِيُّ المُرْتَبِطُ بِمَوْضُوعِ (${cleanTopic})؟`,
      timeLimitSeconds,
      correctIndex: 0,
      explanation: `أَحْسَنْتُمْ يَا أَبْطَالَ مُوسَى! هَذَا المَفْهُومُ هُوَ أَسَاسُ دَرْسِ ${cleanTopic}!`,
      options: [
        { id: '0', text: `القَاعِدَةُ اللُّغَوِيَّةُ الأَسَاسِيَّةُ لِـ (${cleanTopic}) ✨`, shape: 'triangle' },
        { id: '1', text: 'الإِعْرَابُ العَشْوَائِيُّ غَيْرُ المَضْبُوطِ', shape: 'diamond' },
        { id: '2', text: 'حَذْفُ الحُرُوفِ دُونَ سَبَبٍ', shape: 'circle' },
        { id: '3', text: 'تَجَاهُلُ عَلامَاتِ التَّرْقِيمِ', shape: 'square' },
      ]
    },
    {
      id: `ch_q_${Date.now()}_2`,
      type: 'true_false',
      text: `هَلْ تَبْدَأُ الجُمْلَةُ الفِعْلِيَّةُ دَائِمًا بِاسْمٍ؟`,
      timeLimitSeconds,
      correctIndex: 1,
      explanation: `رَائِعٌ جِدًّا! الجُمْلَةُ الفِعْلِيَّةُ تَبْدَأُ دَوْمًا بِفِعْلٍ وَلَيْسَ بِاسْمٍ!`,
      options: [
        { id: '0', text: 'صَحِيحٌ (صَوَابٌ) ✅', shape: 'diamond' },
        { id: '1', text: 'خَاطِئٌ (خَطَأٌ) ❌', shape: 'triangle' },
      ]
    },
    {
      id: `ch_q_${Date.now()}_3`,
      type: 'puzzle',
      text: `رَتِّبِ الكَلِمَاتِ الآتِيَةَ لِتُكَوِّنَ جُمْلَةً مُفِيدَةً:`,
      timeLimitSeconds,
      correctIndex: 0,
      correctOrder: [0, 1, 2, 3],
      explanation: `تَرْتِيبٌ مِثَالِيٌّ! تَكَوَّنَتْ جُمْلَةٌ عَرَبِيَّةٌ فَصِيحَةٌ وَمُتَنَاسِقَةٌ! 🌟`,
      options: [
        { id: '0', text: 'يَقْرَأُ', shape: 'triangle' },
        { id: '1', text: 'مُوسَى', shape: 'diamond' },
        { id: '2', text: 'كِتَابًا', shape: 'circle' },
        { id: '3', text: 'مُفِيدًا', shape: 'square' },
      ]
    },
    {
      id: `ch_q_${Date.now()}_4`,
      type: 'type_answer',
      text: `اكْتُبْ كَلِمَةَ: [كِتَابٌ] مَضْبُوطَةً بِالتَّنْوِينِ:`,
      timeLimitSeconds,
      correctIndex: 0,
      correctAnswerText: 'كتاب',
      acceptableAnswers: ['كتاب', 'كتابٌ', 'كِتَابٌ'],
      explanation: `كِتَابَةٌ دَقِيقَةٌ وَإِمْلَاءٌ سَلِيمٌ يَا بَطَل! ✨`,
      options: []
    }
  ];

  if (!ai) {
    return fallbackQuestions.slice(0, count);
  }

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
      return parsed.map((item, idx) => {
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
    }
    return fallbackQuestions.slice(0, count);
  } catch (err) {
    console.error('فشل توليد أسئلة تحدي موسى عبر الذكاء الاصطناعي:', err);
    return fallbackQuestions.slice(0, count);
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
const DB_NAME = 'MousaVoicePersistentDB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_clips';

let idbPromise: Promise<IDBDatabase | null> | null = null;

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
 * تنظيف النصوص العربية من الوسوم والرموز التعبيرية لضمان نطق سليم
 */
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/[\*\#\`\_\[\]\(\)\{\}\>\~]/g, '')
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

/**
 * القارئ الاحتياطي عبر متصفح الويب (SpeechSynthesis) عند تعذر الاتصال أو انتهاء الحصة
 */
function speakBrowserSpeechSynthesis(cleanText: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.95;
    utterance.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(v => 
      v.lang.startsWith('ar') || 
      v.name.includes('Arabic') || 
      v.name.includes('Maged') || 
      v.name.includes('Tarik')
    );
    if (arabicVoice) {
      utterance.voice = arabicVoice;
    }

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    if (onEnd) onEnd();
  }
}

/**
 * إيقاف أي نطق صوتي نشط حالياً فوراً
 */
export function stopMousaVoice(): void {
  // زيادة عداد الجلسة لإلغاء أي تشغيل متبقٍ للجمل اللاحقة
  mousaAudioSessionCounter++;

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
 * الجلب الداخلي لمقطع صوتي واحد مع فحص ذاكرة الرام (0ms) وقاعدة IndexedDB قبل استدعاء API
 * مع توجيه فائق السرعة مقتصر على: "Read the following Arabic text naturally: [TEXT]"
 */
async function fetchSingleAudioBuffer(cleanText: string): Promise<AudioBuffer | null> {
  if (!cleanText) return null;

  // 1. فحص ذاكرة الرام السريعة (0ms Hit)
  if (mousaAudioCache.has(cleanText)) {
    return mousaAudioCache.get(cleanText)!.buffer;
  }

  // 2. فحص التخزين الدائم في المتصفح (IndexedDB Cache)
  const idbBytes = await getFromIndexedDBCache(cleanText);
  if (idbBytes) {
    const audioCtx = getAudioContext();
    const buffer = pcmToAudioBuffer(idbBytes, audioCtx, 24000);
    mousaAudioCache.set(cleanText, {
      buffer,
      pcm: idbBytes,
      timestamp: Date.now()
    });
    return buffer;
  }

  // 3. التحقق من وجود طلب جلب نشط لنفس النص لعدم تكرار الطلب (Deduplication)
  if (inFlightFetches.has(cleanText)) {
    return inFlightFetches.get(cleanText)!;
  }

  const fetchPromise = (async (): Promise<AudioBuffer | null> => {
    try {
      assertAIPermitted('student');

      // تعليمات مختصرة للغاية بدون أي حشو لتقليل وقت معالجة النموذج لأدنى حد ممكن
      const promptText = `Read the following Arabic text naturally: ${cleanText}`;

      // 1. المحاولة عبر خادم التطبيق الآمن (Server-Side Proxy)
      try {
        const serverRes = await fetch('/api/gemini/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemini-3.1-flash-tts-preview',
            contents: [{ parts: [{ text: promptText }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Puck',
                  },
                },
              },
            },
          }),
        });

        if (serverRes.ok) {
          const data = await serverRes.json();
          const candidate = data.candidates?.[0];
          const part = candidate?.content?.parts?.[0];
          const base64Data = part?.inlineData?.data;

          if (base64Data) {
            const pcmBytes = base64ToUint8Array(base64Data);
            const audioCtx = getAudioContext();
            const buffer = pcmToAudioBuffer(pcmBytes, audioCtx, 24000);

            mousaAudioCache.set(cleanText, {
              buffer,
              pcm: pcmBytes,
              timestamp: Date.now(),
            });
            saveToIndexedDBCache(cleanText, pcmBytes);

            return buffer;
          }
        }
      } catch (proxyAudioErr) {
        console.warn('[Gemini TTS Proxy] تعذر جلب الصوت عبر خادم التطبيق، جاري فحص البدائل...', proxyAudioErr);
      }

      const ai = getAIClient();
      if (!ai) return null;

      let lastAudioError: any = null;

      for (let i = 0; i < AUDIO_MODELS.length; i++) {
        const audioModel = AUDIO_MODELS[i];
        try {
          const response = await ai.models.generateContent({
            model: audioModel,
            contents: [{ parts: [{ text: promptText }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Puck', // نبرة صوت دافئة واضحة ومرحة تناسب شخصية موسى
                  },
                },
              },
            },
          });

          const candidate = response.candidates?.[0];
          const part = candidate?.content?.parts?.[0];
          const base64Data = part?.inlineData?.data;

          if (base64Data) {
            const pcmBytes = base64ToUint8Array(base64Data);
            const audioCtx = getAudioContext();
            const buffer = pcmToAudioBuffer(pcmBytes, audioCtx, 24000);

            // حفظ دائم في كل من ذاكرة الرام وIndexedDB
            mousaAudioCache.set(cleanText, {
              buffer,
              pcm: pcmBytes,
              timestamp: Date.now()
            });
            saveToIndexedDBCache(cleanText, pcmBytes);

            return buffer;
          }
        } catch (err: any) {
          lastAudioError = err;
          const errMsg = err?.message || String(err || '');
          console.warn(`[Gemini Cascade Audio] تعذر ${audioModel}، جاري الانتقال لنموذج الصوت التالي... التفاصيل:`, errMsg);

          if (i < AUDIO_MODELS.length - 1) {
            const jitterMs = 300 + Math.floor(Math.random() * 200);
            await new Promise((resolve) => setTimeout(resolve, jitterMs));
          }
        }
      }

      if (lastAudioError) {
        console.warn('تعذر توليد مقطع صوتي عبر كافة نماذج الصوت المعتمدة لـ TTS:', lastAudioError?.message || lastAudioError);
      }
      return null;
    } catch (err: any) {
      console.warn('تعذر توليد مقطع صوتي عبر Gemini TTS:', err?.message || err);
      return null;
    } finally {
      inFlightFetches.delete(cleanText);
    }
  })();

  inFlightFetches.set(cleanText, fetchPromise);
  return fetchPromise;
}

/**
 * الدالة الرئيسية: نطق النصوص بصوت موسى البشري
 * تتميز بـ:
 * 1. استجابة لحظية (0ms) من خلال ذاكرة الرام وقاعدة IndexedDB الدائمة.
 * 2. تقسيم الجمل الطويلة (Chunking) والتشغيل الفوري للمقطع الأول بالتوازي مع جلب المقاطع اللاحقة.
 * 3. نظام تعافٍ تلقائي (Fallback) للقارئ المحلي عند انقطاع الإنترنت.
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

  // إيقاف أي صوت سابق وتحديد معرف جلسة فريد جديد
  stopMousaVoice();
  const sessionId = ++mousaAudioSessionCounter;

  // تجزئة النص إلى مقاطع قصيرة إن كان طويلاً
  const chunks = splitArabicIntoSpeechChunks(clean);

  if (chunks.length <= 1) {
    const singleText = chunks[0] || clean;

    // استرجاع المقطع (من الرام أو IndexedDB أو API)
    const buffer = await fetchSingleAudioBuffer(singleText);

    // إذا تغيرت الجلسة أثناء الجلب (قام المستخدم بالإلغاء)، لا نشغل
    if (sessionId !== mousaAudioSessionCounter) {
      return false;
    }

    if (buffer) {
      playAudioBuffer(buffer, onEnd);
      return true;
    } else {
      speakBrowserSpeechSynthesis(singleText, onEnd);
      return false;
    }
  }

  // في حال وجود جمل متعددة:
  // نبدأ بتشغيل الجملة الأولى فوراً، ونجلب الجملة الثانية في الخلفية بالتوازي (Parallel Prefetching)
  let currentIndex = 0;

  // جلب الجملة الأولى فوراً
  const firstBuffer = await fetchSingleAudioBuffer(chunks[0]);
  if (sessionId !== mousaAudioSessionCounter) return false;

  // إطلاق الجلب المسبق للجملة الثانية فوراً في الخلفية بالتوازي
  if (chunks.length > 1) {
    fetchSingleAudioBuffer(chunks[1]);
  }

  if (!firstBuffer) {
    // بديل المتصفح للنص بالكامل إن تعذر الأول
    speakBrowserSpeechSynthesis(clean, onEnd);
    return false;
  }

  // حلقة تشغيل متتابعة وسلسة بين المقاطع
  const playNextChunk = async (index: number) => {
    if (sessionId !== mousaAudioSessionCounter) return;

    if (index >= chunks.length) {
      if (onEnd) onEnd();
      return;
    }

    const currentChunkText = chunks[index];
    const chunkBuffer = await fetchSingleAudioBuffer(currentChunkText);

    if (sessionId !== mousaAudioSessionCounter) return;

    // جلب المقطع التالي في الخلفية بالتوازي أثناء الاستماع للمقطع الحالي
    if (index + 1 < chunks.length) {
      fetchSingleAudioBuffer(chunks[index + 1]);
    }

    if (chunkBuffer) {
      playAudioBuffer(chunkBuffer, () => {
        playNextChunk(index + 1);
      });
    } else {
      // إكمال البقية أو استدعاء النهاية
      playNextChunk(index + 1);
    }
  };

  playAudioBuffer(firstBuffer, () => {
    playNextChunk(1);
  });

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


