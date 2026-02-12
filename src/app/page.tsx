export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-12 sm:px-10">
      <div className="pointer-events-none absolute -top-40 right-10 h-96 w-96 rounded-full bg-[radial-gradient(circle,#f9cf9d_0%,transparent_65%)] opacity-70" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,#d96b4a_0%,transparent_70%)] opacity-40" />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="rounded-3xl border border-white/60 bg-white/70 p-10 shadow-[var(--shadow)] backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">
            Best CA Shop
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
            Cheap Booking
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
            Redeem your code to start your booking request. Provide your details
            and chat with our team to confirm your stay.
          </p>
        </header>

        <section className="grid gap-6">
          <a
            href="/redeem"
            className="group flex flex-col gap-6 rounded-3xl border border-white/70 bg-[var(--surface-strong)] p-8 shadow-[var(--shadow)] transition hover:-translate-y-1"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Redeem your code</h2>
              <span className="rounded-full border border-[var(--accent-deep)] px-4 py-1 text-sm text-[var(--accent-deep)]">
                Customer
              </span>
            </div>
            <p className="text-[var(--muted)]">
              Enter your redemption code, share booking details, and open a live
              chat with our team.
            </p>
            <div className="text-sm font-semibold text-[var(--accent-deep)]">
              Start redemption
            </div>
          </a>
        </section>
      </main>
    </div>
  );
}
