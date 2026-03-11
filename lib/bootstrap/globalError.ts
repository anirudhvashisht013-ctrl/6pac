import { logFatal } from "@/lib/bootstrap/logger";

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

let handlersInstalled = false;

function installUnhandledRejectionCapture() {
  const maybeProcess = globalThis.process as
    | {
        on?: (event: string, listener: (reason: unknown) => void) => void;
      }
    | undefined;

  if (typeof maybeProcess?.on === "function") {
    maybeProcess.on("unhandledRejection", (reason: unknown) => {
      logFatal("Unhandled promise rejection", reason);
    });
  }

  const maybeAddEventListener = (globalThis as any).addEventListener as
    | ((event: string, listener: (event: any) => void) => void)
    | undefined;

  if (typeof maybeAddEventListener === "function") {
    maybeAddEventListener("unhandledrejection", (event: any) => {
      const reason = event?.reason;
      logFatal("Unhandled rejection event", reason);
    });
  }
}

export function installGlobalErrorCapture() {
  if (handlersInstalled) return;
  handlersInstalled = true;

  const errorUtils = (globalThis as any).ErrorUtils as
    | {
        getGlobalHandler?: () => GlobalErrorHandler | undefined;
        setGlobalHandler?: (handler: GlobalErrorHandler) => void;
      }
    | undefined;

  if (errorUtils?.setGlobalHandler) {
    const previousHandler = errorUtils.getGlobalHandler?.();

    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      logFatal("Global error captured", error, {
        isFatal: Boolean(isFatal),
      });

      if (typeof previousHandler === "function") {
        previousHandler(error, isFatal);
      }
    });
  }

  installUnhandledRejectionCapture();
  logFatal("Global fatal error capture installed");
}
