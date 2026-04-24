#include <WiFi.h>
#include "DHT.h"
#include <ESP32Servo.h>

#define SOIL_PIN 34
#define LIGHT_PIN 35
#define WATER_LEVEL_PIN 32
#define FLAME_PIN 27

#define PUMP_PIN 26
#define FAN_PIN 25
#define BUZZER_PIN 33

#define DHT_PIN 4
#define DHT_TYPE DHT11

#define SERVO_PIN 14

#define IN1 18
#define IN2 19
#define IN3 21
#define IN4 22

DHT dht(DHT_PIN, DHT_TYPE);
Servo myServo;

int soilThreshold = 1500;
int tempThreshold = 30;
int waterMinLevel = 1000;
int stepSequence[8][4] = {
  {1,0,0,0},
  {1,1,0,0},
  {0,1,0,0},
  {0,1,1,0},
  {0,0,1,0},
  {0,0,1,1},
  {0,0,0,1},
  {1,0,0,1}
};

void stepMotor(int steps) {
  for(int i = 0; i < steps; i++) {
    for(int j = 0; j < 8; j++) {
      digitalWrite(IN1, stepSequence[j][0]);
      digitalWrite(IN2, stepSequence[j][1]);
      digitalWrite(IN3, stepSequence[j][2]);
      digitalWrite(IN4, stepSequence[j][3]);
      delay(2);
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

  
  if (flame == LOW) { 
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(FAN_PIN, HIGH);
    digitalWrite(PUMP_PIN, HIGH); 

 
    myServo.write(0);
    delay(500);
    myServo.write(90);
    delay(500);
    myServo.write(180);
    delay(500);

   
    stepMotor(100);

  } else {
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(FAN_PIN, LOW);
    digitalWrite(PUMP_PIN, LOW);

    myServo.write(0); 
  }

  delay(2000);
}