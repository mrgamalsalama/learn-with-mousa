import React, { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { UserProfile } from '../types';
import { getUnreadMessagesCount } from '../services/chatService';

interface FloatingChatButtonProps {
  currentUser: UserProfile;
  onClick: () => void;
  hasCompanion?: boolean;
}

export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({
  currentUser,
  onClick,
  hasCompanion = false
}) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // تحديث عداد الرسائل غير المقروءة دورياً
  useEffect(() => {
    let isMounted = true;

    const checkUnread = async () => {
      try {
        const count = await getUnreadMessagesCount(currentUser.id, currentUser.school_id || '');
        if (isMounted) setUnreadCount(count);
      } catch (e) {
        // ignore
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUser.id, currentUser.school_id]);

  return (
    <div className={`fixed bottom-6 z-40 transition-all duration-300 ${
      hasCompanion ? 'left-26 sm:left-28' : 'left-6'
    }`}>
      <button
        type="button"
        onClick={onClick}
        className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-full shadow-xl shadow-emerald-700/30 border-2 border-white/60 transition duration-300 hover:scale-105 active:scale-95 cursor-pointer"
        title="مركز الرسائل المدرسية والتواصل الفوري"
      >
        <div className="relative">
          <MessageSquare className="w-5 h-5 text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-bounce shadow-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span className="font-extrabold text-xs tracking-tight hidden sm:inline">
          الرسائل المدرسية
        </span>
        {unreadCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/25 text-emerald-100">
            {unreadCount} جديدة
          </span>
        )}
      </button>
    </div>
  );
};
