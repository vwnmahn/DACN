package com.example.dacn;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DacnApplication {

    public static void main(String[] args) {
        SpringApplication.run(DacnApplication.class, args);
    }

}
