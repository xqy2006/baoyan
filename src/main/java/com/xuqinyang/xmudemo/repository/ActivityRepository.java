package com.xuqinyang.xmudemo.repository;

import com.xuqinyang.xmudemo.model.Activity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActivityRepository extends JpaRepository<Activity, Long> {
    List<Activity> findByIsActiveTrue();
}

