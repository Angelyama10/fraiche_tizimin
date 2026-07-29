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
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { CustomerAddress, Order } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useCart } from '@/providers/cart-provider';
import { useNotify } from '@/providers/notification-provider';
import {
  BankTransferDetails,
  type PaymentInstruction,
} from '@/components/payments/bank-transfer-details';
import { ProductMediaPlaceholder } from '@/components/store/product-media-placeholder';

type PaymentMethod = 'CARD' | 'PAYMENT_LINK' | 'BANK_TRANSFER' | 'CASH';
type PaymentProvider = 'MERCADO_PAGO' | 'STRIPE';
type DeliveryMethod = 'SHIPPING' | 'LOCAL_DELIVERY' | 'STORE_PICKUP';
type GatewayConfiguration = {
  mercadoPago: {
    enabled: boolean;
    cardEnabled: boolean;
    linkEnabled: boolean;
    publicKey: string | null;
  };
  stripe: { enabled: boolean; publishableKey: string | null };
};

const payments: Array<{ id: PaymentMethod; title: string; note: string; icon: typeof CreditCard }> = [
  { id: 'CARD', title: 'Tarjeta en línea', note: 'Sin salir de KI’IBOK', icon: CreditCard },
  { id: 'PAYMENT_LINK', title: 'Link de pago', note: 'Abrir Mercado Pago', icon: Link2 },
  { id: 'BANK_TRANSFER', title: 'Transferencia', note: 'Sube tu comprobante', icon: Landmark },
  { id: 'CASH', title: 'Efectivo', note: 'Al recoger', icon: Banknote },
];

export function CheckoutExperience() {
  const router = useRouter();
  const auth = useAuth();
  const { cart, loading: cartLoading, mutating, updateItem, removeItem, resetCart } = useCart();
  const notify = useNotify();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressId, setAddressId] = useState('');
  const [newAddress, setNewAddress] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('SHIPPING');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CARD');
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('MERCADO_PAGO');
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
    void auth.request<CustomerAddress[]>('/customers/me/addresses').then((items) => {
      setAddresses(items);
      const preferred = items.find((item) => item.isDefault) ?? items[0];
      if (preferred) setAddressId(preferred.id);
      else setNewAddress(true);
    }).catch(() => undefined);
  }, [auth]);

  useEffect(() => {
    if (paymentMethod !== 'BANK_TRANSFER' && paymentMethod !== 'CASH') {
      setInstruction(null);
      return;
    }
    void apiRequest<PaymentInstruction>(`/payments/instructions/${paymentMethod}`, { cache: 'no-store' }).then(setInstruction).catch(() => setInstruction(null));
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

  const gatewayAvailable =
    paymentMethod === 'CARD'
      ? paymentProvider === 'MERCADO_PAGO'
        ? gatewayConfiguration?.mercadoPago.cardEnabled
        : gatewayConfiguration?.stripe.enabled
      : paymentMethod === 'PAYMENT_LINK'
        ? gatewayConfiguration?.mercadoPago.linkEnabled
        : true;
  const canCheckout = useMemo(
    () => Boolean(cart?.items.length && auth.status === 'authenticated' && gatewayAvailable),
    [auth.status, cart?.items.length, gatewayAvailable],
  );

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart || !canCheckout) return;
    const form = new FormData(event.currentTarget);
    if (deliveryMethod !== 'STORE_PICKUP' && !addressId && !newAddress) {
      notify({ title: 'Selecciona una dirección', tone: 'info' });
      return;
    }

    const shippingAddress = newAddress && deliveryMethod !== 'STORE_PICKUP' ? {
      recipientName: String(form.get('recipientName') ?? ''),
      phone: String(form.get('phone') ?? ''),
      street: String(form.get('street') ?? ''),
      exteriorNumber: String(form.get('exteriorNumber') ?? ''),
      interiorNumber: String(form.get('interiorNumber') ?? '') || undefined,
      neighborhood: String(form.get('neighborhood') ?? ''),
      city: String(form.get('city') ?? ''),
      municipality: String(form.get('municipality') ?? '') || undefined,
      state: String(form.get('state') ?? ''),
      postalCode: String(form.get('postalCode') ?? ''),
      country: 'MX',
      reference: String(form.get('reference') ?? '') || undefined,
    } : undefined;

    setPlacing(true);
    setPaymentError(null);
    try {
      const order = await auth.request<Order>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          cartToken: cart.publicToken,
          paymentMethod,
          paymentProvider: paymentMethod === 'CARD' ? paymentProvider : undefined,
          deliveryMethod,
          shippingAddressId: !newAddress && deliveryMethod !== 'STORE_PICKUP' ? addressId : undefined,
          shippingAddress,
          promotionCode: promotionCode.trim() || undefined,
          customerNotes: customerNotes.trim() || undefined,
        }),
      });
      resetCart();

      if (paymentMethod === 'CARD') {
        router.push(`/pago/${order.publicToken}`);
        return;
      }
      if (paymentMethod === 'PAYMENT_LINK') {
        try {
          const preference = await auth.request<{ checkoutUrl: string }>(`/payments/mercado-pago/orders/${order.publicToken}/preference`, { method: 'POST' });
          window.location.assign(preference.checkoutUrl);
          return;
        } catch (error) {
          setPaymentError(errorMessage(error));
        }
      }
      if (paymentMethod === 'BANK_TRANSFER') {
        router.push(`/pedidos/${order.publicToken}?transferencia=1`);
        return;
      }
      setCompletedOrder(order);
    } catch (error) {
      notify({ title: 'No pudimos crear el pedido', description: errorMessage(error), tone: 'error' });
    } finally {
      setPlacing(false);
    }
  }

  if (cartLoading || auth.status === 'loading') return <main className="checkoutLoading"><span className="buttonSpinner" /> Preparando tu carrito...</main>;

  if (completedOrder) {
    return <CheckoutComplete order={completedOrder} paymentError={paymentError} instruction={instruction} />;
  }

  if (!cart?.items.length) {
    return <main className="emptyCartPage pageWidth"><span><ShoppingBag aria-hidden="true" size={31} /></span><p className="eyebrow">Tu carrito</p><h1>Hay espacio para algo inolvidable.</h1><p>Explora el catálogo y elige la esencia que quieres llevar contigo.</p><Link className="button button--coral button--large" href="/productos">Descubrir perfumes <ArrowRight aria-hidden="true" size={18} /></Link></main>;
  }

  return (
    <main className="checkoutPage">
      <div className="checkoutHeader pageWidth"><Link href="/productos"><ArrowLeft aria-hidden="true" size={16} /> Seguir explorando</Link><div><LockKeyhole aria-hidden="true" size={15} /> Compra protegida</div></div>
      <form className="checkoutLayout pageWidth" onSubmit={placeOrder}>
        <div className="checkoutMain">
          <div className="checkoutTitle"><span className="eyebrow">Finaliza tu compra</span><h1>Tu selección</h1></div>
          <section className="checkoutItems">
            {cart.items.map((item) => <article key={item.id}><div className="checkoutItems__image">{item.product.image?.url ? <Image alt={item.product.image.altText || item.product.name} fill sizes="90px" src={item.product.image.url} /> : <ProductMediaPlaceholder compact name={item.product.name} />}</div><div><strong>{item.product.name}</strong><small>{item.variant.name}</small><div className="quantityControl quantityControl--small"><button aria-label="Restar" disabled={mutating || item.quantity <= 1} onClick={() => updateItem(item.id, item.quantity - 1)} type="button">−</button><span>{item.quantity}</span><button aria-label="Sumar" disabled={mutating || item.quantity >= item.available} onClick={() => updateItem(item.id, item.quantity + 1)} type="button">+</button></div></div><div><strong>{formatMoney(item.lineTotalCents, item.currency)}</strong><button onClick={() => removeItem(item.id)} type="button">Quitar</button></div></article>)}
          </section>

          {auth.status !== 'authenticated' ? (
            <section className="checkoutLogin"><div><LockKeyhole aria-hidden="true" size={22} /><div><h2>Entra para comprar de forma segura</h2><p>Tu cuenta protege la orden y te permite seguir la entrega.</p></div></div><Link className="button button--dark" href="/cuenta?redirect=/carrito">Entrar o registrarme <ArrowRight size={17} /></Link></section>
          ) : (
            <>
              <section className="checkoutSection">
                <div className="checkoutSection__heading"><span>01</span><div><h2>¿Cómo quieres recibirlo?</h2><p>Selecciona la opción que mejor te funciona.</p></div></div>
                <div className="choiceGrid choiceGrid--delivery">
                  <Choice active={deliveryMethod === 'SHIPPING'} disabled={paymentMethod === 'CASH'} icon={Truck} label="Envío nacional" note="Con código de rastreo" onClick={() => setDeliveryMethod('SHIPPING')} />
                  <Choice active={deliveryMethod === 'LOCAL_DELIVERY'} disabled={paymentMethod === 'CASH'} icon={MapPin} label="Entrega local" note="Tizimín y zona cercana" onClick={() => setDeliveryMethod('LOCAL_DELIVERY')} />
                  <Choice active={deliveryMethod === 'STORE_PICKUP'} icon={Store} label="Recoger en tienda" note="Te avisamos al estar listo" onClick={() => setDeliveryMethod('STORE_PICKUP')} />
                </div>
                {deliveryMethod !== 'STORE_PICKUP' && (
                  <div className="checkoutAddresses">
                    {addresses.map((address) => <button className={!newAddress && addressId === address.id ? 'isActive' : ''} key={address.id} onClick={() => { setAddressId(address.id); setNewAddress(false); }} type="button"><MapPin size={16} /><span><strong>{address.label}</strong><small>{address.street} {address.exteriorNumber}, {address.city}</small></span>{!newAddress && addressId === address.id && <Check size={15} />}</button>)}
                    <button className={newAddress ? 'isActive' : ''} onClick={() => { setNewAddress(true); setAddressId(''); }} type="button"><PlusIcon /><span><strong>Nueva dirección</strong><small>Usar solo en esta compra</small></span>{newAddress && <Check size={15} />}</button>
                  </div>
                )}
                {deliveryMethod !== 'STORE_PICKUP' && newAddress && <InlineAddressFields customerName={[auth.customer?.firstName, auth.customer?.lastName].filter(Boolean).join(' ')} phone={auth.customer?.phone ?? ''} />}
              </section>

              <section className="checkoutSection">
                <div className="checkoutSection__heading"><span>02</span><div><h2>Elige cómo pagar</h2><p>Los datos de tarjeta nunca pasan por nuestros servidores.</p></div></div>
                <div className="choiceGrid choiceGrid--payments">{payments.map((payment) => <Choice active={paymentMethod === payment.id} disabled={payment.id === 'PAYMENT_LINK' && (gatewayConfiguration ? !gatewayConfiguration.mercadoPago.linkEnabled : true)} icon={payment.icon} key={payment.id} label={payment.title} note={payment.id === 'PAYMENT_LINK' && gatewayConfiguration && !gatewayConfiguration.mercadoPago.linkEnabled ? 'Temporalmente no disponible' : payment.note} onClick={() => setPaymentMethod(payment.id)} />)}</div>
                {paymentMethod === 'CARD' && (
                  <div className="gatewayPicker" aria-label="Pasarela para tarjeta">
                    <button
                      className={paymentProvider === 'MERCADO_PAGO' ? 'isActive' : ''}
                      disabled={gatewayConfiguration ? !gatewayConfiguration.mercadoPago.cardEnabled : true}
                      onClick={() => setPaymentProvider('MERCADO_PAGO')}
                      type="button"
                    >
                      <span className="gatewayPicker__mark gatewayPicker__mark--mp">MP</span>
                      <span><strong>Mercado Pago</strong><small>Crédito, débito y meses disponibles</small></span>
                      {paymentProvider === 'MERCADO_PAGO' && <Check size={15} />}
                    </button>
                    <button
                      className={paymentProvider === 'STRIPE' ? 'isActive' : ''}
                      disabled={gatewayConfiguration ? !gatewayConfiguration.stripe.enabled : true}
                      onClick={() => setPaymentProvider('STRIPE')}
                      type="button"
                    >
                      <span className="gatewayPicker__mark gatewayPicker__mark--stripe">S</span>
                      <span><strong>Stripe</strong><small>Tarjetas y autenticación bancaria</small></span>
                      {paymentProvider === 'STRIPE' && <Check size={15} />}
                    </button>
                    {gatewayConfiguration &&
                      !gatewayConfiguration.mercadoPago.cardEnabled &&
                      !gatewayConfiguration.stripe.enabled && (
                        <p>La tienda está terminando de configurar el pago con tarjeta.</p>
                      )}
                  </div>
                )}
                {instruction && <div className="paymentInstruction"><Landmark aria-hidden="true" size={18} /><div><strong>{instruction.title}</strong>{paymentMethod === 'BANK_TRANSFER' ? <BankTransferDetails instruction={instruction} /> : <p>{instruction.instructions}</p>}</div></div>}
              </section>

              <section className="checkoutSection">
                <div className="checkoutSection__heading"><span>03</span><div><h2>Últimos detalles</h2><p>Agrega un código o una nota para la tienda.</p></div></div>
                <div className="checkoutExtras"><label className="formField"><span>Código de promoción</span><input onChange={(event) => setPromotionCode(event.target.value.toUpperCase())} placeholder="FRAICHE10" value={promotionCode} /></label><label className="formField"><span>Nota del pedido</span><textarea maxLength={500} onChange={(event) => setCustomerNotes(event.target.value)} placeholder="Indicaciones de entrega o mensaje especial." rows={3} value={customerNotes} /></label></div>
              </section>
            </>
          )}
        </div>

        <aside className="orderSummary">
          <span className="eyebrow">Resumen</span><h2>Tu pedido</h2>
          <div className="orderSummary__lines"><span><small>Subtotal</small><strong>{formatMoney(cart.subtotalCents, cart.currency)}</strong></span><span><small>Envío</small><strong>Por confirmar</strong></span><span><small>Descuento</small><strong>Al aplicar código</strong></span></div>
          <div className="orderSummary__total"><span>Total estimado</span><strong>{formatMoney(cart.subtotalCents, cart.currency)}</strong></div>
          <button className="button button--coral button--large button--wide" disabled={!canCheckout || placing} type="submit">{placing ? <span className="buttonSpinner" /> : <>Confirmar pedido <ArrowRight aria-hidden="true" size={18} /></>}</button>
          <p><LockKeyhole aria-hidden="true" size={13} /> Precio e inventario se validan al confirmar.</p>
          <div className="orderSummary__trust"><span><PackageCheck size={17} /> Reserva automática de inventario</span><span><CreditCard size={17} /> Pago procesado por la pasarela</span></div>
        </aside>
      </form>
    </main>
  );
}

function Choice({ active, disabled, icon: Icon, label, note, onClick }: { active: boolean; disabled?: boolean; icon: typeof Truck; label: string; note: string; onClick: () => void }) {
  return <button className={active ? 'isActive' : ''} disabled={disabled} onClick={onClick} type="button"><Icon aria-hidden="true" size={20} /><span><strong>{label}</strong><small>{note}</small></span>{active && <Check aria-hidden="true" size={15} />}</button>;
}

function PlusIcon() { return <span className="plusIcon">+</span>; }

function InlineAddressFields({ customerName, phone }: { customerName: string; phone: string }) {
  return <div className="inlineAddress"><div className="formGrid"><label className="formField"><span>Recibe</span><input defaultValue={customerName} name="recipientName" required /></label><label className="formField"><span>WhatsApp</span><input defaultValue={phone} maxLength={30} name="phone" required /></label></div><div className="formGrid formGrid--street"><label className="formField"><span>Calle</span><input maxLength={160} name="street" required /></label><label className="formField"><span>Exterior</span><input maxLength={20} name="exteriorNumber" required /></label><label className="formField"><span>Interior</span><input maxLength={20} name="interiorNumber" /></label></div><label className="formField"><span>Colonia</span><input maxLength={100} name="neighborhood" required /></label><div className="formGrid"><label className="formField"><span>Ciudad</span><input defaultValue="Tizimín" maxLength={100} name="city" required /></label><label className="formField"><span>Municipio</span><input defaultValue="Tizimín" maxLength={100} name="municipality" /></label></div><div className="formGrid"><label className="formField"><span>Estado</span><input defaultValue="Yucatán" maxLength={100} name="state" required /></label><label className="formField"><span>Código postal</span><input inputMode="numeric" maxLength={10} name="postalCode" required /></label></div><label className="formField"><span>Referencia</span><input maxLength={300} name="reference" /></label></div>;
}

function CheckoutComplete({ order, paymentError, instruction }: { order: Order; paymentError: string | null; instruction: PaymentInstruction | null }) {
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
