-- Remove a configuração obsoleta "Critério de Avanço Físico".
--
-- A coluna era gravada (default 'COST', editável na tela de Configurações) mas
-- nunca lida: o cálculo de avanço físico usa exclusivamente `weight` e
-- `physical_progress` de `schedule_items` (PhysicalProgressService). Removê-la
-- não altera nenhuma regra de cálculo.
ALTER TABLE "projects" DROP COLUMN IF EXISTS "progress_criteria";
