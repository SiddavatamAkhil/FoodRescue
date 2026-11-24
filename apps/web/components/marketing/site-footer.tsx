import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const groups = [
  { title: "Product", links: [{ href: "/how-it-works", label: "How it works" }, { href: "/for-restaurants", label: "For restaurants" }, { href: "/for-ngos", label: "For NGOs" }, { href: "/signup?type=VOLUNTEER", label: "Volunteer" }] },
  { title: "Organisation", links: [{ href: "/about", label: "About us" }, { href: "/impact", label: "Our impact" }, { href: "/contact", label: "Contact" }] },
  { title: "Policies", links: [{ href: "/privacy", label: "Privacy policy" }, { href: "/terms", label: "Terms of service" }, { href: "/how-it-works#food-safety", label: "Food safety rules" }] },
];

export function SiteFooter() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm text-muted">
            A food rescue and redistribution network for food businesses, NGOs and volunteers, starting in Andhra Pradesh.
          </p>
          {email && (
            <p className="mt-3 text-sm"><a className="link" href={`mailto:${email}`}>{email}</a></p>
          )}
        </div>
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-sm font-semibold">{g.title}</h2>
            <ul className="mt-3 space-y-2">
              {g.links.map((l) => (
                <li key={l.href}><Link href={l.href} className="text-sm text-muted hover:text-ink">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} FoodRescue</p>
          <p>Map data © OpenStreetMap contributors</p>
        </div>
      </div>
    </footer>
  );
}
