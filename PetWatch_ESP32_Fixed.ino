

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include "HX711.h"
#include <time.h>


// =====================================================
// 1. WIFI AND SUPABASE CONFIGURATION
// =====================================================


const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";


const char* SUPABASE_URL = "https://gtshyrkotossqkykbkyl.supabase.co";
const char* SUPABASE_KEY = "sb_publishable_QaXsBrkW4xySw7q-dB1NHA_IS8Odhwa";


// Device timezone: Philippines (UTC+8)
const long GMT_OFFSET_SEC = 8 * 3600;
const int DAYLIGHT_OFFSET_SEC = 0;


// =====================================================
// 2. HARDWARE PINOUT - PRESERVED
// =====================================================


LiquidCrystal_I2C lcd(0x27, 16, 2);


#define DHTPIN 16
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);


const int foodServoPin = 13;
const int pumpRelayPin = 14;


const int trigPin1 = 27;
const int echoPin1 = 26;


const int trigPin2 = 33;
const int echoPin2 = 32;


const int foodDtPin = 25;
const int foodSckPin = 18;


const int waterDtPin = 4;
const int waterSckPin = 5;


// =====================================================
// 3. OBJECTS
// =====================================================


Servo foodServo;
HX711 scaleFood;
HX711 scaleWater;


// =====================================================
// 4. CONFIGURATION
// =====================================================


float calibrationFactorFood = 420.0;
float calibrationFactorWater = 420.0;


float DEFAULT_TARGET_WEIGHT = 100.0;


// Adjust these angles to match your actual dispenser.
const int SERVO_CLOSED_ANGLE = 0;
const int SERVO_OPEN_ANGLE = 90;


// Active LOW relay:
// LOW = ON
// HIGH = OFF
const int PUMP_ON = LOW;
const int PUMP_OFF = HIGH;


// Adjust these values to match your containers.
const float FOOD_CONTAINER_HEIGHT_CM = 20.0;
const float WATER_CONTAINER_HEIGHT_CM = 20.0;


// Safety settings
const unsigned long MAX_FEEDING_TIME_MS = 15000;
const unsigned long MAX_PUMP_TIME_MS = 30000;


// Sensor upload and polling intervals
const unsigned long SENSOR_INTERVAL_MS = 5000;
const unsigned long COMMAND_INTERVAL_MS = 3000;
const unsigned long SCHEDULE_INTERVAL_MS = 15000;


// =====================================================
// 5. TIMERS
// =====================================================


unsigned long previousSensorMillis = 0;
unsigned long previousCommandMillis = 0;
unsigned long previousScheduleMillis = 0;


// =====================================================
// 6. SENSOR VALUES
// =====================================================


float foodWeight = 0;
float waterWeight = 0;


float foodLevel = 0;
float waterLevel = 0;


float temperature = 0;
float humidity = 0;

// Track whether each sensor returned a fresh, usable reading.
bool foodScaleValid = false;
bool waterScaleValid = false;
bool temperatureValid = false;
bool humidityValid = false;

bool sensorWarningIssued = false;
bool deviceInitialized = false;


// =====================================================
// 7. SUPABASE REQUEST HELPERS
// =====================================================


String apiUrl(String table) {
  return String(SUPABASE_URL) + "/rest/v1/" + table;
}


void configureRequest(HTTPClient& http, WiFiClientSecure& client, String url) {
  // Pass the secure client into HTTPClient so TLS settings are actually used.
  http.begin(client, url);
  // A sb_publishable_* key is an API key, not a JWT.
  // Send it in apikey only; do not put it in Authorization: Bearer.
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");
}


bool postToSupabase(String table, String payload) {
  WiFiClientSecure client;
  client.setInsecure();  // Prototype testing only.


  HTTPClient http;
  configureRequest(http, client, apiUrl(table));
  http.addHeader("Prefer", "return=minimal");


  int response = http.POST(payload);
  String body = http.getString();


  Serial.printf("POST %s: %d\n", table.c_str(), response);


  if (response < 200 || response >= 300) {
    Serial.println(body);
  }


  http.end();
  return response >= 200 && response < 300;
}


String getFromSupabase(String table, String query) {
  WiFiClientSecure client;
  client.setInsecure();  // Prototype testing only.


  HTTPClient http;
  configureRequest(http, client, apiUrl(table) + "?" + query);


  int response = http.GET();
  String body = "";


  if (response >= 200 && response < 300) {
    body = http.getString();
  } else {
    Serial.printf("GET error: %d\n", response);
    Serial.println(http.getString());
  }


  http.end();
  return body;
}


bool patchSupabase(String table, String query, String payload) {
  WiFiClientSecure client;
  client.setInsecure();  // Prototype testing only.


  HTTPClient http;
  configureRequest(http, client, apiUrl(table) + "?" + query);
  http.addHeader("Prefer", "return=minimal");


  int response = http.PATCH(payload);


  if (response < 200 || response >= 300) {
    Serial.printf("PATCH error: %d\n", response);
    Serial.println(http.getString());
  }


  http.end();
  return response >= 200 && response < 300;
}


// =====================================================
// 8. WIFI CONNECTION
// =====================================================


void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);


  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");


  Serial.print("Connecting to WiFi");


  unsigned long start = millis();


  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print(".");
  }


  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.println(WiFi.localIP());


    lcd.clear();
    lcd.print("WiFi Connected");
    delay(1000);
  } else {
    Serial.println("\nWiFi connection failed.");
    lcd.clear();
    lcd.print("WiFi Offline");
    delay(1000);
  }
}


// =====================================================
// 9. TIME SYNCHRONIZATION
// =====================================================


void initializeTime() {
  configTime(
    GMT_OFFSET_SEC,
    DAYLIGHT_OFFSET_SEC,
    "pool.ntp.org",
    "time.google.com");


  struct tm timeInfo;


  if (getLocalTime(&timeInfo, 10000)) {
    Serial.println("Time synchronized.");
  } else {
    Serial.println("Time synchronization failed.");
  }
}


String currentDate() {
  struct tm timeInfo;


  if (!getLocalTime(&timeInfo)) return "";


  char buffer[11];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d", &timeInfo);


  return String(buffer);
}


String currentTime() {
  struct tm timeInfo;


  if (!getLocalTime(&timeInfo)) return "";


  char buffer[6];
  strftime(buffer, sizeof(buffer), "%H:%M", &timeInfo);


  return String(buffer);
}


// ISO-8601 timestamp for Supabase timestamptz (Philippines UTC+08:00).
String currentTimestamp() {
  struct tm timeInfo;
  if (!getLocalTime(&timeInfo)) return "";


  char buffer[26];
  snprintf(buffer, sizeof(buffer),
    "%04d-%02d-%02dT%02d:%02d:%02d+08:00",
    timeInfo.tm_year + 1900, timeInfo.tm_mon + 1, timeInfo.tm_mday,
    timeInfo.tm_hour, timeInfo.tm_min, timeInfo.tm_sec);
  return String(buffer);
}


// =====================================================
// 10. ULTRASONIC MEASUREMENTS
// =====================================================


float measureDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);


  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);


  unsigned long duration = pulseIn(echoPin, HIGH, 30000);


  if (duration == 0) return -1;


  return duration * 0.0343 / 2.0;
}


float calculateLevel(float distance, float containerHeight) {
  if (distance < 0) return -1;


  float level = ((containerHeight - distance) / containerHeight) * 100.0;


  return constrain(level, 0, 100);
}


// =====================================================
// 11. READ SENSORS
// =====================================================


void readSensors() {
  foodScaleValid = false;
  waterScaleValid = false;
  temperatureValid = false;
  humidityValid = false;

  if (scaleFood.is_ready()) {
    foodWeight = scaleFood.get_units(3);
    foodScaleValid = true;
  }

  if (scaleWater.is_ready()) {
    waterWeight = scaleWater.get_units(3);
    waterScaleValid = true;
  }

  float foodDistance = measureDistance(trigPin1, echoPin1);
  float waterDistance = measureDistance(trigPin2, echoPin2);

  foodLevel = calculateLevel(foodDistance, FOOD_CONTAINER_HEIGHT_CM);
  waterLevel = calculateLevel(waterDistance, WATER_CONTAINER_HEIGHT_CM);

  float newTemperature = dht.readTemperature();
  float newHumidity = dht.readHumidity();

  if (!isnan(newTemperature)) {
    temperature = newTemperature;
    temperatureValid = true;
  }

  if (!isnan(newHumidity)) {
    humidity = newHumidity;
    humidityValid = true;
  }

  Serial.println("\n--- PETWATCH SENSOR DATA ---");
  Serial.printf("Food: %s%.2f g\n", foodScaleValid ? "" : "INVALID - ", foodWeight);
  Serial.printf("Water: %s%.2f g\n", waterScaleValid ? "" : "INVALID - ", waterWeight);
  Serial.printf("Food level: %.1f%%\n", foodLevel);
  Serial.printf("Water level: %.1f%%\n", waterLevel);
  Serial.printf("Temperature: %s%.1f C\n", temperatureValid ? "" : "INVALID - ", temperature);
  Serial.printf("Humidity: %s%.1f%%\n", humidityValid ? "" : "INVALID - ", humidity);
}


// =====================================================
// 12. UPLOAD SENSOR READINGS
// =====================================================


void uploadSensorReadings() {
  if (WiFi.status() != WL_CONNECTED) return;

  JsonDocument doc;

  if (foodScaleValid) doc["food_weight"] = foodWeight;
  else doc["food_weight"] = nullptr;

  if (waterScaleValid) doc["water_weight"] = waterWeight;
  else doc["water_weight"] = nullptr;

  if (temperatureValid) doc["temperature"] = temperature;
  else doc["temperature"] = nullptr;

  if (humidityValid) doc["humidity"] = humidity;
  else doc["humidity"] = nullptr;

  if (foodLevel >= 0) doc["food_level"] = foodLevel;
  else doc["food_level"] = nullptr;

  if (waterLevel >= 0) doc["water_level"] = waterLevel;
  else doc["water_level"] = nullptr;

  String payload;
  serializeJson(doc, payload);
  postToSupabase("sensor_readings", payload);
}


// =====================================================
// 13. FEEDING HISTORY
// =====================================================


void saveFeedingHistory(
  String source,
  float target,
  float dispensed,
  String status,
  String details) {
  JsonDocument doc;


  doc["source"] = source;
  doc["target_weight_g"] = target;
  doc["dispensed_weight_g"] = dispensed;
  doc["status"] = status;
  doc["details"] = details;


  String payload;
  serializeJson(doc, payload);


  postToSupabase("feeding_history", payload);
}


// =====================================================
// 14. ALERTS
// =====================================================


void createAlert(String type, String message) {
  JsonDocument doc;


  doc["alert_type"] = type;
  doc["message"] = message;


  String payload;
  serializeJson(doc, payload);


  postToSupabase("alerts", payload);
}


void checkAlerts() {
  // Limit each repeated sensor alert to once per hour.
  // Each alert type has its own timer, so one condition does not block another.
  const unsigned long ALERT_INTERVAL_MS = 60UL * 60UL * 1000UL;

  static unsigned long lastLowFoodAlert = 0;
  static unsigned long lastLowWaterAlert = 0;
  static unsigned long lastHighTemperatureAlert = 0;
  static bool lowFoodAlertSent = false;
  static bool lowWaterAlertSent = false;
  static bool highTemperatureAlertSent = false;

  unsigned long now = millis();

  if (foodLevel >= 0 && foodLevel <= 20 &&
      (!lowFoodAlertSent || now - lastLowFoodAlert >= ALERT_INTERVAL_MS)) {
    createAlert("low_food", "Food container level is low.");
    lastLowFoodAlert = now;
    lowFoodAlertSent = true;
  }

  if (waterLevel >= 0 && waterLevel <= 20 &&
      (!lowWaterAlertSent || now - lastLowWaterAlert >= ALERT_INTERVAL_MS)) {
    createAlert("low_water", "Water container level is low.");
    lastLowWaterAlert = now;
    lowWaterAlertSent = true;
  }

  if (temperature >= 35 &&
      (!highTemperatureAlertSent || now - lastHighTemperatureAlert >= ALERT_INTERVAL_MS)) {
    createAlert("high_temperature", "PetWatch temperature is high.");
    lastHighTemperatureAlert = now;
    highTemperatureAlertSent = true;
  }
}


// =====================================================
// 15. SERVO FEEDING
// =====================================================


bool feedFood(float targetWeight, String source) {
  if (targetWeight <= 0 || targetWeight > 500) {
    return false;
  }


  if (!scaleFood.is_ready()) {
    saveFeedingHistory(
      source, targetWeight, 0, "failed",
      "Food scale is not ready.");
    return false;
  }


  float startingWeight = scaleFood.get_units(5);


  Serial.printf(
    "Starting food weight: %.2f g\n",
    startingWeight);


  foodServo.write(SERVO_OPEN_ANGLE);


  unsigned long start = millis();
  float dispensed = 0;


  while (millis() - start < MAX_FEEDING_TIME_MS) {
    if (scaleFood.is_ready()) {
      float currentWeight = scaleFood.get_units(2);


      dispensed = currentWeight - startingWeight;


      if (dispensed >= targetWeight) {
        break;
      }
    }


    delay(150);
  }


  foodServo.write(SERVO_CLOSED_ANGLE);


  // Allow the load cell to settle.
  delay(1000);


  float finalWeight = scaleFood.get_units(5);
  dispensed = finalWeight - startingWeight;


  bool success = dispensed >= targetWeight * 0.90;


  saveFeedingHistory(
    source,
    targetWeight,
    dispensed,
    success ? "completed" : "failed",
    success ? "Feeding completed." : "Target not reached or safety timeout.");


  if (!success) {
    createAlert(
      "feeding_failed",
      "Feeding did not reach the requested target.");
  }


  Serial.printf("Dispensed: %.2f g\n", dispensed);


  return success;
}


// =====================================================
// 16. WATER PUMP - MANUAL CONTROL ONLY
// =====================================================


void setPump(bool turnOn) {
  digitalWrite(
    pumpRelayPin,
    turnOn ? PUMP_ON : PUMP_OFF);


  Serial.println(
    turnOn ? "Water pump ON" : "Water pump OFF");
}


bool dispenseFoodToCapacity(float targetWeight, String source) {
  if (targetWeight <= 0 || targetWeight > 100) return false;


  if (!scaleFood.is_ready()) {
    saveFeedingHistory(
      source, targetWeight, 0, "failed",
      "Food scale is not ready.");
    return false;
  }


  float startingWeight = scaleFood.get_units(5);


  Serial.printf("Current food: %.2f g\n", startingWeight);


  if (startingWeight >= targetWeight) {
    Serial.println("Food bowl is already at capacity.");
    return true;
  }


  foodServo.write(SERVO_OPEN_ANGLE);


  unsigned long start = millis();


  while (millis() - start < MAX_FEEDING_TIME_MS) {
    if (scaleFood.is_ready()) {
      float currentWeight = scaleFood.get_units(2);


      Serial.printf("Food weight: %.2f g\n", currentWeight);


      if (currentWeight >= targetWeight) {
        break;
      }
    }


    delay(150);
  }


  foodServo.write(SERVO_CLOSED_ANGLE);
  delay(500);


  float finalWeight = scaleFood.get_units(5);
  float dispensed = finalWeight - startingWeight;


  bool success = finalWeight >= targetWeight;


  saveFeedingHistory(
    source,
    targetWeight,
    dispensed,
    success ? "completed" : "failed",
    success ? ("Food bowl reached " + String(targetWeight, 1) + "g capacity.")
            : "Food dispensing timed out.");


  Serial.printf("Final food weight: %.2f g\n", finalWeight);


  return success;
}


bool dispenseWaterToCapacity(float targetWeight, String source) {
  if (targetWeight <= 0 || targetWeight > 100) return false;


  if (!scaleWater.is_ready()) {
    saveFeedingHistory(
      source, targetWeight, 0, "failed",
      "Water scale is not ready.");
    return false;
  }


  float startingWeight = scaleWater.get_units(5);


  Serial.printf("Current water: %.2f g\n", startingWeight);


  if (startingWeight >= targetWeight) {
    Serial.println("Water container is already at capacity.");
    return true;
  }


  setPump(true);


  unsigned long start = millis();


  while (millis() - start < MAX_PUMP_TIME_MS) {
    if (scaleWater.is_ready()) {
      float currentWeight = scaleWater.get_units(2);


      Serial.printf("Water weight: %.2f g\n", currentWeight);


      if (currentWeight >= targetWeight) {
        break;
      }
    }


    delay(100);
  }


  // Always switch off the active-LOW pump.
  setPump(false);


  delay(500);


  float finalWeight = scaleWater.get_units(5);
  float dispensed = finalWeight - startingWeight;


  bool success = finalWeight >= targetWeight;


  saveFeedingHistory(
    source,
    targetWeight,
    dispensed,
    success ? "completed" : "failed",
    success ? ("Water container reached " + String(targetWeight, 1) + "g capacity.")
            : "Water dispensing timed out.");


  Serial.printf("Final water weight: %.2f g\n", finalWeight);


  return success;
}


// =====================================================
// 17. PROCESS DASHBOARD COMMANDS
// =====================================================


void processCommands() {
  if (WiFi.status() != WL_CONNECTED) return;


  String response = getFromSupabase(
    "device_commands",
    "select=*&status=eq.pending&order=created_at.asc&limit=5");


  if (response.length() == 0) return;


  JsonDocument doc;


  if (deserializeJson(doc, response)) {
    Serial.println("Command JSON parsing failed.");
    return;
  }


  for (JsonObject command : doc.as<JsonArray>()) {
    long id = command["id"] | 0;
    String type = command["command"] | "";
    float target = command["target_weight_g"] | DEFAULT_TARGET_WEIGHT;


    if (id == 0) continue;


    // Claim command before executing to reduce duplicate execution.
    String claimQuery =
      "id=eq." + String(id) + "&status=eq.pending";


    bool claimed = patchSupabase(
      "device_commands",
      claimQuery,
      "{\"status\":\"processing\"}");


    if (!claimed) continue;


    bool success = false;
    String result = "";


    if (type == "feed") {
      success = feedFood(target, "manual");
      result = success ? "Feeding completed." : "Feeding failed.";
    } else if (type == "feed_to_capacity") {
      success = dispenseFoodToCapacity(target, "manual");
      result = success
                 ? "Food bowl reached target capacity."
                 : "Food dispensing failed or timed out.";
    } else if (type == "water_to_capacity") {
      success = dispenseWaterToCapacity(target, "manual");
      result = success
                 ? "Water container reached target capacity."
                 : "Water dispensing failed or timed out.";
    } else if (type == "pump_on") {
      setPump(true);
      success = true;
      result = "Water pump switched ON.";
    } else if (type == "pump_off") {
      setPump(false);
      success = true;
      result = "Water pump switched OFF.";
    } else {
      result = "Unknown command.";
    }


    String timestamp = currentTimestamp();
    String completionPayload =
      "{\"status\":\"" + String(success ? "completed" : "failed") +
      "\",\"result\":\"" + result +
      "\",\"completed_at\":\"" + timestamp + "\"}";

    patchSupabase(
      "device_commands",
      "id=eq." + String(id),
      completionPayload);
  }
}


// =====================================================
// 18. AUTOMATIC FEEDING SCHEDULES
// =====================================================


bool scheduleRunsToday(JsonObject schedule, const String& today) {
  String startDate = schedule["start_date"] | today;
  String endDate = schedule["end_date"] | "";
  String recurrence = schedule["recurrence"] | "Every Day";

  if (today < startDate) return false;
  if (endDate.length() > 0 && today > endDate) return false;

  struct tm timeInfo;
  if (!getLocalTime(&timeInfo)) return false;

  // Sunday = 0, Monday = 1 ... Saturday = 6.
  int weekday = timeInfo.tm_wday;

  if (recurrence == "Once") {
    return today == startDate;
  }

  if (recurrence == "Every Day") return true;
  if (recurrence == "Weekdays") return weekday >= 1 && weekday <= 5;
  if (recurrence == "Weekends") return weekday == 0 || weekday == 6;

  if (recurrence == "Custom Days") {
    const char* dayNames[] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
    JsonArray days = schedule["days"].as<JsonArray>();
    for (JsonVariant day : days) {
      if (String(day.as<const char*>()) == dayNames[weekday]) return true;
    }
    return false;
  }

  return false;
}

void checkFeedingSchedules() {
  if (WiFi.status() != WL_CONNECTED) return;

  String today = currentDate();
  String nowTime = currentTime();
  if (today.length() == 0 || nowTime.length() == 0) return;

  String response = getFromSupabase(
    "feeding_schedules",
    "select=*&enabled=eq.true");

  if (response.length() == 0) return;

  JsonDocument doc;
  if (deserializeJson(doc, response)) {
    Serial.println("Schedule JSON parsing failed.");
    return;
  }

  for (JsonObject schedule : doc.as<JsonArray>()) {
    long id = schedule["id"] | 0;
    float foodTarget = schedule["target_weight_g"] | DEFAULT_TARGET_WEIGHT;
    float waterTarget = schedule["water_target_weight_g"] | 100.0;
    String scheduledTime = schedule["schedule_time"] | "";
    String lastDate = schedule["last_executed_date"] | "";
    String type = schedule["type"] | "Food";
    String recurrence = schedule["recurrence"] | "Every Day";

    if (id == 0 || scheduledTime.length() < 5) continue;
    if (lastDate == today) continue;
    if (!scheduleRunsToday(schedule, today)) continue;

    // Catch up if another operation briefly blocked the loop past the scheduled minute.
    if (scheduledTime.substring(0, 5) > nowTime) continue;

    Serial.printf("Schedule %ld is due (%s).\n", id, type.c_str());

    bool success = true;
    bool shouldFeedFood = (type == "Food" || type == "Food & water");
    bool shouldDispenseWater = (type == "Water" || type == "Food & water");

    if (shouldFeedFood) {
      bool foodSuccess = dispenseFoodToCapacity(foodTarget, "schedule");
      success = success && foodSuccess;
    }

    if (shouldDispenseWater) {
      bool waterSuccess = dispenseWaterToCapacity(waterTarget, "schedule");
      success = success && waterSuccess;
    }

    // Mark this occurrence attempted even if it failed, preventing a rapid retry loop.
    String update = "{\"last_executed_date\":\"" + today + "\"";
    if (recurrence == "Once") update += ",\"enabled\":false";
    update += "}";

    patchSupabase(
      "feeding_schedules",
      "id=eq." + String(id),
      update);

    if (!success) {
      createAlert("scheduled_dispensing_failed", "A scheduled food or water operation did not complete.");
    }
  }
}


// =====================================================
// 19. DEVICE STATUS
// =====================================================


void updateDeviceStatus() {
  if (WiFi.status() != WL_CONNECTED) return;


  String timestamp = currentTimestamp();
  if (timestamp.length() == 0) {
    Serial.println("Device status skipped: system time is not synchronized.");
    return;
  }


  String response = getFromSupabase(
    "device_status",
    "select=id&device_name=eq.PetWatch&limit=1");


  JsonDocument doc;
  if (deserializeJson(doc, response)) {
    Serial.println("Could not read device_status from Supabase.");
    return;
  }


  JsonArray rows = doc.as<JsonArray>();
  String payload = "{\"is_online\":true,\"last_seen\":\"" + timestamp + "\"}";


  if (rows.size() > 0) {
    long id = rows[0]["id"] | 0;
    if (id == 0) return;


    bool updated = patchSupabase(
      "device_status",
      "id=eq." + String(id),
      payload);


    Serial.println(updated
      ? "Supabase device heartbeat updated."
      : "Supabase device heartbeat update failed.");
  } else {
    String insertPayload =
      "{\"device_name\":\"PetWatch\",\"is_online\":true,\"last_seen\":\""
      + timestamp + "\"}";


    bool inserted = postToSupabase("device_status", insertPayload);
    Serial.println(inserted
      ? "PetWatch device status row created."
      : "Could not create PetWatch device status row.");
  }
}


// =====================================================


void updateLCD() {
  lcd.clear();


  lcd.setCursor(0, 0);
  lcd.print("Food:");
  lcd.print(foodWeight, 0);
  lcd.print("g");


  lcd.setCursor(0, 1);
  lcd.print("Water:");
  lcd.print(waterWeight, 0);
  lcd.print("g");
}


// =====================================================
// 21. SETUP
// =====================================================


void setup() {
  Serial.begin(115200);


  Wire.begin(21, 22);


  lcd.init();
  lcd.backlight();


  dht.begin();


  pinMode(trigPin1, OUTPUT);
  pinMode(echoPin1, INPUT);


  pinMode(trigPin2, OUTPUT);
  pinMode(echoPin2, INPUT);


  pinMode(pumpRelayPin, OUTPUT);


  // Prevent active-LOW pump from starting at boot.
  digitalWrite(pumpRelayPin, PUMP_OFF);


  foodServo.setPeriodHertz(50);
  foodServo.attach(foodServoPin, 500, 2400);
  foodServo.write(SERVO_CLOSED_ANGLE);


  scaleFood.begin(foodDtPin, foodSckPin);
  scaleWater.begin(waterDtPin, waterSckPin);


  scaleFood.set_scale(calibrationFactorFood);
  scaleWater.set_scale(calibrationFactorWater);


  lcd.clear();
  lcd.print("Initializing...");


  delay(1500);


  // Tare only if the containers are empty or in their
  // intended zero-reference state.
  scaleFood.tare();
  scaleWater.tare();


  connectWiFi();


  if (WiFi.status() == WL_CONNECTED) {
    initializeTime();
    updateDeviceStatus();
  }


  lcd.clear();
  lcd.print("PetWatch Ready");


  deviceInitialized = true;


  Serial.println("PetWatch initialized.");
}


// =====================================================
// 22. MAIN LOOP
// =====================================================


void loop() {
  if (!deviceInitialized) return;


  unsigned long currentMillis = millis();


  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnect = 0;


    if (currentMillis - lastReconnect >= 10000) {
      lastReconnect = currentMillis;
      connectWiFi();
    }
  }


  if (currentMillis - previousSensorMillis >= SENSOR_INTERVAL_MS) {
    previousSensorMillis = currentMillis;


    readSensors();
    updateLCD();


    if (WiFi.status() == WL_CONNECTED) {
      uploadSensorReadings();
      checkAlerts();
      updateDeviceStatus();
    }
  }


  if (currentMillis - previousCommandMillis >= COMMAND_INTERVAL_MS) {
    previousCommandMillis = currentMillis;
    processCommands();
  }


  if (currentMillis - previousScheduleMillis >= SCHEDULE_INTERVAL_MS) {
    previousScheduleMillis = currentMillis;
    checkFeedingSchedules();
  }


  delay(10);
}
