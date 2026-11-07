import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { createServer } from "../../services/signaling-server/src/server";
import { CameraService } from "../../apps/sender-client/src/services/cameraService";

describe("Camera Testing Component & Ethical Guardrail Suite", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { httpServer } = createServer();
    server = httpServer;
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 4000;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe("Subsystem Health & Consent Discovery", () => {
    it("reports ready status and confirms strict isolation from biometrics", async () => {
      const res = await fetch(`${baseUrl}/api/camera-test/health`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("ready");
      expect(body.subsystem).toBe("camera-testing-component");
      expect(body.isolatedFromBiometrics).toBe(true);
      expect(body.permittedPurposes).toContain("DIAGNOSTIC_HARDWARE_CHECK");
    });

    it("returns consenting test devices including synthetic test pattern profiles", async () => {
      const res = await fetch(`${baseUrl}/api/camera-test/devices/consenting`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.devices)).toBe(true);

      const synthetic = body.devices.find(
        (d: { deviceId: string }) => d.deviceId === "synthetic-smpte-bars"
      );
      expect(synthetic).toBeDefined();
      expect(synthetic.type).toBe("SYNTHETIC_CONSENTING");
      expect(synthetic.isConsentingTestDevice).toBe(true);
      expect(synthetic.capabilities.supportedResolutions).toEqual(
        expect.arrayContaining([expect.objectContaining({ width: 1920, height: 1080 })])
      );
    });
  });

  describe("Authorized Test Session & Ethical Guardrails", () => {
    it("creates an authorized session with expiring token for diagnostic testing", async () => {
      const res = await fetch(`${baseUrl}/api/camera-test/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: "usr_tester_991",
          role: "HELPER",
          testPurpose: "DIAGNOSTIC_HARDWARE_CHECK",
          prohibitedScopeCheck: {
            isIdentityVerification: false,
            isBiometricCapture: false
          }
        })
      });

      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.session).toBeDefined();
      expect(body.session.sessionId).toMatch(/^CTS-[A-F0-9]{8}$/);
      expect(body.session.token).toMatch(/^cam_tok_[a-f0-9]{32}$/);
      expect(body.session.authorizedScope).toBe("CAMERA_HARDWARE_TEST_ONLY");
      expect(body.session.prohibitedScopes).toContain("IDENTITY_VERIFICATION");
      expect(body.session.prohibitedScopes).toContain("BIOMETRIC_ENROLLMENT");
    });

    it("strictly blocks requests attempting to attach identity verification or biometric scope", async () => {
      const res = await fetch(`${baseUrl}/api/camera-test/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: "usr_tester_991",
          role: "HELPER",
          testPurpose: "DIAGNOSTIC_HARDWARE_CHECK",
          prohibitedScopeCheck: {
            isIdentityVerification: true, // Violation!
            isBiometricCapture: false
          }
        })
      });

      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.code).toBe("INVALID_TEST_REQUEST");
    });
  });

  describe("Diagnostic Report Submission & Metrics", () => {
    it("accepts valid diagnostic report for an active test session", async () => {
      // 1. Create session
      const sessRes = await fetch(`${baseUrl}/api/camera-test/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: "usr_tester_991",
          role: "APPLICANT",
          testPurpose: "CONFERENCING_READINESS",
          prohibitedScopeCheck: {
            isIdentityVerification: false,
            isBiometricCapture: false
          }
        })
      });

      const sessBody = await sessRes.json();
      const sessionId = sessBody.session.sessionId;

      // 2. Submit report
      const reportRes = await fetch(`${baseUrl}/api/camera-test/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          deviceId: "synthetic-smpte-bars",
          deviceLabel: "Consenting Synthetic Test Pattern",
          deviceType: "SYNTHETIC_CONSENTING",
          metrics: {
            resolution: { width: 1920, height: 1080 },
            aspectRatio: "1.78:1",
            frameRate: 30,
            brightnessScore: 54,
            contrastScore: 82,
            colorVariance: 90,
            audioActive: false
          },
          tests: [
            {
              id: "auth-check",
              title: "Authorized Hardware Access",
              status: "PASSED",
              measuredValue: "Authorized"
            },
            {
              id: "res-check",
              title: "Resolution & Aspect Ratio",
              status: "PASSED",
              measuredValue: "1920x1080 (1.78:1)"
            },
            {
              id: "fps-check",
              title: "Frame Rate Stability",
              status: "PASSED",
              measuredValue: "30 FPS"
            }
          ],
          overallStatus: "PASSED",
          ethicalIsolationConfirmed: true
        })
      });

      const reportBody = await reportRes.json();

      expect(reportRes.status).toBe(200);
      expect(reportBody.success).toBe(true);
      expect(reportBody.reportId).toMatch(/^REP-[A-F0-9]{8}$/);
      expect(reportBody.summary.overallStatus).toBe("PASSED");
    });

    it("rejects report submission for non-existent session", async () => {
      const res = await fetch(`${baseUrl}/api/camera-test/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "CTS-NONEXISTENT",
          deviceId: "synthetic-smpte-bars",
          deviceLabel: "Consenting Synthetic Test Pattern",
          deviceType: "SYNTHETIC_CONSENTING",
          metrics: {
            resolution: { width: 1920, height: 1080 },
            aspectRatio: "1.78:1",
            frameRate: 30,
            brightnessScore: 50,
            contrastScore: 70,
            colorVariance: 80,
            audioActive: false
          },
          tests: [],
          overallStatus: "PASSED",
          ethicalIsolationConfirmed: true
        })
      });

      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.code).toBe("SESSION_NOT_FOUND");
    });
  });

  describe("Camera Error Parsing & Diagnostics", () => {
    it("properly classifies browser and OS camera permission denial", () => {
      const error = { name: "NotAllowedError", message: "Permission dismissed" };
      const parsed = CameraService.parseCameraError(error);

      expect(parsed.type).toBe("PERMISSION_DENIED");
      expect(parsed.title).toBe("Camera Permission Denied");
      expect(parsed.troubleshootingTip).toContain("Windows 11 Settings");
    });

    it("properly classifies locked/busy camera hardware", () => {
      const error = { name: "NotReadableError", message: "Device in use" };
      const parsed = CameraService.parseCameraError(error);

      expect(parsed.type).toBe("HARDWARE_IN_USE");
      expect(parsed.title).toBe("Camera Already in Use");
      expect(parsed.troubleshootingTip).toContain("Teams");
    });
  });
});
