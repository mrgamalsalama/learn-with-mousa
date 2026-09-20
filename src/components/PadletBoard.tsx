import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Pin, Heart, MessageCircle, Send, Plus, Trash2, CheckCircle2, 
  X, Image as ImageIcon, Mic, Square, Play, Pause, Sparkles, 
  Settings, Lock, Unlock, ShieldAlert, Check, RefreshCw, AlertCircle,
  Eye, Edit3, Volume2, Wand2, Palette, Eraser, RotateCcw, Share2, Layers, Globe
} from 'lucide-react';
import { 
  UserProfile, GradeLevel, ArabicTrack, PadletBoard, PadletPost, 
  PadletComment, PadletTheme, PadletCardColor, PadletContentType 
} from '../types';
import { 
  getPadletBoards, savePadletBoard, deletePadletBoard, 
  getPadletPosts, savePadletPost, updatePadletPostStatus, 
  togglePadletPostLike, addPadletComment, deletePadletPost, 
  togglePadletPostPin, syncPadletBoardsFromCloud, syncPadletPostsFromCloud,
  normalizeGrade, isGradeMatching
} from '../storage';
import { supabase } from '../supabaseClient';
import { autoTashkeelText } from '../geminiService';
import confetti from 'canvas-confetti';

interface PadletBoardProps {
  currentUser: UserProfile;
  initialGrade?: GradeLevel;
  initialTrack?: ArabicTrack;
  onClose?: () => void;
}

const THEME_STYLES: Record<PadletTheme, {
  name: string;
  bgClass: string;
  headerClass: string;
  cardBaseClass: string;
  pinStyle: string;
  borderStyle: string;
}> = {
  corkboard: {
    name: 'لوحة الفلين الطبيعية 📌',
    bgClass: 'bg-[#D7BA89] bg-[radial-gradient(#b89862_1px,transparent_1px)] [background-size:16px_16px]',
    headerClass: 'bg-[#C2A370] text-[#3E2713] border-[#A88855]',
    cardBaseClass: 'shadow-md border-amber-900/20 hover:shadow-xl',
    pinStyle: 'text-rose-600',
    borderStyle: 'border-[#A88855]'
  },
  chalkboard: {
    name: 'السبورة الخضراء الكلاسيكية 🖍️',
    bgClass: 'bg-[#1E3A2F] bg-[radial-gradient(#274a3d_1px,transparent_1px)] [background-size:20px_20px]',
    headerClass: 'bg-[#152B23] text-emerald-100 border-[#2A4D3F]',
    cardBaseClass: 'shadow-lg border-emerald-800/40 hover:shadow-2xl',
    pinStyle: 'text-amber-400',
    borderStyle: 'border-[#4A3525] border-8'
  },
  playful: {
    name: 'ألوان الباستيل المبهجة 🎈',
    bgClass: 'bg-gradient-to-br from-amber-50 via-rose-50 to-teal-50',
    headerClass: 'bg-white/90 backdrop-blur-md text-slate-800 border-rose-100',
    cardBaseClass: 'shadow-sm border-slate-200/80 hover:shadow-md',
    pinStyle: 'text-indigo-500',
    borderStyle: 'border-slate-200'
  },
  notebook: {
    name: 'الدفتر المدرسي المسطر 📝',
    bgClass: 'bg-[#FDFBF7] bg-[linear-gradient(to_bottom,transparent_23px,#E2E8F0_24px)] [background-size:100%_24px]',
    headerClass: 'bg-white/95 text-slate-800 border-indigo-100 shadow-xs',
    cardBaseClass: 'shadow-sm border-slate-300 hover:shadow-md',
    pinStyle: 'text-teal-600',
    borderStyle: 'border-slate-300 border-r-4 border-r-rose-400'
  },
  sky: {
    name: 'سماء الإبداع والغيوم ☁️',
    bgClass: 'bg-gradient-to-b from-sky-200 via-sky-100 to-blue-50',
    headerClass: 'bg-white/80 backdrop-blur-md text-sky-950 border-sky-200',
    cardBaseClass: 'shadow-sm border-sky-200 hover:shadow-md',
    pinStyle: 'text-sky-600',
    borderStyle: 'border-sky-200'
  }
};

const COLOR_STYLES: Record<PadletCardColor, {
  name: string;
  bg: string;
  border: string;
  header: string;
  badge: string;
  dot: string;
  bgClass: string;
  textClass: string;
  badgeBg: string;
}> = {
  yellow: {
    name: 'أصفر كلاسيكي',
    bg: 'bg-amber-100',
    border: 'border-amber-300',
    header: 'text-amber-950',
    badge: 'bg-amber-200 text-amber-900',
    dot: 'bg-amber-500',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-950',
    badgeBg: 'bg-amber-500'
  },
  pink: {
    name: 'وردي لطيف',
    bg: 'bg-rose-100',
    border: 'border-rose-300',
    header: 'text-rose-950',
    badge: 'bg-rose-200 text-rose-900',
    dot: 'bg-rose-500',
    bgClass: 'bg-rose-100',
    textClass: 'text-rose-950',
    badgeBg: 'bg-rose-500'
  },
  mint: {
    name: 'نعناعي منعش',
    bg: 'bg-emerald-100',
    border: 'border-emerald-300',
    header: 'text-emerald-950',
    badge: 'bg-emerald-200 text-emerald-900',
    dot: 'bg-emerald-500',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-950',
    badgeBg: 'bg-emerald-500'
  },
  blue: {
    name: 'أزرق سماوي',
    bg: 'bg-sky-100',
    border: 'border-sky-300',
    header: 'text-sky-950',
    badge: 'bg-sky-200 text-sky-900',
    dot: 'bg-sky-500',
    bgClass: 'bg-sky-100',
    textClass: 'text-sky-950',
    badgeBg: 'bg-sky-500'
  },
  purple: {
    name: 'بنفسجي هادئ',
    bg: 'bg-purple-100',
    border: 'border-purple-300',
    header: 'text-purple-950',
    badge: 'bg-purple-200 text-purple-900',
    dot: 'bg-purple-500',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-950',
    badgeBg: 'bg-purple-500'
  }
};

const CARD_COLOR_MAP = COLOR_STYLES;

export const PadletBoardView: React.FC<PadletBoardProps> = ({
  currentUser,
  initialGrade,
  initialTrack = 'arabic-a',
  onClose
}) => {
  const isTeacher = currentUser.role === 'teacher' || currentUser.role === 'hod' || currentUser.role === 'super_admin';
  const targetGrade = initialGrade || (currentUser.grade || 'grade-1');
  const targetTrack = initialTrack || (currentUser.track || 'arabic-a');

  // اللوحات والمنشورات
  const [boards, setBoards] = useState<PadletBoard[]>(getPadletBoards());
  const [selectedBoardId, setSelectedBoardId] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlBoard = new URLSearchParams(window.location.search).get('board');
        if (urlBoard) return urlBoard;
      }
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('current_padlet_board_id');
        if (saved) return saved;
      }
    } catch (e) {}
    return '';
  });
  const [posts, setPosts] = useState<PadletPost[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // مرشحات وخيارات العرض
  const [filterPendingOnly, setFilterPendingOnly] = useState<boolean>(false);
  const [showAllBoards, setShowAllBoards] = useState<boolean>(false);

  // نوافذ التحكم
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState<boolean>(false);
  const [isEditBoardModalOpen, setIsEditBoardModalOpen] = useState<boolean>(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState<boolean>(false);
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [isSubmittingPost, setIsSubmittingPost] = useState<boolean>(false);
  const [isSubmittingBoard, setIsSubmittingBoard] = useState<boolean>(false);

  // استمارة إنشاء / تعديل اللوحة
  const [boardFormTitle, setBoardFormTitle] = useState<string>('');
  const [boardFormDescription, setBoardFormDescription] = useState<string>('');
  const [boardFormGrade, setBoardFormGrade] = useState<GradeLevel | string>(targetGrade);
  const [boardFormTrack, setBoardFormTrack] = useState<ArabicTrack>(targetTrack);
  const [boardFormTheme, setBoardFormTheme] = useState<PadletTheme>('corkboard');
  const [boardFormColor, setBoardFormColor] = useState<string>('yellow');
  const [boardFormAllowComments, setBoardFormAllowComments] = useState<boolean>(true);
  const [boardFormRequireApproval, setBoardFormRequireApproval] = useState<boolean>(false);
  const [boardFormIsLocked, setBoardFormIsLocked] = useState<boolean>(false);

  // استمارة إنشاء منشور جديد
  const [postContentType, setPostContentType] = useState<PadletContentType>('text');
  const [postContent, setPostContent] = useState<string>('');
  const [postColor, setPostColor] = useState<PadletCardColor>('yellow');
  const [isAutoTashkeelActive, setIsAutoTashkeelActive] = useState<boolean>(false);

  // التسجيل الصوتي
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // الرسم المباشر
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>('#1e293b');
  const [brushSize, setBrushSize] = useState<number>(4);
  const [hasDrawnSomething, setHasDrawnSomething] = useState<boolean>(false);

  // رفع صورة
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  // تعليق جديد
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // مشغل الصوت للبطاقات
  const [playingAudioPostId, setPlayingAudioPostId] = useState<string | null>(null);
  const activeAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // تحويل معرف الصف الدراسي إلى نص عربي واضح ومفهوم
  const getGradeDisplayLabel = (g?: string | null): string => {
    if (!g) return 'عام لجميع الصفوف 🌟';
    const norm = normalizeGrade(g);
    if (norm === 'all') return 'عام لجميع الصفوف 🌟';
    if (norm === 'kg') return 'الروضة والتمهيدي';
    if (norm === 'grade-1') return 'الصف الأول';
    if (norm === 'grade-2') return 'الصف الثاني';
    if (norm === 'grade-3') return 'الصف الثالث';
    if (norm === 'grade-4') return 'الصف الرابع';
    if (norm === 'grade-5') return 'الصف الخامس';
    if (norm === 'grade-6') return 'الصف السادس';
    if (norm === 'grade-7') return 'الصف السابع';
    if (norm === 'grade-8') return 'الصف الثامن';
    if (norm === 'grade-9') return 'الصف التاسع';
    if (norm === 'grade-10') return 'الصف العاشر';
    if (norm === 'grade-11') return 'الصف الحادي عشر';
    if (norm === 'grade-12') return 'الصف الثاني عشر';
    return g;
  };

  // مطابقة الحوائط المتوافقة مع صف الطالب أو الحوائط العامة
  const matchingBoards = useMemo(() => {
    return boards.filter(b => isGradeMatching(b.grade || b.target_grade, targetGrade));
  }, [boards, targetGrade]);

  // الحوائط الظاهرة بالقائمة: إما المخصصة للصف أو كل الحوائط إذا رغب الطالب بذلك أو كان معلماً
  const visibleBoards = useMemo(() => {
    if (isTeacher || showAllBoards || matchingBoards.length === 0) {
      return boards;
    }
    return matchingBoards;
  }, [boards, matchingBoards, isTeacher, showAllBoards]);

  // اللوحة الحالية النشطة
  const activeBoard = useMemo(() => {
    if (selectedBoardId) {
      const found = boards.find(b => b.id === selectedBoardId);
      if (found) return found;
    }
    if (matchingBoards.length > 0) return matchingBoards[0];
    if (visibleBoards.length > 0) return visibleBoards[0];
    return boards[0] || null;
  }, [boards, selectedBoardId, matchingBoards, visibleBoards]);

  // تهيئة وتحديد اللوحة الملائمة حسب الصف فور التحميل
  useEffect(() => {
    const loadedBoards = getPadletBoards();
    setBoards(loadedBoards);

    if (loadedBoards.length > 0) {
      let candidateId = '';
      try {
        const urlBoard = new URLSearchParams(window.location.search).get('board');
        if (urlBoard && loadedBoards.some(b => b.id === urlBoard)) {
          candidateId = urlBoard;
        } else {
          const savedId = localStorage.getItem('current_padlet_board_id');
          if (savedId && loadedBoards.some(b => b.id === savedId)) {
            candidateId = savedId;
          }
        }
      } catch (e) {}

      if (candidateId) {
        setSelectedBoardId(candidateId);
      } else {
        const matched = loadedBoards.find(b => isGradeMatching(b.grade || b.target_grade, targetGrade));
        setSelectedBoardId(matched ? matched.id : loadedBoards[0].id);
      }
    }

    // مزامنة سحابية خلفية وتحديث قائمة الحوائط فوراً
    syncPadletBoardsFromCloud().then(cloudBoards => {
      if (cloudBoards && cloudBoards.length > 0) {
        setBoards(cloudBoards);
        setSelectedBoardId(prevId => {
          if (prevId && cloudBoards.some(b => b.id === prevId)) {
            const current = cloudBoards.find(b => b.id === prevId);
            if (current && (isGradeMatching(current.grade || current.target_grade, targetGrade) || isTeacher)) {
              return prevId;
            }
          }
          const matched = cloudBoards.find(b => isGradeMatching(b.grade || b.target_grade, targetGrade));
          return matched ? matched.id : cloudBoards[0].id;
        });
      }
    });
  }, [targetGrade, isTeacher]);

  // مزامنة اللوحة النشطة مع الرابط (URL Query Parameter: ?board=...) والتخزين المحلي
  useEffect(() => {
    if (!selectedBoardId) return;
    try {
      localStorage.setItem('current_padlet_board_id', selectedBoardId);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (url.searchParams.get('board') !== selectedBoardId) {
          url.searchParams.set('board', selectedBoardId);
          window.history.replaceState(null, '', url.toString());
        }
      }
    } catch (e) {}
  }, [selectedBoardId]);

  // تحميل منشورات اللوحة النشطة
  const refreshPosts = () => {
    if (!activeBoard) {
      setPosts([]);
      return;
    }
    const currentPosts = getPadletPosts(activeBoard.id);
    setPosts(currentPosts);
  };

  useEffect(() => {
    refreshPosts();
    if (activeBoard) {
      syncPadletPostsFromCloud(activeBoard.id).then(cloudPosts => {
        if (cloudPosts) setPosts(cloudPosts);
      });
    }
  }, [activeBoard?.id]);

  // الاشتراك اللحظي السحابي والمحلي
  useEffect(() => {
    const handleLocalPostUpdate = () => {
      refreshPosts();
    };
    const handleLocalBoardUpdate = () => {
      setBoards(getPadletBoards());
    };

    window.addEventListener('padlet_posts_updated', handleLocalPostUpdate);
    window.addEventListener('padlet_boards_updated', handleLocalBoardUpdate);

    // إنشاء قناة Realtime خاصة ومخصصة للجدار مع ربط كافة مستمعي الأحداث (.on) أولاً قبل .subscribe()
    const channelName = `padlet_realtime_${activeBoard?.id || 'global'}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'padlet_boards' },
        () => {
          syncPadletBoardsFromCloud().then(b => {
            if (b) setBoards(b);
          });
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'padlet_posts',
          ...(activeBoard?.id ? { filter: `board_id=eq.${activeBoard.id}` } : {})
        },
        () => {
          if (activeBoard?.id) {
            syncPadletPostsFromCloud(activeBoard.id).then(p => {
              if (p) setPosts(p);
            });
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('padlet_posts_updated', handleLocalPostUpdate);
      window.removeEventListener('padlet_boards_updated', handleLocalBoardUpdate);
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.warn('Realtime padlet channel removal warning:', err);
      }
      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
      }
    };
  }, [activeBoard?.id]);

  // إدارة التسجيل الصوتي
  const startVoiceRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setAudioUrl(reader.result as string);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert('تعذر الوصول إلى الميكروفون. يرجى التأكد من منح الإذن للمتصفح.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  // إدارة لوحة الرسم
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawnSomething(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSomething(false);
  };

  // ضغط وتصغير الصورة لضمان سلامة التخزين السحابي
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const image = new Image();
        image.onload = () => {
          const maxDim = 800;
          let width = image.width;
          let height = image.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(image, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } else {
            resolve(readerEvent.target?.result as string);
          }
        };
        image.src = readerEvent.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // رفع صورة
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setUploadedImageUrl(compressed);
    } catch (err) {
      console.warn('Image compression fallback:', err);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // تشكيل النص تلقائياً عبر الذكاء الاصطناعي
  const handleAutoTashkeel = async () => {
    if (!postContent.trim()) return;
    setIsAutoTashkeelActive(true);
    try {
      const voweled = await autoTashkeelText(postContent);
      setPostContent(voweled);
    } catch (e) {
      console.warn('Auto tashkeel failed:', e);
    } finally {
      setIsAutoTashkeelActive(false);
    }
  };

  // إضافة علامات التشكيل اليدوية
  const addDiacritic = (mark: string) => {
    setPostContent(prev => prev + mark);
  };

  // إنشاء منشور جديد
  const handleCreatePost = async () => {
    if (!activeBoard) return;
    if (activeBoard.is_locked && !isTeacher) {
      alert('عفواً، الحائط مغلق حالياً من قبل المعلم للمشاهدة فقط.');
      return;
    }

    let drawingDataUrl: string | undefined = undefined;
    if (postContentType === 'drawing' && canvasRef.current && hasDrawnSomething) {
      drawingDataUrl = canvasRef.current.toDataURL('image/png');
    }

    const finalImage = uploadedImageUrl || drawingDataUrl;

    if (!postContent.trim() && !audioUrl && !finalImage) {
      alert('يرجى إضافة نص أو تسجيل صوتي أو رسم للمشاركة!');
      return;
    }

    // تحديد حالة الموافقة
    const needsApproval = activeBoard.require_approval && !isTeacher;
    const status = needsApproval ? 'pending' : 'approved';

    const newPost: PadletPost = {
      id: 'post_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      board_id: activeBoard.id,
      author_id: currentUser.id,
      author_name: currentUser.name,
      author_role: currentUser.role,
      content: postContent.trim() || (audioUrl ? '🎤 تسجيل صوتي' : '🎨 رسم إبداعي'),
      color: postColor,
      audio_url: audioUrl || undefined,
      image_url: finalImage || undefined,
      content_type: audioUrl ? (postContent ? 'mixed' : 'audio') : (finalImage ? (postContent ? 'mixed' : 'drawing') : 'text'),
      status,
      likes_count: 0,
      liked_by: [],
      comments: [],
      created_at: new Date().toISOString(),
      pinned: false
    };

    setIsSubmittingPost(true);
    try {
      const { post: savedPost, error } = await savePadletPost(newPost);

      // إضافة المنشور المحفوظ محلياً للحالة فوراً لضمان عدم تأثره بأي بطء في الاتصال
      setPosts(prev => {
        const exists = prev.some(p => p.id === savedPost.id);
        if (exists) return prev.map(p => p.id === savedPost.id ? savedPost : p);
        return [savedPost, ...prev];
      });

      if (error) {
        console.warn('Padlet post cloud insert warning:', error);
      } else {
        // تفجير قصاصات الاحتفال للأطفال
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 }
          });
        } catch (e) {}

        if (needsApproval) {
          alert('تم إرسال بطاقتك بنجاح! ستظهر على الجدار بمجرد اعتماد معلمك لها 🌟');
        }
      }

      // إعادة تعيين الاستمارة
      setPostContent('');
      setAudioUrl(null);
      setUploadedImageUrl(null);
      clearCanvas();
      setIsCreatePostModalOpen(false);

      // إعادة تحميل فوري من السحابة لضمان التزامن
      if (activeBoard) {
        syncPadletPostsFromCloud(activeBoard.id).then(cloudPosts => {
          if (cloudPosts && cloudPosts.length > 0) setPosts(cloudPosts);
        });
      }
    } catch (submitErr) {
      console.error('Unexpected error creating padlet post:', submitErr);
      alert('حدث خطأ غير متوقع أثناء نشر البطاقة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmittingPost(false);
    }
  };

  // تشغيل / إيقاف الصوت
  const togglePlayAudio = (postId: string, url?: string) => {
    if (!url) return;

    if (playingAudioPostId === postId) {
      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
      }
      setPlayingAudioPostId(null);
    } else {
      if (activeAudioElementRef.current) {
        activeAudioElementRef.current.pause();
      }
      const audio = new Audio(url);
      activeAudioElementRef.current = audio;
      setPlayingAudioPostId(postId);

      audio.onended = () => {
        setPlayingAudioPostId(null);
      };
      audio.onerror = () => {
        setPlayingAudioPostId(null);
      };
      audio.play();
    }
  };

  // إضافة تعليق
  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const comment: PadletComment = {
      id: 'c_' + Date.now(),
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      text,
      createdAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };

    await addPadletComment(postId, comment);
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  };

  // إنشاء حائط جديد للمعلم مع دعم اللون الافتراضي ومطابقة الصفوف
  const handleSaveNewBoard = async () => {
    if (!boardFormTitle.trim()) {
      alert('يرجى كتابة عنوان للحائط التفاعلي.');
      return;
    }

    const newBoard: PadletBoard = {
      id: 'board_' + Date.now(),
      title: boardFormTitle.trim(),
      description: boardFormDescription.trim(),
      teacher_id: currentUser.id,
      teacher_name: currentUser.name,
      grade: boardFormGrade,
      target_grade: boardFormGrade,
      color: boardFormColor || 'yellow',
      track: boardFormTrack,
      theme: boardFormTheme,
      allow_comments: boardFormAllowComments,
      require_approval: boardFormRequireApproval,
      is_locked: boardFormIsLocked,
      created_at: new Date().toISOString()
    };

    setIsSubmittingBoard(true);
    try {
      // حفظ محلي وسحابي مع إعادة المحاولة التلقائية
      const res = await savePadletBoard(newBoard);
      if (res?.error) {
        console.warn('تنبيه أثناء حفظ الحائط في السحابة:', res.error);
      }

      // تحديث فوري فوري للقائمة واختيار الحائط الجديد مباشرة
      setBoards(prev => [newBoard, ...prev.filter(b => b.id !== newBoard.id)]);
      setSelectedBoardId(newBoard.id);
      setIsCreateBoardModalOpen(false);

      // مزامنة سحابية للتأكيد
      syncPadletBoardsFromCloud().then(b => {
        if (b && b.length > 0) setBoards(b);
      });

      try {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      } catch (e) {}

      // تصفير الاستمارة
      setBoardFormTitle('');
      setBoardFormDescription('');
      setBoardFormColor('yellow');
    } finally {
      setIsSubmittingBoard(false);
    }
  };

  // تعديل إعدادات الحائط الحالي
  const handleUpdateBoardSettings = async () => {
    if (!activeBoard) return;

    const updated: PadletBoard = {
      ...activeBoard,
      title: boardFormTitle.trim() || activeBoard.title,
      description: boardFormDescription.trim(),
      grade: boardFormGrade,
      target_grade: boardFormGrade,
      color: boardFormColor || activeBoard.color || 'yellow',
      theme: boardFormTheme,
      allow_comments: boardFormAllowComments,
      require_approval: boardFormRequireApproval,
      is_locked: boardFormIsLocked
    };

    await savePadletBoard(updated);
    setBoards(prev => prev.map(b => b.id === updated.id ? updated : b));
    setIsEditBoardModalOpen(false);
  };

  // فتح نافذة التعديل
  const openEditBoardModal = () => {
    if (!activeBoard) return;
    setBoardFormTitle(activeBoard.title);
    setBoardFormDescription(activeBoard.description || '');
    setBoardFormGrade(activeBoard.grade || activeBoard.target_grade || targetGrade);
    setBoardFormTheme(activeBoard.theme);
    setBoardFormColor(activeBoard.color || 'yellow');
    setBoardFormAllowComments(activeBoard.allow_comments);
    setBoardFormRequireApproval(activeBoard.require_approval);
    setBoardFormIsLocked(activeBoard.is_locked);
    setIsEditBoardModalOpen(true);
  };

  // حذف الحائط
  const handleDeleteActiveBoard = async () => {
    if (!activeBoard) return;
    if (confirm(`هل أنت متأكد من حذف الحائط: "${activeBoard.title}" وجميع بطاقاته؟`)) {
      await deletePadletBoard(activeBoard.id);
      const remaining = boards.filter(b => b.id !== activeBoard.id);
      setBoards(remaining);
      if (remaining.length > 0) {
        setSelectedBoardId(remaining[0].id);
      }
    }
  };

  // التصفية والمنشورات المعروضة
  const pendingPostsCount = posts.filter(p => p.status === 'pending').length;
  const displayedPosts = posts.filter(p => {
    if (filterPendingOnly) return p.status === 'pending';
    // إذا كان الطالب ينظر للجدار، يرى المنشورات المعتمدة فقط + منشوراته هو حتى لو كانت معلقة
    if (!isTeacher) {
      return p.status === 'approved' || p.author_id === currentUser.id;
    }
    return true;
  });

  const activeTheme = activeBoard ? THEME_STYLES[activeBoard.theme] : THEME_STYLES.corkboard;

  return (
    <div className={`relative min-h-[720px] rounded-3xl overflow-hidden border ${activeTheme.borderStyle} flex flex-col transition-all duration-300`}>
      {/* شريط رأس الحائط وأدوات المعلم */}
      <div className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-4 transition-colors ${activeTheme.headerClass}`}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-xs">
            📌
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black tracking-tight">{activeBoard?.title || 'الجدار التفاعلي'}</h2>
              {activeBoard?.is_locked && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-200 text-[10px] font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> الجدار مقفل
                </span>
              )}
              {activeBoard?.require_approval && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> موافقة مسبقة
                </span>
              )}
              {activeBoard?.allow_comments && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> التعليقات نشطة
                </span>
              )}
            </div>
            {activeBoard?.description && (
              <p className="text-xs opacity-80 mt-0.5 line-clamp-1">{activeBoard.description}</p>
            )}
          </div>
        </div>

        {/* أدوات التحكم باللوحات */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* زر التبديل بين حوائط الصف وعرض كل الحوائط للطلاب */}
          {!isTeacher && (
            <button
              onClick={() => setShowAllBoards(!showAllBoards)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs border ${
                showAllBoards
                  ? 'bg-amber-600 text-white border-amber-600 shadow-amber-500/20'
                  : 'bg-white/90 hover:bg-white text-slate-700 border-slate-200'
              }`}
              title={showAllBoards ? 'الرجوع لحوائط صفي فقط' : 'عرض كل الحوائط التفاعلية للمدرسة'}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{showAllBoards ? 'حوائط صفي 🎯' : 'عرض كل الحوائط 🌐'}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${showAllBoards ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {showAllBoards ? boards.length : matchingBoards.length}
              </span>
            </button>
          )}

          {/* اختيار اللوحة التفاعلية من اللوحات المتاحة */}
          {visibleBoards.length > 1 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600 hidden md:inline">الحائط:</span>
              <select
                value={activeBoard?.id || ''}
                onChange={(e) => setSelectedBoardId(e.target.value)}
                className="bg-white/95 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500 max-w-[220px] sm:max-w-xs truncate"
              >
                {visibleBoards.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({getGradeDisplayLabel(b.grade || b.target_grade)})
                  </option>
                ))}
              </select>
            </div>
          ) : visibleBoards.length === 1 ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white/70 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700">
              <span>🏷️ {getGradeDisplayLabel(visibleBoards[0].grade || visibleBoards[0].target_grade)}</span>
            </div>
          ) : null}

          {/* زر التحديث اللحظي للجميع */}
          <button
            onClick={() => {
              if (activeBoard) {
                setIsLoading(true);
                syncPadletPostsFromCloud(activeBoard.id)
                  .then(p => { if (p) setPosts(p); })
                  .finally(() => setIsLoading(false));
              }
            }}
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center gap-1 shadow-xs"
            title="تحديث المنشورات من السحابة"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">تحديث</span>
          </button>

          {/* زر المراجعة السريعة للمعلم إذا وُجدت منشورات معلقة */}
          {isTeacher && pendingPostsCount > 0 && (
            <button
              onClick={() => setFilterPendingOnly(!filterPendingOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                filterPendingOnly 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 animate-pulse'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              مراجعة المنشورات المعلقة ({pendingPostsCount})
            </button>
          )}

          {/* أزرار المعلم الخاصة بالحائط */}
          {isTeacher && (
            <>
              <button
                onClick={openEditBoardModal}
                className="px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                title="إعدادات الحائط والثيم"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" /> إعدادات الحائط
              </button>

              <button
                onClick={() => setIsCreateBoardModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                title="إنشاء حائط جديد"
              >
                <Plus className="w-3.5 h-3.5" /> حائط جديد
              </button>
            </>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-xs font-bold transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* مساحة الحائط التفاعلية (Canvas / Wall Body) */}
      <div className={`flex-1 p-6 relative overflow-y-auto ${activeTheme.bgClass} min-h-[580px]`}>
        {/* تنبيه ذكي إذا لم تكن هناك حوائط مخصصة للصف تحديداً */}
        {!isTeacher && matchingBoards.length === 0 && (
          <div className="mb-6 p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-amber-300 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🌟</span>
              <div>
                <span className="font-black block text-amber-900">يتم حالياً عرض الحوائط العامة المتاحة لكافة الطلاب</span>
                <span className="text-[11px] text-amber-800/80">لم ينشئ المعلم بعد حائطاً خاصاً بصفك ({getGradeDisplayLabel(targetGrade)}) تحديداً.</span>
              </div>
            </div>
            {!showAllBoards && (
              <button
                onClick={() => setShowAllBoards(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex-shrink-0 shadow-xs"
              >
                عرض كل جدران المدرسة 🌐
              </button>
            )}
          </div>
        )}

        {/* شريط تنبيه إذا كان الحائط مقفلاً */}
        {activeBoard?.is_locked && (
          <div className="mb-6 p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>هذا الجدار مقفل حالياً للمشاهدة فقط من قبل المعلم. لا يمكن إضافة بطاقات جديدة.</span>
            </div>
            {isTeacher && (
              <button
                onClick={async () => {
                  const updated = { ...activeBoard, is_locked: false };
                  await savePadletBoard(updated);
                  setBoards(getPadletBoards());
                }}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
              >
                إلغاء القفل 🔓
              </button>
            )}
          </div>
        )}

        {/* حالة عدم وجود منشورات */}
        {displayedPosts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-white/70 backdrop-blur-md flex items-center justify-center text-4xl shadow-md mb-4 border border-white/40">
              🎨
            </div>
            <h3 className="text-base font-black text-slate-800 mb-1">
              {filterPendingOnly ? 'لا توجد منشورات معلقة بانتظار الاعتماد 🎉' : 'الحائط جاهز ومستعد لإبداعاتكم!'}
            </h3>
            <p className="text-xs text-slate-600 max-w-md mb-6">
              {filterPendingOnly 
                ? 'جميع البطاقات معتمدة ومنشورة بالفعل.'
                : 'كن أول من يشارك! انقر على الزر الملون بالأسفل لنشر نص مشكول، تسجيل صوتك، أو رسم لوحة جميلة.'}
            </p>
            {(!activeBoard?.is_locked || isTeacher) && !filterPendingOnly && (
              <button
                onClick={() => setIsCreatePostModalOpen(true)}
                className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-lg shadow-amber-500/30 flex items-center gap-2 transition transform hover:scale-105"
              >
                <Plus className="w-4 h-4" /> أضف أول بطاقة إبداعية 🌟
              </button>
            )}
          </div>
        )}

        {/* شبكة بطاقات الحائط (Sticky Notes Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-start pb-24">
          {displayedPosts.map((post, index) => {
            const colorScheme = COLOR_STYLES[post.color || 'yellow'];
            const isAuthor = post.author_id === currentUser.id;
            const isLikedByMe = post.liked_by.includes(currentUser.id);
            const isPending = post.status === 'pending';
            const isPlayingAudio = playingAudioPostId === post.id;
            const isCommentsOpen = expandedCommentsPostId === post.id;

            // ميلان خفيف للبطاقات لإعطاء انطباع البطاقة اللاصقة الحقيقية
            const tiltAngles = ['-rotate-1', 'rotate-1', '-rotate-0.5', 'rotate-0.5', 'rotate-0'];
            const tilt = tiltAngles[index % tiltAngles.length];

            return (
              <div
                key={post.id}
                className={`group relative rounded-2xl p-4 transition-all duration-200 border ${colorScheme.bg} ${colorScheme.border} ${activeTheme.cardBaseClass} ${tilt} hover:rotate-0 hover:z-20`}
              >
                {/* دبوس التثبيت أو الشارة العلوية */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Pin className={`w-4 h-4 ${post.pinned ? 'text-amber-600 fill-amber-500' : activeTheme.pinStyle}`} />
                    {post.pinned && (
                      <span className="text-[10px] font-black text-amber-800 bg-amber-200/80 px-1.5 py-0.2 rounded">
                        مثبتة 📌
                      </span>
                    )}
                    {isPending && (
                      <span className="text-[10px] font-black text-rose-700 bg-rose-200/80 px-2 py-0.5 rounded-full animate-pulse">
                        ⏳ بانتظار الموافقة
                      </span>
                    )}
                  </div>

                  {/* إجراءات المعلم أو صاحب المنشور */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                    {isTeacher && (
                      <button
                        onClick={() => togglePadletPostPin(post.id)}
                        className={`p-1 rounded-md text-xs hover:bg-black/5 transition ${post.pinned ? 'text-amber-600' : 'text-slate-500'}`}
                        title={post.pinned ? 'إلغاء التثبيت' : 'تثبيت في المقدمة'}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {(isTeacher || isAuthor) && (
                      <button
                        onClick={() => {
                          if (confirm('هل أنت متأكد من حذف هذه البطاقة؟')) {
                            deletePadletPost(post.id);
                          }
                        }}
                        className="p-1 rounded-md text-xs text-rose-600 hover:bg-rose-100 transition"
                        title="حذف البطاقة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* معلومات الناشر والوقت */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${colorScheme.badge}`}>
                    {post.author_role === 'teacher' ? '👩‍🏫' : '🧒'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-xs font-black truncate ${colorScheme.header}`}>
                      {post.author_name}
                      {post.author_role === 'teacher' && (
                        <span className="mr-1 text-[10px] text-emerald-700 font-bold">(معلم)</span>
                      )}
                    </h4>
                    <span className="text-[10px] text-slate-500">
                      {new Date(post.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* محتوى الصورة أو الرسم */}
                {post.image_url && (
                  <div className="mb-3 rounded-xl overflow-hidden border border-black/10 bg-white shadow-inner">
                    <img 
                      src={post.image_url} 
                      alt="مرفق البطاقة" 
                      className="w-full h-auto max-h-48 object-contain cursor-pointer hover:scale-105 transition duration-200"
                      onClick={() => {
                        window.open(post.image_url, '_blank');
                      }}
                    />
                  </div>
                )}

                {/* التسجيل الصوتي */}
                {post.audio_url && (
                  <div className="mb-3 p-2.5 rounded-xl bg-white/80 border border-black/10 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => togglePlayAudio(post.id, post.audio_url)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow-xs ${
                        isPlayingAudio 
                          ? 'bg-rose-500 text-white animate-pulse' 
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {isPlayingAudio ? <Square className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white mr-0.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        {isPlayingAudio ? 'جارٍ الاستماع الآن... 🔊' : 'تسجيل صوتي استمع الآن'}
                      </span>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                        <div className={`h-full bg-emerald-500 ${isPlayingAudio ? 'w-full transition-all duration-3000' : 'w-0'}`} />
                      </div>
                    </div>
                  </div>
                )}

                {/* نص البطاقة المشكول */}
                {post.content && (
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed break-words whitespace-pre-wrap mb-3 font-sans">
                    {post.content}
                  </p>
                )}

                {/* زر اعتماد المنشور للمعلم إذا كان معلقاً */}
                {isTeacher && isPending && (
                  <div className="mb-3 p-2 bg-amber-200/80 rounded-xl border border-amber-300 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-amber-900">اعتماد للنشر:</span>
                    <button
                      onClick={() => updatePadletPostStatus(post.id, 'approved')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" /> موافقة ونشر
                    </button>
                  </div>
                )}

                {/* تذييل التفاعلات: إعجاب + تعليقات */}
                <div className="pt-2 border-t border-black/5 flex items-center justify-between text-xs text-slate-600">
                  {/* زر الإعجاب */}
                  <button
                    onClick={() => togglePadletPostLike(post.id, currentUser.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition ${
                      isLikedByMe 
                        ? 'text-rose-600 font-black bg-rose-50' 
                        : 'text-slate-600 hover:text-rose-600 hover:bg-black/5'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isLikedByMe ? 'fill-rose-500 text-rose-500' : ''}`} />
                    <span>{post.likes_count || 0}</span>
                  </button>

                  {/* زر فتح التعليقات */}
                  {activeBoard?.allow_comments && (
                    <button
                      onClick={() => setExpandedCommentsPostId(isCommentsOpen ? null : post.id)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-black/5 transition text-slate-600 font-bold"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments?.length || 0} تعليق</span>
                    </button>
                  )}
                </div>

                {/* قسم التعليقات المنسدل */}
                {activeBoard?.allow_comments && isCommentsOpen && (
                  <div className="mt-3 pt-3 border-t border-black/10 space-y-2 animate-in fade-in">
                    {/* قائمة التعليقات السابقة */}
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                      {(!post.comments || post.comments.length === 0) ? (
                        <p className="text-slate-500 italic text-[10px]">لا توجد تعليقات بعد، كن أول المعلقين!</p>
                      ) : (
                        post.comments.map(c => (
                          <div key={c.id} className="p-1.5 rounded-lg bg-white/70 border border-black/5">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-700 mb-0.5">
                              <span>{c.authorName} {c.authorRole === 'teacher' ? '👩‍🏫' : ''}</span>
                              <span className="text-slate-400 font-normal">{c.createdAt}</span>
                            </div>
                            <p className="text-slate-800 leading-snug">{c.text}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* حقل إرسال تعليق جديد */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <input
                        type="text"
                        placeholder="اكتب تشجيعاً لطيفاً..."
                        value={commentInputs[post.id] || ''}
                        onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                        className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs transition"
                        title="إرسال التعليق"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* زر الإضافة الدائري العائم الملون (+) */}
        {(!activeBoard?.is_locked || isTeacher) && (
          <div className="fixed bottom-8 left-8 z-40">
            <button
              onClick={() => {
                if (activeBoard?.color && ['yellow', 'pink', 'mint', 'blue', 'purple'].includes(activeBoard.color)) {
                  setPostColor(activeBoard.color as PadletCardColor);
                } else {
                  setPostColor('yellow');
                }
                setIsCreatePostModalOpen(true);
              }}
              className="group flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-black text-sm shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200"
            >
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <Plus className="w-5 h-5 group-hover:rotate-90 transition duration-300" />
              </div>
              <span>أضف بطاقتك الإبداعية 📝</span>
            </button>
          </div>
        )}
      </div>

      {/* ================= نافذة إضافة بطاقة جديدة (Post Creator Modal) ================= */}
      {isCreatePostModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  📝
                </div>
                <h3 className="font-extrabold text-base text-slate-800">مشاركة إبداعية جديدة على الجدار</h3>
              </div>
              <button
                onClick={() => setIsCreatePostModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-lg"
              >
                إغلاق ✕
              </button>
            </div>

            {/* اختيار نوع المحتوى */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setPostContentType('text')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  postContentType === 'text' 
                    ? 'bg-amber-500 text-white shadow-xs' 
                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" /> نص وتشكيل
              </button>
              <button
                type="button"
                onClick={() => setPostContentType('audio')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  postContentType === 'audio' 
                    ? 'bg-rose-500 text-white shadow-xs' 
                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Mic className="w-3.5 h-3.5" /> تسجيل صوتي
              </button>
              <button
                type="button"
                onClick={() => setPostContentType('drawing')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  postContentType === 'drawing' 
                    ? 'bg-teal-600 text-white shadow-xs' 
                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Palette className="w-3.5 h-3.5" /> رسم أو صورة
              </button>
            </div>

            {/* اختيار لون البطاقة اللاصقة */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-2">اختر لون ورقتك اللاصقة:</label>
              <div className="flex items-center gap-3">
                {(['yellow', 'pink', 'mint', 'blue', 'purple'] as PadletCardColor[]).map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setPostColor(col)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${COLOR_STYLES[col].bg} ${
                      postColor === col ? 'scale-125 border-slate-800 shadow-md ring-2 ring-slate-300' : 'border-transparent hover:scale-110'
                    }`}
                    title={col}
                  />
                ))}
              </div>
            </div>

            {/* 1. حقل النص والتشكيل */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">اكتب فكرتك أو كلماتك باللغة العربية:</label>
                <button
                  type="button"
                  onClick={handleAutoTashkeel}
                  disabled={isAutoTashkeelActive || !postContent.trim()}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1 disabled:opacity-50"
                  title="ضبط الحركات والتشكيل تلقائياً"
                >
                  <Wand2 className="w-3 h-3 text-amber-600" />
                  {isAutoTashkeelActive ? 'جارٍ التشكيل...' : 'تشكيل ذكي ✨'}
                </button>
              </div>

              <textarea
                rows={3}
                placeholder="اكتب هنا جملتك الجميلة أو ما تعلمته اليوم..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className={`w-full p-3 rounded-2xl border ${COLOR_STYLES[postColor].border} ${COLOR_STYLES[postColor].bg} text-slate-900 text-sm leading-relaxed focus:ring-2 focus:ring-amber-500 focus:outline-none`}
              />

              {/* أزرار الحركات السريعة للأطفال */}
              <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
                <span className="text-[11px] text-slate-400 font-bold ml-1">حركات سريعة:</span>
                {[
                  { mark: 'َ', name: 'فتحة' },
                  { mark: 'ُ', name: 'ضمة' },
                  { mark: 'ِ', name: 'كسرة' },
                  { mark: 'ْ', name: 'سكون' },
                  { mark: 'ّ', name: 'شدة' },
                  { mark: 'ً', name: 'تنوين فتح' },
                  { mark: 'ٌ', name: 'تنوين ضم' },
                  { mark: 'ٍ', name: 'تنوين كسر' }
                ].map((item) => (
                  <button
                    key={item.mark}
                    type="button"
                    onClick={() => addDiacritic(item.mark)}
                    className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm rounded-lg flex items-center justify-center border border-slate-200 shadow-xs active:scale-90 transition"
                    title={item.name}
                  >
                    {item.mark}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. قسم التسجيل الصوتي */}
            {(postContentType === 'audio' || audioUrl) && (
              <div className="mb-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                <label className="block text-xs font-bold text-slate-700 mb-2">تسجيل صوتي بصوتك العذب 🎙️:</label>
                {!audioUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition shadow-md ${
                        isRecording 
                          ? 'bg-rose-600 animate-pulse ring-4 ring-rose-300' 
                          : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-105'
                      }`}
                    >
                      {isRecording ? <Square className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                    <span className="text-xs font-bold text-slate-600">
                      {isRecording ? `جارٍ التسجيل (${recordingSeconds} ثانية) - انقر للإيقاف` : 'انقر على الميكروفون لبدء التسجيل'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <audio src={audioUrl} controls className="h-9 w-60" />
                    <button
                      type="button"
                      onClick={() => setAudioUrl(null)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1"
                    >
                      حذف وإعادة التسجيل ✕
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. قسم الرسم المباشر أو رفع صورة */}
            {postContentType === 'drawing' && (
              <div className="mb-4 space-y-3">
                <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-teal-600" /> ارسم لوحتك بيدك:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {['#1e293b', '#dc2626', '#2563eb', '#16a34a', '#d97706', '#9333ea'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setBrushColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-5 h-5 rounded-full border ${brushColor === c ? 'ring-2 ring-slate-800 scale-110' : ''}`}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="text-[11px] text-slate-500 hover:text-slate-700 mr-2 flex items-center gap-0.5"
                      >
                        <RotateCcw className="w-3 h-3" /> مسح
                      </button>
                    </div>
                  </div>

                  {/* لوحة الرسم التفاعلية */}
                  <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={480}
                      height={200}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-44 cursor-crosshair touch-none bg-white"
                    />
                  </div>
                </div>

                {/* خيار رفع صورة كبديل */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-bold">أو:</span>
                  <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                    <span>رفع صورة من جهازك</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                  {uploadedImageUrl && (
                    <button
                      type="button"
                      onClick={() => setUploadedImageUrl(null)}
                      className="text-xs text-rose-600 font-bold"
                    >
                      إلغاء الصورة ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* تنبيه موافقة المعلم */}
            {activeBoard?.require_approval && !isTeacher && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>ملاحظة: ستتم مراجعة بطاقتك واعتمادها من قبل المعلم قبل ظهورها لبقية الزملاء.</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreatePostModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSubmittingPost}
                onClick={handleCreatePost}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                {isSubmittingPost ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ الحفظ السحابي...</span>
                  </>
                ) : (
                  <span>نشر البطاقة على الجدار 📌</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= نافذة إعدادات وتخصيص الحائط (Teacher Board Settings Modal) ================= */}
      {isEditBoardModalOpen && activeBoard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-700" />
                <h3 className="font-extrabold text-base text-slate-800">إعدادات وضبط الحائط التفاعلي</h3>
              </div>
              <button
                onClick={() => setIsEditBoardModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-lg"
              >
                إغلاق ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">عنوان الحائط:</label>
                <input
                  type="text"
                  value={boardFormTitle}
                  onChange={(e) => setBoardFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وصف الحائط / التعليمات للطلاب:</label>
                <textarea
                  rows={2}
                  value={boardFormDescription}
                  onChange={(e) => setBoardFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الصف الدراسي المستهدف:</label>
                <select
                  value={boardFormGrade}
                  onChange={(e) => setBoardFormGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="all">جميع الصفوف (حائط عام لجميع طلاب المدرسة 🌟)</option>
                  <option value="grade-1">الصف الأول الابتدائي</option>
                  <option value="grade-2">الصف الثاني الابتدائي</option>
                  <option value="grade-3">الصف الثالث الابتدائي</option>
                  <option value="grade-4">الصف الرابع الابتدائي</option>
                  <option value="grade-5">الصف الخامس الابتدائي</option>
                  <option value="grade-6">الصف السادس الابتدائي</option>
                  <option value="grade-7">الصف السابع</option>
                  <option value="grade-8">الصف الثامن</option>
                  <option value="grade-9">الصف التاسع</option>
                  <option value="grade-10">الصف العاشر</option>
                  <option value="grade-11">الصف الحادي عشر</option>
                  <option value="grade-12">الصف الثاني عشر</option>
                  <option value="kg">مرحلة الروضة والتمهيدي</option>
                </select>
              </div>

              {/* اختيار اللون الافتراضي للحائط */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>اللون الافتراضي للحائط والبطاقات:</span>
                  <span className="text-[10px] text-slate-500 font-normal">الافتراضي: أصفر (yellow)</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {(Object.keys(CARD_COLOR_MAP) as PadletCardColor[]).map((cKey) => {
                    const isSel = (boardFormColor || 'yellow') === cKey;
                    return (
                      <button
                        key={cKey}
                        type="button"
                        onClick={() => setBoardFormColor(cKey)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                          CARD_COLOR_MAP[cKey].bgClass
                        } ${CARD_COLOR_MAP[cKey].textClass} ${
                          isSel ? 'ring-2 ring-amber-500 font-black shadow-xs' : 'opacity-80 hover:opacity-100'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full ${CARD_COLOR_MAP[cKey].badgeBg}`} />
                        <span>{CARD_COLOR_MAP[cKey].name}</span>
                        {isSel && <Check className="w-3.5 h-3.5 text-amber-700" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* اختيار الثيم والخلفية */}
              <div>
                <label className="block font-bold text-slate-700 mb-2">ثيم وخلفية الحائط:</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(THEME_STYLES) as PadletTheme[]).map((thKey) => (
                    <button
                      key={thKey}
                      type="button"
                      onClick={() => setBoardFormTheme(thKey)}
                      className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between ${
                        boardFormTheme === thKey 
                          ? 'border-amber-500 bg-amber-50/60 font-black text-amber-900 ring-2 ring-amber-400' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-[11px]">{THEME_STYLES[thKey].name}</span>
                      {boardFormTheme === thKey && <Check className="w-3.5 h-3.5 text-amber-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* خيارات الضبط والتحكم المتقدمة */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 block">السماح بالتعليقات بين الطلاب</span>
                    <span className="text-[10px] text-slate-500">يتيح للطلاب والمعلمين كتابة ردود تحت كل بطاقة</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={boardFormAllowComments}
                    onChange={(e) => setBoardFormAllowComments(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer border-t border-slate-200/60 pt-2">
                  <div>
                    <span className="font-bold text-slate-800 block">الموافقة على المنشورات قبل النشر</span>
                    <span className="text-[10px] text-slate-500">لا يظهر منشور الطالب للجميع إلا بعد مراجعة المعلم واعتماده</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={boardFormRequireApproval}
                    onChange={(e) => setBoardFormRequireApproval(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer border-t border-slate-200/60 pt-2">
                  <div>
                    <span className="font-bold text-slate-800 block">قفل الحائط لمنع الإضافة</span>
                    <span className="text-[10px] text-slate-500">يمنع إضافة أو تعديل البطاقات ويبقى الحائط للمشاهدة فقط</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={boardFormIsLocked}
                    onChange={(e) => setBoardFormIsLocked(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleDeleteActiveBoard}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> حذف الحائط
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditBoardModalOpen(false)}
                    className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdateBoardSettings}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition shadow-xs"
                  >
                    حفظ التغييرات ✅
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= نافذة إنشاء حائط جديد للمعلم (New Board Modal) ================= */}
      {isCreateBoardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-base text-slate-800">إنشاء حائط تفاعلي جديد لصفك</h3>
              </div>
              <button
                onClick={() => setIsCreateBoardModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-lg"
              >
                إغلاق ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">عنوان الحائط:</label>
                <input
                  type="text"
                  placeholder="مثال: جدار إبداعات حرف الباء والأصوات الجميلة 🎨"
                  value={boardFormTitle}
                  onChange={(e) => setBoardFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الصف والمسار المستهدف:</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={boardFormGrade}
                    onChange={(e) => setBoardFormGrade(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50"
                  >
                    <option value="all">جميع الصفوف (حائط عام لكل المدرسة 🌟)</option>
                    <option value="grade-1">الصف الأول الابتدائي</option>
                    <option value="grade-2">الصف الثاني الابتدائي</option>
                    <option value="grade-3">الصف الثالث الابتدائي</option>
                    <option value="grade-4">الصف الرابع الابتدائي</option>
                    <option value="grade-5">الصف الخامس الابتدائي</option>
                    <option value="grade-6">الصف السادس الابتدائي</option>
                    <option value="grade-7">الصف السابع</option>
                    <option value="grade-8">الصف الثامن</option>
                    <option value="grade-9">الصف التاسع</option>
                    <option value="grade-10">الصف العاشر</option>
                    <option value="grade-11">الصف الحادي عشر</option>
                    <option value="grade-12">الصف الثاني عشر</option>
                    <option value="kg">مرحلة الروضة والتمهيدي</option>
                  </select>

                  <select
                    value={boardFormTrack}
                    onChange={(e) => setBoardFormTrack(e.target.value as ArabicTrack)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50"
                  >
                    <option value="arabic-a">مسار الناطقين (A)</option>
                    <option value="arabic-b">مسار غير الناطقين (B)</option>
                  </select>
                </div>
              </div>

              {/* اختيار اللون الافتراضي للحائط */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>اللون الافتراضي للحائط والبطاقات:</span>
                  <span className="text-[10px] text-slate-500 font-normal">الافتراضي: أصفر كلاسيكي (yellow)</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {(Object.keys(CARD_COLOR_MAP) as PadletCardColor[]).map((cKey) => {
                    const isSel = (boardFormColor || 'yellow') === cKey;
                    return (
                      <button
                        key={cKey}
                        type="button"
                        onClick={() => setBoardFormColor(cKey)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                          CARD_COLOR_MAP[cKey].bgClass
                        } ${CARD_COLOR_MAP[cKey].textClass} ${
                          isSel ? 'ring-2 ring-emerald-600 font-black shadow-xs' : 'opacity-80 hover:opacity-100'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full ${CARD_COLOR_MAP[cKey].badgeBg}`} />
                        <span>{CARD_COLOR_MAP[cKey].name}</span>
                        {isSel && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">وصف أو توجيه للطلاب:</label>
                <textarea
                  rows={2}
                  placeholder="اكتب رسالة ترحيبية أو توجيهات النشاط المطلوب من الطلاب..."
                  value={boardFormDescription}
                  onChange={(e) => setBoardFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* اختيار الثيم */}
              <div>
                <label className="block font-bold text-slate-700 mb-2">ثيم وخلفية الجدار:</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(THEME_STYLES) as PadletTheme[]).map((thKey) => (
                    <button
                      key={thKey}
                      type="button"
                      onClick={() => setBoardFormTheme(thKey)}
                      className={`p-2.5 rounded-xl border text-right transition flex items-center justify-between ${
                        boardFormTheme === thKey 
                          ? 'border-emerald-500 bg-emerald-50/60 font-black text-emerald-900 ring-2 ring-emerald-400' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-[11px]">{THEME_STYLES[thKey].name}</span>
                      {boardFormTheme === thKey && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* خيارات الضبط */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-bold text-slate-800">السماح بالتعليقات السريعة</span>
                  <input
                    type="checkbox"
                    checked={boardFormAllowComments}
                    onChange={(e) => setBoardFormAllowComments(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer border-t border-slate-200/60 pt-2">
                  <span className="font-bold text-slate-800">الموافقة على المنشورات قبل النشر</span>
                  <input
                    type="checkbox"
                    checked={boardFormRequireApproval}
                    onChange={(e) => setBoardFormRequireApproval(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateBoardModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewBoard}
                  disabled={isSubmittingBoard}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl transition shadow-xs flex items-center gap-2"
                >
                  {isSubmittingBoard ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جارٍ إنشاء الحائط...</span>
                    </>
                  ) : (
                    <span>إنشاء الحائط الآن 🚀</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
