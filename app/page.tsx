import { Suspense } from "react";
import ZoomClientView from "@/components/ZoomClientView";

export default function Page() {
  return (
    <Suspense fallback={<>...</>}>
      <ZoomClientView />
    </Suspense>
  );
}
