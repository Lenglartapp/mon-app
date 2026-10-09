-- Réceptions Odoo détaillées (2026-10-09).
-- 1) Miroir de la liste de courses : quantités commandée / reçue du dossier (unité d'achat).
alter table public.odoo_course_lines
  add column if not exists quantite_commandee numeric,
  add column if not exists quantite_recue     numeric,
  add column if not exists purchase_uom       text,
  add column if not exists purchase_line      text;

-- 2) Journal des mouvements : une ligne par réception réelle Odoo (project.course.line.droitfil_receptions).
--    Clé « <ligne de courses>:<mouvement Odoo> » : un même mouvement n'est jamais inscrit deux fois.
alter table public.inventory_logs add column if not exists odoo_move_key text;
create unique index if not exists inventory_logs_odoo_move_key_idx
  on public.inventory_logs (odoo_move_key) where odoo_move_key is not null;
