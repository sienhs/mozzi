package com.ssafy.mozzi.global.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ProfileGuardTest {

    @Test
    void packagedJarWithoutProfileFailsToStart() {
        assertThatThrownBy(() -> ProfileGuard.validate(new String[0], true))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SPRING_PROFILES_ACTIVE");
    }

    @Test
    void ideRunWithoutProfileFallsBackToDefault() {
        assertThatCode(() -> ProfileGuard.validate(new String[0], false)).doesNotThrowAnyException();
    }

    @Test
    void eachRuntimeProfileIsAccepted() {
        for (String profile : ProfileGuard.RUNTIME_PROFILES) {
            assertThatCode(() -> ProfileGuard.validate(new String[] {profile}, true))
                    .doesNotThrowAnyException();
        }
    }

    @Test
    void unknownProfileIsRejected() {
        assertThatThrownBy(() -> ProfileGuard.validate(new String[] {"prd"}, true))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void removedDevProfileIsRejected() {
        assertThatThrownBy(() -> ProfileGuard.validate(new String[] {"dev"}, true))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void multipleRuntimeProfilesAreRejected() {
        assertThatThrownBy(() -> ProfileGuard.validate(new String[] {"local", "prod"}, true))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void classesDirectoryIsNotTreatedAsPackagedJar() {
        assertThat(ProfileGuard.isPackagedJar(ProfileGuard.class)).isFalse();
    }

}
