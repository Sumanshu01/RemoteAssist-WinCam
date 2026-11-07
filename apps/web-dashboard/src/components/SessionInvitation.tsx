import React, { useState } from "react";
import { Copy, Check, Share2, Shield, Clock, RefreshCw } from "lucide-react";

interface SessionInvitationProps {
  sessionCode: string;
  inviteUrl: string;
  pin: string;
  expiresInMinutes?: number;
  onGenerateNew?: () => void;
  isLoading?: boolean;
}

export const SessionInvitation: React.FC<SessionInvitationProps> = ({
  sessionCode,
  inviteUrl,
  pin,
  expiresInMinutes = 30,
  onGenerateNew,
  isLoading = false
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const copyToClipboard = async (text: string, type: "code" | "url") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "code") {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className="glass-card glass-card-hover p-6 border-slate-200"
      role="region"
      aria-label="Session Invitation"
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-base">Remote Session Invitation</h3>
            <p className="text-xs text-slate-500">
              Provide this code or link to the user requesting remote camera assistance.
            </p>
          </div>
        </div>

        {onGenerateNew && (
          <button
            onClick={onGenerateNew}
            disabled={isLoading}
            className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors disabled:opacity-50"
            title="Generate a new session code"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Regenerate
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-5">
        {/* Session Code Box */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            One-Time Session Code
          </span>
          <div className="flex items-center justify-between mt-2">
            <span className="font-mono text-2xl font-bold tracking-widest text-blue-700">
              {sessionCode}
            </span>
            <button
              onClick={() => copyToClipboard(sessionCode, "code")}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200"
              aria-label="Copy session code"
              title="Copy session code"
            >
              {copiedCode ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Valid for {expiresInMinutes} minutes</span>
          </div>
        </div>

        {/* Security PIN Box */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Verification PIN
          </span>
          <div className="flex items-center justify-between mt-2">
            <span className="font-mono text-2xl font-bold tracking-widest text-slate-800">
              {pin}
            </span>
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
              <Shield className="w-3.5 h-3.5" />
              <span>TLS Secured</span>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            Must match PIN shown on sender's screen before stream starts.
          </div>
        </div>
      </div>

      {/* Direct Invitation Link */}
      <div className="mt-4">
        <label
          htmlFor="invite-url-input"
          className="block text-xs font-medium text-slate-600 mb-1.5"
        >
          Direct Web Link for Remote User
        </label>
        <div className="flex items-center gap-2">
          <input
            id="invite-url-input"
            type="text"
            readOnly
            value={inviteUrl}
            className="flex-1 px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700 select-all"
          />
          <button
            onClick={() => copyToClipboard(inviteUrl, "url")}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
            aria-label="Copy invitation link"
          >
            {copiedUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Link
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
