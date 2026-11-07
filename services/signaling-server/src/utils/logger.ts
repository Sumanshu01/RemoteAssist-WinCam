import { redactSensitiveData } from "./security";

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.log(`[${timestamp}] [INFO] ${message}`, JSON.stringify(redactSensitiveData(meta)));
    } else {
      console.log(`[${timestamp}] [INFO] ${message}`);
    }
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.warn(`[${timestamp}] [WARN] ${message}`, JSON.stringify(redactSensitiveData(meta)));
    } else {
      console.warn(`[${timestamp}] [WARN] ${message}`);
    }
  },
  error: (message: string, error?: unknown, meta?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const errMsg = error instanceof Error ? error.message : String(error || "");
    const combinedMeta = { ...meta, error: errMsg };
    console.error(
      `[${timestamp}] [ERROR] ${message}`,
      JSON.stringify(redactSensitiveData(combinedMeta))
    );
  }
};
