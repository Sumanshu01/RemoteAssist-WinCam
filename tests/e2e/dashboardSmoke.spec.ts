import { test, expect } from "@playwright/test";

test.describe("RemoteAssist WinCam Dashboard Smoke Suite", () => {
  test("loads the light-themed dashboard and displays initial components", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Verify title and branding
    await expect(page).toHaveTitle(/RemoteAssist WinCam/);
    await expect(page.getByText("RemoteAssist WinCam", { exact: true })).toBeVisible();
    await expect(page.locator("text=Win 11 Architecture")).toBeVisible();

    // Verify connection status bar
    await expect(page.locator("text=Signaling:").first()).toBeVisible();

    // Verify session invitation code card
    await expect(page.locator("text=One-Time Session Code")).toBeVisible();

    // Verify cross-border corridor telemetry
    await expect(page.locator("text=Cross-Border Corridor Telemetry")).toBeVisible();
    await expect(page.locator("text=Trans-Atlantic Fiber").first()).toBeVisible();

    // Verify security guardrails badge
    await expect(page.locator("text=Mutual Consent")).toBeVisible();
    await expect(page.locator("text=No Remote Control")).toBeVisible();
  });

  test("interacts with role switch and verifies workflow editor", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Verify role buttons exist
    const helperBtn = page.getByRole("button", { name: /Support Specialist/i });
    const applicantBtn = page.getByRole("button", { name: /Applicant Client/i });
    await expect(helperBtn).toBeVisible();
    await expect(applicantBtn).toBeVisible();

    // Click Applicant role button
    await applicantBtn.click();
    await expect(page.locator("text=Rohan Patel").first()).toBeVisible();

    // Verify Application Progress Persistence component
    await expect(page.locator("text=Application Progress & Checklist (Local State)")).toBeVisible();
    await expect(page.locator("text=Verify Educational Credential Assessment")).toBeVisible();
  });

  test("switches to Camera Testing Studio and runs consenting device preview", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Click Camera Testing Studio tab
    const cameraTestTab = page.locator("#tab-camera-test");
    await expect(cameraTestTab).toBeVisible();
    await cameraTestTab.click();

    // Verify Camera Testing Studio loaded
    await expect(page.getByRole("heading", { name: "Camera Testing Studio" })).toBeVisible();
    await expect(
      page.locator("text=Isolated from Biometrics & Third-Party Controls")
    ).toBeVisible();
    await expect(page.locator("text=Explicit Camera Authorization Required")).toBeVisible();

    // Check authorization box
    const authCheckbox = page.locator("#chk-authorize-camera");
    await expect(authCheckbox).toBeVisible();
    await authCheckbox.check();

    // Click Start Live Preview
    const startPreviewBtn = page.locator("#btn-start-camera-preview");
    await expect(startPreviewBtn).toBeEnabled();
    await startPreviewBtn.click();

    // Verify live preview is running
    await expect(page.getByText("LIVE PREVIEW", { exact: true })).toBeVisible();
    await expect(page.locator("#btn-stop-camera-preview")).toBeVisible();

    // Run diagnostics
    const runDiagBtn = page.locator("#btn-run-camera-diagnostics");
    await expect(runDiagBtn).toBeVisible();
    await runDiagBtn.click();

    // Verify diagnostics suite completed and passed
    await expect(page.locator("text=Ready for Remote Assist")).toBeVisible({ timeout: 10000 });

    // Submit diagnostic report
    const submitBtn = page.locator("#btn-submit-camera-report");
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();
    await expect(page.locator("text=Report Saved:")).toBeVisible({ timeout: 5000 });
  });
});
