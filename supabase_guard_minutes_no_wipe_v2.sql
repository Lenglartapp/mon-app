-- =============================================================================
-- Garde-fou anti-vidage des devis (table minutes) — version 2
-- =============================================================================
-- Avant : dès qu'un des trois tableaux (lignes, déplacements, autres dépenses)
-- devenait vide, l'ancien contenu était remis. Supprimer la DERNIÈRE ligne d'un
-- tableau était donc impossible : la ligne revenait à la réouverture du devis.
--
-- Maintenant :
--   • un tableau peut devenir vide ([]) tant que le devis garde du contenu
--     dans au moins un tableau (suppression volontaire de la dernière ligne) ;
--   • le vidage COMPLET du devis (les trois tableaux vides d'un coup) reste
--     bloqué : c'est le vrai accident (éditeur monté avant la fin du chargement) ;
--   • une valeur absente ou invalide (null, pas un tableau) reste toujours
--     refusée : ce n'est jamais une suppression voulue.
-- L'appli garde de son côté ses propres garde-fous (seule une suppression
-- confirmée peut envoyer un tableau vide).
-- =============================================================================

create or replace function public.guard_minutes_no_wipe()
returns trigger
language plpgsql
as $function$
declare
  -- Tailles calculées sans risque d'erreur (jsonb_array_length n'est appelé que sur un tableau).
  old_lines int := case when jsonb_typeof(old.lines) = 'array' then jsonb_array_length(old.lines) else 0 end;
  old_dep   int := case when jsonb_typeof(old.deplacements) = 'array' then jsonb_array_length(old.deplacements) else 0 end;
  old_extra int := case when jsonb_typeof(old."extraDepenses") = 'array' then jsonb_array_length(old."extraDepenses") else 0 end;
  new_lines_ok boolean := coalesce(jsonb_typeof(new.lines) = 'array', false);
  new_dep_ok   boolean := coalesce(jsonb_typeof(new.deplacements) = 'array', false);
  new_extra_ok boolean := coalesce(jsonb_typeof(new."extraDepenses") = 'array', false);
  new_lines int := case when new_lines_ok then jsonb_array_length(new.lines) else 0 end;
  new_dep   int := case when new_dep_ok   then jsonb_array_length(new.deplacements) else 0 end;
  new_extra int := case when new_extra_ok then jsonb_array_length(new."extraDepenses") else 0 end;
  devis_garde_du_contenu boolean := (new_lines + new_dep + new_extra) > 0;
begin
  -- Lignes : valeur invalide, ou vidage alors que tout le devis serait vide → on garde l'ancien contenu.
  if old_lines > 0 and (not new_lines_ok or (new_lines = 0 and not devis_garde_du_contenu)) then
    new.lines := old.lines;
  end if;
  -- Déplacements
  if old_dep > 0 and (not new_dep_ok or (new_dep = 0 and not devis_garde_du_contenu)) then
    new.deplacements := old.deplacements;
  end if;
  -- Autres dépenses
  if old_extra > 0 and (not new_extra_ok or (new_extra = 0 and not devis_garde_du_contenu)) then
    new."extraDepenses" := old."extraDepenses";
  end if;
  return new;
end;
$function$;

-- Le déclencheur trg_guard_minutes_no_wipe existant appelle déjà cette fonction :
-- remplacer la fonction suffit, rien d'autre à recréer.

-- =============================================================================
-- RETOUR ARRIÈRE (version d'origine, relevée en base le 2026-10-14) :
-- =============================================================================
-- create or replace function public.guard_minutes_no_wipe()
-- returns trigger language plpgsql as $function$
-- begin
--   if jsonb_typeof(old.lines) = 'array' and jsonb_array_length(old.lines) > 0
--      and (new.lines is null or jsonb_typeof(new.lines) <> 'array' or jsonb_array_length(new.lines) = 0) then
--     new.lines := old.lines;
--   end if;
--   if jsonb_typeof(old.deplacements) = 'array' and jsonb_array_length(old.deplacements) > 0
--      and (new.deplacements is null or jsonb_typeof(new.deplacements) <> 'array' or jsonb_array_length(new.deplacements) = 0) then
--     new.deplacements := old.deplacements;
--   end if;
--   if jsonb_typeof(old."extraDepenses") = 'array' and jsonb_array_length(old."extraDepenses") > 0
--      and (new."extraDepenses" is null or jsonb_typeof(new."extraDepenses") <> 'array' or jsonb_array_length(new."extraDepenses") = 0) then
--     new."extraDepenses" := old."extraDepenses";
--   end if;
--   return new;
-- end;
-- $function$;
