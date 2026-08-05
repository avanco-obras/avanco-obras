import { useMemo, useState } from 'react';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Conteúdo da célula. Padrão: valor bruto de row[key]. */
  render?: (row: T) => React.ReactNode;
  /** Valor usado na ordenação. Padrão: row[key] (número ou string). */
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  /** className aplicado à <td> (ex.: 'mono', 'muted'). */
  cellClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  searchable?: boolean;
  /** Texto pesquisável de cada linha (usado quando searchable). */
  searchAccessor?: (row: T) => string;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  rowStyle?: (row: T) => React.CSSProperties;
  emptyMessage?: string;
  minWidth?: number;
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

function rawValue<T>(row: T, key: string): string | number {
  const v = (row as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : String(v ?? '');
}

/**
 * Tabela genérica com busca e ordenação, reaproveitando o estilo `.ao-table`.
 * Para listas pequenas — sem paginação.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  searchable = false,
  searchAccessor,
  searchPlaceholder = 'Buscar…',
  onRowClick,
  rowStyle,
  emptyMessage = 'Nenhum registro.',
  minWidth,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>(null);

  const filtered = useMemo(() => {
    if (!searchable || !searchAccessor || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => searchAccessor(r).toLowerCase().includes(q));
  }, [rows, query, searchable, searchAccessor]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const val = col.sortValue ?? ((r: T) => rawValue(r, col.key));
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort, columns]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null; // terceiro clique limpa a ordenação
    });
  }

  return (
    <div>
      {searchable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--bd)', background: 'var(--s1)' }}>
          <Search style={{ width: 13, height: 13, color: 'var(--t3)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: 'var(--t1)', fontFamily: 'var(--font)' }}
          />
          {query && (
            <span style={{ fontSize: 10.5, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{sorted.length}</span>
          )}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="ao-table" style={minWidth ? { minWidth } : undefined}>
          <thead>
            <tr>
              {columns.map((c) => {
                const cls = [c.sortable ? 'sortable' : '', c.align === 'right' ? 'num' : ''].filter(Boolean).join(' ');
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={cls || undefined}
                    style={{ width: c.width, textAlign: c.align }}
                    onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
                      {c.header}
                      {c.sortable && active && (sort!.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--t3)', fontSize: 12 }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{ cursor: onRowClick ? 'pointer' : undefined, ...(rowStyle ? rowStyle(row) : {}) }}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.cellClassName} style={{ textAlign: c.align, width: c.width }}>
                      {c.render ? c.render(row) : String(rawValue(row, c.key))}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
