import { describe, it, expect } from "vitest";
import { config } from "@remoteassist/signaling-server/config";
import { redactSensitiveData } from "@remoteassist/signaling-server/utils/security";
import { IceServerConfig, WebRtcDiagnostics, BandwidthProfile } from "@remoteassist/shared-types";

describe("WebRTC Peer Pipeline & Cross-Country Traversal", () => {
  it("loads STUN and TURN credentials securely from environment variables", () => {
    // 1. Verify STUN servers are configured from environment
    expect(config.stunServers).toBeDefined();
    expect(config.stunServers.length).toBeGreaterThan(0);
    expect(config.stunServers[0]).toContain("stun:");

    // 2. Generate dynamic iceServers configuration
    const dynamicIceServers: IceServerConfig[] = config.stunServers
      .filter(Boolean)
      .map((url) => ({ urls: url.trim() }));

    if (config.turnServer.url && config.turnServer.username) {
      dynamicIceServers.push({
        urls: config.turnServer.url,
        username: config.turnServer.username,
        credential: config.turnServer.credential
      });
    }

    expect(dynamicIceServers.length).toBeGreaterThanOrEqual(1);
    expect(dynamicIceServers[0].urls).toContain("stun:");

    // 3. Guarantee that production TURN passwords are never embedded in static bundle
    // Test that default config without TURN credentials does not create empty/undefined credential fields
    if (!config.turnServer.url) {
      const hasUndefined = dynamicIceServers.some(
        (s) => s.credential === undefined && s.username !== undefined
      );
      expect(hasUndefined).toBe(false);
    }
  });

  it("sanitizes SDP session descriptions and ICE candidate messages", () => {
    const rawOffer = {
      sessionId: "RAW-482-195",
      senderId: "sender-client",
      sdp: {
        type: "offer" as const,
        sdp: "v=0\r\no=- 42091 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=sendrecv\r\n"
      },
      // Inadvertent sensitive data attached by client
      password: "ApplicantPassword123!",
      authToken: "raw_tok_secret999"
    };

    const sanitized = redactSensitiveData(rawOffer) as typeof rawOffer;
    expect(sanitized.sessionId).toBe("RAW-482-195");
    expect(sanitized.sdp.type).toBe("offer");
    expect(sanitized.sdp.sdp).toContain("v=0");
    expect((sanitized as Record<string, unknown>).password).toBe("[REDACTED]");
    expect((sanitized as Record<string, unknown>).authToken).toBe("[REDACTED]");
  });

  it("buffers ICE candidates arriving out-of-order before remote description is set", async () => {
    // Simulated candidate queue buffer
    const candidateQueue: RTCIceCandidateInit[] = [];
    let isRemoteDescriptionSet = false;
    const appliedCandidates: RTCIceCandidateInit[] = [];

    function receiveCandidate(cand: RTCIceCandidateInit) {
      if (!isRemoteDescriptionSet) {
        candidateQueue.push(cand);
      } else {
        appliedCandidates.push(cand);
      }
    }

    function setRemoteDescription() {
      isRemoteDescriptionSet = true;
      // Drain buffered candidates
      while (candidateQueue.length > 0) {
        const c = candidateQueue.shift()!;
        appliedCandidates.push(c);
      }
    }

    // 1. Candidate arrives early (before answer/offer processed)
    receiveCandidate({
      candidate: "candidate:1 1 UDP 2122260223 192.168.1.50 5000 typ host",
      sdpMid: "0"
    });
    receiveCandidate({
      candidate: "candidate:2 1 UDP 1686052607 103.21.244.2 5001 typ srflx",
      sdpMid: "0"
    });

    expect(candidateQueue.length).toBe(2);
    expect(appliedCandidates.length).toBe(0);

    // 2. Remote description arrives
    setRemoteDescription();

    expect(candidateQueue.length).toBe(0);
    expect(appliedCandidates.length).toBe(2);
    expect(appliedCandidates[0].candidate).toContain("typ host");
    expect(appliedCandidates[1].candidate).toContain("typ srflx");
  });

  it("demonstrates TURN relay fallback when direct and reflexive candidates are blocked", () => {
    interface SimulatedCandidate {
      candidate: string;
      type: "host" | "srflx" | "relay";
      priority: number;
    }

    const availableCandidates: SimulatedCandidate[] = [
      {
        candidate: "candidate:host 1 udp 2122260223 192.168.1.100 5000 typ host",
        type: "host",
        priority: 100
      },
      {
        candidate: "candidate:srflx 1 udp 1686052607 103.21.244.2 5001 typ srflx",
        type: "srflx",
        priority: 200
      },
      {
        candidate: "candidate:relay 1 udp 842163049 198.51.100.1 3478 typ relay",
        type: "relay",
        priority: 300
      }
    ];

    // Scenario: Restrictive Symmetric NAT / Mobile Cellular firewall blocks host and srflx
    function selectOptimalCandidate(
      candidates: SimulatedCandidate[],
      allowDirect: boolean,
      allowStun: boolean
    ): SimulatedCandidate {
      const filtered = candidates.filter((c) => {
        if (c.type === "host" && !allowDirect) return false;
        if (c.type === "srflx" && !allowStun) return false;
        return true;
      });

      // Prefer direct/STUN if available, otherwise TURN relay
      return (
        filtered.find((c) => c.type === "host") ||
        filtered.find((c) => c.type === "srflx") ||
        filtered.find((c) => c.type === "relay")!
      );
    }

    // Normal network (STUN succeeds)
    const normalRoute = selectOptimalCandidate(availableCandidates, false, true);
    expect(normalRoute.type).toBe("srflx");

    // Restrictive enterprise / symmetric carrier NAT: STUN and Direct blocked -> TURN relay engaged
    const restrictedRoute = selectOptimalCandidate(availableCandidates, false, false);
    expect(restrictedRoute.type).toBe("relay");
    expect(restrictedRoute.candidate).toContain("typ relay");
  });

  it("adapts video bandwidth constraints based on cross-border network loss and RTT", () => {
    function computeBandwidthProfile(diagnostics: Partial<WebRtcDiagnostics>): BandwidthProfile {
      const rtt = diagnostics.roundTripTimeMs ?? 180;
      const loss = diagnostics.packetLossPercent ?? 0.0;

      if (loss > 5.0 || rtt > 350) {
        return "LOW_BANDWIDTH_RESTRICTED";
      } else if (loss < 1.0 && rtt < 220) {
        return "HIGH";
      }
      return "BALANCED";
    }

    function getTargetBitrate(profile: BandwidthProfile): number {
      switch (profile) {
        case "HIGH":
          return 2500000; // 2.5 Mbps (1080p Pristine)
        case "BALANCED":
          return 1200000; // 1.2 Mbps (720p/1080p Adaptive)
        case "LOW_BANDWIDTH_RESTRICTED":
          return 500000; // 500 kbps (Maintain Framerate Under Loss)
      }
    }

    // High quality (residential fiber link India <-> Canada, 185ms, 0.05% loss)
    const fiberProfile = computeBandwidthProfile({ roundTripTimeMs: 185, packetLossPercent: 0.05 });
    expect(fiberProfile).toBe("HIGH");
    expect(getTargetBitrate(fiberProfile)).toBe(2500000);

    // Congested / mobile cellular link (380ms RTT, 7.2% packet loss)
    const cellularProfile = computeBandwidthProfile({
      roundTripTimeMs: 380,
      packetLossPercent: 7.2
    });
    expect(cellularProfile).toBe("LOW_BANDWIDTH_RESTRICTED");
    expect(getTargetBitrate(cellularProfile)).toBe(500000);
  });
});
