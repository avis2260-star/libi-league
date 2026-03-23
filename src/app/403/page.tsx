import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="text-5xl">🚫</span>
      <h1 className="text-2xl font-bold">Access Denied</h1>
      <p className="text-gray-500">
        Your account is not authorised to access the admin area.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-orange-500 px-6 py-2.5 font-semibold text-white hover:bg-orange-600"
      >
        Go to site
      </Link>
    </div>
  );
}
