-- Verrou des profils : le RÔLE et la DÉSACTIVATION (archived_at) ne sont plus modifiables
-- par n'importe quel utilisateur connecté (avant : un utilisateur averti pouvait se passer
-- lui-même administrateur directement en base).
--
-- Règles (vérifiées en base, même en contournant l'appli) :
--   - chacun peut toujours modifier son nom, sa photo, ses infos de contrat… ;
--   - admin : tout ;
--   - ordo / ordo_conf (« Gérer l'équipe » du Planning) : créer, archiver, réactiver, supprimer
--     et changer de rôle les membres de PRODUCTION uniquement (prepa, conf, pose) ;
--   - fonctions serveur (clé service_role, ex. Paramètres › Utilisateurs) : tout.
-- À exécuter une fois dans l'éditeur SQL de Supabase.

create or replace function public.df_my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.df_guard_profiles() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me text;
  prod text[] := array['prepa', 'conf', 'pose'];
  team_mgr boolean;
begin
  -- Pas d'utilisateur connecté derrière la requête : clé service_role ou traitement interne.
  if auth.uid() is null then return coalesce(new, old); end if;

  me := public.df_my_role();
  if me = 'admin' then return coalesce(new, old); end if;
  team_mgr := me in ('ordo', 'ordo_conf');

  if tg_op = 'INSERT' then
    if team_mgr and new.role = any(prod) then return new; end if;
    raise exception 'Création de profil réservée aux administrateurs.';
  elsif tg_op = 'DELETE' then
    if team_mgr and old.role = any(prod) then return old; end if;
    raise exception 'Suppression de profil réservée aux administrateurs.';
  end if;

  -- UPDATE
  if new.role is distinct from old.role
     and not (team_mgr and old.role = any(prod) and new.role = any(prod)) then
    raise exception 'Changement de rôle réservé aux administrateurs.';
  end if;
  if new.archived_at is distinct from old.archived_at
     and not (team_mgr and old.role = any(prod)) then
    raise exception 'Désactivation réservée aux administrateurs.';
  end if;
  return new;
end $$;

drop trigger if exists df_guard_profiles on public.profiles;
create trigger df_guard_profiles
  before insert or update or delete on public.profiles
  for each row execute function public.df_guard_profiles();
