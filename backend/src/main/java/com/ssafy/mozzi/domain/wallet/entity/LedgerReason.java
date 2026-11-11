package com.ssafy.mozzi.domain.wallet.entity;

/**
 * Why a balance moved (ERD {@code wallet_ledger.reason}). {@code EVENT} and {@code ADMIN} are
 * written by operators, not by the API.
 */
public enum LedgerReason {
    SIGNUP,
    DAILY_LOGIN,
    DAILY_RECORD,
    CARE,
    DRAW,
    DUPLICATE,
    EXCHANGE,
    EVENT,
    ADMIN
}
