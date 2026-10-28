package com.ssafy.mozzi.domain.member.service;

import java.time.Clock;
import java.time.OffsetDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.ssafy.mozzi.domain.member.entity.PushDevice;
import com.ssafy.mozzi.domain.member.repository.PushDeviceRepository;

/**
 * Sends a push to every active device of a member.
 *
 * <p>Not transactional: the devices are read, then each send goes out with no transaction
 * held, so a slow FCM call never keeps a connection or a lock. A token FCM reports as dead is
 * turned off in its own short write.
 *
 * <p>Best effort. A failed send is logged and dropped; the app still finds the result in the
 * diary when it opens. Tokens are never logged.
 */
@Service
public class PushNotifier {

    private static final Logger log = LoggerFactory.getLogger(PushNotifier.class);

    private final PushDeviceRepository pushDeviceRepository;
    private final PushSender pushSender;
    private final Clock clock;

    public PushNotifier(PushDeviceRepository pushDeviceRepository, PushSender pushSender, Clock clock) {
        this.pushDeviceRepository = pushDeviceRepository;
        this.pushSender = pushSender;
        this.clock = clock;
    }

    /** @return how many devices it reached */
    public int notify(Long memberId, PushMessage message) {
        int sent = 0;
        for (PushDevice device : pushDeviceRepository.findByMemberIdAndActiveTrue(memberId)) {
            try {
                if (pushSender.send(device.getToken(), message) == PushSender.Outcome.SENT) {
                    sent++;
                } else {
                    log.info("push: token invalid, device turned off memberId={} pushDeviceId={}",
                            memberId, device.getId());
                    pushDeviceRepository.deactivate(device.getId(), OffsetDateTime.now(clock));
                }
            } catch (RuntimeException e) {
                log.warn("push: send failed memberId={} pushDeviceId={}", memberId, device.getId(), e);
            }
        }
        if (sent == 0) {
            log.info("push: no device reached memberId={}", memberId);
        }
        return sent;
    }

}
