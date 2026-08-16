'use client';

import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  CreditCard,
  Landmark,
  Link2,
  LockKeyhole,
  MapPin,
  PackageCheck,
  Plus,
  ShoppingBag,
  Store,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  BankTransferDetails,
  type PaymentInstruction,
} from '@/components/payments/bank-transfer-details';
import { ProductMediaPlaceholder } from '@/components/store/product-media-placeholder';
import { apiRequest, errorMessage } from '@/lib/api';
import {
  clearCheckoutDraft,
  emptyCheckoutAddress,
  loadCheckoutDraft,
  saveCheckoutDraft,
  type CheckoutAddressDraft,
  type CheckoutDeliveryMethod,
  type CheckoutDraft,
  type CheckoutPaymentMethod,
  type CheckoutPaymentProvider,
  type CheckoutStep,
} from '@/lib/checkout-draft';
import { formatMoney } from '@/lib/format';
import {
  shippingAddressIssue,
  toShippingAddressPayload,
} from '@/lib/shipping-address';
import type { CustomerAddress, Order } from '@/lib/types';
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

const payments: Array<{
  id: CheckoutPaymentMethod;
  title: string;
  note: string;
  icon: LucideIcon;
}> = [
  { id: 'CARD', title: 'Tarjeta en línea', note: 'Sin salir de KI’IBOK', icon: CreditCard },
  { id: 'PAYMENT_LINK', title: 'Link de pago', note: 'Abrir Mercado Pago', icon: Link2 },
  { id: 'BANK_TRANSFER', title: 'Transferencia', note: 'Sube tu comprobante', icon: Landmark },
  { id: 'CASH', title: 'Efectivo', note: 'Al recoger', icon: Banknote },
];

const paymentFlowSteps: Array<{ id: CheckoutStep; label: string; shortLabel: string }> = [
  { id: 'review', label: 'Revisa tu compra', shortLabel: 'Revisión' },
  { id: 'delivery', label: 'Elige la entrega', shortLabel: 'Entrega' },
  { id: 'payment', label: 'Define cómo pagar', shortLabel: 'Método' },
];

const quoteFlowSteps: Array<{ id: CheckoutStep; label: string; shortLabel: string }> = [
  { id: 'review', label: 'Revisa tu compra', shortLabel: 'Revisión' },
  { id: 'delivery', label: 'Elige la entrega', shortLabel: 'Entrega' },
  { id: 'payment', label: 'Solicita la cotización', shortLabel: 'Cotización' },
];

export function CheckoutExperience() {
  const router = useRouter();
  const auth = useAuth();
  const { cart, loading: cartLoading, mutating, updateItem, removeItem, resetCart } =
    useCart();
  const notify = useNotify();
  const initializedCart = useRef<string | null>(null);
  const submittingOrder = useRef(false);
  const orderIdempotencyKey = useRef<string | null>(null);
  const [step, setStep] = useState<CheckoutStep>('review');
  const [draftReady, setDraftReady] = useState(false);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressId, setAddressId] = useState('');
  const [newAddress, setNewAddress] = useState(false);
  const [address, setAddress] = useState<CheckoutAddressDraft>(emptyCheckoutAddress);
  const [deliveryMethod, setDeliveryMethod] =
    useState<CheckoutDeliveryMethod>('SHIPPING');
  const [paymentMethod, setPaymentMethod] =
    useState<CheckoutPaymentMethod>('CARD');
  const [paymentProvider, setPaymentProvider] =
    useState<CheckoutPaymentProvider>('MERCADO_PAGO');
  const [gatewayConfiguration, setGatewayConfiguration] =
    useState<GatewayConfiguration | null>(null);
  const [promotionCode, setPromotionCode] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [instruction, setInstruction] = useState<PaymentInstruction | null>(null);
  const [placing, setPlacing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    void auth
      .request<CustomerAddress[]>('/customers/me/addresses')
      .then((items) => {
        setAddresses(items);
        const preferred = items.find((item) => item.isDefault) ?? items[0];
        if (preferred) {
          setAddressId((current) => current || preferred.id);
        } else {
          setNewAddress(true);
        }
      })
      .catch(() => undefined);
  }, [auth]);

  useEffect(() => {
    setAddress((current) => ({
      ...current,
      recipientName:
        current.recipientName ||
        [auth.customer?.firstName, auth.customer?.lastName].filter(Boolean).join(' '),
      phone: current.phone || auth.customer?.phone || '',
    }));
  }, [auth.customer?.firstName, auth.customer?.lastName, auth.customer?.phone]);

  useEffect(() => {
    if (paymentMethod !== 'BANK_TRANSFER' && paymentMethod !== 'CASH') {
      setInstruction(null);
      return;
    }
    void apiRequest<PaymentInstruction>(`/payments/instructions/${paymentMethod}`, {
      cache: 'no-store',
    })
      .then(setInstruction)
      .catch(() => setInstruction(null));
  }, [paymentMethod]);

  useEffect(() => {
    void apiRequest<GatewayConfiguration>('/payments/configuration', {
      cache: 'no-store',
    })
      .then((configuration) => {
        setGatewayConfiguration(configuration);
        if (!configuration.mercadoPago.cardEnabled && configuration.stripe.enabled) {
          setPaymentProvider('STRIPE');
        }
      })
      .catch(() => setGatewayConfiguration(null));
  }, []);

  useEffect(() => {
    if (paymentMethod === 'CASH') setDeliveryMethod('STORE_PICKUP');
  }, [paymentMethod]);

  useEffect(() => {
    const cartToken = cart?.publicToken;
    if (!cartToken || initializedCart.current === cartToken) return;
    initializedCart.current = cartToken;
    submittingOrder.current = false;
    orderIdempotencyKey.current = null;
    setDraftReady(false);
    const saved = loadCheckoutDraft(cartToken);
    const requestedStep = readStepFromUrl();
    if (saved) {
      setDeliveryMethod(saved.deliveryMethod);
      setPaymentMethod(saved.paymentMethod);
      setPaymentProvider(saved.paymentProvider);
      setAddressId(saved.addressId);
      setNewAddress(saved.newAddress);
      setAddress(saved.address);
      setPromotionCode(saved.promotionCode);
      setCustomerNotes(saved.customerNotes);
      setStep(requestedStep ?? saved.step);
    } else {
      setStep(requestedStep ?? 'review');
    }
    setDraftReady(true);
  }, [cart?.publicToken]);

  useEffect(() => {
    const cartToken = cart?.publicToken;
    if (!cartToken || !draftReady) return;
    saveCheckoutDraft(cartToken, {
      step,
      deliveryMethod,
      paymentMethod,
      paymentProvider,
      addressId,
      newAddress,
      address,
      promotionCode,
      customerNotes,
    });
  }, [
    address,
    addressId,
    cart?.publicToken,
    customerNotes,
    deliveryMethod,
    draftReady,
    newAddress,
    paymentMethod,
    paymentProvider,
    promotionCode,
    step,
  ]);

  useEffect(() => {
    const handlePopState = () => {
      setStep(readStepFromUrl() ?? 'review');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const gatewayAvailable =
    paymentMethod === 'CARD'
      ? paymentProvider === 'MERCADO_PAGO'
        ? gatewayConfiguration?.mercadoPago.cardEnabled
        : gatewayConfiguration?.stripe.enabled
      : paymentMethod === 'PAYMENT_LINK'
        ? gatewayConfiguration?.mercadoPago.linkEnabled
        : true;
  const requiresShippingQuote = deliveryMethod !== 'STORE_PICKUP';
  const flowSteps = requiresShippingQuote ? quoteFlowSteps : paymentFlowSteps;
  const canCheckout = useMemo(
    () =>
      Boolean(
        cart?.items.length &&
          auth.status === 'authenticated' &&
          (requiresShippingQuote || gatewayAvailable),
      ),
    [auth.status, cart?.items.length, gatewayAvailable, requiresShippingQuote],
  );
  const activeStepIndex = flowSteps.findIndex((item) => item.id === step);

  function currentDraft(nextStep: CheckoutStep = step): CheckoutDraft {
    return {
      step: nextStep,
      deliveryMethod,
      paymentMethod,
      paymentProvider,
      addressId,
      newAddress,
      address,
      promotionCode,
      customerNotes,
    };
  }

  function goToStep(nextStep: CheckoutStep, replace = false) {
    setStep(nextStep);
    if (cart?.publicToken) {
      saveCheckoutDraft(cart.publicToken, currentDraft(nextStep));
    }
    const url = new URL(window.location.href);
    url.searchParams.set('step', nextStep);
    url.searchParams.delete('restored');
    const state = { ...window.history.state, checkoutStep: nextStep };
    if (replace) window.history.replaceState(state, '', url);
    else window.history.pushState(state, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function continueFromReview() {
    if (auth.status !== 'authenticated') {
      router.push(`/cuenta?redirect=${encodeURIComponent('/carrito?step=delivery')}`);
      return;
    }
    goToStep('delivery');
  }

  function continueFromDelivery() {
    const issue = deliveryIssue(deliveryMethod, newAddress, addressId, address);
    if (issue) {
      notify({ title: 'Completa la entrega', description: issue, tone: 'info' });
      return;
    }
    goToStep('payment');
  }

  function goBack() {
    if (step === 'payment') {
      goToStep('delivery');
      return;
    }
    if (step === 'delivery') {
      goToStep('review');
      return;
    }
    router.push('/productos');
  }

  function chooseDelivery(next: CheckoutDeliveryMethod) {
    setDeliveryMethod(next);
    if (next !== 'STORE_PICKUP' && paymentMethod === 'CASH') {
      setPaymentMethod('CARD');
    }
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart) return;
    if (!canCheckout || submittingOrder.current) return;
    const issue = deliveryIssue(deliveryMethod, newAddress, addressId, address);
    if (issue) {
      notify({ title: 'Revisa la entrega', description: issue, tone: 'info' });
      goToStep('delivery');
      return;
    }

    const shippingAddress =
      newAddress && deliveryMethod !== 'STORE_PICKUP'
        ? toShippingAddressPayload(address)
        : undefined;

    submittingOrder.current = true;
    setPlacing(true);
    setPaymentError(null);
    try {
      orderIdempotencyKey.current ??= crypto.randomUUID();
      const order = await auth.request<Order>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': orderIdempotencyKey.current },
        body: JSON.stringify({
          cartToken: cart.publicToken,
          paymentMethod: requiresShippingQuote ? undefined : paymentMethod,
          paymentProvider:
            !requiresShippingQuote && paymentMethod === 'CARD'
              ? paymentProvider
              : undefined,
          deliveryMethod,
          shippingAddressId:
            !newAddress && deliveryMethod !== 'STORE_PICKUP' ? addressId : undefined,
          shippingAddress,
          promotionCode: promotionCode.trim() || undefined,
          customerNotes: customerNotes.trim() || undefined,
        }),
      });
      clearCheckoutDraft(cart.publicToken);
      resetCart();

      if (order.shippingQuoteStatus === 'PENDING') {
        router.push(`/pago/${order.publicToken}`);
        return;
      }

      if (paymentMethod === 'CARD') {
        router.push(`/pago/${order.publicToken}`);
        return;
      }
      if (paymentMethod === 'PAYMENT_LINK') {
        try {
          const preference = await auth.request<{ checkoutUrl: string }>(
            `/payments/mercado-pago/orders/${order.publicToken}/preference`,
            { method: 'POST' },
          );
          window.location.assign(preference.checkoutUrl);
          return;
        } catch (preferenceError) {
          setPaymentError(errorMessage(preferenceError));
        }
      }
      if (paymentMethod === 'BANK_TRANSFER') {
        router.push(`/pedidos/${order.publicToken}?transferencia=1`);
        return;
      }
      setCompletedOrder(order);
    } catch (orderError) {
      notify({
        title: 'No pudimos crear el pedido',
        description: errorMessage(orderError),
        tone: 'error',
      });
    } finally {
      submittingOrder.current = false;
      setPlacing(false);
    }
  }

  if (cartLoading || auth.status === 'loading') {
    return (
      <main className="checkoutLoading">
        <span className="buttonSpinner" /> Preparando tu compra...
      </main>
    );
  }

  if (completedOrder) {
    return (
      <CheckoutComplete
        instruction={instruction}
        order={completedOrder}
        paymentError={paymentError}
      />
    );
  }

  if (!cart?.items.length) {
    return (
      <main className="emptyCartPage pageWidth">
        <span><ShoppingBag aria-hidden="true" size={31} /></span>
        <p className="eyebrow">Tu carrito</p>
        <h1>Hay espacio para algo inolvidable.</h1>
        <p>Explora el catálogo y elige la esencia que quieres llevar contigo.</p>
        <Link className="button button--coral button--large" href="/productos">
          Descubrir perfumes <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </main>
    );
  }

  const stepCopy = flowSteps[activeStepIndex] ?? flowSteps[0];

  return (
    <main className="checkoutPage">
      <div className="checkoutHeader pageWidth">
        <button className="checkoutHeader__back" onClick={goBack} type="button">
          <ArrowLeft aria-hidden="true" size={16} />
          {step === 'review' ? 'Seguir comprando' : 'Regresar'}
        </button>
        <div><LockKeyhole aria-hidden="true" size={15} /> Compra protegida</div>
      </div>

      <nav aria-label="Progreso de compra" className="checkoutFlow pageWidth">
        {flowSteps.map((item, index) => (
          <button
            aria-current={item.id === step ? 'step' : undefined}
            className={item.id === step ? 'isActive' : index < activeStepIndex ? 'isDone' : ''}
            disabled={index > activeStepIndex}
            key={item.id}
            onClick={() => goToStep(item.id)}
            type="button"
          >
            <span>{index < activeStepIndex ? <Check size={14} /> : index + 1}</span>
            <strong>{item.shortLabel}</strong>
          </button>
        ))}
        <span className="checkoutFlow__payment"><LockKeyhole size={13} /> Pago</span>
      </nav>

      <form className="checkoutLayout pageWidth" onSubmit={placeOrder}>
        <div className="checkoutMain" key={step}>
          <div className="checkoutTitle">
            <span className="eyebrow">Paso {activeStepIndex + 1} de 3</span>
            <h1>{stepCopy.label}</h1>
          </div>

          {step === 'review' && (
            <>
              <section className="checkoutItems">
                {cart.items.map((item) => (
                  <article key={item.id}>
                    <div className="checkoutItems__image">
                      {item.product.image?.url ? (
                        <Image
                          alt={item.product.image.altText || item.product.name}
                          fill
                          sizes="90px"
                          src={item.product.image.url}
                        />
                      ) : (
                        <ProductMediaPlaceholder compact name={item.product.name} />
                      )}
                    </div>
                    <div>
                      <strong>{item.product.name}</strong>
                      <small>{item.variant.name}</small>
                      <div className="quantityControl quantityControl--small">
                        <button
                          aria-label={`Restar ${item.product.name}`}
                          disabled={mutating || item.quantity <= 1}
                          onClick={() => updateItem(item.id, item.quantity - 1)}
                          type="button"
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          aria-label={`Sumar ${item.product.name}`}
                          disabled={mutating || item.quantity >= item.available}
                          onClick={() => updateItem(item.id, item.quantity + 1)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <strong>{formatMoney(item.lineTotalCents, item.currency)}</strong>
                      <button onClick={() => removeItem(item.id)} type="button">Quitar</button>
                    </div>
                  </article>
                ))}
              </section>
              <Link className="checkoutAddMore" href="/productos">
                <Plus size={16} /> Agregar más productos
              </Link>

              {auth.status !== 'authenticated' && (
                <section className="checkoutLogin">
                  <div>
                    <LockKeyhole aria-hidden="true" size={22} />
                    <div>
                      <h2>Entra para continuar</h2>
                      <p>Tu cuenta protege la orden y te permite seguir la entrega.</p>
                    </div>
                  </div>
                  <Link
                    className="button button--dark"
                    href={`/cuenta?redirect=${encodeURIComponent('/carrito?step=delivery')}`}
                  >
                    Entrar o registrarme <ArrowRight size={17} />
                  </Link>
                </section>
              )}
            </>
          )}

          {step === 'delivery' && (
            <section className="checkoutSection checkoutSection--flow">
              <div className="checkoutSection__heading">
                <span>02</span>
                <div>
                  <h2>¿Cómo quieres recibirlo?</h2>
                  <p>Tu selección se conserva al avanzar o regresar.</p>
                </div>
              </div>
              <div className="choiceGrid choiceGrid--delivery">
                <Choice
                  active={deliveryMethod === 'SHIPPING'}
                  icon={Truck}
                  label="Envío nacional"
                  note="Fuera de Tizimín · cotizamos antes de pagar"
                  onClick={() => chooseDelivery('SHIPPING')}
                />
                <Choice
                  active={deliveryMethod === 'LOCAL_DELIVERY'}
                  icon={MapPin}
                  label="Entrega local"
                  note="Tizimín y zona cercana · cotizamos antes de pagar"
                  onClick={() => chooseDelivery('LOCAL_DELIVERY')}
                />
                <Choice
                  active={deliveryMethod === 'STORE_PICKUP'}
                  icon={Store}
                  label="Recoger en tienda"
                  note="Te avisamos al estar listo"
                  onClick={() => chooseDelivery('STORE_PICKUP')}
                />
              </div>
              {deliveryMethod !== 'STORE_PICKUP' && (
                <div className="checkoutAddresses">
                  {addresses.map((savedAddress) => (
                    <button
                      className={!newAddress && addressId === savedAddress.id ? 'isActive' : ''}
                      key={savedAddress.id}
                      onClick={() => {
                        setAddressId(savedAddress.id);
                        setNewAddress(false);
                      }}
                      type="button"
                    >
                      <MapPin size={16} />
                      <span>
                        <strong>{savedAddress.label}</strong>
                        <small>
                          {savedAddress.street} {savedAddress.exteriorNumber},{' '}
                          {savedAddress.city}
                        </small>
                      </span>
                      {!newAddress && addressId === savedAddress.id && <Check size={15} />}
                    </button>
                  ))}
                  <button
                    className={newAddress ? 'isActive' : ''}
                    onClick={() => {
                      setNewAddress(true);
                      setAddressId('');
                    }}
                    type="button"
                  >
                    <span className="plusIcon">+</span>
                    <span>
                      <strong>Nueva dirección</strong>
                      <small>Usar en esta compra</small>
                    </span>
                    {newAddress && <Check size={15} />}
                  </button>
                </div>
              )}
              {deliveryMethod !== 'STORE_PICKUP' && newAddress && (
                <InlineAddressFields address={address} onChange={setAddress} />
              )}
            </section>
          )}

          {step === 'payment' && (
            <>
              <section className="checkoutSection checkoutSection--flow">
                <div className="checkoutSection__heading">
                  <span>03</span>
                  <div>
                    <h2>
                      {requiresShippingQuote
                        ? 'Confirma y solicita la cotización'
                        : 'Elige cómo pagar'}
                    </h2>
                    <p>
                      {requiresShippingQuote
                        ? 'Primero reservamos tus productos y la tienda calcula el envío exacto.'
                        : 'La tarjeta se captura únicamente en la pantalla segura siguiente.'}
                    </p>
                  </div>
                </div>
                {requiresShippingQuote ? (
                  <div className="quoteRequestCard">
                    <span><Truck aria-hidden="true" size={22} /></span>
                    <div>
                      <strong>El pago todavía no se inicia.</strong>
                      <p>
                        Administración recibirá la dirección, los productos y sus cantidades.
                        Cuando agregue el costo de entrega, podrás elegir la forma de pago y abrir
                        la pasarela con el total final.
                      </p>
                    </div>
                    <CheckCircle2 aria-hidden="true" size={20} />
                  </div>
                ) : (
                  <>
                    <div className="choiceGrid choiceGrid--payments">
                      {payments.map((payment) => (
                        <Choice
                          active={paymentMethod === payment.id}
                          disabled={
                            payment.id === 'PAYMENT_LINK' &&
                            (gatewayConfiguration
                              ? !gatewayConfiguration.mercadoPago.linkEnabled
                              : true)
                          }
                          icon={payment.icon}
                          key={payment.id}
                          label={payment.title}
                          note={
                            payment.id === 'PAYMENT_LINK' &&
                            gatewayConfiguration &&
                            !gatewayConfiguration.mercadoPago.linkEnabled
                              ? 'Temporalmente no disponible'
                              : payment.note
                          }
                          onClick={() => setPaymentMethod(payment.id)}
                        />
                      ))}
                    </div>
                    {paymentMethod === 'CARD' && (
                      <div className="gatewayPicker" aria-label="Pasarela para tarjeta">
                        <button
                          className={paymentProvider === 'MERCADO_PAGO' ? 'isActive' : ''}
                          disabled={
                            gatewayConfiguration
                              ? !gatewayConfiguration.mercadoPago.cardEnabled
                              : true
                          }
                          onClick={() => setPaymentProvider('MERCADO_PAGO')}
                          type="button"
                        >
                          <span className="gatewayPicker__mark gatewayPicker__mark--mp">MP</span>
                          <span>
                            <strong>Mercado Pago</strong>
                            <small>Crédito, débito y meses disponibles</small>
                          </span>
                          {paymentProvider === 'MERCADO_PAGO' && <Check size={15} />}
                        </button>
                        <button
                          className={paymentProvider === 'STRIPE' ? 'isActive' : ''}
                          disabled={
                            gatewayConfiguration ? !gatewayConfiguration.stripe.enabled : true
                          }
                          onClick={() => setPaymentProvider('STRIPE')}
                          type="button"
                        >
                          <span className="gatewayPicker__mark gatewayPicker__mark--stripe">S</span>
                          <span>
                            <strong>Stripe</strong>
                            <small>Tarjetas y autenticación bancaria</small>
                          </span>
                          {paymentProvider === 'STRIPE' && <Check size={15} />}
                        </button>
                        {gatewayConfiguration &&
                          !gatewayConfiguration.mercadoPago.cardEnabled &&
                          !gatewayConfiguration.stripe.enabled && (
                            <p>La tienda está terminando de configurar el pago con tarjeta.</p>
                          )}
                      </div>
                    )}
                    {instruction && (
                      <div className="paymentInstruction">
                        <Landmark aria-hidden="true" size={18} />
                        <div>
                          <strong>{instruction.title}</strong>
                          {paymentMethod === 'BANK_TRANSFER' ? (
                            <BankTransferDetails instruction={instruction} />
                          ) : (
                            <p>{instruction.instructions}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>

              <section className="checkoutSection">
                <div className="checkoutSection__heading">
                  <span>+</span>
                  <div>
                    <h2>Detalles opcionales</h2>
                    <p>Agrega un código o una nota para la tienda.</p>
                  </div>
                </div>
                <div className="checkoutExtras">
                  <label className="formField">
                    <span>Código de promoción</span>
                    <input
                      onChange={(event) =>
                        setPromotionCode(event.target.value.toUpperCase())
                      }
                      placeholder="FRAICHE10"
                      value={promotionCode}
                    />
                  </label>
                  <label className="formField">
                    <span>Nota del pedido</span>
                    <textarea
                      maxLength={500}
                      onChange={(event) => setCustomerNotes(event.target.value)}
                      placeholder="Indicaciones de entrega o mensaje especial."
                      rows={3}
                      value={customerNotes}
                    />
                  </label>
                </div>
              </section>
            </>
          )}
        </div>

        <aside className="orderSummary">
          <span className="eyebrow">Resumen en vivo</span>
          <h2>
            {cart.itemCount} {cart.itemCount === 1 ? 'producto' : 'productos'}
          </h2>
          <div className="orderSummary__lines">
            <span>
              <small>Subtotal</small>
              <strong>{formatMoney(cart.subtotalCents, cart.currency)}</strong>
            </span>
            <span>
              <small>Entrega</small>
              <strong>{deliveryLabel(deliveryMethod)}</strong>
            </span>
            <span>
              <small>Pago</small>
              <strong>
                {requiresShippingQuote
                  ? 'Se elige después de cotizar'
                  : paymentLabel(paymentMethod, paymentProvider)}
              </strong>
            </span>
          </div>
          <div className="orderSummary__total">
            <span>{deliveryMethod === 'STORE_PICKUP' ? 'Total' : 'Subtotal antes de entrega'}</span>
            <strong>{formatMoney(cart.subtotalCents, cart.currency)}</strong>
          </div>

          {step === 'review' && (
            <button
              className="button button--coral button--large button--wide"
              onClick={continueFromReview}
              type="button"
            >
              {auth.status === 'authenticated' ? 'Continuar a entrega' : 'Entrar para continuar'}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          )}
          {step === 'delivery' && (
            <button
              className="button button--coral button--large button--wide"
              onClick={continueFromDelivery}
              type="button"
            >
              {requiresShippingQuote
                ? 'Continuar a solicitar cotización'
                : 'Continuar a método de pago'}{' '}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          )}
          {step === 'payment' && (
            <button
              className="button button--coral button--large button--wide"
              disabled={!canCheckout || placing}
              type="submit"
            >
              {placing ? (
                <span className="buttonSpinner" />
              ) : (
                <>
                  {requiresShippingQuote
                    ? 'Solicitar cotización y reservar'
                    : paymentMethod === 'CARD'
                      ? 'Ir al pago seguro'
                      : 'Confirmar pedido'}
                  <ArrowRight aria-hidden="true" size={18} />
                </>
              )}
            </button>
          )}
          <p><LockKeyhole aria-hidden="true" size={13} /> Nada se cobra hasta el último paso.</p>
          <div className="orderSummary__trust">
            <span><PackageCheck size={17} /> Precio e inventario se validan al confirmar</span>
            <span><CreditCard size={17} /> El pago ocurre en la pasarela protegida</span>
          </div>
        </aside>
      </form>
    </main>
  );
}

function Choice({
  active,
  disabled,
  icon: Icon,
  label,
  note,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? 'isActive' : ''}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" size={20} />
      <span><strong>{label}</strong><small>{note}</small></span>
      {active && <Check aria-hidden="true" size={15} />}
    </button>
  );
}

function InlineAddressFields({
  address,
  onChange,
}: {
  address: CheckoutAddressDraft;
  onChange: (address: CheckoutAddressDraft) => void;
}) {
  const update = (field: keyof CheckoutAddressDraft, value: string) => {
    onChange({ ...address, [field]: value });
  };
  return (
    <div className="inlineAddress">
      <div className="formGrid">
        <AddressField field="recipientName" label="Recibe" minLength={3} onChange={update} value={address.recipientName} />
        <AddressField field="phone" inputMode="numeric" label="WhatsApp" maxLength={14} minLength={10} onChange={update} value={address.phone} />
      </div>
      <div className="formGrid formGrid--street">
        <AddressField field="street" label="Calle" maxLength={160} minLength={3} onChange={update} value={address.street} />
        <AddressField field="exteriorNumber" label="Exterior" maxLength={20} onChange={update} value={address.exteriorNumber} />
        <AddressField field="interiorNumber" label="Interior" maxLength={20} onChange={update} required={false} value={address.interiorNumber} />
      </div>
      <AddressField field="neighborhood" label="Colonia" maxLength={100} minLength={2} onChange={update} value={address.neighborhood} />
      <div className="formGrid">
        <AddressField field="city" label="Ciudad" maxLength={100} minLength={2} onChange={update} value={address.city} />
        <AddressField field="municipality" label="Municipio" maxLength={100} minLength={2} onChange={update} value={address.municipality} />
      </div>
      <div className="formGrid">
        <AddressField field="state" label="Estado" maxLength={100} minLength={2} onChange={update} value={address.state} />
        <AddressField field="postalCode" inputMode="numeric" label="Código postal" maxLength={5} minLength={5} onChange={update} value={address.postalCode} />
      </div>
      <AddressField field="reference" label="Referencia" maxLength={300} minLength={5} onChange={update} required={false} value={address.reference} />
    </div>
  );
}

function AddressField({
  field,
  inputMode,
  label,
  maxLength = 120,
  minLength,
  onChange,
  required = true,
  value,
}: {
  field: keyof CheckoutAddressDraft;
  inputMode?: 'numeric';
  label: string;
  maxLength?: number;
  minLength?: number;
  onChange: (field: keyof CheckoutAddressDraft, value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="formField">
      <span>{label}</span>
      <input
        inputMode={inputMode}
        maxLength={maxLength}
        minLength={minLength}
        onChange={(event) => onChange(field, event.target.value)}
        required={required}
        value={value}
      />
    </label>
  );
}

function deliveryIssue(
  deliveryMethod: CheckoutDeliveryMethod,
  newAddress: boolean,
  addressId: string,
  address: CheckoutAddressDraft,
) {
  if (deliveryMethod === 'STORE_PICKUP') return null;
  if (!newAddress) {
    return addressId ? null : 'Selecciona una dirección guardada o captura una nueva.';
  }
  return shippingAddressIssue(address)?.message ?? null;
}

function readStepFromUrl(): CheckoutStep | null {
  if (typeof window === 'undefined') return null;
  const requested = new URLSearchParams(window.location.search).get('step');
  return requested === 'review' || requested === 'delivery' || requested === 'payment'
    ? requested
    : null;
}

function deliveryLabel(method: CheckoutDeliveryMethod) {
  if (method === 'STORE_PICKUP') return 'Recoger en tienda · sin costo';
  if (method === 'LOCAL_DELIVERY') return 'Entrega local · por cotizar';
  return 'Envío nacional · por cotizar';
}

function paymentLabel(
  method: CheckoutPaymentMethod,
  provider: CheckoutPaymentProvider,
) {
  if (method === 'CARD') return provider === 'STRIPE' ? 'Tarjeta · Stripe' : 'Tarjeta · Mercado Pago';
  if (method === 'PAYMENT_LINK') return 'Link de Mercado Pago';
  if (method === 'BANK_TRANSFER') return 'Transferencia';
  return 'Efectivo al recoger';
}

function CheckoutComplete({
  order,
  paymentError,
  instruction,
}: {
  order: Order;
  paymentError: string | null;
  instruction: PaymentInstruction | null;
}) {
  return (
    <main className="checkoutComplete pageWidth">
      <span className="checkoutComplete__icon">
        <CheckCircle2 aria-hidden="true" size={34} />
      </span>
      <span className="eyebrow">Pedido {order.number}</span>
      <h1>Tu pedido ya está con nosotros.</h1>
      <p>
        {order.paymentMethod === 'BANK_TRANSFER'
          ? instruction?.instructions ??
            'Realiza tu transferencia y sube el comprobante desde el seguimiento.'
          : order.paymentMethod === 'CASH'
            ? 'Te avisaremos cuando esté listo para recoger y pagar en tienda.'
            : paymentError
              ? 'La orden quedó guardada, pero no pudimos abrir la pasarela de pago.'
              : 'Te llevaremos a la pasarela segura para completar el pago.'}
      </p>
      {paymentError && (
        <div className="checkoutComplete__warning">
          <LockKeyhole aria-hidden="true" size={17} />
          <span>
            <strong>Pasarela pendiente de configuración</strong>
            {paymentError}
          </span>
        </div>
      )}
      <div className="checkoutComplete__summary">
        <span>Total</span>
        <strong>{formatMoney(order.totalCents, order.currency)}</strong>
      </div>
      <p className="checkoutComplete__policy">
        Consulta tiempos, formas de entrega y cambios en{' '}
        <Link href="/envios-y-devoluciones">Envíos y devoluciones</Link>.
      </p>
      <div className="checkoutComplete__actions">
        <Link
          className="button button--dark button--large"
          href={`/pedidos/${order.publicToken}`}
        >
          Ver pedido y seguimiento <ArrowRight aria-hidden="true" size={18} />
        </Link>
        <Link className="button button--outline button--large" href="/productos">
          Seguir comprando
        </Link>
      </div>
    </main>
  );
}
