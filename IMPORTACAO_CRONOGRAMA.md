# 📊 Guia de Importação de Cronograma (CSV/XLSX)

## 📋 Visão Geral

O sistema permite importar atividades do cronograma a partir de arquivos CSV ou XLSX (padrão MS Project). Esta funcionalidade é ideal para:

- ✅ Importar dados de projetos em MS Project, Excel ou outras ferramentas
- ✅ Atualizar cronogramas completos de uma só vez
- ✅ Manter a hierarquia de atividades (EAP/WBS) automaticamente

⚠️ **Importante:** A importação **substitui todo o cronograma existente**. Faça backup se necessário.

---

## 📁 Formato do Arquivo

### Colunas Esperadas

O arquivo deve conter as seguintes colunas:

| Coluna | Tipo | Obrigatório | Descrição | Exemplo |
|--------|------|-------------|-----------|---------|
| **Código** | Texto | ✅ SIM | WBS/EAP da atividade. Define a hierarquia. | `1`, `1.1`, `1.1.1` |
| **Nome** | Texto | ✅ SIM | Descrição da atividade | `Fundação`, `Estrutura` |
| **Nível** | Número | ❌ Não | Nível hierárquico (0-9). Derivado do código se omitido. | `0`, `1`, `2` |
| **Início** | Data | ✅ SIM | Data de início da atividade | `2026-01-15` ou `15/01/2026` |
| **Término** | Data | ✅ SIM | Data de término da atividade | `2026-03-15` ou `15/03/2026` |
| **Duração** | Número | ❌ Não | Duração em dias. Calculado automaticamente se omitido. | `45`, `60` |
| **% Plan** | Número | ❌ Não | Progresso planejado (0-100) | `80`, `100` |
| **% Real** | Número | ❌ Não | Progresso realizado (0-100) | `50`, `95` |
| **Caminho Crítico** | Texto | ❌ Não | Y/N, S/N ou Sim/Não | `Y`, `N`, `S` |
| **Peso** | Número | ❌ Não | Peso relativo para cálculo de progresso. Padrão: 1 | `0.5`, `1`, `2` |

---

## 🏗️ Estrutura Hierárquica (WBS/EAP)

### Como funciona

O sistema derivará automaticamente a hierarquia a partir do **Código WBS**:

```
1              → Nível 0 (Projeto raiz)
1.1            → Nível 1 (Filho de 1)
1.1.1          → Nível 2 (Filho de 1.1)
1.1.1.1        → Nível 3 (Filho de 1.1.1)
```

### Exemplo de Hierarquia Completa

```csv
Código,Nome,Nível,Início,Término,Duração,% Plan,% Real,Caminho Crítico,Peso
1,OBRA - Condomínio Vila Nova,0,2026-01-15,2027-01-15,365,0,0,N,1
1.1,ESTRUTURA,1,2026-01-15,2026-07-15,180,10,5,Y,0.4
1.1.1,Fundação,2,2026-01-15,2026-03-15,60,100,100,Y,0.2
1.1.1.1,Estacas,3,2026-01-15,2026-02-28,45,100,100,Y,0.1
1.1.1.2,Blocos,3,2026-03-01,2026-03-15,15,100,90,Y,0.1
1.1.2,Pilares e Lajes,2,2026-03-16,2026-07-15,120,5,0,Y,0.2
1.2,ALVENARIA,1,2026-05-15,2026-09-15,120,0,0,N,0.3
1.2.1,Vedação interna,2,2026-05-15,2026-08-15,90,0,0,N,0.15
1.2.2,Vedação externa,2,2026-07-15,2026-09-15,60,0,0,N,0.15
1.3,ACABAMENTO,1,2026-09-16,2027-01-15,120,0,0,N,0.3
1.3.1,Revestimento,2,2026-09-16,2026-12-15,90,0,0,N,0.15
1.3.2,Pintura,2,2026-12-01,2027-01-15,45,0,0,N,0.15
```

---

## 📝 Formatos Aceitos

### Nomes de Colunas Aceitos (português e inglês)

O sistema é flexível e aceita diferentes nomes:

- **Código:** `Código`, `Code`, `WBS`, `EAP`
- **Nome:** `Nome`, `Name`, `Tarefa`, `Task Name`, `Activity`
- **Nível:** `Nível`, `Level`, `Outline Level`
- **Início:** `Início`, `Start`, `Data Início`, `Start Date`
- **Término:** `Término`, `Fim`, `Finish`, `End`, `Data Término`
- **Duração:** `Duração`, `Duration`, `Dur.`, `Days`
- **% Plano:** `% Plan`, `% Planejado`, `Prog. Plan`, `Planned Progress`
- **% Real:** `% Real`, `% Realizado`, `% Concluído`, `Actual Progress`, `Progress`
- **Caminho Crítico:** `Caminho Crítico`, `Critical`, `Critical Path`
- **Peso:** `Peso`, `Weight`

### Formatos de Data Aceitos

- ✅ `YYYY-MM-DD` (recomendado): `2026-01-15`
- ✅ `DD/MM/YYYY`: `15/01/2026`
- ✅ `MM/DD/YYYY`: `01/15/2026`

### Arquivos Suportados

- ✅ **CSV** (.csv) — Texto separado por vírgulas
- ✅ **XLSX** (.xlsx) — Excel moderno (recomendado)
- ✅ **XLS** (.xls) — Excel antigo

---

## 🔧 Campos Obrigatórios

Estes campos **devem estar presentes** em todas as linhas:

1. **Código** — Identificador WBS único (ex: `1.2.3`)
2. **Nome** — Descrição da atividade (não pode estar vazio)
3. **Início** — Data de início em formato válido
4. **Término** — Data de término em formato válido

Se qualquer desses campos estiver vazio ou inválido, a linha será **pulada** e listada nos erros de importação.

---

## 📥 Como Importar

### Passo 1: Acessar a Importação

1. Abra a aba **Cronograma** de um projeto
2. Clique no botão **"↑ Importar CSV/XLSX"** na toolbar

### Passo 2: Preparar o Arquivo

**Opção A:** Usar o template padrão
- No modal, clique em **"📥 Baixar template"**
- Abra o arquivo em Excel ou editor de texto
- Modifique os dados conforme necessário
- Salve como CSV ou XLSX

**Opção B:** Criar seu próprio arquivo
- Use a tabela de colunas acima como referência
- Mantenha o WBS consistente e único
- Valide as datas antes de importar

### Passo 3: Selecionar o Arquivo

- Arraste o arquivo para a área de drop, ou
- Clique para selecionar manualmente
- O sistema previsualizará as 5 primeiras linhas

### Passo 4: Confirmar Importação

- Revise a prévia dos dados
- Leia o aviso: **"Isso substituirá todas as atividades"**
- Clique em **"Importar cronograma"** para confirmar

---

## ✔️ Validações Realizadas

O sistema valida:

- ✅ Arquivos bem formados (CSV/XLSX válidos)
- ✅ Colunas obrigatórias presentes
- ✅ Datas em formato válido
- ✅ Códigos WBS únicos por arquivo
- ✅ Hierarquia derivada corretamente do WBS

Se há erros, você receberá um relatório informando:
- Número de atividades importadas com sucesso
- Número de linhas puladas
- Lista de erros específicos (ex: `Linha 5: data inválida`)

---

## 📊 Resultado da Importação

Após importar com sucesso, você verá:

- ✅ Mensagem de sucesso com número de atividades importadas
- ✅ Cronograma atualizado com todas as atividades
- ✅ Hierarquia WBS mantida
- ✅ Progresso planejado e realizado carregados
- ✅ Caminhos críticos marcados (se informado)

---

## ⚠️ Dicas Importantes

### ✅ Faça

- ✅ Use o template fornecido como base
- ✅ Mantenha códigos WBS consistentes (ex: `1`, `1.1`, `1.1.1`)
- ✅ Use datas no formato `YYYY-MM-DD` para evitar ambiguidades
- ✅ Teste com um arquivo pequeno primeiro
- ✅ Verifique se as percentagens estão entre 0-100
- ✅ Salve backup do cronograma anterior

### ❌ Não Faça

- ❌ Deixar linhas com Código ou Nome vazios
- ❌ Usar códigos WBS duplicados
- ❌ Datas inversas (Término antes de Início)
- ❌ Percentagens > 100 ou < 0
- ❌ Espaços extras nos códigos WBS
- ❌ Importar sem revisar a prévia

---

## 🆘 Troubleshooting

### "Arquivo inválido ou corrompido"
- Verifique se o arquivo está bem formado
- Tente salvar novamente em XLSX
- Abra em um editor para verificar caracteres especiais

### "Colunas obrigatórias não encontradas"
- Verifique os nomes das colunas
- Use os nomes sugeridos na tabela
- Baixe o template e use como referência

### "Linha X: data inválida"
- Formato deve ser `YYYY-MM-DD` ou `DD/MM/YYYY`
- Evite formatos como `01-15-2026`
- Não use texto nas datas

### "Linhas puladas na importação"
- Revise o relatório de erros
- Corrija os dados que causaram erro
- Re-importe o arquivo corrigido

---

## 📞 Suporte

Se encontrar problemas, verifique:

1. A seção **Troubleshooting** acima
2. O formato do seu arquivo contra o template
3. Se os dados obrigatórios estão preenchidos
4. Se as datas estão válidas

Bom uso! 🚀
