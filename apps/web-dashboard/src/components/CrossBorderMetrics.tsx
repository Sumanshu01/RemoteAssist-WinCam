import React from "react";
import { Activity } from "lucide-react";
import { ConnectionQuality } from "@remoteassist/shared-types";

interface CrossBorderMetricsProps {
  quality: ConnectionQuality;
  senderCountry?: string;
  receiverCountry?: string;
}

export const CrossBorderMetrics: React.FC<CrossBorderMetricsProps> = ({
  quality,
  senderCountry = "India (IN)",
  receiverCountry = "Canada (CA)"
}) => {
  return (
    <div
      className="glass-card p-5 border-slate-200"
      role="region"
      aria-label="Cross-Border Connection Metrics"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Cross-Border Corridor Telemetry</h3>
        </div>
        <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
          STUN ICE Reflexive (Direct)
        </span>
      </div>

      {/* Corridor Map / Route representation */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🇮🇳</span>
          <div>
            <span className="text-xs font-bold text-slate-800 block">{senderCountry}</span>
            <span className="text-[10px] text-slate-500">Origin / Camera Sender</span>
          </div>
        </div>

        <div className="flex flex-col items-center px-4">
          <div className="flex items-center gap-1.5 text-blue-600 font-semibold text-xs">
            <span>{quality.latencyMs} ms RTT</span>
          </div>
          <div className="w-24 sm:w-32 h-0.5 bg-gradient-to-r from-blue-300 via-indigo-500 to-blue-300 my-1 relative">
            <div className="w-2 h-2 rounded-full bg-blue-600 absolute -top-[3px] left-1/2 -translate-x-1/2 animate-ping" />
          </div>
          <span className="text-[9px] text-slate-400 font-mono">Trans-Atlantic Fiber</span>
        </div>

        <div className="flex items-center gap-2 text-right">
          <div>
            <span className="text-xs font-bold text-slate-800 block">{receiverCountry}</span>
            <span className="text-[10px] text-slate-500">Receiver / Specialist</span>
          </div>
          <span className="text-xl">🇨🇦</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Jitter</div>
          <div className="text-sm font-bold text-slate-800 mt-0.5">{quality.jitterMs} ms</div>
        </div>

        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Packet Loss</div>
          <div className="text-sm font-bold text-emerald-600 mt-0.5">
            {quality.packetLossPercent}%
          </div>
        </div>

        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Frame Rate</div>
          <div className="text-sm font-bold text-slate-800 mt-0.5">{quality.frameRate} FPS</div>
        </div>

        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
          <div className="text-[10px] uppercase font-semibold text-slate-400">Resolution</div>
          <div className="text-sm font-bold text-slate-800 mt-0.5">
            {quality.resolution.width}x{quality.resolution.height}
          </div>
        </div>
      </div>
    </div>
  );
};
