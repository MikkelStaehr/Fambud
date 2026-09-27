-- ============================================================================
-- 0074 - Famtask: skridt på sparks
-- ----------------------------------------------------------------------------
-- En spark kan brydes ned i skridt med beløb og måned, før den bliver til et
-- projekt. Så siger husstanden ja til et gennemregnet budget i stedet for et
-- gæt. Når sparken gøres til projekt, flytter promoteSpark skridtene over
-- (spark_id -> project_id i én update).
--
-- Et skridt har præcis én forælder: enten et projekt eller en spark. Begge
-- sammensatte FK'er er MATCH SIMPLE, så den der er NULL springes over, og
-- den der er sat skal pege på samme husstand (samme mønster som 0072).
--
-- plan.project_budget er uændret: den joiner på project_id, så skridt der
-- stadig ligger på en spark tælles ikke med i projekternes budget.
--
-- RLS er uændret: "members all steps" (0072) tjekker household_id, og den
-- sammensatte FK sikrer at sparken hører til samme husstand.
--
-- plan.promote_spark() gør forfremmelsen atomisk: opret projekt, flyt
-- skridt og sæt promoted_project_id i én transaktion. SECURITY INVOKER, så
-- kalderens RLS gælder som ved almindelige kald. Tjeklisten (0073) tjekkes
-- i promoteSpark før kaldet; den er en procesregel, ikke en sikkerhedsgrænse.
-- ============================================================================

alter table plan.steps
  alter column project_id drop not null,
  add column spark_id uuid,
  add constraint steps_spark_same_household_fkey
    foreign key (spark_id, household_id)
    references plan.sparks(id, household_id)
    on delete cascade,
  add constraint steps_one_parent
    check ((project_id is null) <> (spark_id is null));

create index steps_spark_position_idx on plan.steps(spark_id, position)
  where spark_id is not null;

-- Returnerer projektets id. Er sparken allerede forfremmet (dobbeltklik,
-- eller partneren nåede det først), returneres det eksisterende projekt.
-- NULL = sparken findes ikke eller er skjult af RLS.
create function plan.promote_spark(p_spark_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_spark plan.sparks%rowtype;
  v_project_id uuid;
begin
  -- Låsen gør at to samtidige klik ikke laver to projekter: den anden
  -- venter og ser derefter promoted_project_id.
  select * into v_spark from plan.sparks where id = p_spark_id for update;
  if not found then
    return null;
  end if;
  if v_spark.promoted_project_id is not null then
    return v_spark.promoted_project_id;
  end if;

  insert into plan.projects
    (household_id, title, purpose, estimated_amount, target_month, owner_member_id)
  values
    (v_spark.household_id, v_spark.title, v_spark.note, v_spark.estimated_amount,
     v_spark.target_month, v_spark.owner_member_id)
  returning id into v_project_id;

  update plan.steps
    set project_id = v_project_id, spark_id = null
    where spark_id = p_spark_id and household_id = v_spark.household_id;

  update plan.sparks
    set promoted_project_id = v_project_id
    where id = p_spark_id;

  return v_project_id;
end;
$$;

revoke all on function plan.promote_spark(uuid) from public;
grant execute on function plan.promote_spark(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

comment on column plan.steps.spark_id is 'Sat mens skridtet hører til en spark. Flyttes til project_id når sparken bliver til et projekt.';
