import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../store';
import { contractorsApi, restrictionTypesApi } from '../../services/api';
import type { Contractor, RestrictionType } from '../../types';

/** Cards de Configurações do módulo Programação Semanal: Empreiteiras e Tipos de Restrição. */

const inStyle: React.CSSProperties = {
  padding: '6px 9px', fontSize: 12, borderRadius: 'var(--r-md)', border: '1px solid var(--bd)',
  background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)', flex: 1, outline: 'none',
};

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  padding: '6px 9px', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)',
  fontSize: 11.5, fontWeight: 600, color: 'var(--t2)',
};

export function ContractorsCard() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;
  const [items, setItems] = useState<Contractor[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setItems(await contractorsApi.list(projectId));
    } catch { /* silencioso */ }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!projectId || !name.trim()) return;
    setBusy(true);
    try {
      await contractorsApi.create(projectId, name.trim());
      setName('');
      await load();
      addToast({ type: 'success', title: 'Empreiteira cadastrada.' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao cadastrar (nome já existe?).' });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (item: Contractor) => {
    try {
      await contractorsApi.update(item.id, { isActive: !item.isActive });
      await load();
    } catch {
      addToast({ type: 'error', title: 'Erro ao atualizar a empreiteira.' });
    }
  };

  const handleRemove = async (item: Contractor) => {
    if (!window.confirm(`Remover a empreiteira "${item.name}"? Atividades já vinculadas ficam sem empresa.`)) return;
    try {
      await contractorsApi.remove(item.id);
      await load();
      addToast({ type: 'success', title: 'Empreiteira removida.' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao remover a empreiteira.' });
    }
  };

  if (!projectId) return null;

  return (
    <div className="ao-card">
      <div className="ao-card-hdr"><span className="ao-card-title">Empreiteiras</span></div>
      <div className="ao-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={inStyle}
            placeholder="Nome da empreiteira…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button className="ao-btn ao-btn-sm ao-btn-primary" onClick={handleAdd} disabled={busy || !name.trim()}>
            + Adicionar
          </button>
        </div>
        {items.length === 0 && (
          <span style={{ fontSize: 11.5, color: 'var(--t3)' }}>Nenhuma empreiteira cadastrada. Elas alimentam a coluna Empresa e o PPC por empreiteira.</span>
        )}
        {items.map((item) => (
          <div key={item.id} style={{ ...rowStyle, opacity: item.isActive ? 1 : 0.55 }}>
            <span>{item.name}</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                className={`ao-badge ${item.isActive ? 'ao-bg' : 'ao-bk'}`}
                style={{ cursor: 'pointer', border: 'none' }}
                onClick={() => toggleActive(item)}
                title="Clique para ativar/inativar"
              >
                {item.isActive ? 'Ativa' : 'Inativa'}
              </button>
              <button
                onClick={() => handleRemove(item)}
                title="Remover"
                style={{ border: 'none', background: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: 13 }}
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RestrictionTypesCard() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;
  const [items, setItems] = useState<RestrictionType[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setItems(await restrictionTypesApi.list(projectId));
    } catch { /* silencioso */ }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!projectId || !name.trim()) return;
    setBusy(true);
    try {
      await restrictionTypesApi.create(projectId, name.trim(), items.length);
      setName('');
      await load();
      addToast({ type: 'success', title: 'Tipo de restrição cadastrado.' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao cadastrar (nome já existe?).' });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (item: RestrictionType) => {
    if (!window.confirm(`Remover o tipo "${item.name}"? Restrições existentes ficam sem tipo.`)) return;
    try {
      await restrictionTypesApi.remove(item.id);
      await load();
      addToast({ type: 'success', title: 'Tipo removido.' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao remover o tipo.' });
    }
  };

  if (!projectId) return null;

  return (
    <div className="ao-card">
      <div className="ao-card-hdr"><span className="ao-card-title">Tipos de Restrição</span></div>
      <div className="ao-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={inStyle}
            placeholder="Novo tipo…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          <button className="ao-btn ao-btn-sm ao-btn-primary" onClick={handleAdd} disabled={busy || !name.trim()}>
            + Adicionar
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.map((item) => (
            <span key={item.id} className="ao-badge ao-bb" style={{ gap: 6, opacity: item.isActive ? 1 : 0.55 }}>
              {item.name}
              <button
                onClick={() => handleRemove(item)}
                title="Remover"
                style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 11, padding: 0 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>
          Os tipos alimentam o indicador "principais causas do não atendimento" no fechamento da semana.
        </span>
      </div>
    </div>
  );
}
