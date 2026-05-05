-- ============================================================================
-- Setup test-brugere til Fase 2 sikkerhedstest
-- ============================================================================
-- ⚠ VIGTIGT: MARKER HELE FILEN (Ctrl+A) OG TRYK RUN ÉN GANG.
-- Hvis du kører sektioner enkeltvis fejler det.
-- ============================================================================
--
-- Opretter 5 test-brugere fordelt på 3 husstande, alle med:
--   - Password 'Abc123456'
--   - email_confirmed_at sat (ingen email-godkendelse)
--   - setup_completed_at sat (wizard skippet)
--
-- Strategi:
--   1. Cleanup MED normale cascades (replica='origin' så FK-cascades virker)
--   2. INSERT households (ingen triggers vi skal bekymre os om)
--   3. SKIFT til replica='replica' så handle_new_user ikke fyrer
--   4. INSERT auth.users + auth.identities
--   5. SKIFT TILBAGE til replica='origin'
--   6. INSERT family_members + kategorier + konti + transaktioner
--   7. Verifikations-SELECT
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Cleanup med normale cascades (vigtigt: 'origin' ikke 'replica')
-- ----------------------------------------------------------------------------
SET session_replication_role = 'origin';

-- Slet family_members med vores test-user_ids (kunne være orphan fra
-- tidligere failed runs eller auto-oprettet af handle_new_user-trigger).
DELETE FROM public.family_members
  WHERE user_id IN (
    'a1111111-1111-1111-1111-111111111111'::uuid,
    'a2222222-2222-2222-2222-222222222222'::uuid,
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '0fffffff-ffff-ffff-ffff-ffffffffffff'::uuid
  );

-- Slet auth.identities EKSPLICIT (FK-cascade fungerer ikke hvis replica
-- nogensinde har været aktiv mens auth.users blev slettet).
DELETE FROM auth.identities
  WHERE user_id IN (
    'a1111111-1111-1111-1111-111111111111'::uuid,
    'a2222222-2222-2222-2222-222222222222'::uuid,
    'b1111111-1111-1111-1111-111111111111'::uuid,
    'b2222222-2222-2222-2222-222222222222'::uuid,
    '0fffffff-ffff-ffff-ffff-ffffffffffff'::uuid
  );

DELETE FROM auth.users
  WHERE email LIKE 'mikkelstaehrmadsen+test%@gmail.com';

DELETE FROM public.households
  WHERE name IN ('Household A', 'Household B', 'Outsider Solo');

-- ----------------------------------------------------------------------------
-- 2. Opret husstande (med normale cascades)
-- ----------------------------------------------------------------------------
INSERT INTO public.households (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Household A'),
  ('22222222-2222-2222-2222-222222222222', 'Household B'),
  ('33333333-3333-3333-3333-333333333333', 'Outsider Solo');

-- ----------------------------------------------------------------------------
-- 3. Aktiver replica-mode så handle_new_user-trigger IKKE fyrer
-- ----------------------------------------------------------------------------
SET session_replication_role = 'replica';

-- ----------------------------------------------------------------------------
-- 4. Opret auth.users med bekræftet email
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('00000000-0000-0000-0000-000000000000',
   'a1111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated',
   'mikkelstaehrmadsen+testA1@gmail.com',
   crypt('Abc123456', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Test A1"}'::jsonb,
   now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   'a2222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated',
   'mikkelstaehrmadsen+testA2@gmail.com',
   crypt('Abc123456', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Test A2"}'::jsonb,
   now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   'b1111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated',
   'mikkelstaehrmadsen+testB1@gmail.com',
   crypt('Abc123456', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Test B1"}'::jsonb,
   now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   'b2222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated',
   'mikkelstaehrmadsen+testB2@gmail.com',
   crypt('Abc123456', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Test B2"}'::jsonb,
   now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   '0fffffff-ffff-ffff-ffff-ffffffffffff',
   'authenticated', 'authenticated',
   'mikkelstaehrmadsen+testOutsider@gmail.com',
   crypt('Abc123456', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Test Outsider"}'::jsonb,
   now(), now(), '', '', '', '');

-- ----------------------------------------------------------------------------
-- 5. Opret auth.identities (kræves for email-login)
-- ----------------------------------------------------------------------------
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES
  ('a1111111-1111-1111-1111-111111111111',
   'a1111111-1111-1111-1111-111111111111',
   '{"sub":"a1111111-1111-1111-1111-111111111111","email":"mikkelstaehrmadsen+testA1@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),

  ('a2222222-2222-2222-2222-222222222222',
   'a2222222-2222-2222-2222-222222222222',
   '{"sub":"a2222222-2222-2222-2222-222222222222","email":"mikkelstaehrmadsen+testA2@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),

  ('b1111111-1111-1111-1111-111111111111',
   'b1111111-1111-1111-1111-111111111111',
   '{"sub":"b1111111-1111-1111-1111-111111111111","email":"mikkelstaehrmadsen+testB1@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),

  ('b2222222-2222-2222-2222-222222222222',
   'b2222222-2222-2222-2222-222222222222',
   '{"sub":"b2222222-2222-2222-2222-222222222222","email":"mikkelstaehrmadsen+testB2@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now()),

  ('0fffffff-ffff-ffff-ffff-ffffffffffff',
   '0fffffff-ffff-ffff-ffff-ffffffffffff',
   '{"sub":"0fffffff-ffff-ffff-ffff-ffffffffffff","email":"mikkelstaehrmadsen+testOutsider@gmail.com","email_verified":true}'::jsonb,
   'email', now(), now(), now());

-- ----------------------------------------------------------------------------
-- 6. Skift TILBAGE til normal mode (FK + consistency triggers genaktiveret)
-- ----------------------------------------------------------------------------
SET session_replication_role = 'origin';

-- ----------------------------------------------------------------------------
-- 7. family_members + kategorier + konti + transaktioner
--    (her vil consistency-triggers gerne validere - hvilket er OK)
-- ----------------------------------------------------------------------------
-- tours_completed = jsonb-objekt med alle per-page tour keys sat til now(),
-- så onboarding-tours ikke fyrer for test-brugere på dashboard, konti, laan
-- osv. (introduceret i migration 0040). Beta-notice-modalen ligger i
-- sessionStorage og kan ikke skippes via SQL - må klikkes væk én gang.
INSERT INTO public.family_members (
  user_id, household_id, name, email, role, position, setup_completed_at, tours_completed
) VALUES
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Test A1', 'mikkelstaehrmadsen+testA1@gmail.com', 'owner', 0, now(),
   jsonb_build_object('dashboard', now(), 'konti', now(), 'laan', now(), 'indkomst', now(), 'budget', now(), 'poster', now(), 'overforsler', now(), 'faste-udgifter', now(), 'husholdning', now(), 'opsparinger', now())),
  ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Test A2', 'mikkelstaehrmadsen+testA2@gmail.com', 'member', 1, now(),
   jsonb_build_object('dashboard', now(), 'konti', now(), 'laan', now(), 'indkomst', now(), 'budget', now(), 'poster', now(), 'overforsler', now(), 'faste-udgifter', now(), 'husholdning', now(), 'opsparinger', now())),
  ('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Test B1', 'mikkelstaehrmadsen+testB1@gmail.com', 'owner', 0, now(),
   jsonb_build_object('dashboard', now(), 'konti', now(), 'laan', now(), 'indkomst', now(), 'budget', now(), 'poster', now(), 'overforsler', now(), 'faste-udgifter', now(), 'husholdning', now(), 'opsparinger', now())),
  ('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Test B2', 'mikkelstaehrmadsen+testB2@gmail.com', 'member', 1, now(),
   jsonb_build_object('dashboard', now(), 'konti', now(), 'laan', now(), 'indkomst', now(), 'budget', now(), 'poster', now(), 'overforsler', now(), 'faste-udgifter', now(), 'husholdning', now(), 'opsparinger', now())),
  ('0fffffff-ffff-ffff-ffff-ffffffffffff', '33333333-3333-3333-3333-333333333333', 'Test Outsider', 'mikkelstaehrmadsen+testOutsider@gmail.com', 'owner', 0, now(),
   jsonb_build_object('dashboard', now(), 'konti', now(), 'laan', now(), 'indkomst', now(), 'budget', now(), 'poster', now(), 'overforsler', now(), 'faste-udgifter', now(), 'husholdning', now(), 'opsparinger', now()));

INSERT INTO public.categories (id, household_id, name, kind, color) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Andet', 'expense', '#64748b'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Andet', 'expense', '#64748b'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Andet', 'expense', '#64748b');

INSERT INTO public.accounts (id, household_id, created_by, name, kind, editable_by_all, opening_balance) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Household A - Lønkonto', 'checking', true, 1000000),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'Household B - Lønkonto', 'checking', true, 1000000),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-3333-3333-3333-333333333333', '0fffffff-ffff-ffff-ffff-ffffffffffff', 'Outsider - Lønkonto', 'checking', true, 1000000);

INSERT INTO public.transactions (household_id, account_id, category_id, amount, description, occurs_on, recurrence) VALUES
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 50000, 'Test-udgift i Household A', current_date, 'monthly'),
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 50000, 'Test-udgift i Household B', current_date, 'monthly'),
  ('33333333-3333-3333-3333-333333333333', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 50000, 'Test-udgift i Outsider', current_date, 'monthly');

-- ----------------------------------------------------------------------------
-- 8. Verifikation
-- ----------------------------------------------------------------------------
SELECT
  u.email,
  fm.role,
  h.name AS household,
  fm.setup_completed_at IS NOT NULL AS wizard_skipped,
  u.email_confirmed_at IS NOT NULL AS email_verified
FROM auth.users u
JOIN public.family_members fm ON fm.user_id = u.id
JOIN public.households h ON h.id = fm.household_id
WHERE u.email LIKE 'mikkelstaehrmadsen+test%@gmail.com'
ORDER BY h.name, fm.position;
