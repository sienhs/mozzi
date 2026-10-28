package com.ssafy.mozzi.integration.fcm;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.ssafy.mozzi.domain.member.service.PushMessage;
import com.ssafy.mozzi.domain.member.service.PushSender;

/** Stands in for FCM where no Firebase key is set. Logs the title, never the token. */
class LoggingPushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingPushSender.class);

    @Override
    public Outcome send(String token, PushMessage message) {
        log.info("push (not sent, no Firebase key): title={} data={}", message.title(), message.data());
        return Outcome.SENT;
    }

}
