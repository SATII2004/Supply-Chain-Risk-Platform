package com.riskplatform.api.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Document(collection = "real_time_alerts")
public class ShipAlert {
    @Id
    private String id;
    
    @Field("ship_name")
    private String shipName;
    
    @Field("latitude")
    private double latitude;
    
    @Field("longitude")
    private double longitude;
    
    @Field("speed")
    private double speed;
    
    @Field("status_text")
    private String statusText;
    
    @Field("risk_assessment")
    private int riskAssessment;

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getShipName() { return shipName; }
    public void setShipName(String shipName) { this.shipName = shipName; }
    
    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }
    
    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }
    
    public double getSpeed() { return speed; }
    public void setSpeed(double speed) { this.speed = speed; }
    
    public String getStatusText() { return statusText; }
    public void setStatusText(String statusText) { this.statusText = statusText; }
    
    public int getRiskAssessment() { return riskAssessment; }
    public void setRiskAssessment(int riskAssessment) { this.riskAssessment = riskAssessment; }
}