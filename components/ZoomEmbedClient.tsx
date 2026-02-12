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
  const participantsRootRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<any>(null);
  const destroyClientRef = useRef<null | (() => void)>(null);
  const [status, setStatus] = useState<ZoomStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState("chat");
  const panelHeight = "h-[70vh] min-h-[420px] max-h-[720px]";

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
  const autoJoin = (searchParams.get("autoJoin") ?? "false") === "true";
  const role = parseInt(searchParams.get("role") || '1');

  const joinMeeting = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      setError("Join meeting: Zoom client is not ready yet.");
      return;
    }

    if (!meetingNumber) {
      setError("Join meeting: Missing meeting number.");
      return;
    }

    setStatus("joining");
    setError(null);

    try {
      const res = await fetch('/api/zoom/signature', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meetingNumber,
          role
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

      let signatureResponse: { signature?: string, clientId?: string } | null = null;
      try {
        signatureResponse = await res.json();
      } catch (err) {
        throw new Error(
          `Signature response is not valid JSON: ${formatError("parse", err)}`,
        );
      }

      const signature = signatureResponse?.signature;
      const clientId = signatureResponse?.clientId;
      if (!signature || typeof signature !== "string") {
        throw new Error(
          "Signature missing or invalid from endpoint response.",
        );
      }
      const joinPayload = {
        signature,
        meetingNumber,
        password: meetingPassword,
        userName,
        sdkKey: clientId,
      };

      await client.join(joinPayload);
      setStatus("in-meeting");
    } catch (err) {
      setStatus("error");
      setError(formatError("Join meeting failed", err));
    }
  }, [meetingNumber, meetingPassword, userName]);

  useEffect(() => {
    let isMounted = true;
    let onConnectionChange: ((payload: { state?: string }) => void) | null =
      null;

    const initZoom = async () => {
      console.log("[ZoomEmbed] initZoom: start");
      const meetingRoot = document.getElementById("zoom-meeting-root");
      const chatRoot = document.getElementById("zoom-chat-root");
      const participantsRoot = document.getElementById("zoom-participants-root");

      if (!meetingRoot) {
        setStatus("error");
        setError("Zoom init failed: Missing #zoom-meeting-root element.");
        return;
      }

      setStatus("initializing");
      setError(null);
      console.log("[ZoomEmbed] initZoom: importing SDK");

      const ZoomMtgEmbedded = (await import("@zoom/meetingsdk/embedded"))
        .default;
      console.log("[ZoomEmbed] initZoom: SDK imported", {
        hasCreateClient: typeof ZoomMtgEmbedded?.createClient === "function",
      });
      if (!isMounted) {
        return;
      }

      const client = ZoomMtgEmbedded.createClient();
      console.log("[ZoomEmbed] initZoom: client created", !!client);
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

      try {
        console.log("[ZoomEmbed] initZoom: calling client.init");
        await client.init({
          zoomAppRoot: meetingRoot,
          language: "en-US",
          patchJsMedia: true,
          customize: {
          video: {
            isResizable: false,
            popper: {
              disableDraggable: true,
            },
            viewSizes: {
              default: {
                width: 849,
                height: 500
              }
            }
          },
            chat: {
              popper: {
                disableDraggable: true,
                anchorElement: chatRoot,
                placement: "right",
              },
            },
            participants: {
              popper: {
                disableDraggable: true,
                anchorElement: participantsRoot,
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
        console.log("[ZoomEmbed] initZoom: client.init resolved");
      } catch (err) {
        setStatus("error");
        setError(formatError("Zoom init failed (client.init)", err));
        return;
      }

      try {
        console.log("[ZoomEmbed] initZoom: attaching event handler");
        if (typeof client.on !== "function") {
          throw new Error("client.on is not available after init.");
        }
        client.on("connection-change", onConnectionChange);
        console.log("[ZoomEmbed] initZoom: event handler attached");
      } catch (err) {
        setStatus("error");
        setError(formatError("Zoom init failed (client.on)", err));
        return;
      }

      if (isMounted) {
        setStatus("ready");
      }

      if (autoJoin) {
        console.log("[ZoomEmbed] initZoom: autoJoin true");
        await joinMeeting();
      }
    };

    initZoom().catch((err) => {
      if (!isMounted) {
        return;
      }

      setStatus("error");
      setError(formatError("Zoom init failed", err));
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
      setError(formatError("Leave meeting failed", err));
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
      setError(formatError("Mute toggle failed", err));
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
      setError(formatError("Stop audio failed", err));
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
      setError(formatError("Change view failed", err));
    }
  };

  const canJoin = status === "ready" || status === "ended";
  const inMeeting = status === "in-meeting" || status === "joining";

  return (
    <div className="flex min-h-[90vh] max-h-screen flex-col gap-4 p-4">
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
        <CardContent className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-3">
            <div className="text-sm font-medium">Stage</div>
            <div
              className={`w-full overflow-hidden rounded-md border bg-muted/10 ${panelHeight}`}
            >
              <div id="zoom-meeting-root" className="h-full w-full" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-sm font-medium">Live Panel</div>
            <Tabs value={panel} onValueChange={setPanel} className="flex-1">
              <TabsList>
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="participants">Participants</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
              </TabsList>
              <TabsContent value="chat" className="space-y-2">
                <div
                  className={`w-full overflow-hidden rounded-md border bg-muted/10 ${panelHeight}`}
                >
                  <div id="zoom-chat-root" className="h-full w-full" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Open Chat from the Zoom toolbar to display it here.
                </p>
              </TabsContent>
              <TabsContent value="participants" className="space-y-2">
                <div
                  className={`w-full overflow-hidden rounded-md border bg-muted/10 ${panelHeight}`}
                >
                  <div
                    ref={participantsRootRef}
                    id="zoom-participants-root"
                    className="h-full w-full"
                  />
                </div>
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
