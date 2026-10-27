-- Member rules for Google social login (auth design, 2026-10-27).
--
-- What changes:
--   * A member row is created only once the nickname is submitted, so PENDING_PROFILE rows
--     no longer exist and nickname becomes NOT NULL.
--   * Nicknames are 2-12 characters and unique among active members, ignoring ASCII case.
--   * A withdrawn member may sign up again immediately with the same Google account, so the
--     Google identity is unique among active members only.
--
-- The existing data is checked first and the migration stops if any row does not fit. It
-- never truncates a nickname, merges accounts or drops a pending member on its own: each of
-- those loses data, and the right conversion has to be decided by a person.

do
$$
    begin
        if exists (select 1 from member where status = 'PENDING_PROFILE' or nickname is null) then
            raise exception 'V4 stopped: member rows without a nickname (PENDING_PROFILE) exist. Convert or remove them explicitly, then run the migration again.';
        end if;

        if exists (select 1 from member where nickname !~ '^[가-힣A-Za-z0-9]{2,12}$') then
            raise exception 'V4 stopped: nicknames that break the 2-12 character rule exist. Rename them explicitly, then run the migration again.';
        end if;

        if exists (select 1
                   from member
                   where deleted_at is null
                   group by lower(nickname)
                   having count(*) > 1) then
            raise exception 'V4 stopped: active members share a nickname that differs only in case. Resolve the duplicates explicitly, then run the migration again.';
        end if;
    end
$$;

-- V1 kept the Google identity unique across withdrawn rows too, to enforce a re-signup
-- waiting period that the new policy drops.
drop index uq_member_provider_subject;

create unique index uq_member_active_provider_subject
    on member (provider, provider_subject)
    where deleted_at is null;

alter table member
    alter column nickname type varchar(12);

alter table member
    alter column nickname set not null;

-- The nickname is stored as typed ("Alice") and compared lowercased, so "alice" collides
-- with it. Lowercasing only affects ASCII letters here because the allowed characters are
-- Hangul syllables, ASCII letters and digits.
--
-- The application checks first to give a friendly answer, but only this index decides a
-- race between two sign-ups with the same nickname.
create unique index uq_member_active_nickname
    on member (lower(nickname))
    where deleted_at is null;

comment on column member.nickname is 'set at sign-up and never changed; unique ignoring ASCII case';
comment on column member.status is 'ACTIVE -> WITHDRAWN';
