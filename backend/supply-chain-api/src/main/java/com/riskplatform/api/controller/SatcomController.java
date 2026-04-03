package com.riskplatform.api.controller;

import com.riskplatform.api.model.SatcomMessage;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;

@Controller
@CrossOrigin(origins = "*")
public class SatcomController {

    private final SimpMessagingTemplate messagingTemplate;

    public SatcomController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/sendAlert")
    public void transmitAlert(@Payload SatcomMessage alert) {
        System.out.println("🚨 TACTICAL COMM: Transmitting " + alert.getAlertSeverity() + " to " + alert.getTargetShipId());
        
        if ("ALL".equalsIgnoreCase(alert.getTargetShipId())) {
            messagingTemplate.convertAndSend("/topic/fleet", alert);
        } else {
            messagingTemplate.convertAndSend("/topic/ship/" + alert.getTargetShipId(), alert);
        }
    }
    
 // Captain replies to Admin here -> /app/replyAdmin
    @MessageMapping("/replyAdmin")
    public void replyToAdmin(@Payload SatcomMessage reply) {
        System.out.println("🎙️ INCOMING COMM FROM " + reply.getSender() + ": " + reply.getMessage());
        // Push message to the Admin's private inbox
        messagingTemplate.convertAndSend("/topic/admin", reply);
    }
    
    
    
}