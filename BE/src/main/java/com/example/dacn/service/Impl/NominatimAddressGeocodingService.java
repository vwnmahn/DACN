package com.example.dacn.service.Impl;

import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.service.AddressGeocodingService;
import com.example.dacn.service.GeocodedAddress;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class NominatimAddressGeocodingService implements AddressGeocodingService {
    private static final long MIN_REQUEST_INTERVAL_MS = 1_000;
    private final Object requestLock = new Object();
    private final Map<String, GeocodedAddress> cache = new ConcurrentHashMap<>();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper objectMapper;
    private final String searchUrl;
    private final String userAgent;
    private long lastRequestAt;

    public NominatimAddressGeocodingService(
            ObjectMapper objectMapper,
            @Value("${app.geocoding.url}") String searchUrl,
            @Value("${app.geocoding.user-agent}") String userAgent) {
        this.objectMapper = objectMapper;
        this.searchUrl = searchUrl;
        this.userAgent = userAgent;
    }

    @Override
    public GeocodedAddress geocode(String address) {
        if (address == null || address.isBlank()) {
            throw new AppException(ErrorCode.DELIVERY_ADDRESS_NOT_FOUND);
        }
        String normalized = address.trim().toLowerCase(Locale.ROOT);
        GeocodedAddress cached = cache.get(normalized);
        if (cached != null) return cached;

        synchronized (requestLock) {
            cached = cache.get(normalized);
            if (cached != null) return cached;
            throttle();
            try {
                String query = URLEncoder.encode(address.trim(), StandardCharsets.UTF_8);
                URI uri = URI.create(searchUrl + "?format=jsonv2&limit=1&countrycodes=vn&q=" + query);
                HttpRequest request = HttpRequest.newBuilder(uri)
                        .timeout(Duration.ofSeconds(8))
                        .header("Accept", "application/json")
                        .header("Accept-Language", "vi")
                        .header("User-Agent", userAgent)
                        .GET().build();
                lastRequestAt = System.currentTimeMillis();
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new AppException(ErrorCode.DELIVERY_GEOCODING_UNAVAILABLE);
                }
                JsonNode results = objectMapper.readTree(response.body());
                if (!results.isArray() || results.isEmpty()) {
                    throw new AppException(ErrorCode.DELIVERY_ADDRESS_NOT_FOUND);
                }
                JsonNode first = results.get(0);
                GeocodedAddress result = new GeocodedAddress(
                        new BigDecimal(first.path("lat").asText()),
                        new BigDecimal(first.path("lon").asText()));
                cache.put(normalized, result);
                return result;
            } catch (AppException exception) {
                throw exception;
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new AppException(ErrorCode.DELIVERY_GEOCODING_UNAVAILABLE);
            } catch (Exception exception) {
                throw new AppException(ErrorCode.DELIVERY_GEOCODING_UNAVAILABLE);
            }
        }
    }

    private void throttle() {
        long waitMillis = MIN_REQUEST_INTERVAL_MS - (System.currentTimeMillis() - lastRequestAt);
        if (waitMillis <= 0) return;
        try {
            Thread.sleep(waitMillis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AppException(ErrorCode.DELIVERY_GEOCODING_UNAVAILABLE);
        }
    }
}
