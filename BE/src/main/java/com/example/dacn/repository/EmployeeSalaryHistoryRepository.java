package com.example.dacn.repository;
import com.example.dacn.entity.EmployeeSalaryHistory; import org.springframework.data.jpa.repository.JpaRepository; import java.time.LocalDate; import java.util.*;
public interface EmployeeSalaryHistoryRepository extends JpaRepository<EmployeeSalaryHistory,Long> { List<EmployeeSalaryHistory> findByEmployeeIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(Long employeeId, LocalDate date); }
