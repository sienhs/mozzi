-- The mozzi a member picked for each emotion (S15P31D102-140). Only an owned card of that
-- emotion can be picked; an emotion with no row shows the app's default.
create table my_mozzi_emoticon
(
    member_id  bigint      not null references member (member_id),
    emotion    varchar(10) not null,
    card_id    bigint      not null references mozzi_card (card_id),
    updated_at timestamptz not null,
    primary key (member_id, emotion)
);

-- The card drawn into a picture: the member's pick for the diary's emotion when the picture
-- was requested, so changing the pick later does not change a picture already on its way.
-- Null when nothing was picked; the AI server then draws its default character. The
-- request's own character_id is kept as sent.
alter table diary_image add column mozzi_card_id bigint references mozzi_card (card_id);
