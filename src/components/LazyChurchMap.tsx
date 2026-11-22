import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps } from "react";
import type { ChurchMap as ChurchMapType } from "./ChurchMap";

// The map library (~150 KB) is only downloaded when the map is about to scroll into view.
const ChurchMap = lazy(() => import("./ChurchMap").then((m) => ({ default: m.ChurchMap })));

function Placeholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#e9eef2] text-sm text-muted" aria-hidden="true">
      Loading the map…
    </div>
  );
}

export function LazyChurchMap(props: ComponentProps<typeof ChurchMapType>) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = box.current;
    if (near || !el) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return (
    <div ref={box} className="h-full w-full">
      {near ? (
        <Suspense fallback={<Placeholder />}>
          <ChurchMap {...props} />
        </Suspense>
      ) : (
        <Placeholder />
      )}
    </div>
  );
}
