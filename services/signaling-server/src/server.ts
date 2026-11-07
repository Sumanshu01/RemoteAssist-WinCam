import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { authRouter } from "./routes/authRoutes";
import { applicantRouter } from "./routes/applicantRoutes";
import { workflowRouter } from "./routes/workflowRoutes";
import { invitationRouter } from "./routes/invitationRoutes";
import { sessionRouter } from "./routes/sessionRoutes";
import { cameraTestRouter } from "./routes/cameraTestRoutes";
import { setupSignalingHandlers } from "./socket/signalingHandler";
import { authenticateToken } from "./middleware/authMiddleware";

export function createServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Cross-origin setup with credentials support for secure HTTP-only cookies
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server) or matching origins
        if (
          !origin ||
          config.corsOrigins.includes(origin) ||
          origin.startsWith("http://localhost:")
        ) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive in dev
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    })
  );

  app.use(cookieParser());
  app.use(express.json());
  app.use(authenticateToken); // Global token extraction from cookies or Authorization header

  // Health and info endpoints
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      service: "remoteassist-signaling-server",
      timestamp: new Date().toISOString(),
      activeFeatures: {
        authentication: true,
        applicantIsolation: true,
        optimisticConcurrency: true,
        singleUseInvitations: true,
        consentEnforcement: config.requireTwoPartyConsent,
        crossBorderTraversal: true,
        stunTurnConfigured: Boolean(config.stunServers.length)
      }
    });
  });

  // REST API routes
  app.use("/api/auth", authRouter);
  app.use("/api/applicants", applicantRouter);
  app.use("/api/workflows", workflowRouter);
  app.use("/api/invitations", invitationRouter);
  app.use("/api/sessions", sessionRouter);
  app.use("/api/camera-test", cameraTestRouter);

  // Setup Socket.IO
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  setupSignalingHandlers(io);

  return { app, httpServer, io };
}
