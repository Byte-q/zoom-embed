import { NextRequest, NextResponse } from "next/server";
import KJUR from "jsrsasign";
// import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { meetingNumber, role } = await req.json();

  const clientId = process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID!;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET!;

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;

  const oPayload = {
    appKey: clientId,
    mn: meetingNumber,
    role,
    iat,
    exp,
    tokenExp: exp,
  };

  const oHeader = {
    alg: "HS256",
    typ: "JWT",
  };

  // function base64url(source: any) {
  //   return Buffer.from(JSON.stringify(source))
  //     .toString("base64")
  //     .replace(/=/g, "")
  //     .replace(/\+/g, "-")
  //     .replace(/\//g, "_");
  // }

  // const headerEncoded = base64url(oHeader);
  // const payloadEncoded = base64url(oPayload);

  // const signature = crypto
  //   .createHmac("sha256", clientSecret)
  //   .update(`${headerEncoded}.${payloadEncoded}`)
  //   .digest("base64")
  //   .replace(/=/g, "")
  //   .replace(/\+/g, "-")
  //   .replace(/\//g, "_");

  // const jwt = `${headerEncoded}.${payloadEncoded}.${signature}`;

  const sHeader = JSON.stringify(oHeader);
  const sPayload = JSON.stringify(oPayload);
  const MEETING_SDK_JWT = (KJUR as any).jws.JWS.sign(
    "HS256",
    sHeader,
    sPayload,
    clientSecret,
  );

  return NextResponse.json({ signature: MEETING_SDK_JWT, clientId });
}
