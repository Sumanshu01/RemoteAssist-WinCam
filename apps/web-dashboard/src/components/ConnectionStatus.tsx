import React from "react";
import { Globe, Activity } from "lucide-react";
import { ConnectionQuality } from "@remoteassist/shared-types";

interface ConnectionStatusProps {
  signalingConnected: boolean;
  peerState: "idle" | "connecting" | "connected" | "disconnected" | "failed";
  quality?: ConnectionQuality;
  originRegion?: string;
  remoteRegion?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  signalingConnected,
  peerState,
  quality = {
    latencyMs: 185,
    jitterMs: 12,
    packetLossPercent: 0.1,
    frameRate: 30,
    resolution: { width: 1280, height: 720 },
    iceCandidateType: "srflx",
    state: "connected"
  },
  originRegion = "India (IN)",
  remoteRegion = "Canada (CA)"
}) => {
  const getPeerBadge = () => {
    switch (peerState) {
      case "connected":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          dot: "bg-emerald-500",
          label: "WebRTC Connected"
        };
      case "connecting":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          dot: "bg-amber-500 animate-ping",
          label: "Establishing P2P..."
        };
      case "failed":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          dot: "bg-rose-500",
          label: "Connection Failed"
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-600 border-slate-200",
          dot: "bg-slate-400",
          label: "Ready for Session"
        };
    }
  };

  const badge = getPeerBadge();

  return (
    <div
      className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      aria-label="System Connection Status"
      role="region"
    >
      <div className="flex items-center gap-3">
        {/* Signaling indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              signalingConnected ? "bg-emerald-500" : "bg-rose-500"
            }`}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-slate-600">
            Signaling: {signalingConnected ? "Online" : "Offline"}
          </span>
        </div>

        <span className="text-slate-300">|</span>

        {/* Peer connection badge */}
        <div
          className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.bg}`}
          aria-live="polite"
        >
          <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
          {badge.label}
        </div>
      </div>

      {/* Cross-border telemetry */}
      <div className="flex items-center gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-1.5" title="Cross-border corridor">
          <Globe className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-medium text-slate-700">
            {originRegion} ↔ {remoteRegion}
          </span>
        </div>

        {peerState === "connected" && (
          <>
            <div className="flex items-center gap-1.5" title="Round Trip Latency">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-semibold text-slate-800">{quality.latencyMs} ms</span>
            </div>

            <div className="hidden md:flex items-center gap-1.5" title="ICE Candidate Mode">
              <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-500 uppercase font-mono text-[10px]">
                ICE: {quality.iceCandidateType}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
