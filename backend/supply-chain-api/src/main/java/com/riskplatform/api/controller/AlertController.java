package com.riskplatform.api.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.riskplatform.api.model.ShipAlert;
import com.riskplatform.api.repository.ShipAlertRepository;

import java.util.List;

@RestController
@RequestMapping("/api/alerts")
@CrossOrigin(origins = "*") // Allows your React app to fetch this data securely
public class AlertController {

    @Autowired
    private ShipAlertRepository repository;

    @GetMapping("/live")
    public List<ShipAlert> getLiveAlerts() {
        // Fetches all the ships processed by your Python ML script!
        return repository.findAll(); 
    }
}