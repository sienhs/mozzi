package com.ssafy.mozzi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

import com.ssafy.mozzi.global.config.ProfileGuard;

@SpringBootApplication
@ConfigurationPropertiesScan
public class MozziApplication {

    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(MozziApplication.class);
        application.addListeners(new ProfileGuard(ProfileGuard.isPackagedJar(MozziApplication.class)));
        application.run(args);
    }

}
