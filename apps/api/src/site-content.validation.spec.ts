import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SITE_CONTENT } from './content/site-content.defaults';
import { validateSiteContent } from './content/site-content.validation';

function contentCopy() {
  return structuredClone(DEFAULT_SITE_CONTENT);
}

test('acepta el documento editorial inicial completo', () => {
  const content = validateSiteContent(contentCopy());

  assert.equal(content.home.sections.length, 6);
  assert.equal(content.global.contact.whatsappPhone, '529993020863');
});

test('rechaza protocolos ejecutables en enlaces e imágenes', () => {
  const content = contentCopy();
  content.home.hero.imageUrl = 'javascript:alert(1)';

  assert.throws(() => validateSiteContent(content), /sólo permite enlaces web seguros/);
});

test('rechaza tipos de sección duplicados', () => {
  const content = contentCopy();
  content.home.sections[1].type = content.home.sections[0].type;

  assert.throws(() => validateSiteContent(content), /cada tipo de sección puede aparecer una sola vez/);
});

test('limita el iframe de ubicación a Google Maps Embed', () => {
  const content = contentCopy();
  content.global.contact.mapsEmbedUrl = 'https://example.com/mapa';

  assert.throws(() => validateSiteContent(content), /enlace de inserción de Google Maps/);
});

test('permite ocultar redes sociales mientras no haya perfiles oficiales', () => {
  const content = contentCopy();
  content.global.contact.instagramUrl = '';
  content.global.contact.facebookUrl = '';

  const validated = validateSiteContent(content);

  assert.equal(validated.global.contact.instagramUrl, '');
  assert.equal(validated.global.contact.facebookUrl, '');
});
