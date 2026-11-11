-- Lower the rarest odds: legendary 7% -> 5%, mythic 1% -> 0.5%. The 2.5 points freed go to
-- rare (30% -> 32.5%). Weights still add up to 100,000, which GachaTierCatalog checks at
-- start-up. Only the weights change; shards and exchange costs stay as they were.
update gacha_tier set weight = 32500 where tier = 'RARE';
update gacha_tier set weight = 5000 where tier = 'LEGENDARY';
update gacha_tier set weight = 500 where tier = 'MYTHIC';
