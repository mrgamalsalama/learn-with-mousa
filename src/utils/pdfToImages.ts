/**
 * أداة متطورة لتحويل ملفات PDF في المتصفح إلى صور فائقة الدقة لكل صفحة
 * باستخدام pdfjs-dist مع دعم كامل ومستقر لـ Web Worker المحلي
 */
import * as pdfjsLib from 'pdfjs-dist';

// إعداد مسار الـ Worker محلياً من ملف public/pdf.worker.min.mjs
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  } catch (err) {
    console.warn('pdfjs worker configuration notice:', err);
  }
}

export interface ConvertedPdfResult {
  pages: string[]; // مصفوفة Base64 Data URLs لكل صفحة
  totalPages: number;
}

/**
 * تحويل ملف PDF (File أو ArrayBuffer) إلى مصفوفة صور Base64 عالية النقاء
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

    // دقة 1.8 مناسبة جداً لوضوح الخطوط العربية والنصوص في شاشات الحواسيب والأجهزة اللوحية
    const viewport = page.getViewport({ scale: 1.8 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (!context) {
      throw new Error('تعذر إنشاء مساحة الرسم (Canvas Context) لمعالجة مستند الـ PDF');
    }

    // تلوين الخلفية بالأبيض لمنع الشفافية
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    // @ts-ignore
    await page.render(renderContext).promise;

    // تحويل إلى صورة JPEG عالية النقاء ومضغوطة
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
