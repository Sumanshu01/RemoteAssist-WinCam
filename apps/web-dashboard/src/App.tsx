import React, { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { SessionInvitation } from "./components/SessionInvitation";
import { ConsentModal } from "./components/ConsentModal";
import { ConsentBanner } from "./components/ConsentBanner";
import { ErrorMessage } from "./components/ErrorMessage";
import { CrossBorderMetrics } from "./components/CrossBorderMetrics";
import { VideoFeed } from "./components/VideoFeed";
import { SecurityBadge } from "./components/SecurityBadge";
import { ApplicationWorkflowEditor } from "./components/ApplicationWorkflowEditor";
import { ConnectionDiagnostics } from "./components/ConnectionDiagnostics";
import { CameraTestingComponent } from "./components/CameraTestingComponent";
import {
  ConsentScope,
  ConnectionQuality,
  AppRole,
  JoinRoomPayload,
  WebRtcSignalOffer,
  WebRtcSignalAnswer,
  WebRtcIceCandidate,
  WebRtcDiagnostics,
  IceServerConfig
} from "@remoteassist/shared-types";
import { io, Socket } from "socket.io-client";
import { WebRtcManager } from "./services/webrtcManager";

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_SERVER_URL || "http://localhost:4000";

export function App() {
  const [currentRole, setCurrentRole] = useState<AppRole>("HELPER");
  const [signalingConnected, setSignalingConnected] = useState(false);
  const [peerState, setPeerState] = useState<RTCPeerConnectionState>("new");
  const [iceState, setIceState] = useState<RTCIceConnectionState>("new");

  const [sessionCode, setSessionCode] = useState("RAW-482-195");
  const [sessionPin, setSessionPin] = useState("9421");
  const [authToken] = useState("");

  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [isConsented, setIsConsented] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [consentScope, setConsentScope] = useState<ConsentScope | undefined>(undefined);
  const [errorNotice, setErrorNotice] = useState<{ title: string; message: string } | null>(null);
  const [activeView, setActiveView] = useState<"corridor" | "camera-test">("corridor");

  // WebRTC remote media stream
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Diagnostics & cross-border corridor telemetry
  const [diagnostics, setDiagnostics] = useState<WebRtcDiagnostics | null>(null);
  const [metrics, setMetrics] = useState<ConnectionQuality>({
    latencyMs: 184,
    jitterMs: 11,
    packetLossPercent: 0.05,
    frameRate: 30,
    resolution: { width: 1920, height: 1080 },
    iceCandidateType: "srflx",
    state: "connected"
  });

  const socketRef = useRef<Socket | null>(null);
  const webrtcRef = useRef<WebRtcManager | null>(null);

  // Connect to Signaling Server on Mount / Corridor Change
  useEffect(() => {
    connectSignaling();
    return () => {
      socketRef.current?.disconnect();
      webrtcRef.current?.close();
    };
  }, [sessionCode]);

  const connectSignaling = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(SIGNALING_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSignalingConnected(true);
      const joinPayload: JoinRoomPayload = {
        sessionId: sessionCode,
        sessionCode: sessionCode,
        role: "RECEIVER_SPECIALIST",
        userName: currentRole === "HELPER" ? "Dr. Aris Vance (Specialist)" : "Administrator",
        region: { countryCode: "CA", countryName: "Canada", timezone: "America/Toronto" },
        authToken: authToken || undefined
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
            setupWebRtc(res.turnConfig?.iceServers);
          } else {
            setErrorNotice({
              title: "Corridor Connection Failed",
              message: res?.error || "Could not authorize into session room."
            });
          }
        }
      );
    });

    socket.on("disconnect", () => {
      setSignalingConnected(false);
    });

    // Handle Peer WebRTC Offer from Sender in India
    socket.on("signal-offer", async (payload: WebRtcSignalOffer) => {
      if (webrtcRef.current) {
        try {
          const answer = await webrtcRef.current.handleRemoteOffer(payload.sdp);
          const answerPayload: WebRtcSignalAnswer = {
            sessionId: payload.sessionId,
            receiverId: "receiver-dashboard",
            sdp: answer
          };
          socket.emit("signal-answer", answerPayload);
          setIsStreaming(true);
          setIsConsented(true);
        } catch (err) {
          console.error("Failed to handle remote offer:", err);
        }
      }
    });

    // Handle ICE Candidates
    socket.on("signal-ice", async (payload: WebRtcIceCandidate) => {
      if (webrtcRef.current) {
        await webrtcRef.current.addIceCandidate(payload.candidate);
      }
    });

    // Handle Peer Diagnostics Telemetry
    socket.on("peer-diagnostics", (diag: WebRtcDiagnostics) => {
      setDiagnostics(diag);
      setMetrics({
        latencyMs: diag.roundTripTimeMs,
        jitterMs: diag.jitterMs,
        packetLossPercent: diag.packetLossPercent,
        frameRate: diag.frameRate,
        resolution: diag.resolution,
        iceCandidateType: diag.candidatePair?.selectedCandidateType || "srflx",
        state: "connected"
      });
    });

    // Handle Peer Disconnect / Grace Window
    socket.on("peer-disconnected", () => {
      setErrorNotice({
        title: "Peer Temporarily Disconnected",
        message:
          "Applicant in India disconnected. Waiting 30 seconds for automatic network reconnection..."
      });
    });

    socket.on("peer-reconnected", () => {
      setErrorNotice(null);
    });

    // Handle Consent Updates & Revocations
    socket.on("consent-updated", () => {
      setIsConsented(true);
    });

    socket.on("consent-revoked", (payload: { reason: string }) => {
      handleRevokeConsent(payload.reason);
    });
  };

  const setupWebRtc = (iceServers?: IceServerConfig[]) => {
    const rtc = new WebRtcManager({
      iceServers,
      onConnectionStateChange: (state) => setPeerState(state),
      onIceConnectionStateChange: (state) => setIceState(state),
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        setIsStreaming(true);
      },
      onDiagnostics: (diag) => {
        setDiagnostics(diag);
        setMetrics({
          latencyMs: diag.roundTripTimeMs,
          jitterMs: diag.jitterMs,
          packetLossPercent: diag.packetLossPercent,
          frameRate: diag.frameRate,
          resolution: diag.resolution,
          iceCandidateType: diag.candidatePair?.selectedCandidateType || "srflx",
          state: "connected"
        });
      },
      onIceCandidate: (candidate) => {
        if (socketRef.current && sessionCode) {
          socketRef.current.emit("signal-ice", {
            sessionId: sessionCode,
            senderId: "receiver-dashboard",
            candidate
          });
        }
      },
      onIceRestartNeeded: () => {
        handleTriggerIceRestart();
      }
    });

    rtc.initialize();
    webrtcRef.current = rtc;
  };

  const handleGenerateNewSession = async () => {
    setErrorNotice(null);
    setPeerState("new");
    setIsConsented(false);
    setIsStreaming(false);
    setRemoteStream(null);

    try {
      const res = await fetch(`${SIGNALING_URL}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Cross-Border Support Session",
          initiatorName: currentRole === "HELPER" ? "Dr. Aris Vance" : "Applicant User",
          initiatorRole: currentRole === "HELPER" ? "RECEIVER_SPECIALIST" : "SENDER",
          initiatorRegion:
            currentRole === "HELPER"
              ? { countryCode: "CA", countryName: "Canada", timezone: "America/Toronto" }
              : { countryCode: "IN", countryName: "India", timezone: "Asia/Kolkata" },
          targetRegion:
            currentRole === "HELPER"
              ? { countryCode: "IN", countryName: "India", timezone: "Asia/Kolkata" }
              : { countryCode: "CA", countryName: "Canada", timezone: "America/Toronto" }
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.session?.sessionCode) {
          setSessionCode(data.session.sessionCode);
          setSessionPin(Math.floor(1000 + Math.random() * 9000).toString());
          return;
        }
      }
    } catch {
      // Fallback to local generation if offline
    }

    const code =
      "RAW-" + Math.floor(100 + Math.random() * 900) + "-" + Math.floor(100 + Math.random() * 900);
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setSessionCode(code);
    setSessionPin(pin);
  };

  const handleGrantConsent = (scope: ConsentScope) => {
    setConsentScope(scope);
    setIsConsentModalOpen(false);
    setIsConsented(true);
    setIsStreaming(true);
  };

  const handleDenyConsent = () => {
    setIsConsentModalOpen(false);
    setIsConsented(false);
    setIsStreaming(false);
    setRemoteStream(null);
    setErrorNotice({
      title: "Consent Denied",
      message: "The session was terminated because required consent permissions were declined."
    });
  };

  const handleTriggerIceRestart = async () => {
    if (!webrtcRef.current || !socketRef.current) return;
    try {
      const offer = await webrtcRef.current.restartIce();
      socketRef.current.emit("signal-offer", {
        sessionId: sessionCode,
        senderId: "receiver-dashboard",
        sdp: offer
      });
      socketRef.current.emit("signal-ice-restart", {
        sessionId: sessionCode,
        senderId: "receiver-dashboard"
      });
    } catch (err) {
      console.warn("ICE restart failed on dashboard:", err);
    }
  };

  const handleRevokeConsent = (reason = "Session terminated") => {
    setIsConsented(false);
    setIsStreaming(false);
    setRemoteStream(null);
    if (webrtcRef.current) {
      webrtcRef.current.close();
      webrtcRef.current = null;
    }
    setErrorNotice({
      title: "Corridor Disconnected",
      message: `The remote video session was stopped: ${reason}.`
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        userRole={
          currentRole === "HELPER"
            ? "Canadian Support Specialist"
            : currentRole === "ADMIN"
              ? "Global Administrator"
              : "Applicant (India)"
        }
        userName={
          currentRole === "HELPER"
            ? "Dr. Aris Vance"
            : currentRole === "ADMIN"
              ? "System Security Admin"
              : "Rohan Patel"
        }
        originRegion={currentRole === "APPLICANT" ? "India (IN)" : "Canada (CA)"}
        targetRegion={currentRole === "APPLICANT" ? "Canada (CA)" : "India (IN)"}
      />

      {/* Role & Auth Switch Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 font-medium">Active Role & Authorization:</span>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
            <button
              onClick={() => setCurrentRole("HELPER")}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                currentRole === "HELPER"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Support Specialist (HELPER - CA)
            </button>
            <button
              onClick={() => setCurrentRole("APPLICANT")}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                currentRole === "APPLICANT"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Applicant Client (APPLICANT - IN)
            </button>
            <button
              onClick={() => setCurrentRole("ADMIN")}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                currentRole === "ADMIN"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Security Auditor (ADMIN)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
            <button
              id="tab-corridor-view"
              onClick={() => setActiveView("corridor")}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                activeView === "corridor"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Corridor Assist
            </button>
            <button
              id="tab-camera-test"
              onClick={() => setActiveView("camera-test")}
              className={`px-3 py-1 rounded-md font-semibold transition flex items-center gap-1.5 ${
                activeView === "camera-test"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Camera Testing Studio</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </button>
          </div>

          <div className="flex items-center gap-4 text-slate-500 font-mono text-[11px]">
            <span>Corridor: {sessionCode}</span>
            <span className="flex items-center gap-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  signalingConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`}
              />
              Signaling: {signalingConnected ? "ONLINE" : "DISCONNECTED"}
            </span>
          </div>
        </div>
      </div>

      <ConnectionStatus
        signalingConnected={signalingConnected}
        peerState={
          peerState === "connected"
            ? "connected"
            : peerState === "connecting"
              ? "connecting"
              : peerState === "failed"
                ? "failed"
                : peerState === "disconnected"
                  ? "disconnected"
                  : "idle"
        }
        quality={metrics}
      />

      {isConsented && (
        <ConsentBanner
          isConsented={isConsented}
          scope={consentScope}
          senderName="Applicant in India"
          onRevoke={() => handleRevokeConsent("Helper closed session")}
        />
      )}

      {errorNotice && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <ErrorMessage
            title={errorNotice.title}
            message={errorNotice.message}
            onDismiss={() => setErrorNotice(null)}
          />
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {activeView === "camera-test" ? (
          <CameraTestingComponent
            defaultRole={currentRole}
            onClose={() => setActiveView("corridor")}
          />
        ) : (
          <>
            {/* Top Cards: Session Setup & Cross-Border Telemetry */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <SessionInvitation
                  sessionCode={sessionCode}
                  inviteUrl={`http://localhost:5174?sessionCode=${sessionCode}`}
                  pin={sessionPin}
                  onGenerateNew={handleGenerateNewSession}
                />
              </div>

              <div className="lg:col-span-2">
                <CrossBorderMetrics quality={metrics} />
              </div>
            </div>

            {/* Video Assist Feed Area with Real WebRTC Remote Playback */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <VideoFeed
                  isStreaming={isStreaming}
                  isConsented={isConsented}
                  remoteStream={remoteStream}
                  senderName="Applicant in India"
                  senderRegion="India (IN)"
                  onRevoke={() => handleRevokeConsent("Specialist ended session")}
                />
              </div>

              <div className="lg:col-span-1 space-y-6">
                <SecurityBadge />
              </div>
            </div>

            {/* Full WebRTC Connection Diagnostics & Reconnection Telemetry */}
            <ConnectionDiagnostics
              diagnostics={diagnostics}
              peerState={peerState}
              iceState={iceState}
              onRestartIce={handleTriggerIceRestart}
              onShutdown={() => handleRevokeConsent("Clean shutdown by specialist")}
            />

            {/* Application Progress Persistence & Concurrency Manager */}
            <div className="pt-2">
              <ApplicationWorkflowEditor
                applicantName={
                  currentRole === "APPLICANT" ? "Rohan Patel" : "Rohan Patel (Assisted)"
                }
                applicantCountry="India (IN)"
              />
            </div>
          </>
        )}
      </main>

      <ConsentModal
        isOpen={isConsentModalOpen}
        onGrant={handleGrantConsent}
        onDeny={handleDenyConsent}
      />
    </div>
  );
}
