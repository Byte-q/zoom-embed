"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ZoomStatus =
  | "idle"
  | "initializing"
  | "ready"
  | "joining"
  | "in-meeting"
  | "ended"
  | "error";

const statusLabels: Record<ZoomStatus, string> = {
  idle: "Idle",
  initializing: "Initializing",
  ready: "Ready",
  joining: "Joining",
  "in-meeting": "Live",
  ended: "Ended",
  error: "Error",
};

const statusVariants: Record<
  ZoomStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  idle: "outline",
  initializing: "secondary",
  ready: "secondary",
  joining: "secondary",
  "in-meeting": "default",
  ended: "outline",
  error: "destructive",
};

export default function ZoomEmbedClient() {
  const searchParams = useSearchParams();
  const meetingRootRef = useRef<HTMLDivElement | null>(null);
  const chatRootRef = useRef<HTMLDivElement | null>(null);
  const participantsRootRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<any>(null);
  const destroyClientRef = useRef<null | (() => void)>(null);
  const [status, setStatus] = useState<ZoomStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState("chat");

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
  const autoJoin = (searchParams.get("autoJoin") ?? "false") === "true";

  const joinMeeting = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      setError("Zoom client is not ready yet.");
      return;
    }

    if (!meetingNumber) {
      setError("Missing meeting number.");
      return;
    }

    if (!signatureEndpoint) {
      setError("Missing signature endpoint.");
      return;
    }

    setStatus("joining");
    setError(null);

    try {
      const res = await fetch(`https://ola.simplixin.com/${signatureEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meetingNumber,
          role: 0,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch Zoom signature.");
      }

      const { signature } = await res.json();
      const sdkKey = process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID;
      const joinPayload = {
        signature,
        meetingNumber,
        password: meetingPassword,
        userName,
        ...(sdkKey ? { sdkKey } : {}),
      };

      await client.join(joinPayload);
      setStatus("in-meeting");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to join meeting.");
    }
  }, [meetingNumber, meetingPassword, signatureEndpoint, userName]);

  useEffect(() => {
    let isMounted = true;
    let onConnectionChange: ((payload: { state?: string }) => void) | null =
      null;

    const initZoom = async () => {
      if (!meetingRootRef.current) {
        return;
      }

      setStatus("initializing");
      setError(null);

      const ZoomMtgEmbedded = (await import("@zoom/meetingsdk/embedded"))
        .default;
      if (!isMounted) {
        return;
      }

      const client = ZoomMtgEmbedded.createClient();
      clientRef.current = client;
      destroyClientRef.current = ZoomMtgEmbedded.destroyClient;

      onConnectionChange = (payload) => {
        if (!isMounted) {
          return;
        }

        if (payload?.state === "Closed") {
          setStatus("ended");
        }
      };

      client.on("connection-change", onConnectionChange);

      await client.init({
        zoomAppRoot: meetingRootRef.current,
        language: "en-US",
        patchJsMedia: true,
        customize: {
          video: {
            isResizable: false,
            popper: {
              disableDraggable: true,
            },
          },
          chat: {
            popper: {
              disableDraggable: true,
              anchorElement: chatRootRef.current ?? undefined,
              placement: "right",
            },
          },
          participants: {
            popper: {
              disableDraggable: true,
              anchorElement: participantsRootRef.current ?? undefined,
              placement: "right",
            },
          },
          meetingInfo: ["topic", "host", "mn"],
          toolbar: {
            buttons: [
              {
                text: "Resources",
                onClick: () => setPanel("resources"),
              },
            ],
          },
        },
      });

      if (isMounted) {
        setStatus("ready");
      }

      if (autoJoin) {
        await joinMeeting();
      }
    };

    initZoom().catch((err) => {
      if (!isMounted) {
        return;
      }

      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to init Zoom.");
    });

    return () => {
      isMounted = false;

      if (clientRef.current && onConnectionChange) {
        clientRef.current.off("connection-change", onConnectionChange);
      }

      if (clientRef.current) {
        clientRef.current.leaveMeeting().catch(() => {});
      }

      destroyClientRef.current?.();
    };
  }, [autoJoin, joinMeeting]);

  const leaveMeeting = async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    setError(null);

    try {
      await client.leaveMeeting();
      setStatus("ended");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to leave meeting.");
    }
  };

  const muteSelf = async (mute: boolean) => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    setError(null);

    try {
      await client.mute(mute);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle mute.");
    }
  };

  const stopAudio = async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    setError(null);

    try {
      await client.stopAudio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop audio.");
    }
  };

  const setView = async (view: "speaker" | "ribbon") => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    setError(null);

    try {
      await client.setViewType(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change view.");
    }
  };

  const canJoin = status === "ready" || status === "ended";
  const inMeeting = status === "in-meeting" || status === "joining";

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Live Session</CardTitle>
            <CardDescription>
              {meetingNumber ? `Meeting ${meetingNumber}` : "Meeting"}
            </CardDescription>
          </div>
          <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>
        </CardHeader>
        <Separator />
        <CardContent className="grid gap-4 pt-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-3">
            <div className="text-sm font-medium">Stage</div>
            <div ref={meetingRootRef} className="min-h-96 w-full" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-sm font-medium">Live Panel</div>
            <Tabs value={panel} onValueChange={setPanel}>
              <TabsList>
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="participants">Participants</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
              </TabsList>
              <TabsContent value="chat" className="space-y-2">
                <div ref={chatRootRef} className="min-h-96 w-full" />
                <p className="text-sm text-muted-foreground">
                  Open Chat from the Zoom toolbar to display it here.
                </p>
              </TabsContent>
              <TabsContent value="participants" className="space-y-2">
                <div ref={participantsRootRef} className="min-h-96 w-full" />
                <p className="text-sm text-muted-foreground">
                  Open Participants from the Zoom toolbar to display it here.
                </p>
              </TabsContent>
              <TabsContent value="resources" className="space-y-2">
                <Button variant="outline">Open syllabus</Button>
                <Button variant="outline">Class notes</Button>
                <Button variant="outline">Assignments</Button>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
        <Separator />
        <CardFooter className="flex flex-wrap gap-2 pt-6">
          <Button onClick={joinMeeting} disabled={!canJoin || !meetingNumber}>
            Join meeting
          </Button>
          <Button
            variant="secondary"
            onClick={() => muteSelf(true)}
            disabled={!inMeeting}
          >
            Mute
          </Button>
          <Button
            variant="secondary"
            onClick={() => muteSelf(false)}
            disabled={!inMeeting}
          >
            Unmute
          </Button>
          <Button
            variant="secondary"
            onClick={stopAudio}
            disabled={!inMeeting}
          >
            Stop audio
          </Button>
          <Button
            variant="outline"
            onClick={() => setView("speaker")}
            disabled={!inMeeting}
          >
            Speaker view
          </Button>
          <Button
            variant="outline"
            onClick={() => setView("ribbon")}
            disabled={!inMeeting}
          >
            Ribbon view
          </Button>
          <Button
            variant="destructive"
            onClick={leaveMeeting}
            disabled={!inMeeting}
          >
            Leave
          </Button>
        </CardFooter>
      </Card>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Zoom error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
