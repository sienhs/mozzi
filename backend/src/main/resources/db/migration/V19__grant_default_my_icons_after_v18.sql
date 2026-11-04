-- Default icons for members who signed up after V18 ran but before sign-up made them.
--
-- In prod V18 ran when the first server with sign-up's default icons started, but that
-- server died right after (a missing FCM dependency), so the older servers kept taking
-- sign-ups without making them. V18 had already run, so it never reached those members.
--
-- Only members who signed up from a day before V18 ran: a member from before it got the
-- defaults from V18 and may since have deleted some, which must not come back. The day of
-- slack covers installed_on, a plain timestamp, being read in another time zone than it was
-- written in. A member inside that day who deleted a default in it gets it back, which is
-- the smaller harm than one who got none.
--
-- Otherwise the same as V18: an icon the member already has under the same category and name
-- is skipped, and so is anything past the 30-per-category limit.

with v18 (ran_at) as (
    select installed_on
    from flyway_schema_history
    where version = '18'
      and success
),
defaults (name, category, sort_order) as (
    values ('공부', 'WHAT', 1),
           ('일하기', 'WHAT', 2),
           ('운동', 'WHAT', 3),
           ('산책', 'WHAT', 4),
           ('휴식', 'WHAT', 5),
           ('식사', 'WHAT', 6),
           ('요리', 'WHAT', 7),
           ('독서', 'WHAT', 8),
           ('집', 'WHERE', 9),
           ('회사', 'WHERE', 10),
           ('학교', 'WHERE', 11),
           ('카페', 'WHERE', 12),
           ('공원', 'WHERE', 13),
           ('가족', 'WHO', 14),
           ('친구', 'WHO', 15),
           ('연인', 'WHO', 16),
           ('동료', 'WHO', 17)
),
missing as (
    select m.member_id,
           m.created_at,
           d.name,
           d.category,
           d.sort_order,
           row_number() over (partition by m.member_id, d.category order by d.sort_order) as nth
    from member m
             cross join defaults d
    where m.deleted_at is null
      and m.created_at >= (select ran_at - interval '1 day' from v18)
      and not exists (select 1
                      from my_icon mi
                      where mi.member_id = m.member_id
                        and mi.category = d.category
                        and mi.name = d.name
                        and mi.deleted_at is null)
)
insert
into my_icon (member_id, name, category, created_at, updated_at)
select ms.member_id, ms.name, ms.category, ms.created_at, ms.created_at
from missing ms
where ms.nth + (select count(*)
                from my_icon mi
                where mi.member_id = ms.member_id
                  and mi.category = ms.category
                  and mi.deleted_at is null) <= 30
order by ms.member_id, ms.sort_order;
