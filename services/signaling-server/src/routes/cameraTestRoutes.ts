import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import {
  CameraTestSession,
  CameraTestDevice,
  CameraDiagnosticReport
} from "@remoteassist/shared-types";
import { logger } from "../utils/logger";

export const cameraTestRouter = Router();

// In-memory active camera test sessions
const activeTestSessions = new Map<string, CameraTestSession>();

// In-memory diagnostic reports store
const diagnosticReports = new Map<string, CameraDiagnosticReport>();

// Zod schemas for input validation
const CreateTestSessionSchema = z.object({
  requesterId: z.string().min(1),
  role: z.enum(["APPLICANT", "HELPER", "ADMIN", "SENDER", "RECEIVER_SPECIALIST"]),
  testPurpose: z.enum([
    "DIAGNOSTIC_HARDWARE_CHECK",
    "CONFERENCING_READINESS",
    "CONSENTING_DEVICE_TEST"
  ]),
  // Ethical guardrail: reject any request attempting to attach identity verification or biometric tags
  prohibitedScopeCheck: z.object({
    isIdentityVerification: z.literal(false, {
      errorMap: () => ({
        message: "Camera test component cannot be used for identity verification."
      })
    }),
    isBiometricCapture: z.literal(false, {
      errorMap: () => ({ message: "Camera test component cannot be used for biometric capture." })
    })
  })
});

const SubmitReportSchema = z.object({
  sessionId: z.string().min(1),
  deviceId: z.string().min(1),
  deviceLabel: z.string().min(1),
  deviceType: z.enum(["PHYSICAL", "SYNTHETIC_CONSENTING", "VIRTUAL_LOOPBACK"]),
  metrics: z.object({
    resolution: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive()
    }),
    aspectRatio: z.string(),
    frameRate: z.number().nonnegative(),
    brightnessScore: z.number().min(0).max(100),
    contrastScore: z.number().min(0).max(100),
    colorVariance: z.number().nonnegative(),
    audioActive: z.boolean(),
    audioLevelDb: z.number().optional()
  }),
  tests: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.enum(["PENDING", "RUNNING", "PASSED", "WARNING", "FAILED"]),
      measuredValue: z.union([z.string(), z.number()]).optional(),
      expectedValue: z.string().optional(),
      details: z.string().optional()
    })
  ),
  overallStatus: z.enum(["PASSED", "PASSED_WITH_WARNINGS", "FAILED"]),
  ethicalIsolationConfirmed: z.literal(true, {
    errorMap: () => ({ message: "Ethical isolation must be confirmed." })
  })
});

/**
 * Health check for camera testing subsystem
 */
cameraTestRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ready",
    subsystem: "camera-testing-component",
    timestamp: new Date().toISOString(),
    isolatedFromBiometrics: true,
    permittedPurposes: [
      "DIAGNOSTIC_HARDWARE_CHECK",
      "CONFERENCING_READINESS",
      "CONSENTING_DEVICE_TEST"
    ],
    activeSessionsCount: activeTestSessions.size
  });
});

/**
 * Request an authorized camera test session
 */
cameraTestRouter.post("/session", (req: Request, res: Response) => {
  try {
    const validated = CreateTestSessionSchema.parse(req.body);

    const sessionId = "CTS-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    const token = "cam_tok_" + crypto.randomBytes(16).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15 mins

    const session: CameraTestSession = {
      sessionId,
      token,
      createdAt: now.toISOString(),
      expiresAt,
      isAuthorized: true,
      authorizedScope: "CAMERA_HARDWARE_TEST_ONLY",
      prohibitedScopes: ["IDENTITY_VERIFICATION", "BIOMETRIC_ENROLLMENT", "FACIAL_RECOGNITION"]
    };

    activeTestSessions.set(sessionId, session);

    logger.info(`[CameraTest] Created authorized camera test session ${sessionId}`, {
      requesterId: validated.requesterId
    });

    res.status(201).json({
      success: true,
      session
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        code: "INVALID_TEST_REQUEST",
        message: "Failed input validation or ethical guardrail check.",
        errors: err.errors
      });
      return;
    }
    logger.error("[CameraTest] Failed to create camera test session", err);
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to create test session." });
  }
});

/**
 * Get consenting test device profiles
 */
cameraTestRouter.get("/devices/consenting", (_req: Request, res: Response) => {
  const devices: CameraTestDevice[] = [
    {
      deviceId: "synthetic-smpte-bars",
      label: "Consenting Synthetic Test Pattern (SMPTE Color Bars + 30 FPS Counter)",
      type: "SYNTHETIC_CONSENTING",
      isConsentingTestDevice: true,
      capabilities: {
        supportedResolutions: [
          { width: 1920, height: 1080, label: "1080p FHD (16:9)" },
          { width: 1280, height: 720, label: "720p HD (16:9)" },
          { width: 640, height: 480, label: "480p SD (4:3)" }
        ],
        maxFrameRate: 30,
        facingMode: "user"
      }
    },
    {
      deviceId: "synthetic-dynamic-gradient",
      label: "Consenting Motion Test Pattern (High-Contrast Chroma Wave)",
      type: "SYNTHETIC_CONSENTING",
      isConsentingTestDevice: true,
      capabilities: {
        supportedResolutions: [
          { width: 1920, height: 1080, label: "1080p FHD (16:9)" },
          { width: 1280, height: 720, label: "720p HD (16:9)" }
        ],
        maxFrameRate: 60,
        facingMode: "environment"
      }
    },
    {
      deviceId: "physical-default",
      label: "Physical Webcam Hardware (Requires In-Browser User Permission)",
      type: "PHYSICAL",
      isConsentingTestDevice: true,
      capabilities: {
        supportedResolutions: [
          { width: 1920, height: 1080, label: "1080p FHD" },
          { width: 1280, height: 720, label: "720p HD" }
        ],
        maxFrameRate: 30
      }
    }
  ];

  res.json({
    success: true,
    devices,
    disclaimer:
      "These test profiles are strictly for webcam diagnosis and video conferencing readiness. Identity verification is blocked."
  });
});

/**
 * Submit diagnostic test results
 */
cameraTestRouter.post("/report", (req: Request, res: Response) => {
  try {
    const validated = SubmitReportSchema.parse(req.body);

    const session = activeTestSessions.get(validated.sessionId);
    if (!session) {
      res.status(404).json({
        code: "SESSION_NOT_FOUND",
        message: "Camera test session does not exist or has expired."
      });
      return;
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      activeTestSessions.delete(validated.sessionId);
      res.status(410).json({
        code: "SESSION_EXPIRED",
        message: "Camera test session has expired."
      });
      return;
    }

    const report: CameraDiagnosticReport = {
      ...validated,
      timestamp: new Date().toISOString()
    };

    diagnosticReports.set(validated.sessionId, report);

    logger.info(
      `[CameraTest] Received diagnostic report for session ${validated.sessionId} on device ${validated.deviceLabel}`,
      {
        overallStatus: validated.overallStatus,
        frameRate: validated.metrics.frameRate,
        resolution: `${validated.metrics.resolution.width}x${validated.metrics.resolution.height}`
      }
    );

    res.json({
      success: true,
      reportId: "REP-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
      receivedAt: report.timestamp,
      summary: {
        deviceType: report.deviceType,
        resolution: `${report.metrics.resolution.width}x${report.metrics.resolution.height}`,
        frameRate: report.metrics.frameRate,
        overallStatus: report.overallStatus
      }
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        code: "INVALID_REPORT_PAYLOAD",
        message: "Diagnostic report failed validation.",
        errors: err.errors
      });
      return;
    }
    logger.error("[CameraTest] Failed to save diagnostic report", err);
    res
      .status(500)
      .json({ code: "INTERNAL_ERROR", message: "Failed to record diagnostic report." });
  }
});
