import React from "react";
import { ShieldCheck, AlertOctagon, Radio } from "lucide-react";
import { ConsentScope } from "@remoteassist/shared-types";

interface ConsentBannerProps {
  isConsented: boolean;
  scope?: ConsentScope;
  onRevoke: () => void;
  senderName?: string;
}

export const ConsentBanner: React.FC<ConsentBannerProps> = ({
  isConsented,
  scope,
  onRevoke,
  senderName = "Remote Sender"
}) => {
  if (!isConsented) return null;

  return (
    <div
      role="region"
      aria-label="Active Stream Consent Status"
      className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute" />
          <Radio className="w-4 h-4 text-emerald-600 relative z-10" />
        </div>
        <div>
          <div className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Live Consent Active — Streaming with {senderName}
          </div>
          <p className="text-[11px] text-emerald-700 mt-0.5">
            Permissions: Camera {scope?.allowCamera ? "✓" : "✗"} | Audio{" "}
            {scope?.allowMicrophone ? "✓" : "✗"} | Guidance Pointer{" "}
            {scope?.allowVisualAssistance ? "✓" : "✗"} (No Remote Control)
          </p>
        </div>
      </div>

      <button
        onClick={onRevoke}
        className="btn-danger-outline text-xs whitespace-nowrap self-start sm:self-auto flex items-center gap-1.5"
        title="Revoke consent and immediately cut off video transmission"
        aria-label="Revoke Consent and End Stream"
      >
        <AlertOctagon className="w-3.5 h-3.5" />
        Revoke Consent & Cut Stream
      </button>
    </div>
  );
};
