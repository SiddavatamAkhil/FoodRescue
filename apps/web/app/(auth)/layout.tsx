import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { CustodyChain } from "@/components/shared/custody-chain";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,34rem)]">
      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between px-5 sm:px-10">
          <Logo />
          <Link href="/" className="text-sm font-semibold text-muted hover:text-ink">Back to website</Link>
        </header>
        <main id="main" className="flex flex-1 items-start justify-center px-5 pb-16 pt-6 sm:px-10 sm:pt-12">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
      <aside className="hidden border-l border-forest-hover bg-forest px-12 py-16 text-white lg:flex lg:flex-col lg:justify-center">
        <p className="text-sm font-semibold text-mint">Why every step is recorded</p>
        <h2 className="mt-3 max-w-[20ch] text-2xl font-semibold text-white">Food changes hands three times. Each handover is confirmed.</h2>
        <div className="mt-10 rounded-md bg-white/[0.06] p-6 [&_p]:!text-white [&_.text-muted]:!text-white/70">
          <CustodyChain
            compact
            steps={[
              { title: "Donor publishes the listing", detail: "Only verified organisations can publish.", state: "done" },
              { title: "NGO claims it", detail: "One claim per listing, locked instantly.", state: "done" },
              { title: "Volunteer collects it", detail: "Confirmed with the donor's pickup code.", state: "done" },
              { title: "NGO receives it", detail: "Confirmed with the NGO's delivery code.", state: "done" },
            ]}
          />
        </div>
      </aside>
    </div>
  );
}
