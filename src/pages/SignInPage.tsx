import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Field, Wordmark, inputClass } from '../components/ui';
import { AppError, friendlyMessage, signIn } from '../lib/api';

export default function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) {
      setError('BAD_CREDENTIALS');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
      setAuthenticated(true);
      navigate('/dashboard', { replace: true });
    } catch (caught) {
      setError(caught instanceof AppError ? caught.code : 'UNKNOWN');
      setSubmitting(false);
    }
  }

  if (authenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-baby px-6 py-5 sm:px-10">
        <Link to="/">
          <Wordmark className="text-2xl" />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mx-auto mb-6 h-px w-16 bg-gold/70" />
          <h1 className="text-center font-display text-4xl">Staff sign in</h1>
          <p className="mt-3 text-center text-[13px] leading-relaxed text-charcoal">
            For the team at {`hun.`} — the order queue and payment verification
            live behind here.
          </p>

          {/* The seeded demo account is only advertised while developing —
              a deployed build must not hand out staff credentials. */}
          {import.meta.env.DEV && (
            <div className="mt-6 rounded-2xl border border-baby bg-blush/60 px-4 py-3 text-[12px] leading-relaxed text-charcoal">
              <span className="text-[10px] uppercase tracking-[0.18em] text-gold">
                Demo access (local only)
              </span>
              <br />
              owner@hun.test · hun-demo-2026
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <Field label="Email">
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@hun.cafe"
                autoComplete="username"
                required
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose/50 bg-blush px-4 py-3 text-sm text-ink"
              >
                {friendlyMessage(error)}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-ink px-6 py-4 text-sm font-medium text-paper transition hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-charcoal/80">
            Guests never need an account —{' '}
            <Link to="/menu" className="underline underline-offset-2 hover:text-ink">
              order from the menu
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
