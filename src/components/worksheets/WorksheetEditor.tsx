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
  const [imageUrl, setImageUrl] = useState<string>(
    initialWorksheet?.image_url || initialWorksheet?.background_url || SAMPLE_WORKSHEET_SVG_1
  );
  const [selectedGrade, setSelectedGrade] = useState<string>(
    (initialWorksheet?.grade_level as string) || (currentUser.allowedGrades?.[0] as string) || 'grade-1'
  );
  const [elements, setElements] = useState<WorksheetElement[]>(
    initialWorksheet?.elements || []
  );

  // حالة العنصر المختار للتحرير
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<WorksheetElementType>('text');

  // وضع الرسم والإشارة بالفأرة / اللمس
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // وضع تحريك الصناديق المنشأة مسبقاً (Drag existing element)
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
    setTimeout(() => setToastMessage(null), 3000);
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

  // حساب الدرجة الكلية للورقة
  const totalPoints = elements.reduce((acc, el) => acc + (Number(el.points) || 1), 0);

  // التعامل مع رفع صورة الورقة
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('يرجى اختيار ملف صورة صالح (JPG أو PNG أو WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      if (typeof loadEvt.target?.result === 'string') {
        setImageUrl(loadEvt.target.result);
        showToast('تم تحميل صورة ورقة العمل بنجاح! يمكنك الآن رسم الحقول التفاعلية.');
      }
    };
    reader.readAsDataURL(file);
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
      // التأكد أن الصندوق ليس مجرد نقرة عابرة (أكبر من 2% عرضاً وارتفاعاً)
      if (currentBox.w >= 2 && currentBox.h >= 1.5) {
        const newElement: WorksheetElement = {
          id: `elem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: activeTool,
          x: Math.round(currentBox.x * 10) / 10,
          y: Math.round(currentBox.y * 10) / 10,
          width: Math.round(currentBox.w * 10) / 10,
          height: Math.round(currentBox.h * 10) / 10,
          correctAnswers: activeTool === 'text' ? [''] : undefined,
          isCorrect: activeTool !== 'text' ? true : undefined,
          points: 1,
          label: ''
        };
        setElements(prev => [...prev, newElement]);
        setSelectedElementId(newElement.id);
        showToast('تمت إضافة حقل تفاعلي! اضبط الإجابة الصحيحة من لوحة التحكم جانباً.');
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
      image_url: imageUrl,
      background_url: imageUrl,
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" dir="rtl">
      {/* شريط الإشعارات المؤقت */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-sm font-medium">{toastMessage}</span>
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
                  محرر أوراق العمل التفاعلية
                </span>
                <span className="text-xs text-slate-500">
                  {elements.length} حقول تفاعلية • {totalPoints} درجة
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
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>تغيير صورة الورقة</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
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

      {/* شريط الأدوات الرئيسي فوق اللوحة */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 sticky top-[65px] z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
          {/* اختيار نوع الأداة المراد رسمها */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">أداة الرسم الحالية:</span>
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
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
                <span>ملء الفراغ (Text Input)</span>
              </button>

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
                <span>خيار متعدد (Choice Box)</span>
              </button>

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
                <span>خانة اختيار (Checkbox)</span>
              </button>
            </div>
          </div>

          {/* تبديل نماذج جاهزة وسريعة */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">قوالب جاهزة:</span>
            <button
              onClick={() => {
                setImageUrl(SAMPLE_WORKSHEET_SVG_1);
                showToast('تم تحميل نموذج: اللام الشمسية والقمرية');
              }}
              className="text-xs text-emerald-700 hover:underline px-2 py-1 bg-emerald-50 rounded"
            >
              ☀️🌙 اللام الشمسية
            </button>
            <button
              onClick={() => {
                setImageUrl(SAMPLE_WORKSHEET_SVG_2);
                showToast('تم تحميل نموذج: المدود وأقسام الكلمة');
              }}
              className="text-xs text-blue-700 hover:underline px-2 py-1 bg-blue-50 rounded"
            >
              📖 المدود والكلمة
            </button>
          </div>
        </div>
      </div>

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
              {/* صورة خلفية ورقة العمل */}
              <img
                src={imageUrl}
                alt="ورقة العمل الأصلية"
                className="w-full h-auto block pointer-events-none select-none"
                draggable={false}
              />

              {/* الصناديق التفاعلية المرسومة مسبقاً */}
              {elements.map((el, index) => {
                const isSelected = el.id === selectedElementId;
                let bgStyle = 'bg-blue-500/20 border-blue-500 text-blue-900';
                let typeBadge = '✏️ نص';

                if (el.type === 'choice') {
                  bgStyle = el.isCorrect
                    ? 'bg-emerald-500/30 border-emerald-600 text-emerald-900'
                    : 'bg-amber-500/25 border-amber-600 text-amber-900';
                  typeBadge = el.isCorrect ? '🔘 خيار صحيح' : '🔘 خيار خاطئ';
                } else if (el.type === 'checkbox') {
                  bgStyle = el.isCorrect
                    ? 'bg-emerald-500/30 border-emerald-600 text-emerald-900'
                    : 'bg-rose-500/20 border-rose-500 text-rose-900';
                  typeBadge = el.isCorrect ? '☑️ صح' : '❌ خطأ';
                }

                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => handleStartDragElement(e, el)}
                    className={`absolute border-2 rounded transition-all cursor-move flex flex-col justify-between p-1 text-[11px] font-bold ${bgStyle} ${
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
                        #{index + 1} {typeBadge}
                      </span>
                      <span className="bg-black/60 text-white px-1 rounded text-[9px]">
                        {el.points}د
                      </span>
                    </div>

                    <div className="text-center truncate pointer-events-none text-[10px]">
                      {el.type === 'text' && (
                        <span>{el.correctAnswers?.[0] ? `✓ ${el.correctAnswers[0]}` : 'فراغ إجابة'}</span>
                      )}
                      {el.type === 'choice' && (
                        <span>{el.isCorrect ? '✓ الإجابة الصحيحة' : 'خيار بديل'}</span>
                      )}
                      {el.type === 'checkbox' && (
                        <span>{el.isCorrect ? 'محدد (True)' : 'غير محدد (False)'}</span>
                      )}
                    </div>
                  </div>
                );
              })}

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
                    <option value="text">ملء الفراغ (Text Input)</option>
                    <option value="choice">خيار من متعدد (Choice Box)</option>
                    <option value="checkbox">خانة اختيار (Checkbox)</option>
                  </select>
                </div>

                {/* ضبط الإجابات الصحيحة لحقل النص */}
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

                    {/* إجابات مقبولة إضافية مرادفة */}
                    <div className="mt-2">
                      <label className="block text-slate-600 font-semibold mb-1">إجابات مرادفة مقبولة أخرى (اختياري):</label>
                      <input
                        type="text"
                        value={selectedElement.correctAnswers?.[1] || ''}
                        onChange={(e) => {
                          const base = selectedElement.correctAnswers?.[0] || '';
                          handleUpdateElement(selectedElement.id, {
                            correctAnswers: e.target.value ? [base, e.target.value] : [base]
                          });
                        }}
                        placeholder="مرادف مقبول آخر..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-medium"
                      />
                    </div>
                  </div>
                )}

                {/* ضبط الخيار المتعدد */}
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

                {/* ضبط خانة الاختيار Checkbox */}
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
                  انقر على أي صندوق على الورقة أو ارسم صندوقاً جديداً لتعديل خياراته وإجابته الصحيحة.
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
