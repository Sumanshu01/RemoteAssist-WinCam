import React from "react";
import { MonitorPlay, Globe2, UserCheck } from "lucide-react";

interface HeaderProps {
  userRole?: string;
  userName?: string;
  originRegion?: string;
  targetRegion?: string;
}

export const Header: React.FC<HeaderProps> = ({
  userRole = "Specialist",
  userName = "Dr. Aris Vance (Specialist)",
  originRegion = "Canada (CA)",
  targetRegion = "India (IN)"
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <MonitorPlay className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-base tracking-tight">
                RemoteAssist WinCam
              </span>
              <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                Win 11 Architecture
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Consent-Governed Cross-Border Video & App Support
            </p>
          </div>
        </div>

        {/* Corridor & User Role Info */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            <Globe2 className="w-4 h-4 text-blue-600" />
            <span>
              Route: <strong className="text-slate-800">{originRegion}</strong> ↔{" "}
              <strong className="text-slate-800">{targetRegion}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <UserCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-slate-800 leading-none">{userName}</div>
              <span className="text-[10px] text-slate-500 font-medium">{userRole}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
