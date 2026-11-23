import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { useLostLink } from '../lib/store';

const LEGAL_COPY = {
  privacy: {
    title: 'LostLink Privacy Policy',
    updated: 'DLSAU Campus Portal · RA 10173 Compliant',
    lead: 'LostLink collects only the campus account and item details needed to verify ownership and return lost property at De La Salle Araneta University.',
    sections: [
      {
        heading: '1. Campus-only access & data collected',
        body: 'Registration is restricted to verified @dlsau.edu.ph accounts and DLSAU Student IDs (YYYY-00-XXXXXX) in accordance with the Philippine Data Privacy Act of 2012 (RA 10173). We store your name, campus email, item reports, and private claim proofs.',
      },
      {
        heading: '2. Automatic ID Photo Shield',
        body: 'Photos uploaded under IDs, Cards & Wallets are automatically hidden from the public campus feed. Only authorized DLSAU Security and Discipline Office Admins can inspect shielded photos for verification.',
      },
      {
        heading: '3. Custody records & inquiries',
        body: 'Report logs and ownership proofs are used solely for item matching, intake confirmation, and release at Life Science Building Room 102. For data correction or removal requests, visit LSB Room 102.',
      },
    ],
  },
  terms: {
    title: 'LostLink Campus Terms of Use',
    updated: 'DLSAU Security & Discipline Office · LSB Room 102',
    lead: 'By using LostLink, you agree to handle found property and ownership claims honestly under university custody procedures.',
    sections: [
      {
        heading: '1. Physical turn-in & LL reference tags',
        body: 'Found items logged on LostLink must be physically deposited at Life Science Building Room 102 (Mon–Fri, 8:00 AM–5:00 PM) with their assigned LL reference code for intake confirmation.',
      },
      {
        heading: '2. Claims & in-person verification',
        body: 'Submitting a claim requires at least 20 characters of private ownership proof (such as serial numbers, stickers, or contents) followed by in-person DLSAU ID verification before release.',
      },
      {
        heading: '3. Account integrity',
        body: 'Accounts are limited to active DLSAU students, faculty, and staff. Submitting false reports, spam, or fraudulent claims may result in account deactivation by DO Admins.',
      },
    ],
  },
} as const;

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const { currentUser } = useLostLink();
  const doc = LEGAL_COPY[kind];

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#f6f7f2]">
      <Header variant={currentUser ? 'app' : 'auth'} />

      <main className="mx-auto w-full max-w-[780px] flex-1 px-6 py-10 sm:px-12">
        <article className="grid gap-6 rounded-xl border border-[var(--color-line-strong)] bg-white p-6 sm:p-8">
          <div className="border-b border-[var(--color-line)] pb-4">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-[#0a0a0a] sm:text-[30px]">
              {doc.title}
            </h1>
            <p className="mt-1 font-mono text-xs text-[#1f6b3a]">{doc.updated}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#454545]">{doc.lead}</p>
          </div>

          <div className="grid gap-5">
            {doc.sections.map((section) => (
              <section key={section.heading} className="grid gap-1.5">
                <h2 className="text-[15px] font-semibold text-[#0a0a0a]">{section.heading}</h2>
                <p className="text-[14.5px] leading-relaxed text-[#454545]">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] pt-4">
            <Link
              to={currentUser ? '/feed' : '/login'}
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-[#1f6b3a] underline underline-offset-4"
            >
              Back to LostLink
            </Link>
            <Link
              to={kind === 'privacy' ? '/terms' : '/privacy'}
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-[#454545] underline-offset-4 hover:text-[#0a0a0a] hover:underline"
            >
              {kind === 'privacy' ? 'Read Terms of Use' : 'Read Privacy Policy'}
            </Link>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
