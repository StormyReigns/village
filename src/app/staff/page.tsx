import type { Metadata } from 'next';
import { AccountButton } from '@/components/AccountButton';
import { TopBar } from '@/components/Logo';
import { StaffRoom } from '@/components/staff/StaffRoom';

export const metadata: Metadata = { title: 'Staff room', robots: { index: false, follow: false } };

// The Staff room (docs/staff.md): one place for everyone who moderates. Tools, numbers and links on the
// left, the staff chat in the middle, everything that happened across the site on the right. Who may
// see it is decided in the database (is_staff), so this page is only a shell.
export default function StaffPage() {
  return (
    <>
      <TopBar wide actions={<AccountButton quiet dark />}>
        <span className="hidden h-6 w-px bg-white/20 sm:block" aria-hidden="true" />
        <span className="min-w-0 truncate font-bold">Staff room</span>
      </TopBar>
      <StaffRoom />
    </>
  );
}
