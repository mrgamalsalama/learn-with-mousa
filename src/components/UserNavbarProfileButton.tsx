import React from 'react';
import { Settings } from 'lucide-react';
import { UserProfile } from '../types';
import { getAvatarInfo } from '../utils/avatarUtils';

interface UserNavbarProfileButtonProps {
  user: UserProfile;
  onClick: () => void;
}

export const UserNavbarProfileButton: React.FC<UserNavbarProfileButtonProps> = ({ user, onClick }) => {
  const avatarInfo = getAvatarInfo(user);

  return (
    <button
      type="button"
      id="navbar-profile-settings-button"
      onClick={onClick}
      className="group flex items-center gap-2 px-2 sm:px-2.5 py-1.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-300 transition shadow-2xs text-right cursor-pointer"
      title="الملف الشخصي وإعدادات الحساب ⚙️"
    >
      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avatarInfo.bgGradient} flex items-center justify-center text-lg shadow-2xs border border-white/50 overflow-hidden shrink-0 group-hover:scale-105 transition transform`}>
        {avatarInfo.isCustomUrl ? (
          <img
            src={avatarInfo.value}
            alt={user.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span>{avatarInfo.emoji}</span>
        )}
      </div>

      <div className="hidden md:block text-right">
        <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-900 transition leading-tight truncate max-w-[130px]">
          {user.name}
        </p>
        <span className="text-[10px] text-slate-500 group-hover:text-indigo-600 font-medium flex items-center gap-1">
          <Settings className="w-2.5 h-2.5" /> إعدادات الحساب
        </span>
      </div>

      <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 group-hover:border-indigo-300 text-slate-400 group-hover:text-indigo-600 flex items-center justify-center transition shrink-0">
        <Settings className="w-3.5 h-3.5 group-hover:rotate-45 transition transform duration-300" />
      </div>
    </button>
  );
};
