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

bool pumpState = false;
bool fanState = false;
bool buzzerState = false;

String pumpSource = "auto";
String fanSource = "auto";
String buzzerSource = "auto";

int currentZone = 0;
int servoAngle = 0;

unsigned long lastPublish = 0;
unsigned long publishInterval = 3000;

void setup_wifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void callback(char* topic, byte* message, unsigned int length) {
  String msg;
  for (int i = 0; i < length; i++) {
    msg += (char)message[i];
  }

  if (msg.indexOf("pump_on") >= 0) {
    pumpState = true;
    pumpSource = "manual";
  }

  if (msg.indexOf("pump_off") >= 0) {
    pumpState = false;
    pumpSource = "manual";
  }

  if (msg.indexOf("fan_on") >= 0) {
    fanState = true;
    fanSource = "manual";
  }

  if (msg.indexOf("fan_off") >= 0) {
    fanState = false;
    fanSource = "manual";
  }

  if (msg.indexOf("auto_on") >= 0) {
    autoMode = true;
  }

  if (msg.indexOf("auto_off") >= 0) {
    autoMode = false;
  }
}

void reconnect() {
  Serial.println("Connecting to MQTT...");
  while (!client.connected()) {
    String clientId = "ESP32-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      client.subscribe("smartplant/control");
      Serial.println("MQTT connected");
    } else {
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(PUMP_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(FLAME_PIN, INPUT);

  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  myServo.attach(SERVO_PIN);
  dht.begin();

  setup_wifi();


  client.setBufferSize(1024);
  Serial.print("MQTT buffer size: ");
  Serial.println(client.getBufferSize());

  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

void loop() {

  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  int soil1 = analogRead(SOIL1_PIN);
  int soil2 = analogRead(SOIL2_PIN);
  int light = analogRead(LIGHT_PIN);
  int waterLevel = analogRead(WATER_LEVEL_PIN);
  int flame = digitalRead(FLAME_PIN);

  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();

  if (flame == LOW) {
    buzzerState = true;
    buzzerSource = "auto";
  } else {
    buzzerState = false;
  }

  if (autoMode) {

    if (temp > tempThreshold) {
      fanState = true;
      fanSource = "auto";
    }

    int targetZone = 0;

    if (soil1 > soilThreshold) targetZone = 1;
    if (soil2 > soilThreshold) targetZone = 2;

    if (targetZone != 0 && waterLevel > waterMinLevel) {

      if (currentZone != targetZone) {
        moveToZone(targetZone);
        currentZone = targetZone;
      }

      int wateringTime = 1000;
      if (temp > tempThreshold) wateringTime += 500;

      pumpState = true;
      pumpSource = "auto";

      digitalWrite(PUMP_PIN, HIGH);
      delay(wateringTime);
      digitalWrite(PUMP_PIN, LOW);

      pumpState = false;
    }

    if (light > lightThreshold) {
      servoAngle = 120;
      myServo.write(servoAngle);
    } else {
      servoAngle = 0;
      myServo.write(servoAngle);
    }
  }

  digitalWrite(PUMP_PIN, pumpState);
  digitalWrite(FAN_PIN, fanState);
  digitalWrite(BUZZER_PIN, buzzerState);

  if (millis() - lastPublish > publishInterval) {
    lastPublish = millis();

    String payload = "{";

    payload += "\"sensors\":{";
    payload += "\"soil1\":" + String(soil1) + ",";
    payload += "\"soil2\":" + String(soil2) + ",";
    payload += "\"temperature\":" + String(temp) + ",";
    payload += "\"humidity\":" + String(humidity) + ",";
    payload += "\"light\":" + String(light) + ",";
    payload += "\"waterLevel\":" + String(waterLevel);
    payload += "},";

    payload += "\"actuators\":{";

    payload += "\"pump\":{\"state\":" + String(pumpState ? "true":"false") + ",\"source\":\"" + pumpSource + "\"},";

    payload += "\"fan\":{\"state\":" + String(fanState ? "true":"false") + ",\"source\":\"" + fanSource + "\"},";

    payload += "\"buzzer\":{\"state\":" + String(buzzerState ? "true":"false") + ",\"source\":\"" + buzzerSource + "\"},";

    payload += "\"servoAngle\":" + String(servoAngle) + ",";
    payload += "\"zone\":" + String(currentZone);

    payload += "}";

    payload += "}";

    bool ok = client.publish("smartplant/data", payload.c_str());
    if (!ok) {
      Serial.print("MQTT publish failed. state=");
      Serial.print(client.state());
      Serial.print(" payload_size=");
      Serial.println(payload.length());
    } else {
      Serial.println("MQTT publish ok");
    }
    Serial.println(payload);
  }
  
}