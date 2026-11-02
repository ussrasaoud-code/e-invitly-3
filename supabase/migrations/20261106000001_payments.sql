-- Paiement en ligne des invitations (PayPal, carte bancaire via Stripe).
-- Un lien de paiement par commande ; le montant est figé à la création du lien.

create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  invitation_id      uuid not null references public.invitations (id) on delete cascade,
  -- Jeton aléatoire de l'adresse /paiement/<jeton> (jamais l'identifiant interne)
  token              text not null unique check (char_length(token) >= 24),
  amount_cents       integer not null check (amount_cents > 0 and amount_cents <= 10000000),
  currency           text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  description        text not null default '',
  status             text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  method             text check (method in ('paypal', 'stripe', 'manual')),
  paypal_order_id    text unique,
  stripe_session_id  text unique,
  provider_ref       text,
  payer_email        text,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);
create index if not exists payments_invitation_idx on public.payments (invitation_id, created_at desc);

alter table public.payments enable row level security;

-- L'équipe gère tout ; le couple voit les paiements de sa propre invitation.
-- La page publique de paiement passe par le serveur (clé secrète), jamais par le navigateur.
drop policy if exists payments_staff on public.payments;
create policy payments_staff on public.payments for all
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists payments_couple_read on public.payments;
create policy payments_couple_read on public.payments for select
  using (public.has_invitation_access(invitation_id));

notify pgrst, 'reload schema';
