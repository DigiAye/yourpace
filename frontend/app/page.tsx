import { redirect } from 'next/navigation';

// Root page — redirect to signin (auth will handle redirecting to dashboard if authenticated)
export default function Home() {
  redirect('/signin');
}
