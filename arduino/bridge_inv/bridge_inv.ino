// USB <-> skilt-bro med invertert logikk (hvile = lav).
// PC (9600 8N1) <-> Uno hardware Serial.   Skilt: D2 = RX (fra skiltets TX), D3 = TX (til skiltets RX).
#include <SoftwareSerial.h>

SoftwareSerial sign(2, 3, true);  // RX, TX, inverse_logic = true

void setup() {
  Serial.begin(9600);
  sign.begin(9600);
  sign.listen();
}

void loop() {
  while (Serial.available()) {
    sign.write(Serial.read());
  }
  while (sign.available()) {
    Serial.write(sign.read());
  }
}
