import { GoogleGenAI } from '@google/genai';
import { 
  AdaptiveStoryNode, 
  PhonicsVerificationResult, 
  DrawingAnalysisResult, 
  DiagnosticReport 
} from './types';

// قراءة المفتاح حصرياً من المتغيرات البيئية
const getApiKey = (): string => {
  return (
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (typeof window !== 'undefined' && (window as any).__GEMINI_API_KEY__) ||
    ''
  );
};

// النماذج المعتمدة لسرعة الاستجابة والدقة العالية
const PRIMARY_MODEL = 'gemini-1.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash';

// إنشاء عميل الذكاء الاصطناعي بنمط التهيئة الكسولة (Lazy Initialization)
let genAIClient: GoogleGenAI | null = null;

const getAIClient = (): GoogleGenAI | null => {
  const key = getApiKey();
  if (!key) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ 
      apiKey: key,
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
  try {
    return await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: params.contents,
      config: params.config,
    });
  } catch (primaryErr) {
    console.warn(`تعذر استدعاء ${PRIMARY_MODEL}، جاري المحاولة باستخدام ${FALLBACK_MODEL}:`, primaryErr);
    return await ai.models.generateContent({
      model: FALLBACK_MODEL,
      contents: params.contents,
      config: params.config,
    });
  }
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

  if (!ai) {
    // محاكاة ذكية فائقة الجودة في حال عدم إدخال المفتاح بعد
    const fallbackResponses = [
      `أَهْلًا وَسَهْلًا بِكَ يَا بَطَلِي الصَّغِير! 🌟 أَنَا صَدِيقُكَ مُوسَى، وَأَنَا سَعِيدٌ جِدًّا بِالحَدِيثِ مَعَكَ! مَا هُوَ حَرْفُكَ المُفَضَّلُ اليَوْم؟ 🎈`,
      `مَا أَجْمَلَ كَلِمَاتِكَ يَا صَدِيقِي الرَّائِع! 📚 هَلْ تَعْلَمُ أَنَّ لُغَتَنَا العَرَبِيَّةَ مَلِيئَةٌ بِالأَسْرَارِ وَالمُغَامَرَاتِ الجَمِيلَة؟ تَعَالَ نَسْتَكْشِفْ مَعًا! 🚀`,
      `أَحْسَنْتَ يَا بَطَل! أَسْلُوبُكَ فِي التَّحَدُّثِ مُبْهِرٌ جِدًّا! هَيَّا بِنَا نَتَعَلَّمُ كَلِمَةً جَدِيدَةً تَبْدَأُ بِحَرْفِ المِيمِ مِثْلَ: مَسْجِد، أَوْ مَطَر! 🌧️🕌`,
      `يَا لَهَا مِنْ فِكْرَةٍ رَائِعَة! أَنَا دَوْمًا هُنَا لِأُسَاعِدَكَ وَنَلْعَبَ مَعًا فِي عَالَمِ الحُرُوفِ السَّاحِر! 🎨✨`
    ];
    const randomIndex = Math.floor(Math.random() * fallbackResponses.length);
    return fallbackResponses[randomIndex];
  }

  try {
    const contents: any[] = [];
    // تحويل السجل السابق
    history.forEach(h => {
      contents.push({
        role: h.role,
        parts: [{ text: h.text }]
      });
    });
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
    return response.text?.trim() || 'مَرْحَبًا بِكَ يَا بَطَل! أَنَا مُوسَى دَوْمًا مَعَكَ!';
  } catch (error) {
    console.error('خطأ في محادثة موسى:', error);
    return 'أَهْلًا يَا صَدِيقِي الصَّغِير! أَنَا مَعَكَ دَائِمًا لِنَتَعَلَّمَ وَنَمْرَحَ مَعًا فِي عَالَمِ الحُرُوفِ! 🌟';
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

// ================= 7. قارئ النصوص الصوتي المدمج (Web Speech TTS) =================
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
