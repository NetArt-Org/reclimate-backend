import * as migration_20261006_064232_initial from './20261006_064232_initial';
import * as migration_20261006_090206_circonomy_migration from './20261006_090206_circonomy_migration';
import * as migration_20261006_093503_google_signin from './20261006_093503_google_signin';
import * as migration_20261008_095722_field_app from './20261008_095722_field_app';
import * as migration_20261012_050028_field_app_v2 from './20261012_050028_field_app_v2';
import * as migration_20261012_120000_field_rate_limits from './20261012_120000_field_rate_limits';
import * as migration_20261012_180000_field_idempotency from './20261012_180000_field_idempotency';

export const migrations = [
  {
    up: migration_20261006_064232_initial.up,
    down: migration_20261006_064232_initial.down,
    name: '20261006_064232_initial',
  },
  {
    up: migration_20261006_090206_circonomy_migration.up,
    down: migration_20261006_090206_circonomy_migration.down,
    name: '20261006_090206_circonomy_migration',
  },
  {
    up: migration_20261006_093503_google_signin.up,
    down: migration_20261006_093503_google_signin.down,
    name: '20261006_093503_google_signin',
  },
  {
    up: migration_20261008_095722_field_app.up,
    down: migration_20261008_095722_field_app.down,
    name: '20261008_095722_field_app',
  },
  {
    up: migration_20261012_050028_field_app_v2.up,
    down: migration_20261012_050028_field_app_v2.down,
    name: '20261012_050028_field_app_v2'
  },
  {
    up: migration_20261012_120000_field_rate_limits.up,
    down: migration_20261012_120000_field_rate_limits.down,
    name: '20261012_120000_field_rate_limits',
  },
  {
    up: migration_20261012_180000_field_idempotency.up,
    down: migration_20261012_180000_field_idempotency.down,
    name: '20261012_180000_field_idempotency',
  },
];
