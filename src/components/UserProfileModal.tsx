import React, { useState, useEffect } from 'react';
import {
  User,
  Camera,
  Globe,
  Clock,
  Lock,
  Sliders,
  Volume2,
  VolumeX,
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  X,
  Upload,
  Trash2,
  MapPin,
  Headphones,
  ShieldCheck,
  Award,
  GraduationCap
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  STUDENT_AVATARS,
  ACADEMIC_AVATARS,
  ARABIC_TIMEZONES,
  getAvatarInfo,
  getDetectedBrowserTimezone
} from '../utils/avatarUtils';
import { saveUser } from '../storage';
import { supabase } from '../supabaseClient';
import { challengeAudio } from '../utils/challengeAudio';
import { speakMousa } from '../geminiService';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onUserUpdate: (updatedUser: UserProfile) => void;
}

type TabType = 'profile' | 'timezone' | 'security' | 'preferences';

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdate
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  // حقول الملف الشخصي
  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || (currentUser.username ? `${currentUser.username}@learnmousa.edu` : ''));
  const [bio, setBio] = useState(currentUser.preferences?.bio || '');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentUser.avatar || '');

  // حقول النطاق الزمني
  const detectedTz = getDetectedBrowserTimezone();
  const [selectedTimezone, setSelectedTimezone] = useState<string>(
    currentUser.timezone || detectedTz || 'Africa/Cairo'
  );
  const [currentTimePreview, setCurrentTimePreview] = useState<string>('');

  // حقول الأمان وكلمة المرور
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: ''
  });

  // حقول تفضيلات التعلم والخصوصية
  const [anonymousInLeaderboard, setAnonymousInLeaderboard] = useState<boolean>(
    currentUser.preferences?.anonymousInLeaderboard || false
  );
  const [soundEffects, setSoundEffects] = useState<boolean>(
    currentUser.preferences?.soundEffects !== false
  );
  const [voiceSpeed, setVoiceSpeed] = useState<number>(
    currentUser.preferences?.voiceSpeed || 1.0
  );

  // حالات الحفظ والإشعار العام
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // تحديث الساعة الحية للنطاق الزمني المختار
  useEffect(() => {
    const updateClock = () => {
      try {
        const now = new Date();
        const dateStr = now.toLocaleDateString('ar-EG', {
          timeZone: selectedTimezone,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('ar-EG', {
          timeZone: selectedTimezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        setCurrentTimePreview(`${dateStr} • الساعة ${timeStr}`);
      } catch {
        setCurrentTimePreview(new Date().toLocaleTimeString('ar-EG'));
      }
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [selectedTimezone]);

  if (!isOpen) return null;

  const isStudent = currentUser.role === 'student';
  const isTeacherOrAdmin = ['teacher', 'hod', 'super_admin', 'parent'].includes(currentUser.role);
  const currentAvatarInfo = getAvatarInfo({ ...currentUser, avatar: selectedAvatar });

  // معالجة رفع صورة مخصصة
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 2.5 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2.5 ميغابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      if (dataUrl) {
        setSelectedAvatar(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // تجربة المؤثرات الصوتية
  const handleTestSound = () => {
    if (soundEffects) {
      challengeAudio.setEnabled(true);
      challengeAudio.playCorrect();
    }
  };

  // تجربة صوت موسى بالسرعة المختارة
  const handleTestVoice = () => {
    speakMousa(
      'مَرْحَبًا بِكَ يَا بَطَل! أَنَا مُوسَى مُرْشِدُكَ فِي رِحْلَةِ التَّعَلُّمِ وَالإِبْدَاع!',
      undefined,
      voiceSpeed
    );
  };

  // تغيير كلمة المرور عبر Supabase Auth
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityStatus({ type: 'idle', message: '' });

    if (!newPassword || newPassword.length < 6) {
      setSecurityStatus({
        type: 'error',
        message: 'يجب أن لا تقل كلمة المرور الجديدة عن 6 أحرف أو أرقام.'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityStatus({
        type: 'error',
        message: 'كلمة المرور الجديدة وتأكيدها غير متطابقين!'
      });
      return;
    }

    setSecurityStatus({ type: 'loading', message: 'جاري تحديث كلمة المرور وتأمين الحساب...' });

    try {
      // 1. تحديث في Supabase Auth إذا كانت الجلسة السحابية مفعلة
      let supabaseAuthSuccess = false;
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (!error) {
          supabaseAuthSuccess = true;
        } else {
          console.warn('تحديث كلمة المرور في Supabase Auth غير متاح للجلسة الحالية:', error.message);
        }
      } catch (authErr) {
        console.warn('استثناء في Supabase Auth:', authErr);
      }

      // 2. تحديث كلمة المرور في ملف المستخدم محلياً وسحابياً في جدول users
      const updated: UserProfile = {
        ...currentUser,
        password: newPassword
      };
      await saveUser(updated);
      onUserUpdate(updated);

      setSecurityStatus({
        type: 'success',
        message: supabaseAuthSuccess
          ? 'تم تغيير وتأمين كلمة المرور بنجاح في نظام المصادقة وقاعدة البيانات! 🔐'
          : 'تم تحديث وحفظ كلمة المرور الجديدة بنجاح للمستخدم! 🔐'
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      challengeAudio.playCorrect();
    } catch (err: any) {
      setSecurityStatus({
        type: 'error',
        message: 'حدث خطأ أثناء تغيير كلمة المرور: ' + (err.message || 'يرجى المحاولة ثانية.')
      });
    }
  };

  // حفظ جميع التعديلات
  const handleSaveAllChanges = async () => {
    setIsSaving(true);
    setSaveFeedback(null);

    try {
      // تحديث حالة الصوت في محرك المؤثرات
      challengeAudio.setEnabled(soundEffects);

      const updatedUser: UserProfile = {
        ...currentUser,
        name: name.trim() || currentUser.name,
        email: email.trim() || undefined,
        avatar: selectedAvatar || undefined,
        timezone: selectedTimezone,
        preferences: {
          ...currentUser.preferences,
          soundEffects,
          voiceSpeed,
          anonymousInLeaderboard,
          bio: bio.trim() || undefined
        }
      };

      const result = await saveUser(updatedUser);
      onUserUpdate(result.user || updatedUser);

      setSaveFeedback('تم حفظ جميع الإعدادات وتحديث ملفك الشخصي بنجاح! 💾✨');
      challengeAudio.playCorrect();

      setTimeout(() => {
        setSaveFeedback(null);
        onClose();
      }, 1200);
    } catch (e: any) {
      console.error('فشل حفظ إعدادات المستخدم:', e);
      setSaveFeedback('حدث خطأ أثناء حفظ الإعدادات، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabelMap: Record<string, { label: string; color: string; icon: string }> = {
    student: { label: 'طالب متميز', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '🌟' },
    teacher: { label: 'معلم اللغة العربية', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: '👨‍🏫' },
    hod: { label: 'رئيس قسم اللغة العربية', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: '🎓' },
    super_admin: { label: 'المشرف العام والمؤسس', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: '🛡️' },
    parent: { label: 'ولي أمر داعم', color: 'bg-teal-100 text-teal-800 border-teal-300', icon: '👨‍👩‍👧' }
  };

  const roleInfo = roleLabelMap[currentUser.role] || { label: currentUser.role, color: 'bg-slate-100 text-slate-800', icon: '👤' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div
        id="user-profile-modal-container"
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* الشريط العلوي للنافذة */}
        <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentAvatarInfo.bgGradient} flex items-center justify-center text-2xl shadow-md border-2 border-white/20 overflow-hidden shrink-0`}>
              {currentAvatarInfo.isCustomUrl ? (
                <img
                  src={currentAvatarInfo.value}
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{currentAvatarInfo.emoji}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  إعدادات الملف الشخصي والحساب
                </h2>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${roleInfo.color} flex items-center gap-1 shadow-xs`}>
                  <span>{roleInfo.icon}</span>
                  <span>{roleInfo.label}</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                مرحباً بك يا <b>{currentUser.name}</b> • تخصيص الصورة، التوقيت، الأمان والخصوصية
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* شريط التبويبات الأربعة */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 flex gap-2 overflow-x-auto py-2.5 scrollbar-thin">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <User className="w-3.5 h-3.5" /> الملف التعريفي والصورة
          </button>

          <button
            onClick={() => setActiveTab('timezone')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'timezone'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> النطاق الزمني والتوقيت
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'security'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> الأمان وكلمة المرور
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'preferences'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> تفضيلات التعلم والخصوصية
          </button>
        </div>

        {/* جسم النافذة ومحتوى التبويبات */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* ================= التبويب الأول: الملف التعريفي والصورة ================= */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* بطاقة معلومات الحساب */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600" /> البيانات الأساسية
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      الاسم الكامل المعروض
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      placeholder="اسمك الكامل"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      اسم المستخدم (لتسجيل الدخول)
                    </label>
                    <input
                      type="text"
                      value={currentUser.username}
                      disabled
                      className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      البريد الإلكتروني المعتمد
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      placeholder="example@learnmousa.edu"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      الدور والمرحلة الدراسية
                    </label>
                    <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>{roleInfo.label}</span>
                      {currentUser.grade && (
                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                          {currentUser.grade}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    نبذة تعريفية أو شعارك التعليمي (اختياري)
                  </label>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    placeholder="مثال: أسعى لحصد المراكز الأولى في تحديات موسى للقراءة والخط 🌟"
                  />
                </div>
              </div>

              {/* قسم اختيار الصورة الشخصية / الأفاتار */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      {isStudent ? 'اختر الأفاتار الكرتوني المفضل لك مع موسى 🦁' : 'الصورة الشخصية والشارة الأكاديمية 🎓'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isStudent
                        ? 'مجموعة آمنة ومحببة للأطفال تمثل شخصية موسى وأصدقائه الأبطال'
                        : 'يمكنك رفع صورة مخصصة أو اختيار إحدى الشارات الأكاديمية الرمزية'}
                    </p>
                  </div>

                  {selectedAvatar && (
                    <button
                      type="button"
                      onClick={() => setSelectedAvatar('')}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> إعادة الضبط للافتراضي
                    </button>
                  )}
                </div>

                {/* للمعلمين والإدارة وأولياء الأمور: دعم رفع صورة مخصصة */}
                {isTeacherOrAdmin && (
                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-white border-2 border-indigo-200 flex items-center justify-center overflow-hidden shadow-xs shrink-0">
                        {currentAvatarInfo.isCustomUrl ? (
                          <img
                            src={currentAvatarInfo.value}
                            alt={currentUser.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-3xl">{currentAvatarInfo.emoji}</span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-indigo-950">رفع صورة شخصية مخصصة</h4>
                        <p className="text-[11px] text-slate-500">
                          صيغ مقبولة (JPG, PNG, WebP) بحد أقصى 2.5 ميغابايت
                        </p>
                      </div>
                    </div>

                    <label className="cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>اختيار صورة من جهازك</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* شبكة أفاتارات الطلاب الكرتونية */}
                {isStudent && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {STUDENT_AVATARS.map((avatar) => {
                      const isSelected = selectedAvatar === avatar.id || (!selectedAvatar && avatar.id === 'mousa_hero');
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => setSelectedAvatar(avatar.id)}
                          className={`relative p-3 rounded-2xl border text-right transition flex flex-col items-center text-center gap-2 group ${
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}

                          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatar.bgGradient} flex items-center justify-center text-3xl shadow-sm group-hover:scale-105 transition transform`}>
                            <span>{avatar.emoji}</span>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-slate-800">{avatar.name}</p>
                            <span className="inline-block mt-0.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                              {avatar.badge}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* شبكة الشارات الأكاديمية للمعلمين والإدارة */}
                {isTeacherOrAdmin && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-indigo-600" /> أو اختر إحدى الشارات الأكاديمية الرمزية:
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {ACADEMIC_AVATARS.map((acad) => {
                        const isSelected = selectedAvatar === acad.id;
                        return (
                          <button
                            key={acad.id}
                            type="button"
                            onClick={() => setSelectedAvatar(acad.id)}
                            className={`relative p-3 rounded-2xl border text-center transition flex flex-col items-center gap-2 group ${
                              isSelected
                                ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                            )}

                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${acad.bgGradient} flex items-center justify-center text-2xl shadow-xs group-hover:scale-105 transition transform`}>
                              <span>{acad.emoji}</span>
                            </div>

                            <p className="text-[11px] font-bold text-slate-800 leading-tight">
                              {acad.name}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= التبويب الثاني: ضبط النطاق الزمني والتوقيت ================= */}
          {activeTab === 'timezone' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* بطاقة توضيحية عن مبدأ التوقيت العالمي UTC */}
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-cyan-50 border border-blue-200/80 rounded-2xl p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-extrabold text-blue-950 flex items-center gap-1.5">
                      التزامن التام ومبدأ التخزين العالمي (Universal Time Coordinated - UTC)
                    </h3>
                    <p className="text-xs text-blue-900/85 leading-relaxed">
                      تعتمد منصة «تعلَّم مع موسى» تخزين كافة مواعيد الاختبارات المجدولة، وحصص البث المباشر، وتسليمات الطلاب بصيغة <b>UTC العالمية</b> في قاعدة بيانات Supabase، ويتم تحويلها وعرضها لك تلقائياً وفق النطاق الزمني المختار في ملفك الشخصي أدناه.
                    </p>
                  </div>
                </div>
              </div>

              {/* بطاقة الساعة الرقمية الحية في النطاق الزمني المختار */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                    <Clock className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider block">
                      الوقت الفعلي في منطقتك الزمنية المحددة
                    </span>
                    <p className="text-base sm:text-lg font-mono font-extrabold text-emerald-400 mt-0.5">
                      {currentTimePreview || 'جاري المزامنة...'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const detected = getDetectedBrowserTimezone();
                    setSelectedTimezone(detected);
                    challengeAudio.playCorrect();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition flex items-center gap-1.5 border border-white/10 shrink-0"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>اكتشاف منطقتي تلقائياً 📍</span>
                </button>
              </div>

              {/* القائمة المنسدلة لاختيار النطاق الزمني */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    اختر منطقتك الزمنية من القائمة:
                  </label>
                  <select
                    value={selectedTimezone}
                    onChange={(e) => setSelectedTimezone(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
                  >
                    {ARABIC_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.flag} {tz.label} ({tz.offset})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    المنطقة الزمنية المكتشفة من متصفحك حالياً: <b>{detectedTz}</b>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ================= التبويب الثالث: الأمان وكلمة المرور ================= */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      تغيير وتأمين كلمة المرور
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      يتم تشفير وتحديث كلمة المرور مباشرة عبر Supabase Auth وقاعدة بيانات المنصة
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPassword ? 'إخفاء الرموز' : 'إظهار الرموز'}</span>
                  </button>
                </div>

                {securityStatus.message && (
                  <div
                    className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      securityStatus.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : securityStatus.type === 'error'
                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                        : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                    }`}
                  >
                    {securityStatus.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {securityStatus.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{securityStatus.message}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      كلمة المرور الحالية (اختياري للتحقق)
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      placeholder="أدخل كلمة المرور الحالية"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        كلمة المرور الجديدة
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        placeholder="6 أحرف أو أرقام على الأقل"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        تأكيد كلمة المرور الجديدة
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        placeholder="أعد إدخال الكلمة الجديدة"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={securityStatus.type === 'loading'}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{securityStatus.type === 'loading' ? 'جاري التحديث...' : 'تحديث كلمة المرور الآن 🔐'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ================= التبويب الرابع: تفضيلات التعلم والخصوصية ================= */}
          {activeTab === 'preferences' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* خيار الخصوصية: الاسم المستعار */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                    <span>🕵️‍♂️</span> استخدام الاسم المستعار في لوحات الصدارة
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
                    حماية خصوصية الطالب في مسابقات التحدي المباشر العامة؛ حيث يظهر على لوحة المتصدرين باسم رمزي مثل <b>«بطل التحدي 🌟 ({currentUser.name.slice(0, 1)}***)»</b> بدلاً من اسمه الكامل.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={anonymousInLeaderboard}
                    onChange={(e) => setAnonymousInLeaderboard(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* خيار المؤثرات الصوتية */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                      {soundEffects ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                      المؤثرات الصوتية الحماسية للمنصة
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      تشغيل أصوات الفرح والتشجيع وتكتكة المؤقت التنازلي الحماسي أثناء حل الأسئلة والمسابقات.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={handleTestSound}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg transition flex items-center gap-1 shadow-xs"
                      title="تجربة صوت النغمة"
                    >
                      <span>تجربة النغمة 🔔</span>
                    </button>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={soundEffects}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setSoundEffects(val);
                          challengeAudio.setEnabled(val);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* خيار سرعة نطق الموجه الصوتي "موسى" */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                      <Headphones className="w-4 h-4 text-indigo-600" />
                      سرعة نطق الموجه الصوتي «مُوسَى»
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      اختر سرعة التحدث المناسبة لعمر الطالب ومستوى استيعابه
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestVoice}
                    className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
                  >
                    <span>استمع لنموذج صوت موسى 🎧</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setVoiceSpeed(0.8)}
                    className={`p-3 rounded-xl border text-center transition ${
                      voiceSpeed === 0.8
                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <span className="text-sm block">🐢 0.8x</span>
                    <span className="text-[11px] block mt-0.5 opacity-90">هادئ وبطيء (للصغار)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVoiceSpeed(1.0)}
                    className={`p-3 rounded-xl border text-center transition ${
                      voiceSpeed === 1.0
                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <span className="text-sm block">🚶‍♂️ 1.0x</span>
                    <span className="text-[11px] block mt-0.5 opacity-90">طبيعي ومعتدل (الافتراضي)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVoiceSpeed(1.2)}
                    className={`p-3 rounded-xl border text-center transition ${
                      voiceSpeed === 1.2
                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <span className="text-sm block">⚡ 1.2x</span>
                    <span className="text-[11px] block mt-0.5 opacity-90">حماسي وسريع</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* شريط الأزرار السفلي لحفظ التغييرات */}
        <footer className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs">
            {saveFeedback ? (
              <span className="font-bold text-emerald-700 bg-emerald-100/80 px-3 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {saveFeedback}
              </span>
            ) : (
              <span className="text-slate-500">
                يتم حفظ جميع التعديلات فوراً وتطبيقها في كامل المنصة.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleSaveAllChanges}
              disabled={isSaving}
              className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-md shadow-indigo-600/20"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات 💾'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
