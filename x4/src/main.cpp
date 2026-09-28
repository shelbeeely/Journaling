#ifdef ARDUINO
#include <Arduino.h>
#include "app.h"
// The app keeps its screen state in locals and std::string buffers; give the loop task room.
SET_LOOP_TASK_STACK_SIZE(16 * 1024);
void setup() { appMain(); }
void loop() {}
#endif
