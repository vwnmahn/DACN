package com.example.dacn.service;
import com.example.dacn.dto.request.*; import com.example.dacn.dto.response.*; import com.example.dacn.entity.*; import java.util.List;
public interface RestaurantWorkforceService {
 List<RestaurantEmployeeResponse> search(Long restaurantId,String keyword,EmployeePosition position,EmploymentStatus status);
 RestaurantEmployeeResponse create(Long restaurantId,RestaurantEmployeeRequest request);
 RestaurantEmployeeResponse update(Long restaurantId,Long employeeId,RestaurantEmployeeRequest request);
 RestaurantEmployeeResponse changeSalary(Long restaurantId,Long employeeId,EmployeeSalaryRequest request);
 RestaurantEmployeeResponse requestTermination(Long restaurantId,Long employeeId,EmployeeTerminationRequest request);
 RestaurantEmployeeResponse cancelTermination(Long restaurantId,Long employeeId);
 List<EmployeeSalaryHistoryResponse> salaryHistory(Long restaurantId,Long employeeId);
 List<EmploymentTerminationHistoryResponse> terminationHistory(Long restaurantId,Long employeeId);
 void finalizeDueTerminations();
 void saveRent(Long restaurantId,RestaurantRentRequest request);
 List<RestaurantRentCostHistoryResponse> rentHistory(Long restaurantId);
 RestaurantCostReportResponse report(Long restaurantId,int year,int month);
}
