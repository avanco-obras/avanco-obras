import { LEGEND_ITEMS } from '@/lib/measurement-helpers';

export default function ViewerLegend() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        borderRadius: 10,
        padding: '8px 12px',
        boxShadow: '0 2px 12px rgba(15,23,42,0.12)',
        fontSize: 11,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        border: '1px solid rgba(15,23,42,0.06)',
        zIndex: 5,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        Avanço físico
      </div>
      {LEGEND_ITEMS.map((it) => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 12,
              height: 12,
              background: it.color,
              borderRadius: 3,
              border: '1px solid rgba(15,23,42,0.1)',
            }}
          />
          <span style={{ color: '#0F172A' }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}
