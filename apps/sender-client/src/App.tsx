import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  VideoOff,
  ArrowRight,
  Globe2,
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  Activity,
  AlertTriangle,
  Camera,
  Signal,
  Cpu
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import {
  ConsentScope,
  JoinRoomPayload,
  WebRtcSignalOffer,
  WebRtcSignalAnswer,
  WebRtcIceCandidate,
  WebRtcDiagnostics,
  CameraErrorInfo,
  BandwidthProfile,
  IceServerConfig
} from "@remoteassist/shared-types";
import { CameraService } from "./services/cameraService";
import { WebRtcManager } from "./services/webrtcManager";

const SIGNALING_URL = import.meta.env.VITE_SENDER_SIGNALING_URL || "http://localhost:4000";

export function App() {
  // Session & Authentication
  const [sessionCode, setSessionCode] = useState("RAW-482-195");
  const [authToken, setAuthToken] = useState("");
  const [joined, setJoined] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Device & Camera State
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<CameraErrorInfo | null>(null);

  // Video Streaming & Consent State
  const [isStreaming, setIsStreaming] = useState(false);
  const [scope, setScope] = useState<ConsentScope>({
    allowCamera: true,
    allowMicrophone: false,
    allowVisualAssistance: true,
    acknowledgeSecurityPolicy: false
  });

  // WebRTC & Network State
  const [signalingState, setSignalingState] = useState<"connected" | "connecting" | "disconnected">(
    "disconnected"
  );
  const [peerState, setPeerState] = useState<RTCPeerConnectionState>("new");
  const [iceState, setIceState] = useState<RTCIceConnectionState>("new");
  const [bandwidthProfile, setBandwidthProfile] = useState<BandwidthProfile>("BALANCED");
  const [diagnostics, setDiagnostics] = useState<WebRtcDiagnostics | null>(null);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const webrtcRef = useRef<WebRtcManager | null>(null);

  // 1. Initial Device Enumeration
  useEffect(() => {
    refreshCameraList();
    navigator.mediaDevices?.addEventListener("devicechange", refreshCameraList);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", refreshCameraList);
      cleanupStreams();
      socketRef.current?.disconnect();
      webrtcRef.current?.close();
    };
  }, []);

  const refreshCameraList = async () => {
    try {
      const devices = await CameraService.getAvailableCameras();
      setCameras(devices);
      if (devices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(devices[0].deviceId);
      }
    } catch (err) {
      console.warn("Could not list camera devices:", err);
    }
  };

  // 2. Camera Start / Stop Controls
  const handleStartCamera = async () => {
    setCameraError(null);
    try {
      const { stream, activeDevice } = await CameraService.requestCameraStream(
        selectedCameraId || undefined
      );
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setCameraActive(true);
      if (activeDevice) {
        setSelectedCameraId(activeDevice.deviceId);
      }
      refreshCameraList();

      // Attach stream to WebRTC if manager initialized
      if (webrtcRef.current) {
        webrtcRef.current.attachStream(stream);
      }
      setStatusMessage("Physical camera initialized. Windows 11 hardware LED is active.");
    } catch (err) {
      const errorInfo = CameraService.parseCameraError(err);
      setCameraError(errorInfo);
      setCameraActive(false);
    }
  };

  const handleStopCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsStreaming(false);
    setStatusMessage("Local camera stopped.");
  };

  const handleCameraChange = async (newDeviceId: string) => {
    setSelectedCameraId(newDeviceId);
    if (cameraActive) {
      handleStopCamera();
      // Restart with new device
      setTimeout(async () => {
        try {
          const { stream } = await CameraService.requestCameraStream(newDeviceId);
          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          setCameraActive(true);
          if (webrtcRef.current) {
            webrtcRef.current.attachStream(stream);
          }
        } catch (err) {
          setCameraError(CameraService.parseCameraError(err));
        }
      }, 100);
    }
  };

  // 3. Join Session & Setup WebRTC
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionCode.trim()) return;

    setStatusMessage("Connecting to signaling gateway...");
    const socket = io(SIGNALING_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSignalingState("connected");
      // Join Room
      const joinPayload: JoinRoomPayload = {
        sessionId: sessionCode,
        sessionCode: sessionCode,
        role: "SENDER",
        userName: "Applicant in India",
        region: { countryCode: "IN", countryName: "India", timezone: "Asia/Kolkata" },
        authToken: authToken.trim() || undefined
      };

      socket.emit(
        "join-room",
        joinPayload,
        (res: {
          success: boolean;
          session?: { id: string };
          turnConfig?: { iceServers: IceServerConfig[] };
          error?: string;
        }) => {
          if (res && res.success) {
            setJoined(true);
            setSessionId(res.session?.id || sessionCode);
            setStatusMessage(
              "Joined session corridor. Configure consent checklist to begin assistance."
            );

            // Initialize WebRtcManager with server-provided ICE servers
            initWebRtc(res.turnConfig?.iceServers);
          } else {
            setStatusMessage(`Join rejected: ${res?.error || "Unauthorized or invalid session"}`);
            socket.disconnect();
          }
        }
      );
    });

    socket.on("connect_error", () => {
      setSignalingState("disconnected");
      setStatusMessage("Could not connect to signaling server at " + SIGNALING_URL);
    });

    socket.on("disconnect", () => {
      setSignalingState("disconnected");
    });

    // Signaling Handlers
    socket.on("signal-answer", async (payload: WebRtcSignalAnswer) => {
      if (webrtcRef.current) {
        await webrtcRef.current.handleRemoteAnswer(payload.sdp);
      }
    });

    socket.on("signal-ice", async (payload: WebRtcIceCandidate) => {
      if (webrtcRef.current) {
        await webrtcRef.current.addIceCandidate(payload.candidate);
      }
    });

    socket.on("signal-ice-restart", async () => {
      handleTriggerIceRestart();
    });

    socket.on("consent-revoked", (payload: { reason: string }) => {
      handleEmergencyRevoke(payload.reason);
    });
  };

  const initWebRtc = (iceServers?: IceServerConfig[]) => {
    const rtc = new WebRtcManager({
      iceServers,
      onConnectionStateChange: (state) => setPeerState(state),
      onIceConnectionStateChange: (state) => setIceState(state),
      onDiagnostics: (diag) => {
        setDiagnostics(diag);
        // Relay telemetry to room
        if (socketRef.current && sessionId) {
          socketRef.current.emit("signal-diagnostics", { sessionId, diagnostics: diag });
        }
      },
      onIceCandidate: (candidate) => {
        if (socketRef.current && sessionId) {
          socketRef.current.emit("signal-ice", { sessionId, senderId: "sender-client", candidate });
        }
      },
      onIceRestartNeeded: () => {
        handleTriggerIceRestart();
      }
    });

    rtc.initialize();
    if (localStreamRef.current) {
      rtc.attachStream(localStreamRef.current);
    }
    webrtcRef.current = rtc;
  };

  // 4. Grant Consent and Initiate Live Assist Video Stream
  const handleGrantConsent = async () => {
    if (!scope.acknowledgeSecurityPolicy) {
      alert("Please check the security policy acknowledgment before granting consent.");
      return;
    }

    if (!cameraActive) {
      await handleStartCamera();
    }

    if (!webrtcRef.current || !socketRef.current) {
      alert("WebRTC connection is not ready. Please verify network connection.");
      return;
    }

    try {
      if (localStreamRef.current) {
        webrtcRef.current.attachStream(localStreamRef.current);
      }

      // Create WebRTC Offer
      const offer = await webrtcRef.current.createOffer();
      const offerPayload: WebRtcSignalOffer = {
        sessionId,
        senderId: "sender-client",
        sdp: offer
      };
      socketRef.current.emit("signal-offer", offerPayload);

      // Notify Room Consent Granted
      socketRef.current.emit("consent-response", {
        sessionId,
        userId: "usr_applicant",
        role: "SENDER",
        decision: "GRANTED",
        scope
      });

      setIsStreaming(true);
      setStatusMessage("Live video stream transmitted to Canadian support specialist.");
    } catch (err) {
      console.error("Failed to start stream:", err);
      setStatusMessage("Could not negotiate WebRTC peer connection.");
    }
  };

  const handleTriggerIceRestart = async () => {
    if (!webrtcRef.current || !socketRef.current) return;
    setStatusMessage("Performing ICE restart / network reconnection...");
    try {
      const offer = await webrtcRef.current.restartIce();
      socketRef.current.emit("signal-offer", {
        sessionId,
        senderId: "sender-client",
        sdp: offer
      });
      socketRef.current.emit("signal-ice-restart", {
        sessionId,
        senderId: "sender-client",
        reason: "Network interface handover or packet loss recovery"
      });
      setStatusMessage("ICE restart offer transmitted. Re-negotiating network path...");
    } catch (err) {
      console.warn("ICE restart failed:", err);
    }
  };

  const handleEmergencyRevoke = (reason = "User revoked consent") => {
    if (socketRef.current && sessionId) {
      socketRef.current.emit("consent-revoke", {
        sessionId,
        userId: "usr_applicant",
        reason
      });
    }
    handleStopCamera();
    if (webrtcRef.current) {
      webrtcRef.current.close();
      webrtcRef.current = null;
    }
    setIsStreaming(false);
    setJoined(false);
    setStatusMessage(`Consent revoked: ${reason}. All media streams stopped immediately.`);
  };

  const cleanupStreams = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900">
              RemoteAssist WinCam — Sender Client
            </h1>
            <span className="text-[11px] text-slate-500">
              Origin: India (IN) • Consent-Governed Physical Camera
            </span>
          </div>
        </div>

        {/* Corridor Indicator & Network Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Globe2 className="w-4 h-4 text-emerald-600" />
            <span>India 🇮🇳 → Canada 🇨🇦</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                signalingState === "connected"
                  ? "bg-emerald-500 animate-pulse"
                  : signalingState === "connecting"
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
            />
            <span className="text-slate-600 capitalize">Signaling: {signalingState}</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        {/* Status Message Notification */}
        {statusMessage && (
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between shadow-sm">
            <span>{statusMessage}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-blue-600 hover:text-blue-800 font-semibold ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Camera Permission Error Notice */}
        {cameraError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{cameraError.title}</span>
            </div>
            <p className="text-xs text-rose-700">{cameraError.message}</p>
            <div className="bg-white/70 p-2.5 rounded-lg border border-rose-200/60 text-[11px] text-rose-800">
              <span className="font-semibold">Windows 11 Troubleshooting: </span>
              {cameraError.troubleshootingTip}
            </div>
            <button
              onClick={() => handleStartCamera()}
              className="mt-1 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold"
            >
              Retry Camera Initialization
            </button>
          </div>
        )}

        {!joined ? (
          /* Join Session Form */
          <div className="glass-card p-6 max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Join Remote Assistance Session
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Enter the session code provided by the support specialist in Canada.
            </p>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Session Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. RAW-482-195"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Session Token (Optional / Authentication)
                </label>
                <input
                  type="text"
                  placeholder="Paste access or invitation token (if authenticated)"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <span>Connect to Session</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* In-Session Live Control Panel */
          <div className="space-y-6">
            {/* Top Operational Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    Session Corridor: {sessionCode}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Peer State:{" "}
                    <span className="font-mono font-bold text-slate-800">
                      {peerState.toUpperCase()}
                    </span>{" "}
                    • ICE: <span className="font-mono text-slate-800">{iceState}</span> • Route:{" "}
                    <span className="font-mono font-semibold text-emerald-600">
                      {diagnostics?.candidatePair?.selectedCandidateType.toUpperCase() ||
                        "STUN (SRFLX)"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerIceRestart}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-300 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  ICE Restart
                </button>

                <button
                  onClick={() => handleEmergencyRevoke("Applicant manually stopped assistance")}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Revoke Consent & Disconnect
                </button>
              </div>
            </div>

            {/* Video Preview & Consent Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Local Video Camera Preview */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-emerald-600" />
                      Physical Camera Preview
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border ${
                        cameraActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {cameraActive ? "LED ILLUMINATED" : "STANDBY"}
                    </span>
                  </div>

                  {/* Physical Camera Selector */}
                  <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Select Physical Camera Device:
                    </label>
                    <select
                      value={selectedCameraId}
                      onChange={(e) => handleCameraChange(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      {cameras.length > 0 ? (
                        cameras.map((c, idx) => (
                          <option key={c.deviceId || idx} value={c.deviceId}>
                            {c.label || `Camera ${idx + 1} (DirectShow / Media Foundation)`}
                          </option>
                        ))
                      ) : (
                        <option value="">Default System Webcam</option>
                      )}
                    </select>
                  </div>

                  {/* Video Viewport */}
                  <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
                    />
                    {!cameraActive && (
                      <div className="text-center p-4 text-slate-400 space-y-2">
                        <VideoOff className="w-8 h-8 mx-auto text-slate-500" />
                        <div className="text-xs">Camera preview is paused.</div>
                        <div className="text-[10px] text-slate-500">
                          Click "Start Camera" to initialize physical sensor.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Camera Hardware Controls */}
                <div className="mt-4 flex items-center gap-2">
                  {!cameraActive ? (
                    <button
                      onClick={handleStartCamera}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Start Camera
                    </button>
                  ) : (
                    <button
                      onClick={handleStopCamera}
                      className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <VideoOff className="w-3.5 h-3.5" />
                      Stop Camera
                    </button>
                  )}
                </div>
              </div>

              {/* Consent Checklist & Streaming Controls */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Two-Party Consent Checklist
                  </h3>

                  <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scope.allowCamera}
                        onChange={(e) => setScope({ ...scope, allowCamera: e.target.checked })}
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Allow live video feed transmission to Canadian specialist</span>
                    </label>

                    <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scope.allowMicrophone}
                        onChange={(e) => setScope({ ...scope, allowMicrophone: e.target.checked })}
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Enable microphone voice audio (Default: Muted)</span>
                    </label>

                    <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scope.allowVisualAssistance}
                        onChange={(e) =>
                          setScope({ ...scope, allowVisualAssistance: e.target.checked })
                        }
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        Allow visual assistance cursor overlay (Strictly NO remote control)
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 text-xs text-emerald-900 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scope.acknowledgeSecurityPolicy}
                        onChange={(e) =>
                          setScope({ ...scope, acknowledgeSecurityPolicy: e.target.checked })
                        }
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        I acknowledge this session is consent-governed. Camera spoofing or
                        unauthorized remote control is technically blocked.
                      </span>
                    </label>
                  </div>

                  {/* Adaptive Bandwidth Selector */}
                  <div className="mt-4">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-between">
                      <span>Bandwidth Adaptation Profile:</span>
                      <span className="font-mono text-emerald-600">{bandwidthProfile}</span>
                    </label>
                    <select
                      value={bandwidthProfile}
                      onChange={(e) => {
                        const prof = e.target.value as BandwidthProfile;
                        setBandwidthProfile(prof);
                        webrtcRef.current?.setBandwidthProfile(prof);
                      }}
                      className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <option value="HIGH">
                        High Fidelity (1080p @ 2.5 Mbps - Residential Wi-Fi)
                      </option>
                      <option value="BALANCED">Balanced Auto-Adaptive (1.2 Mbps - Standard)</option>
                      <option value="LOW_BANDWIDTH_RESTRICTED">
                        Restricted / Cellular (500 kbps - Mobile Data / High Loss)
                      </option>
                    </select>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="mt-5">
                  {!isStreaming ? (
                    <button
                      onClick={handleGrantConsent}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition"
                    >
                      <Signal className="w-4 h-4" />
                      <span>Grant Consent & Start Live Assist</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEmergencyRevoke("Stopped by user")}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition"
                    >
                      <VideoOff className="w-4 h-4" />
                      <span>Stop Video Stream</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Live WebRTC Connection Diagnostics Panel */}
            {diagnostics && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    Cross-Country WebRTC Telemetry (India 🇮🇳 ↔ Canada 🇨🇦)
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">
                    Updated: {new Date(diagnostics.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Latency (RTT)</span>
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {diagnostics.roundTripTimeMs} ms
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Frame Rate</span>
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {diagnostics.frameRate} FPS
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Resolution</span>
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {diagnostics.resolution.width}x{diagnostics.resolution.height}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Packet Loss</span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        diagnostics.packetLossPercent > 2 ? "text-amber-600" : "text-emerald-600"
                      }`}
                    >
                      {diagnostics.packetLossPercent}%
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Bitrate</span>
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {diagnostics.bitrateKbps} kbps
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Candidate Type</span>
                    <span className="text-sm font-bold font-mono uppercase text-indigo-600">
                      {diagnostics.candidatePair?.selectedCandidateType || "SRFLX"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    Est. CPU Usage:{" "}
                    <strong className="text-slate-700">
                      {diagnostics.cpuUsageEstimatePercent}%
                    </strong>
                  </span>
                  <span>
                    Est. Memory Footprint:{" "}
                    <strong className="text-slate-700">
                      {diagnostics.memoryUsageEstimateMb} MB
                    </strong>
                  </span>
                  <span>
                    Transport Protocol:{" "}
                    <strong className="font-mono text-slate-700 uppercase">
                      {diagnostics.candidatePair?.protocol || "UDP"}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
