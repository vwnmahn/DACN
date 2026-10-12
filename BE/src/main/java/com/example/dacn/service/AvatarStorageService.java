package com.example.dacn.service;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

public interface AvatarStorageService {
    String store(MultipartFile file);
    Resource load(String fileName);
    String contentType(String fileName);
    void deleteSafely(String avatarUrl);
}
