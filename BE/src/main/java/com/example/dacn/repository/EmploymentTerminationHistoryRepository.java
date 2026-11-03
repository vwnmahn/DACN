package com.example.dacn.repository;
import com.example.dacn.entity.EmploymentTerminationHistory; import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface EmploymentTerminationHistoryRepository extends JpaRepository<EmploymentTerminationHistory,Long> { List<EmploymentTerminationHistory> findByEmployeeIdOrderByCreatedAtDesc(Long employeeId); Optional<EmploymentTerminationHistory> findFirstByEmployeeIdAndActionOrderByCreatedAtDesc(Long employeeId,String action); }
