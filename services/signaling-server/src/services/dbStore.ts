import {
  AppRole,
  UserAccount,
  ApplicantProfile,
  ApplicationWorkflow,
  WorkflowChecklistItem,
  SupportInvitation,
  SupportSession,
  SupportMessage,
  SessionStatus,
  WorkflowStatus
} from "@remoteassist/shared-types";
import { hashPassword } from "../utils/security";

export interface StoredUser extends UserAccount {
  passwordHash: string;
}

export interface StoredRefreshSession {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent?: string;
  ipHash?: string;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
}

export interface StoredAuditEvent {
  id: string;
  sessionId?: string;
  eventType: string;
  actorId: string;
  actorRole: string;
  targetEntity: string;
  targetId?: string;
  detailsJson?: string;
  ipHash?: string;
  userAgent?: string;
  createdAt: Date;
}

export class ConcurrencyConflictError extends Error {
  public readonly code = "CONCURRENCY_CONFLICT";
  constructor(
    public readonly serverVersion: number,
    public readonly serverData: Record<string, unknown>
  ) {
    super(`Optimistic concurrency conflict: Server is at version ${serverVersion}`);
    this.name = "ConcurrencyConflictError";
  }
}

export class DbStore {
  public users: Map<string, StoredUser> = new Map();
  public userByEmail: Map<string, string> = new Map(); // email -> id
  public profiles: Map<string, ApplicantProfile> = new Map(); // userId -> profile
  public workflows: Map<string, ApplicationWorkflow> = new Map(); // id -> workflow
  public workflowByApplicant: Map<string, string> = new Map(); // applicantId -> workflowId
  public invitations: Map<string, SupportInvitation> = new Map(); // id -> invitation
  public invitationByToken: Map<string, string> = new Map(); // token -> id
  public supportSessions: Map<string, SupportSession> = new Map(); // id -> session
  public sessionByCode: Map<string, string> = new Map(); // sessionCode -> id
  public messages: Map<string, SupportMessage[]> = new Map(); // sessionId -> messages
  public refreshSessions: Map<string, StoredRefreshSession> = new Map(); // tokenHash -> session
  public auditEvents: StoredAuditEvent[] = [];

  constructor() {
    this.seedDefaultUsers();
  }

  private seedDefaultUsers() {
    // 1. Admin
    const adminId = "usr_admin_001";
    const admin: StoredUser = {
      id: adminId,
      email: "admin@remoteassist.local",
      passwordHash: hashPassword("AdminSecret2026!"),
      name: "Global Admin",
      role: "ADMIN",
      countryCode: "CA",
      createdAt: new Date().toISOString()
    };
    this.users.set(adminId, admin);
    this.userByEmail.set(admin.email.toLowerCase(), adminId);

    // 2. Helper (Specialist in Canada)
    const helperId = "usr_helper_001";
    const helper: StoredUser = {
      id: helperId,
      email: "helper@remoteassist.local",
      passwordHash: hashPassword("HelperSecret2026!"),
      name: "Dr. Aris Vance (Specialist)",
      role: "HELPER",
      countryCode: "CA",
      createdAt: new Date().toISOString()
    };
    this.users.set(helperId, helper);
    this.userByEmail.set(helper.email.toLowerCase(), helperId);

    // 3. Applicant (Sender in India)
    const applicantId = "usr_applicant_001";
    const applicant: StoredUser = {
      id: applicantId,
      email: "rohan@applicant.local",
      passwordHash: hashPassword("ApplicantSecret2026!"),
      name: "Rohan Sharma",
      role: "APPLICANT",
      countryCode: "IN",
      createdAt: new Date().toISOString()
    };
    this.users.set(applicantId, applicant);
    this.userByEmail.set(applicant.email.toLowerCase(), applicantId);

    // Create default applicant profile
    const profile: ApplicantProfile = {
      id: "prof_applicant_001",
      userId: applicantId,
      targetCountry: "CA",
      targetJobTitle: "Senior Cloud Systems Architect",
      visaStream: "Global Talent Stream (GTS)",
      phone: "+91-9876543210",
      resumeNotes: "Specialist in high-throughput distributed systems and Windows systems.",
      currentStep: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.profiles.set(applicantId, profile);

    // Create default applicant workflow with version 1
    const workflowId = "wf_applicant_001";
    const defaultChecklists: WorkflowChecklistItem[] = [
      {
        id: "chk_1",
        workflowId,
        label: "Verify Educational Credential Assessment (ECA) report",
        isCompleted: true,
        sortOrder: 1,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "chk_2",
        workflowId,
        label: "Prepare Proof of Funds and Financial Statements",
        isCompleted: false,
        sortOrder: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "chk_3",
        workflowId,
        label: "Review RemoteAssist WinCam video verification with Canadian Specialist",
        isCompleted: false,
        sortOrder: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const workflow: ApplicationWorkflow = {
      id: workflowId,
      applicantId,
      version: 1,
      status: "IN_PROGRESS",
      dataJson: {
        intendedProvince: "Ontario",
        nocCode: "21211",
        yearsExperience: 8,
        assistanceNotes: "Assisting with technical interview portfolio and camera document review."
      },
      disclaimer:
        "Local application assistance draft saved. This is NOT submitted to any external hiring, visa, or government portal.",
      checklists: defaultChecklists,
      lastSavedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.workflows.set(workflowId, workflow);
    this.workflowByApplicant.set(applicantId, workflowId);
  }

  // ================= User Operations =================
  createUser(params: {
    email: string;
    passwordHash: string;
    name: string;
    role: AppRole;
    countryCode?: string;
  }): StoredUser {
    const id = "usr_" + Math.random().toString(36).substring(2, 10);
    const user: StoredUser = {
      id,
      email: params.email.toLowerCase(),
      passwordHash: params.passwordHash,
      name: params.name,
      role: params.role,
      countryCode: params.countryCode || "IN",
      createdAt: new Date().toISOString()
    };
    this.users.set(id, user);
    this.userByEmail.set(user.email, id);
    return user;
  }

  getUserById(id: string): StoredUser | undefined {
    return this.users.get(id);
  }

  getUserByEmail(email: string): StoredUser | undefined {
    const id = this.userByEmail.get(email.toLowerCase());
    return id ? this.users.get(id) : undefined;
  }

  // ================= Profile Operations =================
  getProfileByUserId(userId: string): ApplicantProfile | undefined {
    return this.profiles.get(userId);
  }

  upsertProfile(userId: string, data: Partial<ApplicantProfile>): ApplicantProfile {
    const existing = this.profiles.get(userId);
    const now = new Date().toISOString();
    if (existing) {
      const updated: ApplicantProfile = {
        ...existing,
        ...data,
        updatedAt: now
      };
      this.profiles.set(userId, updated);
      return updated;
    }

    const created: ApplicantProfile = {
      id: "prof_" + Math.random().toString(36).substring(2, 10),
      userId,
      targetCountry: data.targetCountry || "CA",
      targetJobTitle: data.targetJobTitle,
      visaStream: data.visaStream,
      phone: data.phone,
      resumeNotes: data.resumeNotes,
      currentStep: data.currentStep || 1,
      createdAt: now,
      updatedAt: now
    };
    this.profiles.set(userId, created);
    return created;
  }

  // ================= Workflow & Concurrency Operations =================
  getWorkflowByApplicantId(applicantId: string): ApplicationWorkflow | undefined {
    const wfId = this.workflowByApplicant.get(applicantId);
    return wfId ? this.workflows.get(wfId) : undefined;
  }

  getWorkflowById(id: string): ApplicationWorkflow | undefined {
    return this.workflows.get(id);
  }

  /**
   * Update workflow with strict Optimistic Concurrency Locking
   */
  updateWorkflow(params: {
    id: string;
    applicantId: string;
    expectedVersion: number;
    status?: WorkflowStatus;
    dataJson?: Record<string, unknown>;
    checklists?: Array<{ id?: string; label: string; isCompleted: boolean; sortOrder: number }>;
  }): ApplicationWorkflow {
    const workflow = this.workflows.get(params.id);
    if (!workflow) {
      throw new Error("Workflow not found");
    }

    // Optimistic Concurrency Check:
    if (workflow.version !== params.expectedVersion) {
      throw new ConcurrencyConflictError(workflow.version, workflow.dataJson);
    }

    const now = new Date().toISOString();
    const updatedChecklists: WorkflowChecklistItem[] = params.checklists
      ? params.checklists.map((c, idx) => ({
          id: c.id || "chk_" + Math.random().toString(36).substring(2, 10),
          workflowId: workflow.id,
          label: c.label,
          isCompleted: c.isCompleted,
          sortOrder: c.sortOrder ?? idx + 1,
          completedAt: c.isCompleted ? now : undefined,
          createdAt: now,
          updatedAt: now
        }))
      : workflow.checklists;

    const updatedWorkflow: ApplicationWorkflow = {
      ...workflow,
      version: workflow.version + 1, // Atomically increment version
      status: params.status || workflow.status,
      dataJson: params.dataJson ? { ...workflow.dataJson, ...params.dataJson } : workflow.dataJson,
      checklists: updatedChecklists,
      lastSavedAt: now,
      updatedAt: now
    };

    this.workflows.set(params.id, updatedWorkflow);
    return updatedWorkflow;
  }

  // ================= Invitation Operations =================
  createInvitation(params: {
    helperId: string;
    helperName?: string;
    applicantEmail: string;
    targetCountry?: string;
    expiresInMinutes?: number;
  }): SupportInvitation {
    const id = "inv_" + Math.random().toString(36).substring(2, 10);
    const token =
      "tok_" +
      Math.random().toString(36).substring(2, 18) +
      Math.random().toString(36).substring(2, 18);
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    const code = `RAW-INV-${randomDigits.slice(0, 3)}-${randomDigits.slice(3, 6)}`;

    const ttlMs = (params.expiresInMinutes || 60) * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    const invitation: SupportInvitation = {
      id,
      token,
      code,
      helperId: params.helperId,
      helperName: params.helperName,
      applicantEmail: params.applicantEmail.toLowerCase(),
      targetCountry: params.targetCountry || "CA",
      expiresAt,
      isUsed: false,
      createdAt: new Date().toISOString()
    };

    this.invitations.set(id, invitation);
    this.invitationByToken.set(token, id);
    return invitation;
  }

  getInvitationByToken(token: string): SupportInvitation | undefined {
    const id = this.invitationByToken.get(token);
    return id ? this.invitations.get(id) : undefined;
  }

  useInvitation(token: string): SupportInvitation | undefined {
    const invitation = this.getInvitationByToken(token);
    if (!invitation) return undefined;
    if (invitation.isUsed) return undefined; // Single-use!
    if (new Date(invitation.expiresAt).getTime() < Date.now()) return undefined; // Expired!

    invitation.isUsed = true;
    invitation.usedAt = new Date().toISOString();
    return invitation;
  }

  // ================= Support Session Operations =================
  createSupportSession(params: {
    invitationId?: string;
    helperId: string;
    applicantId: string;
  }): SupportSession {
    const id = "sess_" + Math.random().toString(36).substring(2, 10);
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionCode = `RAW-${randomDigits.slice(0, 3)}-${randomDigits.slice(3, 6)}`;
    const now = new Date().toISOString();

    const session: SupportSession = {
      id,
      sessionCode,
      invitationId: params.invitationId,
      helperId: params.helperId,
      applicantId: params.applicantId,
      status: "PENDING_CONSENT",
      createdAt: now,
      updatedAt: now
    };

    this.supportSessions.set(id, session);
    this.sessionByCode.set(sessionCode, id);
    this.messages.set(id, []);
    return session;
  }

  getSupportSessionById(id: string): SupportSession | undefined {
    return this.supportSessions.get(id);
  }

  getSupportSessionByCode(code: string): SupportSession | undefined {
    const id = this.sessionByCode.get(code.trim().toUpperCase());
    return id ? this.supportSessions.get(id) : undefined;
  }

  updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    reason?: string
  ): SupportSession | undefined {
    const session = this.supportSessions.get(sessionId);
    if (!session) return undefined;
    session.status = status;
    session.updatedAt = new Date().toISOString();
    if (status === "ACTIVE" && !session.consentGrantedAt) {
      session.consentGrantedAt = new Date().toISOString();
    }
    if (status === "TERMINATED" || status === "COMPLETED") {
      session.terminatedAt = new Date().toISOString();
      session.terminationReason = reason;
    }
    return session;
  }

  // ================= Messages Operations =================
  addMessage(sessionId: string, message: Omit<SupportMessage, "id" | "createdAt">): SupportMessage {
    const msgList = this.messages.get(sessionId) || [];
    const fullMsg: SupportMessage = {
      ...message,
      id: "msg_" + Math.random().toString(36).substring(2, 10),
      createdAt: new Date().toISOString()
    };
    msgList.push(fullMsg);
    this.messages.set(sessionId, msgList);
    return fullMsg;
  }

  getMessages(sessionId: string): SupportMessage[] {
    return this.messages.get(sessionId) || [];
  }

  // ================= Refresh Session Operations =================
  saveRefreshSession(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipHash?: string;
  }): StoredRefreshSession {
    const session: StoredRefreshSession = {
      id: "ref_" + Math.random().toString(36).substring(2, 10),
      userId: params.userId,
      tokenHash: params.tokenHash,
      userAgent: params.userAgent,
      ipHash: params.ipHash,
      expiresAt: params.expiresAt,
      isRevoked: false,
      createdAt: new Date()
    };
    this.refreshSessions.set(params.tokenHash, session);
    return session;
  }

  getRefreshSession(tokenHash: string): StoredRefreshSession | undefined {
    return this.refreshSessions.get(tokenHash);
  }

  revokeRefreshSession(tokenHash: string): void {
    const session = this.refreshSessions.get(tokenHash);
    if (session) {
      session.isRevoked = true;
    }
  }

  revokeAllUserRefreshSessions(userId: string): void {
    for (const session of this.refreshSessions.values()) {
      if (session.userId === userId) {
        session.isRevoked = true;
      }
    }
  }

  // ================= Audit Event Operations =================
  logAuditEvent(event: Omit<StoredAuditEvent, "id" | "createdAt">): StoredAuditEvent {
    const fullEvent: StoredAuditEvent = {
      ...event,
      id: "aud_" + Math.random().toString(36).substring(2, 10),
      createdAt: new Date()
    };
    this.auditEvents.push(fullEvent);
    return fullEvent;
  }

  getAuditEvents(filter?: { sessionId?: string; actorId?: string }): StoredAuditEvent[] {
    return this.auditEvents.filter((ev) => {
      if (filter?.sessionId && ev.sessionId !== filter.sessionId) return false;
      if (filter?.actorId && ev.actorId !== filter.actorId) return false;
      return true;
    });
  }
}

export const dbStore = new DbStore();
