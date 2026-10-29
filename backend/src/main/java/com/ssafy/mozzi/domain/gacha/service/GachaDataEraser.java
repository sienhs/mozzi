package com.ssafy.mozzi.domain.gacha.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.gacha.repository.GachaDrawRepository;
import com.ssafy.mozzi.domain.gacha.repository.GachaDrawResultRepository;
import com.ssafy.mozzi.domain.gacha.repository.MemberCardRepository;
import com.ssafy.mozzi.domain.wallet.service.WalletService;

/**
 * Deletes a withdrawing member's draws, cards and wallet, children first: nothing in the
 * schema cascades.
 */
@Service
public class GachaDataEraser {

    private final GachaDrawResultRepository drawResultRepository;
    private final GachaDrawRepository drawRepository;
    private final MemberCardRepository memberCardRepository;
    private final WalletService walletService;

    public GachaDataEraser(GachaDrawResultRepository drawResultRepository, GachaDrawRepository drawRepository,
            MemberCardRepository memberCardRepository, WalletService walletService) {
        this.drawResultRepository = drawResultRepository;
        this.drawRepository = drawRepository;
        this.memberCardRepository = memberCardRepository;
        this.walletService = walletService;
    }

    /**
     * Runs in the withdrawal's transaction. The wallet lock is taken first, so a draw already
     * running finishes before its rows are deleted rather than leaving some behind.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void eraseFor(Long memberId) {
        walletService.lock(memberId);
        drawResultRepository.deleteByMember(memberId);
        drawRepository.deleteByMember(memberId);
        memberCardRepository.deleteByMember(memberId);
        walletService.deleteAll(memberId);
    }

}
