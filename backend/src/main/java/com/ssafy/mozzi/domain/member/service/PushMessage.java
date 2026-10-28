package com.ssafy.mozzi.domain.member.service;

import java.util.Map;

/**
 * One notification to a member's devices.
 *
 * @param title shown by the OS while the app is in the background
 * @param body  shown under the title
 * @param data  read by the app, for example to open the diary the push is about. Values are
 *              strings because FCM data only carries strings
 */
public record PushMessage(String title, String body, Map<String, String> data) {

    public PushMessage {
        data = Map.copyOf(data);
    }

}
