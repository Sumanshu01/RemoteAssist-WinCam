import { Router, Request, Response } from "express";
import { z } from "zod";
import { dbStore } from "../services/dbStore";
import {
  authenticateToken,
  requireAuth,
  requireApplicantIsolation
} from "../middleware/authMiddleware";

export const applicantRouter = Router();

applicantRouter.use(authenticateToken, requireAuth);

const profileUpdateSchema = z.object({
  targetCountry: z.string().min(2).max(5).optional(),
  targetJobTitle: z.string().optional(),
  visaStream: z.string().optional(),
  phone: z.string().optional(),
  resumeNotes: z.string().optional(),
  currentStep: z.number().int().min(1).max(10).optional()
});

// GET /api/applicants/profile (Own profile for current logged-in user)
applicantRouter.get("/profile", (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const profile = dbStore.getProfileByUserId(req.user.id);
  res.json({ profile });
});

// PUT /api/applicants/profile (Update own profile)
applicantRouter.put("/profile", (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parse = profileUpdateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Validation failed", details: parse.error.format() });
    return;
  }

  const updated = dbStore.upsertProfile(req.user.id, parse.data);
  res.json({ profile: updated });
});

// GET /api/applicants/:id/profile (Guarded by strict applicant isolation)
applicantRouter.get(
  "/:id/profile",
  requireApplicantIsolation((req) =>
    Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  ),
  (req: Request, res: Response): void => {
    const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const profile = dbStore.getProfileByUserId(targetId);
    if (!profile) {
      res.status(404).json({ error: "Applicant profile not found" });
      return;
    }
    res.json({ profile });
  }
);

// PUT /api/applicants/:id/profile (Guarded by strict applicant isolation)
applicantRouter.put(
  "/:id/profile",
  requireApplicantIsolation((req) =>
    Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  ),
  (req: Request, res: Response): void => {
    const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parse = profileUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Validation failed", details: parse.error.format() });
      return;
    }

    const updated = dbStore.upsertProfile(targetId, parse.data);
    res.json({ profile: updated });
  }
);
