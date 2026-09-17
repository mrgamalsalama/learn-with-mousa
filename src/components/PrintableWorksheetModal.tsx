import React, { useState } from 'react';
import { 
  X, Printer, Download, Sparkles, RefreshCw, FileText, 
  CheckCircle2, Share2, BookOpen
} from 'lucide-react';
import { generatePrintableWorksheet } from '../geminiService';

interface PrintableWorksheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  grade?: string;
  weakLetters: string[];
}

export const PrintableWorksheetModal: React.FC<PrintableWorksheetModalProps> = ({
  isOpen,
  onClose,
  studentName,
  grade = 'الصف الأول الابتدائي',
  weakLetters,
}) => {
  const [worksheetContent, setWorksheetContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // توليد ورقة العمل عند طلبها
  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const content = await generatePrintableWorksheet(studentName, grade, weakLetters);
      setWorksheetContent(content);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !worksheetContent) {
      handleGenerate();
    }
  }, [isOpen]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([worksheetContent], { type: 'text/markdown;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `ورقة_عمل_${studentName}_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
      <div 
        className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-emerald-200 shadow-2xl overflow-hidden"
        dir="rtl"
      >
        {/* الترويسة العلوية */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-800 p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-900 font-black flex items-center justify-center shadow-md text-2xl">
              📝
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg">مُوَلِّدُ أَوْرَاقِ العَمَلِ وَالأَنْشِطَةِ المَنْزِلِيَّة</h3>
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold">
                  AI Worksheet Generator
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                أَوْرَاقُ عَمَلٍ عِلَاجِيَّةٌ مُخَصَّصَةٌ لِلطَّالِبِ ({studentName}) جَاهِزَةٌ لِلطِّبَاعَةِ الفَوْرِيَّة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !worksheetContent}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-xs flex items-center gap-1.5 transition shadow-sm"
              title="طباعة"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">طباعة فورية</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isLoading || !worksheetContent}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs flex items-center gap-1.5 transition"
              title="تحميل"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">حفظ ملف</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* مساحة المعاينة */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-slate-100/70">
          {/* معلومات الحروف المستهدفة */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">الحروف المستهدفة في هذه الورقة:</span>
              <div className="flex gap-1">
                {weakLetters.map((ltr) => (
                  <span key={ltr} className="px-2 py-0.5 bg-rose-100 text-rose-800 font-black text-xs rounded-md border border-rose-200">
                    حرف {ltr}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading}
              className="text-xs text-emerald-700 font-bold flex items-center gap-1 hover:underline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>إعادة التوليد بنموذج جديد</span>
            </button>
          </div>

          {isLoading ? (
            <div className="p-16 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-spin">
                <RefreshCw className="w-7 h-7" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-800">
                الذَّكَاءُ الاصْطِنَاعِيُّ يُعِدُّ وَرَقَةَ العَمَلِ العِلَاجِيَّة... 📝
              </h4>
              <p className="text-xs text-slate-500">
                يَتِمُّ صِيَاغَةُ التَّمَارِينِ وَتَشْكِيلُ الكَلِمَاتِ وَتَنْسِيقُ أَقْسَامِ الوَرَقَة
              </p>
            </div>
          ) : (
            /* حاوية الورقة القابلة للطباعة */
            <div 
              id="printable-worksheet"
              className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-md space-y-6 text-slate-900 font-serif leading-relaxed"
            >
              {/* ترويسة الورقة الرسمية */}
              <div className="border-b-2 border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-wide">
                    مَنَصَّةُ تَعَلَّمْ مَعَ مُوسَى | وَرَقَةُ عَمَلٍ مَنْزِلِيَّة
                  </h2>
                  <p className="text-xs text-slate-600 font-sans mt-0.5">
                    بَرْنَامَجُ التَّعْزِيزِ اللُّغَوِيِّ وَتَمْيِيزِ الحُرُوفِ العَرَبِيَّة
                  </p>
                </div>
                <div className="text-left text-xs font-sans text-slate-600 space-y-0.5">
                  <p><b>الطَّالِب:</b> {studentName}</p>
                  <p><b>الصَّف:</b> {grade}</p>
                  <p><b>التَّارِيخ:</b> {new Date().toLocaleDateString('ar-EG')}</p>
                </div>
              </div>

              {/* محتوى الورقة */}
              <div className="whitespace-pre-wrap font-sans text-sm sm:text-base leading-loose text-slate-800">
                {worksheetContent}
              </div>

              {/* تذييل الورقة */}
              <div className="border-t border-slate-300 pt-4 flex items-center justify-between text-xs text-slate-500 font-sans">
                <span>تم إعداد هذه الورقة آلياً بواسطة رفيق الذكاء الاصطناعي (Gemini AI)</span>
                <span>منصة تعلم مع موسى © {new Date().getFullYear()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
