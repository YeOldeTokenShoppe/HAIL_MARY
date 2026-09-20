import { notFound } from 'next/navigation';
import { IS_DEV } from '@/lib/ltTv/devOnly.mjs';
import Studio from './Studio';

// Reads the working tree on every request, so it must never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = { title: 'LT TV studio' };

export default function LtTvStudioPage() {
  // Not a password, an absence: the studio reads this checkout and runs
  // pipeline steps on this machine, neither of which means anything on a
  // deployed server. So it simply is not there outside development.
  if (!IS_DEV()) notFound();
  return <Studio />;
}
