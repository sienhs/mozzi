package com.ssafy.mozzi.domain.image.exception;

/**
 * The member's picks are not something to draw: profanity, sexual content, violence and the
 * like. Icon names are free text the member types, and checking each one with a model when it
 * is registered would cost a call per icon, so they are checked here, once per picture, in
 * the same call that translates them.
 *
 * <p>The message never carries what the member wrote.
 */
public class InappropriatePromptException extends RuntimeException {

    public InappropriatePromptException() {
        super("picture inputs judged inappropriate");
    }

}
