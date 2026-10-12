package com.example.dacn.service.Impl;

import com.example.dacn.config.AvatarProperties;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.service.AvatarStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class AvatarStorageServiceImpl implements AvatarStorageService {
    private static final Pattern SAFE_FILE_NAME = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\.(jpg|png)$");

    private final AvatarProperties properties;

    @Override
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_IMAGE);
        }
        if (file.getSize() > properties.getAvatarMaxSize()) {
            throw new AppException(ErrorCode.IMAGE_TOO_LARGE);
        }
        try {
            byte[] bytes = file.getBytes();
            String extension = detectExtension(bytes);
            Path directory = uploadDirectory();
            Files.createDirectories(directory);
            String fileName = UUID.randomUUID() + extension;
            Path target = resolveSafe(fileName);
            Files.write(target, bytes);
            return normalizedPublicUrl() + fileName;
        } catch (IOException exception) {
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }

    @Override
    public Resource load(String fileName) {
        try {
            Path target = resolveSafe(fileName);
            Resource resource = new UrlResource(target.toUri());
            if (!resource.exists() || !resource.isReadable() || !Files.isRegularFile(target)) {
                throw new AppException(ErrorCode.AVATAR_NOT_FOUND);
            }
            return resource;
        } catch (MalformedURLException exception) {
            throw new AppException(ErrorCode.AVATAR_NOT_FOUND);
        }
    }

    @Override
    public String contentType(String fileName) {
        validateFileName(fileName);
        return fileName.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    }

    @Override
    public void deleteSafely(String avatarUrl) {
        String fileName = fileNameFromPublicUrl(avatarUrl);
        if (fileName == null) {
            return;
        }
        try {
            Files.deleteIfExists(resolveSafe(fileName));
        } catch (IOException | RuntimeException exception) {
            // Xóa file là tác vụ hậu commit; lỗi tại đây không được làm sai trạng thái DB.
            log.warn("Không thể xóa file avatar cũ an toàn");
        }
    }

    private Path uploadDirectory() {
        return Paths.get(properties.getAvatarDir()).toAbsolutePath().normalize();
    }

    private Path resolveSafe(String fileName) {
        validateFileName(fileName);
        Path directory = uploadDirectory();
        Path target = directory.resolve(fileName).normalize();
        if (!target.startsWith(directory)) {
            throw new AppException(ErrorCode.INVALID_IMAGE);
        }
        return target;
    }

    private void validateFileName(String fileName) {
        if (fileName == null || !SAFE_FILE_NAME.matcher(fileName).matches()) {
            throw new AppException(ErrorCode.INVALID_IMAGE);
        }
    }

    private String fileNameFromPublicUrl(String avatarUrl) {
        if (avatarUrl == null || !avatarUrl.startsWith(normalizedPublicUrl())) {
            return null;
        }
        String fileName = avatarUrl.substring(normalizedPublicUrl().length());
        return SAFE_FILE_NAME.matcher(fileName).matches() ? fileName : null;
    }

    private String normalizedPublicUrl() {
        String url = properties.getAvatarUrl();
        return url.endsWith("/") ? url : url + "/";
    }

    private String detectExtension(byte[] bytes) {
        if (bytes.length >= 3 && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return ".jpg";
        }
        if (bytes.length >= 8 && (bytes[0] & 0xFF) == 0x89 && bytes[1] == 0x50
                && bytes[2] == 0x4E && bytes[3] == 0x47 && bytes[4] == 0x0D
                && bytes[5] == 0x0A && bytes[6] == 0x1A && bytes[7] == 0x0A) {
            return ".png";
        }
        throw new AppException(ErrorCode.INVALID_IMAGE);
    }
}
