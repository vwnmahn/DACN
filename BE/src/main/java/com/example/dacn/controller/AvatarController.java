package com.example.dacn.controller;

import com.example.dacn.service.AvatarStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/images/avatars")
@RequiredArgsConstructor
public class AvatarController {
    private final AvatarStorageService avatarStorageService;

    @GetMapping("/{fileName:.+}")
    public ResponseEntity<Resource> getAvatar(@PathVariable String fileName) {
        Resource resource = avatarStorageService.load(fileName);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(avatarStorageService.contentType(fileName)))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                .body(resource);
    }
}
