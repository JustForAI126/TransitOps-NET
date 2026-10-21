import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, CheckCircle2, CreditCard, Eye, EyeOff, Mail } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import {
  api,
  PaymentVerification,
  PurchaseProgress,
  PurchaseSession,
  SubscriptionPlan,
} from '../../services/api';

type OnboardingMode = 'purchase' | 'setup';
type PurchaseStep = 'details' | 'verify' | 'plans' | 'paid';

interface RazorpayCheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string };
  handler: (result: RazorpayCheckoutResult) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

const PURCHASE_STORAGE_KEY = 'transitops_purchase_session';
const PENDING_PAYMENT_STORAGE_KEY = 'transitops_pending_payment';

async function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
    const script = existing ?? document.createElement('script');
    const onLoad = () => window.Razorpay
      ? resolve()
      : reject(new Error('Razorpay Checkout loaded without its payment interface.'));
    const onError = () => reject(new Error('Could not load Razorpay Checkout. Check your connection and retry.'));
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.dataset.razorpayCheckout = 'true';
      document.body.appendChild(script);
    }
  });
}

function formatPlanPrice(plan: SubscriptionPlan): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.amountPaise / 100);
}

export const SaasOnboardingView: React.FC<{ initialMode: OnboardingMode }> = ({ initialMode }) => {
  const { setActiveView, login } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [mode] = useState(initialMode);
  const [step, setStep] = useState<PurchaseStep>('details');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState(
    () => new URLSearchParams(window.location.search).get('plan') ?? '',
  );
  const [purchase, setPurchase] = useState<PurchaseSession | null>(null);
  const [pendingPayment, setPendingPayment] = useState<RazorpayCheckoutResult | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [accountToken] = useState(
    new URLSearchParams(window.location.search).get('token') ?? '',
  );
  const [organizationName, setOrganizationName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentVerification | null>(null);
  const cardStyle = isDark
    ? 'border-[#252b36] bg-[#14171e] text-neutral-100'
    : 'border-[#ded7ca] bg-white text-neutral-900';
  const inputStyle = isDark
    ? 'border-[#303746] bg-[#0c0e12] text-neutral-100 placeholder:text-neutral-600'
    : 'border-[#ded7ca] bg-white text-neutral-900 placeholder:text-neutral-500';
  const primaryStyle = isDark
    ? 'bg-[#ccff00] text-black hover:bg-[#bbf000]'
    : 'bg-[#d97706] text-white hover:bg-[#b45309]';

  useEffect(() => {
    let active = true;
    void api.onboarding.getPlans()
      .then(result => {
        if (!active) return;
        setPlans(result);
        const requestedPlanId = new URLSearchParams(window.location.search).get('plan');
        if (requestedPlanId && result.some(plan => plan.id === requestedPlanId))
          setSelectedPlanId(requestedPlanId);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Plans could not be loaded.');
      });

    if (mode === 'purchase') {
      try {
        const saved = sessionStorage.getItem(PURCHASE_STORAGE_KEY);
        if (saved) {
          const savedPurchase = JSON.parse(saved) as PurchaseSession;
          setPurchase(savedPurchase);
          void api.onboarding.getProgress(savedPurchase)
            .then((progress: PurchaseProgress) => {
              if (!active) return;
              setStep(progress.paymentVerified ? 'paid' : progress.emailVerified ? 'plans' : 'verify');
              if (progress.paymentVerified) {
                setPaymentResult({
                  verified: true,
                  receiptEmailSent: progress.receiptEmailSent,
                  setupEmailSent: progress.setupEmailSent,
                  setupCompleted: progress.setupCompleted,
                  message: progress.setupCompleted
                    ? 'Your account is set up. Sign in to continue.'
                    : 'Your verified payment is recorded.',
                });
                try { sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY); } catch {
                  setError('Payment is verified, but temporary payment details could not be cleared from this browser.');
                }
              }
            })
            .catch((requestError: unknown) => {
              if (active) setError(requestError instanceof Error ? requestError.message : 'Purchase progress could not be restored.');
            });
        }
      } catch {
        setError('The saved purchase session could not be read. Start a new onboarding session.');
      }
    }
    return () => { active = false; };
  }, [mode]);

  const begin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      const session = await api.onboarding.begin({ organizationName, fullName, email });
      setPurchase(session);
      sessionStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(session));
      setStep('verify');
      setNotice(session.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not start organization onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!purchase) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await api.onboarding.verifyEmail(purchase, verificationCode);
      setStep('plans');
      setNotice('Email verified. Choose a subscription plan to continue.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Email verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendVerification = async () => {
    if (!purchase) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await api.onboarding.resendVerification(purchase);
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not resend the verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCheckoutPayment = async (result: RazorpayCheckoutResult) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const verified = await api.onboarding.verifyPayment({
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      });
      setPaymentResult(verified);
      setPendingPayment(null);
      setStep('paid');
      setNotice(verified.message);
      try { sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY); } catch {
        setError('Payment was verified, but temporary payment details could not be cleared from this browser.');
      }
    } catch (requestError) {
      setPendingPayment(result);
      setError(requestError instanceof Error
        ? `${requestError.message} Your payment is not considered complete until the server confirms it. Retry verification below.`
        : 'Payment verification failed. Your payment is not considered complete until the server confirms it.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (mode !== 'purchase' || !purchase) return;
    try {
      const savedPayment = sessionStorage.getItem(PENDING_PAYMENT_STORAGE_KEY);
      if (!savedPayment) return;
      const parsedPayment = JSON.parse(savedPayment) as RazorpayCheckoutResult;
      setPendingPayment(parsedPayment);
      void verifyCheckoutPayment(parsedPayment);
    } catch {
      setError('The pending payment verification data is invalid. Contact support with your Razorpay payment reference.');
    }
  }, [mode, purchase]);

  const startCheckout = async (plan: SubscriptionPlan) => {
    if (!purchase) return;
    setError(null);
    setNotice(null);
    setBusyPlanId(plan.id);
    try {
      const order = await api.onboarding.createOrder(purchase, plan.id);
      await loadRazorpayCheckout();
      if (!window.Razorpay) throw new Error('Razorpay Checkout is not available.');
      const checkout = new window.Razorpay({
        key: order.publicKeyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'TransitOps',
        description: `${order.planName} subscription for ${order.termMonths} month(s)`,
        order_id: order.orderId,
        prefill: { name: fullName, email },
        theme: { color: isDark ? '#ccff00' : '#d97706' },
        handler: async result => {
          setPendingPayment(result);
          try { sessionStorage.setItem(PENDING_PAYMENT_STORAGE_KEY, JSON.stringify(result)); } catch {
            setError('Could not save temporary payment verification details in this browser. Keep the Razorpay payment reference.');
          }
          await verifyCheckoutPayment(result);
        },
        modal: {
          ondismiss: () => setNotice('Checkout was closed. No payment is recorded unless Razorpay confirms it. You can retry this order.'),
        },
      });
      checkout.open();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not start Razorpay checkout.');
    } finally {
      setBusyPlanId(null);
    }
  };

  const retryEmailDelivery = async () => {
    if (!purchase) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await api.onboarding.retryEmails(purchase);
      setPaymentResult(result);
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Email delivery retry failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const account = await api.onboarding.completeSetup(accountToken, password);
      try {
        sessionStorage.removeItem(PURCHASE_STORAGE_KEY);
        sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
      } catch {
        setNotice('Account created, but temporary onboarding data could not be cleared from this browser.');
      }
      const loginResult = await login(account.email, password);
      if (loginResult.success) {
        setActiveView('organization_admin');
      } else {
        setNotice(`Account created for ${account.email}. Sign in to open your organization dashboard.`);
        setActiveView('login');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Account setup could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPurchase = () => (
    <>
      <div className="mb-7 flex items-center gap-3">
        <div className={`rounded-xl p-3 ${isDark ? 'bg-[#ccff00]/10 text-[#ccff00]' : 'bg-amber-100 text-amber-800'}`}>
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">Set up your organization</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Verify your email, confirm your plan, then pay securely through Razorpay Checkout Test Mode.</p>
        </div>
      </div>

      {step === 'details' && (
        <form onSubmit={begin} className="space-y-4">
          <label className="block text-sm font-semibold">Organization name
            <input required maxLength={200} minLength={2} value={organizationName} onChange={event => setOrganizationName(event.target.value)}
              className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${inputStyle}`} />
          </label>
          <label className="block text-sm font-semibold">Your full name
            <input required maxLength={200} minLength={2} value={fullName} onChange={event => setFullName(event.target.value)}
              className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${inputStyle}`} />
          </label>
          <label className="block text-sm font-semibold">Organization email
            <input required type="email" maxLength={256} value={email} onChange={event => setEmail(event.target.value)}
              className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${inputStyle}`} />
          </label>
          <button disabled={isSubmitting} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50 ${primaryStyle}`}>
            <Mail className="h-4 w-4" /> {isSubmitting ? 'Sending verification…' : 'Verify email'}
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={verifyEmail} className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Enter the six-digit code sent to <strong>{email}</strong>.</p>
          <label className="block text-sm font-semibold">Verification code
            <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={verificationCode}
              onChange={event => { setError(null); setVerificationCode(event.target.value.replace(/\D/g, '')); }}
              className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-lg tracking-[0.4em] outline-none ${inputStyle}`} />
          </label>
          <button disabled={isSubmitting || !purchase} className={`w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50 ${primaryStyle}`}>
            {isSubmitting ? 'Verifying…' : 'Confirm email'}
          </button>
          <button type="button" disabled={isSubmitting || !purchase} onClick={() => void resendVerification()}
            className="w-full py-2 text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:text-current disabled:opacity-50">
            Resend verification code
          </button>
          <button type="button" onClick={() => setStep('details')} className="w-full py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-current">Use different details</button>
        </form>
      )}

      {step === 'plans' && (
        <>
        {pendingPayment && (
          <button disabled={isSubmitting} onClick={() => void verifyCheckoutPayment(pendingPayment)}
            className={`mb-4 w-full rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50 ${cardStyle}`}>
            {isSubmitting ? 'Verifying payment…' : 'Retry payment verification'}
          </button>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map(plan => (
            <article
              key={plan.id}
              className={`flex flex-col rounded-xl border p-5 ${
                selectedPlanId === plan.id
                  ? isDark ? 'border-[#ccff00] ring-1 ring-[#ccff00]/40' : 'border-amber-500 ring-1 ring-amber-500/30'
                  : ''
              } ${cardStyle}`}
            >
              <h2 className="text-lg font-extrabold">{plan.name}</h2>
              <p className="mt-2 text-2xl font-black">{formatPlanPrice(plan)}</p>
              <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">One-time payment for {plan.termMonths} {plan.termMonths === 1 ? 'month' : 'months'}</p>
              <ul className="my-5 flex-1 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                {plan.features.map(feature => <li key={feature} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />{feature}</li>)}
              </ul>
              <button onClick={() => { setSelectedPlanId(plan.id); void startCheckout(plan); }} disabled={busyPlanId !== null || isSubmitting}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold disabled:opacity-50 ${primaryStyle}`}>
                <CreditCard className="h-4 w-4" /> {busyPlanId === plan.id ? 'Opening checkout…' : 'Continue to secure payment'}
              </button>
            </article>
          ))}
          {plans.length === 0 && <p className="text-sm text-neutral-600 dark:text-neutral-400">No subscription plans are currently available.</p>}
        </div>
        </>
      )}

      {step === 'paid' && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-5 ${cardStyle}`}>
            <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
            <h2 className="text-lg font-bold">Payment verified by TransitOps</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{paymentResult?.message ?? 'Your purchase is recorded.'}</p>
            <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">We never send passwords by email. Use the separate, expiring setup link sent to your verified address.</p>
          </div>
          {pendingPayment && (
            <button disabled={isSubmitting} onClick={() => void verifyCheckoutPayment(pendingPayment)}
              className={`w-full rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50 ${cardStyle}`}>
              {isSubmitting ? 'Verifying payment…' : 'Retry payment verification'}
            </button>
          )}
          {paymentResult && (!paymentResult.receiptEmailSent || !paymentResult.setupCompleted) && (
            <button disabled={isSubmitting} onClick={() => void retryEmailDelivery()}
              className={`w-full rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50 ${cardStyle}`}>
              {isSubmitting ? 'Sending email…' : paymentResult.setupEmailSent ? 'Resend setup link / receipt' : 'Retry receipt and setup email'}
            </button>
          )}
          <button onClick={() => setActiveView('login')} className={`w-full rounded-xl px-4 py-3 text-sm font-bold ${primaryStyle}`}>Go to sign in</button>
        </div>
      )}
    </>
  );

  const renderSetup = () => (
    <form onSubmit={completeSetup} className="space-y-4">
      <div className="mb-6 flex items-center gap-3">
        <div className={`rounded-xl p-3 ${isDark ? 'bg-[#ccff00]/10 text-[#ccff00]' : 'bg-amber-100 text-amber-800'}`}>
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">Create your admin password</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Your setup link is single-use and expires 48 hours after issue.</p>
        </div>
      </div>
      <label className="block text-sm font-semibold">New password
        <div className="relative mt-1">
          <input required minLength={10} maxLength={128} type={showPassword ? 'text' : 'password'} value={password}
            onChange={event => setPassword(event.target.value)}
            className={`w-full rounded-xl border px-3 py-2.5 pr-11 text-sm outline-none ${inputStyle}`} />
          <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}
            className="absolute inset-y-0 right-3 text-neutral-600 dark:text-neutral-400">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        </div>
      </label>
      <label className="block text-sm font-semibold">Confirm password
        <input required minLength={10} maxLength={128} type={showPassword ? 'text' : 'password'} value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
          className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${inputStyle}`} />
      </label>
      <p className="text-xs text-neutral-600 dark:text-neutral-400">Use at least 10 characters, including uppercase, lowercase, a number, and a symbol.</p>
      <button disabled={isSubmitting || !accountToken} className={`w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50 ${primaryStyle}`}>
        {isSubmitting ? 'Creating account…' : 'Create admin account'}
      </button>
    </form>
  );

  return (
    <div className={`min-h-full px-4 py-10 sm:px-8 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
      <div className="mx-auto max-w-5xl">
        <button onClick={() => setActiveView(mode === 'setup' ? 'login' : 'hero')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:text-current">
          <ArrowLeft className="h-4 w-4" /> {mode === 'setup' ? 'Back to sign in' : 'Back to home'}
        </button>
        <section className={`rounded-2xl border p-5 shadow-xl sm:p-8 ${cardStyle}`}>
          {mode === 'purchase' ? renderPurchase() : renderSetup()}
          {error && <div role="alert" className="mt-5 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>}
          {notice && <div role="status" className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div>}
        </section>
      </div>
    </div>
  );
};
