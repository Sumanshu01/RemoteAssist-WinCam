import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  VideoOff,
  MousePointer,
  Tv,
  ShieldAlert,
  Maximize2,
  Volume2,
  VolumeX,
  Radio
} from "lucide-react";

interface VideoFeedProps {
  isStreaming: boolean;
  isConsented: boolean;
  remoteStream?: MediaStream | null;
  senderName?: string;
  senderRegion?: string;
  onTogglePointer?: (enabled: boolean) => void;
  onRevoke?: () => void;
}

export const VideoFeed: React.FC<VideoFeedProps> = ({
  isStreaming,
  isConsented,
  remoteStream,
  senderName = "Applicant in India",
  senderRegion = "India (IN)",
  onTogglePointer,
  onRevoke
}) => {
  const [audioMuted, setAudioMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [videoPaused, setVideoPaused] = useState(false);
  const [pointerActive, setPointerActive] = useState(false);
  const [pointerPos, setPointerPos] = useState({ x: 50, y: 50 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Attach remote stream to HTML5 Video element
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch((err) => {
        console.warn("Autoplay remote video was prevented:", err);
      });
    }
  }, [remoteStream, isStreaming]);

  // Handle Volume change
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0 || audioMuted;
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !audioMuted;
    setAudioMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  };

  const handleToggleVideo = () => {
    const nextPaused = !videoPaused;
    setVideoPaused(nextPaused);
    if (videoRef.current) {
      if (nextPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.warn);
      }
    }
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(console.warn);
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(console.warn);
    }
  };

  const handlePointerToggle = () => {
    const next = !pointerActive;
    setPointerActive(next);
    if (onTogglePointer) onTogglePointer(next);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pointerActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPointerPos({ x, y });
  };

  return (
    <div
      ref={containerRef}
      className="glass-card overflow-hidden border-slate-200 flex flex-col bg-slate-900 rounded-2xl shadow-sm"
    >
      {/* Feed Title Bar */}
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isStreaming && isConsented ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
            }`}
          />
          <span className="text-xs font-semibold tracking-wide">
            {isStreaming && isConsented
              ? `LIVE CORRIDOR — ${senderName} (${senderRegion})`
              : "INCOMING WEBRTC FEED STANDBY"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isStreaming && isConsented && (
            <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              1080p @ 30 FPS • H.264
            </span>
          )}
          <span className="text-[10px] text-slate-400 font-mono">WinCam v1.0</span>
        </div>
      </div>

      {/* Main Video Display Area */}
      <div
        className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden cursor-crosshair select-none"
        onMouseMove={handleMouseMove}
      >
        {isStreaming && isConsented ? (
          <div className="w-full h-full relative flex items-center justify-center">
            {/* Real WebRTC Video Element if remoteStream provided */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-contain ${remoteStream ? "block" : "hidden"}`}
            />

            {/* Fallback stream rendering overlay when video feed is simulated or pending first frame */}
            {!remoteStream && (
              <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950">
                <div className="text-center p-6 space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-400/20 flex items-center justify-center text-blue-400">
                    <Tv className="w-8 h-8 animate-pulse" />
                  </div>
                  <h4 className="text-sm font-semibold text-white tracking-wide">
                    Live Video Assist Stream Active
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Real-time WebRTC media pipeline receiving from {senderName}. Windows 11 Native
                    Receiver synchronization ready.
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Physical Camera LED Active in India
                  </div>
                </div>
              </div>
            )}

            {/* Visual Pointer Overlay (Assist Guide, strictly NO remote control) */}
            {pointerActive && (
              <div
                className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ease-out z-20"
                style={{ left: `${pointerPos.x}%`, top: `${pointerPos.y}%` }}
              >
                <div className="relative">
                  <MousePointer className="w-5 h-5 text-amber-400 drop-shadow-md" />
                  <span className="absolute left-5 top-0 bg-amber-400 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                    Specialist Pointer
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Placeholder standby state */
          <div className="text-center p-8 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
              <VideoOff className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-300">No Active Stream</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Waiting for the sender in India to grant consent and initiate the WebRTC corridor.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Media Playback Controls Bar */}
      <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Audio Mute / Unmute */}
          <button
            onClick={handleToggleMute}
            disabled={!isStreaming}
            className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
              audioMuted
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
            title={audioMuted ? "Unmute Audio" : "Mute Audio"}
            aria-label={audioMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Volume Slider */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              disabled={!isStreaming}
              className="w-16 accent-emerald-600 cursor-pointer"
              title="Remote Audio Volume"
            />
          </div>

          {/* Video Pause / Resume */}
          <button
            onClick={handleToggleVideo}
            disabled={!isStreaming}
            className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
              videoPaused
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
            title={videoPaused ? "Resume Remote Video" : "Pause Remote Video"}
            aria-label={videoPaused ? "Resume Remote Video" : "Pause Remote Video"}
          >
            {videoPaused ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          {/* Guidance Visual Pointer Toggle */}
          <button
            onClick={handlePointerToggle}
            disabled={!isStreaming}
            className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              pointerActive
                ? "bg-amber-50 text-amber-800 border-amber-300 font-semibold"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
            title="Guidance visual pointer (Non-intrusive, no remote control)"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>{pointerActive ? "Pointer Active" : "Enable Pointer"}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            disabled={!isStreaming}
            className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
              isFullscreen
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
            title={isFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen"}
            aria-label="Toggle Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Clean Hangup / End Session */}
        {isStreaming && isConsented && onRevoke && (
          <button
            onClick={onRevoke}
            className="btn-danger-outline text-xs px-3.5 py-2 flex items-center gap-1.5 rounded-lg font-semibold transition"
            title="Immediately hang up and shut down corridor"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            End Support Session
          </button>
        )}
      </div>
    </div>
  );
};
