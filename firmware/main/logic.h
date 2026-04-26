#pragma once

int stepSequence[8][4] = {
  {1,0,0,0},{1,1,0,0},{0,1,0,0},{0,1,1,0},
  {0,0,1,0},{0,0,1,1},{0,0,0,1},{1,0,0,1}
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

void moveToZone(int zone) {
  if(zone == 1) stepMotor(100);
  if(zone == 2) stepMotor(200);
}