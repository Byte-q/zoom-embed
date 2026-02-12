import "./globals.css";

export const metadata = {
  title: "Zoom Embed",
  description: "Zoom Meeting SDK embed",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sdkVersion = process.env.NEXT_PUBLIC_ZOOM_SDK_VERSION ?? "5.1.0";

  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href={`https://source.zoom.us/${sdkVersion}/css/bootstrap.css`}
        />
        <link
          rel="stylesheet"
          href={`https://source.zoom.us/${sdkVersion}/css/react-select.css`}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
