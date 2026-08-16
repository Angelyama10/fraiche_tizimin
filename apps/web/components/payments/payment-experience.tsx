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
  Check,
  CheckCircle2,
  CreditCard,
  Landmark,
  Link2,
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
  const [continuingPayment, setContinuingPayment] = useState(false);
  const [continuationError, setContinuationError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<Exclude<CheckoutPaymentMethod, 'CASH'>>('CARD');
  const [selectedPaymentProvider, setSelectedPaymentProvider] =
    useState<CheckoutPaymentProvider>('MERCADO_PAGO');
  const [selectingPayment, setSelectingPayment] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);

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

  useEffect(() => {
    if (
      configuration &&
      !configuration.mercadoPago.cardEnabled &&
      configuration.stripe.enabled
    ) {
      setSelectedPaymentProvider('STRIPE');
    }
  }, [configuration]);

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
  const waitingForShippingQuote = order.shippingQuoteStatus === 'PENDING';
  const paymentSelectionRequired =
    !waitingForShippingQuote && order.paymentMethod === null;
  const summaryProvider = !order.paymentMethod
    ? null
    : order.paymentMethod === 'PAYMENT_LINK'
      ? 'MERCADO_PAGO'
      : order.paymentMethod === 'BANK_TRANSFER'
        ? 'BANK_TRANSFER'
        : currentProvider ?? 'Pasarela';
  const canEditCheckout =
    order.status === 'PENDING_PAYMENT' &&
    new Date(order.expiresAt).getTime() > Date.now() &&
    !['APPROVED', 'IN_PROCESS', 'REFUNDED', 'CHARGED_BACK'].includes(
      order.paymentStatus,
    );
  const providerAvailable = !order.paymentMethod
    ? false
    : order.paymentMethod === 'PAYMENT_LINK'
      ? configuration.mercadoPago.linkEnabled
      : order.paymentMethod === 'BANK_TRANSFER'
        ? true
        : currentProvider === 'MERCADO_PAGO'
          ? configuration.mercadoPago.cardEnabled
          : currentProvider === 'STRIPE'
            ? configuration.stripe.enabled
            : false;
  const selectedPaymentAvailable =
    selectedPaymentMethod === 'PAYMENT_LINK'
      ? configuration.mercadoPago.linkEnabled
      : selectedPaymentMethod === 'CARD'
        ? selectedPaymentProvider === 'MERCADO_PAGO'
          ? configuration.mercadoPago.cardEnabled
          : configuration.stripe.enabled
        : true;
  const paymentEyebrow = waitingForShippingQuote
    ? deliveryMethodLabel(order.deliveryMethod)
    : paymentSelectionRequired
      ? 'Envío confirmado'
      : paymentMethodLabel(order.paymentMethod ?? 'CARD', currentProvider);
  const paymentTitle = waitingForShippingQuote
    ? 'Estamos cotizando tu entrega.'
    : paymentSelectionRequired
      ? 'Elige cómo pagar tu total.'
    : order.paymentMethod === 'BANK_TRANSFER'
      ? 'Tu total está listo para transferir.'
      : order.paymentMethod === 'PAYMENT_LINK'
        ? 'Tu total está listo para pagar.'
        : 'Completa tu pago seguro.';
  const paymentDescription = waitingForShippingQuote
    ? 'La tienda revisará tu destino y añadirá el costo exacto antes de habilitar el pago.'
    : paymentSelectionRequired
      ? 'El costo de entrega ya está incluido. Ahora selecciona una opción para abrir la pasarela correspondiente.'
    : order.paymentMethod === 'BANK_TRANSFER'
      ? 'Consulta los datos bancarios y sube tu comprobante desde el seguimiento del pedido.'
      : order.paymentMethod === 'PAYMENT_LINK'
        ? 'Abre Mercado Pago para completar el importe final de tu pedido.'
        : 'Captura tus datos directamente en el formulario protegido de la pasarela.';

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

  async function continueSelectedPayment() {
    if (continuingPayment) return;
    const selectedPaymentMethod = order?.paymentMethod;
    if (!selectedPaymentMethod) return;
    setContinuingPayment(true);
    setContinuationError(null);
    try {
      if (selectedPaymentMethod === 'PAYMENT_LINK') {
        const preference = await auth.request<{ checkoutUrl: string }>(
          `/payments/mercado-pago/orders/${orderToken}/preference`,
          { method: 'POST' },
        );
        window.location.assign(preference.checkoutUrl);
        return;
      }
      if (selectedPaymentMethod === 'BANK_TRANSFER') {
        router.push(`/pedidos/${orderToken}?transferencia=1`);
      }
    } catch (continueError) {
      setContinuationError(errorMessage(continueError));
    } finally {
      setContinuingPayment(false);
    }
  }

  async function confirmPaymentMethod() {
    if (selectingPayment || !selectedPaymentAvailable) return;
    setSelectingPayment(true);
    setSelectionError(null);
    try {
      const updated = await auth.request<Order>(
        `/orders/${orderToken}/payment-method`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            paymentMethod: selectedPaymentMethod,
            paymentProvider:
              selectedPaymentMethod === 'CARD'
                ? selectedPaymentProvider
                : undefined,
          }),
        },
      );
      setOrder(updated);
    } catch (selectError) {
      setSelectionError(errorMessage(selectError));
    } finally {
      setSelectingPayment(false);
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
        <span>3. Solicitud</span>
        <strong aria-current="step">
          {waitingForShippingQuote ? '4. Cotización' : '4. Pago'}
        </strong>
      </nav>
      <div className="paymentLayout pageWidth">
        <section className="paymentPanel">
          <div className="paymentPanel__intro">
            <span className="eyebrow">
              {paymentEyebrow} · {order.number}
            </span>
            <h1>{paymentTitle}</h1>
            <p>{paymentDescription}</p>
          </div>
          <div className="paymentTrust">
            <span><ShieldCheck size={18} /><strong>Protección antifraude</strong></span>
            <span><LockKeyhole size={18} /><strong>Datos tokenizados</strong></span>
            <span><Sparkles size={18} /><strong>Confirmación inmediata</strong></span>
          </div>
          {waitingForShippingQuote ? (
            <ShippingQuoteWaiting order={order} />
          ) : paymentSelectionRequired ? (
            <PostQuotePaymentSelector
              configuration={configuration}
              error={selectionError}
              loading={selectingPayment}
              method={selectedPaymentMethod}
              onConfirm={() => {
                void confirmPaymentMethod();
              }}
              onMethodChange={setSelectedPaymentMethod}
              onProviderChange={setSelectedPaymentProvider}
              provider={selectedPaymentProvider}
            />
          ) : !providerAvailable ? (
            <div className="paymentUnavailable">
              <CreditCard size={22} />
              <div>
                <strong>Esta pasarela aún no está configurada.</strong>
                <p>La orden quedó guardada. Puedes volver a su seguimiento sin perderla.</p>
              </div>
            </div>
          ) : order.paymentMethod === 'PAYMENT_LINK' || order.paymentMethod === 'BANK_TRANSFER' ? (
            <PaymentContinuation
              error={continuationError}
              loading={continuingPayment}
              method={order.paymentMethod as 'PAYMENT_LINK' | 'BANK_TRANSFER'}
              onContinue={() => {
                void continueSelectedPayment();
              }}
            />
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
        <OrderPaymentSummary order={order} provider={summaryProvider} />
      </div>
    </main>
  );
}

function PostQuotePaymentSelector({
  configuration,
  error,
  loading,
  method,
  onConfirm,
  onMethodChange,
  onProviderChange,
  provider,
}: {
  configuration: GatewayConfiguration;
  error: string | null;
  loading: boolean;
  method: Exclude<CheckoutPaymentMethod, 'CASH'>;
  onConfirm: () => void;
  onMethodChange: (method: Exclude<CheckoutPaymentMethod, 'CASH'>) => void;
  onProviderChange: (provider: CheckoutPaymentProvider) => void;
  provider: CheckoutPaymentProvider;
}) {
  const cardAvailable =
    configuration.mercadoPago.cardEnabled || configuration.stripe.enabled;
  const available =
    method === 'PAYMENT_LINK'
      ? configuration.mercadoPago.linkEnabled
      : method === 'CARD'
        ? provider === 'MERCADO_PAGO'
          ? configuration.mercadoPago.cardEnabled
          : configuration.stripe.enabled
        : true;
  const options = [
    {
      id: 'CARD' as const,
      title: 'Tarjeta en línea',
      note: 'Crédito o débito en formulario protegido',
      icon: CreditCard,
      disabled: !cardAvailable,
    },
    {
      id: 'PAYMENT_LINK' as const,
      title: 'Link de Mercado Pago',
      note: 'Continúa en Mercado Pago',
      icon: Link2,
      disabled: !configuration.mercadoPago.linkEnabled,
    },
    {
      id: 'BANK_TRANSFER' as const,
      title: 'Transferencia',
      note: 'Consulta los datos y sube tu comprobante',
      icon: Landmark,
      disabled: false,
    },
  ];

  return (
    <section className="postQuotePaymentSelector">
      <div className="postQuotePaymentSelector__status">
        <CheckCircle2 aria-hidden="true" size={18} />
        <span>
          <strong>Envío confirmado</strong>
          <small>El total mostrado ya incluye la entrega.</small>
        </span>
      </div>
      <div className="postQuotePaymentSelector__methods">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              className={method === option.id ? 'isActive' : ''}
              disabled={option.disabled}
              key={option.id}
              onClick={() => onMethodChange(option.id)}
              type="button"
            >
              <Icon aria-hidden="true" size={19} />
              <span>
                <strong>{option.title}</strong>
                <small>{option.disabled ? 'Temporalmente no disponible' : option.note}</small>
              </span>
              {method === option.id && <Check aria-hidden="true" size={15} />}
            </button>
          );
        })}
      </div>
      {method === 'CARD' && (
        <div aria-label="Selecciona la pasarela" className="postQuoteGatewaySelector">
          <button
            className={provider === 'MERCADO_PAGO' ? 'isActive' : ''}
            disabled={!configuration.mercadoPago.cardEnabled}
            onClick={() => onProviderChange('MERCADO_PAGO')}
            type="button"
          >
            <span className="gatewayBadge gatewayBadge--mp">MP</span>
            <span><strong>Mercado Pago</strong><small>Tarjetas nacionales</small></span>
            {provider === 'MERCADO_PAGO' && <Check size={14} />}
          </button>
          <button
            className={provider === 'STRIPE' ? 'isActive' : ''}
            disabled={!configuration.stripe.enabled}
            onClick={() => onProviderChange('STRIPE')}
            type="button"
          >
            <span className="gatewayBadge gatewayBadge--stripe">S</span>
            <span><strong>Stripe</strong><small>Tarjetas y autenticación bancaria</small></span>
            {provider === 'STRIPE' && <Check size={14} />}
          </button>
        </div>
      )}
      {error && <p className="paymentFormError">{error}</p>}
      <button
        className="button button--dark button--large button--wide"
        disabled={!available || loading}
        onClick={onConfirm}
        type="button"
      >
        {loading ? (
          <span className="buttonSpinner" />
        ) : (
          <>Continuar con esta forma de pago <ArrowRight size={18} /></>
        )}
      </button>
      <p className="postQuotePaymentSelector__note">
        <LockKeyhole size={14} /> La pasarela se abrirá únicamente después de confirmar esta selección.
      </p>
    </section>
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
          automáticamente y podrás elegir cómo pagar.
        </p>
        <Link href={`/pedidos/${order.publicToken}`}>
          Ver seguimiento <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}

function PaymentContinuation({
  method,
  loading,
  error,
  onContinue,
}: {
  method: 'PAYMENT_LINK' | 'BANK_TRANSFER';
  loading: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const Icon = method === 'PAYMENT_LINK' ? Link2 : Landmark;
  const title =
    method === 'PAYMENT_LINK'
      ? 'Tu enlace de Mercado Pago ya puede abrirse.'
      : 'Ya puedes continuar con la transferencia.';
  const action =
    method === 'PAYMENT_LINK' ? 'Abrir Mercado Pago' : 'Ver datos para transferir';

  return (
    <section className="paymentContinuation">
      <div className="paymentContinuation__heading">
        <span><Icon aria-hidden="true" size={22} /></span>
        <div>
          <span className="eyebrow">Envío confirmado</span>
          <h2>{title}</h2>
        </div>
      </div>
      <p>El costo del envío ya está incluido en el total de tu pedido.</p>
      {error && <p className="paymentFormError">{error}</p>}
      <button
        className="button button--dark button--large button--wide"
        disabled={loading}
        onClick={onContinue}
        type="button"
      >
        {loading ? <span className="buttonSpinner" /> : <>{action} <ArrowRight size={18} /></>}
      </button>
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

function OrderPaymentSummary({ order, provider }: { order: Order; provider: string | null }) {
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
      <p>
        <ShieldCheck size={15} />{' '}
        {provider
          ? `Procesado por ${providerLabel(provider)}`
          : order.shippingQuoteStatus === 'PENDING'
            ? 'El pago se habilita al confirmar la entrega'
            : 'Elige una forma de pago para continuar'}
      </p>
    </aside>
  );
}

function providerLabel(provider: string) {
  if (provider === 'MERCADO_PAGO') return 'Mercado Pago';
  if (provider === 'STRIPE') return 'Stripe';
  if (provider === 'BANK_TRANSFER') return 'transferencia bancaria';
  return provider;
}

function deliveryMethodLabel(method: string) {
  if (method === 'LOCAL_DELIVERY') return 'Entrega local';
  if (method === 'STORE_PICKUP') return 'Recoger en tienda';
  return 'Envío nacional';
}

function paymentMethodLabel(method: string, provider?: string) {
  if (method === 'BANK_TRANSFER') return 'Transferencia bancaria';
  if (method === 'PAYMENT_LINK') return 'Link de Mercado Pago';
  if (method === 'CASH') return 'Pago en tienda';
  return provider === 'STRIPE' ? 'Pago con Stripe' : 'Pago con Mercado Pago';
}
