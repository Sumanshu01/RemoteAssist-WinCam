import { createServer } from "./server";
import { config } from "./config";

const { httpServer } = createServer();

httpServer.listen(config.port, config.host, () => {
  console.log(`[RemoteAssist Signaling Server] listening on http://${config.host}:${config.port}`);
  console.log(
    `[Security] Two-party consent requirement: ${config.requireTwoPartyConsent ? "ENABLED" : "DISABLED"}`
  );
  console.log(`[Cross-Border] STUN servers: ${config.stunServers.join(", ")}`);
});
