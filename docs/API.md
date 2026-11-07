# RemoteAssist WinCam — API & Signaling Protocol Specification

## 1. REST Endpoints (Signaling Server)

Base URL: `http://localhost:4000/api`

### Health Check

- **Endpoint**: `GET /health`
- **Response**:

```json
{
  "status": "healthy",
  "service": "remoteassist-signaling-server",
  "timestamp": "2026-10-20T12:00:00.000Z",
  "activeFeatures": {
    "consentEnforcement": true,
    "crossBorderTraversal": true,
    "stunTurnConfigured": true
  }
}
```

### Create Assistance Session

- **Endpoint**: `POST /api/sessions`
- **Request Body**:

```json
{
  "title": "Cross-Border Support Session",
  "initiatorName": "Dr. Aris Vance",
  "initiatorRole": "RECEIVER_SPECIALIST",
  "initiatorRegion": {
    "countryCode": "CA",
    "countryName": "Canada",
    "timezone": "America/Toronto"
  },
  "targetRegion": {
    "countryCode": "IN",
    "countryName": "India",
    "timezone": "Asia/Kolkata"
  }
}
```

- **Response (201 Created)**:

```json
{
  "session": {
    "id": "sess_a8f9210",
    "sessionCode": "RAW-482-195",
    "status": "AWAITING_CONSENT",
    "expiresAt": "2026-10-20T12:30:00.000Z"
  },
  "invitation": {
    "sessionCode": "RAW-482-195",
    "inviteUrl": "/session/sess_a8f9210?code=RAW-482-195"
  }
}
```

### Lookup Session by Code

- **Endpoint**: `GET /api/sessions/code/:code`
- **Example**: `GET /api/sessions/code/RAW-482-195`

### Update Consent

- **Endpoint**: `POST /api/sessions/:id/consent`
- **Request Body**:

```json
{
  "userId": "usr_9921",
  "role": "SENDER",
  "status": "GRANTED",
  "scope": {
    "allowCamera": true,
    "allowMicrophone": false,
    "allowVisualAssistance": true,
    "acknowledgeSecurityPolicy": true
  }
}
```

### Emergency Revoke Consent

- **Endpoint**: `POST /api/sessions/:id/revoke`
- **Request Body**:

```json
{
  "userId": "usr_9921",
  "role": "SENDER",
  "reason": "User manually stopped assistance"
}
```

### Dynamic WebRTC ICE Server Configuration

- **Endpoint**: `GET /api/sessions/:id/ice-servers`
- **Security**: STUN and TURN URLs and credentials are read strictly from server environment (`.env`). Production TURN secrets are NEVER embedded in client source code.
- **Response**:

```json
{
  "iceServers": [
    { "urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    {
      "urls": "turn:turn.remoteassist-wincam.org:3478",
      "username": "user",
      "credential": "credential_secret"
    }
  ],
  "iceTransportPolicy": "all",
  "bundlePolicy": "max-bundle",
  "rtcpMuxPolicy": "require"
}
```

---

## 2. WebRTC Socket.IO Signaling Events

### Client -> Server

| Event                | Payload                     | Description                                          |
| -------------------- | --------------------------- | ---------------------------------------------------- |
| `join-room`          | `JoinRoomPayload`           | Joins session room and registers participant         |
| `signal-offer`       | `WebRtcSignalOffer`         | Sends WebRTC SDP Offer to peer (sanitized)           |
| `signal-answer`      | `WebRtcSignalAnswer`        | Sends WebRTC SDP Answer to peer (sanitized)          |
| `signal-ice`         | `WebRtcIceCandidate`        | Relays ICE candidate for NAT traversal (sanitized)   |
| `signal-ice-restart` | `WebRtcSignalIceRestart`    | Requests ICE restart across high-loss/cellular links |
| `signal-diagnostics` | `WebRtcDiagnostics`         | Relays telemetry (RTT, FPS, packet loss, candidate)  |
| `consent-request`    | `ConsentRequestPayload`     | Requests permission scope from peer                  |
| `consent-response`   | `ConsentResponsePayload`    | Returns `GRANTED` or `DENIED`                        |
| `consent-revoke`     | `ConsentRevocationPayload`  | Immediately cuts stream and notifies room            |
| `session-terminate`  | `SessionTerminationPayload` | Clean shutdown of peer connection and session state  |

### Server -> Client

| Event                | Payload               | Description                                             |
| -------------------- | --------------------- | ------------------------------------------------------- |
| `peer-joined`        | Peer info + Region    | Broadcasts peer arrival                                 |
| `peer-reconnected`   | Peer info + Region    | Broadcasts peer reconnection within 30s grace window    |
| `peer-diagnostics`   | `WebRtcDiagnostics`   | Transmits live cross-country network metrics            |
| `consent-updated`    | Updated session state | Unlocks media pipeline once mutual consent is satisfied |
| `consent-revoked`    | Termination reason    | Instructs client and receiver to flush buffers          |
| `peer-disconnected`  | Peer status           | Notifies temporary disconnection (30s grace period)     |
| `session-terminated` | Termination details   | Notifies room of clean session termination              |

---

## 3. Camera Testing Subsystem Endpoints

Base URL: `http://localhost:4000/api/camera-test`

### Camera Testing Subsystem Health Check

- **Endpoint**: `GET /api/camera-test/health`
- **Description**: Returns the diagnostic subsystem status and verifies that identity verification workflows and biometric hooks are strictly disengaged.
- **Response (200 OK)**:

```json
{
  "status": "healthy",
  "component": "camera-testing-subsystem",
  "version": "1.0.0",
  "timestamp": "2026-10-20T17:45:00.000Z",
  "capabilities": {
    "consentingDevicesSupported": true,
    "syntheticStreamsEnabled": true,
    "biometricIsolationActive": true,
    "identityVerificationBypass": false
  }
}
```

### Create Authorized Camera Test Session

- **Endpoint**: `POST /api/camera-test/session`
- **Description**: Issues an authorized camera testing session token with a 15-minute TTL. Strict ethical guardrails automatically reject any prohibited scopes (e.g. `identity-verification`, `biometric-capture`, `face-recognition`, `liveness-check`).
- **Request Body**:

```json
{
  "testerId": "qa-tester-44",
  "testPurpose": "pre-call-diagnostics",
  "requestedScopes": ["general-conferencing", "lighting-check"],
  "userConsent": true
}
```

- **Response (201 Created)**:

```json
{
  "session": {
    "sessionId": "cam_test_a1b2c3d4",
    "token": "ctest_tok_...",
    "testerId": "qa-tester-44",
    "authorizedAt": "2026-10-20T17:45:00.000Z",
    "expiresAt": "2026-10-20T18:00:00.000Z",
    "allowedScopes": ["general-conferencing", "lighting-check"],
    "isolatedFromVerificationWorkflows": true
  }
}
```

- **Response (403 Forbidden - Prohibited Scope Detected)**:

```json
{
  "error": "PROHIBITED_SCOPE",
  "message": "Scope 'identity-verification' is prohibited. Camera testing component must remain strictly isolated from identity verification workflows."
}
```

### List Consenting Test Devices

- **Endpoint**: `GET /api/camera-test/devices/consenting`
- **Description**: Retrieves registered test device profiles, including synthetic generators (SMPTE color bars, dynamic gradient wave) and consenting physical device profiles.
- **Response (200 OK)**:

```json
{
  "devices": [
    {
      "id": "synthetic-smpte-bars",
      "label": "Synthetic Test Device (SMPTE Color Bars 1080p)",
      "type": "SYNTHETIC",
      "isConsenting": true,
      "supportedResolutions": ["1920x1080", "1280x720", "640x480"],
      "maxFramerate": 60,
      "notes": "Safe for headless CI and automated diagnostics"
    },
    {
      "id": "synthetic-gradient-wave",
      "label": "Synthetic Motion Pattern (Chroma Gradient Wave)",
      "type": "SYNTHETIC",
      "isConsenting": true,
      "supportedResolutions": ["1920x1080", "1280x720"],
      "maxFramerate": 30,
      "notes": "Motion test device for FPS and frame drop analysis"
    },
    {
      "id": "consenting-physical-webcam",
      "label": "Local Physical Webcam (Requires Explicit Permission)",
      "type": "PHYSICAL",
      "isConsenting": true,
      "supportedResolutions": ["1920x1080", "1280x720", "640x480"],
      "maxFramerate": 30,
      "notes": "Standard USB/Integrated webcam via browser navigator.mediaDevices"
    }
  ]
}
```

### Submit Camera Diagnostic Report

- **Endpoint**: `POST /api/camera-test/report`
- **Description**: Validates and stores diagnostic run telemetry. Redacts any sensitive data and rejects reports tied to unconsented sessions.
- **Request Body**:

```json
{
  "sessionId": "cam_test_a1b2c3d4",
  "deviceId": "synthetic-smpte-bars",
  "deviceLabel": "Synthetic Test Device (SMPTE Color Bars 1080p)",
  "resolution": "1920x1080",
  "aspectRatio": "16:9",
  "averageFps": 29.8,
  "frameDrops": 0,
  "luminanceScore": 68,
  "contrastScore": 82,
  "audioDetected": false,
  "userConsentVerified": true,
  "isolationVerified": true,
  "metrics": [
    {
      "name": "Hardware Authorization",
      "value": "Passed",
      "status": "PASS",
      "description": "Explicit user consent granted; media permission acknowledged"
    },
    {
      "name": "Resolution & Aspect Ratio",
      "value": "1920x1080 (16:9)",
      "status": "PASS",
      "description": "Standard high-definition video frame dimensions"
    },
    {
      "name": "Framerate Stability",
      "value": "29.8 FPS",
      "status": "PASS",
      "description": "Frame rate stable within 10% tolerance of 30 FPS target"
    },
    {
      "name": "Lighting & Contrast",
      "value": "Luma: 68%, Contrast: 82%",
      "status": "PASS",
      "description": "Visual scene within optimal dynamic range"
    },
    {
      "name": "Biometric & Verification Isolation",
      "value": "Isolated",
      "status": "PASS",
      "description": "Component strictly decoupled from identity verification workflows"
    }
  ]
}
```

- **Response (201 Created)**:

```json
{
  "status": "RECORDED",
  "reportId": "rep_...",
  "recordedAt": "2026-10-20T17:45:05.000Z",
  "summary": {
    "totalChecks": 5,
    "passed": 5,
    "warnings": 0,
    "failed": 0,
    "overall": "PASS"
  }
}
```
