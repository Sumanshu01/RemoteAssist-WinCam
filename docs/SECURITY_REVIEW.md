# RemoteAssist WinCam — Comprehensive Security & Compliance Audit

**Audit Date:** October 2026  
**Auditor:** Systems Security Architect  
**Classification:** Sensitive Technical Audit  
**Scope:** Frontend Dashboards, WebRTC Signaling Gateway, Windows 11 Native Receiver, Data Persistence, and Ethical Safeguards

---

## 1. Executive Summary

RemoteAssist WinCam has been engineered to provide secure, consent-governed video communication and application progress persistence between candidates (e.g. in India) and support specialists (e.g. in Canada).

The security architecture rejects the "always-on" or "remote control" paradigm common in traditional IT support software. The platform enforces **two-party explicit consent**, **cryptographic room access controls**, **zero persistent video recording by default**, and **structural isolation between candidate profiles**.

---

## 2. Authentication & Role-Based Authorization

### Multi-Tier Role Hierarchy

The platform defines three strict authorization roles via `AppRole`:

1. `APPLICANT`: Permitted only to view their own application profile, modify their draft checklists, request support invitations, and stream video when active consent is granted.
2. `HELPER`: Permitted to generate single-use support invitations, join assigned support rooms, and view remote video assist feeds with applicant consent.
3. `ADMIN`: Permitted to inspect system audit logs, configure corridor parameters, and view aggregated telemetry.

### Strict Applicant Data Isolation

- Applicant profiles and workflow states are partitioned by `userId`.
- Endpoint handlers in `services/signaling-server/src/routes/applicantRoutes.ts` enforce that an applicant token can **only** read and write records belonging to that specific applicant's `userId`.
- Any attempt by an applicant to read or modify another applicant's workflow returns HTTP `403 Forbidden` and emits a high-priority `AuditEvent`.

### Session Token Lifecycles

- **Access Tokens**: HMAC-SHA256 signed, short-lived tokens (15-minute expiration).
- **Refresh Tokens**: Stored with cryptographic SHA-256 hashes in `RefreshSession` table, supporting immediate server-side revocation on logout or suspect activity.
- **Single-Use Support Invitations**: Crytographically random, high-entropy tokens with short expirations (typically 15–30 minutes) that transition to `isUsed: true` immediately upon room entry. Replay attempts are rejected.

---

## 3. Web & Network Defenses

### CORS & CSRF Protections

- Cross-Origin Resource Sharing is restricted via strict origin whitelisting (`CORS_ORIGIN=http://localhost:5173,http://localhost:5174` in dev; domain-locked in production).
- Browser sessions utilize `SameSite=Lax` (or `SameSite=Strict`), `Secure`, and `HttpOnly` cookie flags, preventing exfiltration through cross-site scripting (XSS).

### Rate Limiting

- The signaling gateway incorporates sliding-window IP and corridor rate limiters (`services/signaling-server/src/middleware/rateLimiter.ts`).
- Prevents brute-force session PIN guessing (limited to 5 invalid attempts per minute per IP) and DDoS floods on invitation creation.

### Input Validation

- 100% of REST request bodies and Socket.IO signaling event payloads are validated using runtime **Zod** schemas before reaching business logic.
- Malformed SDPs, unexpected candidate types, or injected JSON properties fail immediately with schema validation errors.

---

## 4. Secret Management & Sensitive Data Logging

### Secret Management

- Zero production credentials, private keys, or TURN secrets are committed to version control.
- All configuration is sourced through environment variables (`.env`).
- A sanitized template (`.env.example`) is maintained with explicit warnings against storing secrets in source control.

### Zero-Allocation Log Scrubbing

Both the backend TypeScript logger (`utils/logger.ts`) and the native C++ logger (`src/logger.cpp`) feature automated redaction layers:

- Bearer tokens (`Bearer raw_...`) -> `[REDACTED_TOKEN]`
- Passwords (`password: "..."`) -> `[REDACTED_PASSWORD]`
- Credit cards and government IDs -> `[REDACTED_SSN]`
- Diagnostic outputs and stack traces never leak session credentials to disk or console.

---

## 5. Video Consent & Privacy Architecture

### Mandatory Two-Party Consent

1. Video transmission from the applicant's browser is gated by explicit user consent via the `ConsentModal`.
2. The native Windows 11 receiver enforces an ingress consent gate (`ReceiverCore::pushIncomingFrame`): incoming video frames are dropped at the memory barrier unless consent is in the `ConsentState::Granted` state.
3. Either party can unilaterally revoke consent at any time via **"Stop Video"**, immediately dropping tracks and disconnecting the corridor.

### Zero Default Recording Policy

- The platform **does not record or persist video or audio streams to disk or cloud storage by default**.
- Remote video streams exist solely in volatile GPU/CPU RAM buffers for real-time display and are immediately discarded after presentation.

---

## 6. Dependency Vulnerability Audit (`npm audit`)

An audit of installed Node.js dependencies was conducted:

- **Total Packages Inspected**: 453 packages.
- **Runtime Dependencies**: `express`, `socket.io`, `zod`, `cookie-parser`, `@prisma/client`. **0 known vulnerabilities in production runtime dependencies.**
- **Development Tooling Findings**:
  - 16 advisories identified strictly in build-time / test tooling (`vitest`, `esbuild` dev server, `tailwindcss` CLI, and `prisma` CLI config).
  - Remediation path: Evaluated for update to Vitest 5+ and Tailwind CSS 4+ in the next major tooling milestone. Production container builds exclude `devDependencies`, insulating deployment environments from dev tool advisories.

---

## 7. Data Retention & Account Deletion

- Support sessions, invitations, and refresh tokens are configured with automatic TTL expiration.
- Database models enforce foreign-key `ON DELETE CASCADE` constraints: deleting a `User` record automatically purges their `ApplicantProfile`, `ApplicationWorkflow`, `ChecklistItems`, `RefreshSessions`, and associated consent records.
- Audit logs retain anonymized SHA-256 IP hashes for security compliance without retaining plaintext PII.

---

## 8. Ethical Boundaries & Prohibited Uses

RemoteAssist WinCam strictly enforces the following ethical constraints:

1. **Permitted Use**: Independent, consent-governed video communication and application progress tracking between candidates and authorized helpers.
2. **Prohibited Use (Biometric / Identity Verification Bypass)**:
   - The native virtual camera component **must never** be connected to automated proctoring systems, identity-verification workflows, or visa interview portals.
   - The virtual camera is registered under `KSCATEGORY_VIDEO_CAMERA` and is structurally blocked from `KSCATEGORY_SENSOR_CAMERA` used by Windows Hello Face.
3. **No Hardware Impersonation**: Does not spoof physical webcam vendor IDs (VID) or product IDs (PID).
