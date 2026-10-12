package com.example.dacn.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.upload")
public class AvatarProperties {

    private String avatarDir;
    private String avatarUrl;
    private long avatarMaxSize;
}