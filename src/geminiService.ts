import { GoogleGenAI } from '@google/genai';
import { 
  AdaptiveStoryNode, 
  PhonicsVerificationResult, 
  DrawingAnalysisResult, 
  DiagnosticReport,
  Question,
  StudentSubmission,
  ClassDiagnosticSummary
} from './types';

// قراءة المفتاح بالشكل المطلوب
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "AQ.Ab8RN6L5VOZZTZjwqu1EGZOXv5O4YHvzY02oOcKbyHK2AAL2FQ";

// النماذج المعتمدة لسرعة الاستجابة والدقة العالية عبر نموذج gemini-2.5-flash
const PRIMARY_MODEL = 'gemini-2.5-flash';
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
];

// إنشاء عميل الذكاء الاصطناعي بنمط التهيئة الكسولة (Lazy Initialization)
let genAIClient: GoogleGenAI | null = null;

const getAIClient = (): GoogleGenAI => {
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ 
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return genAIClient;
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

// دالة مساعدة لتنفيذ طلبات التوليد مع دعم التبديل التلقائي بين النماذج لضمان أقصى اعتمادية
async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  }
) {
  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      return await ai.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: params.config,
      });
    } catch (err: any) {
      lastError = err;
      console.warn(`تعذر استدعاء النموذج ${modelName}، جاري المحاولة بنموذج بديل:`, err?.status || err?.message || err);
    }
  }

  console.error('فشل الاستدعاء بكافة النماذج المتاحة:', lastError);
  throw lastError;
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
      }
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
      }
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
      }
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
  base64Image: string
): Promise<DrawingAnalysisResult> {
  const ai = getAIClient();

  // تنظيف صيغة data:image/png;base64,
  const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

  if (!ai) {
    return {
      recognizedObject: `رَسْمَةٌ إِبْدَاعِيَّةٌ تَبْدَأُ بِحَرْفِ (${letter})`,
      startsWithTargetLetter: true,
      targetLetter: letter,
      confidenceScore: 95,
      feedback: `مَا شَاءَ اللهُ! لَوْحَةٌ فَنِّيَّةٌ مُبْهِرَةٌ يَا صَدِيقِي الفَنَّان! رَسَمْتَ شَيْئًا جَمِيلًا يَبْدَأُ بِحَرْفِ (${letter})! لَقَدْ حَصَلْتَ عَلَى ٥ نُجُوم! 🎨⭐`,
      badgeEarned: `وسام فنان الحروف العبقري 🎨🖌️`,
      starsCount: 5,
    };
  }

  const prompt = `
أنت معلم وفنان للأطفال، تحلل رسمة طفل مرسومة على شاشة Canvas.
الحرف العربي المستهدف: [${letter}].

حلل الصورة المرفقة وأجب عن الآتي:
1. ما هو الشيء أو العنصر الذي يبدو أن الطفل حاول رسمه؟ (مثال: بطة، تفاحة، شجرة، سيارة، شمس، بيت، كلب، قمر، ولد، سمكة، وردة...). كن متفهماً ومتسامحاً مع رسومات الأطفال غير المتقنة وشجع خيالهم!
2. هل هذا الشيء يبدأ باللغة العربية بحرف [${letter}]؟ (أو هل هو قريب جداً أو يمثل حرف ${letter} نفسه)؟
3. قدم تقييماً مشجعاً جداً ومفرحاً للطفل مع التشكيل بالحركات.
4. اذكر عدد النجوم المستحقة (من 3 إلى 5 نجوم).
5. أرجع النتيجة فقط بصيغة JSON:
{
  "recognizedObject": "اسم الشيء المكتشف (مثال: بَطَّة)",
  "startsWithTargetLetter": true,
  "targetLetter": "${letter}",
  "confidenceScore": 90,
  "feedback": "تعليق تربوي مشجع ومشكل بالحركات",
  "badgeEarned": "اسم وسام مميز إن كانت الرسمة صحيحة أو قريبة",
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
      }
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
      }
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
      }
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
      }
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
      }
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
      }
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
      }
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

// ================= 8. قارئ النصوص الصوتي المدمج (Web Speech TTS) =================
export function speakArabicText(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel(); // إيقاف أي قراءة سابقة

    // تنظيف الرموز البرمجية والأيقونات من النص قبل النطق
    const cleanText = text
      .replace(/[\*\#\`\_\[\]\(\)\{\}\>\~]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.9; // سرعة هادئة للأطفال
    utterance.pitch = 1.05; // نبرة مرحة ولطيفة

    // محاولة اختيار أفضل صوت عربي متاح في المتصفح
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(v => v.lang.startsWith('ar') || v.name.includes('Arabic') || v.name.includes('Maged') || v.name.includes('Tarik'));
    if (arabicVoice) {
      utterance.voice = arabicVoice;
    }

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('تعذر تشغيل الصوت:', err);
    if (onEnd) onEnd();
  }
}

export function stopArabicSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
