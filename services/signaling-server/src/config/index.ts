import dotenv from "dotenv";

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.SIGNALING_PORT || "4000", 10),
  host: process.env.SIGNALING_HOST || "0.0.0.0",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174").split(
    ","
  ),
  sessionExpiryMinutes: parseInt(process.env.SESSION_EXPIRY_MINUTES || "30", 10),
  requireTwoPartyConsent: process.env.REQUIRE_EXPLICIT_TWO_PARTY_CONSENT !== "false",
  auditLogEnabled: process.env.CONSENT_AUDIT_LOG_ENABLED !== "false",
  stunServers: (
    process.env.STUN_SERVER_URLS || "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"
  ).split(","),
  turnServer: {
    url: process.env.TURN_SERVER_URL || "",
    username: process.env.TURN_USERNAME || "",
    credential: process.env.TURN_CREDENTIAL || ""
  }
};
