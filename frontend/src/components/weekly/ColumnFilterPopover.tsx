import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  /** Valores distintos da coluna. */
  values: string[];
  /** Seleção atual (undefined = sem filtro = todos). */
  selected?: string[];
  onChange: (selected: string[] | undefined) => void;
  onClose: () => void;
  /** Posição (viewport) do botão que abriu o popover. */
  anchor: { top: number; left: number };
}

/**
 * Popover de filtro estilo Excel: busca digitável + checkboxes de todos os
 * valores da coluna, "(Todos)" e multi-seleção. Seleção completa = sem filtro.
 */
export default function ColumnFilterPopover({ values, selected, onChange, onClose, anchor }: Props) {
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const picked = selected ?? values;
  const allChecked = picked.length === values.length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? values.filter((v) => v.toLowerCase().includes(q)) : values;
  }, [values, search]);

  useEffect(() => {
    searchRef.current?.focus();
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const emit = (next: string[]) => {
    onChange(next.length === values.length ? undefined : next);
  };

  const toggle = (value: string, checked: boolean) => {
    emit(checked ? [...picked, value] : picked.filter((v) => v !== value));
  };

  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - 240));

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', top: anchor.top + 4, left, zIndex: 60,
        minWidth: 200, maxWidth: 260, background: 'var(--s0)',
        border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
      }}
    >
      <div style={{ padding: '8px 10px 4px' }}>
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar…"
          aria-label="Buscar valores"
          style={{
            width: '100%', fontSize: 11, padding: '5px 8px', borderRadius: 'var(--r-md)',
            border: '1px solid var(--bd2)', background: 'var(--s1)', color: 'var(--t1)',
            fontFamily: 'var(--font)', outline: 'none',
          }}
        />
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px 6px 8px', display: 'flex', flexDirection: 'column' }}>
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 700,
            color: 'var(--t1)', padding: '4px 6px 7px', cursor: 'pointer',
            borderBottom: '1px solid var(--bd)', marginBottom: 3,
          }}
        >
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => emit(e.target.checked ? [...values] : [])}
            style={{ accentColor: 'var(--blue)' }}
          />
          (Todos)
        </label>
        {visible.map((value) => (
          <label
            key={value}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5,
              color: 'var(--t2)', padding: '4px 6px', borderRadius: 'var(--r-md)', cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={picked.includes(value)}
              onChange={(e) => toggle(value, e.target.checked)}
              style={{ accentColor: 'var(--blue)' }}
            />
            {value}
          </label>
        ))}
        {visible.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--t3)', padding: '6px' }}>Nenhum valor encontrado</span>
        )}
      </div>
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px',
          borderTop: '1px solid var(--bd)', background: 'var(--s1)',
        }}
      >
        <button
          type="button"
          onClick={() => { onChange(undefined); onClose(); }}
          style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--red)', border: 'none', background: 'none', cursor: 'pointer' }}
        >
          Limpar filtro
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--blue)', border: 'none', background: 'none', cursor: 'pointer' }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
