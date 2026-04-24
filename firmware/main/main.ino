#include <WiFi.h>
#include "DHT.h"
#include <ESP32Servo.h>
#include "config.h"
#include "logic.h"

DHT dht(DHT_PIN, DHT11);
Servo myServo;

bool pumpState = false;
bool fanState = false;
bool buzzerState = false;
int currentZone = 0;

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
}

void loop() {

  int soil1 = analogRead(SOIL1_PIN);
  int soil2 = analogRead(SOIL2_PIN);
  int light = analogRead(LIGHT_PIN);
  int waterLevel = analogRead(WATER_LEVEL_PIN);
  int flame = digitalRead(FLAME_PIN);

  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();

  pumpState = false;
  fanState = false;
  buzzerState = false;

  if(autoMode) {

    if(flame == LOW) {
      buzzerState = true;
    }

    if(temp > tempThreshold) {
      fanState = true;
    }

    int targetZone = 0;

    if(soil1 > soilThreshold) targetZone = 1;
    if(soil2 > soilThreshold) targetZone = 2;

    if(targetZone != 0 && waterLevel > waterMinLevel) {

      if(currentZone != targetZone) {
        moveToZone(targetZone);
        currentZone = targetZone;
      }

      int wateringTime = 1000;
      if(temp > tempThreshold) wateringTime += 500;

      pumpState = true;
      digitalWrite(PUMP_PIN, HIGH);
      delay(wateringTime);
      digitalWrite(PUMP_PIN, LOW);
      pumpState = false;
    }

    if(light > lightThreshold) {
      myServo.write(120);
    } else {
      myServo.write(0);
    }
  }

  digitalWrite(PUMP_PIN, pumpState);
  digitalWrite(FAN_PIN, fanState);
  digitalWrite(BUZZER_PIN, buzzerState);

  Serial.print("soil1:"); Serial.print(soil1);
  Serial.print(",soil2:"); Serial.print(soil2);
  Serial.print(",temp:"); Serial.print(temp);
  Serial.print(",humidity:"); Serial.print(humidity);
  Serial.print(",light:"); Serial.print(light);
  Serial.print(",water:"); Serial.print(waterLevel);
  Serial.print(",pump:"); Serial.print(pumpState);
  Serial.print(",fan:"); Serial.print(fanState);
  Serial.print(",buzzer:"); Serial.println(buzzerState);

  delay(2000);
}