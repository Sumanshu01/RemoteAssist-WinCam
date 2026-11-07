import { describe, it, expect, beforeEach } from "vitest";
import { DbStore, ConcurrencyConflictError } from "@remoteassist/signaling-server/services/dbStore";

describe("Application Workflow Persistence & Optimistic Concurrency", () => {
  let store: DbStore;

  beforeEach(() => {
    store = new DbStore();
  });

  it("persists application draft state immediately with optimistic versioning", () => {
    const applicant = store.getUserByEmail("rohan@applicant.local")!;
    const workflow = store.getWorkflowByApplicantId(applicant.id)!;

    expect(workflow).toBeDefined();
    expect(workflow.version).toBe(1);

    // Update with expected version 1
    const updated = store.updateWorkflow({
      id: workflow.id,
      applicantId: applicant.id,
      expectedVersion: 1,
      status: "IN_PROGRESS",
      dataJson: {
        intendedProvince: "British Columbia",
        yearsExperience: 9
      }
    });

    expect(updated.version).toBe(2);
    expect(updated.dataJson.intendedProvince).toBe("British Columbia");
    expect(updated.lastSavedAt).toBeDefined();
  });

  it("enforces optimistic concurrency collision check when versions do not match", () => {
    const applicant = store.getUserByEmail("rohan@applicant.local")!;
    const workflow = store.getWorkflowByApplicantId(applicant.id)!;

    // First update moves version from 1 -> 2
    store.updateWorkflow({
      id: workflow.id,
      applicantId: applicant.id,
      expectedVersion: 1,
      dataJson: { intendedProvince: "Alberta" }
    });

    // Concurrent user / session tries to update with stale version 1
    expect(() => {
      store.updateWorkflow({
        id: workflow.id,
        applicantId: applicant.id,
        expectedVersion: 1, // Stale!
        dataJson: { intendedProvince: "Quebec" }
      });
    }).toThrow(ConcurrencyConflictError);

    // Verify error details
    try {
      store.updateWorkflow({
        id: workflow.id,
        applicantId: applicant.id,
        expectedVersion: 1,
        dataJson: { intendedProvince: "Quebec" }
      });
    } catch (err: unknown) {
      const conflict = err as ConcurrencyConflictError;
      expect(conflict.code).toBe("CONCURRENCY_CONFLICT");
      expect(conflict.serverVersion).toBe(2);
      expect(conflict.serverData.intendedProvince).toBe("Alberta");
    }
  });

  it("resolves conflict via bounded retry by fetching latest version", () => {
    const applicant = store.getUserByEmail("rohan@applicant.local")!;
    const workflow = store.getWorkflowByApplicantId(applicant.id)!;

    // Mutate to v2
    store.updateWorkflow({
      id: workflow.id,
      applicantId: applicant.id,
      expectedVersion: 1,
      dataJson: { note: "First save" }
    });

    // Simulate bounded retry loop (up to 3 attempts)
    let retries = 3;
    let saved = false;

    while (retries > 0 && !saved) {
      const latest = store.getWorkflowById(workflow.id)!;
      try {
        store.updateWorkflow({
          id: latest.id,
          applicantId: applicant.id,
          expectedVersion: latest.version, // Use fresh version
          dataJson: { note: "Resolved on retry" }
        });
        saved = true;
      } catch {
        retries--;
      }
    }

    expect(saved).toBe(true);
    const finalState = store.getWorkflowById(workflow.id)!;
    expect(finalState.version).toBe(3);
    expect(finalState.dataJson.note).toBe("Resolved on retry");
  });

  it("never claims local application state has been saved to an external hiring portal", () => {
    const applicant = store.getUserByEmail("rohan@applicant.local")!;
    const workflow = store.getWorkflowByApplicantId(applicant.id)!;

    // Architectural guarantee: disclaimer is present and explicit
    expect(workflow.disclaimer).toBeDefined();
    expect(workflow.disclaimer.toLowerCase()).toContain("local application assistance draft saved");
    expect(workflow.disclaimer.toLowerCase()).toContain("not submitted to any external hiring");
  });
});
