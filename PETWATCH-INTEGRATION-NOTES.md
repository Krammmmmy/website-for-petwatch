# PetWatch dashboard and ESP32 integration notes

## Environment

Copy `(.env.local).txt` to `.env.local` (or create `.env.local`) and set the Supabase project URL and publishable key. Do not put a Supabase secret/service-role key in the browser or ESP32 firmware.

## Tables used

- `feeding_schedules`: schedule create/read/update/delete and ESP32 schedule execution.
- `sensor_readings`: latest food/water weight, ultrasonic level, temperature, and humidity.
- `device_status`: device online flag and last-seen time.
- `device_commands`: manual dispense command queue.
- `feeding_history`: completed/failed dispensing activity.
- `alerts`: device alerts and read state.

The dashboard polls sensor readings, device status, history, and alerts every five seconds. Its schedule page now uses `feeding_schedules`, matching the supplied database and ESP32 firmware.

## Required schedule migration

Run `PETWATCH-FEEDING-SCHEDULE-MIGRATION.sql` in Supabase SQL Editor before using the revised schedule page. It adds the schedule name, type, water target, recurrence, selected days, and date-range columns to the existing `feeding_schedules` table without deleting existing rows.

The revised firmware supports `Food`, `Water`, and `Food & water`, plus `Once`, `Every Day`, `Weekdays`, `Weekends`, and `Custom Days` recurrence. Food schedule amount is the additional food mass to dispense in grams. Water schedule target is a total measured water-container weight in grams (default 100 g).

## Supabase API key headers on ESP32

The ESP32 sends the `sb_publishable_...` key in the `apikey` header only. It must not send that publishable key as `Authorization: Bearer`, because publishable keys are not JWTs. RLS policies must allow the `anon` role the specific operations the ESP32 needs. The signed-in dashboard uses the `authenticated` role through Supabase Auth.

## Data interpretation

- HX711 readings are grams.
- Ultrasonic readings are percentages based on the configured container height.
- DHT22 readings are temperature in Celsius and relative humidity percentage.
- Invalid sensor readings are uploaded as SQL `NULL`; the dashboard displays an unavailable state rather than treating an invalid reading as zero.

## Test sequence

1. Run the schedule migration SQL.
2. Add your Wi-Fi SSID/password to `PetWatch_ESP32_Fixed.ino`; keep the publishable key in the `apikey` header only.
3. Upload the firmware and open Serial Monitor at 115200 baud.
4. Confirm `POST sensor_readings` succeeds and new rows appear every five seconds.
5. Confirm `device_status.last_seen` updates.
6. Press the dashboard manual fill button and confirm two `pending` rows appear in `device_commands`.
7. Confirm the ESP32 claims each command, executes it, and updates its status and `completed_at`.
8. Create a schedule and confirm it appears in `feeding_schedules`; test a near-future time while observing the Serial Monitor.
9. Confirm the firmware writes dispensing outcomes to `feeding_history`.

## Hardware notes

- The ESP32 inputs are 3.3 V logic. Do not connect a 5 V ultrasonic ECHO signal directly to an ESP32 GPIO; use an appropriate voltage divider or level shifter.
- Tare each HX711/load-cell assembly with the intended empty container in place. Taring with food or water already loaded makes the displayed mass a relative change, not the actual total container mass.
- Verify relay polarity and pump power wiring before testing. The supplied firmware assumes an active-LOW relay.
