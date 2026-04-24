#pragma once

#define SOIL1_PIN 34
#define SOIL2_PIN 39
#define LIGHT_PIN 35
#define WATER_LEVEL_PIN 32
#define FLAME_PIN 27

#define PUMP_PIN 26
#define FAN_PIN 25
#define BUZZER_PIN 33

#define DHT_PIN 4
#define SERVO_PIN 14

#define IN1 18
#define IN2 19
#define IN3 21
#define IN4 22

int soilThreshold = 1500;
int tempThreshold = 30;
int lightThreshold = 2000;
int waterMinLevel = 1000;

bool autoMode = true;