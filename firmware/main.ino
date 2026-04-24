#include <WiFi.h>
#include "DHT.h"

#define SOIL_PIN 34
#define LIGHT_PIN 35
#define WATER_LEVEL_PIN 32
#define FLAME_PIN 27

#define PUMP_PIN 26
#define FAN_PIN 25
#define BUZZER_PIN 33

#define DHT_PIN 4
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

int soilThreshold = 1500;
int tempThreshold = 30;
int waterMinLevel = 1000;     


void setup() {
  Serial.begin(115200);

  pinMode(PUMP_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(FLAME_PIN, INPUT);

  digitalWrite(PUMP_PIN, LOW);
  digitalWrite(FAN_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  dht.begin();
}


void loop() {

  int soil = analogRead(SOIL_PIN);
  int light = analogRead(LIGHT_PIN);
  int waterLevel = analogRead(WATER_LEVEL_PIN);
  int flame = digitalRead(FLAME_PIN);

  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();

  Serial.println("------ SENSOR DATA ------");
  Serial.print("Soil: "); Serial.println(soil);
  Serial.print("Light: "); Serial.println(light);
  Serial.print("Water Level: "); Serial.println(waterLevel);
  Serial.print("Temp: "); Serial.println(temp);
  Serial.print("Humidity: "); Serial.println(humidity);
  Serial.print("Flame: "); Serial.println(flame);


  if (soil > soilThreshold && waterLevel > waterMinLevel) {
    digitalWrite(PUMP_PIN, HIGH);
  } else {
    digitalWrite(PUMP_PIN, LOW);
  }

  // if (temp > tempThreshold) {
  //   digitalWrite(FAN_PIN,LOW);
  // } else {
  //   digitalWrite(FAN_PIN, HIGH);
  // }


  if (flame == LOW) { 
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(FAN_PIN, HIGH);
  }
  else {
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(FAN_PIN,LOW);
  }

  delay(2000);
}