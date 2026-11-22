import { useEffect } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { reportError } from "../lib/errorReporting";

/** Shown instead of a blank screen when a page crashes. The error goes to the admin error log. */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  // A page file from an older release is gone after an update: reload once to get the new version.
  const staleRelease = /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError/i.test(
    error instanceof Error ? error.message : String(error),
  );
  useEffect(() => {
    if (staleRelease && !sessionStorage.getItem("msak-reloaded")) {
      sessionStorage.setItem("msak-reloaded", "1");
      location.reload();
      return;
    }
    if (!notFound) reportError(error, "page crashed");
  }, [error, notFound, staleRelease]);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-5 py-16">
      <div className="max-w-md text-center">
        <img src="/brand/msak-crest-128.webp" alt="" width={72} height={72} className="mx-auto mb-5" />
        <h1 className="font-serif text-3xl font-semibold text-navy-900">{notFound ? "Page not found" : "Something went wrong"}</h1>
        <p className="mt-3 text-body">
          {notFound
            ? "That page doesn't exist or has moved."
            : "Sorry — this page hit a problem. It has been reported to the MSAK team. Reloading usually fixes it."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!notFound && (
            <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
              Reload
            </button>
          )}
          <Link to="/" className="btn btn-outline">
            Go to the home page
          </Link>
        </div>
      </div>
    </main>
  );
}
