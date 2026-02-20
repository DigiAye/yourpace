import { redirect } from 'next/navigation';

// Root page — redirect to signin (auth will handle redirecting to dashboard if authenticated)
export default function Home() {
  redirect('/signin');
}
// Amplify CI/CD test build - Fri Feb 20 18:39:56 GMT 2026
# Test webhook trigger
# Final test
# Webhook test with new app
# Test build trigger
