package com.example.dacn;

import com.example.dacn.config.AvatarProperties;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.service.Impl.AvatarStorageServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import com.example.dacn.controller.AvatarController;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class AvatarStorageServiceImplTest {
    @TempDir Path tempDir;

    @Test
    void storesAndLoadsJpegAndPngUsingPublicUrlOnly() throws Exception {
        AvatarStorageServiceImpl service = service(1024);
        String jpegUrl = service.store(new MockMultipartFile("avatar", "x.jpg", "image/jpeg",
                new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff, 1}));
        String pngUrl = service.store(new MockMultipartFile("avatar", "x.png", "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}));

        assertTrue(jpegUrl.matches("/images/avatars/[0-9a-f-]+\\.jpg"));
        assertTrue(pngUrl.matches("/images/avatars/[0-9a-f-]+\\.png"));
        assertTrue(service.load(jpegUrl.substring(jpegUrl.lastIndexOf('/') + 1)).exists());
        assertEquals("image/png", service.contentType(pngUrl.substring(pngUrl.lastIndexOf('/') + 1)));
    }

    @Test
    void rejectsInvalidMagicBytesOversizedFileAndTraversal() {
        AvatarStorageServiceImpl service = service(8);
        assertError(ErrorCode.INVALID_IMAGE, () -> service.store(
                new MockMultipartFile("avatar", "x.jpg", "image/jpeg", new byte[]{1, 2, 3})));
        assertError(ErrorCode.IMAGE_TOO_LARGE, () -> service.store(
                new MockMultipartFile("avatar", "x.png", "image/png", new byte[9])));
        assertError(ErrorCode.INVALID_IMAGE, () -> service.load("../../application.properties"));
    }

    @Test
    void deleteFailureIsContained() throws Exception {
        AvatarStorageServiceImpl service = service(1024);
        String fileName = "123e4567-e89b-12d3-a456-426614174000.jpg";
        Path nonEmptyDirectory = tempDir.resolve(fileName);
        Files.createDirectory(nonEmptyDirectory);
        Files.writeString(nonEmptyDirectory.resolve("child"), "x");

        assertDoesNotThrow(() -> service.deleteSafely("/images/avatars/" + fileName));
        assertTrue(Files.exists(nonEmptyDirectory));
    }

    @Test
    void avatarControllerServesStoredResourceWithImageMediaType() {
        AvatarStorageServiceImpl service = service(1024);
        String url = service.store(new MockMultipartFile("avatar", "x.png", "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}));
        String fileName = url.substring(url.lastIndexOf('/') + 1);

        var response = new AvatarController(service).getAvatar(fileName);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("image/png", response.getHeaders().getContentType().toString());
        assertNotNull(response.getBody());
    }

    private AvatarStorageServiceImpl service(long maxSize) {
        AvatarProperties properties = new AvatarProperties();
        properties.setAvatarDir(tempDir.toString());
        properties.setAvatarUrl("/images/avatars/");
        properties.setAvatarMaxSize(maxSize);
        return new AvatarStorageServiceImpl(properties);
    }

    private void assertError(ErrorCode code, org.junit.jupiter.api.function.Executable executable) {
        AppException exception = assertThrows(AppException.class, executable);
        assertEquals(code, exception.getErrorCode());
    }
}
