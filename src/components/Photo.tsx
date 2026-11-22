/**
 * A site photo in two WebP sizes (640 and 1280 px wide); phones download the small one.
 * `src` is the path without size or extension, e.g. "/photos/photo-0058".
 */
export function Photo({
  src,
  alt,
  sizes = "100vw",
  className,
  priority,
}: {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={`${src}-1280.webp`}
      srcSet={`${src}-640.webp 640w, ${src}-1280.webp 1280w`}
      sizes={sizes}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
