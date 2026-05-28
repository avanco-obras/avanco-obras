# Guia de Importação de Cronograma (CSV/XLSX)

## Visão Geral

O sistema importa atividades do cronograma a partir de um arquivo CSV ou XLSX no formato da EAP. O software:

- Lê **todas as linhas** do arquivo (sem limite de quantidade)
- Cria a **hierarquia** automaticamente a partir do **Código WBS**
- Cria os **vínculos de predecessoras** automaticamente a partir do **ID** da linha referenciada na coluna *Predecessora*

> A importação **substitui todo o cronograma existente** do projeto. Faça backup (baseline) antes se necessário.

---

## Formato do Arquivo

O template padrão segue exatamente as colunas da EAP, **nesta ordem**:

| # | Coluna | Tipo | Obrigatório | Descrição | Exemplo |
|---|--------|------|-------------|-----------|---------|
| 1 | **ID** | Número inteiro | Sim (quando houver predecessora) | Identificador único da linha. Usado para vincular predecessoras. | `1`, `2`, `3` |
| 2 | **Código WBS** | Texto | Sim | Identificador WBS/EAP. Define a hierarquia. | `1`, `1.1`, `1.1.1` |
| 3 | **Atividade** | Texto | Sim | Descrição da atividade. | `Fundação`, `Estrutura` |
| 4 | **Duração** | Número | Não | Duração em dias. Calculado a partir de Início/Término se omitido. | `45`, `60` |
| 5 | **Início** | Data | Sim | Data de início. | `2026-01-15` ou `15/01/2026` |
| 6 | **Término** | Data | Sim | Data de término. | `2026-03-15` ou `15/03/2026` |
| 7 | **% Avanço Físico** | Número (0–100) | Não | Progresso realizado. | `0`, `50`, `100` |
| 8 | **Peso** | Número | Não | Peso relativo para cálculo de progresso. Padrão: `1`. | `0.5`, `1`, `2` |
| 9 | **Responsável** | Texto | Não | Pessoa ou equipe responsável. | `Eng. João Silva`, `Empreiteira Alpha` |
| 10 | **Predecessora** | Texto | Não | **IDs** das predecessoras. Aceita tipo e lag. | `4`, `4TI+2`, `8;10TT` |

---

## Hierarquia (EAP/WBS)

A hierarquia é derivada automaticamente do **Código WBS**:

```
1              → Nível 0 (raiz)
1.1            → Nível 1 (filho de 1)
1.1.1          → Nível 2 (filho de 1.1)
1.1.1.1        → Nível 3 (filho de 1.1.1)
```

Não é necessário declarar o nível: o software cria a árvore automaticamente.

---

## Predecessoras (vínculos pelo ID)

A coluna **Predecessora** referencia outras atividades pelo **ID** da linha, exatamente como na edição direta do cronograma na interface. Após importar todas as linhas, o software cria os vínculos resolvendo os IDs declarados.

### Sintaxe

```
<ID>[<tipo>][<lag>]
```

- **Separador entre predecessoras:** `;` (ponto-e-vírgula)
- **Tipo (opcional, padrão `TI`):**
  - `TI` — **término-início** (uma só começa após a outra terminar) — padrão
  - `II` — **início-início** (ambas começam juntas)
  - `TT` — **término-término** (ambas terminam juntas)
  - `IT` — **início-término** (uma termina quando a outra começa)
- **Lag (opcional):** `+N` ou `-N` dias

> Tipos em inglês (`FS`, `SS`, `FF`, `SF`) também são aceitos como sinônimos.

### Exemplos

| Célula | Significado |
|--------|-------------|
| `5` | Predecessora ID 5, tipo TI, lag 0 |
| `5TI+2` | TI, lag de 2 dias |
| `8II-1` | Início-início, lag −1 dia |
| `5;8TT` | Duas predecessoras: ID 5 (TI) e ID 8 (TT) |
| `5IT+5` | IT (início-término), lag +5 dias |

Se a célula estiver vazia, a atividade não terá predecessora.

> Se o ID referenciado não existir no arquivo, a importação registra o erro e a atividade é criada sem aquele vínculo. Como fallback, valores no formato de WBS (ex.: `1.1.1`) também são aceitos.

---

## Exemplo de planilha

```csv
ID,Código WBS,Atividade,Duração,Início,Término,% Avanço Físico,Peso,Responsável,Predecessora
1,1,OBRA - Projeto Exemplo,365,2026-01-15,2027-01-15,0,1,,
2,1.1,ESTRUTURA,180,2026-01-15,2026-07-15,5,0.4,Eng. João Silva,
3,1.1.1,Fundação,60,2026-01-15,2026-03-15,100,0.2,Eng. João Silva,
4,1.1.1.1,Estacas,45,2026-01-15,2026-02-28,100,0.1,Empreiteira Alpha,
5,1.1.1.2,Blocos,15,2026-03-01,2026-03-15,90,0.1,Empreiteira Alpha,4
6,1.1.2,Pilares e Lajes,120,2026-03-16,2026-07-15,0,0.2,Eng. João Silva,3
7,1.2,ALVENARIA,120,2026-05-15,2026-09-15,0,0.3,Eng. Maria Souza,
8,1.2.1,Vedação interna,90,2026-05-15,2026-08-15,0,0.15,Empreiteira Beta,6II+30
9,1.2.2,Vedação externa,60,2026-07-15,2026-09-15,0,0.15,Empreiteira Beta,8II+60
10,1.3,ACABAMENTO,120,2026-09-16,2027-01-15,0,0.3,Eng. Maria Souza,7
11,1.3.1,Revestimento,90,2026-09-16,2026-12-15,0,0.15,Empreiteira Gamma,9
12,1.3.2,Pintura,45,2026-12-01,2027-01-15,0,0.15,Empreiteira Gamma,11II+15;10TT
```

---

## Nomes de colunas aceitos

O leitor é tolerante a variações em português e inglês:

| Campo | Aceita |
|-------|--------|
| ID | `ID`, `Nº`, `N°`, `#`, `Task ID`, `Unique ID` |
| Código WBS | `Código WBS`, `Código`, `WBS`, `EAP`, `Code` |
| Atividade | `Atividade`, `Nome`, `Tarefa`, `Task Name`, `Activity` |
| Duração | `Duração`, `Duration`, `Dias`, `Days`, `Dur.` |
| Início | `Início`, `Start`, `Start Date`, `Data Início` |
| Término | `Término`, `Fim`, `Finish`, `End`, `Data Término` |
| % Avanço Físico | `% Avanço Físico`, `Avanço Físico`, `% Real`, `% Concluído`, `Progress`, `Actual Progress` |
| Peso | `Peso`, `Weight` |
| Responsável | `Responsável`, `Responsible`, `Resource`, `Resource Names` |
| Predecessora | `Predecessora`, `Predecessoras`, `Predecessor`, `Predecessors`, `Pred.` |

### Formatos de data aceitos

- `YYYY-MM-DD` (recomendado): `2026-01-15`
- `DD/MM/YYYY`: `15/01/2026`
- `MM/DD/YYYY`: `01/15/2026`
- Datas nativas de Excel (XLSX) também são reconhecidas

### Arquivos suportados

- CSV (`.csv`)
- XLSX (`.xlsx`) — recomendado
- XLS (`.xls`)

---

## Como importar

1. Abra a aba **Cronograma** de um projeto
2. Clique em **↑ Importar**
3. (Opcional) Clique em **📥 Baixar template** para obter um XLSX com a estrutura correta
4. Arraste o arquivo CSV/XLSX para a área indicada (ou clique para selecionar)
5. Revise a pré-visualização
6. Clique em **Importar cronograma**

---

## Validações

- Arquivos CSV/XLSX/XLS bem formados
- Presença das colunas obrigatórias: **Código WBS, Atividade, Início, Término**
- Datas em formato válido
- Linhas com Código/Atividade vazios são puladas e listadas em erros
- Predecessora apontando para si mesma é ignorada com aviso
- IDs duplicados: prevalece o último registrado

---

## Resultado da importação

Ao finalizar, o sistema retorna:

- Número de atividades importadas
- Número de vínculos de predecessoras criados
- Número de linhas puladas
- Lista de erros (se houver)
