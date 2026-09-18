import React from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { AudioInteractionState } from '../types';

interface MousaSpeakingAvatarProps {
  src?: string;
  isSpeaking?: boolean;
  state?: AudioInteractionState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const MousaSpeakingAvatar: React.FC<MousaSpeakingAvatarProps> = ({
  src = '/mousa-avatar.png',
  isSpeaking = false,
  state,
  size = 'md',
  className = ''
}) => {
  const speaking = state ? state === 'speaking' : isSpeaking;

  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {/* موجات نبضية متزامنة وناعمة عند تحدث موسى */}
      {speaking && (
        <>
          {/* الموجة الخارجية الأولى */}
          <span className="absolute inset-0 rounded-full bg-amber-400/40 animate-ping duration-1000 pointer-events-none scale-125" />
          {/* الموجة الوسطى المتوهجة */}
          <span className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-amber-400 via-emerald-400 to-amber-300 opacity-60 animate-pulse blur-xs pointer-events-none" />
          {/* حلقة التردد الصوتية الإضافية */}
          <span className="absolute -inset-3 rounded-full border-2 border-dashed border-amber-300/60 animate-spin duration-[6000ms] pointer-events-none" />
        </>
      )}

      {/* دائرة الشعار أو الصورة */}
      <div
        className={`relative ${sizeClasses[size]} rounded-full bg-gradient-to-tr from-amber-400 via-amber-300 to-amber-100 border-2 border-white shadow-md flex items-center justify-center overflow-hidden transition-all duration-300 ${
          speaking ? 'ring-3 ring-amber-400 scale-105 shadow-amber-400/50' : ''
        }`}
      >
        <img
          src={src}
          alt="موسى"
          className="w-full h-full object-contain p-1 transform transition-transform"
        />
      </div>

      {/* شارة التردد الصوتي الحية بجانب الشعار */}
      {speaking && (
        <span className="absolute -bottom-1 -right-1 flex items-center gap-0.5 bg-slate-900/90 text-amber-300 px-1.5 py-0.5 rounded-full shadow-md border border-amber-300/40 text-[9px] font-black z-10 animate-bounce">
          <span className="w-1 h-2 bg-amber-400 rounded-full animate-[pulse_0.4s_ease-in-out_infinite]" />
          <span className="w-1 h-3.5 bg-emerald-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite_0.15s]" />
          <span className="w-1 h-2 bg-amber-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.3s]" />
        </span>
      )}
    </div>
  );
};

interface ChildMicWaveVisualizerProps {
  isListening: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showTextLabel?: boolean;
}

export const ChildMicWaveVisualizer: React.FC<ChildMicWaveVisualizerProps> = ({
  isListening,
  onClick,
  disabled = false,
  size = 'md',
  className = '',
  showTextLabel = false
}) => {
  const sizeClasses = {
    sm: 'p-2 text-xs',
    md: 'p-3 text-sm',
    lg: 'p-4 text-base'
  };

  return (
    <div className="relative inline-flex items-center gap-2">
      {/* زر الميكروفون مع تأثير الموجات الصوتية المتذبذبة */}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`relative transition-all duration-300 rounded-2xl flex items-center justify-center font-bold select-none disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${
          isListening
            ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 text-white shadow-lg shadow-rose-500/30 scale-105'
            : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/80 hover:scale-102 active:scale-95 shadow-xs'
        } ${className}`}
        title={isListening ? 'جارٍ الاستماع لصوتك باهتمام... انقر للتوقف' : 'انقر للتحدث مع موسى بصوتك'}
      >
        {/* حلقات نبضية متحركة خارجية عند الاستماع */}
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-2xl bg-rose-400/40 animate-ping pointer-events-none scale-110" />
            <span className="absolute -inset-1 rounded-2xl bg-rose-500/20 animate-pulse pointer-events-none" />
          </>
        )}

        {/* عرض الموجات الصوتية الحية أثناء الاستماع أو أيقونة الميكروفون عند السكون */}
        {isListening ? (
          <div className="flex items-center gap-1 px-1 h-5 z-10">
            <span className="w-1 bg-white rounded-full h-2 animate-[pulse_0.4s_ease-in-out_infinite]" />
            <span className="w-1 bg-white rounded-full h-4 animate-[pulse_0.6s_ease-in-out_infinite_0.1s]" />
            <span className="w-1.5 bg-amber-200 rounded-full h-5 animate-[pulse_0.5s_ease-in-out_infinite_0.2s]" />
            <span className="w-1 bg-white rounded-full h-3 animate-[pulse_0.7s_ease-in-out_infinite_0.3s]" />
            <span className="w-1 bg-white rounded-full h-2 animate-[pulse_0.4s_ease-in-out_infinite_0.15s]" />
          </div>
        ) : (
          <Mic className={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} />
        )}
      </button>

      {/* تسمية توضيحية اختيارية */}
      {showTextLabel && (
        <span
          className={`text-xs font-bold transition ${
            isListening ? 'text-rose-600 animate-pulse' : 'text-slate-500'
          }`}
        >
          {isListening ? 'موسى يستمع إليك الآن... 🎙️' : 'تحدث مع موسى'}
        </span>
      )}
    </div>
  );
};
