package com.example.dacn.config;
import com.example.dacn.service.RestaurantWorkforceService; import lombok.RequiredArgsConstructor; import org.springframework.scheduling.annotation.Scheduled; import org.springframework.stereotype.Component;
@Component @RequiredArgsConstructor public class EmploymentTerminationScheduler {
 private final RestaurantWorkforceService service;
 @Scheduled(fixedDelayString="${app.workforce.termination-scheduler-delay-ms:60000}") public void finalizeDueTerminations(){service.finalizeDueTerminations();}
}
