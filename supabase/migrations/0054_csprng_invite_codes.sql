-- Sikkerheds-hotfix: erstat random() med CSPRNG i generate_invite_code()
--
-- Migration 0002 brugte PostgreSQL's random() der er en Lehmer LCG -
-- ikke kryptografisk sikker. En angriber med kendt seed/state kan
-- forudsige kommende koder.
--
-- Vi erstatter med gen_random_bytes() fra pgcrypto (kryptografisk
-- sikker via OS-level CSPRNG). Alfabet og længde uændret så eksisterende
-- koder forbliver gyldige - kun NYE koder genereres med CSPRNG.

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  alphabet_len constant int := 31;
  code_len constant int := 8;
  result text := '';
  rand_bytes bytea;
  byte_val int;
  i int;
begin
  -- gen_random_bytes giver 1 byte pr. tegn vi skal vælge. Vi læser
  -- bytes som 0-255 og modulo'er ned i alfabet-størrelsen. Modulo-bias
  -- på 256 mod 31 er minimal (~3% skævhed på højeste tegn) - acceptabel
  -- for invite-koder hvor keyspace er det vigtige, ikke perfekt uniform
  -- distribution.
  rand_bytes := gen_random_bytes(code_len);

  for i in 1..code_len loop
    byte_val := get_byte(rand_bytes, i - 1);
    result := result || substr(chars, 1 + (byte_val % alphabet_len), 1);
  end loop;

  return result;
end;
$$;

comment on function public.generate_invite_code() is
  'Generer 8-char invite-kode fra 31-char alfabet. Bruger gen_random_bytes (CSPRNG) ikke random() (LCG).';
