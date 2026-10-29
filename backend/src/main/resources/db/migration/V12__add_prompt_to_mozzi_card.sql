-- The card's look in English (S15P31D102-138), sent to the AI server when the member picks
-- the card as the picture's character. Cards registered before this have none.
alter table mozzi_card add column prompt varchar(200);
