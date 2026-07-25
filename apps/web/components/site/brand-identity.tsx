import Image from 'next/image';

export function BrandIdentity({
  compact = false,
  inverted = false,
  logoUrl = '/images/brand/kiibok-emblem.png',
  logoAlt = "KI'IBOK Exclusivo",
}: {
  compact?: boolean;
  inverted?: boolean;
  logoUrl?: string;
  logoAlt?: string;
}) {
  return (
    <span className={`brandIdentity ${compact ? 'brandIdentity--compact' : ''} ${inverted ? 'brandIdentity--inverted' : ''}`}>
      <span className="brandIdentity__emblem">
        <Image
          alt={logoAlt}
          height={1254}
          priority
          sizes={compact ? '38px' : '52px'}
          src={logoUrl}
          unoptimized={logoUrl.startsWith('http')}
          width={1254}
        />
      </span>
      <span className="brandIdentity__name">
        <strong>KI&apos;IBOK</strong>
        <small>Exclusivo</small>
      </span>
    </span>
  );
}
