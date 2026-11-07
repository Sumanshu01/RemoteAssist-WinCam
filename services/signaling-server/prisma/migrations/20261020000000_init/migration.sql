-- RemoteAssist WinCam - Initial Database Migration
-- PostgreSQL 14+ compatible schema for users, workflow state, support sessions,
-- WebRTC room audit trails, single-use invitations, and cryptographic consent records.

-- Enums
CREATE TYPE "AppRole" AS ENUM ('ADMIN', 'HELPER', 'APPLICANT');
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'REVIEW_PENDING', 'COMPLETED');
CREATE TYPE "SessionStatus" AS ENUM ('PENDING_CONSENT', 'ACTIVE', 'COMPLETED', 'TERMINATED', 'EXPIRED');
CREATE TYPE "ConsentStatus" AS ENUM ('NONE', 'REQUESTED', 'GRANTED', 'DENIED', 'REVOKED');

-- Table: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AppRole" NOT NULL DEFAULT 'APPLICANT',
    "countryCode" TEXT NOT NULL DEFAULT 'IN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Table: ApplicantProfile
CREATE TABLE "ApplicantProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetCountry" TEXT NOT NULL DEFAULT 'CA',
    "targetJobTitle" TEXT,
    "visaStream" TEXT,
    "phone" TEXT,
    "resumeNotes" TEXT,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicantProfile_pkey" PRIMARY KEY ("id")
);

-- Table: ApplicationWorkflow
CREATE TABLE "ApplicationWorkflow" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "dataJson" TEXT NOT NULL DEFAULT '{}',
    "disclaimer" TEXT NOT NULL DEFAULT 'Local application assistance draft saved. Not submitted to external hiring website.',
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationWorkflow_pkey" PRIMARY KEY ("id")
);

-- Table: WorkflowChecklistItem
CREATE TABLE "WorkflowChecklistItem" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowChecklistItem_pkey" PRIMARY KEY ("id")
);

-- Table: SupportInvitation
CREATE TABLE "SupportInvitation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "helperId" TEXT NOT NULL,
    "applicantEmail" TEXT NOT NULL,
    "targetCountry" TEXT NOT NULL DEFAULT 'CA',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportInvitation_pkey" PRIMARY KEY ("id")
);

-- Table: SupportSession
CREATE TABLE "SupportSession" (
    "id" TEXT NOT NULL,
    "sessionCode" TEXT NOT NULL,
    "invitationId" TEXT,
    "helperId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'PENDING_CONSENT',
    "consentGrantedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportSession_pkey" PRIMARY KEY ("id")
);

-- Table: SupportMessage
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" "AppRole" NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- Table: AuditEvent
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "targetId" TEXT,
    "detailsJson" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- Table: RefreshSession
CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- Table: ConsentRecord
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AppRole" NOT NULL DEFAULT 'APPLICANT',
    "status" "ConsentStatus" NOT NULL DEFAULT 'NONE',
    "allowCamera" BOOLEAN NOT NULL DEFAULT false,
    "allowMicrophone" BOOLEAN NOT NULL DEFAULT false,
    "allowVisualAssistance" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgeSecurityPolicy" BOOLEAN NOT NULL DEFAULT false,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- Indexes and Unique Constraints
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "ApplicantProfile_userId_key" ON "ApplicantProfile"("userId");
CREATE UNIQUE INDEX "SupportInvitation_token_key" ON "SupportInvitation"("token");
CREATE UNIQUE INDEX "SupportInvitation_code_key" ON "SupportInvitation"("code");
CREATE UNIQUE INDEX "SupportSession_sessionCode_key" ON "SupportSession"("sessionCode");
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

CREATE INDEX "ApplicationWorkflow_applicantId_idx" ON "ApplicationWorkflow"("applicantId");
CREATE INDEX "WorkflowChecklistItem_workflowId_idx" ON "WorkflowChecklistItem"("workflowId");
CREATE INDEX "SupportInvitation_helperId_idx" ON "SupportInvitation"("helperId");
CREATE INDEX "SupportSession_helperId_idx" ON "SupportSession"("helperId");
CREATE INDEX "SupportSession_applicantId_idx" ON "SupportSession"("applicantId");
CREATE INDEX "SupportMessage_sessionId_idx" ON "SupportMessage"("sessionId");
CREATE INDEX "AuditEvent_sessionId_idx" ON "AuditEvent"("sessionId");
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");
CREATE INDEX "RefreshSession_userId_idx" ON "RefreshSession"("userId");
CREATE INDEX "ConsentRecord_sessionId_idx" ON "ConsentRecord"("sessionId");
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- Foreign Key Constraints
ALTER TABLE "ApplicantProfile" ADD CONSTRAINT "ApplicantProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationWorkflow" ADD CONSTRAINT "ApplicationWorkflow_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowChecklistItem" ADD CONSTRAINT "WorkflowChecklistItem_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApplicationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportInvitation" ADD CONSTRAINT "SupportInvitation_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportSession" ADD CONSTRAINT "SupportSession_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "SupportInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportSession" ADD CONSTRAINT "SupportSession_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportSession" ADD CONSTRAINT "SupportSession_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SupportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SupportSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SupportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
