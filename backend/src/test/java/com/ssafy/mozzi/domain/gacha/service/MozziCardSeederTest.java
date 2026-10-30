package com.ssafy.mozzi.domain.gacha.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.gacha.repository.MozziCardRepository;
import com.ssafy.mozzi.support.GachaFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * The seeder is off in tests, so it is built here by hand against the real table.
 */
@IntegrationTest
class MozziCardSeederTest {

    private static final int SEED_CARDS = 325;

    @Autowired
    private MozziCardRepository mozziCardRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private GachaFixtures fixtures;
    private MozziCardSeeder seeder;

    @BeforeEach
    void setUp() {
        fixtures = new GachaFixtures(jdbcTemplate);
        fixtures.reset();
        seeder = new MozziCardSeeder(mozziCardRepository);
    }

    @AfterEach
    void tearDown() {
        fixtures.reset();
    }

    @Test
    void registersEveryCardOfTheFileIntoAnEmptyTable() throws Exception {
        seeder.run();

        assertThat(mozziCardRepository.count()).isEqualTo(SEED_CARDS);
        Map<String, Object> first = jdbcTemplate.queryForMap(
                "select series, name, tier, emotion, image_key, prompt from mozzi_card where code = 'S1-01-01'");
        assertThat(first).containsEntry("series", "S1")
                .containsEntry("name", "구름사자 모찌 (행복)")
                .containsEntry("tier", "MYTHIC")
                .containsEntry("emotion", "HAPPY")
                .containsEntry("image_key", "GACHA/S1-01-01_mozzi_mythic_001_happy_r2.png")
                .containsEntry("prompt",
                        "wearing an ivory cloud plush hood with round gold ears and a rainbow hair pin on the side");
    }

    @Test
    void addsOnlyCodesNotRegisteredYet() throws Exception {
        fixtures.card("S1-01-01", CardTier.COMMON);

        seeder.run();
        seeder.run();

        assertThat(mozziCardRepository.count()).isEqualTo(SEED_CARDS);
        assertThat(jdbcTemplate.queryForObject(
                "select tier from mozzi_card where code = 'S1-01-01'", String.class)).isEqualTo("COMMON");
    }

}
