import React from "react";
import { ShieldCheck, Eye, Ban, Cpu } from "lucide-react";

export const SecurityBadge: React.FC = () => {
  return (
    <div className="glass-card p-4 border-slate-200">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Architectural Guarantees & Security Guardrails
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-emerald-950 block">Mutual Consent</span>
            <span className="text-[11px] text-emerald-700">Two-way cryptographic handshake</span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100">
          <Ban className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-blue-950 block">No Remote Control</span>
            <span className="text-[11px] text-blue-700">Strictly guidance visual pointers</span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-100/70 border border-slate-200">
          <Eye className="w-4 h-4 text-slate-700 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900 block">No Hidden Access</span>
            <span className="text-[11px] text-slate-600">Hardware LED & OS tray indicator</span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100">
          <Cpu className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-indigo-950 block">Win 11 Native DX11</span>
            <span className="text-[11px] text-indigo-700">DirectShow / Media Foundation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
