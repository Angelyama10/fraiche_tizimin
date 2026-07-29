'use client';

import { ArrowRight, CheckCircle2, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import { LINE_LABELS } from '@/lib/catalog';
import type { ProductLine } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { useNotify } from '@/providers/notification-provider';

type RequestResult = { publicToken: string; status: string; createdAt: string };

export function SpecialRequestForm({
  initialAroma = '',
  initialNotes = '',
}: {
  initialAroma?: string;
  initialNotes?: string;
}) {
  const { customer } = useAuth();
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RequestResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const payload = {
        customerName: String(form.get('customerName') ?? ''),
        customerEmail: String(form.get('customerEmail') ?? ''),
        customerPhone: String(form.get('customerPhone') ?? '') || undefined,
        requestedAroma: String(form.get('requestedAroma') ?? ''),
        preferredLine: String(form.get('preferredLine') ?? '') || undefined,
        notes: String(form.get('notes') ?? '') || undefined,
      };
      const response = await apiRequest<RequestResult>('/special-requests', { method: 'POST', body: JSON.stringify(payload) });
      setResult(response);
      localStorage.setItem('fraiche_special_request_token', response.publicToken);
      notify({ title: 'Solicitud recibida', description: 'Ya comenzamos a seguirle la pista.', tone: 'success' });
    } catch (error) {
      notify({ title: 'No pudimos enviar tu solicitud', description: errorMessage(error), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="specialRequestSuccess">
        <span><CheckCircle2 aria-hidden="true" size={28} /></span>
        <p className="eyebrow">Solicitud recibida</p>
        <h2>Ya seguimos la pista.</h2>
        <p>Guarda este folio para consultar el avance:</p>
        <code>{result.publicToken}</code>
        <button className="button button--dark" onClick={() => setResult(null)} type="button">Solicitar otro aroma</button>
      </div>
    );
  }

  return (
    <form className="specialRequestForm" onSubmit={submit}>
      <div className="specialRequestForm__header"><Search aria-hidden="true" size={21} /><div><span className="eyebrow">Empecemos</span><h2>¿Qué aroma buscas?</h2></div></div>
      <label className="formField"><span>Nombre completo</span><input defaultValue={[customer?.firstName, customer?.lastName].filter(Boolean).join(' ')} maxLength={120} name="customerName" required /></label>
      <div className="formGrid">
        <label className="formField"><span>Correo</span><input defaultValue={customer?.email ?? ''} name="customerEmail" required type="email" /></label>
        <label className="formField"><span>WhatsApp</span><input defaultValue={customer?.phone ?? ''} maxLength={30} name="customerPhone" type="tel" /></label>
      </div>
      <label className="formField"><span>Aroma o perfume</span><input defaultValue={initialAroma} maxLength={160} name="requestedAroma" placeholder="Ej. un aroma con vainilla y madera" required /></label>
      <label className="formField"><span>Línea preferida</span><select name="preferredLine" defaultValue=""><option value="">No estoy seguro</option>{(Object.entries(LINE_LABELS) as Array<[ProductLine, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="formField"><span>Detalles adicionales</span><textarea defaultValue={initialNotes} maxLength={1000} name="notes" placeholder="Cuéntanos dónde lo conociste, presentación o presupuesto aproximado." rows={4} /></label>
      <button className="button button--coral button--large button--wide" disabled={loading} type="submit">{loading ? <span className="buttonSpinner" /> : <>Enviar solicitud <ArrowRight aria-hidden="true" size={18} /></>}</button>
      <small className="formPrivacy">Usaremos tus datos únicamente para responder esta solicitud.</small>
    </form>
  );
}
