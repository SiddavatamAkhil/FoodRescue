export function PageIntro({ title, children, aside }: { title: string; children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1.3fr_0.7fr] md:py-16">
        <div>
          <h1 className="max-w-[22ch] text-3xl font-bold">{title}</h1>
          {children && <div className="mt-4 max-w-[60ch] text-lg text-muted">{children}</div>}
        </div>
        {aside && <div className="md:pt-2">{aside}</div>}
      </div>
    </section>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-prose space-y-4 text-base text-ink-soft [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
      {children}
    </div>
  );
}
