-- Basic mozzi: one card per emotion that every member gets at sign-up. Its tier is never
-- drawn, so its weight is 0; the row exists only because mozzi_card.tier references
-- gacha_tier. The application leaves it out of the odds and the draw.
insert into gacha_tier (tier, weight, duplicate_shards, exchange_cost)
values ('NONE', 0, 0, null);
