import { Router, Request, Response } from "express";
import { z } from "zod";
import { dbStore, ConcurrencyConflictError } from "../services/dbStore";
import {
  authenticateToken,
  requireAuth,
  requireApplicantIsolation
} from "../middleware/authMiddleware";
import { logger } from "../utils/logger";

export const workflowRouter = Router();

workflowRouter.use(authenticateToken, requireAuth);

const updateWorkflowSchema = z.object({
  expectedVersion: z.number().int().min(1, "expectedVersion is required for concurrency control"),
  status: z.enum(["DRAFT", "IN_PROGRESS", "REVIEW_PENDING", "COMPLETED"]).optional(),
  dataJson: z.record(z.unknown()).optional(),
  checklists: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        isCompleted: z.boolean(),
        sortOrder: z.number().int().default(0)
      })
    )
    .optional()
});

// GET /api/workflows/applicant/:applicantId
workflowRouter.get(
  "/applicant/:applicantId",
  requireApplicantIsolation((req) =>
    Array.isArray(req.params.applicantId) ? req.params.applicantId[0] : req.params.applicantId
  ),
  (req: Request, res: Response): void => {
    const applicantId = Array.isArray(req.params.applicantId)
      ? req.params.applicantId[0]
      : req.params.applicantId;
    const workflow = dbStore.getWorkflowByApplicantId(applicantId);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found for this applicant" });
      return;
    }
    res.json({ workflow });
  }
);

// GET /api/workflows/:id
workflowRouter.get("/:id", (req: Request, res: Response): void => {
  const workflowId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const workflow = dbStore.getWorkflowById(workflowId);
  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }

  // Isolation check
  if (req.user?.role === "APPLICANT" && workflow.applicantId !== req.user.id) {
    res.status(403).json({ error: "Forbidden: Access to another applicant's workflow is denied" });
    return;
  }

  res.json({ workflow });
});

// PUT /api/workflows/:id (with Optimistic Concurrency Control)
workflowRouter.put("/:id", (req: Request, res: Response): void => {
  try {
    const workflowId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const workflow = dbStore.getWorkflowById(workflowId);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    // Applicant isolation check
    if (req.user?.role === "APPLICANT" && workflow.applicantId !== req.user.id) {
      res
        .status(403)
        .json({ error: "Forbidden: Access to another applicant's workflow is denied" });
      return;
    }

    const parse = updateWorkflowSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Validation failed", details: parse.error.format() });
      return;
    }

    const { expectedVersion, status, dataJson, checklists } = parse.data;

    try {
      const updated = dbStore.updateWorkflow({
        id: workflowId,
        applicantId: workflow.applicantId,
        expectedVersion,
        status,
        dataJson,
        checklists
      });

      dbStore.logAuditEvent({
        eventType: "WORKFLOW_SAVED",
        actorId: req.user!.id,
        actorRole: req.user!.role,
        targetEntity: "ApplicationWorkflow",
        targetId: updated.id,
        detailsJson: JSON.stringify({ version: updated.version, status: updated.status })
      });

      res.json({
        message: "Workflow saved successfully",
        workflow: updated,
        disclaimer: updated.disclaimer
      });
    } catch (concurrencyErr: unknown) {
      if (concurrencyErr instanceof ConcurrencyConflictError) {
        dbStore.logAuditEvent({
          eventType: "WORKFLOW_CONFLICT",
          actorId: req.user!.id,
          actorRole: req.user!.role,
          targetEntity: "ApplicationWorkflow",
          targetId: workflowId,
          detailsJson: JSON.stringify({
            expectedVersion,
            serverVersion: concurrencyErr.serverVersion
          })
        });

        res.status(409).json({
          error: "CONCURRENCY_CONFLICT",
          message:
            "Optimistic concurrency collision: the workflow draft was modified by another session. Please reload latest state.",
          serverVersion: concurrencyErr.serverVersion,
          serverData: concurrencyErr.serverData
        });
        return;
      }
      throw concurrencyErr;
    }
  } catch (err: unknown) {
    logger.error("Error updating workflow", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
