import React, { useState } from "react";
import { ShieldCheck, Video, Mic, MousePointer, Lock } from "lucide-react";
import { ConsentScope } from "@remoteassist/shared-types";

interface ConsentModalProps {
  isOpen: boolean;
  onGrant: (scope: ConsentScope) => void;
  onDeny: () => void;
  senderName?: string;
  senderRegion?: string;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  onGrant,
  onDeny,
  senderName = "Remote User",
  senderRegion = "India (IN)"
}) => {
  const [scope, setScope] = useState<ConsentScope>({
    allowCamera: true,
    allowMicrophone: false,
    allowVisualAssistance: true,
    acknowledgeSecurityPolicy: false
  });

  if (!isOpen) return null;

  const handleGrant = () => {
    if (!scope.acknowledgeSecurityPolicy) return;
    onGrant(scope);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden transform transition-all">
        {/* Header with Security Branding */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 p-6 flex items-start gap-4">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 id="consent-title" className="text-lg font-bold text-slate-900">
              Consent & Security Agreement
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Remote session with <span className="font-semibold text-slate-900">{senderName}</span>{" "}
              ({senderRegion}). Please review and select permitted access scopes.
            </p>
          </div>
        </div>

        {/* Content & Checkbox Scopes */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
            Required Permissions (Two-Party Mutual Consent)
          </p>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition cursor-pointer">
            <input
              type="checkbox"
              checked={scope.allowCamera}
              onChange={(e) => setScope({ ...scope, allowCamera: e.target.checked })}
              className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <div className="flex-1 text-xs">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-blue-600" />
                Live Camera Video Stream
              </div>
              <div className="text-slate-500 mt-0.5">
                Allows streaming live video from the designated camera during the active session.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition cursor-pointer">
            <input
              type="checkbox"
              checked={scope.allowMicrophone}
              onChange={(e) => setScope({ ...scope, allowMicrophone: e.target.checked })}
              className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <div className="flex-1 text-xs">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-blue-600" />
                Audio Voice Communication
              </div>
              <div className="text-slate-500 mt-0.5">
                Transmit audio for two-way verbal support during video session.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition cursor-pointer">
            <input
              type="checkbox"
              checked={scope.allowVisualAssistance}
              onChange={(e) => setScope({ ...scope, allowVisualAssistance: e.target.checked })}
              className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <div className="flex-1 text-xs">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <MousePointer className="w-3.5 h-3.5 text-blue-600" />
                Visual Pointers & Guidance Annotations
              </div>
              <div className="text-slate-500 mt-0.5">
                Allows non-intrusive on-screen pointers.{" "}
                <strong>No remote keyboard/mouse control.</strong>
              </div>
            </div>
          </label>

          {/* Ethical Guardrail Checkbox */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={scope.acknowledgeSecurityPolicy}
                onChange={(e) =>
                  setScope({ ...scope, acknowledgeSecurityPolicy: e.target.checked })
                }
                className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
              />
              <div className="text-xs text-amber-900 leading-tight">
                <span className="font-semibold">Security & Privacy Acknowledgment:</span> I confirm
                that this session is strictly consent-based. Hidden camera access, unauthorized
                control, and camera spoofing are technically prohibited. Either participant can
                revoke consent at any time.
              </div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button onClick={onDeny} className="btn-secondary text-xs">
            Decline & Exit
          </button>
          <button
            onClick={handleGrant}
            disabled={!scope.acknowledgeSecurityPolicy}
            className="btn-primary text-xs"
          >
            <Lock className="w-3.5 h-3.5" />
            Accept & Start Session
          </button>
        </div>
      </div>
    </div>
  );
};
