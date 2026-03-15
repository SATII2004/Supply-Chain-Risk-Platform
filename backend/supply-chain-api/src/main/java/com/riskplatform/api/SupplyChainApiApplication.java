package com.riskplatform.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class SupplyChainApiApplication {

	public static void main(String[] args) {
		System.setProperty("spring.data.mongodb.uri", "mongodb://127.0.0.1:27027/supply_chain_db");
		SpringApplication.run(SupplyChainApiApplication.class, args);
		System.out.println("Project is running successfully!!!!!!!!!!!!!!");
	}

}
