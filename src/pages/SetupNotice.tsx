import { Wordmark } from '../components/ui';

/**
 * Rendered instead of any data screen when the Supabase environment variables
 * are absent. It deliberately offers no fake menu: the app would rather say
 * plainly what is missing than pretend to work.
 */
export default function SetupNotice() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-baby px-6 py-5 sm:px-10">
        <Wordmark className="text-2xl" />
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <p className="text-xs uppercase tracking-[0.24em] text-charcoal">
          Setup required
        </p>
        <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
          The app is built. It needs its database.
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-charcoal">
          This build has no Supabase credentials, so nothing is served rather than
          anything being faked. Four steps connect the café, its menu and its
          Telebirr / CBE payment flow:
        </p>

        <ol className="mt-10 space-y-8">
          {[
            {
              step: '01',
              title: 'Create a Supabase project',
              body: 'supabase.com → New project. Note the project URL and the publishable anon key.',
            },
            {
              step: '02',
              title: 'Run the migrations',
              body: 'In the SQL Editor, run 0001_schema.sql, 0002_functions.sql, 0003_payments.sql, 0004_seed.sql and finally 0005_management.sql — in that order. Or use `supabase db reset` locally. They create the tables, row-level security, the order and payment functions, the dashboard menu functions, and the Birr menu.',
            },
            {
              step: '03',
              title: 'Add the environment variables',
              body: 'Copy .env.example to .env.local and paste in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Only the publishable key — never the service-role key.',
            },
            {
              step: '04',
              title: 'Restart and sign in',
              body: 'Restart the dev server, then open /signin. The seeded owner account is listed in the README; replace it before deploying.',
            },
          ].map((item) => (
            <li key={item.step} className="flex gap-5 border-t border-baby pt-6">
              <span className="font-mono text-xs text-rose">{item.step}</span>
              <div>
                <h2 className="font-display text-xl">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-charcoal">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 rounded-2xl bg-blush p-6">
          <p className="text-sm leading-relaxed text-ink">
            Every table carries row-level security, all writes go through server-side
            functions, and the browser only ever holds the publishable anon key.
          </p>
        </div>
      </main>
    </div>
  );
}
