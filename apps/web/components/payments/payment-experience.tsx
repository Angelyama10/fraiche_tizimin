'use client';

import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  Package,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import {
  normalizeCheckoutAddress,
  saveCheckoutDraft,
  type CheckoutDeliveryMethod,
  type CheckoutPaymentMethod,
  type CheckoutPaymentProvider,
} from '@/lib/checkout-draft';
import { formatMoney } from '@/lib/format';
import type { Order } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useCart } from '@/providers/cart-provider';
import { useNotify } from '@/providers/notification-provider';

type GatewayConfiguration = {
  mercadoPago: {
    enabled: boolean;
    cardEnabled: boolean;
    linkEnabled: boolean;
    publicKey: string | null;
  };
  stripe: { enabled: boolean; publishableKey: string | null };
};

type PaymentResult = {
  status: string;
  statusDetail?: string | null;
};

type ReopenCheckoutResult = {
  cartToken: string;
  draft: {
    deliveryMethod: CheckoutDeliveryMethod;
    paymentMethod: CheckoutPaymentMethod;
    paymentProvider: CheckoutPaymentProvider;
    address?: Record<string, string | null> | null;
    promotionCode?: string;
    customerNotes?: string;
  };
};

export function PaymentExperience({
  orderToken,
  returningFromStripe = false,
}: {
  orderToken: string;
  returningFromStripe?: boolean;
}) {
  const auth = useAuth();
  const router = useRouter();
  const { adoptCartToken } = useCart();
  const notify = useNotify();
  const [order, setOrder] = useState<Order | null>(null);
  const [configuration, setConfiguration] = useState<GatewayConfiguration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reopeningCheckout, setReopeningCheckout] = useState(false);

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    async function loadPayment() {
      const [initialOrder, nextConfiguration] = await Promise.all([
        auth.request<Order>(`/orders/${orderToken}`),
        apiRequest<GatewayConfiguration>('/payments/configuration', { cache: 'no-store' }),
      ]);
      let nextOrder = initialOrder;
      const provider = activePayment(initialOrder)?.provider;
      if (
        returningFromStripe &&
        provider === 'STRIPE' &&
        initialOrder.paymentStatus !== 'APPROVED'
      ) {
        await auth.request(`/payments/stripe/orders/${orderToken}/sync`, {
          method: 'POST',
        });
        nextOrder = await auth.request<Order>(`/orders/${orderToken}`);
      }
      return { nextOrder, nextConfiguration };
    }

    void loadPayment()
      .then(({ nextOrder, nextConfiguration }) => {
        setOrder(nextOrder);
        setConfiguration(nextConfiguration);
      })
      .catch((requestError) => setError(errorMessage(requestError)));
  }, [auth, orderToken, returningFromStripe]);

  useEffect(() => {
    if (
      auth.status !== 'authenticated' ||
      order?.shippingQuoteStatus !== 'PENDING'
    ) {
      return;
    }

    let cancelled = false;
    const refreshQuote = async () => {
      try {
        const refreshedOrder = await auth.request<Order>(`/orders/${orderToken}`);
        if (!cancelled) {
          setOrder(refreshedOrder);
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) setError(errorMessage(requestError));
      }
    };

    const timer = window.setInterval(() => {
      void refreshQuote();
    }, 4_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [auth, order?.shippingQuoteStatus, orderToken]);

  if (auth.status === 'loading' || (auth.status === 'authenticated' && !order && !error)) {
    return <main className="paymentLoading"><span className="buttonSpinner" /> Preparando pago seguro...</main>;
  }

  if (auth.status === 'anonymous') {
    return (
      <main className="paymentState pageWidth">
        <LockKeyhole size={31} />
        <span className="eyebrow">Sesión protegida</span>
        <h1>Entra para continuar tu pago.</h1>
        <Link className="button button--dark button--large" href={`/cuenta?redirect=/pago/${orderToken}`}>
          Entrar a mi cuenta <ArrowRight size={18} />
        </Link>
      </main>
    );
  }

  if (error || !order || !configuration) {
    return (
      <main className="paymentState pageWidth">
        <CreditCard size={31} />
        <span className="eyebrow">Pago no disponible</span>
        <h1>No pudimos preparar la pasarela.</h1>
        <p>{error ?? 'Intenta nuevamente en unos minutos.'}</p>
        <Link className="button button--outline button--large" href={`/pedidos/${orderToken}`}>
          Volver al pedido
        </Link>
      </main>
    );
  }

  if (order.paymentStatus === 'APPROVED') {
    return (
      <main className="paymentState pageWidth">
        <CheckCircle2 size={34} />
        <span className="eyebrow">Pago confirmado</span>
        <h1>Todo salió perfecto.</h1>
        <Link className="button button--dark button--large" href={`/pedidos/${orderToken}`}>
          Ver mi pedido <ArrowRight size={18} />
        </Link>
      </main>
    );
  }

  if (
    order.paymentStatus === 'REFUNDED' ||
    order.status === 'CANCELLED' ||
    order.status === 'EXPIRED'
  ) {
    return (
      <main className="paymentState pageWidth">
        <ShieldCheck size={34} />
        <span className="eyebrow">Orden cerrada</span>
        <h1>Esta reserva ya no está activa.</h1>
        <p>
          {order.paymentStatus === 'REFUNDED'
            ? 'Si el banco alcanzó a cobrar, la pasarela ya inició el reembolso.'
            : 'El inventario fue liberado. Crea un pedido nuevo para volver a intentarlo.'}
        </p>
        <Link className="button button--dark button--large" href="/productos">
          Volver al catálogo <ArrowRight size={18} />
        </Link>
      </main>
    );
  }

  const provider = order.payments.find((payment) => payment.method === 'CARD')?.provider;
  const currentPayment = activePayment(order);
  const currentProvider =
    currentPayment?.method === 'CARD' ? currentPayment.provider : provider;
  const canEditCheckout =
    order.status === 'PENDING_PAYMENT' &&
    new Date(order.expiresAt).getTime() > Date.now() &&
    !['APPROVED', 'IN_PROCESS', 'REFUNDED', 'CHARGED_BACK'].includes(
      order.paymentStatus,
    );
  const providerAvailable =
    currentProvider === 'MERCADO_PAGO'
      ? configuration.mercadoPago.cardEnabled
      : currentProvider === 'STRIPE'
        ? configuration.stripe.enabled
        : false;

  async function reopenCheckout() {
    if (!canEditCheckout || reopeningCheckout) return;
    setReopeningCheckout(true);
    try {
      const restored = await auth.request<ReopenCheckoutResult>(
        `/orders/${orderToken}/reopen-checkout`,
        { method: 'POST' },
      );
      await adoptCartToken(restored.cartToken);
      saveCheckoutDraft(restored.cartToken, {
        step: 'payment',
        deliveryMethod: restored.draft.deliveryMethod,
        paymentMethod: restored.draft.paymentMethod,
        paymentProvider: restored.draft.paymentProvider,
        addressId: '',
        newAddress: restored.draft.deliveryMethod !== 'STORE_PICKUP',
        address: normalizeCheckoutAddress(restored.draft.address),
        promotionCode: restored.draft.promotionCode ?? '',
        customerNotes: restored.draft.customerNotes ?? '',
      });
      router.push('/carrito?step=payment&restored=1');
    } catch (reopenError) {
      notify({
        title: 'No pudimos regresar a la compra',
        description: errorMessage(reopenError),
        tone: 'error',
      });
      setReopeningCheckout(false);
    }
  }

  return (
    <main className="paymentPage">
      <div className="paymentTopbar pageWidth">
        {canEditCheckout ? (
          <button
            className="paymentTopbar__back"
            disabled={reopeningCheckout}
            onClick={() => {
              void reopenCheckout();
            }}
            type="button"
          >
            {reopeningCheckout ? <span className="buttonSpinner" /> : <ArrowLeft size={16} />}
            {reopeningCheckout ? 'Recuperando compra...' : 'Volver a revisar'}
          </button>
        ) : (
          <Link href={`/pedidos/${orderToken}`}>
            <ArrowLeft size={16} /> Volver al pedido
          </Link>
        )}
        <div>
          <span><LockKeyhole size={14} /> Sesión cifrada</span>
        </div>
      </div>
      <nav aria-label="Progreso de compra" className="paymentFlowProgress pageWidth">
        <span>1. Revisión</span>
        <span>2. Entrega</span>
        <span>3. Método</span>
        <strong aria-current="step">
          {order.shippingQuoteStatus === 'PENDING' ? '4. Cotización' : '4. Pago seguro'}
        </strong>
      </nav>
      <div className="paymentLayout pageWidth">
        <section className="paymentPanel">
          <div className="paymentPanel__intro">
            <span className="eyebrow">
              {order.shippingQuoteStatus === 'PENDING' ? 'Envío nacional' : 'Pago seguro'} · {order.number}
            </span>
            <h1>
              {order.shippingQuoteStatus === 'PENDING'
                ? 'Estamos calculando tu envío.'
                : 'Una última nota para cerrar la compra.'}
            </h1>
            <p>
              {order.shippingQuoteStatus === 'PENDING'
                ? 'La tienda revisará tu destino y añadirá el costo exacto antes de habilitar el pago.'
                : 'Completa tus datos en el formulario protegido de la pasarela.'}
            </p>
          </div>
          <div className="paymentTrust">
            <span><ShieldCheck size={18} /><strong>Protección antifraude</strong></span>
            <span><LockKeyhole size={18} /><strong>Datos tokenizados</strong></span>
            <span><Sparkles size={18} /><strong>Confirmación inmediata</strong></span>
          </div>
          {order.shippingQuoteStatus === 'PENDING' ? (
            <ShippingQuoteWaiting order={order} />
          ) : !providerAvailable ? (
            <div className="paymentUnavailable">
              <CreditCard size={22} />
              <div>
                <strong>Esta pasarela aún no está configurada.</strong>
                <p>La orden quedó guardada. Puedes volver a su seguimiento sin perderla.</p>
              </div>
            </div>
          ) : currentProvider === 'MERCADO_PAGO' && configuration.mercadoPago.publicKey ? (
            <MercadoPagoForm
              key={currentPayment?.id ?? 'mercado-pago'}
              order={order}
              publicKey={configuration.mercadoPago.publicKey}
            />
          ) : currentProvider === 'STRIPE' && configuration.stripe.publishableKey ? (
            <StripeForm
              key={currentPayment?.id ?? 'stripe'}
              order={order}
              publishableKey={configuration.stripe.publishableKey}
            />
          ) : (
            <div className="paymentUnavailable">Pasarela no reconocida.</div>
          )}
        </section>
        <OrderPaymentSummary order={order} provider={currentProvider ?? 'Pasarela'} />
      </div>
    </main>
  );
}

function ShippingQuoteWaiting({ order }: { order: Order }) {
  return (
    <section aria-live="polite" className="shippingQuoteWaiting">
      <div aria-hidden="true" className="shippingQuoteWaiting__visual">
        <Truck size={25} />
        <span className="shippingQuoteWaiting__bottle"><i /></span>
      </div>
      <div>
        <span className="eyebrow">Cotización en proceso</span>
        <h2>Tu pedido está reservado.</h2>
        <p>
          En cuanto la tienda confirme el envío, el total se actualizará aquí
          automáticamente y podrás pagar con el método que elegiste.
        </p>
        <Link href={`/pedidos/${order.publicToken}`}>
          Ver seguimiento <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}

function activePayment(order: Order) {
  return order.payments.find(
    (payment) =>
      !['CANCELLED', 'REFUNDED', 'CHARGED_BACK'].includes(payment.status),
  );
}

function MercadoPagoForm({ order, publicKey }: { order: Order; publicKey: string }) {
  const auth = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initMercadoPago(publicKey, { locale: 'es-MX' });
    setReady(true);
  }, [publicKey]);

  if (!ready) return <div className="paymentFormLoading"><span className="buttonSpinner" /> Cargando Mercado Pago...</div>;

  return (
    <div className="embeddedGateway embeddedGateway--mercadoPago">
      <div className="embeddedGateway__heading">
        <span className="gatewayBadge gatewayBadge--mp">MP</span>
        <div><strong>Mercado Pago</strong><small>Tarjeta de crédito, débito o prepago</small></div>
      </div>
      {error && <p className="paymentFormError">{error}</p>}
      <CardPayment
        initialization={{
          amount: order.totalCents / 100,
        }}
        customization={{
          paymentMethods: {
            maxInstallments: 12,
            types: { included: ['credit_card', 'debit_card', 'prepaid_card'] },
          },
          visual: { style: { theme: 'default' } },
        }}
        locale="es-MX"
        onError={() => setError('Mercado Pago no pudo cargar el formulario. Intenta de nuevo.')}
        onSubmit={async (formData) => {
          setError(null);
          try {
            const result = await auth.request<PaymentResult>(
              `/payments/mercado-pago/orders/${order.publicToken}/card`,
              { method: 'POST', body: JSON.stringify(formData) },
            );
            if (result.status === 'APPROVED') {
              router.replace(`/pago/exito?order=${order.publicToken}`);
              return;
            }
            if (result.status === 'PENDING' || result.status === 'IN_PROCESS') {
              router.replace(`/pago/pendiente?order=${order.publicToken}`);
              return;
            }
            if (result.status === 'REFUNDED') {
              throw new Error(
                'La reserva venció mientras se confirmaba el cargo. El reembolso ya fue iniciado.',
              );
            }
            throw new Error('La tarjeta fue rechazada. Revisa los datos o intenta con otra.');
          } catch (submitError) {
            const message = errorMessage(submitError);
            setError(message);
            throw submitError;
          }
        }}
      />
    </div>
  );
}

function StripeForm({ order, publishableKey }: { order: Order; publishableKey: string }) {
  const auth = useAuth();
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void auth.request<{ clientSecret: string }>(
      `/payments/stripe/orders/${order.publicToken}/intent`,
      { method: 'POST' },
    )
      .then((result) => setClientSecret(result.clientSecret))
      .catch((requestError) => setError(errorMessage(requestError)));
  }, [auth, order.publicToken]);

  if (error) return <p className="paymentFormError">{error}</p>;
  if (!clientSecret) return <div className="paymentFormLoading"><span className="buttonSpinner" /> Preparando Stripe...</div>;

  return (
    <div className="embeddedGateway embeddedGateway--stripe">
      <div className="embeddedGateway__heading">
        <span className="gatewayBadge gatewayBadge--stripe">S</span>
        <div><strong>Stripe</strong><small>Pago internacional con autenticación bancaria</small></div>
      </div>
      <Elements
        options={{
          clientSecret,
          locale: 'es-419',
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#0d4f43',
              colorText: '#11251f',
              colorDanger: '#c84439',
              borderRadius: '7px',
              fontFamily: 'Manrope, sans-serif',
              spacingUnit: '4px',
            },
          },
        }}
        stripe={stripePromise}
      >
        <StripePaymentForm order={order} />
      </Elements>
    </div>
  );
}

function StripePaymentForm({ order }: { order: Order }) {
  const auth = useAuth();
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const [elementReady, setElementReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || !elementReady || submitting) {
      setError('El formulario seguro de Stripe todavía no está disponible.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/pago/${order.publicToken}?stripe_return=1`,
        },
        redirect: 'if_required',
      });
      if (result.error) {
        setError(result.error.message ?? 'Stripe no pudo completar el pago.');
        setSubmitting(false);
        return;
      }
      const synced = await auth.request<PaymentResult>(
        `/payments/stripe/orders/${order.publicToken}/sync`,
        { method: 'POST' },
      );
      if (synced.status === 'REFUNDED') {
        setError(
          'La reserva venció mientras se confirmaba el cargo. El reembolso ya fue iniciado.',
        );
        setSubmitting(false);
        return;
      }
      router.replace(
        synced.status === 'APPROVED'
          ? `/pago/exito?order=${order.publicToken}`
          : `/pago/pendiente?order=${order.publicToken}`,
      );
    } catch (syncError) {
      setError(errorMessage(syncError));
      setSubmitting(false);
    }
  }

  return (
    <form className="stripePaymentForm" onSubmit={submit}>
      <PaymentElement
        onLoadError={(loadError) => {
          setElementReady(false);
          setError(
            loadError.error.message ??
              'Stripe no pudo cargar el formulario. Verifica las claves de producción.',
          );
        }}
        onReady={() => {
          setElementReady(true);
          setError(null);
        }}
        options={{ layout: 'accordion' }}
      />
      {error && <p className="paymentFormError">{error}</p>}
      <button
        className="button button--dark button--large button--wide"
        disabled={!stripe || !elements || !elementReady || submitting}
        type="submit"
      >
        {submitting || !elementReady ? (
          <span className="buttonSpinner" />
        ) : (
          <>Pagar {formatMoney(order.totalCents, order.currency)} <ArrowRight size={18} /></>
        )}
      </button>
    </form>
  );
}

function OrderPaymentSummary({ order, provider }: { order: Order; provider: string }) {
  return (
    <aside className="paymentSummary">
      <span className="eyebrow">Tu pedido</span>
      <h2>{order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}</h2>
      <div className="paymentSummary__items">
        {order.items.map((item) => (
          <article key={item.id}>
            <div>
              {item.imageUrl ? (
                <Image alt={item.productName} fill sizes="58px" src={item.imageUrl} unoptimized />
              ) : (
                <Package size={18} />
              )}
            </div>
            <span><strong>{item.productName}</strong><small>{item.variantName} · {item.quantity}</small></span>
            <b>{formatMoney(item.lineTotalCents, order.currency)}</b>
          </article>
        ))}
      </div>
      <div className="paymentSummary__totals">
        <span><small>Subtotal</small><strong>{formatMoney(order.subtotalCents, order.currency)}</strong></span>
        {order.discountCents > 0 && <span><small>Descuento</small><strong>− {formatMoney(order.discountCents, order.currency)}</strong></span>}
        <span>
          <small>Envío</small>
          <strong>
            {order.shippingQuoteStatus === 'PENDING'
              ? 'Por cotizar'
              : formatMoney(order.shippingCents, order.currency)}
          </strong>
        </span>
        <span><small>Total</small><strong>{formatMoney(order.totalCents, order.currency)}</strong></span>
      </div>
      <p><ShieldCheck size={15} /> Procesado por {provider === 'MERCADO_PAGO' ? 'Mercado Pago' : provider === 'STRIPE' ? 'Stripe' : provider}</p>
    </aside>
  );
}
