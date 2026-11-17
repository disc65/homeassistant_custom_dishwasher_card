# Configuration

The minimum card configuration is:

```yaml
type: custom:dishwasher-card
device_id: 0123456789abcdef0123456789abcdef
```

Optional keys include `title`, `accent_color`, `show_program`, `show_delay`,
`show_options`, `show_maintenance`, `program_names`, and explicit entity mappings
below `entities`.

`show_maintenance` defaults to `false` so existing dashboards keep the same layout.
When enabled, the card can display Home Connect Local salt, rinse-aid, Machine Care,
filter, and descaling status entities when those entities are available.

Home Connect Local (`homeconnect_ws`) is supported by device discovery in addition to
the built-in Home Connect integration. Current Home Connect Local program identifiers
such as `dishcare_dishwasher_program_eco50` and the older underscored identifiers are
both mapped to readable English names.

Device-based discovery is preferred. Explicit entity IDs may be supplied when Home
Connect naming or registry behavior requires an override. Unknown optional entities are
ignored without preventing the card from rendering.

## Starting a wash

Program selection updates **Selected program** only. Once powered on, **Start program**
sends that selected option to **Active program**, which starts the wash through the
Home Connect integration. Power on does not start a wash automatically.

Start requires ready/finished operation, enabled remote start, a reported closed/locked
door, and the selected raw option in both selects' options. A mapped connectivity or
power entity must report on. An idle Active program can report unknown/none; its
options still determine support. If a prerequisite is missing, Start is disabled with
an explanation. Explicit mappings use `entities.selectedProgram` and
`entities.activeProgram` with the corresponding `select.*` entities.

With Home Connect Local (`homeconnect_ws`), Active program is a read-only sensor and
the wash is started with the integration's Start button. When a `button.*` entity is
mapped as `startButton` (discovered from entity IDs ending in `_start_program` or
`_start`), **Start program** presses that button instead of writing Active program.
The button must not report `unavailable`; a never-pressed button reporting `unknown`
is fine. The door may also be a binary sensor, where `off` counts as closed. The card
confirms the start once the operation reports running or scheduled.

Entity IDs renamed to another language are not discovered. Map them explicitly:

```yaml
type: custom:dishwasher-card
entities:
  connectivity: binary_sensor.kuche_spulmaschine_verbindung
  power: switch.kuche_spulmaschine_einschalter
  remoteStart: binary_sensor.kuche_spulmaschine_fernstart_erlaubt
  door: binary_sensor.kuche_spulmaschine_tur
  operation: sensor.kuche_spulmaschine_betriebszustand
  selectedProgram: select.kuche_spulmaschine_ausgewahltes_programm
  activeProgram: sensor.kuche_spulmaschine_aktives_programm
  startButton: button.kuche_spulmaschine_start
  stop: button.kuche_spulmaschine_abbrechen
```

While selecting, wait for both the service response and the reported selection before
starting. While starting, the controls show progress until the matching active program
and running/scheduled operation are reported, even if the service response is still
pending. The card times out after 35 seconds without retrying. Check the appliance
state before trying again after a timeout. Config changes and disconnects end
observation; they cannot undo a command already sent.
