import type { LegalSection } from '../shared/lib/legal';

export function LegalPage({ title, sections, updated }: { title: string; sections: LegalSection[]; updated?: string }) {
  return (
    <div className="narrow legal-text">
      <div className="page-head"><p className="overline">Legal</p><h1>{title}</h1>{updated ? <p className="subtle">Actualizado: {updated}</p> : null}</div>
      {sections.map(s => (
        <section key={s.title}><h2>{s.title}</h2>{s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</section>
      ))}
    </div>
  );
}
