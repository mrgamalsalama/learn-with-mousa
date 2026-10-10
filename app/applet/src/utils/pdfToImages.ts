/**
 * خدمة معالجة وتحويل ملفات الـ PDF في المتصفح إلى صور فائقة الدقة باستخدام pdfjs-dist
 */
import * as pdfjsLib from 'pdfjs-dist';

// تعيين مسار الـ worker ليعمل بسلاسة داخل بيئة المتصفح
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    // استخدام مسار Worker الموثوق من unpkg المتوافق مع إصدار pdfjs-dist
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch (err) {
    console.warn('pdfjs worker configuration notice:', err);
  }
}

export interface ConvertedPdfResult {
  pages: string[]; // مصفوفة Base64 Data URLs لكل صفحة
  totalPages: number;
}

/**
 * تحويل ملف PDF (ArrayBuffer أو File) إلى مصفوفة صور Base64 عالية الجودة
 */
export async function convertPdfToImages(
  fileOrBuffer: File | ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<ConvertedPdfResult> {
  let arrayBuffer: ArrayBuffer;

  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  // تحميل مستند الـ PDF
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pageImages: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    
    // ضبط دقة العرض لضمان جودة قراءة الخط العربي ونقاء النص (scale 1.8 - 2.0)
    const viewport = page.getViewport({ scale: 1.8 });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (!context) {
      throw new Error('Unable to create canvas context for PDF rendering');
    }

    // تلوين الخلفية بالأبيض لتفادي الشفافية
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    // معالجة تصيير الصفحة على الـ Canvas
    // @ts-ignore
    await page.render(renderContext).promise;

    // تحويل الـ Canvas إلى صورة JPEG عالية الجودة لتقليل الحجم مع الاحتفاظ بالنقاء
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    pageImages.push(dataUrl);

    if (onProgress) {
      onProgress(pageNum, numPages);
    }
  }

  return {
    pages: pageImages,
    totalPages: numPages,
  };
}
