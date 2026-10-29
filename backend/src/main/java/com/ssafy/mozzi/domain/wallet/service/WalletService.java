package com.ssafy.mozzi.domain.wallet.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.domain.wallet.entity.Currency;
import com.ssafy.mozzi.domain.wallet.entity.LedgerReason;
import com.ssafy.mozzi.domain.wallet.entity.MemberWallet;
import com.ssafy.mozzi.domain.wallet.entity.RewardType;
import com.ssafy.mozzi.domain.wallet.entity.WalletLedger;
import com.ssafy.mozzi.domain.wallet.repository.MemberWalletRepository;
import com.ssafy.mozzi.domain.wallet.repository.WalletLedgerRepository;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.security.SecurityErrorCode;

/**
 * The only writer of balances. Every method joins the caller's transaction, so a balance and
 * its ledger row commit or roll back together with whatever paid for them (a draw, a diary, a
 * sign-up).
 */
@Service
public class WalletService {

    private final MemberWalletRepository walletRepository;
    private final WalletLedgerRepository ledgerRepository;
    private final MemberRepository memberRepository;
    private final Clock clock;

    public WalletService(MemberWalletRepository walletRepository, WalletLedgerRepository ledgerRepository,
            MemberRepository memberRepository, Clock clock) {
        this.walletRepository = walletRepository;
        this.ledgerRepository = ledgerRepository;
        this.memberRepository = memberRepository;
        this.clock = clock;
    }

    /** Creates the new member's wallet and pays the sign-up reward into it. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void open(Long memberId) {
        walletRepository.save(MemberWallet.open(memberId, OffsetDateTime.now(clock)));
        grant(memberId, RewardType.SIGNUP, null, LocalDate.now(clock));
    }

    /**
     * Locks the member's wallet until the transaction ends.
     *
     * @see #missing
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public MemberWallet lock(Long memberId) {
        return walletRepository.findForUpdate(memberId).orElseThrow(() -> missing(memberId));
    }

    /** The wallet as it stands, without a lock, for screens that only show it. */
    @Transactional(readOnly = true)
    public MemberWallet read(Long memberId) {
        return walletRepository.findById(memberId).orElseThrow(() -> missing(memberId));
    }

    /**
     * Every member gets a wallet at sign-up, and V11 gave one to every member before it, so a
     * missing wallet means the member withdrew after this request passed authentication: the
     * withdrawal deleted it, and a request waiting on its lock finds nothing once that commits.
     * The app answers that the way it answers any ended session.
     */
    private RuntimeException missing(Long memberId) {
        if (memberRepository.findByIdAndDeletedAtIsNull(memberId).isEmpty()) {
            return new BusinessException(SecurityErrorCode.SESSION_REVOKED, "member " + memberId + " withdrew mid-request");
        }
        return new IllegalStateException("no wallet for active member " + memberId);
    }

    /**
     * Moves a balance of a wallet {@link #lock locked} in this transaction and writes its ledger row.
     *
     * @param amount positive to add, negative to spend
     * @param refId  the draw or card the movement belongs to
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void apply(MemberWallet wallet, Currency currency, int amount, LedgerReason reason, Long refId) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        wallet.change(currency, amount, now);
        ledgerRepository.save(WalletLedger.of(wallet.getMemberId(), currency, amount, reason, refId, now));
    }

    /**
     * Pays a ticket reward unless the member already received it.
     *
     * <p>The wallet is locked first and the ledger row is inserted with {@code on conflict do
     * nothing}, so two requests for the same reward pay it once: the second waits for the
     * lock, then finds the key taken.
     *
     * @param refId the diary for {@link RewardType#DAILY_RECORD}, otherwise {@code null}
     * @param date  the day the reward is for
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public RewardGrant grant(Long memberId, RewardType type, Long refId, LocalDate date) {
        MemberWallet wallet = lock(memberId);
        OffsetDateTime now = OffsetDateTime.now(clock);
        int inserted = ledgerRepository.insertReward(
                memberId, type.tickets(), type.reason().name(), refId, type.rewardKey(date), now);
        if (inserted == 0) {
            return new RewardGrant(type, false, wallet.getTicketBalance());
        }
        wallet.change(Currency.TICKET, type.tickets(), now);
        return new RewardGrant(type, true, wallet.getTicketBalance());
    }

    /** Withdrawal: the ledger, then the wallet. Call with the wallet {@link #lock locked}. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void deleteAll(Long memberId) {
        ledgerRepository.deleteByMember(memberId);
        walletRepository.deleteByMember(memberId);
    }

    /**
     * Outcome of {@link #grant}.
     *
     * @param ticketCount the balance after the grant, or as it stands when nothing was paid
     */
    public record RewardGrant(RewardType type, boolean granted, int ticketCount) {

        public int tickets() {
            return granted ? type.tickets() : 0;
        }

    }

}
