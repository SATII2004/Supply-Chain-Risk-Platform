package com.riskplatform.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.config.AbstractMongoClientConfiguration;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;

@Configuration
public class MongoConfig extends AbstractMongoClientConfiguration {

    @Override
    protected String getDatabaseName() {
        return "supply_chain_db";
    }

    @Override
    public MongoClient mongoClient() {
        // Hard-wiring to the exact IPv4 Docker container address
        return MongoClients.create("mongodb://127.0.0.1:27017"); 
    }
}