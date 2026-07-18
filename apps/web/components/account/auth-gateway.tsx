'use client';

import { ArrowRight, Eye, EyeOff, KeyRound, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { useNotify } from '@/providers/notification-provider';

type Mode = 'login' | 'register' | 'forgot';

export function AuthGateway() {
  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const auth = useAuth();
  const notify = useNotify();
  const router = useRouter();
  const searchParams = useSearchParams();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      if (mode === 'forgot') {
        await apiRequest('/customer-auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: String(form.get('email') ?? '') }) });
        setForgotSent(true);
        return;
      }
      if (mode === 'login') {
        await auth.login({ email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') });
      } else {
        await auth.register({
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
          firstName: String(form.get('firstName') ?? ''),
          lastName: String(form.get('lastName') ?? ''),
          phone: String(form.get('phone') ?? ''),
          marketingOptIn: form.get('marketingOptIn') === 'on',
        });
      }
      notify({ title: mode === 'login' ? 'Qué gusto verte de nuevo' : 'Tu cuenta está lista', description: 'Tu carrito y tus favoritos te acompañan.', tone: 'success' });
      router.replace(searchParams.get('redirect') || '/cuenta');
    } catch (error) {
      notify({ title: mode === 'login' ? 'No pudimos iniciar sesión' : 'No pudimos crear tu cuenta', description: errorMessage(error), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authPage">
      <div className="authPage__visual">
        <Image alt="Perfume floral Fraîche" fill preload sizes="(max-width: 850px) 0px, 48vw" src="/images/products/elegance-floral.png" />
        <div className="authPage__visualCopy"><span className="eyebrow eyebrow--light">Tu espacio Fraîche</span><h1>Tu historia también tiene aroma.</h1><p>Guarda favoritos, compra con seguridad y sigue cada pedido desde un solo lugar.</p></div>
      </div>
      <div className="authPanel">
        <div className="authPanel__inner">
          {mode !== 'forgot' && (
            <div className="authTabs" role="tablist">
              <button aria-selected={mode === 'login'} className={mode === 'login' ? 'isActive' : ''} onClick={() => setMode('login')} role="tab" type="button">Entrar</button>
              <button aria-selected={mode === 'register'} className={mode === 'register' ? 'isActive' : ''} onClick={() => setMode('register')} role="tab" type="button">Crear cuenta</button>
            </div>
          )}

          {mode === 'forgot' && forgotSent ? (
            <div className="authMessage"><span><Mail aria-hidden="true" size={25} /></span><p className="eyebrow">Revisa tu correo</p><h2>Te enviamos los siguientes pasos.</h2><p>Si la cuenta existe, recibirás un enlace de recuperación.</p><button className="button button--dark" onClick={() => { setMode('login'); setForgotSent(false); }} type="button">Volver a entrar</button></div>
          ) : (
            <form className="authForm" key={mode} onSubmit={submit}>
              <div className="authForm__heading">
                {mode === 'forgot' ? <KeyRound aria-hidden="true" size={21} /> : <Sparkles aria-hidden="true" size={21} />}
                <div><span className="eyebrow">{mode === 'login' ? 'Bienvenido de vuelta' : mode === 'register' ? 'Comencemos' : 'Recupera tu acceso'}</span><h2>{mode === 'login' ? 'Entra a tu tocador.' : mode === 'register' ? 'Crea tu espacio.' : '¿Olvidaste tu contraseña?'}</h2></div>
              </div>

              {mode === 'register' && <div className="formGrid"><label className="formField"><span>Nombre</span><input autoComplete="given-name" maxLength={80} name="firstName" required /></label><label className="formField"><span>Apellidos</span><input autoComplete="family-name" maxLength={80} name="lastName" required /></label></div>}
              <label className="formField"><span>Correo</span><input autoComplete="email" maxLength={180} name="email" required type="email" /></label>
              {mode === 'register' && <label className="formField"><span>WhatsApp</span><input autoComplete="tel" maxLength={30} name="phone" required type="tel" /></label>}
              {mode !== 'forgot' && <label className="formField passwordField"><span>Contraseña</span><div><input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={10} maxLength={128} name="password" required type={showPassword ? 'text' : 'password'} /><button aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Ocultar' : 'Mostrar'} type="button">{showPassword ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}</button></div>{mode === 'register' && <small>Al menos 10 caracteres.</small>}</label>}
              {mode === 'register' && <label className="checkField"><input name="marketingOptIn" type="checkbox" /><span><CheckMark /></span>Quiero recibir novedades y promociones.</label>}
              {mode === 'login' && <button className="authForm__forgot" onClick={() => setMode('forgot')} type="button">Olvidé mi contraseña</button>}
              <button className="button button--coral button--large button--wide" disabled={loading} type="submit">{loading ? <span className="buttonSpinner" /> : <>{mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear mi cuenta' : 'Enviar instrucciones'} <ArrowRight aria-hidden="true" size={18} /></>}</button>
              {mode === 'forgot' && <button className="textLink authForm__back" onClick={() => setMode('login')} type="button">Volver al inicio de sesión</button>}
              <p className="authForm__secure"><ShieldCheck aria-hidden="true" size={15} /> Tus datos viajan cifrados y nunca guardamos información de tarjeta.</p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

function CheckMark() {
  return <svg aria-hidden="true" viewBox="0 0 12 12"><path d="m2 6 2.5 2.5L10 3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>;
}
