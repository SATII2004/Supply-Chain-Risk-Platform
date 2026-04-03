package com.riskplatform.api.model;

import java.time.Instant;

public class SatcomMessage {
    private String targetShipId; // "ALL" for fleet-wide, or specific IMO
    private String alertSeverity; // "WARNING", "CRITICAL", "INFO"
    private String message;
    private String sender;
    private String timestamp;

    public SatcomMessage() {
        this.timestamp = Instant.now().toString();
    }

    // Getters and Setters
    public String getTargetShipId() { return targetShipId; }
    public void setTargetShipId(String targetShipId) { this.targetShipId = targetShipId; }

    public String getAlertSeverity() { return alertSeverity; }
    public void setAlertSeverity(String alertSeverity) { this.alertSeverity = alertSeverity; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
}