import React, { useRef, useEffect, useState } from 'react';
import { 
  X, Download, Share2, Sparkles, Check, 
  Award, Heart, Calendar, ArrowRight 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ChildBadge } from '../types';

interface ShareableBadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  badge: ChildBadge | null;
  studentName?: string;
}

export const ShareableBadgeModal: React.FC<ShareableBadgeModalProps> = ({
  isOpen,
  onClose,
  badge,
  studentName = 'موسى البطل'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    if (isOpen && badge) {
      // إطلاق احتفال خفيف عند فتح بطاقة الإنجاز
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
      drawBadgeCard();
    }
  }, [isOpen, badge, studentName]);

  const drawBadgeCard = () => {
    if (!canvasRef.current || !badge) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsGenerating(true);

    const width = 800;
    const height = 500;
    canvas.width = width;
    canvas.height = height;

    // 1. الخلفية: تدرج زمردي ملكي دافئ وفخم
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, 450);
    bgGrad.addColorStop(0, '#064e3b'); // emerald-900
    bgGrad.addColorStop(0.5, '#022c22'); // emerald-950
    bgGrad.addColorStop(1, '#0f172a'); // slate-900
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. نجوم وزخارف هندسية إسلامية رقيقة في الخلفية
    ctx.fillStyle = 'rgba(251, 191, 36, 0.08)'; // ذهبي خفيف
    for (let i = 0; i < 40; i++) {
      const x = (i * 73) % width;
      const y = (i * 97) % height;
      ctx.beginPath();
      ctx.arc(x, y, (i % 3) + 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. إطار خارجي ذهبي مزدوج مع زوايا مزخرفة
    ctx.strokeStyle = '#d97706'; // amber-600
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    ctx.strokeStyle = '#fef08a'; // yellow-200
    ctx.lineWidth = 1.5;
    ctx.strokeRect(26, 26, width - 52, height - 52);

    // علامات زوايا الإطار
    const drawCorner = (x: number, y: number) => {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCorner(26, 26);
    drawCorner(width - 26, 26);
    drawCorner(26, height - 26);
    drawCorner(width - 26, height - 26);

    // 4. البسملة والترويسة
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';

    ctx.fillStyle = '#fde68a'; // amber-200
    ctx.font = 'normal 15px "Traditional Arabic", Arial, sans-serif';
    ctx.fillText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', width / 2, 58);

    ctx.fillStyle = '#fbbf24'; // ذهبي ساطع
    ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
    ctx.fillText('شَهَادَةُ إِنْجَازٍ وَتَمَيُّزٍ رَفِيعٍ 🏆', width / 2, 95);

    ctx.fillStyle = '#6ee7b7'; // emerald-300
    ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx.fillText('مَنَصَّةُ «تَعَلَّمْ مَعَ مُوسَى» لِتَعْلِيمِ اللُّغَةِ العَرَبِيَّةِ الفُصْحَى', width / 2, 122);

    // خط فاصل ذهبي
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 180, 136);
    ctx.lineTo(width / 2 + 180, 136);
    ctx.stroke();

    // 5. عبارة المنح واسم الطالب
    ctx.fillStyle = '#e2e8f0'; // slate-200
    ctx.font = 'normal 16px "Segoe UI", Arial, sans-serif';
    ctx.fillText('تَمْنَحُ المَنَصَّةُ هَذَا الوِسَامَ لِلْبَطَلِ النَّجِيبِ:', width / 2, 168);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif';
    ctx.fillText(studentName, width / 2, 208);

    // 6. بطاقة الوسام المركزية المضيئة
    const boxX = 70;
    const boxY = 230;
    const boxW = width - 140;
    const boxH = 120;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 18);
    ctx.fill();
    ctx.stroke();

    // رسم أيقونة الوسام
    ctx.font = '46px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.fillText(badge.icon || '🏅', width / 2, boxY + 52);

    // اسم الوسام
    ctx.fillStyle = '#fef08a'; // yellow-200
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(badge.title, width / 2, boxY + 84);

    // وصف الإنجاز
    ctx.fillStyle = '#cbd5e1'; // slate-300
    ctx.font = 'normal 14px "Segoe UI", Arial, sans-serif';
    ctx.fillText(badge.description, width / 2, boxY + 107);

    // 7. عبارة تشجيعية من موسى
    ctx.fillStyle = '#a7f3d0'; // emerald-200
    ctx.font = 'italic bold 15px "Segoe UI", Arial, sans-serif';
    ctx.fillText('«أَنَا فَخُورٌ بِكَ يَا بَطَلَ لُغَةِ الضَّادِ! وَاصِلْ تَمَيُّزَكَ وَإِبْدَاعَكَ مَعِي دَائِمًا! 🌟»', width / 2, 388);

    ctx.fillStyle = '#fcd34d'; // amber-300
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('— رَفِيقُكَ المُحِبّ: مُوسَى', width / 2, 410);

    // 8. الذيل: التاريخ والختم والرابط
    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.font = 'normal 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`📅 تَارِيخُ الإِنْجَازِ: ${badge.earnedAt || 'اليوم'}`, width - 50, 455);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#34d399'; // emerald-400
    ctx.fillText('خَتْمُ التَّفَوُّقِ وَالإِتْقَانِ المَعْتَمَدِ 🏅', 50, 455);

    setIsGenerating(false);
  };

  const handleDownloadPNG = () => {
    if (!canvasRef.current || !badge) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `وسام_موسى_${studentName.replace(/\s+/g, '_')}_${badge.title.replace(/\s+/g, '_')}.png`;
    link.click();
  };

  const handleShareWhatsApp = () => {
    if (!badge) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const message = 
      `🎉 *ما شاء الله تبارك الله! إنجاز متميز* 🌟\n\n` +
      `حقق بطلنا العزيز *${studentName}* وساماً جديداً في منصة *تعلَّم مع موسى* 🏆\n\n` +
      `🏅 *الوسام المكتسب:* ${badge.title}\n` +
      `📜 *تفاصيل الإتقان:* ${badge.description}\n` +
      `📅 *التاريخ:* ${badge.earnedAt}\n\n` +
      `«أَنَا فَخُورٌ بِكَ يَا بَطَلَ لُغَةِ الضَّادِ! وَاصِلْ تَمَيُّزَكَ!» — صديقك موسى 🌟\n\n` +
      `تفقدوا رحلة التعلّم الممتعة عبر المنصة: ${origin}`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  if (!isOpen || !badge) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
      <div 
        id="shareable-badge-modal"
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-amber-200 shadow-2xl overflow-hidden"
        dir="rtl"
      >
        {/* الترويسة */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-4 sm:p-5 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shadow-xs">
              {badge.icon || '🏅'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-base sm:text-lg">
                  مشاركة وسام الإنجاز مع العائلة 🌟
                </h3>
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-black">
                  بطاقة فخر معتمدة
                </span>
              </div>
              <p className="text-xs text-amber-100">
                شارك فرحة تفوق البطل ({studentName}) في اللغة العربية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* محتوى البطاقة والمعاينة */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* لوحة الرسم / بطاقة الإنجاز البصرية عالية الدقة */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-amber-300 shadow-xl bg-slate-950 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className="w-full h-auto object-contain block max-h-[380px]"
            />
          </div>

          {/* تفاصيل سريعة عن الوسام */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-xl">{badge.icon}</span>
              <div>
                <h5 className="font-black text-amber-950">{badge.title}</h5>
                <p className="text-[11px] text-slate-600">{badge.description}</p>
              </div>
            </div>
            <span className="px-2 py-1 bg-amber-200/80 text-amber-900 rounded-lg text-[10px] font-black shrink-0">
              {badge.earnedAt}
            </span>
          </div>

          {/* خيارات المشاركة المباشرة */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* خيار 1: تحميل البطاقة كصورة PNG */}
            <button
              type="button"
              onClick={handleDownloadPNG}
              className="px-4 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-emerald-200 transition flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>تحميل البطاقة كصورة (Download PNG)</span>
            </button>

            {/* خيار 2: مشاركة فورية عبر واتساب */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-4 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 active:scale-98 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-green-200 transition flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              <span>مشاركة عبر واتساب (Share WhatsApp)</span>
            </button>
          </div>
        </div>

        {/* ذيل النافذة */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px] text-amber-800 font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> تصميم مبهج مخصص للمشاركة مع أولياء الأمور والعائلة
          </span>

          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-600 hover:text-slate-800 font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
