'use client';

import {
  Banknote,
  Check,
  CreditCard,
  Landmark,
  Link2,
  MapPin,
  Save,
  Store,
  Truck,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import {
  shippingAddressIssue,
  toShippingAddressPayload,
} from '@/lib/shipping-address';
import type { CustomerAddress, Order } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useNotify } from '@/providers/notification-provider';

type PaymentMethod = 'CARD' | 'PAYMENT_LINK' | 'BANK_TRANSFER' | 'CASH';
type PaymentProvider = 'MERCADO_PAGO' | 'STRIPE';
type DeliveryMethod = 'SHIPPING' | 'LOCAL_DELIVERY' | 'STORE_PICKUP';
type GatewayConfiguration = {
  mercadoPago: {
    cardEnabled: boolean;
    linkEnabled: boolean;
  };
  stripe: {
    enabled: boolean;
  };
};

type AddressDraft = {
  recipientName: string;
  phone: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  city: string;
  municipality: string;
  state: string;
  postalCode: string;
  country: string;
  reference: string;
};

const deliveryOptions = [
  {
    id: 'SHIPPING' as const,
    label: 'Envío nacional',
    note: 'Con seguimiento de paquetería',
    icon: Truck,
  },
  {
    id: 'LOCAL_DELIVERY' as const,
    label: 'Entrega local',
    note: 'Tizimín y zona cercana',
    icon: MapPin,
  },
  {
    id: 'STORE_PICKUP' as const,
    label: 'Recoger en tienda',
    note: 'Te avisamos cuando esté listo',
    icon: Store,
  },
];

const paymentOptions = [
  {
    id: 'CARD' as const,
    label: 'Tarjeta en línea',
    note: 'Pago protegido dentro de KI’IBOK',
    icon: CreditCard,
  },
  {
    id: 'PAYMENT_LINK' as const,
    label: 'Link de Mercado Pago',
    note: 'Continúa en Mercado Pago',
    icon: Link2,
  },
  {
    id: 'BANK_TRANSFER' as const,
    label: 'Transferencia',
    note: 'Sube tu comprobante al terminar',
    icon: Landmark,
  },
  {
    id: 'CASH' as const,
    label: 'Efectivo al recoger',
    note: 'Disponible para retiro en tienda',
    icon: Banknote,
  },
];

export function PendingOrderEditor({
  order,
  onClose,
  onUpdated,
}: {
  order: Order;
  onClose: () => void;
  onUpdated: (order: Order) => void;
}) {
  const auth = useAuth();
  const notify = useNotify();
  const currentPayment = order.payments.find(
    (payment) => !['CANCELLED', 'REFUNDED', 'CHARGED_BACK'].includes(payment.status),
  );
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    order.deliveryMethod as DeliveryMethod,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    (order.paymentMethod as PaymentMethod | null) ?? 'CARD',
  );
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>(
    currentPayment?.provider === 'STRIPE' ? 'STRIPE' : 'MERCADO_PAGO',
  );
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressId, setAddressId] = useState('');
  const [customAddress, setCustomAddress] = useState(true);
  const [address, setAddress] = useState<AddressDraft>(() =>
    addressFromOrder(order),
  );
  const [customerNotes, setCustomerNotes] = useState(order.customerNotes ?? '');
  const [configuration, setConfiguration] = useState<GatewayConfiguration | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    void auth
      .request<CustomerAddress[]>('/customers/me/addresses')
      .then(setAddresses)
      .catch(() => setAddresses([]));
  }, [auth]);

  useEffect(() => {
    void apiRequest<GatewayConfiguration>('/payments/configuration', {
      cache: 'no-store',
    })
      .then((next) => {
        setConfiguration(next);
        if (!next.mercadoPago.cardEnabled && next.stripe.enabled) {
          setPaymentProvider('STRIPE');
        }
      })
      .catch(() => setConfiguration(null));
  }, []);

  useEffect(() => {
    if (paymentMethod === 'CASH') setDeliveryMethod('STORE_PICKUP');
  }, [paymentMethod]);

  const gatewayAvailable = useMemo(() => {
    if (paymentMethod === 'PAYMENT_LINK') {
      return configuration?.mercadoPago.linkEnabled === true;
    }
    if (paymentMethod !== 'CARD') return true;
    return paymentProvider === 'STRIPE'
      ? configuration?.stripe.enabled === true
      : configuration?.mercadoPago.cardEnabled === true;
  }, [configuration, paymentMethod, paymentProvider]);

  function chooseSavedAddress(next: CustomerAddress) {
    setAddressId(next.id);
    setCustomAddress(false);
  }

  function updateAddress(field: keyof AddressDraft, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gatewayAvailable) {
      notify({
        title: 'Método no disponible',
        description: 'Elige otra pasarela o forma de pago.',
        tone: 'info',
      });
      return;
    }
    if (deliveryMethod !== 'STORE_PICKUP' && !customAddress && !addressId) {
      notify({ title: 'Selecciona una dirección', tone: 'info' });
      return;
    }
    if (deliveryMethod !== 'STORE_PICKUP' && customAddress) {
      const issue = shippingAddressIssue(address);
      if (issue) {
        notify({
          title: 'Revisa la dirección',
          description: issue.message,
          tone: 'info',
        });
        return;
      }
    }

    setSaving(true);
    try {
      const shippingAddress =
        deliveryMethod !== 'STORE_PICKUP' && customAddress
          ? toShippingAddressPayload(address)
          : undefined;
      const updated = await auth.request<Order>(
        `/orders/${order.publicToken}/checkout`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            deliveryMethod,
            paymentMethod,
            paymentProvider:
              paymentMethod === 'CARD' ? paymentProvider : undefined,
            shippingAddressId:
              deliveryMethod !== 'STORE_PICKUP' && !customAddress
                ? addressId
                : undefined,
            shippingAddress,
            customerNotes: customerNotes.trim() || undefined,
          }),
        },
      );
      onUpdated(updated);
      notify({
        title: 'Pedido actualizado',
        description: 'Ya puedes continuar con la forma de pago elegida.',
        tone: 'success',
      });
      onClose();
    } catch (error) {
      notify({
        title: 'No pudimos guardar los cambios',
        description: errorMessage(error),
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="pendingOrderEditor">
      <header>
        <div>
          <span className="eyebrow">Pedido pendiente</span>
          <h2>Corrige entrega y pago</h2>
          <p>Puedes ajustar estos datos mientras la reserva siga activa.</p>
        </div>
        <button aria-label="Cerrar edición" onClick={onClose} type="button">
          <X size={18} />
        </button>
      </header>
      <form onSubmit={submit}>
        <fieldset>
          <legend>¿Cómo quieres recibirlo?</legend>
          <div className="pendingOrderChoices">
            {deliveryOptions.map((option) => {
              const Icon = option.icon;
              const disabled = paymentMethod === 'CASH' && option.id !== 'STORE_PICKUP';
              return (
                <button
                  className={deliveryMethod === option.id ? 'isActive' : ''}
                  disabled={disabled}
                  key={option.id}
                  onClick={() => setDeliveryMethod(option.id)}
                  type="button"
                >
                  <Icon size={18} />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.note}</small>
                  </span>
                  {deliveryMethod === option.id && <Check size={15} />}
                </button>
              );
            })}
          </div>
        </fieldset>

        {deliveryMethod !== 'STORE_PICKUP' && (
          <fieldset>
            <legend>Dirección de entrega</legend>
            <div className="pendingAddressChoices">
              <button
                className={customAddress ? 'isActive' : ''}
                onClick={() => {
                  setCustomAddress(true);
                  setAddressId('');
                }}
                type="button"
              >
                <MapPin size={15} />
                <span>
                  <strong>Editar dirección del pedido</strong>
                  <small>{address.street || 'Capturar una dirección nueva'}</small>
                </span>
                {customAddress && <Check size={14} />}
              </button>
              {addresses.map((savedAddress) => (
                <button
                  className={!customAddress && addressId === savedAddress.id ? 'isActive' : ''}
                  key={savedAddress.id}
                  onClick={() => chooseSavedAddress(savedAddress)}
                  type="button"
                >
                  <MapPin size={15} />
                  <span>
                    <strong>{savedAddress.label}</strong>
                    <small>
                      {savedAddress.street} {savedAddress.exteriorNumber},{' '}
                      {savedAddress.city}
                    </small>
                  </span>
                  {!customAddress && addressId === savedAddress.id && <Check size={14} />}
                </button>
              ))}
            </div>
            {customAddress && (
              <AddressFields address={address} onChange={updateAddress} />
            )}
          </fieldset>
        )}

        <fieldset>
          <legend>¿Cómo quieres pagar?</legend>
          <div className="pendingOrderChoices pendingOrderChoices--payment">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              const disabled =
                option.id === 'PAYMENT_LINK' &&
                configuration?.mercadoPago.linkEnabled !== true;
              return (
                <button
                  className={paymentMethod === option.id ? 'isActive' : ''}
                  disabled={disabled}
                  key={option.id}
                  onClick={() => setPaymentMethod(option.id)}
                  type="button"
                >
                  <Icon size={18} />
                  <span>
                    <strong>{option.label}</strong>
                    <small>
                      {disabled ? 'Temporalmente no disponible' : option.note}
                    </small>
                  </span>
                  {paymentMethod === option.id && <Check size={15} />}
                </button>
              );
            })}
          </div>
          {paymentMethod === 'CARD' && (
            <div className="pendingGatewayChoices">
              <button
                className={paymentProvider === 'MERCADO_PAGO' ? 'isActive' : ''}
                disabled={configuration?.mercadoPago.cardEnabled !== true}
                onClick={() => setPaymentProvider('MERCADO_PAGO')}
                type="button"
              >
                <span>MP</span>
                <div>
                  <strong>Mercado Pago</strong>
                  <small>Crédito y débito</small>
                </div>
                {paymentProvider === 'MERCADO_PAGO' && <Check size={14} />}
              </button>
              <button
                className={paymentProvider === 'STRIPE' ? 'isActive' : ''}
                disabled={configuration?.stripe.enabled !== true}
                onClick={() => setPaymentProvider('STRIPE')}
                type="button"
              >
                <span>S</span>
                <div>
                  <strong>Stripe</strong>
                  <small>Tarjetas y autenticación bancaria</small>
                </div>
                {paymentProvider === 'STRIPE' && <Check size={14} />}
              </button>
            </div>
          )}
        </fieldset>

        <label className="pendingOrderNotes">
          <span>Nota para la tienda</span>
          <textarea
            maxLength={500}
            onChange={(event) => setCustomerNotes(event.target.value)}
            placeholder="Indicaciones de entrega o mensaje especial."
            rows={3}
            value={customerNotes}
          />
        </label>

        <div className="pendingOrderEditor__actions">
          <button className="button button--outline" onClick={onClose} type="button">
            Seguir sin cambios
          </button>
          <button
            className="button button--dark"
            disabled={saving || !gatewayAvailable}
            type="submit"
          >
            {saving ? <span className="buttonSpinner" /> : <Save size={16} />}
            Guardar cambios
          </button>
        </div>
      </form>
    </section>
  );
}

function AddressFields({
  address,
  onChange,
}: {
  address: AddressDraft;
  onChange: (field: keyof AddressDraft, value: string) => void;
}) {
  return (
    <div className="pendingAddressForm">
      <AddressField
        field="recipientName"
        label="Nombre de quien recibe"
        onChange={onChange}
        value={address.recipientName}
      />
      <AddressField
        field="phone"
        label="Teléfono o WhatsApp"
        maxLength={30}
        onChange={onChange}
        value={address.phone}
      />
      <AddressField
        field="street"
        label="Calle"
        maxLength={160}
        onChange={onChange}
        value={address.street}
      />
      <AddressField
        field="exteriorNumber"
        label="Número exterior"
        maxLength={20}
        onChange={onChange}
        value={address.exteriorNumber}
      />
      <AddressField
        field="interiorNumber"
        label="Número interior (opcional)"
        maxLength={20}
        onChange={onChange}
        required={false}
        value={address.interiorNumber}
      />
      <AddressField
        field="neighborhood"
        label="Colonia"
        maxLength={100}
        onChange={onChange}
        value={address.neighborhood}
      />
      <AddressField
        field="city"
        label="Ciudad"
        maxLength={100}
        onChange={onChange}
        value={address.city}
      />
      <AddressField
        field="municipality"
        label="Municipio (opcional)"
        maxLength={100}
        onChange={onChange}
        required={false}
        value={address.municipality}
      />
      <AddressField
        field="state"
        label="Estado"
        maxLength={100}
        onChange={onChange}
        value={address.state}
      />
      <AddressField
        field="postalCode"
        inputMode="numeric"
        label="Código postal"
        maxLength={10}
        onChange={onChange}
        value={address.postalCode}
      />
      <AddressField
        field="reference"
        label="Referencias (opcional)"
        maxLength={300}
        onChange={onChange}
        required={false}
        value={address.reference}
        wide
      />
    </div>
  );
}

function AddressField({
  field,
  inputMode,
  label,
  maxLength = 120,
  onChange,
  required = true,
  value,
  wide = false,
}: {
  field: keyof AddressDraft;
  inputMode?: 'numeric';
  label: string;
  maxLength?: number;
  onChange: (field: keyof AddressDraft, value: string) => void;
  required?: boolean;
  value: string;
  wide?: boolean;
}) {
  return (
    <label className={wide ? 'isWide' : ''}>
      <span>{label}</span>
      <input
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(field, event.target.value)}
        required={required}
        value={value}
      />
    </label>
  );
}

function addressFromOrder(order: Order): AddressDraft {
  const source = order.shippingAddress ?? {};
  return {
    recipientName: String(source.recipientName ?? ''),
    phone: String(source.phone ?? ''),
    street: String(source.street ?? ''),
    exteriorNumber: String(source.exteriorNumber ?? ''),
    interiorNumber: String(source.interiorNumber ?? ''),
    neighborhood: String(source.neighborhood ?? ''),
    city: String(source.city ?? 'Tizimín'),
    municipality: String(source.municipality ?? 'Tizimín'),
    state: String(source.state ?? 'Yucatán'),
    postalCode: String(source.postalCode ?? ''),
    country: String(source.country ?? 'MX'),
    reference: String(source.reference ?? ''),
  };
}
