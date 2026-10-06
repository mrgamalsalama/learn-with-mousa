import { KnowledgeNodeQuestion } from '../types';
import { getSingleSounds50Questions, getShortVowels50Questions, getSukunSegments50Questions } from './questionBanks/level1Questions';
import { getLongVowels50Questions, getTanween50Questions, getShaddah50Questions, getShamsQamar50Questions, getTaaTypes50Questions } from './questionBanks/level2Questions';
import { getWordParts50Questions, getSentenceStructures50Questions, getSubjectVerb50Questions } from './questionBanks/level3Questions';
import { getLiteralComprehension50Questions, getInferentialReading50Questions, getVocabInContext50Questions } from './questionBanks/level4Questions';
import { getSentenceCombining50Questions, getFigurativeLanguage50Questions, getCriticalAppreciation50Questions } from './questionBanks/level5Questions';

/**
 * بنك الأسئلة الأكاديمي المراجع لشجرة الكفايات التكيفية (Adaptive Knowledge Questions Bank)
 * يوفر 50 سؤالاً مراجعاً أكاديمياً فريداً مشكولاً لكل مهارة من مهارات الشجرة الـ 17 (إجمالي 850 سؤالاً مراجعاً معتمداً).
 */
export const NODE_QUESTION_GENERATORS: Record<string, () => KnowledgeNodeQuestion[]> = {
  // المستوى 1: التأسيس الصوتي الأولي (الوعي الصوتي والفونيمي)
  node_single_sounds: getSingleSounds50Questions,
  node_short_vowels: getShortVowels50Questions,
  node_sukun_segments: getSukunSegments50Questions,

  // المستوى 2: فك الترميز والظواهر الإملائية
  node_long_vowels: getLongVowels50Questions,
  node_tanween: getTanween50Questions,
  node_shaddah: getShaddah50Questions,
  node_shams_qamar: getShamsQamar50Questions,
  node_taa_types: getTaaTypes50Questions,

  // المستوى 3: الصرف وبنية الكلمة والنحو
  node_word_parts: getWordParts50Questions,
  node_sentence_structures: getSentenceStructures50Questions,
  node_subject_verb_agreement: getSubjectVerb50Questions,

  // المستوى 4: الفهم القرائي والاستيعاب
  node_literal_comprehension: getLiteralComprehension50Questions,
  node_inferential_reading: getInferentialReading50Questions,
  node_vocab_in_context: getVocabInContext50Questions,

  // المستوى 5: التعبير والبلاغة والجماليات
  node_sentence_combining: getSentenceCombining50Questions,
  node_figurative_language: getFigurativeLanguage50Questions,
  node_critical_appreciation: getCriticalAppreciation50Questions,
};

/**
 * استرجاع مصفوفة الـ 50 سؤالاً المراجعة أكاديمياً لعقدة معينة
 */
export function getNodeQuestions(nodeId: string): KnowledgeNodeQuestion[] {
  const generator = NODE_QUESTION_GENERATORS[nodeId];
  if (generator) {
    return generator();
  }
  return getSingleSounds50Questions();
}

/**
 * الحصول على عدد الأسئلة الإجمالي في بنك الأسئلة
 */
export function getTotalBankQuestionsCount(): number {
  return Object.keys(NODE_QUESTION_GENERATORS).length * 50;
}
