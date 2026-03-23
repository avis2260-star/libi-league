// Server Component — reads ?next= from searchParams (no Suspense needed).
// The interactive form is extracted to LoginForm (Client Component).
import LoginForm from './LoginForm';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams.next ?? '/admin';
  return <LoginForm next={next} />;
}
