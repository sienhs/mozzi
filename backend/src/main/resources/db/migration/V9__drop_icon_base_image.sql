-- Icons become text only (S15P31D102-120): a member types a name under a category, with no
-- base image to pick. my_icon keeps its category, since every icon is made from the where,
-- who or what tab.
alter table my_icon drop column icon_id;
drop table icon;
