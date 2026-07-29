import { ImageOff } from 'lucide-react';

export function ProductMediaPlaceholder({
  name,
  compact = false,
}: {
  name: string;
  compact?: boolean;
}) {
  return (
    <span
      aria-label={`Fotografía pendiente de ${name}`}
      className={`productMediaPlaceholder ${compact ? 'productMediaPlaceholder--compact' : ''}`}
      role="img"
    >
      <ImageOff aria-hidden="true" size={compact ? 18 : 28} strokeWidth={1.5} />
      <span>{compact ? 'Sin foto' : 'Fotografía pendiente'}</span>
    </span>
  );
}
