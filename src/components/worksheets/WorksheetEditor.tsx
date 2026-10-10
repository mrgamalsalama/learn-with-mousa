import React, { useState, useRef, useEffect } from 'react';
import { 
  InteractiveWorksheet, 
  WorksheetElement, 
  WorksheetElementType, 
  UserProfile, 
  GradeLevel, 
  STAGES_CONFIG 
} from '../../types';
import { 
  saveWorksheet, 
  SAMPLE_WORKSHEET_SVG_1, 
  SAMPLE_WORKSHEET_SVG_2 
} from '../../services/worksheetService';
import { convertPdfToImages } from '../../utils/pdfToImages';

interface WorksheetEditorProps {
  currentUser: UserProfile;
  initialWorksheet?: InteractiveWorksheet | null;
  onSave?: (saved: InteractiveWorksheet) => void;
  onCancel?: () => void;
  onOpenPlayer?: (worksheetId: string) => void;
}

export const WorksheetEditor: React.FC<WorksheetEditorProps> = ({
  currentUser,
  initialWorksheet,
  onSave,
  onCancel,
  onOpenPlayer,
}) => {
  // بيانات ورقة العمل الأساسية
  const [title, setTitle] = useState(initialWorksheet?.title || 'ورقة عمل تفاعلية جديدة');
  const [description, setDescription] = useState(initialWorksheet?.description || '');
  
  // دعم الصفحات المتعددة وملفات الـ PDF أو الصور
  const [pages, setPages] = useState<string[]>(() => {
    if (initialWorksheet?.pages && initialWorksheet.pages.length > 0) {
      return initialWorksheet.pages;
    }
    return [initialWorksheet?.image_url || initialWorksheet?.background_url || SAMPLE_WORKSHEET_SVG_1];
  });
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // نافذة الاختيار الأولى عند الإنشاء: رفع PDF أو صورة أو قالب جاهز
  const [showUploadModal, setShowUploadModal] = useState<boolean>(!initialWorksheet);

  const [selectedGrade, setSelectedGrade] = useState<string>(
    (initialWorksheet?.grade_level as string) || (currentUser.allowedGrades?.[0] as string) || 'grade-1'
  );
  const [elements, setElements] = useState<WorksheetElement[]>(
    initialWorksheet?.elements || []
  );

  // حالة العنصر المختار للتحرير
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  
  // شريط أدوات الرسم التفاعلي المتقدم:
  // 1. نص قصير | 2. سؤال مقالي | 3. اختيار مفرد | 4. خانة اختيار / صح وخطأ | 5. نقطة توصيل
  const [activeTool, setActiveTool] = useState<WorksheetElementType>('text');

  // وضع الرسم والإشارة بالفأرة / اللمس
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // وضع تحريك الصناديق المنشأة مسبقاً (Drag existing element)
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // مؤشر تحويل الـ PDF
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);

  // نافذة النشر والمشاركة
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishedWorksheet, setPublishedWorksheet] = useState<InteractiveWorksheet | null>(null);
  const [targetClass, setTargetClass] = useState<string>(
    initialWorksheet?.target_class_id || initialWorksheet?.class_id || ''
  );
  const [isPublic, setIsPublic] = useState(initialWorksheet?.is_public ?? true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // قائمة الصفوف المتاحة للمعلم
  const teacherAllowedGrades: { id: GradeLevel; labelAr: string }[] = [];
  Object.values(STAGES_CONFIG).forEach(stage => {
    stage.grades.forEach(g => {
      if (!currentUser.allowedGrades || currentUser.allowedGrades.length === 0 || currentUser.allowedGrades.includes(g.id)) {
        teacherAllowedGrades.push(g);
      }
    });
  });

  // حساب الدرجة الكلية للورقة (نقاط الهدف target لا تكرر احتساب الدرجة)
  const totalPoints = elements.reduce((acc, el) => {
    if (el.type === 'join_point' && el.joinRole === 'target') return acc;
    return acc + (Number(el.points) || 1);
  }, 0);

  // صورة الصفحة المعروضة حالياً
  const currentImageUrl = pages[currentPageIndex] || pages[0] || SAMPLE_WORKSHEET_SVG_1;

  // عناصر الصفحة الحالية فقط
  const currentPageElements = elements.filter(el => (el.page || 1) === (currentPageIndex + 1));

  // معالجة رفع الملف (صورة أو PDF)
  const processUploadedFile = async (file: File) => {
    setShowUploadModal(false);

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setIsConvertingPdf(true);
      setPdfProgress({ current: 0, total: 1 });
      showToast('جارِ قراءة مستند الـ PDF وتحويل صفحاته لورقة عمل تفاعلية...');

      try {
        const result = await convertPdfToImages(file, (curr, tot) => {
          setPdfProgress({ current: curr, total: tot });
        });

        if (result.pages.length > 0) {
          setPages(result.pages);
          setCurrentPageIndex(0);
          showToast(`تم تحويل ${result.totalPages} صفحة بنجاح! يمكنك الآن رسم الحقول التفاعلية.`);
        } else {
          showToast('تعذر استخراج صفحات من ملف الـ PDF');
        }
      } catch (err: any) {
        console.error('Error converting PDF:', err);
        showToast('حدث خطأ أثناء معالجة ملف الـ PDF: ' + (err.message || ''));
      } finally {
        setIsConvertingPdf(false);
        setPdfProgress(null);
      }
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        if (typeof loadEvt.target?.result === 'string') {
          const img = loadEvt.target.result;
          setPages([img]);
          setCurrentPageIndex(0);
          showToast('تم تحميل صورة ورقة العمل بنجاح! ارسم الحقول التفاعلية بالسحب.');
        }
      };
      reader.readAsDataURL(file);
    } else {
      showToast('يرجى اختيار ملف صالح: صورة (JPG, PNG) أو مستند (PDF)');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  // تحويل إحداثيات مؤشر الفأرة / اللمس إلى نسب مئوية داخل الحاوية
  const getContainerRelativeCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  // بدء رسم صندوق جديد
  const handleMouseDownOnCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingElementId) return;
    const { x, y } = getContainerRelativeCoords(e.clientX, e.clientY);
    setIsDrawing(true);
    setDrawStart({ x, y });
    setCurrentBox({ x, y, w: 0, h: 0 });
    setSelectedElementId(null);
  };

  // متابعة حركة الفأرة لرسم الصندوق أو تحريك عنصر موجود
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawing && drawStart) {
      const { x, y } = getContainerRelativeCoords(e.clientX, e.clientY);
      const left = Math.min(drawStart.x, x);
      const top = Math.min(drawStart.y, y);
      const w = Math.abs(x - drawStart.x);
      const h = Math.abs(y - drawStart.y);
      setCurrentBox({ x: left, y: top, w, h });
    } else if (draggingElementId) {
      const { x, y } = getContainerRelativeCoords(e.clientX, e.clientY);
      setElements(prev => prev.map(el => {
        if (el.id === draggingElementId) {
          const newX = Math.max(0, Math.min(100 - el.width, x - dragOffset.x));
          const newY = Math.max(0, Math.min(100 - el.height, y - dragOffset.y));
          return { ...el, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 };
        }
        return el;
      }));
    }
  };

  // إنهاء رسم الصندوق وإنشاء العنصر التفاعلي
  const handleMouseUp = () => {
    if (isDrawing && currentBox && drawStart) {
      setIsDrawing(false);
      // التأكد أن الصندوق ليس نقرة عابرة
      if (currentBox.w >= 1.5 && currentBox.h >= 1.2) {
        const newElement: WorksheetElement = {
          id: `elem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: activeTool,
          page: currentPageIndex + 1,
          x: Math.round(currentBox.x * 10) / 10,
          y: Math.round(currentBox.y * 10) / 10,
          width: Math.round(currentBox.w * 10) / 10,
          height: Math.round(currentBox.h * 10) / 10,
          correctAnswers: activeTool === 'text' ? [''] : undefined,
          keywords: activeTool === 'essay' ? [''] : undefined,
          minKeywordsRequired: activeTool === 'essay' ? 1 : undefined,
          isCorrect: activeTool === 'choice' || activeTool === 'checkbox' ? true : undefined,
          joinRole: activeTool === 'join_point' ? 'source' : undefined,
          joinGroup: activeTool === 'join_point' ? 'group_1' : undefined,
          points: 1,
          label: ''
        };
        setElements(prev => [...prev, newElement]);
        setSelectedElementId(newElement.id);
        showToast('تمت إضافة حقل تفاعلي! اضبط خياراته والدرجة من اللوحة الجانبية.');
      }
      setDrawStart(null);
      setCurrentBox(null);
    }

    if (draggingElementId) {
      setDraggingElementId(null);
    }
  };

  // بدء تحريك عنصر موجود
  const handleStartDragElement = (e: React.MouseEvent, el: WorksheetElement) => {
    e.stopPropagation();
    setSelectedElementId(el.id);
    setDraggingElementId(el.id);
    const { x, y } = getContainerRelativeCoords(e.clientX, e.clientY);
    setDragOffset({
      x: x - el.x,
      y: y - el.y
    });
  };

  // حذف عنصر
  const handleDeleteElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  // تعديل خصائص عنصر محدد
  const handleUpdateElement = (id: string, updates: Partial<WorksheetElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  // حفظ ورقة العمل وفتح نافذة النشر
  const handleSaveAndOpenPublish = async () => {
    if (!title.trim()) {
      showToast('يرجى كتابة عنوان ورقة العمل');
      return;
    }
    if (elements.length === 0) {
      showToast('يرجى إضافة حقل تفاعلي واحد على الأقل فوق الورقة');
      return;
    }

    setIsSaving(true);
    const worksheetToSave: InteractiveWorksheet = {
      id: initialWorksheet?.id || `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      school_id: currentUser.school_id || '00000000-0000-0000-0000-000000000001',
      teacher_id: currentUser.id,
      teacher_name: currentUser.name,
      class_id: targetClass || null,
      target_class_id: targetClass || null,
      title: title.trim(),
      description: description.trim(),
      grade_level: selectedGrade,
      subject: 'اللغة العربية',
      image_url: pages[0] || SAMPLE_WORKSHEET_SVG_1,
      background_url: pages[0] || SAMPLE_WORKSHEET_SVG_1,
      pages: pages,
      elements: elements,
      elements_schema: elements,
      total_points: totalPoints || 20,
      is_public: isPublic,
      is_public_link_enabled: isPublic,
      created_at: initialWorksheet?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const res = await saveWorksheet(worksheetToSave);
      setPublishedWorksheet(res.worksheet);
      setIsPublishModalOpen(true);
      if (onSave) onSave(res.worksheet);
      showToast('تم حفظ ورقة العمل بنجاح!');
    } catch (err) {
      console.error('Error saving worksheet:', err);
      showToast('حدث خطأ أثناء الحفظ، يرجى المحاولة ثانية');
    } finally {
      setIsSaving(false);
    }
  };

  // نسخ رابط المشاركة العام
  const copyPublicLink = () => {
    const id = publishedWorksheet?.id || initialWorksheet?.id || '';
    const shareUrl = `${window.location.origin}/worksheets/play/${id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
    showToast('تم نسخ الرابط العام بنجاح!');
  };

  const selectedElement = elements.find(el => el.id === selectedElementId);

  // قائمة نقاط التوصيل المتاحة للربط
  const availableTargetPoints = elements.filter(
    el => el.type === 'join_point' && el.joinRole === 'target' && el.id !== selectedElementId
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" dir="rtl">
      {/* شريط الإشعارات المؤقت */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* نافذة الاختيار الأولية للمعلم عند إنشاء ورقة عمل: رفع PDF أو صورة أو بدء بقالب */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
                📄
              </div>
              <h2 className="text-xl font-black text-slate-900">
                إنشاء ورقة عمل تفاعلية جديدة
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                اختر طريقة بدء ورقة العمل: رفع مستند PDF، صورة، أو تجربة نموذج جاهز
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* خيار 1: رفع مستند PDF */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-5 rounded-2xl border-2 border-dashed border-red-300 hover:border-red-500 bg-red-50/50 hover:bg-red-50 transition text-right group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center text-lg font-bold mb-3 shadow-sm group-hover:scale-105 transition">
                    📕
                  </div>
                  <h4 className="font-black text-sm text-slate-900 group-hover:text-red-700">
                    رفع ملف مستند PDF
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    تحويل صفحات الـ PDF تلقائياً إلى ورقة عمل تفاعلية متعددة الصفحات.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-red-600 mt-4 block">
                  + اختيار ملف PDF من جهازك
                </span>
              </button>

              {/* خيار 2: رفع صورة ورقة العمل */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-5 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 transition text-right group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg font-bold mb-3 shadow-sm group-hover:scale-105 transition">
                    🖼️
                  </div>
                  <h4 className="font-black text-sm text-slate-900 group-hover:text-emerald-700">
                    رفع صورة ورقة عمل (JPG / PNG)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    ارفع أي صورة ضوئية أو مصممة لتحويلها فورياً لورقة تفاعلية.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 mt-4 block">
                  + اختيار صورة من جهازك
                </span>
              </button>
            </div>

            {/* قوالب سريعة */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mb-6">
              <span className="text-xs font-bold text-slate-600 block mb-2">أو ابدأ بنموذج تفاعلي جاهز:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPages([SAMPLE_WORKSHEET_SVG_1]);
                    setCurrentPageIndex(0);
                    setShowUploadModal(false);
                    showToast('تم تحميل نموذج: اللام الشمسية والقمرية');
                  }}
                  className="flex-1 py-2 px-3 bg-white border border-slate-200 hover:border-emerald-500 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <span>☀️🌙</span>
                  <span>اللام الشمسية والقمرية</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPages([SAMPLE_WORKSHEET_SVG_2]);
                    setCurrentPageIndex(0);
                    setShowUploadModal(false);
                    showToast('تم تحميل نموذج: حروف المد وأقسام الكلمة');
                  }}
                  className="flex-1 py-2 px-3 bg-white border border-slate-200 hover:border-blue-500 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <span>📖</span>
                  <span>حروف المد والكلمة</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold"
              >
                إلغاء والعودة
              </button>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                متابعة بالمحرر مباشرة ⬅️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مؤشر تحويل PDF الجاري */}
      {isConvertingPdf && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
            <h3 className="font-black text-slate-800 text-lg mb-1">جارِ معالجة ملف الـ PDF...</h3>
            <p className="text-xs text-slate-500 mb-3">
              تحويل الصفحات إلى صور فائقة الدقة بنظام pdfjs-dist
            </p>
            {pdfProgress && (
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.round((pdfProgress.current / (pdfProgress.total || 1)) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* الشريط العلوي Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition"
              title="رجوع"
            >
              <svg className="w-5 h-5 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  محرر أوراق العمل التفاعلية (TopWorksheets Hub)
                </span>
                <span className="text-xs text-slate-500">
                  {elements.length} حقول تفاعلية • {totalPoints} درجة • {pages.length} {pages.length === 1 ? 'صفحة' : 'صفحات'}
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="عنوان ورقة العمل..."
                className="text-lg font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:outline-none transition px-1"
              />
            </div>
          </div>

          {/* أزرار الإجراءات العلوية */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl flex items-center gap-2 transition"
              title="رفع مستند PDF أو صورة"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>تغيير الورقة (PDF أو صورة)</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept="image/*,application/pdf"
              className="hidden"
            />

            <button
              onClick={handleSaveAndOpenPublish}
              disabled={isSaving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold rounded-xl shadow-md flex items-center gap-2 transition disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>{isSaving ? 'جارِ الحفظ...' : 'نشر وتعيين الورقة'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* شريط الأدوات المتقدم: الأنماط التفاعلية الخمسة الكاملة */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 sticky top-[65px] z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
          {/* اختيار نوع الأداة المراد رسمها */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-bold">أداة الرسم الحالية:</span>
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 flex-wrap">
              {/* 1. ملء فراغ قصير */}
              <button
                type="button"
                onClick={() => setActiveTool('text')}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition ${
                  activeTool === 'text'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <span>✏️</span>
                <span>فراغ قصير (Short Text)</span>
              </button>

              {/* 2. سؤال مقالي تفاعلي */}
              <button
                type="button"
                onClick={() => setActiveTool('essay')}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition ${
                  activeTool === 'essay'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <span>📝</span>
                <span>سؤال مقالي (Open Essay)</span>
              </button>

              {/* 3. اختيار من متعدد */}
              <button
                type="button"
                onClick={() => setActiveTool('choice')}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition ${
                  activeTool === 'choice'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <span>🔘</span>
                <span>خيار متعدد (Single Choice)</span>
              </button>

              {/* 4. خانة اختيار / صح وخطأ */}
              <button
                type="button"
                onClick={() => setActiveTool('checkbox')}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition ${
                  activeTool === 'checkbox'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <span>☑️</span>
                <span>صح / خطأ (Checkbox)</span>
              </button>

              {/* 5. أداة التوصيل بين الأعمدة */}
              <button
                type="button"
                onClick={() => setActiveTool('join_point')}
                className={`px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition ${
                  activeTool === 'join_point'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <span>🔗</span>
                <span>توصيل خطوط (Matching Lines)</span>
              </button>
            </div>
          </div>

          {/* تبديل نماذج جاهزة وسريعة */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">قوالب جاهزة:</span>
            <button
              onClick={() => {
                setPages([SAMPLE_WORKSHEET_SVG_1]);
                setCurrentPageIndex(0);
                showToast('تم تحميل نموذج: اللام الشمسية والقمرية');
              }}
              className="text-xs text-emerald-700 hover:underline px-2 py-1 bg-emerald-50 rounded"
            >
              ☀️🌙 اللام الشمسية
            </button>
            <button
              onClick={() => {
                setPages([SAMPLE_WORKSHEET_SVG_2]);
                setCurrentPageIndex(0);
                showToast('تم تحميل نموذج: المدود وأقسام الكلمة');
              }}
              className="text-xs text-blue-700 hover:underline px-2 py-1 bg-blue-50 rounded"
            >
              📖 المدود والكلمة
            </button>
          </div>
        </div>
      </div>

      {/* شريط التنقل بين صفحات مستند الـ PDF المتعدد الصفحات */}
      {pages.length > 1 && (
        <div className="bg-emerald-50 border-b border-emerald-200 py-2 px-4 sticky top-[115px] z-20">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-900 font-bold">
              <span>📄</span>
              <span>مستند متعدد الصفحات (PDF): صفحة {currentPageIndex + 1} من إجمالي {pages.length}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPageIndex === 0}
                onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                className="px-3 py-1 bg-white border border-emerald-300 rounded-lg font-bold text-emerald-800 disabled:opacity-40 hover:bg-emerald-100 transition"
              >
                السابق ⬅️
              </button>

              <div className="flex gap-1">
                {pages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPageIndex(idx)}
                    className={`w-6 h-6 rounded font-bold text-xs transition ${
                      currentPageIndex === idx
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <button
                disabled={currentPageIndex >= pages.length - 1}
                onClick={() => setCurrentPageIndex(prev => Math.min(pages.length - 1, prev + 1))}
                className="px-3 py-1 bg-white border border-emerald-300 rounded-lg font-bold text-emerald-800 disabled:opacity-40 hover:bg-emerald-100 transition"
              >
                ➡️ التالي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مساحة العمل: اللوحة المركزية + شريط الخصائص الجانبي */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* منطقة رسم الورقة التفاعلية (Canvas Overlay) */}
        <div className="lg:col-span-3 flex flex-col items-center">
          <div className="w-full bg-slate-200 rounded-2xl p-4 shadow-inner flex flex-col items-center overflow-auto min-h-[600px]">
            <div className="text-center text-xs text-slate-500 mb-2 font-medium">
              💡 اضغط واسحب بالفأرة فوق أي مكان في الورقة لرسم صندوق تفاعلي جديد بالنوع المختار.
            </div>

            {/* الحاوية الأساسية للورقة مع إحداثيات نسبية */}
            <div
              ref={containerRef}
              onMouseDown={handleMouseDownOnCanvas}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="relative w-full max-w-[800px] select-none bg-white rounded-xl shadow-xl overflow-hidden cursor-crosshair border border-slate-300"
              style={{ minHeight: '900px' }}
            >
              {/* صورة خلفية ورقة العمل للصفحة الحالية */}
              <img
                src={currentImageUrl}
                alt={`ورقة العمل - صفحة ${currentPageIndex + 1}`}
                className="w-full h-auto block pointer-events-none select-none"
                draggable={false}
              />

              {/* الصناديق التفاعلية المرسومة في هذه الصفحة */}
              {currentPageElements.map((el) => {
                const isSelected = el.id === selectedElementId;
                let bgStyle = 'bg-blue-500/20 border-blue-500 text-blue-900';
                let typeBadge = '✏️ نص قصير';

                if (el.type === 'essay') {
                  bgStyle = 'bg-purple-500/25 border-purple-600 text-purple-900';
                  typeBadge = '📝 مقالي';
                } else if (el.type === 'choice') {
                  bgStyle = el.isCorrect
                    ? 'bg-emerald-500/30 border-emerald-600 text-emerald-900'
                    : 'bg-amber-500/25 border-amber-600 text-amber-900';
                  typeBadge = el.isCorrect ? '🔘 خيار صحيح' : '🔘 خيار بديل';
                } else if (el.type === 'checkbox') {
                  bgStyle = el.isCorrect
                    ? 'bg-emerald-500/30 border-emerald-600 text-emerald-900'
                    : 'bg-rose-500/20 border-rose-500 text-rose-900';
                  typeBadge = el.isCorrect ? '☑️ صح' : '❌ خطأ';
                } else if (el.type === 'join_point') {
                  bgStyle = el.joinRole === 'source'
                    ? 'bg-rose-500/30 border-rose-600 text-rose-900'
                    : 'bg-cyan-500/30 border-cyan-600 text-cyan-900';
                  typeBadge = el.joinRole === 'source' ? '🔗 انطلاق' : '🎯 وصول';
                }

                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => handleStartDragElement(e, el)}
                    className={`absolute border-2 rounded-lg transition-all cursor-move flex flex-col justify-between p-1 text-[11px] font-bold ${bgStyle} ${
                      isSelected ? 'ring-4 ring-emerald-500/70 shadow-lg z-20' : 'hover:opacity-90 z-10'
                    }`}
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.width}%`,
                      height: `${el.height}%`,
                    }}
                  >
                    <div className="flex items-center justify-between w-full pointer-events-none">
                      <span className="bg-black/60 text-white px-1 rounded text-[9px]">
                        {typeBadge}
                      </span>
                      <span className="bg-black/60 text-white px-1 rounded text-[9px]">
                        {el.points}د
                      </span>
                    </div>

                    <div className="text-center truncate pointer-events-none text-[10px]">
                      {el.type === 'text' && (
                        <span>{el.correctAnswers?.[0] ? `✓ ${el.correctAnswers[0]}` : 'فراغ إجابة'}</span>
                      )}
                      {el.type === 'essay' && (
                        <span>{el.keywords?.length ? `كلمات: ${el.keywords.join(', ')}` : 'سؤال مقالي مفتوح'}</span>
                      )}
                      {el.type === 'choice' && (
                        <span>{el.isCorrect ? '✓ الإجابة الصحيحة' : 'خيار بديل'}</span>
                      )}
                      {el.type === 'checkbox' && (
                        <span>{el.isCorrect ? 'محدد (True)' : 'غير محدد (False)'}</span>
                      )}
                      {el.type === 'join_point' && (
                        <span>{el.label || (el.joinRole === 'source' ? 'نقطة انطلاق' : 'نقطة هدف')}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* خطوط التوصيل الإرشادية بين نقاط الانطلاق والوصول المعينة */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                {currentPageElements
                  .filter(el => el.type === 'join_point' && el.joinRole === 'source' && el.targetPointId)
                  .map(sourceEl => {
                    const targetEl = currentPageElements.find(item => item.id === sourceEl.targetPointId);
                    if (!targetEl) return null;
                    const x1 = sourceEl.x + sourceEl.width / 2;
                    const y1 = sourceEl.y + sourceEl.height / 2;
                    const x2 = targetEl.x + targetEl.width / 2;
                    const y2 = targetEl.y + targetEl.height / 2;
                    return (
                      <line
                        key={`line_${sourceEl.id}_${targetEl.id}`}
                        x1={`${x1}%`}
                        y1={`${y1}%`}
                        x2={`${x2}%`}
                        y2={`${y2}%`}
                        stroke="#f43f5e"
                        strokeWidth="3"
                        strokeDasharray="4 4"
                      />
                    );
                  })}
              </svg>

              {/* الصندوق الجاري رسمه حالياً */}
              {isDrawing && currentBox && (
                <div
                  className="absolute border-2 border-dashed border-emerald-600 bg-emerald-500/30 rounded z-30 pointer-events-none"
                  style={{
                    left: `${currentBox.x}%`,
                    top: `${currentBox.y}%`,
                    width: `${currentBox.w}%`,
                    height: `${currentBox.h}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* لوحة التحكم والخصائص الجانبية Sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* كارت تفاصيل الورقة العامة */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <span>📋</span>
              <span>بيانات التعيين والصف</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">الصف المستهدف:</label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {teacherAllowedGrades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.labelAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">وصف أو تعليمات للطلاب:</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="تعليمات حل الورقة للطلاب..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-700">
                <span className="font-semibold">مجموع درجات الورقة:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-sm">
                  {totalPoints} درجة
                </span>
              </div>
            </div>
          </div>

          {/* كارت خصائص الصندوق المحدد */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex-1">
            <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>⚙️</span>
                <span>خصائص الحقل التفاعلي</span>
              </span>
              {selectedElement && (
                <button
                  onClick={() => handleDeleteElement(selectedElement.id)}
                  className="text-rose-600 hover:text-rose-800 text-xs font-semibold flex items-center gap-1 hover:bg-rose-50 px-2 py-1 rounded"
                >
                  <span>🗑️ حذف</span>
                </button>
              )}
            </h3>

            {selectedElement ? (
              <div className="space-y-4 text-xs">
                {/* نوع الحقل */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">نوع الحقل:</label>
                  <select
                    value={selectedElement.type}
                    onChange={(e) => handleUpdateElement(selectedElement.id, { type: e.target.value as WorksheetElementType })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                  >
                    <option value="text">ملء الفراغ القصير (Short Text)</option>
                    <option value="essay">سؤال مقالي تفاعلي (Open Essay)</option>
                    <option value="choice">خيار من متعدد (Single Choice)</option>
                    <option value="checkbox">خانة اختيار (Checkbox / True-False)</option>
                    <option value="join_point">أداة التوصيل بين الأعمدة (Join Line Point)</option>
                  </select>
                </div>

                {/* تسمية توضيحية للحقل */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">تسمية أو تلميح (Label):</label>
                  <input
                    type="text"
                    value={selectedElement.label || ''}
                    onChange={(e) => handleUpdateElement(selectedElement.id, { label: e.target.value })}
                    placeholder="مثال: السؤال 1، الكلمة ومعناها..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                  />
                </div>

                {/* 1. ضبط ملء الفراغ القصير */}
                {selectedElement.type === 'text' && (
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      الإجابة النموذجية المقبولة:
                    </label>
                    <input
                      type="text"
                      value={selectedElement.correctAnswers?.[0] || ''}
                      onChange={(e) => handleUpdateElement(selectedElement.id, { 
                        correctAnswers: [e.target.value, ...(selectedElement.correctAnswers?.slice(1) || [])] 
                      })}
                      placeholder="مثال: شمسية"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <div className="mt-1 text-[10px] text-slate-500">
                      💡 التصحيح التلقائي يتجاهل فروق التشكيل، والهمزات (أ/إ/ا)، والتاء المربوطة (ة/ه) تلقائياً.
                    </div>

                    <div className="mt-2">
                      <label className="block text-slate-600 font-semibold mb-1">مرادف مقبول إضافي (اختياري):</label>
                      <input
                        type="text"
                        value={selectedElement.correctAnswers?.[1] || ''}
                        onChange={(e) => {
                          const base = selectedElement.correctAnswers?.[0] || '';
                          handleUpdateElement(selectedElement.id, {
                            correctAnswers: e.target.value ? [base, e.target.value] : [base]
                          });
                        }}
                        placeholder="مرادف آخر..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-medium"
                      />
                    </div>
                  </div>
                )}

                {/* 2. ضبط السؤال المقالي بالكلمات المفتاحية */}
                {selectedElement.type === 'essay' && (
                  <div className="space-y-2">
                    <label className="block text-slate-600 font-semibold mb-1">
                      الكلمات المفتاحية المطلوبة للتصحيح التلقائي:
                    </label>
                    <textarea
                      rows={2}
                      value={selectedElement.keywords?.join('، ') || ''}
                      onChange={(e) => {
                        const splitted = e.target.value.split(",").map(k => k.trim()).filter(Boolean);
                        handleUpdateElement(selectedElement.id, { keywords: splitted });
                      }}
                      placeholder="اكتب الكلمات مفصولة بفاصلة (مثال: العلم، النور، المعرفة)..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium resize-none"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>الحد الأدنى للكلمات المطلوبة:</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={selectedElement.minKeywordsRequired || 1}
                        onChange={(e) => handleUpdateElement(selectedElement.id, { minKeywordsRequired: parseInt(e.target.value) || 1 })}
                        className="w-14 bg-slate-50 border border-slate-300 rounded p-1 text-center font-bold"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      💡 يحصل الطالب على الدرجة فوراً إذا تضمنت إجابته العدد المطلوب من الكلمات المفتاحية.
                    </p>
                  </div>
                )}

                {/* 3. ضبط الخيار المتعدد */}
                {selectedElement.type === 'choice' && (
                  <div className="space-y-2">
                    <label className="block text-slate-600 font-semibold mb-1">حالة هذا الصندوق:</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateElement(selectedElement.id, { isCorrect: true })}
                        className={`flex-1 py-2 rounded-lg font-bold text-xs transition ${
                          selectedElement.isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        ✓ إجابة صحيحة
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateElement(selectedElement.id, { isCorrect: false })}
                        className={`flex-1 py-2 rounded-lg font-bold text-xs transition ${
                          !selectedElement.isCorrect
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        ✗ خيار خاطئ
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. ضبط خانة الاختيار Checkbox */}
                {selectedElement.type === 'checkbox' && (
                  <div className="space-y-2">
                    <label className="block text-slate-600 font-semibold mb-1">الحالة الصحيحة المطلوبة:</label>
                    <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedElement.isCorrect ?? true}
                        onChange={(e) => handleUpdateElement(selectedElement.id, { isCorrect: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span className="font-medium text-slate-800">
                        يجب على الطالب التأشير بعلامة صح (✓)
                      </span>
                    </label>
                  </div>
                )}

                {/* 5. ضبط أداة التوصيل بين الأعمدة */}
                {selectedElement.type === 'join_point' && (
                  <div className="space-y-3 bg-rose-50/60 p-3 rounded-xl border border-rose-200">
                    <label className="block text-slate-700 font-bold mb-1">دور نقطة التوصيل:</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateElement(selectedElement.id, { joinRole: 'source' })}
                        className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition ${
                          selectedElement.joinRole === 'source'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        نقطة انطلاق (Point A)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateElement(selectedElement.id, { joinRole: 'target' })}
                        className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition ${
                          selectedElement.joinRole === 'target'
                            ? 'bg-cyan-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        نقطة وصول (Point B)
                      </button>
                    </div>

                    {selectedElement.joinRole === 'source' && (
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">
                          اختر نقطة الوصول الصحيحة المقابلة:
                        </label>
                        <select
                          value={selectedElement.targetPointId || ''}
                          onChange={(e) => handleUpdateElement(selectedElement.id, { targetPointId: e.target.value })}
                          className="w-full bg-white border border-rose-300 rounded-lg p-2 font-medium"
                        >
                          <option value="">-- اختر النقطة المقابلة --</option>
                          {availableTargetPoints.map((pt, i) => (
                            <option key={pt.id} value={pt.id}>
                              {pt.label || `نقطة وصول هدف #${i + 1}`} ({pt.x}%, {pt.y}%)
                            </option>
                          ))}
                        </select>
                        {availableTargetPoints.length === 0 && (
                          <p className="text-[10px] text-rose-600 mt-1">
                            ⚠️ ارسم صندوقاً آخر أولاً واجعله من نوع "نقطة وصول (Point B)" لتربطهما معاً.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* الدرجة المخصصة لهذا الحقل */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">الدرجة المخصصة:</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={selectedElement.points}
                    onChange={(e) => handleUpdateElement(selectedElement.id, { points: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                  />
                </div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400 p-4 border border-dashed border-slate-200 rounded-xl">
                <span className="text-3xl mb-2">🎯</span>
                <p className="text-xs">
                  انقر على أي صندوق على الورقة أو ارسم صندوقاً جديداً لتعديل خياراته وإجابته الصحيحة والدرجة.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* نافذة منبثقة للنشر والتعيين Publish Modal */}
      {isPublishModalOpen && publishedWorksheet && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚀</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">نشر وتعيين ورقة العمل</h3>
                  <p className="text-xs text-slate-500">اختر طريقة إتاحة الورقة للطلاب</p>
                </div>
              </div>
              <button
                onClick={() => setIsPublishModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="py-6 space-y-6">
              {/* الخيار 1: نشر لصف دراسي محدد */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl text-lg">🏫</div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-emerald-950">1. نشر لصف دراسي محدد</h4>
                    <p className="text-xs text-emerald-800/80 mt-0.5">
                      تظهر الورقة فوراً في لوحة حسابات طلاب هذا الصف تلقائياً تحت تبويب «أوراق العمل».
                    </p>

                    <div className="mt-3">
                      <select
                        value={targetClass}
                        onChange={(e) => setTargetClass(e.target.value)}
                        className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">-- عام لكافة طلاب الصف المستهدف ({selectedGrade}) --</option>
                        {teacherAllowedGrades.map((g) => (
                          <option key={g.id} value={g.id}>
                            فصل {g.labelAr}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* الخيار 2: رابط المشاركة العام */}
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-600 text-white rounded-xl text-lg">🔗</div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-blue-950">2. رابط المشاركة العام (TopWorksheets Style)</h4>
                    <p className="text-xs text-blue-800/80 mt-0.5">
                      رابط مباشر وسريع للمشاركة في مجموعات الواتساب أو تيليجرام. يمكن لأي طالب الحل وكتابة اسمه الثلاثي.
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/worksheets/play/${publishedWorksheet.id}`}
                        className="flex-1 bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs text-slate-700 font-mono select-all"
                      />
                      <button
                        onClick={copyPublicLink}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                          copiedLink
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {copiedLink ? '✓ تم النسخ' : 'نسخ الرابط'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* الأزرار السفلية للنافذة */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  if (onOpenPlayer) {
                    onOpenPlayer(publishedWorksheet.id);
                  } else {
                    window.location.href = `/worksheets/play/${publishedWorksheet.id}`;
                  }
                }}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1"
              >
                <span>👁️ تجربة حل الورقة كطالب</span>
              </button>

              <button
                onClick={() => {
                  setIsPublishModalOpen(false);
                  if (onCancel) onCancel();
                }}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition"
              >
                إغلاق والعودة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
