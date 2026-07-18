import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function SectionHeading({ eyebrow, title, description, href, linkLabel = 'Ver todo' }: { eyebrow: string; title: string; description?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="sectionHeading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && <Link href={href}>{linkLabel} <ArrowRight aria-hidden="true" size={17} /></Link>}
    </div>
  );
}
