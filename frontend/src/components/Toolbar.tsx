import {
  useCallback, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

/**
 * Barra de ferramentas padronizada das telas (Cronograma, Medição, Linha de
 * Balanço, Programação Semanal).
 *
 * Constrói sobre `.ao-btn` do index.css — NÃO sobre os componentes shadcn de
 * `components/ui/`, que usam Tailwind e formam outro sistema visual.
 *
 * Tamanho, fonte e espaçamento vivem só aqui: um botão presente em duas telas
 * fica idêntico por construção, não por disciplina.
 */

// ── Toolbar ───────────────────────────────────────────────────────────────────

export function Toolbar({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', ...style }}>
      {children}
    </div>
  );
}

export function ToolbarSeparator() {
  return <div style={{ width: 1, height: 18, background: 'var(--bd)', flexShrink: 0 }} />;
}

/** Empurra o que vem depois para a direita da barra. */
export function ToolbarSpacer() {
  return <div style={{ flex: 1, minWidth: 8 }} />;
}

// ── ToolbarButton ─────────────────────────────────────────────────────────────

interface ToolbarButtonBase {
  icon?: ReactNode;
  variant?: 'default' | 'primary';
  disabled?: boolean;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
}

/**
 * União discriminada: botão sem rótulo visível (só ícone) exige `ariaLabel`.
 * O TypeScript barra em tempo de compilação um ícone puro inacessível.
 */
export type ToolbarButtonProps =
  | (ToolbarButtonBase & { label: string; ariaLabel?: string })
  | (ToolbarButtonBase & { label?: undefined; ariaLabel: string });

export function ToolbarButton(props: ToolbarButtonProps) {
  const { icon, variant = 'default', disabled, title, onClick, style, label, ariaLabel } = props;
  const iconOnly = label === undefined;

  return (
    <button
      type="button"
      className={`ao-btn ao-btn-sm${variant === 'primary' ? ' ao-btn-primary' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      style={{ padding: iconOnly ? '3px 6px' : undefined, ...style }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Campos com ícone sobreposto ───────────────────────────────────────────────

/**
 * `<select>` e `<input>` nativos não aceitam SVG interno. O ícone é posicionado
 * por cima com `position: absolute`, e o campo ganha `padding-left` para abrir
 * espaço.
 */
function FieldWithIcon({ icon, children, width }: { icon: ReactNode; children: ReactNode; width?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width }}>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', left: 7, display: 'flex', color: 'var(--t3)',
          pointerEvents: 'none', lineHeight: 0,
        }}
      >
        {icon}
      </span>
      {children}
    </span>
  );
}

const FIELD_STYLE: CSSProperties = {
  padding: '3px 8px 3px 24px',
  fontSize: 11,
  fontFamily: 'var(--font)',
  border: '1px solid var(--bd)',
  borderRadius: 'var(--r-md)',
  background: 'var(--s0)',
  color: 'var(--t1)',
  height: 24,
  width: '100%',
};

export function ToolbarSearch({ value, onChange, placeholder = 'Buscar…', width = 170, ariaLabel }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
  ariaLabel?: string;
}) {
  return (
    <FieldWithIcon icon={<Search size={12} />} width={width}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        style={FIELD_STYLE}
      />
    </FieldWithIcon>
  );
}

export function ToolbarSelect<T extends string | number>({
  icon, value, onChange, options, title, ariaLabel, width = 'auto',
}: {
  icon: ReactNode;
  value: T;
  onChange: (v: string) => void;
  options: Array<{ value: T; label: string }>;
  title?: string;
  ariaLabel: string;
  width?: number | 'auto';
}) {
  return (
    <FieldWithIcon icon={icon} width={width === 'auto' ? undefined : width}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={title}
        aria-label={ariaLabel}
        style={{ ...FIELD_STYLE, cursor: 'pointer', width: width === 'auto' ? undefined : '100%' }}
      >
        {options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
      </select>
    </FieldWithIcon>
  );
}

/**
 * Select precedido de um rótulo textual (ex.: `Torre: [—]`). Usado onde um
 * ícone seria ambíguo — dois selects do mesmo domínio pedem palavras, não
 * pictogramas parecidos.
 */
export function ToolbarLabeledSelect<T extends string>({
  label, value, onChange, options, disabled, placeholder = '—',
}: {
  label: string;
  value: T | null;
  onChange: (v: string | null) => void;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
      <span style={{ color: 'var(--t2)' }}>{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        style={{ ...FIELD_STYLE, paddingLeft: 8, width: 'auto', cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/**
 * Botão de alternância (liga/desliga). Diferente do `ToolbarToggleGroup`: aqui
 * cada botão é independente, e o estado ligado é sinalizado por realce suave —
 * não pelo azul sólido do `primary`, reservado à ação principal da tela.
 */
export function ToolbarToggle({ active, icon, label, onClick, title }: {
  active: boolean;
  icon?: ReactNode;
  label: ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="ao-btn ao-btn-sm"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={active
        ? { background: 'var(--blu-bg, #eff6ff)', borderColor: 'var(--blue)', color: 'var(--blue)' }
        : undefined}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Grupo segmentado — seleção exclusiva entre modos de visualização. Os botões
 * ficam colados numa moldura única, sinalizando que são alternativas de um
 * mesmo eixo, não ações independentes.
 */
export function ToolbarToggleGroup<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode; icon?: ReactNode; title?: string }>;
}) {
  return (
    <div
      role="group"
      style={{ display: 'flex', borderRadius: 'var(--r-md)', border: '1px solid var(--bd)', overflow: 'hidden' }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            className="ao-btn ao-btn-sm"
            onClick={() => onChange(o.value)}
            title={o.title}
            aria-pressed={active}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: active ? 'var(--blue)' : 'transparent',
              color: active ? '#fff' : 'var(--t2)',
              border: 'none', borderRadius: 0,
            }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── ToolbarMenu ───────────────────────────────────────────────────────────────

export interface ToolbarMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  /** Ação destrutiva — recebe tratamento visual de perigo. */
  danger?: boolean;
  disabled?: boolean;
  /** Insere uma divisória acima deste item. */
  separatorBefore?: boolean;
}

/**
 * Botão com menu suspenso. Renderiza em portal com `position: fixed` para
 * escapar do `overflow: hidden` dos cards e do scroll do container.
 */
export function ToolbarMenu({ label, icon, items, children, disabled, variant = 'default', title, align = 'left', minWidth = 190 }: {
  label: string;
  icon?: ReactNode;
  /** Lista de ações. Ignorado quando `children` é fornecido. */
  items?: ToolbarMenuItem[];
  /** Painel livre — para conteúdo que não é lista de ações (ex.: checkboxes). */
  children?: ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'primary';
  title?: string;
  align?: 'left' | 'right';
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos(align === 'right'
      ? { top: r.bottom + 4, right: window.innerWidth - r.right }
      : { top: r.bottom + 4, left: r.left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`ao-btn ao-btn-sm${variant === 'primary' ? ' ao-btn-primary' : ''}`}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {icon}
        {label}
        <ChevronDown size={11} style={{ opacity: 0.6 }} />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          role={children ? undefined : 'menu'}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, right: pos.right,
            zIndex: 1000, minWidth,
            background: 'var(--s0)', border: '1px solid var(--bd2)',
            borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden', padding: children ? 8 : '4px 0',
          }}
        >
          {children ?? items?.map((item) => (
            <div key={item.label}>
              {item.separatorBefore && (
                <div style={{ height: 1, background: 'var(--bd)', margin: '4px 0' }} />
              )}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onClick(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  textAlign: 'left', fontSize: 11.5, fontWeight: 500,
                  padding: '8px 12px', border: 'none', background: 'none',
                  color: item.danger ? 'var(--red-t)' : 'var(--t2)',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.5 : 1,
                  fontFamily: 'var(--font)',
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled) {
                    e.currentTarget.style.background = item.danger ? 'var(--red-bg)' : 'var(--s1)';
                  }
                }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
              >
                {item.icon}
                {item.label}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
