import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { policies, policyList } from "../../lib/policies";
import { formatDate } from "../../lib/format";
import { NotFoundPage } from "./NotFound";
import { useSeo } from "../../lib/seo";

export function PoliciesPage() {
  useSeo({ title: "Policies", description: "MSAK's terms, privacy policy, membership, leadership, announcements and community guidelines.", path: "/policies" });
  return (
    <div className="container-page py-10 lg:py-14">
      <p className="eyebrow mb-1">Policies and terms</p>
      <h1 className="font-serif text-4xl font-semibold text-navy-900">How the MSAK portal works</h1>
      <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-body">
        These documents explain membership, privacy, leadership verification, announcements and community standards.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {policyList.map((p) => (
          <li key={p.slug}>
            <Link to={`/policies/${p.slug}`} className="card flex h-full flex-col gap-2 p-5 no-underline hover:border-line-strong">
              <span className="font-serif text-xl font-semibold text-navy-900">{p.title}</span>
              <span className="text-sm leading-relaxed text-body">{p.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PolicyPage() {
  const { slug = "" } = useParams();
  const doc = Object.hasOwn(policies, slug) ? policies[slug] : undefined;
  useSeo({ title: doc?.title ?? "Policy not found", description: doc?.description, path: `/policies/${slug}`, noindex: !doc });
  if (!doc) return <NotFoundPage />;
  return (
    <article className="container-page max-w-3xl py-10 lg:py-14">
      <Link to="/policies" className="inline-flex items-center gap-1 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden="true" /> All policies
      </Link>
      <h1 className="mt-4 font-serif text-4xl font-semibold text-navy-900">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted">
        Version {doc.version} · Updated {formatDate(doc.lastUpdated)}
      </p>
      <p className="mt-4 text-[17px] leading-relaxed text-body">{doc.description}</p>
      <div className="prose-msak mt-8 space-y-8">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="mb-3 font-serif text-2xl font-semibold text-navy-900">{s.heading}</h2>
            {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
            {s.bullets && (
              <ul>
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
