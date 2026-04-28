#include <WiFi.h>
#include "DHT.h"
#include <ESP32Servo.h>
#define MQTT_MAX_PACKET_SIZE 512
#include <PubSubClient.h>
#include "config.h"
#include "logic.h"
#include "wifi_config.h"

DHT dht(DHT_PIN, DHT11);
Servo myServo;
WiFiClient espClient;
PubSubClient client(espClient);

bool pumpState   = false;
bool fanState    = false;
bool buzzerState = false;
bool pumpAutoEnabled = true;
bool fanAutoEnabled = true;
bool tentAutoEnabled = true;
bool tentOpenState = false;
int manualWaterZone = 0;

unsigned long lastPublish = 0;
unsigned long lastDHTRead = 0;
float temp = NAN, humidity = NAN;

const int soilHysteresis = 50;
bool soil1DryState = false;
bool soil2DryState = false;

// ── WiFi ──────────────────────────────────────────────
void setup_wifi() {
  Serial.println("Connecting to WiFi...");
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");

    retries++;

    if (retries % 10 == 0) { 
      wl_status_t status = WiFi.status();

      Serial.print("\nStatus: ");

      switch (status) {
        case WL_NO_SSID_AVAIL:
          Serial.println("SSID not found");
          break;
        case WL_CONNECT_FAILED:
          Serial.println("Wrong password");
          break;
        case WL_DISCONNECTED:
          Serial.println("Disconnected");
          break;
        case WL_IDLE_STATUS:
          Serial.println("Idle...");
          break;
        default:
          Serial.println("Unknown issue");
          break;
      }
      Serial.println("Retrying in 5 seconds...");
      delay(5000);
    }

  }

  Serial.println("\nConnected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}


void callback(char* topic, byte* message, unsigned int length) {
  String msg = "";
  for (int i = 0; i < length; i++) {
    msg += (char)message[i];
  }
  
  msg.trim();                     // VERY IMPORTANT: remove whitespace/newlines
  Serial.print("MQTT Received → ");
  Serial.println(msg);            // Debug: you MUST see this

  // ==================== FAN ====================
  if (msg.equals("fan_on")) {
    fanState = true;
    Serial.println("→ Fan TURNED ON");
  } 
  else if (msg.equals("fan_off")) {
    fanState = false;
    Serial.println("→ Fan TURNED OFF");
  }

  // ==================== TENT (SERVO) ====================
  else if (msg.equals("tent_open")) {
    tentOpenState = true;
    Serial.println("→ Tent OPENED");
  } 
  else if (msg.equals("tent_close")) {
    tentOpenState = false;
    Serial.println("→ Tent CLOSED");
  }

  // ==================== PUMP (should already work) ====================
  else if (msg.equals("pump_on")) {
    pumpState = true;
    Serial.println("→ Pump ON");
  } 
  else if (msg.equals("pump_off")) {
    pumpState = false;
    Serial.println("→ Pump OFF");
  }

  // ==================== AUTO MODES ====================
  else if (msg.equals("pump_auto_on")) pumpAutoEnabled = true;
  else if (msg.equals("pump_auto_off")) pumpAutoEnabled = false;
  else if (msg.equals("fan_auto_on")) fanAutoEnabled = true;
  else if (msg.equals("fan_auto_off")) fanAutoEnabled = false;
  else if (msg.equals("tent_auto_on")) tentAutoEnabled = true;
  else if (msg.equals("tent_auto_off")) tentAutoEnabled = false;

  // ==================== WATERING (already working) ====================
  else if (msg.equals("water_zone_1")) manualWaterZone = 1;
  else if (msg.equals("water_zone_2")) manualWaterZone = 2;
  else if (msg.equals("water_stop")) {
    manualWaterZone = 0;
    pumpState = false;
  }

  // ==================== THRESHOLDS ====================
  else if (msg.startsWith("temp_threshold_")) {
    int val = msg.substring(15).toInt();
    if (val >= 15 && val <= 45) tempThreshold = val;
    Serial.print("→ Temp threshold set to: "); Serial.println(tempThreshold);
  }
  else if (msg.startsWith("soil_threshold_")) {
    int val = msg.substring(15).toInt();
    if (val >= 1000 && val <= 4000) soilThreshold = val;
    Serial.print("→ Soil threshold set to: "); Serial.println(soilThreshold);
  }
  else if (msg.startsWith("light_threshold_")) {
    int val = msg.substring(16).toInt();
    if (val >= 500 && val <= 3000) lightThreshold = val;
    Serial.print("→ Light threshold set to: "); Serial.println(lightThreshold);
  }
}

void reconnect() {
  Serial.println("Connecting to MQTT...");

  while (!client.connected()) {
    String clientId = "ESP32-" + String(random(0xffff), HEX);
    Serial.print("Attempting MQTT connection with ID: ");
    Serial.println(clientId);

    if (client.connect(clientId.c_str())) {
      Serial.println("MQTT connected");
      
      if (client.subscribe("smartplant/control")) {
        Serial.println("Subscribed to topic: smartplant/control");
      } else {
        Serial.println("Failed to subscribe");
      }

    } else {
      Serial.print("MQTT failed, rc=");
      Serial.print(client.state());
      Serial.print(" → ");

      switch (client.state()) {
        case -4:
          Serial.println("Connection timeout");
          break;
        case -3:
          Serial.println("Connection lost");
          break;
        case -2:
          Serial.println("Connect failed (broker unreachable)");
          break;
        case -1:
          Serial.println("Disconnected");
          break;
        case 1:
          Serial.println("Bad protocol");
          break;
        case 2:
          Serial.println("Bad client ID");
          break;
        case 3:
          Serial.println("Server unavailable");
          break;
        case 4:
          Serial.println("Bad username/password");
          break;
        case 5:
          Serial.println("Not authorized");
          break;
        default:
          Serial.println("Unknown error");
          break;
      }

      Serial.println("Retrying in 2 seconds...\n");
      delay(2000);
    }
  }
}

// ── Setup ─────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  pinMode(PUMP_PIN,   OUTPUT);
  pinMode(FAN_PIN,    OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(FLAME_PIN,  INPUT);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);

  myServo.attach(SERVO_PIN);
  dht.begin();
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
  client.setBufferSize(1024);
}

// ── Loop ──────────────────────────────────────────────
void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  
  if (millis() - lastDHTRead >= 2000) {
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) temp     = t;
    if (!isnan(h)) humidity = h;
    lastDHTRead = millis();
  }

  int soil1      = analogRead(SOIL1_PIN);
  int soil2      = analogRead(SOIL2_PIN);
  int light      = analogRead(LIGHT_PIN);
  int waterLevel = analogRead(WATER_LEVEL_PIN);
  int flame      = digitalRead(FLAME_PIN);

  buzzerState = (flame == LOW);

  if (fanAutoEnabled) {
    fanState = (!isnan(temp) && temp > tempThreshold);
  }

  if (tentAutoEnabled) {
    tentOpenState = light > lightThreshold;
  }

  myServo.write(tentOpenState ? 80 : 0);
  if (tentOpenState) {
    Serial.println("LIght");
  }

  if (manualWaterZone == 1 || manualWaterZone == 2) {
    if (currentZone != manualWaterZone) {
      digitalWrite(PUMP_PIN, LOW);
      pumpState = false;
      moveToZone(manualWaterZone);
    }
    pumpState = (waterLevel > waterMinLevel);
  } else if (pumpAutoEnabled) {
    
    if (soil1 > soilThreshold + soilHysteresis) {
      soil1DryState = true;
    } else if (soil1 < soilThreshold - soilHysteresis) {
      soil1DryState = false;
    }

    if (soil2 > soilThreshold + soilHysteresis) {
      soil2DryState = true;
    } else if (soil2 < soilThreshold - soilHysteresis) {
      soil2DryState = false;
    }
    bool soil1Dry = soil1DryState;
    bool soil2Dry = soil2DryState;
    int targetZone = -1;
    if (soil1Dry && waterLevel > waterMinLevel)       targetZone = 1;
    else if (soil2Dry && waterLevel > waterMinLevel)  targetZone = 2;

    if (targetZone != -1) {
      if (targetZone != currentZone) {
        digitalWrite(PUMP_PIN, LOW);
        pumpState = false;
        moveToZone(targetZone);
      }
      pumpState = true;
    } else {
      pumpState = false;
      digitalWrite(PUMP_PIN, LOW);
      moveToZone(0);
    }
  }


  digitalWrite(PUMP_PIN,   pumpState   ? HIGH : LOW);
  digitalWrite(FAN_PIN,    fanState    ? HIGH : LOW);
  digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);

  if (millis() - lastPublish >= 3000) {
    lastPublish = millis();
    String payload = "{\"sensors\":{";
    payload += "\"soil1\":"       + String(soil1)      + ",";
    payload += "\"soil2\":"       + String(soil2)      + ",";
    payload += "\"temperature\":" + String(temp)       + ",";
    payload += "\"humidity\":"    + String(humidity)   + ",";
    payload += "\"light\":"       + String(light)      + ",";
    payload += "\"waterLevel\":"  + String(waterLevel);
    payload += "},\"actuators\":{";
    payload += "\"pump\":{\"state\":" + String(pumpState ? "true":"false") + ",\"autoEnabled\":" + String(pumpAutoEnabled ? "true":"false") + "},";
    payload += "\"fan\":{\"state\":" + String(fanState ? "true":"false") + ",\"autoEnabled\":" + String(fanAutoEnabled ? "true":"false") + "},";
    payload += "\"tent\":{\"state\":" + String(tentOpenState ? "true":"false") + ",\"autoEnabled\":" + String(tentAutoEnabled ? "true":"false") + "},";
    payload += "\"buzzer\":{\"state\":" + String(buzzerState ? "true":"false") + "},";
    payload += "\"manualWaterZone\":" + String(manualWaterZone) + ",";
    payload += "\"zone\":"  + String(currentZone);
    payload += "}}";
    client.publish("smartplant/data", payload.c_str());
    Serial.println(payload);
  }
}
