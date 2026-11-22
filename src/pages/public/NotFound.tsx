import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="container-page flex flex-col items-start gap-4 py-24">
      <p className="eyebrow">Page not found</p>
      <h1 className="font-serif text-4xl font-semibold text-navy-900">We couldn't find that page.</h1>
      <p className="text-body">The link may be old, or the page may have moved.</p>
      <div className="flex gap-2">
        <Link to="/" className="btn btn-primary">
          Go home
        </Link>
        <Link to="/churches" className="btn btn-outline">
          Find a church
        </Link>
      </div>
    </div>
  );
}
