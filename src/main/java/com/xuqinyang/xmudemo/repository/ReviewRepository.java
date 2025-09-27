package com.xuqinyang.xmudemo.repository;

import com.xuqinyang.xmudemo.model.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    List<Review> findByApplicationId(Long applicationId);
    List<Review> findByReviewerId(Long reviewerId);
}

