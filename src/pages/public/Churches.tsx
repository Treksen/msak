import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { makeLookup } from "../../lib/directory";
import type { Church } from "../../lib/types";
import { ChurchFinder } from "../../components/ChurchFinder";
import { Alert, Spinner } from "../../components/ui";

/** Public church map — works without logging in. */
export function ChurchesPage() {
  const { directory, me } = useAuth();
  const navigate = useNavigate();
  const lookup = makeLookup(directory);
  const [churches, setChurches] = useState<Church[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .listChurches()
      .then((rows) => setChurches(rows.filter((c) => c.status === "published")))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    document.title = "Find a church — MSAK";
    load();
  }, [load]);

  return (
    <div className="container-page py-8 lg:py-10">
      {error && <Alert tone="error">{error}</Alert>}
      {!churches || !directory ? (
        <Spinner label="Loading the church map…" />
      ) : (
        <ChurchFinder
          churches={churches}
          lookup={lookup}
          onAdd={() => navigate(me ? "/app/churches?add=1" : "/login?next=%2Fapp%2Fchurches%3Fadd%3D1")}
          addLabel={me ? "Add a church" : "Suggest a church"}
          header={
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow mb-1">Local churches</p>
                <h1 className="font-serif text-3xl font-semibold text-navy-900 sm:text-4xl">Find a Sabbath fellowship</h1>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-body">
                  Tap <strong>Near me</strong> to see the closest church first. Leaders keep the map up to date —{" "}
                  {me ? <Link to="/app/churches">manage churches in your portal</Link> : <Link to="/register">join MSAK</Link>} to help.
                </p>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
