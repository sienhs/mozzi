-- The request's character_id was stored but never read: the mozzi drawn is mozzi_card_id,
-- taken from the member's pick for the diary's emotion (V13).
alter table diary_image drop column character_id;
