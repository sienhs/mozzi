-- Weather the member picked for the picture. NONE when not picked.
alter table diary_image add column weather varchar(10) not null default 'NONE';
