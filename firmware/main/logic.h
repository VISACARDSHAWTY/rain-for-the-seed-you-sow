#pragma once
#include <Stepper.h>


#define STEPS_PER_REV 2048
#define STEPS_100DEG 200


Stepper myStepper(STEPS_PER_REV, IN1, IN3, IN2, IN4);

int currentZone = 0; 

void moveToZone(int zone) {
  if (zone == currentZone) return;
  myStepper.setSpeed(10); 

  if (zone == 1 && currentZone != 1) {
    myStepper.step(currentZone == 2 ? STEPS_100DEG * 2 : STEPS_100DEG);
  } else if (zone == 2 && currentZone != 2) {
    myStepper.step(currentZone == 1 ? -STEPS_100DEG * 2 : -STEPS_100DEG);
  } else if (zone == 0) {
    myStepper.step(currentZone == 1 ? -STEPS_100DEG : STEPS_100DEG);
  }

  currentZone = zone;

  
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
}