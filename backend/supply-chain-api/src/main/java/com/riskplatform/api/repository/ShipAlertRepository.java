package com.riskplatform.api.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import com.riskplatform.api.model.ShipAlert;

public interface ShipAlertRepository extends MongoRepository<ShipAlert, String> {
}