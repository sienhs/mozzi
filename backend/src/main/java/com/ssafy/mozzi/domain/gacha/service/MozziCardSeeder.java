package com.ssafy.mozzi.domain.gacha.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.gacha.entity.MozziCard;
import com.ssafy.mozzi.domain.gacha.repository.MozziCardRepository;

/**
 * Registers the cards in {@code seed/mozzi_cards.csv} at start-up (S15P31D102-138).
 *
 * <p>Only codes not in {@code mozzi_card} yet are inserted, so the first start registers
 * every card and later ones add only rows appended to the file. A registered card is never
 * changed here. Off in tests ({@code mozzi.gacha.seed-cards}), which insert their own cards.
 *
 * <p>The file has a header and the columns {@code code, series, name, tier, emotion,
 * image_key, prompt}. No value contains a comma, so lines are split plainly. An empty prompt is
 * stored as {@code null}: basic mozzi have none.
 *
 * <p>Runs before {@link BasicMozziBackfill}, which hands the basic mozzi registered here to
 * existing members.
 */
@Component
@Order(1)
@ConditionalOnProperty(name = "mozzi.gacha.seed-cards", havingValue = "true", matchIfMissing = true)
public class MozziCardSeeder implements CommandLineRunner {

    static final String SEED_FILE = "seed/mozzi_cards.csv";

    private static final Logger log = LoggerFactory.getLogger(MozziCardSeeder.class);
    private static final int COLUMNS = 7;

    private final MozziCardRepository mozziCardRepository;

    public MozziCardSeeder(MozziCardRepository mozziCardRepository) {
        this.mozziCardRepository = mozziCardRepository;
    }

    @Override
    @Transactional
    public void run(String... args) throws IOException {
        Set<String> registered = mozziCardRepository.findAllCodes();
        List<MozziCard> added = readCards().stream()
                .filter(card -> !registered.contains(card.getCode()))
                .toList();
        if (added.isEmpty()) {
            return;
        }
        mozziCardRepository.saveAll(added);
        log.info("card seed: registered {} cards from {}", added.size(), SEED_FILE);
    }

    private static List<MozziCard> readCards() throws IOException {
        List<MozziCard> cards = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new ClassPathResource(SEED_FILE).getInputStream(), StandardCharsets.UTF_8))) {
            reader.readLine();
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.isBlank()) {
                    cards.add(parse(line));
                }
            }
        }
        return cards;
    }

    private static MozziCard parse(String line) {
        String[] cols = line.split(",", -1);
        if (cols.length != COLUMNS) {
            throw new IllegalStateException(SEED_FILE + " needs " + COLUMNS + " columns: " + line);
        }
        return MozziCard.register(cols[0], cols[1], cols[2], CardTier.valueOf(cols[3]),
                Emotion.valueOf(cols[4]), cols[5], cols[6].isEmpty() ? null : cols[6]);
    }

}
