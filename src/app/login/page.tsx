// Server Component — reads ?next= from searchParams (no Suspense needed).
// The interactive form is extracted to LoginForm (Client Component).
import LoginForm from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? '/admin';
  return <LoginForm next={next} />;
}
