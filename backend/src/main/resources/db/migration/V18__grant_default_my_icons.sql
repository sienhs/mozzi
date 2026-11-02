-- Default icons for members who signed up before sign-up started making them
-- (DefaultMyIcons). A copy of that list as of this migration: later changes to the list reach
-- new members only.
--
-- Skipped for a member:
--   * an icon they already have under the same category and name. The app used to make a
--     default tag only when it was picked, so many members have some of these already.
--   * icons past the 30-per-category limit (MyIcon.MAX_PER_CATEGORY). The missing defaults
--     are taken in list order until the category is full.
-- Withdrawn members are left out.
--
-- created_at is the member's sign-up time, so the defaults come first in each category, as
-- they do for a new member. Rows are inserted in list order and the id breaks the tie.

with defaults (name, category, sort_order) as (
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
