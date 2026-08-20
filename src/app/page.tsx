import { Dashboard } from '@/components/dashboard/dashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SmartSchool AI — School Assistant',
  description: 'Standalone intelligent school assistant handling attendance, parent-teacher escalations, and principal reports.',
};

export default function Home() {
  return (
    <main className="w-full h-screen overflow-hidden bg-zinc-950">
      <Dashboard />
    </main>
  );
}
