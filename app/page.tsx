import { Suspense } from "react";
import ZoomEmbedClient from "@/components/ZoomEmbedClient";

export default function Page() {
  return (
    <Suspense fallback={<>...</>}>
      <ZoomEmbedClient />
    </Suspense>
  );
}
