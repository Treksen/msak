import { api } from "../lib/api";
import { initials } from "../lib/format";

/** A member's photo in a circle, or their initials when there's no photo. */
export function Avatar({ name, path, size = 40, className = "" }: { name: string; path?: string | null; size?: number; className?: string }) {
  const url = api.profilePhotoUrl(path);
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) };
  if (url)
    return <img src={url} alt="" width={size} height={size} loading="lazy" style={style} className={`flex-none rounded-full object-cover ${className}`} />;
  return (
    <span aria-hidden="true" style={style} className={`inline-flex flex-none items-center justify-center rounded-full bg-gold-500 font-bold text-navy-900 ${className}`}>
      {initials(name)}
    </span>
  );
}
