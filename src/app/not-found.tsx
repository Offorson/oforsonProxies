import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">404</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink-900">Page not found</h1>
      <p className="mt-3 text-ink-600 max-w-md">
        The page you're looking for moved or never existed. Let's get you back on track.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Back to home
      </Link>
    </div>
  );
}
