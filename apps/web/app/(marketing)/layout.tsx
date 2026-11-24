import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingLangProvider } from "@/lib/marketing-i18n";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingLangProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </MarketingLangProvider>
  );
}
