import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, Volume2, VolumeX, Sparkles, Bot, 
  MessageCircle, RefreshCw, Smile, Star, Heart, AlertTriangle
} from 'lucide-react';
import { MusaChatMessage } from '../types';
import { chatWithMusa, speakWithMousaVoice, stopMousaVoice, isMousaVoiceCached } from '../geminiService';
import { isAIFeatureAllowed, canUserUseAI, getCurrentUser } from '../storage';
import { MousaSpeakingAvatar, ChildMicWaveVisualizer } from './AudioInteractionVisualizer';

// مسار شعار شخصية موسى الرسمي المعتمد في المنصة
const MOUSA_AVATAR_SRC = '/mousa-avatar.png';

interface MusaCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName?: string;
}

export const MusaCompanionModal: React.FC<MusaCompanionModalProps> = ({
  isOpen,
  onClose,
  studentName = 'صديقي البطل'
}) => {
  const [messages, setMessages] = useState<MusaChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'musa',
      text: `أَهْلًا وَسَهْلًا بِكَ يَا ${studentName}! 🌟 أَنَا صَدِيقُكَ مُوسَى، وَأَنَا هُنَا لِأَتَحَدَّثَ مَعَكَ، وَنَتَعَلَّمَ أَجْمَلَ الحُرُوفِ وَالكَلِمَاتِ العَرَبِيَّة! مَاذَا تُحِبُّ أَنْ نَفْعَلَ اليَوْم؟ 🎈`,
      timestamp: 'الآن',
      hasAudio: true,
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // إيقاف الصوت عند إغلاق النافذة
  useEffect(() => {
    return () => {
      stopMousaVoice();
      setPlayingMessageId(null);
      setIsSpeaking(false);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // إعداد التعرف الصوتي (Web Speech Recognition)
  const toggleSpeechRecognition = () => {
    if (isVoiceActive) {
      recognitionRef.current?.stop();
      setIsVoiceActive(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('عذراً، خاصية الاستماع الصوتي غير مدعومة في متصفحك الحالي، يمكنك الكتابة أو اختيار العبارات الجاهزة!');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsVoiceActive(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsVoiceActive(false);
        handleSend(transcript);
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        setIsVoiceActive(false);
      };

      recognition.onend = () => {
        setIsVoiceActive(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsVoiceActive(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || isLoading) return;

    stopMousaVoice();
    setIsSpeaking(false);

    const userMsg: MusaChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'child',
      text,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    // تحضير سجل المحادثة
    const history = messages.map(m => ({
      role: (m.sender === 'musa' ? 'model' : 'user') as 'user' | 'model',
      text: m.text,
    }));

    try {
      const reply = await chatWithMusa(history, text);
      const musaMsg: MusaChatMessage = {
        id: 'msg_musa_' + Date.now(),
        sender: 'musa',
        text: reply,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        hasAudio: true,
      };

      setMessages(prev => [...prev, musaMsg]);
    } catch (err: any) {
      console.error('خطأ في استلام رد موسى من النموذج:', err);
      const rawMsg = err?.message || String(err || '');
      let friendlyText = 'عُذْرًا يَا صَدِيقِي، حَدَثَ ضَغْطٌ بَسِيطٌ فِي الاِتِّصَالِ. جَرِّبْ إِرْسَالَ رِسَالَتِكَ مَرَّةً أُخْرَى الآن! 🌟';
      
      if (rawMsg.includes('حوكمة') || rawMsg.includes('صلاحية') || rawMsg.includes('معطلة')) {
        friendlyText = rawMsg;
      } else if (rawMsg.length > 0 && !rawMsg.includes('{') && !rawMsg.includes('code') && !rawMsg.includes('status')) {
        friendlyText = `عُذْرًا يَا صَدِيقِي، ${rawMsg}`;
      }

      const errorMsg: MusaChatMessage = {
        id: 'msg_err_' + Date.now(),
        sender: 'musa',
        text: friendlyText,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        hasAudio: false,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePlayMessage = (msgId: string, text: string) => {
    if (playingMessageId === msgId) {
      stopMousaVoice();
      setPlayingMessageId(null);
      setIsSpeaking(false);
    } else {
      stopMousaVoice();
      setPlayingMessageId(msgId);
      setIsSpeaking(true);
      speakWithMousaVoice(text, () => {
        setPlayingMessageId(null);
        setIsSpeaking(false);
      });
    }
  };

  const quickPrompts = [
    'مَرْحَبًا يَا مُوسَى! 👋',
    'أَخْبِرْنِي طُرْفَةً لَطِيفَةً! 🎈',
    'كَيْفَ أَنْطِقُ حَرْفَ البَاءِ؟ 🔤',
    'مَا رَأْيُكَ فِي مَهَارَاتِي؟ 🌟',
    'عَلِّمْنِي كَلِمَةً جَدِيدَةً! 📚',
  ];

  const currentUser = getCurrentUser();
  const userPermCheck = canUserUseAI(currentUser);
  const isStudentAIPermitted = userPermCheck.overrideStatus === 'inherit' 
    ? isAIFeatureAllowed('student').allowed 
    : userPermCheck.allowed;
  const permissionBlockReason = userPermCheck.reason || isAIFeatureAllowed('student').reason || 'محادثة الذكاء الاصطناعي معطلة حالياً بقرار من إدارة المنصة.';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div 
        id="musa-companion-modal"
        className="bg-white rounded-3xl w-full max-w-xl h-[90vh] max-h-[680px] flex flex-col border border-emerald-200 shadow-2xl overflow-hidden"
        dir="rtl"
      >
        {/* ترويسة نافذة موسى */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-4 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <MousaSpeakingAvatar
              src={MOUSA_AVATAR_SRC}
              isSpeaking={isSpeaking}
              size="md"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-base">مُوسَى | رَفِيقُكَ الذَّكِيّ</h3>
                <span className="px-2 py-0.5 bg-emerald-500/80 rounded-full text-[10px] font-bold text-amber-200 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> صوت بشري واقعي (Gemini Native)
                </span>
              </div>
              <p className="text-xs text-emerald-100 flex items-center gap-1">
                {isSpeaking ? (
                  <span className="text-amber-300 font-bold flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 animate-pulse" /> يَتَحَدَّثُ إِلَيْكَ الآن بنبرة موسى...
                  </span>
                ) : (
                  <span>مُتَّصِلٌ وَمُسْتَعِدٌّ لِلتَّعَلُّمِ وَالمَرَح 🎈</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsMuted(!isMuted);
                if (!isMuted) stopMousaVoice();
              }}
              className={`p-2 rounded-xl border transition ${
                isMuted ? 'bg-rose-500/20 border-rose-300 text-rose-200' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              }`}
              title={isMuted ? 'تفعيل الصوت' : 'كتم الصوت'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                stopMousaVoice();
                onClose();
              }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* جسم المحادثة */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70">
          {messages.map((msg) => {
            const isMusa = msg.sender === 'musa';
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isMusa ? 'items-start' : 'items-end flex-row-reverse'}`}
              >
                {isMusa ? (
                  <div className="w-8 h-8 rounded-full bg-amber-400 border border-white flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                    <img
                      src={MOUSA_AVATAR_SRC}
                      alt="موسى"
                      className="w-full h-full rounded-full object-contain p-0.5"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    أنا
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-3xl p-3.5 text-sm shadow-xs transition ${
                    isMusa
                      ? 'bg-white text-slate-800 border border-emerald-100 rounded-tr-xs'
                      : 'bg-emerald-600 text-white rounded-tl-xs'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap font-medium">
                    {msg.text}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/50 text-[10px]">
                    <span className={isMusa ? 'text-slate-400' : 'text-emerald-100'}>
                      {msg.timestamp}
                    </span>
                    {isMusa && (
                      <button
                        type="button"
                        onClick={() => handleTogglePlayMessage(msg.id, msg.text)}
                        className={`font-bold flex items-center gap-1.5 transition px-2.5 py-1 rounded-lg text-[11px] ${
                          playingMessageId === msg.id
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                        title={playingMessageId === msg.id ? 'إيقاف الاستماع' : 'استمع إلى موسى بصوته الأصلي'}
                      >
                        {playingMessageId === msg.id ? <VolumeX className="w-3.5 h-3.5 text-amber-700" /> : <Volume2 className="w-3.5 h-3.5" />}
                        <span>{playingMessageId === msg.id ? 'إيقاف ⏸️' : 'استمع إلى موسى 🔊'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-400 border border-white flex items-center justify-center shrink-0 animate-bounce overflow-hidden">
                <img
                  src={MOUSA_AVATAR_SRC}
                  alt="موسى يفكر"
                  className="w-full h-full rounded-full object-contain p-0.5"
                />
              </div>
              <div className="bg-white border border-emerald-100 rounded-3xl p-3.5 shadow-xs flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                <span className="text-xs text-emerald-800 font-bold">مُوسَى يُفَكِّرُ فِي رَدٍّ جَمِيلٍ لَكَ... 🎈</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* خيارات المحادثة السريعة للطفل */}
        {isStudentAIPermitted && (
          <div className="px-4 py-2 bg-white border-t border-slate-100 overflow-x-auto flex gap-1.5 no-scrollbar">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(prompt)}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold whitespace-nowrap transition transform active:scale-95"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* شريط الإدخال الصوتي والكتابي */}
        <div className="p-3 bg-white border-t border-slate-200">
          {!isStudentAIPermitted ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center gap-2 text-rose-800 text-xs font-bold text-center">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{permissionBlockReason}</span>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <ChildMicWaveVisualizer
                isListening={isVoiceActive}
                onClick={toggleSpeechRecognition}
                size="md"
              />

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isVoiceActive ? 'تحدث الآن، موسى يستمع إليك...' : 'اكتب رسالتك لموسى هنا...'}
                className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/70"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="p-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl transition shrink-0 shadow-md shadow-emerald-200"
                title="إرسال"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
