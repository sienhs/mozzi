package com.ssafy.mozzi.global.config;

import java.net.URL;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import org.springframework.boot.context.event.ApplicationPreparedEvent;
import org.springframework.context.ApplicationListener;

/**
 * Stops the application before startup when the runtime profile is missing or invalid.
 *
 * <ul>
 *   <li>Packaged jar (server): exactly one of local, prod must be set explicitly.</li>
 *   <li>IDE or bootRun: no profile falls back to {@code spring.profiles.default} (local).</li>
 * </ul>
 */
public final class ProfileGuard implements ApplicationListener<ApplicationPreparedEvent> {

    static final Set<String> RUNTIME_PROFILES = Set.of("local", "prod");

    private final boolean packagedJar;

    public ProfileGuard(boolean packagedJar) {
        this.packagedJar = packagedJar;
    }

    @Override
    public void onApplicationEvent(ApplicationPreparedEvent event) {
        validate(event.getApplicationContext().getEnvironment().getActiveProfiles(), packagedJar);
    }

    static void validate(String[] activeProfiles, boolean packagedJar) {
        if (activeProfiles.length == 0) {
            if (packagedJar) {
                throw new IllegalStateException(
                        "No active profile. Set SPRING_PROFILES_ACTIVE to one of " + RUNTIME_PROFILES
                                + " when running the packaged jar.");
            }
            return;
        }

        List<String> runtimeProfiles = Arrays.stream(activeProfiles)
                .filter(RUNTIME_PROFILES::contains)
                .toList();
        if (runtimeProfiles.size() != 1) {
            throw new IllegalStateException(
                    "Exactly one of " + RUNTIME_PROFILES + " must be active, but active profiles were "
                            + Arrays.toString(activeProfiles) + ".");
        }
    }

    public static boolean isPackagedJar(Class<?> applicationClass) {
        URL resource = applicationClass.getResource(applicationClass.getSimpleName() + ".class");
        return resource != null && "jar".equals(resource.getProtocol());
    }

}
