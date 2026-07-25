import { BadRequestException } from '@nestjs/common';
import {
  STOREFRONT_SECTION_TYPES,
  type SiteContentDocument,
  type StorefrontLink,
} from './site-content.types';

type UnknownRecord = Record<string, unknown>;

function fail(path: string, reason: string): never {
  throw new BadRequestException(`Contenido inválido en ${path}: ${reason}.`);
}

function record(value: unknown, path: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'debe ser un objeto');
  }
  return value as UnknownRecord;
}

function text(value: unknown, path: string, max: number, allowEmpty = false) {
  if (typeof value !== 'string') fail(path, 'debe ser texto');
  const normalized = value.trim();
  if (!allowEmpty && normalized.length === 0) fail(path, 'es obligatorio');
  if (normalized.length > max) fail(path, `no puede superar ${max} caracteres`);
  return normalized;
}

function bool(value: unknown, path: string) {
  if (typeof value !== 'boolean') fail(path, 'debe ser verdadero o falso');
  return value;
}

function safeUrl(value: unknown, path: string, allowEmpty = false) {
  const normalized = text(value, path, 2000, allowEmpty);
  if (!normalized && allowEmpty) return normalized;
  if (normalized.startsWith('/') && !normalized.startsWith('//')) return normalized;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    fail(path, 'debe ser una ruta interna o una URL válida');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    fail(path, 'sólo permite enlaces web seguros');
  }
  return parsed.toString();
}

function link(value: unknown, path: string, allowEmpty = false): StorefrontLink {
  const item = record(value, path);
  const label = text(item.label, `${path}.label`, 80, allowEmpty);
  const href = safeUrl(item.href, `${path}.href`, allowEmpty);
  if ((label && !href) || (!label && href)) fail(path, 'la etiqueta y el enlace deben completarse juntos');
  return { label, href };
}

export function validateSiteContent(input: unknown): SiteContentDocument {
  const root = record(input, 'contenido');
  const global = record(root.global, 'global');
  const announcement = record(global.announcement, 'global.announcement');
  const header = record(global.header, 'global.header');
  const contact = record(global.contact, 'global.contact');
  const footer = record(global.footer, 'global.footer');
  const home = record(root.home, 'home');
  const hero = record(home.hero, 'home.hero');
  const commercePanel = record(home.commercePanel, 'home.commercePanel');

  if (!Array.isArray(header.navigation) || header.navigation.length < 1 || header.navigation.length > 8) {
    fail('global.header.navigation', 'debe tener entre 1 y 8 enlaces');
  }
  const navigationIds = new Set<string>();
  const navigation = header.navigation.map((raw, index) => {
    const item = record(raw, `global.header.navigation.${index}`);
    const id = text(item.id, `global.header.navigation.${index}.id`, 50);
    if (!/^[a-z0-9-]+$/.test(id)) fail(`global.header.navigation.${index}.id`, 'usa sólo minúsculas, números y guiones');
    if (navigationIds.has(id)) fail(`global.header.navigation.${index}.id`, 'no puede repetirse');
    navigationIds.add(id);
    if (item.kind !== 'LINK' && item.kind !== 'PERFUME_MENU') {
      fail(`global.header.navigation.${index}.kind`, 'no es un tipo permitido');
    }
    const kind = item.kind as 'LINK' | 'PERFUME_MENU';
    return {
      id,
      kind,
      label: text(item.label, `global.header.navigation.${index}.label`, 50),
      href: safeUrl(item.href, `global.header.navigation.${index}.href`),
    };
  });

  if (!Array.isArray(home.sections) || home.sections.length < 1 || home.sections.length > 12) {
    fail('home.sections', 'debe tener entre 1 y 12 secciones');
  }
  const sectionIds = new Set<string>();
  const sectionTypes = new Set<string>();
  const sections = home.sections.map((raw, index) => {
    const item = record(raw, `home.sections.${index}`);
    const id = text(item.id, `home.sections.${index}.id`, 60);
    if (!/^[a-z0-9-]+$/.test(id)) fail(`home.sections.${index}.id`, 'usa sólo minúsculas, números y guiones');
    if (sectionIds.has(id)) fail(`home.sections.${index}.id`, 'no puede repetirse');
    sectionIds.add(id);
    if (typeof item.type !== 'string' || !STOREFRONT_SECTION_TYPES.includes(item.type as never)) {
      fail(`home.sections.${index}.type`, 'no es una sección permitida');
    }
    if (sectionTypes.has(item.type)) fail(`home.sections.${index}.type`, 'cada tipo de sección puede aparecer una sola vez');
    sectionTypes.add(item.type);
    return {
      id,
      type: item.type as SiteContentDocument['home']['sections'][number]['type'],
      enabled: bool(item.enabled, `home.sections.${index}.enabled`),
      eyebrow: text(item.eyebrow, `home.sections.${index}.eyebrow`, 80, true),
      title: text(item.title, `home.sections.${index}.title`, 140),
      description: text(item.description, `home.sections.${index}.description`, 700, true),
      secondaryText: text(item.secondaryText, `home.sections.${index}.secondaryText`, 700, true),
      imageUrl: safeUrl(item.imageUrl, `home.sections.${index}.imageUrl`, true),
      ctaLabel: text(item.ctaLabel, `home.sections.${index}.ctaLabel`, 80, true),
      ctaHref: safeUrl(item.ctaHref, `home.sections.${index}.ctaHref`, true),
    };
  });

  const email = text(contact.email, 'global.contact.email', 180);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('global.contact.email', 'debe ser un correo válido');
  const whatsappPhone = text(contact.whatsappPhone, 'global.contact.whatsappPhone', 20);
  if (!/^\d{10,15}$/.test(whatsappPhone)) fail('global.contact.whatsappPhone', 'usa de 10 a 15 dígitos, incluyendo lada internacional');

  const mapsEmbedUrl = safeUrl(contact.mapsEmbedUrl, 'global.contact.mapsEmbedUrl');
  const parsedMap = new URL(mapsEmbedUrl);
  if (!parsedMap.hostname.endsWith('google.com') || !parsedMap.pathname.startsWith('/maps/embed')) {
    fail('global.contact.mapsEmbedUrl', 'debe ser un enlace de inserción de Google Maps');
  }

  return {
    global: {
      announcement: {
        enabled: bool(announcement.enabled, 'global.announcement.enabled'),
        text: text(announcement.text, 'global.announcement.text', 120),
      },
      header: {
        logoUrl: safeUrl(header.logoUrl, 'global.header.logoUrl'),
        logoAlt: text(header.logoAlt, 'global.header.logoAlt', 120),
        navigation,
        menuEyebrow: text(header.menuEyebrow, 'global.header.menuEyebrow', 80),
        featureEyebrow: text(header.featureEyebrow, 'global.header.featureEyebrow', 80),
        featureTitle: text(header.featureTitle, 'global.header.featureTitle', 120),
        featureDescription: text(header.featureDescription, 'global.header.featureDescription', 240),
        featureImageUrl: safeUrl(header.featureImageUrl, 'global.header.featureImageUrl'),
        featureLink: link(header.featureLink, 'global.header.featureLink'),
      },
      contact: {
        whatsappPhone,
        whatsappLabel: text(contact.whatsappLabel, 'global.contact.whatsappLabel', 40),
        email,
        address: text(contact.address, 'global.contact.address', 240),
        mapsEmbedUrl,
        instagramUrl: safeUrl(contact.instagramUrl, 'global.contact.instagramUrl'),
        facebookUrl: safeUrl(contact.facebookUrl, 'global.contact.facebookUrl'),
      },
      footer: {
        eyebrow: text(footer.eyebrow, 'global.footer.eyebrow', 80),
        title: text(footer.title, 'global.footer.title', 140),
        description: text(footer.description, 'global.footer.description', 320),
      },
    },
    home: {
      hero: {
        eyebrow: text(hero.eyebrow, 'home.hero.eyebrow', 100),
        title: text(hero.title, 'home.hero.title', 80),
        titleAccent: text(hero.titleAccent, 'home.hero.titleAccent', 80),
        tagline: text(hero.tagline, 'home.hero.tagline', 140),
        description: text(hero.description, 'home.hero.description', 320),
        imageUrl: safeUrl(hero.imageUrl, 'home.hero.imageUrl'),
        imageAlt: text(hero.imageAlt, 'home.hero.imageAlt', 180),
        primaryLink: link(hero.primaryLink, 'home.hero.primaryLink'),
        secondaryLink: link(hero.secondaryLink, 'home.hero.secondaryLink'),
      },
      commercePanel: {
        productsLabel: text(commercePanel.productsLabel, 'home.commercePanel.productsLabel', 40),
        promotionsLabel: text(commercePanel.promotionsLabel, 'home.commercePanel.promotionsLabel', 40),
        mobilePromotionsLabel: text(commercePanel.mobilePromotionsLabel, 'home.commercePanel.mobilePromotionsLabel', 60),
      },
      sections,
    },
  };
}
