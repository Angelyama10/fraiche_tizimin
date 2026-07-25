'use client';

import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  CloudUpload,
  ExternalLink,
  Eye,
  EyeOff,
  ImageIcon,
  LoaderCircle,
  Monitor,
  RefreshCw,
  Save,
  Send,
  Smartphone,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SiteContentDocument, StorefrontSection, StorefrontSectionType } from '@/lib/site-content';
import { errorMessage } from '@/lib/api';
import type { AdminRequest } from './admin-app';

type AdminContentResponse = {
  draftContent: SiteContentDocument;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
  revisions: Array<{ id: string; version: number; createdAt: string; publishedBy?: { name: string } | null }>;
};

type MediaAsset = {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
};

type EditorSelection = 'hero' | 'header' | 'footer' | 'media' | string;
type NoticeTone = 'success' | 'error';

const SECTION_LABELS: Record<StorefrontSectionType, string> = {
  NEW_ARRIVALS: 'Recién llegados',
  COLLECTIONS: 'Colecciones',
  BEST_SELLERS: 'Más vendidos',
  SCENT_FINDER: 'Familias aromáticas',
  PROMOTION_BAND: 'Franja promocional',
  ABOUT: 'Nosotros y ubicación',
  SPECIAL_ORDER: 'Pedido especial',
};

export function AdminSiteEditor({
  request,
  onNotice,
}: {
  request: AdminRequest;
  onNotice: (tone: NoticeTone, message: string) => void;
}) {
  const [content, setContent] = useState<SiteContentDocument | null>(null);
  const [meta, setMeta] = useState<AdminContentResponse | null>(null);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [selected, setSelected] = useState<EditorSelection>('hero');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewToken, setPreviewToken] = useState('');
  const [previewRevision, setPreviewRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const changeVersion = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextContent, nextMedia, preview] = await Promise.all([
        request<AdminContentResponse>('/admin/content'),
        request<{ items: MediaAsset[] }>('/admin/media?page=1&pageSize=60'),
        request<{ token: string }>('/admin/content/preview', { method: 'POST' }),
      ]);
      setMeta(nextContent);
      setContent(nextContent.draftContent);
      setMedia(nextMedia.items);
      setPreviewToken(preview.token);
      setDirty(false);
    } catch (error) {
      onNotice('error', errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [onNotice, request]);

  useEffect(() => { void load(); }, [load]);

  const saveDraft = useCallback(async (silent = false) => {
    if (!content || saving) return;
    const savingVersion = changeVersion.current;
    setSaving(true);
    try {
      await request('/admin/content/draft', { method: 'PUT', body: JSON.stringify({ content }) });
      if (changeVersion.current === savingVersion) setDirty(false);
      setPreviewRevision((value) => value + 1);
      if (!silent) onNotice('success', 'Borrador guardado.');
    } catch (error) {
      onNotice('error', errorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [content, onNotice, request, saving]);

  useEffect(() => {
    if (!dirty || saving || publishing) return;
    const timeout = window.setTimeout(() => { void saveDraft(true); }, 1400);
    return () => window.clearTimeout(timeout);
  }, [dirty, publishing, saveDraft, saving]);

  function change(update: (current: SiteContentDocument) => SiteContentDocument) {
    setContent((current) => current ? update(current) : current);
    changeVersion.current += 1;
    setDirty(true);
  }

  async function publish() {
    if (!content || publishing) return;
    setPublishing(true);
    try {
      await request('/admin/content/draft', { method: 'PUT', body: JSON.stringify({ content }) });
      const published = await request<{ version: number; publishedAt: string }>('/admin/content/publish', { method: 'POST' });
      setMeta((current) => current ? { ...current, version: published.version, publishedAt: published.publishedAt } : current);
      setDirty(false);
      setPreviewRevision((value) => value + 1);
      onNotice('success', `Versión ${published.version} publicada en la tienda.`);
    } catch (error) {
      onNotice('error', errorMessage(error));
    } finally {
      setPublishing(false);
    }
  }

  function updateHero<K extends keyof SiteContentDocument['home']['hero']>(key: K, value: SiteContentDocument['home']['hero'][K]) {
    change((current) => ({ ...current, home: { ...current.home, hero: { ...current.home.hero, [key]: value } } }));
  }

  function updateHeader<K extends keyof SiteContentDocument['global']['header']>(key: K, value: SiteContentDocument['global']['header'][K]) {
    change((current) => ({ ...current, global: { ...current.global, header: { ...current.global.header, [key]: value } } }));
  }

  function updateContact<K extends keyof SiteContentDocument['global']['contact']>(key: K, value: string) {
    change((current) => ({ ...current, global: { ...current.global, contact: { ...current.global.contact, [key]: value } } }));
  }

  function updateSection(sectionId: string, patch: Partial<StorefrontSection>) {
    change((current) => ({ ...current, home: { ...current.home, sections: current.home.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section) } }));
  }

  function moveSection(sectionId: string, step: number) {
    change((current) => {
      const sections = [...current.home.sections];
      const index = sections.findIndex((section) => section.id === sectionId);
      const next = index + step;
      if (index < 0 || next < 0 || next >= sections.length) return current;
      [sections[index], sections[next]] = [sections[next], sections[index]];
      return { ...current, home: { ...current.home, sections } };
    });
  }

  const refreshMedia = useCallback(async () => {
    const response = await request<{ items: MediaAsset[] }>('/admin/media?page=1&pageSize=60');
    setMedia(response.items);
  }, [request]);

  const uploadMedia = useCallback(async (file: File, altText: string) => {
    const dimensions = await getImageDimensions(file);
    const presigned = await request<{
      asset: MediaAsset;
      uploadUrl: string;
      requiredHeaders: Record<string, string>;
    }>('/admin/media/presign', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size, altText }),
    });
    const uploaded = await fetch(presigned.uploadUrl, { method: 'PUT', headers: presigned.requiredHeaders, body: file });
    if (!uploaded.ok) throw new Error('No fue posible cargar la imagen al almacenamiento.');
    const asset = await request<MediaAsset>(`/admin/media/${presigned.asset.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ ...dimensions, altText }),
    });
    setMedia((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
    return asset;
  }, [request]);

  if (loading || !content) return <div className="siteEditorLoading"><LoaderCircle className="adminSpin" size={24} /><span>Cargando contenido</span></div>;

  const selectedSection = content.home.sections.find((section) => section.id === selected);
  const previewUrl = previewToken ? `/vista-previa?token=${encodeURIComponent(previewToken)}&r=${previewRevision}` : '';

  return (
    <div className="siteEditor">
      <header className="siteEditor__toolbar">
        <div><span className="adminEyebrow">Experiencia de tienda</span><h1>Editor visual</h1><p><span className={`siteEditor__status ${dirty ? 'isDirty' : ''}`} />{saving ? 'Guardando…' : dirty ? 'Cambios sin publicar' : `Versión ${meta?.version ?? 1} sincronizada`}</p></div>
        <div className="siteEditor__toolbarActions">
          <div className="siteEditor__viewport" role="group" aria-label="Vista previa"><button aria-pressed={viewport === 'desktop'} className={viewport === 'desktop' ? 'isActive' : ''} onClick={() => setViewport('desktop')} title="Escritorio" type="button"><Monitor size={17} /></button><button aria-pressed={viewport === 'mobile'} className={viewport === 'mobile' ? 'isActive' : ''} onClick={() => setViewport('mobile')} title="Celular" type="button"><Smartphone size={17} /></button></div>
          <button className="adminSecondaryButton" disabled={saving || !dirty} onClick={() => void saveDraft(false)} type="button"><Save size={16} /> Guardar</button>
          <button className="adminPrimaryButton" disabled={publishing} onClick={() => void publish()} type="button">{publishing ? <LoaderCircle className="adminSpin" size={16} /> : <Send size={16} />} Publicar</button>
        </div>
      </header>

      <div className="siteEditor__workspace">
        <div className="siteEditor__controls">
          <nav className="siteEditor__rail" aria-label="Secciones editables">
            <button className={selected === 'hero' ? 'isActive' : ''} onClick={() => setSelected('hero')} type="button"><span>01</span>Portada</button>
            <button className={selected === 'header' ? 'isActive' : ''} onClick={() => setSelected('header')} type="button"><span>02</span>Cabecera y menú</button>
            <div className="siteEditor__railLabel">Secciones</div>
            {content.home.sections.map((section, index) => (
              <div className={`siteEditor__sectionRow ${selected === section.id ? 'isActive' : ''}`} key={section.id}>
                <button onClick={() => setSelected(section.id)} type="button"><span>{String(index + 3).padStart(2, '0')}</span>{SECTION_LABELS[section.type]}</button>
                <div>
                  <button aria-label="Mover arriba" disabled={index === 0} onClick={() => moveSection(section.id, -1)} title="Mover arriba" type="button"><ArrowUp size={13} /></button>
                  <button aria-label="Mover abajo" disabled={index === content.home.sections.length - 1} onClick={() => moveSection(section.id, 1)} title="Mover abajo" type="button"><ArrowDown size={13} /></button>
                  <button aria-label={section.enabled ? 'Ocultar sección' : 'Mostrar sección'} onClick={() => updateSection(section.id, { enabled: !section.enabled })} title={section.enabled ? 'Ocultar' : 'Mostrar'} type="button">{section.enabled ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                </div>
              </div>
            ))}
            <div className="siteEditor__railLabel">Global</div>
            <button className={selected === 'footer' ? 'isActive' : ''} onClick={() => setSelected('footer')} type="button"><span>10</span>Pie y contacto</button>
            <button className={selected === 'media' ? 'isActive' : ''} onClick={() => setSelected('media')} type="button"><span>11</span>Imágenes</button>
          </nav>

          <section className="siteEditor__formPane">
            {selected === 'hero' && <HeroEditor content={content} media={media} onChange={updateHero} onUpload={uploadMedia} />}
            {selected === 'header' && <HeaderEditor content={content} media={media} onChange={change} onHeader={updateHeader} onUpload={uploadMedia} />}
            {selected === 'footer' && <FooterEditor content={content} onChange={change} onContact={updateContact} />}
            {selected === 'media' && <MediaLibrary assets={media} onArchive={async (id) => { await request(`/admin/media/${id}`, { method: 'DELETE' }); await refreshMedia(); onNotice('success', 'Imagen archivada.'); }} onUpload={uploadMedia} />}
            {selectedSection && <SectionEditor media={media} onChange={(patch) => updateSection(selectedSection.id, patch)} onUpload={uploadMedia} section={selectedSection} />}
          </section>
        </div>

        <PreviewPane key={`${viewport}-${previewToken}`} previewUrl={previewUrl} revision={previewRevision} viewport={viewport} />
      </div>
    </div>
  );
}

function HeroEditor({ content, media, onChange, onUpload }: { content: SiteContentDocument; media: MediaAsset[]; onChange: <K extends keyof SiteContentDocument['home']['hero']>(key: K, value: SiteContentDocument['home']['hero'][K]) => void; onUpload: UploadMedia }) {
  const hero = content.home.hero;
  return <EditorPanel eyebrow="Primera impresión" title="Portada"><EditorField label="Antetítulo"><input maxLength={100} onChange={(event) => onChange('eyebrow', event.target.value)} value={hero.eyebrow} /></EditorField><div className="siteEditor__fieldGrid"><EditorField label="Nombre"><input maxLength={80} onChange={(event) => onChange('title', event.target.value)} value={hero.title} /></EditorField><EditorField label="Acento"><input maxLength={80} onChange={(event) => onChange('titleAccent', event.target.value)} value={hero.titleAccent} /></EditorField></div><EditorField label="Frase principal"><input maxLength={140} onChange={(event) => onChange('tagline', event.target.value)} value={hero.tagline} /></EditorField><EditorField label="Descripción"><textarea maxLength={320} onChange={(event) => onChange('description', event.target.value)} rows={3} value={hero.description} /></EditorField><ImageField altText={hero.imageAlt} assets={media} label="Imagen de portada" onChange={(url) => onChange('imageUrl', url)} onUpload={onUpload} value={hero.imageUrl} /><EditorField label="Texto alternativo"><input maxLength={180} onChange={(event) => onChange('imageAlt', event.target.value)} value={hero.imageAlt} /></EditorField><LinkFields label="Botón principal" link={hero.primaryLink} onChange={(value) => onChange('primaryLink', value)} /><LinkFields label="Botón secundario" link={hero.secondaryLink} onChange={(value) => onChange('secondaryLink', value)} /></EditorPanel>;
}

function HeaderEditor({ content, media, onChange, onHeader, onUpload }: { content: SiteContentDocument; media: MediaAsset[]; onChange: (update: (current: SiteContentDocument) => SiteContentDocument) => void; onHeader: <K extends keyof SiteContentDocument['global']['header']>(key: K, value: SiteContentDocument['global']['header'][K]) => void; onUpload: UploadMedia }) {
  const { announcement, header } = content.global;
  return <EditorPanel eyebrow="Navegación" title="Cabecera y menú"><label className="siteEditor__toggle"><input checked={announcement.enabled} onChange={(event) => onChange((current) => ({ ...current, global: { ...current.global, announcement: { ...current.global.announcement, enabled: event.target.checked } } }))} type="checkbox" /><span><Check size={12} /></span>Mostrar aviso superior</label><EditorField label="Mensaje superior"><input maxLength={120} onChange={(event) => onChange((current) => ({ ...current, global: { ...current.global, announcement: { ...current.global.announcement, text: event.target.value } } }))} value={announcement.text} /></EditorField><ImageField altText={header.logoAlt} assets={media} label="Logotipo" onChange={(url) => onHeader('logoUrl', url)} onUpload={onUpload} value={header.logoUrl} /><EditorField label="Descripción del logotipo"><input maxLength={120} onChange={(event) => onHeader('logoAlt', event.target.value)} value={header.logoAlt} /></EditorField><div className="siteEditor__divider">Menú principal</div>{header.navigation.map((item, index) => <div className="siteEditor__navItem" key={item.id}><EditorField label={`Enlace ${index + 1}`}><input maxLength={50} onChange={(event) => onHeader('navigation', header.navigation.map((current) => current.id === item.id ? { ...current, label: event.target.value } : current))} value={item.label} /></EditorField><EditorField label="Destino"><input onChange={(event) => onHeader('navigation', header.navigation.map((current) => current.id === item.id ? { ...current, href: event.target.value } : current))} value={item.href} /></EditorField></div>)}<div className="siteEditor__divider">Destacado del menú</div><EditorField label="Antetítulo"><input maxLength={80} onChange={(event) => onHeader('featureEyebrow', event.target.value)} value={header.featureEyebrow} /></EditorField><EditorField label="Título"><input maxLength={120} onChange={(event) => onHeader('featureTitle', event.target.value)} value={header.featureTitle} /></EditorField><EditorField label="Descripción"><textarea maxLength={240} onChange={(event) => onHeader('featureDescription', event.target.value)} rows={2} value={header.featureDescription} /></EditorField><ImageField altText="Destacado del menú" assets={media} label="Imagen destacada" onChange={(url) => onHeader('featureImageUrl', url)} onUpload={onUpload} value={header.featureImageUrl} /><LinkFields label="Acción destacada" link={header.featureLink} onChange={(value) => onHeader('featureLink', value)} /></EditorPanel>;
}

function FooterEditor({ content, onChange, onContact }: { content: SiteContentDocument; onChange: (update: (current: SiteContentDocument) => SiteContentDocument) => void; onContact: (key: keyof SiteContentDocument['global']['contact'], value: string) => void }) {
  const { footer, contact } = content.global;
  const updateFooter = (key: keyof typeof footer, value: string) => onChange((current) => ({ ...current, global: { ...current.global, footer: { ...current.global.footer, [key]: value } } }));
  return <EditorPanel eyebrow="Información global" title="Pie y contacto"><EditorField label="Antetítulo"><input maxLength={80} onChange={(event) => updateFooter('eyebrow', event.target.value)} value={footer.eyebrow} /></EditorField><EditorField label="Título"><input maxLength={140} onChange={(event) => updateFooter('title', event.target.value)} value={footer.title} /></EditorField><EditorField label="Descripción"><textarea maxLength={320} onChange={(event) => updateFooter('description', event.target.value)} rows={3} value={footer.description} /></EditorField><div className="siteEditor__divider">Contacto y ubicación</div><EditorField label="WhatsApp (sólo dígitos)"><input inputMode="numeric" onChange={(event) => onContact('whatsappPhone', event.target.value.replace(/\D/g, ''))} value={contact.whatsappPhone} /></EditorField><EditorField label="WhatsApp visible"><input onChange={(event) => onContact('whatsappLabel', event.target.value)} value={contact.whatsappLabel} /></EditorField><EditorField label="Correo"><input onChange={(event) => onContact('email', event.target.value)} type="email" value={contact.email} /></EditorField><EditorField label="Dirección"><textarea onChange={(event) => onContact('address', event.target.value)} rows={2} value={contact.address} /></EditorField><EditorField label="Google Maps Embed URL"><textarea onChange={(event) => onContact('mapsEmbedUrl', event.target.value)} rows={3} value={contact.mapsEmbedUrl} /></EditorField><EditorField label="Instagram"><input onChange={(event) => onContact('instagramUrl', event.target.value)} type="url" value={contact.instagramUrl} /></EditorField><EditorField label="Facebook"><input onChange={(event) => onContact('facebookUrl', event.target.value)} type="url" value={contact.facebookUrl} /></EditorField></EditorPanel>;
}

function SectionEditor({ section, media, onChange, onUpload }: { section: StorefrontSection; media: MediaAsset[]; onChange: (patch: Partial<StorefrontSection>) => void; onUpload: UploadMedia }) {
  return <EditorPanel eyebrow="Bloque de inicio" title={SECTION_LABELS[section.type]}><label className="siteEditor__toggle"><input checked={section.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} type="checkbox" /><span><Check size={12} /></span>Mostrar sección</label><EditorField label="Antetítulo"><input maxLength={80} onChange={(event) => onChange({ eyebrow: event.target.value })} value={section.eyebrow} /></EditorField><EditorField label="Título"><textarea maxLength={140} onChange={(event) => onChange({ title: event.target.value })} rows={2} value={section.title} /></EditorField><EditorField label="Descripción"><textarea maxLength={700} onChange={(event) => onChange({ description: event.target.value })} rows={4} value={section.description} /></EditorField>{section.type === 'ABOUT' && <EditorField label="Texto complementario"><textarea maxLength={700} onChange={(event) => onChange({ secondaryText: event.target.value })} rows={3} value={section.secondaryText} /></EditorField>}<ImageField altText={section.title} assets={media} label={section.type === 'PROMOTION_BAND' ? 'Imagen principal' : 'Imagen ambiental (opcional)'} onChange={(url) => onChange({ imageUrl: url })} onUpload={onUpload} value={section.imageUrl} allowEmpty /><div className="siteEditor__fieldGrid"><EditorField label="Texto del botón"><input maxLength={80} onChange={(event) => onChange({ ctaLabel: event.target.value })} value={section.ctaLabel} /></EditorField><EditorField label="Destino"><input onChange={(event) => onChange({ ctaHref: event.target.value })} value={section.ctaHref} /></EditorField></div></EditorPanel>;
}

type UploadMedia = (file: File, altText: string) => Promise<MediaAsset>;

function ImageField({ label, value, altText, assets, allowEmpty = false, onChange, onUpload }: { label: string; value: string; altText: string; assets: MediaAsset[]; allowEmpty?: boolean; onChange: (url: string) => void; onUpload: UploadMedia }) {
  const [uploading, setUploading] = useState(false);
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    try { const asset = await onUpload(file, altText || file.name); onChange(asset.url); }
    catch (error) { window.alert(errorMessage(error)); }
    finally { setUploading(false); }
  }
  return <div className="siteEditor__imageField"><span>{label}</span>{value ? <div className="siteEditor__imagePreview"><Image alt={altText || ''} fill loading="eager" sizes="360px" src={value} unoptimized={value.startsWith('http')} /><button aria-label="Quitar imagen" onClick={() => onChange('')} title="Quitar imagen" type="button"><Archive size={14} /></button></div> : <div className="siteEditor__imageEmpty"><ImageIcon size={20} /><span>Sin imagen</span></div>}<div className="siteEditor__imageActions"><label className="adminSecondaryButton">{uploading ? <LoaderCircle className="adminSpin" size={15} /> : <CloudUpload size={15} />} Subir<input accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} type="file" /></label>{assets.length > 0 && <select aria-label="Elegir imagen de la biblioteca" onChange={(event) => event.target.value && onChange(event.target.value)} value=""><option value="">Elegir de biblioteca</option>{assets.map((asset) => <option key={asset.id} value={asset.url}>{asset.fileName}</option>)}</select>}</div><input aria-label={`URL de ${label}`} onChange={(event) => onChange(event.target.value)} placeholder={allowEmpty ? 'URL opcional' : 'URL de imagen'} value={value} /></div>;
}

function MediaLibrary({ assets, onUpload, onArchive }: { assets: MediaAsset[]; onUpload: UploadMedia; onArchive: (id: string) => Promise<void> }) {
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  async function upload(file?: File) { if (!file) return; setUploading(true); try { await onUpload(file, altText || file.name); setAltText(''); } catch (error) { window.alert(errorMessage(error)); } finally { setUploading(false); } }
  return <EditorPanel eyebrow="Biblioteca" title="Imágenes"><div className="mediaLibrary__upload"><EditorField label="Texto alternativo"><input maxLength={180} onChange={(event) => setAltText(event.target.value)} value={altText} /></EditorField><label className="adminPrimaryButton">{uploading ? <LoaderCircle className="adminSpin" size={15} /> : <CloudUpload size={15} />} Cargar imagen<input accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0])} type="file" /></label></div><div className="mediaLibrary__grid">{assets.map((asset) => <article key={asset.id}><div><Image alt={asset.altText || asset.fileName} fill sizes="160px" src={asset.url} unoptimized={asset.url.startsWith('http')} /></div><span><strong>{asset.fileName}</strong><small>{formatBytes(asset.sizeBytes)}</small></span><button aria-label={`Archivar ${asset.fileName}`} onClick={() => void onArchive(asset.id)} title="Archivar" type="button"><Archive size={14} /></button></article>)}</div>{assets.length === 0 && <div className="mediaLibrary__empty"><ImageIcon size={24} /><span>No hay imágenes cargadas</span></div>}</EditorPanel>;
}

function PreviewPane({ previewUrl, revision, viewport }: { previewUrl: string; revision: number; viewport: 'desktop' | 'mobile' }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const virtualWidth = viewport === 'mobile' ? 390 : 1280;
  const virtualHeight = viewport === 'mobile' ? 844 : 900;
  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const update = () => setScale(Math.min(1, Math.max(0.25, (element.clientWidth - 20) / virtualWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [virtualWidth]);
  return <section className="siteEditor__preview"><header><div><span className="adminEyebrow">Vista previa</span><strong>{viewport === 'mobile' ? '390 × 844' : '1280 × 900'}</strong></div><div><button aria-label="Recargar vista previa" onClick={() => { const iframe = stageRef.current?.querySelector('iframe'); if (iframe) iframe.src = iframe.src; }} title="Recargar" type="button"><RefreshCw size={15} /></button>{previewUrl && <a aria-label="Abrir vista previa" href={previewUrl} rel="noreferrer" target="_blank" title="Abrir en pestaña"><ExternalLink size={15} /></a>}</div></header><div className={`siteEditor__previewStage is-${viewport}`} ref={stageRef}><div style={{ height: virtualHeight * scale, width: virtualWidth * scale }}>{previewUrl && <iframe key={`${revision}-${viewport}`} src={previewUrl} style={{ height: virtualHeight, transform: `scale(${scale})`, width: virtualWidth }} title="Vista previa de la tienda" />}</div></div></section>;
}

function EditorPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) { return <div className="siteEditorPanel"><header><span className="adminEyebrow">{eyebrow}</span><h2>{title}</h2></header>{children}</div>; }
function EditorField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="siteEditor__field"><span>{label}</span>{children}</label>; }
function LinkFields({ label, link, onChange }: { label: string; link: { label: string; href: string }; onChange: (value: { label: string; href: string }) => void }) { return <div className="siteEditor__fieldGrid"><EditorField label={`${label}: texto`}><input maxLength={80} onChange={(event) => onChange({ ...link, label: event.target.value })} value={link.label} /></EditorField><EditorField label={`${label}: destino`}><input onChange={(event) => onChange({ ...link, href: event.target.value })} value={link.href} /></EditorField></div>; }

async function getImageDimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
