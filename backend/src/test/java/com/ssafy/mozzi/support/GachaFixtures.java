package com.ssafy.mozzi.support;

import org.springframework.jdbc.core.JdbcTemplate;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.gacha.entity.CardTier;

/**
 * Wallets and cards, written straight through JDBC.
 *
 * <p>Members made by {@code Member.signUp} in a test skip the sign-up transaction that opens
 * their wallet, so a test whose member writes a diary, draws or withdraws opens one here.
 * Cards are registered by the server outside the migrations, so the tests insert their own.
 */
public final class GachaFixtures {

    private final JdbcTemplate jdbcTemplate;

    public GachaFixtures(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Empties the cards; member rows and everything under them go with {@link DiaryFixtures#reset}. */
    public void reset() {
        jdbcTemplate.execute("truncate table mozzi_card cascade");
    }

    public void wallet(Long memberId) {
        wallet(memberId, 0, 0);
    }

    /**
     * A wallet holding the given balances, with an {@code ADMIN} ledger row for each so the
     * balance still equals the ledger.
     */
    public void wallet(Long memberId, int tickets, int shards) {
        jdbcTemplate.update("""
                insert into member_wallet (member_id, ticket_balance, shard_balance, updated_at)
                values (?, ?, ?, now())
                """, memberId, tickets, shards);
        if (tickets > 0) {
            ledger(memberId, "TICKET", tickets);
        }
        if (shards > 0) {
            ledger(memberId, "SHARD", shards);
        }
    }

    private void ledger(Long memberId, String currency, int amount) {
        jdbcTemplate.update("""
                insert into wallet_ledger (member_id, currency, amount, reason, created_at)
                values (?, ?, ?, 'ADMIN', now())
                """, memberId, currency, amount);
    }

    /** An active card; its code orders it within the tier. */
    public Long card(String code, CardTier tier) {
        return card(code, tier, true);
    }

    public Long card(String code, CardTier tier, boolean active) {
        return jdbcTemplate.queryForObject("""
                insert into mozzi_card (code, series, name, tier, emotion, image_key, is_active)
                values (?, '과일 모찌', ?, ?, ?, ?, ?) returning card_id
                """, Long.class, code, "모찌 " + code, tier.name(), Emotion.HAPPY.name(),
                "cards/" + code + "_mozzi_happy.png", active);
    }

    /** The member already owns the card, seen in the collection. */
    public void owned(Long memberId, Long cardId) {
        jdbcTemplate.update("""
                insert into member_card (member_id, card_id, owned_count, first_acquired_at, seen_at)
                values (?, ?, 1, now(), now())
                """, memberId, cardId);
    }

    public int tickets(Long memberId) {
        return jdbcTemplate.queryForObject(
                "select ticket_balance from member_wallet where member_id = ?", Integer.class, memberId);
    }

    public int shards(Long memberId) {
        return jdbcTemplate.queryForObject(
                "select shard_balance from member_wallet where member_id = ?", Integer.class, memberId);
    }

    /** Sum of the member's ledger in one currency; must always equal the balance. */
    public int ledgerSum(Long memberId, String currency) {
        return jdbcTemplate.queryForObject(
                "select coalesce(sum(amount), 0) from wallet_ledger where member_id = ? and currency = ?",
                Integer.class, memberId, currency);
    }

}
