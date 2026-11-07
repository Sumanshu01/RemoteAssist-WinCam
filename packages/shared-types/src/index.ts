/**
 * RemoteAssist WinCam - Shared Type Definitions
 * Consent-based remote video communication and application-support system.
 */

export type AppRole = "ADMIN" | "HELPER" | "APPLICANT";
export type UserRole = "SENDER" | "RECEIVER_SPECIALIST" | "SUPERVISOR" | AppRole;

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  countryCode: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: UserAccount;
  expiresAt: string;
}

export interface ApplicantProfile {
  id: string;
  userId: string;
  targetCountry: string; // e.g. "CA" for Canada, "IN" for India
  targetJobTitle?: string;
  visaStream?: string;
  phone?: string;
  resumeNotes?: string;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowStatus = "DRAFT" | "IN_PROGRESS" | "REVIEW_PENDING" | "COMPLETED";

export interface WorkflowChecklistItem {
  id: string;
  workflowId: string;
  label: string;
  isCompleted: boolean;
  sortOrder: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationWorkflow {
  id: string;
  applicantId: string;
  version: number; // For optimistic concurrency checks
  status: WorkflowStatus;
  dataJson: Record<string, unknown>;
  /** Legal / Ethical requirement: Must explicitly declare local draft nature */
  disclaimer: string;
  checklists: WorkflowChecklistItem[];
  lastSavedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportInvitation {
  id: string;
  token: string;
  code: string;
  helperId: string;
  helperName?: string;
  applicantEmail: string;
  targetCountry: string;
  expiresAt: string;
  isUsed: boolean;
  usedAt?: string;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRole: AppRole | UserRole;
  content: string;
  timestamp: string;
  createdAt: string;
}

export interface SupportSession {
  id: string;
  sessionCode: string;
  invitationId?: string;
  helperId: string;
  applicantId: string;
  status: SessionStatus;
  consentGrantedAt?: string;
  terminatedAt?: string;
  terminationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OptimisticConcurrencyError {
  error: "CONCURRENCY_CONFLICT";
  message: string;
  serverVersion: number;
  serverData: Record<string, unknown>;
}

export type SessionStatus =
  | "INITIALIZING"
  | "PENDING_INVITATION"
  | "INVITED"
  | "AWAITING_CONSENT"
  | "PENDING_CONSENT"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "TERMINATED"
  | "EXPIRED"
  | "FAILED";

export type ConsentStatus = "NONE" | "REQUESTED" | "GRANTED" | "DENIED" | "REVOKED";

export interface ConsentScope {
  /** Allows live video transmission from selected camera */
  allowCamera: boolean;
  /** Allows live audio transmission from selected microphone */
  allowMicrophone: boolean;
  /** Allows remote assistance annotations/pointers on shared window (NO remote control) */
  allowVisualAssistance: boolean;
  /** Explicit acknowledgment that unauthorized remote control or spoofing is prohibited */
  acknowledgeSecurityPolicy: boolean;
}

export interface ConsentRecord {
  id: string;
  sessionId: string;
  userId: string;
  role: UserRole;
  status: ConsentStatus;
  scope: ConsentScope;
  grantedAt?: string;
  revokedAt?: string;
  userIpHash?: string;
  userAgent?: string;
}

export interface RegionInfo {
  countryCode: "IN" | "CA" | "US" | "UK" | "OTHER";
  countryName: string;
  city?: string;
  timezone: string;
}

export interface SessionInvitation {
  invitationCode: string; // e.g. "RAW-782-901"
  inviteUrl: string;
  pin: string;
  expiresAt: string;
  createdAt: string;
  initiatorName: string;
  initiatorRole: UserRole;
}

export interface AssistSession {
  id: string;
  sessionCode: string;
  status: SessionStatus;
  title: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  initiator: {
    id: string;
    name: string;
    region: RegionInfo;
    role: UserRole;
  };
  participant?: {
    id: string;
    name: string;
    region: RegionInfo;
    role: UserRole;
  };
  consent: {
    senderConsent: ConsentRecord;
    receiverConsent: ConsentRecord;
    isFullyConsented: boolean;
  };
}

export interface ConnectionQuality {
  latencyMs: number; // e.g. 180-260ms between India and Canada
  jitterMs: number;
  packetLossPercent: number;
  frameRate: number;
  resolution: {
    width: number;
    height: number;
  };
  iceCandidateType: "host" | "srflx" | "relay" | "unknown";
  state: "connecting" | "connected" | "disconnected" | "failed";
}

export interface CrossBorderMetrics {
  origin: RegionInfo;
  destination: RegionInfo;
  directP2pPossible: boolean;
  relayRequired: boolean;
  estimatedLatencyMs: number;
  currentQuality: ConnectionQuality;
}

/* ==========================================================================
   Signaling Protocol Payloads
   ========================================================================== */

export interface JoinRoomPayload {
  sessionId: string;
  sessionCode: string;
  role: UserRole;
  userName: string;
  region: RegionInfo;
  authToken?: string;
  invitationToken?: string;
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RtcConfigurationResponse {
  iceServers: IceServerConfig[];
  iceTransportPolicy?: "all" | "relay";
  bundlePolicy?: RTCBundlePolicy;
  rtcpMuxPolicy?: RTCRtcpMuxPolicy;
}

export interface WebRtcSignalOffer {
  sessionId: string;
  senderId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface WebRtcSignalAnswer {
  sessionId: string;
  receiverId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface WebRtcIceCandidate {
  sessionId: string;
  senderId: string;
  candidate: RTCIceCandidateInit;
}

export interface WebRtcSignalIceRestart {
  sessionId: string;
  senderId: string;
  reason?: string;
}

export type CameraErrorType =
  | "PERMISSION_DENIED"
  | "HARDWARE_NOT_FOUND"
  | "HARDWARE_IN_USE"
  | "OVERCONSTRAINED"
  | "SECURITY_RESTRICTION"
  | "UNKNOWN_ERROR";

export interface CameraErrorInfo {
  type: CameraErrorType;
  rawName: string;
  title: string;
  message: string;
  troubleshootingTip: string;
}

export interface WebRtcDiagnostics {
  timestamp: number;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  roundTripTimeMs: number;
  jitterMs: number;
  packetsLost: number;
  packetsReceived: number;
  packetLossPercent: number;
  bytesReceived: number;
  bytesSent: number;
  bitrateKbps: number;
  frameRate: number;
  resolution: {
    width: number;
    height: number;
  };
  candidatePair?: {
    localType: string;
    remoteType: string;
    selectedCandidateType: "host" | "srflx" | "relay" | "unknown";
    protocol: string;
  };
  cpuUsageEstimatePercent?: number;
  memoryUsageEstimateMb?: number;
}

export type BandwidthProfile = "HIGH" | "BALANCED" | "LOW_BANDWIDTH_RESTRICTED";

export interface ConsentRequestPayload {
  sessionId: string;
  requestedBy: string;
  requestedRole: UserRole;
  scope: ConsentScope;
}

export interface ConsentResponsePayload {
  sessionId: string;
  userId: string;
  role: UserRole;
  decision: "GRANTED" | "DENIED";
  scope: ConsentScope;
}

export interface ConsentRevocationPayload {
  sessionId: string;
  userId: string;
  reason: string;
}

export interface SessionTerminationPayload {
  sessionId: string;
  terminatedBy: string;
  reason: string;
}

export interface AuditLogEntry {
  id: string;
  sessionId?: string;
  timestamp: string;
  eventType:
    | "AUTH_LOGIN"
    | "AUTH_LOGOUT"
    | "AUTH_REGISTER"
    | "AUTH_REFRESH"
    | "INVITATION_CREATED"
    | "INVITATION_ACCEPTED"
    | "SESSION_CREATED"
    | "INVITATION_SENT"
    | "PEER_JOINED"
    | "CONSENT_REQUESTED"
    | "CONSENT_GRANTED"
    | "CONSENT_REVOKED"
    | "STREAM_STARTED"
    | "STREAM_STOPPED"
    | "WORKFLOW_SAVED"
    | "WORKFLOW_CONFLICT"
    | "UNAUTHORIZED_SIGNALING_ATTEMPT"
    | "CONNECTION_STATE_CHANGED"
    | "SESSION_TERMINATED";
  actorRole: UserRole;
  actorId: string;
  details: Record<string, unknown>;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export type CameraTestDeviceType = "PHYSICAL" | "SYNTHETIC_CONSENTING" | "VIRTUAL_LOOPBACK";

export interface CameraTestDevice {
  deviceId: string;
  label: string;
  type: CameraTestDeviceType;
  isConsentingTestDevice: boolean;
  capabilities?: {
    supportedResolutions: Array<{ width: number; height: number; label: string }>;
    maxFrameRate: number;
    hasTorch?: boolean;
    hasZoom?: boolean;
    facingMode?: string;
  };
}

export interface CameraTestSession {
  sessionId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  isAuthorized: boolean;
  authorizedScope: "CAMERA_HARDWARE_TEST_ONLY";
  prohibitedScopes: string[];
}

export interface CameraDiagnosticMetric {
  id: string;
  title: string;
  status: "PENDING" | "RUNNING" | "PASSED" | "WARNING" | "FAILED";
  measuredValue?: string | number;
  expectedValue?: string;
  details?: string;
}

export interface CameraDiagnosticReport {
  sessionId: string;
  deviceId: string;
  deviceLabel: string;
  deviceType: CameraTestDeviceType;
  timestamp: string;
  metrics: {
    resolution: { width: number; height: number };
    aspectRatio: string;
    frameRate: number;
    brightnessScore: number; // 0 - 100
    contrastScore: number; // 0 - 100
    colorVariance: number;
    audioActive: boolean;
    audioLevelDb?: number;
  };
  tests: CameraDiagnosticMetric[];
  overallStatus: "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED";
  ethicalIsolationConfirmed: boolean;
}
