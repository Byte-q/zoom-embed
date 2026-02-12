"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ZoomMtg } from "@zoom/meetingsdk";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type ZoomStatus = "idle" | "initializing" | "joining" | "in-meeting" | "error";

export default function ZoomClientView() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ZoomStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const meetingNumber =
    searchParams.get("meetingNumber") ??
    process.env.NEXT_PUBLIC_ZOOM_MEETING_NUMBER ??
    "";
  const meetingPassword =
    searchParams.get("password") ??
    process.env.NEXT_PUBLIC_ZOOM_MEETING_PASSWORD ??
    "";
  const userName =
    searchParams.get("userName") ??
    process.env.NEXT_PUBLIC_ZOOM_USER_NAME ??
    "Student";
  const signatureEndpoint =
    searchParams.get("signatureEndpoint") ??
    process.env.NEXT_PUBLIC_ZOOM_SIGNATURE_ENDPOINT ??
    "/api/zoom/signature";
  const autoJoin = (searchParams.get("autoJoin") ?? "true") === "true";
  const sdkVersion = process.env.NEXT_PUBLIC_ZOOM_SDK_VERSION ?? "5.1.0";
  const role = useMemo(() => {
    const raw = searchParams.get("role");
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [searchParams]);

  const formatError = (context: string, err: unknown) => {
    if (err instanceof Error) {
      return `${context}: ${err.message}`;
    }

    if (typeof err === "string") {
      return `${context}: ${err}`;
    }

    try {
      return `${context}: ${JSON.stringify(err)}`;
    } catch {
      return `${context}: Unknown error`;
    }
  };

  const joinMeeting = useCallback(async () => {
    if (!meetingNumber) {
      setError("Join meeting: Missing meeting number.");
      return;
    }

    if (!signatureEndpoint) {
      setError("Join meeting: Missing signature endpoint.");
      return;
    }

    setStatus("joining");
    setError(null);

    try {
      const res = await fetch(signatureEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meetingNumber,
          role,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(
          `Signature request failed (${res.status} ${res.statusText})${
            errorText ? `: ${errorText}` : ""
          }`,
        );
      }

      const signatureResponse = (await res.json()) as {
        signature?: string;
        clientId?: string;
      };

      const signature = signatureResponse?.signature;
      const sdkKey = signatureResponse?.clientId;
      if (!signature || typeof signature !== "string") {
        throw new Error("Signature missing or invalid from endpoint response.");
      }

      ZoomMtg.join({
        meetingNumber,
        userName,
        passWord: meetingPassword,
        signature,
        ...(sdkKey ? { sdkKey } : {}),
        success: () => {
          setStatus("in-meeting");
        },
        error: (err: unknown) => {
          setStatus("error");
          setError(formatError("Join meeting failed", err));
        },
      });
    } catch (err) {
      setStatus("error");
      setError(formatError("Join meeting failed", err));
    }
  }, [meetingNumber, meetingPassword, role, signatureEndpoint, userName]);

  const initClient = useCallback(() => {
    setStatus("initializing");
    setError(null);

    ZoomMtg.setZoomJSLib(`https://source.zoom.us/${sdkVersion}/lib`, "/av");
    ZoomMtg.preLoadWasm();
    ZoomMtg.prepareWebSDK();

    ZoomMtg.init({
      leaveUrl: window.location.href,
      success: () => {
        joinMeeting();
      },
      error: (err: unknown) => {
        setStatus("error");
        setError(formatError("Zoom init failed", err));
      },
    });
  }, [joinMeeting]);

  useEffect(() => {
    if (!autoJoin) {
      return;
    }

    initClient();
  }, [autoJoin, initClient]);

  return (
    <div className="min-h-screen w-full">
      <div className="flex items-center gap-2 p-4">
        <Button onClick={initClient} disabled={status === "joining"}>
          Join meeting
        </Button>
      </div>
      <div id="zmmtg-root" className="min-h-[70vh] w-full" />
      <div id="aria-notify-area" />
      {error ? (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertTitle>Zoom error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
