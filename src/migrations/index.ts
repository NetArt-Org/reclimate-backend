import * as migration_20261006_064232_initial from './20261006_064232_initial';
import * as migration_20261006_090206_circonomy_migration from './20261006_090206_circonomy_migration';
import * as migration_20261006_093503_google_signin from './20261006_093503_google_signin';

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
    name: '20261006_093503_google_signin'
  },
];
